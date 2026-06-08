from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import unicodedata

import pandas as pd

try:
    from wordcloud import WordCloud
except ImportError as exc:  # pragma: no cover - exercised only without optional deps
    WordCloud = None
    WORDCLOUD_IMPORT_ERROR = exc
else:
    WORDCLOUD_IMPORT_ERROR = None


REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "dados_padronizados"
RESPONSES_DIR = REPO_ROOT / "respostas"
ARTIFACTS_DIR = REPO_ROOT / "artifacts" / "q2"
WORDCLOUD_DIR = REPO_ROOT / "dashboard" / "frontend" / "public" / "wordclouds"

YEARS = (2023, 2024, 2025, 2026)
WIDTH = 1280
HEIGHT = 720

EIXO_BY_COD_TEMA = {
    44: "Social",
    46: "Social",
    52: "Social",
    56: "Social",
    58: "Social",
    86: "Social",
    40: "Economico",
    64: "Economico",
    66: "Economico",
    70: "Economico",
    43: "Seguranca",
    57: "Seguranca",
    34: "Institucional e juridico",
    42: "Institucional e juridico",
    53: "Institucional e juridico",
    67: "Institucional e juridico",
    68: "Institucional e juridico",
    74: "Institucional e juridico",
    76: "Institucional e juridico",
    48: "Ambiental e energetico",
    51: "Ambiental e energetico",
    54: "Ambiental e energetico",
    37: "Infraestrutura e tecnologia",
    41: "Infraestrutura e tecnologia",
    61: "Infraestrutura e tecnologia",
    62: "Infraestrutura e tecnologia",
    85: "Infraestrutura e tecnologia",
    35: "Cultura e sociedade",
    39: "Cultura e sociedade",
    60: "Cultura e sociedade",
    72: "Cultura e sociedade",
    55: "Internacional",
}

EIXO_COLORS = {
    "Social": "#2A9D8F",
    "Economico": "#E07A5F",
    "Seguranca": "#C0392B",
    "Institucional e juridico": "#0B3C5D",
    "Ambiental e energetico": "#4F7CAC",
    "Infraestrutura e tecnologia": "#6A7FDB",
    "Cultura e sociedade": "#B7791F",
    "Internacional": "#5A6772",
}

TEMA_TO_EIXO = {}


def main() -> None:
    args = parse_args()
    selected_years = parse_selected_years(args)

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    WORDCLOUD_DIR.mkdir(parents=True, exist_ok=True)
    RESPONSES_DIR.mkdir(parents=True, exist_ok=True)

    proposicoes, autores, deputados, temas = load_dataframes()

    # Filtro da 57ª Legislatura: apenas temas de proposições com autoria de deputados da base
    valid_dep_ids = set(deputados["id_deputado"].dropna().astype(str).unique())
    valid_autores = autores[autores["id_deputado"].astype(str).isin(valid_dep_ids)]
    valid_uris = set(valid_autores["uri_proposicao"].dropna().unique())
    temas_filtered = temas[temas["uri_proposicao"].isin(valid_uris)].copy()

    counts = build_eixo_counts(proposicoes, temas_filtered, selected_years)
    consolidated = build_consolidated_counts(counts)

    write_count_artifacts(counts, consolidated)
    write_wordcloud_pngs(counts, consolidated, temas_filtered, selected_years)

    analytic_rows = build_analytic_rows(proposicoes, autores, deputados, temas_filtered, selected_years)
    write_q2_response_files(analytic_rows, counts, consolidated, selected_years)
    print_validation_summary(counts, consolidated, proposicoes, selected_years)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Gera artefatos da Q2 usando os eixos tematicos como termos da nuvem."
    )
    parser.add_argument(
        "--years",
        help="Anos separados por virgula. Ex.: --years 2023,2024",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Gera os artefatos para todos os anos suportados (2023-2026).",
    )
    return parser.parse_args()


def parse_selected_years(args: argparse.Namespace) -> tuple[int, ...]:
    if args.years:
        years = tuple(int(year.strip()) for year in args.years.split(",") if year.strip())
        invalid = sorted(set(years) - set(YEARS))
        if invalid:
            raise SystemExit(f"Anos invalidos para Q2: {', '.join(map(str, invalid))}")
        return years
    return YEARS


