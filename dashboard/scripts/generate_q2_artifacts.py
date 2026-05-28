from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from html import escape
import json
from math import cos, sin, sqrt
from pathlib import Path
import random
import re
import unicodedata

import pandas as pd


REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "dados_padronizados"
RESPONSES_DIR = REPO_ROOT / "respostas"
WORDCLOUD_DIR = REPO_ROOT / "dashboard" / "frontend" / "public" / "wordclouds"

YEARS = (2023, 2024, 2025, 2026)
WIDTH = 1280
HEIGHT = 720
MAX_WORDS = 86

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
    "Outros": "#8D99AE",
}

STOPWORDS = {
    "a",
    "acerca",
    "adiamento",
    "altera",
    "alteracao",
    "alteraçao",
    "ano",
    "anos",
    "apreciacao",
    "aprova",
    "aprovacao",
    "art",
    "autoriza",
    "autorizacao",
    "camara",
    "codigo",
    "com",
    "comissao",
    "congresso",
    "constante",
    "contra",
    "da",
    "das",
    "de",
    "dep",
    "deputados",
    "decreto",
    "decretolei",
    "dez",
    "dia",
    "diario",
    "diretrizes",
    "discussao",
    "dispoe",
    "dispor",
    "do",
    "dos",
    "em",
    "emenda",
    "entre",
    "estado",
    "excelentissimo",
    "exarado",
    "federal",
    "inclusao",
    "informa",
    "informacoes",
    "institui",
    "inversao",
    "janeiro",
    "lei",
    "ltda",
    "materia",
    "medida",
    "ministra",
    "ministerio",
    "ministro",
    "mocao",
    "nacional",
    "nominal",
    "nos",
    "oficial",
    "outorga",
    "outras",
    "para",
    "parecer",
    "pauta",
    "pdl",
    "pela",
    "pelo",
    "pelos",
    "plenaria",
    "plenario",
    "portaria",
    "presidente",
    "prestados",
    "projeto",
    "promulgacao",
    "providencias",
    "publica",
    "publicada",
    "publicas",
    "publico",
    "publicos",
    "que",
    "radio",
    "radiodifusao",
    "realizacao",
    "redacao",
    "regime",
    "regozijo",
    "relator",
    "relatora",
    "renova",
    "requer",
    "requerimento",
    "retirada",
    "senado",
    "senhor",
    "sessao",
    "solicita",
    "sobre",
    "submete",
    "substitutivo",
    "termos",
    "uniao",
    "votacao",
}


@dataclass(frozen=True)
class PlacedWord:
    token: str
    frequencia: int
    eixo: str
    x: float
    y: float
    size: int
    rotate: int


def main() -> None:
    WORDCLOUD_DIR.mkdir(parents=True, exist_ok=True)
    RESPONSES_DIR.mkdir(parents=True, exist_ok=True)

    proposicoes = pd.read_csv(
        DATA_DIR / "proposicoes.csv",
        sep=";",
        dtype=str,
        encoding="utf-8",
        usecols=[
            "ano_dados",
            "id_proposicao",
            "uri_proposicao",
            "ementa",
            "ementa_detalhada",
            "keywords",
            "descricao_situacao",
        ],
    )
    autores = pd.read_csv(
        DATA_DIR / "proposicoes_autores.csv",
        sep=";",
        dtype=str,
        encoding="utf-8",
        usecols=["ano_dados", "id_proposicao", "uri_proposicao", "id_deputado", "nome_autor"],
    )
    deputados = pd.read_csv(
        DATA_DIR / "deputados.csv",
        sep=";",
        dtype=str,
        encoding="utf-8",
        usecols=["id_deputado", "nome"],
    )
    temas = pd.read_csv(
        DATA_DIR / "proposicoes_temas.csv",
        sep=";",
        dtype=str,
        encoding="utf-8",
        usecols=["ano_dados", "uri_proposicao", "cod_tema"],
    )

    proposicoes["ano_dados"] = proposicoes["ano_dados"].astype(int)
    autores["ano_dados"] = autores["ano_dados"].astype(int)
    temas["ano_dados"] = temas["ano_dados"].astype(int)
    temas["cod_tema_num"] = pd.to_numeric(temas["cod_tema"], errors="coerce").astype("Int64")
    temas["eixo_maior"] = temas["cod_tema_num"].map(EIXO_BY_COD_TEMA).fillna("Outros")
    temas = temas[temas["ano_dados"].isin(YEARS) & (temas["eixo_maior"] != "Outros")]

    token_rows = build_word_counts(proposicoes, temas)
    write_wordcloud_svgs(token_rows)

    analytic_rows = build_analytic_rows(proposicoes, autores, deputados, temas)
    write_q2_response_files(analytic_rows, token_rows)


