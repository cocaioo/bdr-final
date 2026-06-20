from __future__ import annotations

import argparse
import json
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = REPO_ROOT / "dados_padronizados" / "gastos.csv"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "Caio" / "gastos-fornecedores" / "analytics"

LEGAL_SUFFIX_PATTERN = re.compile(
    r"\b("
    r"LTDA|LTD|LIMITADA|ME|EPP|EIRELI|EI|SA|S A|S/A|SS|S S|"
    r"COMERCIO|COMERCIAL|SERVICOS|SERVICO|SERV|INDUSTRIA|"
    r"IMPORTACAO|EXPORTACAO|DISTRIBUIDORA|DISTRIBUICAO|"
    r"ADMINISTRACAO|PARTICIPACOES|HOLDING|GRUPO"
    r")\b",
)

UF_REGIONS = {
    "AC": "Norte",
    "AP": "Norte",
    "AM": "Norte",
    "PA": "Norte",
    "RO": "Norte",
    "RR": "Norte",
    "TO": "Norte",
    "AL": "Nordeste",
    "BA": "Nordeste",
    "CE": "Nordeste",
    "MA": "Nordeste",
    "PB": "Nordeste",
    "PE": "Nordeste",
    "PI": "Nordeste",
    "RN": "Nordeste",
    "SE": "Nordeste",
    "DF": "Centro-Oeste",
    "GO": "Centro-Oeste",
    "MT": "Centro-Oeste",
    "MS": "Centro-Oeste",
    "ES": "Sudeste",
    "MG": "Sudeste",
    "RJ": "Sudeste",
    "SP": "Sudeste",
    "PR": "Sul",
    "RS": "Sul",
    "SC": "Sul",
}


@dataclass(frozen=True)
class MetricConfig:
    value: str = "valor_liquido"
    deputy: str = "id_deputado"
    supplier: str = "fornecedor_normalizado"




