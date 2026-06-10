from __future__ import annotations

import argparse
import csv
import io
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, TextIO


REPO_ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS_DIR = REPO_ROOT / "artifacts" / "q3"

VOTOS_MIN_COLUMNS = [
    "ano_dados",
    "data_votacao",
    "id_votacao",
    "id_deputado",
    "nome",
    "sigla_partido",
    "sigla_uf",
    "voto",
    "voto_sim",
    "voto_nao",
    "voto_abstencao",
    "voto_outro",
    "eixo_principal",
    "tem_classificacao_tematica",
]

RESUMOS_COLUMNS = [
    "ano_dados",
    "eixo_principal",
    "sigla_partido",
    "sigla_uf",
    "id_deputado",
    "nome",
    "voto_sim",
    "voto_nao",
    "voto_abstencao",
    "voto_outro",
    "votos_total",
    "votos_classificados",
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Normaliza os artefatos da Q3 a partir do CSV analitico.")
    parser.add_argument(
        "--analytic",
        default="-",
        help="Caminho do q3_votos_analitico.csv, ou '-' para ler de stdin.",
    )
    parser.add_argument("--output-dir", type=Path, default=ARTIFACTS_DIR)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    with _open_input(args.analytic) as handle:
        stats = normalize(handle, args.output_dir)

    print(json.dumps(stats, ensure_ascii=False, indent=2))
    return 0


def normalize(handle: TextIO, output_dir: Path) -> dict[str, Any]:
    reader = csv.DictReader(handle, delimiter=";", quotechar='"', doublequote=True)
    votos_path = output_dir / "q3_votos_min.csv"
    resumos_path = output_dir / "q3_resumos_agregados.csv"

    aggregate: dict[tuple[str, str, str, str, str, str], dict[str, Any]] = {}
    seen_vote_keys: set[tuple[str, str, str]] = set()
    duplicate_vote_keys = 0
    totals = defaultdict(int)

    with votos_path.open("w", encoding="utf-8", newline="") as votos_handle:
        votos_writer = csv.DictWriter(
            votos_handle,
            fieldnames=VOTOS_MIN_COLUMNS,
            delimiter=";",
            quotechar='"',
            doublequote=True,
            lineterminator="\n",
        )
        votos_writer.writeheader()

        for row in reader:
            vote_key = (row.get("ano_dados", ""), row.get("id_votacao", ""), row.get("id_deputado", ""))
            if vote_key in seen_vote_keys:
                duplicate_vote_keys += 1
            seen_vote_keys.add(vote_key)

            votos_writer.writerow({column: row.get(column, "") for column in VOTOS_MIN_COLUMNS})
            _add_to_totals(totals, row)

            aggregate_key = (
                row.get("ano_dados", ""),
                row.get("eixo_principal", ""),
                row.get("sigla_partido", ""),
                row.get("sigla_uf", ""),
                row.get("id_deputado", ""),
                row.get("nome", ""),
            )
            if aggregate_key not in aggregate:
                aggregate[aggregate_key] = {
                    "ano_dados": aggregate_key[0],
                    "eixo_principal": aggregate_key[1],
                    "sigla_partido": aggregate_key[2],
                    "sigla_uf": aggregate_key[3],
                    "id_deputado": aggregate_key[4],
                    "nome": aggregate_key[5],
                    "voto_sim": 0,
                    "voto_nao": 0,
                    "voto_abstencao": 0,
                    "voto_outro": 0,
                    "votos_total": 0,
                    "votos_classificados": 0,
                }
            bucket = aggregate[aggregate_key]
            for column in ("voto_sim", "voto_nao", "voto_abstencao", "voto_outro"):
                bucket[column] += _to_int(row.get(column))
            bucket["votos_total"] += 1
            if str(row.get("tem_classificacao_tematica", "")).lower() == "true":
                bucket["votos_classificados"] += 1

    with resumos_path.open("w", encoding="utf-8", newline="") as resumos_handle:
        writer = csv.DictWriter(
            resumos_handle,
            fieldnames=RESUMOS_COLUMNS,
            delimiter=";",
            quotechar='"',
            doublequote=True,
            lineterminator="\n",
        )
        writer.writeheader()
        for key in sorted(aggregate):
            writer.writerow(aggregate[key])

    manifest_path = output_dir / "q3_manifest.json"
    manifest = _read_manifest(manifest_path)
    manifest["normalized_at"] = datetime.now(timezone.utc).isoformat()
    manifest["outputs"] = {
        "resumos_agregados": str(resumos_path),
        "votos_min": str(votos_path),
        "classificacao_votacoes": str(output_dir / "q3_classificacao_votacoes.csv"),
    }
    manifest["validations"] = {
        **manifest.get("validations", {}),
        "total_votos": totals["total_votos"],
        "votos_unicos": len(seen_vote_keys),
        "duplicidades_chave_voto": duplicate_vote_keys,
        "votos_sim": totals["voto_sim"],
        "votos_nao": totals["voto_nao"],
        "votos_abstencao": totals["voto_abstencao"],
        "votos_outros": totals["voto_outro"],
        "votos_classificados": totals["votos_classificados"],
        "resumos_agregados_linhas": len(aggregate),
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return {
        "q3_votos_min": str(votos_path),
        "q3_resumos_agregados": str(resumos_path),
        "total_votos": totals["total_votos"],
        "votos_unicos": len(seen_vote_keys),
        "duplicidades_chave_voto": duplicate_vote_keys,
        "resumos_agregados_linhas": len(aggregate),
    }


def _open_input(path: str) -> TextIO:
    if path == "-":
        return io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8", newline="")
    return Path(path).open("r", encoding="utf-8", newline="")


def _add_to_totals(totals: dict[str, int], row: dict[str, str]) -> None:
    totals["total_votos"] += 1
    for column in ("voto_sim", "voto_nao", "voto_abstencao", "voto_outro"):
        totals[column] += _to_int(row.get(column))
    if str(row.get("tem_classificacao_tematica", "")).lower() == "true":
        totals["votos_classificados"] += 1


def _to_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _read_manifest(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    raise SystemExit(main())