def build_word_counts(proposicoes: pd.DataFrame, temas: pd.DataFrame) -> list[dict[str, object]]:
    eixo_lookup: dict[tuple[int, str], set[str]] = defaultdict(set)
    for row in temas.itertuples(index=False):
        eixo_lookup[(int(row.ano_dados), str(row.uri_proposicao))].add(str(row.eixo_maior))

    totals: dict[int, Counter[str]] = {year: Counter() for year in YEARS}
    by_eixo: dict[int, dict[str, Counter[str]]] = {
        year: defaultdict(Counter) for year in YEARS
    }

    for row in proposicoes[proposicoes["ano_dados"].isin(YEARS)].itertuples(index=False):
        year = int(row.ano_dados)
        eixos = eixo_lookup.get((year, str(row.uri_proposicao)), set())
        if not eixos:
            continue

        text = " ".join(
            str(value)
            for value in (row.ementa, row.ementa_detalhada, row.keywords)
            if isinstance(value, str) and value != "nan"
        )
        tokens = list(tokenize(text))
        if not tokens:
            continue

        totals[year].update(tokens)
        unique_tokens = set(tokens)
        for eixo in eixos:
            by_eixo[year][eixo].update(unique_tokens)

    rows: list[dict[str, object]] = []
    for year in YEARS:
        for token, frequencia in totals[year].most_common(200):
            eixo_counter = Counter(
                {eixo: counter[token] for eixo, counter in by_eixo[year].items()}
            )
            eixo_dominante = eixo_counter.most_common(1)[0][0] if eixo_counter else "Outros"
            rows.append(
                {
                    "ano_dados": year,
                    "token": token,
                    "frequencia": frequencia,
                    "eixo_dominante": eixo_dominante,
                }
            )
    return rows


def build_analytic_rows(
    proposicoes: pd.DataFrame,
    autores: pd.DataFrame,
    deputados: pd.DataFrame,
    temas: pd.DataFrame,
) -> list[dict[str, object]]:
    prop_status = proposicoes[
        proposicoes["ano_dados"].isin(YEARS)
    ][["ano_dados", "id_proposicao", "uri_proposicao", "descricao_situacao"]].copy()
    prop_status["aprovada"] = prop_status["descricao_situacao"].map(is_approved)

    autoria = autores[
        autores["ano_dados"].isin(YEARS)
        & autores["id_deputado"].notna()
        & (autores["id_deputado"].str.strip() != "")
    ][["ano_dados", "id_proposicao", "uri_proposicao", "id_deputado", "nome_autor"]].copy()

    base = autoria.merge(
        temas[["ano_dados", "uri_proposicao", "eixo_maior"]],
        on=["ano_dados", "uri_proposicao"],
        how="inner",
    ).merge(
        prop_status[["ano_dados", "id_proposicao", "aprovada"]],
        on=["ano_dados", "id_proposicao"],
        how="left",
    )
    base = base.drop_duplicates(
        subset=["ano_dados", "id_proposicao", "id_deputado", "eixo_maior"]
    )
    base["aprovada"] = base["aprovada"].map(
        lambda value: bool(value) if pd.notna(value) else False
    )

    grouped = (
        base.groupby(["id_deputado", "nome_autor", "eixo_maior"], dropna=False)
        .agg(
            qtd_proposicoes=("id_proposicao", "nunique"),
            proposicoes_aprovadas=("aprovada", "sum"),
        )
        .reset_index()
    )
    grouped["proposicoes_aprovadas"] = grouped["proposicoes_aprovadas"].astype(int)

    grouped = grouped.merge(deputados, on="id_deputado", how="left")
    grouped["nome"] = grouped["nome"].fillna(grouped["nome_autor"])

    max_by_dep = grouped.groupby("id_deputado")["qtd_proposicoes"].transform("max")
    grouped["maior_atuacao_no_eixo"] = grouped["qtd_proposicoes"].eq(max_by_dep)

    eixo_labels = (
        grouped[grouped["maior_atuacao_no_eixo"]]
        .sort_values(["id_deputado", "eixo_maior"])
        .groupby("id_deputado")["eixo_maior"]
        .apply(lambda values: ", ".join(values))
        .rename("eixo_mais_atuante_deputado")
        .reset_index()
    )
    grouped = grouped.merge(eixo_labels, on="id_deputado", how="left")

    grouped = grouped.sort_values(
        ["qtd_proposicoes", "proposicoes_aprovadas", "nome", "eixo_maior"],
        ascending=[False, False, True, True],
    )

    rows: list[dict[str, object]] = []
    for row in grouped.itertuples(index=False):
        rows.append(
            {
                "id_deputado": str(row.id_deputado),
                "nome": str(row.nome),
                "eixo_maior": str(row.eixo_maior),
                "qtd_proposicoes": int(row.qtd_proposicoes),
                "proposicoes_aprovadas": int(row.proposicoes_aprovadas),
                "maior_atuacao_no_eixo": "Sim" if bool(row.maior_atuacao_no_eixo) else "Nao",
                "eixo_mais_atuante_deputado": str(row.eixo_mais_atuante_deputado),
            }
        )
    return rows


