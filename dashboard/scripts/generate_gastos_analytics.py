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
DEFAULT_OUTPUT_DIR = REPO_ROOT / "artifacts" / "gastos"

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


@dataclass(frozen=True)
class ExplanationRule:
    tipo: str
    peso: float
    descricao_base: str
    regra: str
    formula: str
    limiar: str


EXPLANATION_RULES = {
    "valor_extremo_categoria": ExplanationRule(
        tipo="valor_extremo_categoria",
        peso=0.85,
        descricao_base="Valor significativamente acima da mediana da categoria.",
        regra="Compara o valor liquido com a mediana da mesma categoria de despesa.",
        formula="valor_liquido / mediana_categoria",
        limiar=">= 3 vezes a mediana da categoria",
    ),
    "valor_acima_percentil_95": ExplanationRule(
        tipo="valor_acima_percentil_95",
        peso=0.75,
        descricao_base="Valor acima do percentil 95 da categoria.",
        regra="Compara o valor liquido com o percentil 95 da mesma categoria.",
        formula="valor_liquido > p95_categoria",
        limiar="valor maior que p95_categoria",
    ),
    "valor_acima_percentil_99": ExplanationRule(
        tipo="valor_acima_percentil_99",
        peso=0.9,
        descricao_base="Valor acima do percentil 99 da categoria.",
        regra="Compara o valor liquido com o percentil 99 da mesma categoria.",
        formula="valor_liquido > p99_categoria",
        limiar="valor maior que p99_categoria",
    ),
    "fornecedor_pouco_frequente": ExplanationRule(
        tipo="fornecedor_pouco_frequente",
        peso=0.6,
        descricao_base="Fornecedor com baixa frequencia de registros na base.",
        regra="Conta quantas despesas aparecem para o fornecedor normalizado.",
        formula="qtd_despesas_fornecedor",
        limiar="<= 3 despesas",
    ),
    "fornecedor_baixa_dispersao": ExplanationRule(
        tipo="fornecedor_baixa_dispersao",
        peso=0.65,
        descricao_base="Fornecedor utilizado por poucos deputados distintos.",
        regra="Conta quantos deputados distintos usaram o fornecedor normalizado.",
        formula="qtd_deputados_fornecedor",
        limiar="<= 2 deputados",
    ),
    "ticket_acima_padrao_deputado": ExplanationRule(
        tipo="ticket_acima_padrao_deputado",
        peso=0.7,
        descricao_base="Valor acima do padrao historico do proprio deputado.",
        regra="Compara o valor liquido com a mediana de despesas do deputado.",
        formula="valor_liquido / mediana_deputado",
        limiar=">= 3 vezes a mediana do deputado",
    ),
}


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


def build_anomaly_features(df: pd.DataFrame) -> pd.DataFrame:
    features = pd.DataFrame(index=df.index)
    features["valor_liquido_log"] = np.log1p(df["valor_liquido"].clip(lower=0))
    features["valor_documento_log"] = np.log1p(df["valor_documento"].clip(lower=0))
    features["valor_glosa_log"] = np.log1p(df["valor_glosa"].clip(lower=0))

    category_median = df.groupby("descricao_despesa")["valor_liquido"].transform("median").replace(0, np.nan)
    deputy_median = df.groupby("id_deputado")["valor_liquido"].transform("median").replace(0, np.nan)
    supplier_median = df.groupby("fornecedor_normalizado")["valor_liquido"].transform("median").replace(0, np.nan)

    features["rel_categoria"] = (df["valor_liquido"] / category_median).replace([np.inf, -np.inf], np.nan).fillna(0)
    features["rel_deputado"] = (df["valor_liquido"] / deputy_median).replace([np.inf, -np.inf], np.nan).fillna(0)
    features["rel_fornecedor"] = (df["valor_liquido"] / supplier_median).replace([np.inf, -np.inf], np.nan).fillna(0)
    features["categoria_code"] = encode_category(df["descricao_despesa"])
    features["partido_code"] = encode_category(df["sigla_partido"])
    features["uf_code"] = encode_category(df["sigla_uf"])
    return features.replace([np.inf, -np.inf], np.nan).fillna(0)


def robust_anomaly_fallback(features: pd.DataFrame, contamination: float) -> tuple[np.ndarray, np.ndarray, str]:
    median = features.median(axis=0)
    mad = (features - median).abs().median(axis=0).replace(0, 1)
    robust_z = ((features - median).abs() / mad).mean(axis=1).to_numpy()
    threshold = np.quantile(robust_z, 1 - contamination)
    labels = np.where(robust_z >= threshold, -1, 1)
    return labels, robust_z, "robust_score_fallback"