def load_dataframes() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    proposicoes = pd.read_csv(
        DATA_DIR / "proposicoes.csv",
        sep=";",
        dtype=str,
        encoding="utf-8",
        usecols=[
            "ano_dados",
            "id_proposicao",
            "uri_proposicao",
            "descricao_situacao",
        ],
    )
    autores = pd.read_csv(
        DATA_DIR / "proposicoes_autores.csv",
        sep=";",
        dtype=str,
        encoding="utf-8",
        usecols=["ano_dados", "id_proposicao", "uri_proposicao", "id_deputado", "nome_autor", "sigla_partido", "sigla_uf"],
    )
    deputados = pd.read_csv(
        DATA_DIR / "deputados.csv",
        sep=";",
        dtype=str,
        encoding="utf-8",
        usecols=["id_deputado", "nome", "nome_civil"],
    )
    temas = pd.read_csv(DATA_DIR / "proposicoes_temas.csv", sep=";", dtype=str, encoding="utf-8")

    proposicoes["ano_dados"] = proposicoes["ano_dados"].astype(int)
    autores["ano_dados"] = autores["ano_dados"].astype(int)
    temas["ano_dados"] = temas["ano_dados"].astype(int)
    temas["eixo_maior"] = map_eixos(temas)
    temas = temas[temas["eixo_maior"].notna()].copy()
    return proposicoes, autores, deputados, temas


def map_eixos(temas: pd.DataFrame) -> pd.Series:
    if "eixo" in temas.columns:
        eixo = temas["eixo"].astype(str).str.strip()
        return eixo.where(eixo.ne("") & eixo.ne("nan"))

    cod_tema = pd.to_numeric(temas["cod_tema"], errors="coerce").astype("Int64")
    return cod_tema.map(EIXO_BY_COD_TEMA)


def build_eixo_counts(
    proposicoes: pd.DataFrame, temas: pd.DataFrame, selected_years: tuple[int, ...]
) -> pd.DataFrame:
    scoped_themes = temas[temas["ano_dados"].isin(selected_years)][
        ["ano_dados", "uri_proposicao", "tema"]
    ].drop_duplicates()

    counts = (
        scoped_themes.groupby(["ano_dados", "tema"], as_index=False)
        .agg(count=("uri_proposicao", "nunique"))
        .rename(columns={"ano_dados": "year", "tema": "eixo"})
        .sort_values(["year", "count", "eixo"], ascending=[True, False, True])
    )
    return counts


def build_consolidated_counts(counts: pd.DataFrame) -> pd.DataFrame:
    return (
        counts.groupby("eixo", as_index=False)
        .agg(count=("count", "sum"))
        .sort_values(["count", "eixo"], ascending=[False, True])
    )