def write_wordcloud_svgs(token_rows: list[dict[str, object]]) -> None:
    rows_by_year: dict[int, list[dict[str, object]]] = {year: [] for year in YEARS}
    for row in token_rows:
        rows_by_year[int(row["ano_dados"])].append(row)

    manifest = []
    for year in YEARS:
        selected = rows_by_year[year][:MAX_WORDS]
        placed = layout_words(selected, seed=year)
        svg = render_svg(year, placed)
        filename = f"q2_nuvem_palavras_{year}.svg"
        (WORDCLOUD_DIR / filename).write_text(svg, encoding="utf-8")
        manifest.append({"year": year, "src": f"/wordclouds/{filename}"})

    manifest_text = json.dumps(manifest, ensure_ascii=False, indent=2)
    (WORDCLOUD_DIR / "q2_manifest.json").write_text(manifest_text, encoding="utf-8")


def layout_words(rows: list[dict[str, object]], seed: int) -> list[PlacedWord]:
    rng = random.Random(seed)
    frequencies = [int(row["frequencia"]) for row in rows]
    min_freq = min(frequencies) if frequencies else 1
    max_freq = max(frequencies) if frequencies else 1
    boxes: list[tuple[float, float, float, float]] = []
    placed: list[PlacedWord] = []

    for row in rows:
        token = str(row["token"])
        freq = int(row["frequencia"])
        if max_freq == min_freq:
            size = 30
        else:
            scaled = (sqrt(freq) - sqrt(min_freq)) / max(sqrt(max_freq) - sqrt(min_freq), 0.001)
            size = int(18 + scaled * 62)

        rotate = 0 if rng.random() > 0.16 or size > 48 else -12
        width = max(24, len(token) * size * (0.56 if rotate == 0 else 0.62))
        height = size * (1.05 if rotate == 0 else 1.35)

        x, y = find_position(width, height, boxes, rng)
        if x is None or y is None:
            continue

        boxes.append((x - width / 2, y - height / 2, x + width / 2, y + height / 2))
        placed.append(
            PlacedWord(
                token=token,
                frequencia=freq,
                eixo=str(row["eixo_dominante"]),
                x=x,
                y=y,
                size=size,
                rotate=rotate,
            )
        )
    return placed


def find_position(
    width: float,
    height: float,
    boxes: list[tuple[float, float, float, float]],
    rng: random.Random,
) -> tuple[float | None, float | None]:
    center_x = WIDTH / 2
    center_y = HEIGHT / 2 + 16
    max_radius = 475

    for step in range(900):
        angle = step * 0.38
        radius = 6 + step * 0.58
        x = center_x + radius * rng.choice((0.96, 1.0, 1.04)) * cos(angle)
        y = center_y + radius * 0.58 * sin(angle)
        x += rng.uniform(-5, 5)
        y += rng.uniform(-5, 5)

        box = (x - width / 2, y - height / 2, x + width / 2, y + height / 2)
        if box[0] < 34 or box[1] < 92 or box[2] > WIDTH - 34 or box[3] > HEIGHT - 78:
            if radius > max_radius:
                break
            continue
        if any(overlaps(box, other) for other in boxes):
            continue
        return x, y
    return None, None


