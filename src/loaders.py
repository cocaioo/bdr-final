"""Generic CSV standardization and PostgreSQL loading."""

import logging
import os
import re
from pathlib import Path

import pandas as pd

from . import cleaning as C
from . import db
from . import enrichment
from .utils import (
    extract_year,
    find_data_file,
    find_data_files,
    read_csv,
    write_clean_csv,
)

logger = logging.getLogger(__name__)


def load_table(config, conn, schema, data_dir, clean_dir, log_dir=None):
    table_name = config["table"]
    data_dir = Path(data_dir)
    log_dir = Path(log_dir or os.getenv("LOG_DIR", "./logs"))
    df, stats = extract_table_frame(config, data_dir)
    if df is None:
        return stats

    out_copy = standardize_table_frame(config, df, data_dir, log_dir)
    stats["rows_clean"] = len(out_copy)
    logger.info(f"  {len(out_copy):,} linhas padronizadas")

    clean_path = write_standardized_frame(config, out_copy, clean_dir)
    logger.info(f"  CSV padronizado salvo: {clean_path.name}")

    try:
        load_standardized_frame(conn, schema, table_name, out_copy.columns.tolist(), clean_path)
        stats["rows_loaded"] = stats["rows_clean"]
        logger.info(f"  {stats['rows_loaded']:,} linhas carregadas no banco")
    except Exception as exc:
        stats["status"] = "erro_carga"
        stats["error"] = str(exc)
        conn.rollback()
        logger.error(f"  Erro no COPY: {exc}")

    return stats


def extract_table_frame(config, data_dir):
    table_name = config["table"]
    csv_file = config.get("file")
    csv_pattern = config.get("file_pattern")
    data_dir = Path(data_dir)
    stats = _empty_stats(table_name)

    if "generated_rows" in config:
        df = pd.DataFrame(config["generated_rows"])
        stats["source_files"] = "generated"
        stats["rows_raw"] = len(df)
        logger.info(f"  Gerando {table_name}.csv...")
        return df, stats

    csv_paths = _resolve_csv_paths(data_dir, csv_file, csv_pattern)
    if not csv_paths:
        stats["status"] = "skip"
        expected = csv_pattern or csv_file or "sem CSV configurado"
        stats["error"] = f"arquivo nao encontrado: {expected} em {data_dir.resolve()}"
        logger.warning(f"  Skip: {stats['error']}")
        return None, stats

    frames = []
    source_files = []
    years = []
    for csv_path in csv_paths:
        year = extract_year(csv_path)
        raw_label = str(csv_path)
        if csv_path.parent.resolve() != data_dir.resolve():
            logger.info(f"  Arquivo encontrado em subpasta: {raw_label}")
        logger.info(f"  Lendo {raw_label}...")

        bad_lines = []
        frame = read_csv(csv_path, bad_lines=bad_lines)
        skipped_rows = len(bad_lines)
        if skipped_rows:
            logger.warning(f"  {skipped_rows:,} linhas possivelmente puladas em {csv_path.name}")

        if config.get("year_from_file"):
            frame["__ano_dados"] = str(year) if year is not None else None

        frames.append(frame)
        source_files.append(str(csv_path))
        if year is not None:
            years.append(str(year))
        stats["rows_raw"] += len(frame)
        stats["rows_bad"] += skipped_rows

    df = pd.concat(frames, ignore_index=True) if len(frames) > 1 else frames[0]
    stats["source_files"] = "|".join(source_files)
    stats["years"] = "|".join(sorted(set(years)))
    logger.info(f"  {stats['rows_raw']:,} linhas lidas em {len(csv_paths)} arquivo(s)")
    return df, stats


def standardize_table_frame(config, df, data_dir, log_dir=None):
    table_name = config["table"]
    data_dir = Path(data_dir)
    log_dir = Path(log_dir or os.getenv("LOG_DIR", "./logs"))
    transform_type = config.get("transform")
    if transform_type == "deputados":
        out = _transform_deputados(df, data_dir)
    else:
        out = _standardize_columns(df, config)

    if config.get("year_from_file"):
        out.insert(0, "ano_dados", df["__ano_dados"].apply(C.clean_int))

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
        bad_required = out[mask.any(axis=1)].head(100)
        if not bad_required.empty:
            _write_bad_rows(bad_required, log_dir, table_name, "required")
        out = out[~mask.any(axis=1)]
        removed = before - len(out)
        if removed:
            logger.warning(f"  {removed:,} linhas removidas por campos obrigatorios nulos")

    skip = config.get("skip_identity", [])
    copy_columns = [c for c in out.columns if c not in skip]
    out_copy = out[copy_columns]
    _validate_numeric_columns(out_copy, config, log_dir, table_name)
    return out_copy


