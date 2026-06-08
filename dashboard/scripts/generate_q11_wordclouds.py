"""
Gera as nuvens de palavras da Q11 (letras A, B e C).

Cada nuvem usa os nomes dos partidos como termos e o valor da métrica
correspondente como frequência:
  - Q11.a: votações participadas
  - Q11.b: total de proposições
  - Q11.c: gasto total

As imagens (PNG + SVG) são salvas em:
  dashboard/frontend/public/wordclouds/q11_nuvem_*.{png,svg}

Uso:
    py -3 dashboard/scripts/generate_q11_wordclouds.py
"""

from __future__ import annotations

import json
from pathlib import Path

try:
    from wordcloud import WordCloud
except ImportError as exc:
    raise SystemExit(
        f"Dependencia ausente: instale 'wordcloud' (pip install wordcloud). Erro: {exc}"
    ) from exc

REPO_ROOT = Path(__file__).resolve().parents[2]
WORDCLOUD_DIR = REPO_ROOT / "dashboard" / "frontend" / "public" / "wordclouds"
RESPONSE_FILE = REPO_ROOT / "JF" / "q11" / "q11_ranking_partidos.txt"

WIDTH = 1280
HEIGHT = 720

# Cores por ideologia (mesmo padrão usado no restante do projeto)
IDEOLOGY_COLORS = {
    "esquerda": "#2A9D8F",
    "centro": "#E9C46A",
    "direita": "#E76F51",
    "nao classificado": "#8D99AE",
}

# Mapa partido → ideologia preenchido no parse
PARTIDO_IDEOLOGIA: dict[str, str] = {}


def main() -> None:
    WORDCLOUD_DIR.mkdir(parents=True, exist_ok=True)

    text = read_response_file()
    tables = parse_tables(text)

    # Identificar as tabelas consolidadas de cada letra
    freq_table = find_table(tables, "Q11.a - Ranking de partidos por frequencia")
    prop_table = find_table(tables, "Q11.b - Ranking de partidos por proposicoes")
    gasto_table = find_table(tables, "Q11.c - Ranking de partidos por gastos")

    if not freq_table:
        raise SystemExit("Tabela Q11.a nao encontrada no arquivo de resposta.")
    if not prop_table:
        raise SystemExit("Tabela Q11.b nao encontrada no arquivo de resposta.")
    if not gasto_table:
        raise SystemExit("Tabela Q11.c nao encontrada no arquivo de resposta.")

    # Extrair frequências (partido → valor)
    freq_a = extract_freqs(freq_table, "votacoes_participadas")
    freq_b = extract_freqs(prop_table, "total_proposicoes")
    freq_c = extract_freqs(gasto_table, "gasto_total")

    configs = [
        ("q11_nuvem_votacoes", "Frequencia nas votacoes", freq_a),
        ("q11_nuvem_proposicoes", "Proposicoes de projetos", freq_b),
        ("q11_nuvem_gastos", "Gastos por partido", freq_c),
    ]

    manifest = []
    for name, label, freqs in configs:
        if not freqs:
            print(f"  AVISO: Sem dados para {label}, pulando.")
            continue
        png_path = WORDCLOUD_DIR / f"{name}.png"
        render_wordcloud(freqs, f"Q11 - {label}", png_path, seed=hash(name) % 2**31)
        manifest.append({
            "year": label,
            "src": f"/wordclouds/{name}.svg",
            "alt": f"Nuvem de palavras - {label}",
        })
        print(f"  Gerado: {png_path.name} + {png_path.with_suffix('.svg').name}")

    manifest_path = WORDCLOUD_DIR / "q11_manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\nManifesto salvo: {manifest_path}")
    print(f"Total de nuvens geradas: {len(manifest)}")


def read_response_file() -> str:
    if not RESPONSE_FILE.exists():
        fallback = REPO_ROOT / "Banco" / "respostas" / "q11_ranking_partidos.txt"
        if fallback.exists():
            return fallback.read_text(encoding="utf-8", errors="replace")
        raise SystemExit(f"Arquivo de resposta nao encontrado: {RESPONSE_FILE}")
    return RESPONSE_FILE.read_text(encoding="utf-8", errors="replace")


def parse_tables(text: str) -> list[dict]:
    """Parse das tabelas no formato psql do arquivo txt."""
    tables = []
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        # Procura linhas de cabeçalho (contém |)
        if "|" in line and i + 1 < len(lines) and set(lines[i + 1].strip().replace("+", "").replace("-", "").replace(" ", "")) <= {""}:
            # Encontrar o título (linha anterior sem |)
            title = ""
            for j in range(i - 1, max(i - 5, -1), -1):
                candidate = lines[j].strip()
                if candidate and "|" not in candidate and "(" not in candidate.split("row")[0] if "row" in candidate else True:
                    if candidate and not candidate.startswith("("):
                        title = candidate
                        break

            # Parse colunas
            cols = [c.strip() for c in line.split("|")]
            # Pular separador
            i += 2
            rows = []
            while i < len(lines):
                row_line = lines[i].strip()
                if not row_line or row_line.startswith("(") or "|" not in row_line:
                    break
                values = [v.strip() for v in row_line.split("|")]
                if len(values) == len(cols):
                    rows.append(dict(zip(cols, values)))
                i += 1
            tables.append({"title": title, "columns": cols, "rows": rows})
        else:
            i += 1
    return tables


def find_table(tables: list[dict], hint: str) -> dict | None:
    hint_lower = hint.lower()
    for table in tables:
        if hint_lower in table["title"].lower():
            return table
    return None


def extract_freqs(table: dict, value_col: str) -> dict[str, float]:
    freqs = {}
    for row in table["rows"]:
        partido = row.get("sigla_partido", "").strip()
        ideologia = row.get("ideologia", "nao classificado").strip()
        raw_value = row.get(value_col, "0").strip().replace(",", "")
        if not partido:
            continue
        try:
            value = float(raw_value)
        except ValueError:
            continue
        if value > 0:
            freqs[partido] = value
            PARTIDO_IDEOLOGIA[partido] = ideologia
    return freqs


def render_wordcloud(freqs: dict[str, float], title: str, path: Path, seed: int) -> None:
    wc = WordCloud(
        width=WIDTH,
        height=HEIGHT,
        background_color="white",
        color_func=color_for_partido,
        prefer_horizontal=0.85,
        relative_scaling=0.55,
        random_state=seed,
        collocations=False,
        normalize_plurals=False,
        min_font_size=16,
        max_font_size=160,
        margin=16,
        font_path=find_font_path(),
    ).generate_from_frequencies(freqs)

    wc.to_file(str(path))

    svg_path = path.with_suffix(".svg")
    svg_content = wc.to_svg()
    if "viewBox" not in svg_content:
        svg_content = svg_content.replace(
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}">',
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" width="{WIDTH}" height="{HEIGHT}">'
        )
    svg_path.write_text(svg_content, encoding="utf-8")


def color_for_partido(
    word: str,
    font_size: int,
    position: tuple[int, int],
    orientation: int | None,
    random_state: object | None = None,
    **kwargs: object,
) -> str:
    ideologia = PARTIDO_IDEOLOGIA.get(word, "nao classificado")
    return IDEOLOGY_COLORS.get(ideologia, "#8D99AE")


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


if __name__ == "__main__":
    main()
