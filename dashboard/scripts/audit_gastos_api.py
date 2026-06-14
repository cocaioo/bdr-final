"""Audita a base local de gastos contra a API de Dados Abertos da Camara.

Esta rotina nao altera o dashboard nem incorpora registros automaticamente. Ela
gera artefatos de diagnostico para apoiar a decisao sobre enriquecimento futuro.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd


REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from dashboard.scripts.generate_gastos_analytics import normalize_supplier

DEFAULT_LOCAL_PATH = REPO_ROOT / "dados_padronizados" / "gastos.csv"
DEFAULT_RAW_DIR = REPO_ROOT / "tabelas"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "artifacts" / "gastos"
API_BASE = "https://dadosabertos.camara.leg.br/api/v2/deputados"
USER_AGENT = "BDR-Gastos-Audit/1.0"

LOCAL_REQUIRED_COLUMNS = [
    "ano_dados",
    "id_deputado",
    "nome_parlamentar",
    "sigla_uf",
    "sigla_partido",
    "valor_liquido",
    "descricao_despesa",
    "fornecedor",
]

COMPARISON_COLUMNS = [
    "fonte_dado",
    "origem_local",
    "origem_api",
    "data_coleta_api",
    "id_deputado",
    "ano",
    "mes",
    "descricao_despesa",
    "descricao_normalizada",
    "fornecedor",
    "fornecedor_normalizado",
    "cnpj_cpf_fornecedor",
    "valor_documento",
    "valor_glosa",
    "valor_liquido",
    "valor_liquido_centavos",
    "data_documento",
    "numero_documento",
    "tipo_documento",
    "cod_documento",
    "url_documento",
]

KEY_COLUMNS = [
    "id_deputado",
    "ano",
    "mes",
    "descricao_normalizada",
    "fornecedor_normalizado",
    "cnpj_cpf_fornecedor",
    "valor_liquido_centavos",
    "data_documento",
    "numero_documento",
]


@dataclass(frozen=True)
class AuditScope:
    deputado_id: str
    ano: int
    mes: int | None = None


def read_local_gastos(path: Path = DEFAULT_LOCAL_PATH) -> pd.DataFrame:
    df = pd.read_csv(path, sep=";", dtype=str, low_memory=False)
    missing = [column for column in LOCAL_REQUIRED_COLUMNS if column not in df.columns]
    if missing:
        raise ValueError(f"Colunas ausentes em {path}: {', '.join(missing)}")
    df["valor_liquido_num"] = df["valor_liquido"].map(parse_money)
    return df


def diagnose_local_base(df: pd.DataFrame) -> dict[str, Any]:
    years = sorted(str(value) for value in df["ano_dados"].dropna().astype(str).unique())
    by_year = (
        df.assign(ano_dados=df["ano_dados"].astype(str))
        .groupby("ano_dados", dropna=False)
        .agg(qtd_despesas=("valor_liquido_num", "size"), valor_total=("valor_liquido_num", "sum"))
        .reset_index()
        .sort_values("ano_dados")
    )
    return {
        "total_linhas_local": int(len(df)),
        "anos_local": years,
        "qtd_deputados_local": int(df["id_deputado"].nunique()),
        "valor_total_local": round(float(df["valor_liquido_num"].sum()), 2),
        "qtd_despesas_por_ano_local": {
            str(row["ano_dados"]): int(row["qtd_despesas"]) for _, row in by_year.iterrows()
        },
        "valor_total_por_ano_local": {
            str(row["ano_dados"]): round(float(row["valor_total"]), 2) for _, row in by_year.iterrows()
        },
        "campos_ausentes_ou_vazios": {
            "valor_liquido": int(df["valor_liquido"].isna().sum() + (df["valor_liquido"].astype(str).str.strip() == "").sum()),
            "valor_liquido_zero": int((df["valor_liquido_num"] == 0).sum()),
            "fornecedor": int(df["fornecedor"].isna().sum() + (df["fornecedor"].astype(str).str.strip() == "").sum()),
            "descricao_despesa": int(
                df["descricao_despesa"].isna().sum()
                + (df["descricao_despesa"].astype(str).str.strip() == "").sum()
            ),
        },
        "id_gasto": {
            "existe_na_base_local": "id_gasto" in df.columns,
            "estabilidade": "ausente em dados_padronizados/gastos.csv; artefatos analiticos usam id interno derivado da ordem da linha.",
        },
        "mapeamento_api": {
            "id_deputado": "derivado de ideCadastro nos arquivos Ano-*.csv e compativel com /deputados/{id}.",
        },
        "regras_etl_identificadas": [
            "Fonte local padronizada vem de tabelas/**/Ano-*.csv via configuracao TABLES['gastos'].",
            "A carga de gastos restringe codLegislatura=57 quando o campo existe no arquivo bruto.",
            "Registros de lideranca sao removidos quando txNomeParlamentar inicia com LID. ou LIDERANCA.",
            "Linhas sem ano_dados, id_deputado, nome_parlamentar, sigla_uf, sigla_partido ou valor_liquido sao removidas.",
            "A base padronizada nao preserva mes, data_documento, numero_documento, CNPJ/CPF do fornecedor, tipo_documento, cod_documento ou url_documento.",
        ],
    }


def select_default_scope(local_df: pd.DataFrame, raw_dir: Path = DEFAULT_RAW_DIR) -> AuditScope:
    latest_year = int(max(local_df["ano_dados"].dropna().astype(int)))
    local_latest = local_df[local_df["ano_dados"].astype(str) == str(latest_year)].copy()
    grouped = (
        local_latest.groupby("id_deputado", dropna=False)
        .agg(qtd=("valor_liquido_num", "size"), valor=("valor_liquido_num", "sum"))
        .reset_index()
        .sort_values(["qtd", "valor"], ascending=[False, False])
    )
    deputado_id = str(grouped.iloc[0]["id_deputado"])

    raw = read_raw_gastos_for_scope(AuditScope(deputado_id=deputado_id, ano=latest_year), raw_dir)
    mes = None
    if not raw.empty and "mes" in raw.columns:
        month_counts = raw["mes"].dropna().astype(int).value_counts().sort_values(ascending=False)
        if not month_counts.empty:
            mes = int(month_counts.index[0])
    return AuditScope(deputado_id=deputado_id, ano=latest_year, mes=mes)


def read_raw_gastos_for_scope(scope: AuditScope, raw_dir: Path = DEFAULT_RAW_DIR) -> pd.DataFrame:
    raw_path = raw_dir / str(scope.ano) / f"Ano-{scope.ano}.csv"
    if not raw_path.exists():
        return pd.DataFrame(columns=COMPARISON_COLUMNS)

    df = pd.read_csv(raw_path, sep=";", dtype=str, low_memory=False)
    if "ideCadastro" not in df.columns:
        return pd.DataFrame(columns=COMPARISON_COLUMNS)

    filtered = df[df["ideCadastro"].astype(str).str.strip() == str(scope.deputado_id)].copy()
    if "codLegislatura" in filtered.columns:
        filtered = filtered[filtered["codLegislatura"].astype(str).str.strip() == "57"].copy()
    if "txNomeParlamentar" in filtered.columns:
        filtered = filtered[~filtered["txNomeParlamentar"].map(is_lideranca)].copy()
    if scope.mes is not None and "numMes" in filtered.columns:
        filtered = filtered[filtered["numMes"].map(parse_int) == scope.mes].copy()

    required = ["ideCadastro", "txNomeParlamentar", "sgUF", "sgPartido", "vlrLiquido"]
    present_required = [column for column in required if column in filtered.columns]
    for column in present_required:
        filtered = filtered[filtered[column].notna() & (filtered[column].astype(str).str.strip() != "")].copy()

    rows = []
    for _, row in filtered.iterrows():
        rows.append(
            normalize_comparison_row(
                fonte_dado="local",
                origem_local=str(raw_path.relative_to(REPO_ROOT)),
                origem_api="",
                data_coleta_api="",
                id_deputado=row.get("ideCadastro"),
                ano=row.get("numAno") or scope.ano,
                mes=row.get("numMes"),
                descricao=row.get("txtDescricao"),
                fornecedor=row.get("txtFornecedor"),
                cnpj_cpf=row.get("txtCNPJCPF"),
                valor_documento=row.get("vlrDocumento"),
                valor_glosa=row.get("vlrGlosa"),
                valor_liquido=row.get("vlrLiquido"),
                data_documento=row.get("datEmissao"),
                numero_documento=row.get("txtNumero"),
                tipo_documento=row.get("indTipoDocumento"),
                cod_documento=row.get("ideDocumento"),
                url_documento=row.get("urlDocumento"),
            )
        )
    return pd.DataFrame(rows, columns=COMPARISON_COLUMNS)


def fetch_api_despesas(scope: AuditScope, collected_at: str, page_size: int = 100) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    page = 1
    while True:
        query = {
            "ano": scope.ano,
            "itens": page_size,
            "pagina": page,
            "ordem": "ASC",
            "ordenarPor": "ano",
        }
        if scope.mes is not None:
            query["mes"] = scope.mes
        url = f"{API_BASE}/{scope.deputado_id}/despesas?{urllib.parse.urlencode(query)}"
        req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
        data = payload.get("dados") or []
        for item in data:
            rows.append(api_item_to_row(item, scope, collected_at, url))
        if len(data) < page_size:
            break
        page += 1
    return pd.DataFrame(rows, columns=COMPARISON_COLUMNS)


def api_item_to_row(item: dict[str, Any], scope: AuditScope, collected_at: str, url: str) -> dict[str, Any]:
    return normalize_comparison_row(
        fonte_dado="api",
        origem_local="",
        origem_api=url,
        data_coleta_api=collected_at,
        id_deputado=scope.deputado_id,
        ano=item.get("ano"),
        mes=item.get("mes"),
        descricao=item.get("tipoDespesa"),
        fornecedor=item.get("nomeFornecedor"),
        cnpj_cpf=item.get("cnpjCpfFornecedor"),
        valor_documento=item.get("valorDocumento"),
        valor_glosa=item.get("valorGlosa"),
        valor_liquido=item.get("valorLiquido"),
        data_documento=item.get("dataDocumento"),
        numero_documento=item.get("numDocumento"),
        tipo_documento=item.get("tipoDocumento"),
        cod_documento=item.get("codDocumento"),
        url_documento=item.get("urlDocumento"),
    )


def normalize_comparison_row(
    *,
    fonte_dado: str,
    origem_local: str,
    origem_api: str,
    data_coleta_api: str,
    id_deputado: Any,
    ano: Any,
    mes: Any,
    descricao: Any,
    fornecedor: Any,
    cnpj_cpf: Any,
    valor_documento: Any,
    valor_glosa: Any,
    valor_liquido: Any,
    data_documento: Any,
    numero_documento: Any,
    tipo_documento: Any,
    cod_documento: Any,
    url_documento: Any,
) -> dict[str, Any]:
    valor_liquido_float = parse_money(valor_liquido)
    descricao_text = clean_text(descricao)
    fornecedor_text = clean_text(fornecedor)
    cnpj_cpf_digits = clean_digits(cnpj_cpf)
    fornecedor_normalizado = normalize_supplier_document(cnpj_cpf_digits) or normalize_supplier(fornecedor_text)
    return {
        "fonte_dado": fonte_dado,
        "origem_local": origem_local,
        "origem_api": origem_api,
        "data_coleta_api": data_coleta_api,
        "id_deputado": clean_digits(id_deputado),
        "ano": parse_int(ano),
        "mes": parse_int(mes),
        "descricao_despesa": descricao_text,
        "descricao_normalizada": normalize_text(descricao_text),
        "fornecedor": fornecedor_text,
        "fornecedor_normalizado": fornecedor_normalizado,
        "cnpj_cpf_fornecedor": cnpj_cpf_digits,
        "valor_documento": round(parse_money(valor_documento), 2),
        "valor_glosa": round(parse_money(valor_glosa), 2),
        "valor_liquido": round(valor_liquido_float, 2),
        "valor_liquido_centavos": int(round(valor_liquido_float * 100)),
        "data_documento": normalize_date(data_documento),
        "numero_documento": normalize_doc_number(numero_documento),
        "tipo_documento": clean_text(tipo_documento),
        "cod_documento": clean_digits(cod_documento),
        "url_documento": clean_text(url_documento),
    }


def compare_frames(local_df: pd.DataFrame, api_df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, dict[str, Any]]:
    local = add_reconciliation_key(local_df)
    api = add_reconciliation_key(api_df)

    local_keys = Counter(local["chave_reconciliacao"])
    api_keys = Counter(api["chave_reconciliacao"])
    all_keys = sorted(set(local_keys) | set(api_keys))

    summary_rows = []
    for key in all_keys:
        local_count = local_keys.get(key, 0)
        api_count = api_keys.get(key, 0)
        matched = min(local_count, api_count)
        status = "local_e_api" if local_count and api_count else ("somente_local" if local_count else "somente_api")
        summary_rows.append(
            {
                "chave_reconciliacao": key,
                "status": status,
                "qtd_local": local_count,
                "qtd_api": api_count,
                "qtd_match": matched,
                "qtd_somente_local": max(local_count - api_count, 0),
                "qtd_somente_api": max(api_count - local_count, 0),
            }
        )

    only_local = unmatched_rows(local, local_keys, api_keys, source="local")
    only_api = unmatched_rows(api, api_keys, local_keys, source="api")
    comparison = pd.DataFrame(summary_rows)
    local_total = float(local["valor_liquido"].sum()) if not local.empty else 0.0
    api_total = float(api["valor_liquido"].sum()) if not api.empty else 0.0
    diff = local_total - api_total
    summary = {
        "registros_presentes_local_e_api": int(sum(row["qtd_match"] for row in summary_rows)),
        "registros_somente_local": int(len(only_local)),
        "registros_somente_api": int(len(only_api)),
        "valor_total_local": round(local_total, 2),
        "valor_total_api": round(api_total, 2),
        "diferenca_absoluta": round(diff, 2),
        "diferenca_percentual": round((abs(diff) / api_total * 100), 4) if api_total else None,
        "chave_reconciliacao": KEY_COLUMNS,
        "risco_chave": "A base padronizada nao guarda mes, data, numero ou documento; a reconciliacao usa o arquivo bruto local filtrado pelas regras do ETL.",
    }
    return comparison, only_local, only_api, summary


def add_reconciliation_key(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    if out.empty:
        out["chave_reconciliacao"] = []
        return out
    for column in KEY_COLUMNS:
        if column not in out.columns:
            out[column] = ""
    out["chave_reconciliacao"] = out[KEY_COLUMNS].fillna("").astype(str).agg("|".join, axis=1)
    return out


def unmatched_rows(source_df: pd.DataFrame, source_counts: Counter, other_counts: Counter, source: str) -> pd.DataFrame:
    if source_df.empty:
        return pd.DataFrame(columns=[*COMPARISON_COLUMNS, "chave_reconciliacao"])
    rows = []
    seen: Counter[str] = Counter()
    for _, row in source_df.iterrows():
        key = row["chave_reconciliacao"]
        seen[key] += 1
        if seen[key] > other_counts.get(key, 0):
            item = row.to_dict()
            item["divergencia"] = f"somente_{source}"
            rows.append(item)
    return pd.DataFrame(rows)


def api_diagnosis(api_df: pd.DataFrame) -> dict[str, Any]:
    return {
        "total_linhas_api": int(len(api_df)),
        "valor_total_api": round(float(api_df["valor_liquido"].sum()), 2) if not api_df.empty else 0.0,
        "anos_api": sorted(str(value) for value in api_df["ano"].dropna().astype(str).unique()) if not api_df.empty else [],
        "categorias_api": sorted(api_df["descricao_despesa"].dropna().astype(str).unique().tolist()) if not api_df.empty else [],
        "fornecedores_api": int(api_df["fornecedor_normalizado"].nunique()) if not api_df.empty else 0,
    }


def recommend_strategy(comparison: dict[str, Any], api_df: pd.DataFrame) -> dict[str, Any]:
    only_api = comparison["registros_somente_api"]
    only_local = comparison["registros_somente_local"]
    diff_pct = comparison["diferenca_percentual"]
    api_has_enrichment_fields = False
    if not api_df.empty:
        enrichment_fields = ["url_documento", "data_documento", "cnpj_cpf_fornecedor", "tipo_documento", "cod_documento"]
        api_has_enrichment_fields = any(api_df[column].astype(str).str.strip().ne("").any() for column in enrichment_fields)

    if only_api > 0 and (diff_pct is None or diff_pct >= 1):
        option = "C"
        reason = "Ha registros somente na API no recorte auditado; antes de incorporar, ampliar a amostra e aplicar deduplicacao rigorosa."
    elif api_has_enrichment_fields:
        option = "B"
        reason = "Os registros principais tendem a ser reconciliaveis e a API fornece campos ausentes na base padronizada."
    else:
        option = "A"
        reason = "A API deve permanecer como auditoria enquanto as diferencas forem pequenas ou inconclusivas."

    return {
        "opcao_recomendada": option,
        "descricao": {
            "A": "API apenas como auditoria",
            "B": "Enriquecer apenas campos faltantes",
            "C": "Incorporar registros ausentes depois de ampliacao da auditoria",
        }[option],
        "justificativa": reason,
        "observacao": "Esta rotina nao altera a fonte local nem os artefatos do dashboard automaticamente.",
        "sinais": {
            "registros_somente_api": only_api,
            "registros_somente_local": only_local,
            "diferenca_percentual": diff_pct,
            "api_tem_campos_de_enriquecimento": api_has_enrichment_fields,
        },
    }


def write_outputs(
    output_dir: Path,
    local_diagnosis: dict[str, Any],
    api_diag: dict[str, Any],
    comparison_df: pd.DataFrame,
    only_local: pd.DataFrame,
    only_api: pd.DataFrame,
    comparison_summary: dict[str, Any],
    recommendation: dict[str, Any],
    scope: AuditScope,
    collected_at: str,
) -> dict[str, str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    paths = {
        "comparacao": output_dir / "auditoria_gastos_local_vs_api.csv",
        "resumo": output_dir / "auditoria_gastos_resumo.json",
        "somente_api": output_dir / "gastos_somente_api.csv",
        "somente_local": output_dir / "gastos_somente_local.csv",
    }
    comparison_df.to_csv(paths["comparacao"], sep=";", index=False, quoting=csv.QUOTE_MINIMAL)
    only_api.to_csv(paths["somente_api"], sep=";", index=False, quoting=csv.QUOTE_MINIMAL)
    only_local.to_csv(paths["somente_local"], sep=";", index=False, quoting=csv.QUOTE_MINIMAL)
    payload = {
        "generated_at": collected_at,
        "escopo": {"id_deputado": scope.deputado_id, "ano": scope.ano, "mes": scope.mes},
        "diagnostico_local": local_diagnosis,
        "diagnostico_api": api_diag,
        "comparacao": comparison_summary,
        "estrategia_recomendada": recommendation,
        "fontes": {
            "base_local": str(DEFAULT_LOCAL_PATH.relative_to(REPO_ROOT)),
            "api": f"{API_BASE}/{{id_deputado}}/despesas",
            "documentacao": "https://dadosabertos.camara.leg.br/swagger/api.html",
        },
    }
    paths["resumo"].write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return {key: str(path.relative_to(REPO_ROOT)) for key, path in paths.items()}


def parse_money(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)) and not (isinstance(value, float) and math.isnan(value)):
        return float(value)
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return 0.0
    text = text.replace("R$", "").replace(" ", "")
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return 0.0


def parse_int(value: Any) -> int | None:
    digits = clean_digits(value)
    return int(digits) if digits else None


def clean_digits(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    return re.sub(r"\D", "", str(value))


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    return str(value).strip()


def normalize_text(value: Any) -> str:
    text = clean_text(value)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^A-Za-z0-9]+", " ", text.upper()).strip()
    return re.sub(r"\s+", " ", text)


def normalize_date(value: Any) -> str:
    text = clean_text(value)
    match = re.search(r"\d{4}-\d{2}-\d{2}", text)
    return match.group(0) if match else ""


def normalize_doc_number(value: Any) -> str:
    text = clean_text(value).upper()
    text = re.sub(r"\s+", "", text)
    return text


def normalize_supplier_document(value: str) -> str:
    if len(value) == 14:
        return f"CNPJ_{value}"
    if len(value) == 11:
        return f"CPF_{value}"
    return ""


def is_lideranca(value: Any) -> bool:
    text = normalize_text(value)
    return text.startswith("LID ") or text.startswith("LIDERANCA")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Audita gastos locais contra a API da Camara.")
    parser.add_argument("--deputado-id", help="ID oficial do deputado na API da Camara.")
    parser.add_argument("--ano", type=int, help="Ano do recorte.")
    parser.add_argument("--mes", type=int, help="Mes do recorte. Opcional.")
    parser.add_argument("--local-path", type=Path, default=DEFAULT_LOCAL_PATH)
    parser.add_argument("--raw-dir", type=Path, default=DEFAULT_RAW_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    collected_at = datetime.now(timezone.utc).isoformat()

    local_df = read_local_gastos(args.local_path)
    local_diagnosis = diagnose_local_base(local_df)
    if args.deputado_id and args.ano:
        scope = AuditScope(deputado_id=str(args.deputado_id), ano=args.ano, mes=args.mes)
    else:
        scope = select_default_scope(local_df, args.raw_dir)

    local_scope_df = read_raw_gastos_for_scope(scope, args.raw_dir)
    api_scope_df = fetch_api_despesas(scope, collected_at)
    comparison_df, only_local, only_api, comparison_summary = compare_frames(local_scope_df, api_scope_df)
    api_diag = api_diagnosis(api_scope_df)
    recommendation = recommend_strategy(comparison_summary, api_scope_df)
    paths = write_outputs(
        args.output_dir,
        local_diagnosis,
        api_diag,
        comparison_df,
        only_local,
        only_api,
        comparison_summary,
        recommendation,
        scope,
        collected_at,
    )
    print(
        json.dumps(
            {
                "escopo": {"id_deputado": scope.deputado_id, "ano": scope.ano, "mes": scope.mes},
                "comparacao": comparison_summary,
                "estrategia_recomendada": recommendation["opcao_recomendada"],
                "arquivos": paths,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