def render_svg(year: int, words: list[PlacedWord]) -> str:
    legend_items = "".join(
        f'<g transform="translate({54 + idx * 148},656)">'
        f'<rect width="14" height="14" rx="3" fill="{color}"/>'
        f'<text x="20" y="12" class="legend">{escape(short_label(eixo))}</text>'
        f"</g>"
        for idx, (eixo, color) in enumerate(EIXO_COLORS.items())
        if eixo != "Outros"
    )
    word_items = "\n".join(
        f'<text x="{word.x:.1f}" y="{word.y:.1f}" text-anchor="middle" '
        f'class="word" font-size="{word.size}" fill="{EIXO_COLORS.get(word.eixo, EIXO_COLORS["Outros"])}" '
        f'transform="rotate({word.rotate} {word.x:.1f} {word.y:.1f})">'
        f"<title>{escape(word.eixo)} - {word.frequencia} ocorrencias</title>"
        f"{escape(word.token)}</text>"
        for word in words
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-labelledby="title desc">
  <title id="title">Nuvem de palavras por eixo tematico - {year}</title>
  <desc id="desc">Termos mais frequentes em proposicoes com temas classificados por eixo no ano de {year}.</desc>
  <style>
    .bg {{ fill: #fffdf8; }}
    .title {{ font: 700 30px Sora, Arial, sans-serif; fill: #0b3c5d; }}
    .subtitle {{ font: 500 15px 'Source Sans 3', Arial, sans-serif; fill: #52606d; }}
    .word {{ font-family: Sora, 'Source Sans 3', Arial, sans-serif; font-weight: 700; }}
    .legend {{ font: 600 13px 'Source Sans 3', Arial, sans-serif; fill: #52606d; }}
  </style>
  <rect class="bg" width="{WIDTH}" height="{HEIGHT}" rx="0"/>
  <text x="54" y="48" class="title">Nuvem de palavras - {year}</text>
  <text x="54" y="75" class="subtitle">Cor indica o eixo tematico dominante do termo no ano.</text>
  {word_items}
  {legend_items}
</svg>
"""


def write_q2_response_files(
    analytic_rows: list[dict[str, object]], token_rows: list[dict[str, object]]
) -> None:
    summary_rows = [
        {
            "periodo": "2023-2026",
            "deputados": len({row["id_deputado"] for row in analytic_rows}),
            "eixos": len({row["eixo_maior"] for row in analytic_rows}),
            "registros_deputado_eixo": len(analytic_rows),
            "proposicoes": sum(int(row["qtd_proposicoes"]) for row in analytic_rows),
            "proposicoes_aprovadas": sum(int(row["proposicoes_aprovadas"]) for row in analytic_rows),
        }
    ]
    main_columns = [
        "id_deputado",
        "nome",
        "eixo_maior",
        "qtd_proposicoes",
        "proposicoes_aprovadas",
        "maior_atuacao_no_eixo",
        "eixo_mais_atuante_deputado",
    ]
    token_columns = ["ano_dados", "token", "frequencia", "eixo_dominante"]

    main_text = "\n".join(
        [
            "Q2 - eixos tematicos, nuvens de palavras e atuacao parlamentar",
            render_table("Resumo executivo - periodo consolidado", summary_rows, list(summary_rows[0].keys())),
            "",
            render_table(
                "Tabela analitica - deputados por eixo tematico (2023-2026)",
                analytic_rows,
                main_columns,
            ),
            "",
            render_table(
                "Q2.2 - termos para nuvens de palavras por ano",
                token_rows,
                token_columns,
            ),
            "",
        ]
    )
    (RESPONSES_DIR / "q2_eixos_nuvem_palavras.txt").write_text(main_text, encoding="utf-8")

    top_rows = [
        {
            "id_deputado": row["id_deputado"],
            "nome": row["nome"],
            "eixo_mais_atuante": row["eixo_maior"],
            "qtd_proposicoes": row["qtd_proposicoes"],
            "proposicoes_aprovadas": row["proposicoes_aprovadas"],
        }
        for row in analytic_rows
        if row["maior_atuacao_no_eixo"] == "Sim"
    ]
    top_columns = [
        "id_deputado",
        "nome",
        "eixo_mais_atuante",
        "qtd_proposicoes",
        "proposicoes_aprovadas",
    ]
    complement_text = "\n".join(
        [
            "Q2 complemento - eixo mais atuante por deputado no periodo 2023-2026",
            render_table(
                "Eixo mais atuante por deputado - consolidado",
                top_rows,
                top_columns,
            ),
            "",
        ]
    )
    (RESPONSES_DIR / "q2_eixo_nuvens_complemento.txt").write_text(
        complement_text, encoding="utf-8"
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


def tokenize(text: str):
    for raw in re.findall(r"[A-Za-zÀ-ÿ0-9]{3,}", text.lower()):
        token = raw.strip("_")
        normalized = normalize_token(token)
        if len(normalized) < 3 or normalized in STOPWORDS:
            continue
        if normalized.isdigit():
            continue
        yield token


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


def overlaps(
    first: tuple[float, float, float, float],
    second: tuple[float, float, float, float],
) -> bool:
    padding = 4
    return not (
        first[2] + padding < second[0]
        or first[0] - padding > second[2]
        or first[3] + padding < second[1]
        or first[1] - padding > second[3]
    )


def short_label(eixo: str) -> str:
    return {
        "Institucional e juridico": "Institucional",
        "Ambiental e energetico": "Ambiental",
        "Infraestrutura e tecnologia": "Infraestrutura",
        "Cultura e sociedade": "Cultura",
    }.get(eixo, eixo)


if __name__ == "__main__":
    main()
