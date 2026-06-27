from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_AUTORES_INPUT = REPO_ROOT / "dados_padronizados" / "proposicoes_autores.csv"
DEFAULT_TEMAS_INPUT = REPO_ROOT / "dados_padronizados" / "proposicoes_temas.csv"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "JF" / "producao-legislativa-temas" / "analytics"


def write_csv(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, sep=";", index=False, encoding="utf-8")


def generate(autores_input: Path, temas_input: Path, output_dir: Path) -> dict:
    autores = pd.read_csv(
        autores_input,
        sep=";",
        usecols=["ano_dados", "uri_proposicao", "id_deputado"],
        dtype={"id_deputado": "string"},
        low_memory=False,
    )
    autores["id_deputado"] = autores["id_deputado"].str.strip()
    autores = autores[autores["id_deputado"].notna() & (autores["id_deputado"] != "")]
    autores = autores.drop_duplicates(subset=["ano_dados", "uri_proposicao", "id_deputado"])

    temas = pd.read_csv(
        temas_input,
        sep=";",
        usecols=["ano_dados", "uri_proposicao", "tema"],
        low_memory=False,
    )
    temas = temas.drop_duplicates(subset=["ano_dados", "uri_proposicao", "tema"])

    merged = autores.merge(temas, on=["ano_dados", "uri_proposicao"], how="inner")
    merged = merged.drop_duplicates(subset=["id_deputado", "tema", "ano_dados", "uri_proposicao"])

    counts = (
        merged.groupby(["id_deputado", "tema"])
        .size()
        .reset_index(name="qtd_proposicoes")
        .sort_values(["id_deputado", "qtd_proposicoes"], ascending=[True, False])
    )

    write_csv(counts, output_dir / "deputado_temas_nuvem.csv")

    metadata = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "rows": int(len(counts)),
        "deputados": int(counts["id_deputado"].nunique()),
        "temas": int(counts["tema"].nunique()),
        "max_qtd_proposicoes": int(counts["qtd_proposicoes"].max()) if len(counts) else 0,
        "fonte": ["proposicoes_autores.csv", "proposicoes_temas.csv"],
    }
    (output_dir / "deputado_temas_nuvem_metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return metadata


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Gera o artefato de proposicoes por tema e deputado para a nuvem de palavras do perfil."
    )
    parser.add_argument("--autores-input", type=Path, default=DEFAULT_AUTORES_INPUT)
    parser.add_argument("--temas-input", type=Path, default=DEFAULT_TEMAS_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    metadata = generate(args.autores_input, args.temas_input, args.output_dir)
    print(
        "Artefato de temas por deputado gerado em "
        f"{args.output_dir} ({metadata['rows']} linhas, {metadata['deputados']} deputados)."
    )


if __name__ == "__main__":
    main()
