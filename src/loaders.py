"""Generic CSV standardization and PostgreSQL loading."""

import logging
from pathlib import Path

import pandas as pd

from . import cleaning as C
from . import db
from . import enrichment
from .utils import read_csv, write_clean_csv

logger = logging.getLogger(__name__)


def load_table(config, conn, schema, data_dir, clean_dir):
    table_name = config["table"]
    csv_file = config.get("file")
    stats = {
        "table": table_name,
        "rows_raw": 0,
        "rows_clean": 0,
        "rows_loaded": 0,
        "status": "ok",
        "error": None,
    }

    if "generated_rows" in config:
        df = pd.DataFrame(config["generated_rows"])
        stats["rows_raw"] = len(df)
        logger.info(f"  Gerando {table_name}.csv...")
    else:
        if csv_file is None:
            stats["status"] = "skip"
            stats["error"] = "sem CSV disponivel"
            return stats

        csv_path = Path(data_dir) / csv_file
        if not csv_path.exists():
            stats["status"] = "skip"
            stats["error"] = f"arquivo nao encontrado: {csv_file}"
            return stats

        logger.info(f"  Lendo {csv_file}...")
        df = read_csv(csv_path)
        stats["rows_raw"] = len(df)
        logger.info(f"  {len(df):,} linhas lidas")

    transform_type = config.get("transform")
    if transform_type == "deputados":
        out = _transform_deputados(df, data_dir)
    else:
        out = _standardize_columns(df, config)

    if transform_type == "votacoes" and "id_evento" in out.columns:
        out["id_evento"] = out["id_evento"].replace({"0": None})

    if config.get("drop_if") == "lideranca" and "nome_parlamentar" in out.columns:
        before = len(out)
        out = out[~out["nome_parlamentar"].apply(_is_lideranca)]
        removed = before - len(out)
        if removed:
            logger.info(f"  {removed:,} registros de lideranca removidos")

    pk_cols = config["pk"]
    if pk_cols:
        before = len(out)
        out = out.drop_duplicates(subset=pk_cols, keep="first")
        removed = before - len(out)
        if removed:
            logger.info(f"  {removed:,} duplicatas removidas")

    required = config.get("required", [])
    if required:
        present_required = [c for c in required if c in out.columns]
        before = len(out)
        mask = out[present_required].isna() | (out[present_required] == "")
        out = out[~mask.any(axis=1)]
        removed = before - len(out)
        if removed:
            logger.info(f"  {removed:,} linhas removidas por campos obrigatorios nulos")

    skip = config.get("skip_identity", [])
    copy_columns = [c for c in out.columns if c not in skip]
    out_copy = out[copy_columns]

    stats["rows_clean"] = len(out_copy)
    logger.info(f"  {len(out_copy):,} linhas padronizadas")

    clean_path = Path(clean_dir) / f"{table_name}.csv"
    write_clean_csv(out_copy, clean_path)
    logger.info(f"  CSV padronizado salvo: {clean_path.name}")

    try:
        db.copy_csv(conn, schema, table_name, copy_columns, clean_path)
        stats["rows_loaded"] = stats["rows_clean"]
        logger.info(f"  {stats['rows_loaded']:,} linhas carregadas no banco")
    except Exception as exc:
        stats["status"] = "erro_carga"
        stats["error"] = str(exc)
        conn.rollback()
        logger.error(f"  Erro no COPY: {exc}")

    return stats


def _standardize_columns(df, config):
    out = pd.DataFrame()
    for csv_col, (db_col, clean_fn) in config["columns"].items():
        if csv_col in df.columns:
            out[db_col] = df[csv_col].apply(clean_fn) if clean_fn else df[csv_col]
        else:
            out[db_col] = None
    return out