def remove_accents(value: object) -> str:
    text = "" if value is None else str(value)
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def normalize_supplier(value: object) -> str:
    """Normaliza o fornecedor para reduzir duplicidades por grafia.

    Se houver CNPJ no texto, ele vira o identificador preferencial. A base atual
    nao possui coluna dedicada de CNPJ, entao essa extracao cobre apenas casos em
    que o documento aparece dentro do proprio campo de fornecedor.
    """
    text = remove_accents(value).upper()
    cnpj_match = re.search(r"\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}", text)
    if cnpj_match:
        digits = re.sub(r"\D", "", cnpj_match.group(0))
        return f"CNPJ_{digits}"

    text = re.sub(r"[^A-Z0-9\s]", " ", text)
    text = LEGAL_SUFFIX_PATTERN.sub(" ", text)
    text = re.sub(r"\b(D[AEIOU]S?|E|&)\b", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or "SEM_FORNECEDOR"


def join_top_values(values: Iterable[object], limit: int = 5) -> str:
    cleaned = [str(value).strip() for value in values if str(value).strip()]
    return " | ".join(cleaned[:limit])


def summarize_metrics(df: pd.DataFrame, cfg: MetricConfig = MetricConfig()) -> dict[str, float | int]:
    return {
        "valor_total": round(float(df[cfg.value].sum()), 2),
        "qtd_despesas": int(len(df)),
        "ticket_medio": round(float(df[cfg.value].mean()), 2) if len(df) else 0.0,
        "qtd_deputados": int(df[cfg.deputy].nunique()),
        "qtd_fornecedores": int(df[cfg.supplier].nunique()),
    }


def add_percent_of_total(frame: pd.DataFrame, total: float) -> pd.DataFrame:
    frame = frame.copy()
    frame["pct_total"] = np.where(total > 0, (frame["valor_total"] / total * 100).round(4), 0)
    return frame


def aggregate_base(df: pd.DataFrame, group_cols: list[str]) -> pd.DataFrame:
    grouped = (
        df.groupby(group_cols, dropna=False)
        .agg(
            valor_total=("valor_liquido", "sum"),
            qtd_despesas=("valor_liquido", "size"),
            ticket_medio=("valor_liquido", "mean"),
            qtd_deputados=("id_deputado", "nunique"),
            qtd_fornecedores=("fornecedor_normalizado", "nunique"),
        )
        .reset_index()
    )
    grouped["valor_total"] = grouped["valor_total"].round(2)
    grouped["ticket_medio"] = grouped["ticket_medio"].round(2)
    return grouped.sort_values(["valor_total", "qtd_despesas"], ascending=[False, False])


def category_top_by(df: pd.DataFrame, group_col: str) -> pd.DataFrame:
    ranked = (
        df.groupby([group_col, "descricao_despesa"], dropna=False)["valor_liquido"]
        .sum()
        .reset_index(name="valor_categoria")
        .sort_values([group_col, "valor_categoria"], ascending=[True, False])
    )
    return ranked.drop_duplicates(group_col).rename(columns={"descricao_despesa": "categoria_principal"})


def read_gastos(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, sep=";", dtype={"cpf": "string"}, low_memory=False)
    required = {
        "ano_dados",
        "id_deputado",
        "nome_parlamentar",
        "sigla_uf",
        "sigla_partido",
        "valor_documento",
        "valor_glosa",
        "valor_liquido",
        "descricao_despesa",
        "fornecedor",
    }
    missing = sorted(required - set(df.columns))
    if missing:
        raise ValueError(f"Colunas ausentes em {path}: {', '.join(missing)}")

    if "id_gasto" not in df.columns:
        df.insert(0, "id_gasto", np.arange(1, len(df) + 1, dtype=np.int64))

    for col in ["valor_documento", "valor_glosa", "valor_liquido"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df["ano_dados"] = pd.to_numeric(df["ano_dados"], errors="coerce").astype("Int64")
    df["id_deputado"] = pd.to_numeric(df["id_deputado"], errors="coerce").astype("Int64")
    df["descricao_despesa"] = df["descricao_despesa"].fillna("NAO INFORMADO").astype(str).str.strip()
    df["fornecedor"] = df["fornecedor"].fillna("SEM FORNECEDOR").astype(str).str.strip()
    df["fornecedor_normalizado"] = df["fornecedor"].map(normalize_supplier)
    df["sigla_uf"] = df["sigla_uf"].fillna("NI").astype(str).str.upper().str.strip()
    df["sigla_partido"] = df["sigla_partido"].fillna("NI").astype(str).str.upper().str.strip()
    df["regiao"] = df["sigla_uf"].map(UF_REGIONS).fillna("Nao informado")
    return df


def build_summary(df: pd.DataFrame) -> pd.DataFrame:
    rows = [{"escopo": "Todos", "ano_dados": "Todos", **summarize_metrics(df)}]
    for year, year_df in df.groupby("ano_dados", dropna=False):
        rows.append({"escopo": "Ano", "ano_dados": str(year), **summarize_metrics(year_df)})
    summary = pd.DataFrame(rows)

    top_category = (
        df.groupby("descricao_despesa")["valor_liquido"]
        .sum()
        .sort_values(ascending=False)
        .head(1)
    )
    summary["categoria_maior_valor"] = top_category.index[0] if not top_category.empty else ""
    return summary


def build_category(df: pd.DataFrame) -> pd.DataFrame:
    frame = aggregate_base(df, ["descricao_despesa"])
    frame = add_percent_of_total(frame, float(df["valor_liquido"].sum()))
    return frame.rename(columns={"descricao_despesa": "categoria"})


def build_deputy(df: pd.DataFrame) -> pd.DataFrame:
    all_years = aggregate_base(df, ["id_deputado", "nome_parlamentar", "sigla_partido", "sigla_uf"])
    all_years.insert(0, "ano_dados", "Todos")
    yearly = aggregate_base(df, ["ano_dados", "id_deputado", "nome_parlamentar", "sigla_partido", "sigla_uf"])
    yearly["ano_dados"] = yearly["ano_dados"].astype(str)
    frame = pd.concat([all_years, yearly], ignore_index=True)

    totals_by_scope = {
        "Todos": float(df["valor_liquido"].sum()),
        **{
            str(year): float(year_df["valor_liquido"].sum())
            for year, year_df in df.groupby("ano_dados", dropna=False)
        },
    }
    frame["pct_total"] = frame.apply(
        lambda row: round(
            float(row["valor_total"]) / totals_by_scope.get(str(row["ano_dados"]), 0) * 100,
            4,
        )
        if totals_by_scope.get(str(row["ano_dados"]), 0) > 0
        else 0,
        axis=1,
    )

    top_categories = category_top_by(df, "id_deputado")[["id_deputado", "categoria_principal"]]
    return frame.merge(top_categories, on="id_deputado", how="left")


def build_supplier(df: pd.DataFrame) -> pd.DataFrame:
    grouped = (
        df.groupby("fornecedor_normalizado", dropna=False)
        .agg(
            fornecedor_exemplo=("fornecedor", lambda s: s.value_counts().index[0] if len(s) else ""),
            variacoes_nome=("fornecedor", lambda s: join_top_values(s.value_counts().index)),
            valor_total=("valor_liquido", "sum"),
            qtd_despesas=("valor_liquido", "size"),
            ticket_medio=("valor_liquido", "mean"),
            qtd_deputados=("id_deputado", "nunique"),
            deputados=("id_deputado", lambda s: join_top_values(s.value_counts().index.astype(str), limit=100)),
            qtd_partidos=("sigla_partido", "nunique"),
            partidos=("sigla_partido", lambda s: join_top_values(s.value_counts().index, limit=30)),
            qtd_categorias=("descricao_despesa", "nunique"),
            categorias=("descricao_despesa", lambda s: join_top_values(s.value_counts().index)),
            qtd_ufs=("sigla_uf", "nunique"),
            ufs=("sigla_uf", lambda s: join_top_values(s.value_counts().index, limit=10)),
        )
        .reset_index()
    )
    grouped["valor_total"] = grouped["valor_total"].round(2)
    grouped["ticket_medio"] = grouped["ticket_medio"].round(2)
    grouped = add_percent_of_total(grouped, float(df["valor_liquido"].sum()))
    return grouped.sort_values(["valor_total", "qtd_deputados"], ascending=[False, False])


def build_party(df: pd.DataFrame) -> pd.DataFrame:
    frame = aggregate_base(df, ["sigla_partido"])
    frame["valor_medio_por_deputado"] = np.where(
        frame["qtd_deputados"] > 0,
        (frame["valor_total"] / frame["qtd_deputados"]).round(2),
        0,
    )
    frame = add_percent_of_total(frame, float(df["valor_liquido"].sum()))
    return frame


def build_uf(df: pd.DataFrame) -> pd.DataFrame:
    frame = aggregate_base(df, ["sigla_uf", "regiao"])
    frame["valor_medio_por_deputado"] = np.where(
        frame["qtd_deputados"] > 0,
        (frame["valor_total"] / frame["qtd_deputados"]).round(2),
        0,
    )
    frame = add_percent_of_total(frame, float(df["valor_liquido"].sum()))
    return frame


def build_monthly(df: pd.DataFrame) -> pd.DataFrame:
    if "mes" not in df.columns:
        return pd.DataFrame()
    return aggregate_base(df, ["ano_dados", "mes"])


def encode_category(series: pd.Series) -> pd.Series:
    return series.astype("category").cat.codes.astype(float)


def generate(input_path: Path, output_dir: Path) -> dict[str, object]:
    df = read_gastos(input_path)
    output_dir.mkdir(parents=True, exist_ok=True)

    outputs: dict[str, pd.DataFrame] = {
        "gastos_resumo.csv": build_summary(df),
        "gastos_por_categoria.csv": build_category(df),
        "gastos_por_deputado.csv": build_deputy(df),
        "gastos_por_fornecedor.csv": build_supplier(df),
        "gastos_por_partido.csv": build_party(df),
        "gastos_por_uf.csv": build_uf(df),
    }

    for filename, frame in outputs.items():
        write_csv(frame, output_dir / filename)

    metadata = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input": str(input_path),
        "rows": int(len(df)),
        "fornecedores_normalizados": int(df["fornecedor_normalizado"].nunique()),
        "metrics": list(summarize_metrics(df).keys()),
        "outputs": sorted(outputs),
        "api_contract": {
            "summary": summarize_metrics(df),
            "charts": [],
            "table": [],
            "metadata": {
                "filters_applied": {},
                "generated_at": "YYYY-MM-DD",
            },
        },
    }
    (output_dir / "gastos_metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return metadata


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Gera artefatos analiticos do bloco de gastos.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    metadata = generate(args.input, args.output_dir)
    print(
        "Artefatos de gastos gerados em "
        f"{args.output_dir} ({metadata['rows']} despesas)."
    )


if __name__ == "__main__":
    main()