def write_count_artifacts(counts: pd.DataFrame, consolidated: pd.DataFrame) -> None:
    counts.to_csv(ARTIFACTS_DIR / "eixos_counts_by_year.csv", index=False, encoding="utf-8")
    consolidated.to_csv(ARTIFACTS_DIR / "eixos_consolidado.csv", index=False, encoding="utf-8")

    (ARTIFACTS_DIR / "eixos_counts_by_year.json").write_text(
        json.dumps(counts.to_dict(orient="records"), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (ARTIFACTS_DIR / "eixos_consolidado.json").write_text(
        json.dumps(consolidated.to_dict(orient="records"), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def write_wordcloud_pngs(
    counts: pd.DataFrame,
    consolidated: pd.DataFrame,
    temas: pd.DataFrame,
    selected_years: tuple[int, ...],
) -> None:
    if WordCloud is None:
        raise SystemExit(
            "Dependencia ausente: instale 'wordcloud' para gerar as imagens PNG. "
            f"Erro original: {WORDCLOUD_IMPORT_ERROR}"
        )

    global TEMA_TO_EIXO
    TEMA_TO_EIXO = dict(zip(temas["tema"], temas["eixo_maior"]))

    manifest = []
    for year in selected_years:
        year_temas = temas[temas["ano_dados"] == year]
        freqs = (
            year_temas.drop_duplicates(["uri_proposicao", "tema"])
            .groupby("tema")
            .size()
            .to_dict()
        )
        if not freqs:
            continue

        artifact_path = ARTIFACTS_DIR / f"nuvem_{year}.png"
        public_path = WORDCLOUD_DIR / f"q2_nuvem_palavras_{year}.png"
        render_wordcloud(freqs, f"Nuvem de eixos tematicos - {year}", artifact_path, seed=year)
        render_wordcloud(freqs, f"Nuvem de eixos tematicos - {year}", public_path, seed=year)
        manifest.append({"year": year, "src": f"/wordclouds/{public_path.name}"})

    consolidated_freqs = (
        temas[temas["ano_dados"].isin(selected_years)]
        .drop_duplicates(["uri_proposicao", "tema"])
        .groupby("tema")
        .size()
        .to_dict()
    )
    render_wordcloud(
        consolidated_freqs,
        "Nuvem de eixos tematicos - consolidado 2023-2026",
        ARTIFACTS_DIR / "nuvem_consolidado.png",
        seed=20232026,
    )
    render_wordcloud(
        consolidated_freqs,
        "Nuvem de eixos tematicos - consolidado 2023-2026",
        WORDCLOUD_DIR / "q2_nuvem_palavras_consolidado.png",
        seed=20232026,
    )

    (WORDCLOUD_DIR / "q2_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def render_wordcloud(freqs: dict[str, int], title: str, path: Path, seed: int) -> None:
    wordcloud = WordCloud(
        width=WIDTH,
        height=HEIGHT,
        background_color="white",
        color_func=color_for_eixo,
        prefer_horizontal=0.92,
        relative_scaling=0.65,
        random_state=seed,
        collocations=False,
        normalize_plurals=False,
        min_font_size=18,
        max_font_size=132,
        margin=16,
        font_path=find_font_path(),
    ).generate_from_frequencies(freqs)

    wordcloud.to_file(str(path))
    svg_path = path.with_suffix(".svg")
    svg_content = wordcloud.to_svg()
    if "viewBox" not in svg_content:
        svg_content = svg_content.replace(
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}">',
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" width="{WIDTH}" height="{HEIGHT}">'
        )
    svg_path.write_text(svg_content, encoding="utf-8")


def color_for_eixo(
    word: str,
    font_size: int,
    position: tuple[int, int],
    orientation: int | None,
    random_state: object | None = None,
    **kwargs: object,
) -> str:
    eixo = TEMA_TO_EIXO.get(word)
    return EIXO_COLORS.get(eixo, "#5A6772")


def find_font_path() -> str | None:
    candidates = [
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/segoeui.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return None


def build_analytic_rows(
    proposicoes: pd.DataFrame,
    autores: pd.DataFrame,
    deputados: pd.DataFrame,
    temas: pd.DataFrame,
    selected_years: tuple[int, ...],
) -> list[dict[str, object]]:
    prop_status = proposicoes[
        proposicoes["ano_dados"].isin(selected_years)
    ][["ano_dados", "id_proposicao", "uri_proposicao", "descricao_situacao"]].copy()
    prop_status["aprovada"] = prop_status["descricao_situacao"].map(is_approved)

    autoria = autores[
        autores["ano_dados"].isin(selected_years)
        & autores["id_deputado"].notna()
        & (autores["id_deputado"].str.strip() != "")
    ][["ano_dados", "id_proposicao", "uri_proposicao", "id_deputado", "nome_autor", "sigla_partido", "sigla_uf"]].copy()

    base = autoria.merge(
        temas[["ano_dados", "uri_proposicao", "tema"]],
        on=["ano_dados", "uri_proposicao"],
        how="inner",
    ).merge(
        prop_status[["ano_dados", "id_proposicao", "aprovada"]],
        on=["ano_dados", "id_proposicao"],
        how="left",
    )
    base = base.drop_duplicates(
        subset=["ano_dados", "id_proposicao", "id_deputado", "tema"]
    )
    base["aprovada"] = base["aprovada"].map(
        lambda value: bool(value) if pd.notna(value) else False
    )

    grouped = (
        base.groupby(["ano_dados", "id_deputado", "nome_autor", "sigla_partido", "sigla_uf", "tema"], dropna=False)
        .agg(
            qtd_proposicoes=("id_proposicao", "nunique"),
            proposicoes_aprovadas=("aprovada", "sum"),
        )
        .reset_index()
    )
    grouped["proposicoes_aprovadas"] = grouped["proposicoes_aprovadas"].astype(int)

    grouped = grouped.merge(deputados, on="id_deputado", how="left")
    grouped["nome"] = grouped["nome"].fillna(grouped["nome_autor"])
    grouped["nome_civil"] = grouped["nome_civil"].fillna(grouped["nome"])
    grouped["sigla_partido"] = grouped["sigla_partido"].fillna("S.Part.")
    grouped["sigla_uf"] = grouped["sigla_uf"].fillna("-")

    max_by_dep = grouped.groupby(["ano_dados", "id_deputado"])["qtd_proposicoes"].transform("max")
    grouped["maior_atuacao_no_tema"] = grouped["qtd_proposicoes"].eq(max_by_dep)

    eixo_labels = (
        grouped[grouped["maior_atuacao_no_tema"]]
        .sort_values(["ano_dados", "id_deputado", "tema"])
        .groupby(["ano_dados", "id_deputado"])["tema"]
        .apply(lambda values: ", ".join(values))
        .rename("tema_mais_atuante_deputado")
        .reset_index()
    )
    grouped = grouped.merge(eixo_labels, on=["ano_dados", "id_deputado"], how="left")

    grouped = grouped.sort_values(
        ["ano_dados", "qtd_proposicoes", "proposicoes_aprovadas", "nome", "tema"],
        ascending=[True, False, False, True, True],
    )

    rows: list[dict[str, object]] = []
    for row in grouped.itertuples(index=False):
        rows.append(
            {
                "ano_dados": int(row.ano_dados),
                "id_deputado": str(row.id_deputado),
                "nome": str(row.nome),
                "nome_civil": str(row.nome_civil),
                "sigla_partido": str(row.sigla_partido),
                "sigla_uf": str(row.sigla_uf),
                "tema": str(row.tema),
                "qtd_proposicoes": int(row.qtd_proposicoes),
                "proposicoes_aprovadas": int(row.proposicoes_aprovadas),
                "maior_atuacao_no_tema": "Sim" if bool(row.maior_atuacao_no_tema) else "Nao",
                "tema_mais_atuante_deputado": str(row.tema_mais_atuante_deputado),
            }
        )
    return rows


def write_q2_response_files(
    analytic_rows: list[dict[str, object]],
    counts: pd.DataFrame,
    consolidated: pd.DataFrame,
    selected_years: tuple[int, ...],
) -> None:
    count_rows = [
        {
            "year": int(row.year),
            "tema": str(row.eixo),
            "count": int(row.count),
        }
        for row in counts.itertuples(index=False)
    ]
    consolidated_rows = [
        {
            "tema": str(row.eixo),
            "count": int(row.count),
        }
        for row in consolidated.itertuples(index=False)
    ]
    summary_rows = [
        {
            "periodo": format_period(selected_years),
            "deputados": len({row["id_deputado"] for row in analytic_rows}),
            "temas": len({row["tema"] for row in analytic_rows}),
            "registros_deputado_tema": len(analytic_rows),
            "proposicoes": sum(int(row["qtd_proposicoes"]) for row in analytic_rows),
            "proposicoes_aprovadas": sum(int(row["proposicoes_aprovadas"]) for row in analytic_rows),
        }
    ]
    main_columns = [
        "ano_dados",
        "id_deputado",
        "nome",
        "nome_civil",
        "sigla_partido",
        "sigla_uf",
        "tema",
        "qtd_proposicoes",
        "proposicoes_aprovadas",
        "maior_atuacao_no_tema",
        "tema_mais_atuante_deputado",
    ]

    main_text = "\n".join(
        [
            "Q2 - eixos tematicos, nuvens de eixos e atuacao parlamentar",
            render_table("Resumo executivo - periodo consolidado", summary_rows, list(summary_rows[0].keys())),
            "",
            render_table(
                f"Tabela analitica - deputados por tema ({format_period(selected_years)})",
                analytic_rows,
                main_columns,
            ),
            "",
            render_table(
                "Q2.2 - contagem de proposicoes por tema por ano",
                count_rows,
                ["year", "tema", "count"],
            ),
            "",
            render_table(
                "Q2.3 - contagem consolidada de proposicoes por tema",
                consolidated_rows,
                ["tema", "count"],
            ),
            "",
        ]
    )
    (RESPONSES_DIR / "q2_eixos_nuvem_palavras.txt").write_text(main_text, encoding="utf-8")

    caio_q2_dir = REPO_ROOT / "Caio" / "q2"
    caio_q2_dir.mkdir(parents=True, exist_ok=True)
    (caio_q2_dir / "q2_eixos_nuvem_palavras.txt").write_text(main_text, encoding="utf-8")

    top_rows = [
        {
            "id_deputado": row["id_deputado"],
            "nome": row["nome"],
            "tema_mais_atuante": row["tema"],
            "qtd_proposicoes": row["qtd_proposicoes"],
            "proposicoes_aprovadas": row["proposicoes_aprovadas"],
        }
        for row in analytic_rows
        if row["maior_atuacao_no_tema"] == "Sim"
    ]
    complement_text = "\n".join(
        [
            f"Q2 complemento - tema mais atuante por deputado no periodo {format_period(selected_years)}",
            render_table(
                "Tema mais atuante por deputado - consolidado",
                top_rows,
                [
                    "id_deputado",
                    "nome",
                    "tema_mais_atuante",
                    "qtd_proposicoes",
                    "proposicoes_aprovadas",
                ],
            ),
            "",
        ]
    )
    (RESPONSES_DIR / "q2_eixo_nuvens_complemento.txt").write_text(
        complement_text, encoding="utf-8"
    )
    (caio_q2_dir / "caio_q2_dir" / "q2_eixo_nuvens_complemento.txt" if False else caio_q2_dir / "q2_eixo_nuvens_complemento.txt").write_text(
        complement_text, encoding="utf-8"
    )


def print_validation_summary(
    counts: pd.DataFrame,
    consolidated: pd.DataFrame,
    proposicoes: pd.DataFrame,
    selected_years: tuple[int, ...],
) -> None:
    print("Q2 - artefatos gerados")
    print(f"Anos: {', '.join(map(str, selected_years))}")
    print(f"Proposicoes lidas no periodo: {count_loaded_propositions(proposicoes, selected_years)}")
    print(f"Total ano/eixo contabilizado: {int(counts['count'].sum())}")
    print("Top 10 eixos no consolidado:")
    for row in consolidated.head(10).itertuples(index=False):
        print(f"- {row.eixo}: {int(row.count)}")
    print(f"Artefatos CSV/JSON/PNG: {ARTIFACTS_DIR}")
    print(f"Imagens servidas pelo front-end: {WORDCLOUD_DIR}")


def count_loaded_propositions(proposicoes: pd.DataFrame, selected_years: tuple[int, ...]) -> int:
    return int(
        proposicoes.loc[proposicoes["ano_dados"].isin(selected_years), "uri_proposicao"].nunique()
    )


def render_table(title: str, rows: list[dict[str, object]], columns: list[str]) -> str:
    values = [[format_value(row.get(column)) for column in columns] for row in rows]
    widths = [
        max(len(column), *(len(value[idx]) for value in values)) if values else len(column)
        for idx, column in enumerate(columns)
    ]
    header = " | ".join(column.rjust(widths[idx]) for idx, column in enumerate(columns))
    separator = "-+-".join("-" * width for width in widths)
    body = [
        " | ".join(value[idx].rjust(widths[idx]) for idx in range(len(columns)))
        for value in values
    ]
    return "\n".join([title, header, separator, *body, f"({len(rows)} rows)"])


def format_value(value: object) -> str:
    if value is None:
        return ""
    return str(value)


def format_period(selected_years: tuple[int, ...]) -> str:
    if len(selected_years) == 1:
        return str(selected_years[0])
    return f"{min(selected_years)}-{max(selected_years)}"


def normalize_token(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.lower())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def is_approved(value: object) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    normalized = re.sub(r"\s+", " ", normalize_token(value)).strip()
    approved = {
        "aprovada",
        "aprovada em plenario",
        "aprovada conclusivamente",
        "aprovada com substitutivo",
        "aprovada parcialmente",
        "remetida ao senado",
        "enviada a sancao",
        "transformada em norma juridica",
        "transformado em norma juridica",
        "transformada em lei",
        "promulgada",
    }
    return normalized in approved


if __name__ == "__main__":
    main()
