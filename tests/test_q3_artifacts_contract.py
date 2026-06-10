from __future__ import annotations

import csv
import subprocess
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
Q3_DIR = ROOT / "artifacts" / "q3"


def _rows(path: Path):
    with path.open("r", encoding="utf-8", newline="") as handle:
        yield from csv.DictReader(handle, delimiter=";")


def _to_int(value: str | None) -> int:
    return int(value or 0)


def test_q3_votos_min_preserves_vote_unit_uniqueness() -> None:
    keys = set()
    total = 0
    for row in _rows(Q3_DIR / "q3_votos_min.csv"):
        keys.add((row["ano_dados"], row["id_votacao"], row["id_deputado"]))
        total += 1

    assert total == 462742
    assert len(keys) == total


def test_q3_resumos_and_donut_preserve_vote_totals() -> None:
    resumo_totals = Counter()
    for row in _rows(Q3_DIR / "q3_resumos_agregados.csv"):
        resumo_totals["sim"] += _to_int(row["voto_sim"])
        resumo_totals["nao"] += _to_int(row["voto_nao"])
        resumo_totals["abstencao"] += _to_int(row["voto_abstencao"])
        resumo_totals["outro"] += _to_int(row["voto_outro"])
        resumo_totals["total"] += _to_int(row["votos_total"])

    min_totals = Counter()
    for row in _rows(Q3_DIR / "q3_votos_min.csv"):
        min_totals["sim"] += _to_int(row["voto_sim"])
        min_totals["nao"] += _to_int(row["voto_nao"])
        min_totals["abstencao"] += _to_int(row["voto_abstencao"])
        min_totals["outro"] += _to_int(row["voto_outro"])
        min_totals["total"] += 1

    assert resumo_totals == min_totals
    assert sum(resumo_totals[item] for item in ("sim", "nao", "abstencao", "outro")) == resumo_totals["total"]


def test_q3_eixo_filter_contract_uses_only_primary_axis() -> None:
    min_columns = next(_rows(Q3_DIR / "q3_votos_min.csv")).keys()
    resumo_columns = next(_rows(Q3_DIR / "q3_resumos_agregados.csv")).keys()

    assert "eixo_principal" in min_columns
    assert "eixo_principal" in resumo_columns
    assert "eixos_secundarios" not in min_columns
    assert "eixos_secundarios" not in resumo_columns


def test_q3_join_keys_do_not_duplicate_paged_rows() -> None:
    classificacao_keys = [
        (row["ano_dados"], row["id_votacao"])
        for row in _rows(Q3_DIR / "q3_classificacao_votacoes.csv")
    ]
    assert len(classificacao_keys) == len(set(classificacao_keys))

    vote_keys = [
        (row["ano_dados"], row["id_votacao"], row["id_deputado"])
        for row in _rows(Q3_DIR / "q3_votos_min.csv")
    ]
    assert len(vote_keys) == len(set(vote_keys))


def test_no_tracked_file_exceeds_github_100mb_limit() -> None:
    result = subprocess.run(
        ["git", "ls-files"],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    oversized = []
    for relative in result.stdout.splitlines():
        path = ROOT / relative
        if path.exists() and path.stat().st_size > 100 * 1024 * 1024:
            oversized.append(relative)

    assert oversized == []


def test_q3_analytic_csv_is_not_tracked_or_staged() -> None:
    tracked = subprocess.run(
        ["git", "ls-files", "--", "artifacts/q3/q3_votos_analitico.csv"],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    staged = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--", "artifacts/q3/q3_votos_analitico.csv"],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )

    assert tracked.stdout.strip() == ""
    assert staged.stdout.strip() == ""