def write_standardized_frame(config, frame, clean_dir):
    clean_path = Path(clean_dir) / f"{config['table']}.csv"
    write_clean_csv(frame, clean_path)
    return clean_path


def load_standardized_frame(conn, schema, table_name, columns, clean_path):
    db.copy_csv(conn, schema, table_name, columns, clean_path)


def _empty_stats(table_name):
    return {
        "table": table_name,
        "source_files": "",
        "years": "",
        "rows_raw": 0,
        "rows_bad": 0,
        "rows_clean": 0,
        "rows_loaded": 0,
        "status": "ok",
        "error": None,
    }


def _resolve_csv_paths(data_dir, csv_file, csv_pattern):
    if csv_pattern:
        return find_data_files(data_dir, csv_pattern)
    if csv_file:
        found = find_data_file(data_dir, csv_file)
        return [found] if found else []
    return []


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
    out["id_legislatura_inicial"] = (
        df["idLegislaturaInicial"].apply(C.clean_int)
        if "idLegislaturaInicial" in df
        else None
    )
    out["id_legislatura_final"] = (
        df["idLegislaturaFinal"].apply(C.clean_int)
        if "idLegislaturaFinal" in df
        else None
    )
    out["escolaridade"] = None

    if "idLegislaturaFinal" in df.columns:
        is_current = out["id_legislatura_final"] == "57"
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
            "id_legislatura_inicial": None,
            "id_legislatura_final": None,
            "escolaridade": None,
        })

    if missing_rows:
        out = pd.concat([out, pd.DataFrame(missing_rows)], ignore_index=True)
        logger.info(f"  {len(missing_rows):,} deputados ausentes adicionados por outras tabelas")

    return enrichment.enrich_deputados(out)


def _collect_relevant_deputados(data_dir):
    data_dir = Path(data_dir)
    deputies = {}

    for gastos in find_data_files(data_dir, "Ano-*.csv"):
        df = read_csv(gastos)
        for _, row in df.iterrows():
            if _is_lideranca(row.get("txNomeParlamentar")):
                continue
            _add_deputado(
                deputies,
                row.get("ideCadastro"),
                nome=row.get("txNomeParlamentar"),
                cpf=row.get("cpf"),
                sigla_partido=row.get("sgPartido"),
                sigla_uf=row.get("sgUF"),
            )

    for votos in find_data_files(data_dir, "votacoesVotos-*.csv"):
        df = read_csv(votos)
        for _, row in df.iterrows():
            _add_deputado(
                deputies,
                row.get("deputado_id"),
                nome=row.get("deputado_nome"),
                sigla_partido=row.get("deputado_siglaPartido"),
                sigla_uf=row.get("deputado_siglaUf"),
            )

    for presencas in find_data_files(data_dir, "eventosPresencaDeputados-*.csv"):
        df = read_csv(presencas)
        for _, row in df.iterrows():
            _add_deputado(deputies, row.get("idDeputado"))

    for autores in find_data_files(data_dir, "proposicoesAutores-*.csv"):
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


def _validate_numeric_columns(df, config, log_dir, table_name):
    rules = _numeric_rules(config)
    if "ano_dados" in df.columns:
        rules["ano_dados"] = "int"

    bad_parts = []
    for column, rule in rules.items():
        if column not in df.columns:
            continue
        values = df[column].dropna().astype(str)
        values = values[values != ""]
        if rule == "int":
            invalid = ~values.str.match(r"^-?\d+$")
        elif rule == "decimal":
            invalid = ~values.str.match(r"^-?\d+(\.\d+)?$")
        elif rule == "bool":
            invalid = ~values.str.lower().isin({"true", "false"})
        else:
            continue
        if invalid.any():
            bad_parts.append(df.loc[values[invalid].index].head(100))
            logger.warning(
                "  Coluna %s tem %s valores fora do formato esperado",
                column,
                int(invalid.sum()),
            )

    if bad_parts:
        _write_bad_rows(pd.concat(bad_parts).drop_duplicates().head(100), log_dir, table_name, "numeric")


def _numeric_rules(config):
    rules = {}
    for _, (db_col, clean_fn) in config.get("columns", {}).items():
        if clean_fn == C.clean_int:
            rules[db_col] = "int"
        elif clean_fn in {C.clean_decimal, C.clean_money}:
            rules[db_col] = "decimal"
        elif clean_fn == C.clean_boolean:
            rules[db_col] = "bool"
    return rules


def _write_bad_rows(df, log_dir, table_name, reason):
    log_dir = Path(log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)
    safe_reason = re.sub(r"[^a-z0-9_]+", "_", reason.lower())
    path = log_dir / f"bad_rows_{table_name}_{safe_reason}.csv"
    write_clean_csv(df, path)
    logger.warning(f"  Amostra de linhas problematicas salva: {path}")


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