def detect_anomalies(
    df: pd.DataFrame,
    contamination: float,
    random_state: int,
) -> tuple[pd.DataFrame, str]:
    features = build_anomaly_features(df)
    try:
        from sklearn.ensemble import IsolationForest

        model = IsolationForest(
            n_estimators=100,
            contamination=contamination,
            max_samples=min(10000, len(features)),
            n_jobs=-1,
            random_state=random_state,
        )
        labels = model.fit_predict(features)
        scores = -model.decision_function(features)
        method = "isolation_forest"
    except Exception:
        labels, scores, method = robust_anomaly_fallback(features, contamination)

    out = df.copy()
    out["gasto_atipico"] = labels == -1
    out["score_atipicidade"] = np.round(scores.astype(float), 6)
    out["nota_linguagem"] = (
        "Despesa fora do padrao estatistico; nao representa conclusao juridica ou etica."
    )
    cols = [
        "id_gasto",
        "ano_dados",
        "id_deputado",
        "nome_parlamentar",
        "sigla_partido",
        "sigla_uf",
        "descricao_despesa",
        "fornecedor",
        "fornecedor_normalizado",
        "valor_documento",
        "valor_glosa",
        "valor_liquido",
        "gasto_atipico",
        "score_atipicidade",
        "nota_linguagem",
    ]
    return out[cols].sort_values("score_atipicidade", ascending=False), method


def _safe_ratio(numerator: float, denominator: float) -> float:
    if denominator <= 0 or np.isnan(denominator):
        return 0.0
    return float(numerator) / float(denominator)


def _reason(tipo: str, descricao: str, detalhes: dict[str, object]) -> dict[str, object]:
    rule = EXPLANATION_RULES[tipo]
    return {
        "tipo": rule.tipo,
        "peso": rule.peso,
        "descricao": descricao,
        "regra": rule.regra,
        "formula": rule.formula,
        "limiar": rule.limiar,
        "detalhes": detalhes,
    }


def build_anomaly_explanations(df: pd.DataFrame, anomalies: pd.DataFrame) -> pd.DataFrame:
    """Gera motivos defensaveis para despesas classificadas como atipicas.

    A deteccao continua sendo feita pelo Isolation Forest. Esta funcao apenas
    compara cada despesa atipica com estatisticas descritivas da propria base.
    """
    category_stats = df.groupby("descricao_despesa")["valor_liquido"].agg(
        mediana_categoria="median",
        media_categoria="mean",
        p95_categoria=lambda s: s.quantile(0.95),
        p99_categoria=lambda s: s.quantile(0.99),
        qtd_despesas_categoria="size",
    )
    deputy_median = df.groupby("id_deputado")["valor_liquido"].median().rename("mediana_deputado")
    supplier_stats = df.groupby("fornecedor_normalizado").agg(
        qtd_despesas_fornecedor=("valor_liquido", "size"),
        qtd_deputados_fornecedor=("id_deputado", "nunique"),
    )

    atipicas = anomalies[anomalies["gasto_atipico"]].copy()
    atipicas = atipicas.merge(category_stats, left_on="descricao_despesa", right_index=True, how="left")
    atipicas = atipicas.merge(deputy_median, left_on="id_deputado", right_index=True, how="left")
    atipicas = atipicas.merge(supplier_stats, left_on="fornecedor_normalizado", right_index=True, how="left")

    rows: list[dict[str, object]] = []
    for row in atipicas.to_dict("records"):
        valor = float(row.get("valor_liquido") or 0)
        mediana_categoria = float(row.get("mediana_categoria") or 0)
        p95_categoria = float(row.get("p95_categoria") or 0)
        p99_categoria = float(row.get("p99_categoria") or 0)
        mediana_deputado = float(row.get("mediana_deputado") or 0)
        qtd_fornecedor = int(row.get("qtd_despesas_fornecedor") or 0)
        qtd_deputados_fornecedor = int(row.get("qtd_deputados_fornecedor") or 0)

        motivos: list[dict[str, object]] = []
        ratio_categoria = _safe_ratio(valor, mediana_categoria)
        ratio_deputado = _safe_ratio(valor, mediana_deputado)

        if ratio_categoria >= 3:
            motivos.append(
                _reason(
                    "valor_extremo_categoria",
                    f"Valor {ratio_categoria:.1f} vezes acima da mediana da categoria.",
                    {
                        "valor_liquido": round(valor, 2),
                        "mediana_categoria": round(mediana_categoria, 2),
                        "razao": round(ratio_categoria, 4),
                    },
                )
            )
        if p95_categoria > 0 and valor > p95_categoria:
            motivos.append(
                _reason(
                    "valor_acima_percentil_95",
                    "Valor acima do percentil 95 da categoria.",
                    {
                        "valor_liquido": round(valor, 2),
                        "p95_categoria": round(p95_categoria, 2),
                    },
                )
            )
        if p99_categoria > 0 and valor > p99_categoria:
            motivos.append(
                _reason(
                    "valor_acima_percentil_99",
                    "Valor acima do percentil 99 da categoria.",
                    {
                        "valor_liquido": round(valor, 2),
                        "p99_categoria": round(p99_categoria, 2),
                    },
                )
            )
        if qtd_fornecedor <= 3:
            motivos.append(
                _reason(
                    "fornecedor_pouco_frequente",
                    f"Fornecedor aparece em {qtd_fornecedor} despesa(s) na base analisada.",
                    {"qtd_despesas_fornecedor": qtd_fornecedor},
                )
            )
        if qtd_deputados_fornecedor <= 2:
            motivos.append(
                _reason(
                    "fornecedor_baixa_dispersao",
                    f"Fornecedor utilizado por {qtd_deputados_fornecedor} deputado(s) distinto(s).",
                    {"qtd_deputados_fornecedor": qtd_deputados_fornecedor},
                )
            )
        if ratio_deputado >= 3:
            motivos.append(
                _reason(
                    "ticket_acima_padrao_deputado",
                    f"Valor {ratio_deputado:.1f} vezes acima da mediana de despesas do deputado.",
                    {
                        "valor_liquido": round(valor, 2),
                        "mediana_deputado": round(mediana_deputado, 2),
                        "razao": round(ratio_deputado, 4),
                    },
                )
            )

        motivos.sort(key=lambda item: float(item["peso"]), reverse=True)
        motivo_principal = str(motivos[0]["tipo"]) if motivos else ""
        maior_peso = round(float(motivos[0]["peso"]), 4) if motivos else 0.0
        rows.append(
            {
                "id_gasto": int(row["id_gasto"]),
                "motivo_principal": motivo_principal,
                "motivos_json": json.dumps(motivos, ensure_ascii=False, separators=(",", ":")),
                "qtd_motivos": len(motivos),
                "maior_peso_motivo": maior_peso,
            }
        )

    return pd.DataFrame(
        rows,
        columns=["id_gasto", "motivo_principal", "motivos_json", "qtd_motivos", "maior_peso_motivo"],
    )