def _transform_deputados(df, data_dir):
    relevant = _collect_relevant_deputados(data_dir)

    out = pd.DataFrame()
    out["id_deputado"] = df["uri"].apply(C.extract_id_from_uri).apply(C.clean_int)
    out["uri_deputado"] = df["uri"].apply(C.clean_text)
    out["nome"] = df["nome"].apply(C.clean_text)
    out["nome_civil"] = df["nomeCivil"].apply(C.clean_text) if "nomeCivil" in df else None
    out["cpf"] = df["cpf"].apply(C.clean_cpf) if "cpf" in df else None
    out["escolaridade"] = None

    if "idLegislaturaFinal" in df.columns:
        legislatura_final = df["idLegislaturaFinal"].apply(C.clean_int)
        is_current = legislatura_final == "57"
    else:
        is_current = pd.Series(False, index=df.index)

    is_relevant = out["id_deputado"].isin(relevant.keys())
    out = out[is_current | is_relevant].copy()

    existing_ids = set(out["id_deputado"].dropna().astype(str))
    missing_rows = []
    for id_deputado, info in relevant.items():
        if id_deputado in existing_ids:
            _merge_deputado_info(out, id_deputado, info)
            continue
        missing_rows.append({
            "id_deputado": id_deputado,
            "uri_deputado": f"https://dadosabertos.camara.leg.br/api/v2/deputados/{id_deputado}",
            "nome": info.get("nome") or f"Deputado {id_deputado}",
            "nome_civil": None,
            "cpf": info.get("cpf"),
            "escolaridade": None,
        })

    if missing_rows:
        out = pd.concat([out, pd.DataFrame(missing_rows)], ignore_index=True)
        logger.info(f"  {len(missing_rows):,} deputados ausentes adicionados por outras tabelas")

    return enrichment.enrich_deputados(out)


def _collect_relevant_deputados(data_dir):
    data_dir = Path(data_dir)
    deputies = {}

    gastos = data_dir / "Ano-2026.csv"
    if gastos.exists():
        df = read_csv(gastos)
        for _, row in df.iterrows():
            if _is_lideranca(row.get("txNomeParlamentar")):
                continue
            _add_deputado(
                deputies,
                row.get("nuDeputadoId"),
                nome=row.get("txNomeParlamentar"),
                cpf=row.get("cpf"),
                sigla_partido=row.get("sgPartido"),
                sigla_uf=row.get("sgUF"),
            )

    votos = data_dir / "votacoesVotos-2026.csv"
    if votos.exists():
        df = read_csv(votos)
        for _, row in df.iterrows():
            _add_deputado(
                deputies,
                row.get("deputado_id"),
                nome=row.get("deputado_nome"),
                sigla_partido=row.get("deputado_siglaPartido"),
                sigla_uf=row.get("deputado_siglaUf"),
            )

    presencas = data_dir / "eventosPresencaDeputados-2026.csv"
    if presencas.exists():
        df = read_csv(presencas)
        for _, row in df.iterrows():
            _add_deputado(deputies, row.get("idDeputado"))

    autores = data_dir / "proposicoesAutores-2026.csv"
    if autores.exists():
        df = read_csv(autores)
        for _, row in df.iterrows():
            _add_deputado(
                deputies,
                row.get("idDeputadoAutor"),
                nome=row.get("nomeAutor"),
                sigla_partido=row.get("siglaPartidoAutor"),
                sigla_uf=row.get("siglaUFAutor"),
            )

    return deputies


def _add_deputado(deputies, raw_id, nome=None, cpf=None, sigla_partido=None, sigla_uf=None):
    id_deputado = C.clean_int(raw_id)
    if id_deputado is None:
        return
    current = deputies.setdefault(id_deputado, {})
    for key, value, clean_fn in [
        ("nome", nome, C.clean_text),
        ("cpf", cpf, C.clean_cpf),
        ("sigla_partido", sigla_partido, C.clean_party),
        ("sigla_uf", sigla_uf, C.clean_upper),
    ]:
        cleaned = clean_fn(value)
        if cleaned and not current.get(key):
            current[key] = cleaned


def _merge_deputado_info(out, id_deputado, info):
    mask = out["id_deputado"].astype(str) == str(id_deputado)
    for column in ["nome", "cpf"]:
        value = info.get(column)
        if value:
            out.loc[mask & (out[column].isna() | (out[column] == "")), column] = value


def _is_lideranca(value):
    text = C.remove_accents(value)
    if text is None:
        return False
    text = text.upper()
    return text.startswith("LID.") or text.startswith("LIDERANCA")