def build_anomaly_deputy_ranking(anomalies: pd.DataFrame) -> pd.DataFrame:
    base = (
        anomalies.groupby(["id_deputado", "nome_parlamentar", "sigla_partido", "sigla_uf"], dropna=False)
        .agg(
            total_despesas=("valor_liquido", "size"),
            qtd_despesas_atipicas=("gasto_atipico", "sum"),
            valor_atipico=("valor_liquido", lambda s: s[anomalies.loc[s.index, "gasto_atipico"]].sum()),
            score_atipicidade_medio=("score_atipicidade", "mean"),
            score_atipicidade_max=("score_atipicidade", "max"),
        )
        .reset_index()
    )
    base["valor_atipico"] = base["valor_atipico"].round(2)
    base["score_atipicidade_medio"] = base["score_atipicidade_medio"].round(6)
    base["score_atipicidade_max"] = base["score_atipicidade_max"].round(6)
    base["pct_despesas_atipicas"] = np.where(
        base["total_despesas"] > 0,
        (base["qtd_despesas_atipicas"] / base["total_despesas"] * 100).round(4),
        0,
    )
    return base.sort_values(
        ["qtd_despesas_atipicas", "score_atipicidade_medio", "valor_atipico"],
        ascending=[False, False, False],
    )


def write_csv(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, sep=";", index=False, encoding="utf-8")


def generate(input_path: Path, output_dir: Path, contamination: float, random_state: int) -> dict[str, object]:
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

    anomalies, anomaly_method = detect_anomalies(df, contamination, random_state)
    outputs["gastos_atipicos_detalhado.csv"] = anomalies.drop(columns=["id_gasto"])
    outputs["gastos_atipicos_ranking_deputados.csv"] = build_anomaly_deputy_ranking(anomalies)
    outputs["gastos_atipicos_explicacoes.csv"] = build_anomaly_explanations(df, anomalies)

    for filename, frame in outputs.items():
        write_csv(frame, output_dir / filename)

    metadata = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input": str(input_path),
        "rows": int(len(df)),
        "fornecedores_normalizados": int(df["fornecedor_normalizado"].nunique()),
        "metrics": list(summarize_metrics(df).keys()),
        "anomaly_method": anomaly_method,
        "contamination": contamination,
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
    parser.add_argument("--contamination", type=float, default=0.01)
    parser.add_argument("--random-state", type=int, default=42)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    metadata = generate(args.input, args.output_dir, args.contamination, args.random_state)
    print(
        "Artefatos de gastos gerados em "
        f"{args.output_dir} ({metadata['rows']} despesas; método: {metadata['anomaly_method']})."
    )


if __name__ == "__main__":
    main()
