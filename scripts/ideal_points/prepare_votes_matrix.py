#!/usr/bin/env python3
"""
prepare_votes_matrix.py
=======================

Build, validate and document the CANONICAL roll-call vote matrix that will later
be consumed by W-NOMINATE (in R). This step does NOT run W-NOMINATE and does NOT
perform any transformation specific to the R package: the output is kept as
generic as possible.

Pipeline position
------------------
    prepare_votes_matrix.py   <-- this script
        |
        v
    run_wnominate.R
        |
        v
    process_ideal_points.py

What this script does
---------------------
1. Loads the standardized vote dataset (dados_padronizados/votacoes_votos.csv).
2. Encodes votes: Sim -> 1, Nao -> 0, everything else -> NA. No other values.
3. Computes roll-call and deputy statistics.
4. Applies adequacy filters using the constants in config.py:
     - roll calls with low participation are removed
     - nearly unanimous roll calls are removed
     - deputies with too few valid votes are removed
   Excluded observations are MARKED (kept_after_filter / reason_if_removed),
   never silently deleted.
5. Writes two matrices:
     - votes_matrix.csv            (full, unfiltered: every deputy x every roll call)
     - votes_matrix_filtered.csv   (only retained deputies x retained roll calls)
6. Writes per-roll-call and per-deputy metadata.
7. Runs consistency checks and ABORTS if any inconsistency is found.
8. Computes and stores summary statistics.

All paths and thresholds come from config.py — no magic numbers live here.
"""

from __future__ import annotations

import sys

import numpy as np
import pandas as pd

import config


# ---------------------------------------------------------------------------
# Helper / failure handling
# ---------------------------------------------------------------------------
class ValidationError(Exception):
    """Raised when an internal consistency check fails."""


def _check(condition: bool, message: str, results: list[tuple[str, bool]]) -> None:
    """Record a validation result and remember whether it passed."""
    results.append((message, bool(condition)))


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------
def load_votes() -> pd.DataFrame:
    print(f"[load] Reading votes from: {config.INPUT_VOTES_CSV}")
    df = pd.read_csv(config.INPUT_VOTES_CSV, sep=config.CSV_SEPARATOR, dtype=str)
    expected = {"ano_dados", "id_votacao", "id_deputado", "voto",
                "nome_deputado", "sigla_partido"}
    missing = expected - set(df.columns)
    if missing:
        print(f"[fatal] Input is missing expected columns: {missing}", file=sys.stderr)
        sys.exit(1)

    # Encode votes. Anything not in VOTE_VALUE_MAP becomes NA.
    df["vote_val"] = df["voto"].map(config.VOTE_VALUE_MAP).astype("Float64")
    df["year"] = df["ano_dados"]
    print(f"[load] {len(df):,} vote records | "
          f"{df['id_deputado'].nunique():,} deputies | "
          f"{df['id_votacao'].nunique():,} roll calls")
    return df


def load_rollcall_dates() -> pd.DataFrame:
    """Load roll-call level metadata (date) to enrich votes_metadata."""
    try:
        v = pd.read_csv(config.INPUT_VOTACOES_CSV, sep=config.CSV_SEPARATOR, dtype=str)
    except FileNotFoundError:
        print("[warn] votacoes.csv not found; 'date' will be left empty.")
        return pd.DataFrame(columns=["id_votacao", "date"])
    cols = {"id_votacao"}
    if "data_votacao" in v.columns:
        out = v[["id_votacao", "data_votacao"]].drop_duplicates("id_votacao")
        out = out.rename(columns={"data_votacao": "date"})
        return out
    return pd.DataFrame(columns=["id_votacao", "date"])


# ---------------------------------------------------------------------------
# Statistics + filtering
# ---------------------------------------------------------------------------
def build_rollcall_metadata(df: pd.DataFrame, dates: pd.DataFrame) -> pd.DataFrame:
    """One row per roll call, with vote counts, percentages and filter decision."""
    g = df.groupby("id_votacao")
    meta = pd.DataFrame({
        "year": g["year"].first(),
        "yes_votes": g["vote_val"].apply(lambda s: int((s == 1).sum())),
        "no_votes": g["vote_val"].apply(lambda s: int((s == 0).sum())),
        "missing_votes": g["vote_val"].apply(lambda s: int(s.isna().sum())),
    })
    meta["valid_votes"] = meta["yes_votes"] + meta["no_votes"]
    meta["yes_percentage"] = np.where(
        meta["valid_votes"] > 0, meta["yes_votes"] / meta["valid_votes"], np.nan)
    meta["no_percentage"] = np.where(
        meta["valid_votes"] > 0, meta["no_votes"] / meta["valid_votes"], np.nan)

    # Filter decisions
    low_participation = meta["valid_votes"] < config.MIN_VALID_VOTES_PER_ROLLCALL
    majority_rate = meta[["yes_percentage", "no_percentage"]].max(axis=1)
    nearly_unanimous = majority_rate >= config.MAX_UNANIMITY_RATE

    reason = pd.Series("", index=meta.index, dtype=object)
    reason[low_participation] = (
        f"low_participation (<{config.MIN_VALID_VOTES_PER_ROLLCALL} valid votes)")
    # nearly-unanimous reason only matters for roll calls that passed participation
    nu_only = nearly_unanimous & ~low_participation
    reason[nu_only] = (
        f"nearly_unanimous (majority >= {config.MAX_UNANIMITY_RATE:.0%})")

    meta["kept_after_filter"] = ~(low_participation | nearly_unanimous)
    meta["reason_if_removed"] = reason

    meta = meta.reset_index().rename(columns={"id_votacao": "vote_id"})
    meta = meta.merge(dates.rename(columns={"id_votacao": "vote_id"}),
                      on="vote_id", how="left")
    if "date" not in meta.columns:
        meta["date"] = ""
    meta["date"] = meta["date"].fillna("")

    return meta[[
        "vote_id", "year", "date", "valid_votes", "yes_votes", "no_votes",
        "yes_percentage", "no_percentage", "missing_votes",
        "kept_after_filter", "reason_if_removed",
    ]]


def build_deputy_metadata(df: pd.DataFrame, kept_rollcalls: set) -> pd.DataFrame:
    """One row per deputy. valid_votes are counted over RETAINED roll calls."""
    # latest party / name (by year) for a stable label
    df_sorted = df.sort_values("year")
    latest = df_sorted.groupby("id_deputado").last()[["nome_deputado", "sigla_partido"]]

    in_kept = df["id_votacao"].isin(kept_rollcalls)
    g_all = df.groupby("id_deputado")["vote_val"]
    # valid votes restricted to retained roll calls (this drives the deputy filter)
    valid_kept = (
        df[in_kept].groupby("id_deputado")["vote_val"]
        .apply(lambda s: int(s.notna().sum()))
    )

    meta = pd.DataFrame(index=latest.index)
    meta["name"] = latest["nome_deputado"]
    meta["party"] = latest["sigla_partido"]
    meta["valid_votes"] = valid_kept.reindex(meta.index).fillna(0).astype(int)
    meta["missing_votes"] = g_all.apply(lambda s: int(s.isna().sum())).reindex(meta.index).fillna(0).astype(int)

    keep = meta["valid_votes"] >= config.MIN_VALID_VOTES_PER_DEPUTY
    meta["kept_after_filter"] = keep
    meta["reason_if_removed"] = np.where(
        keep, "",
        f"too_few_valid_votes (<{config.MIN_VALID_VOTES_PER_DEPUTY} over retained roll calls)")

    meta = meta.reset_index().rename(columns={"id_deputado": "deputy_id"})
    return meta[[
        "deputy_id", "name", "party", "valid_votes", "missing_votes",
        "kept_after_filter", "reason_if_removed",
    ]]


# ---------------------------------------------------------------------------
# Matrix construction
# ---------------------------------------------------------------------------
def build_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """Deputy (rows) x roll call (columns) matrix of encoded votes (1/0/NA)."""
    matrix = df.pivot_table(
        index="id_deputado", columns="id_votacao",
        values="vote_val", aggfunc="first",
    )
    matrix.index.name = "deputy_id"
    matrix.columns.name = "vote_id"
    return matrix


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def validate(matrix: pd.DataFrame,
             votes_meta: pd.DataFrame,
             dep_meta: pd.DataFrame,
             df: pd.DataFrame) -> None:
    print("\n" + "=" * 70)
    print("VALIDATION")
    print("=" * 70)
    results: list[tuple[str, bool]] = []

    # 1. No duplicate deputies / roll calls
    _check(matrix.index.is_unique, "No duplicated deputies (rows)", results)
    _check(matrix.columns.is_unique, "No duplicated roll calls (columns)", results)

    # 2. Each row == one deputy, each col == one roll call (counts match metadata)
    _check(len(matrix.index) == len(dep_meta),
           "Every matrix row corresponds to exactly one deputy", results)
    _check(len(matrix.columns) == len(votes_meta),
           "Every matrix column corresponds to exactly one roll call", results)
    _check(set(matrix.index.astype(str)) == set(dep_meta["deputy_id"].astype(str)),
           "Matrix deputies match deputy metadata exactly", results)
    _check(set(matrix.columns.astype(str)) == set(votes_meta["vote_id"].astype(str)),
           "Matrix roll calls match roll-call metadata exactly", results)

    # 3. Every value belongs to {1, 0, NA}
    flat = matrix.to_numpy().ravel()
    non_na = flat[~pd.isna(flat)]
    only_binary = np.isin(non_na, [0, 1]).all()
    _check(bool(only_binary), "Every cell is 1, 0 or NA", results)

    # 4. Valid cells equal metadata totals
    valid_cells = int(np.isin(non_na, [0, 1]).sum())
    meta_total_valid = int(votes_meta["valid_votes"].sum())
    source_valid = int(df["vote_val"].notna().sum())
    _check(valid_cells == meta_total_valid,
           f"Valid cells ({valid_cells:,}) == roll-call metadata valid_votes "
           f"({meta_total_valid:,})", results)
    _check(valid_cells == source_valid,
           f"Valid cells ({valid_cells:,}) == source valid votes "
           f"({source_valid:,})", results)

    # 5. yes+no counts reconcile
    _check(int(votes_meta["yes_votes"].sum()) == int((non_na == 1).sum()),
           "Sum of yes_votes matches number of 1-cells", results)
    _check(int(votes_meta["no_votes"].sum()) == int((non_na == 0).sum()),
           "Sum of no_votes matches number of 0-cells", results)

    failed = 0
    for message, ok in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {message}")
        if not ok:
            failed += 1

    print("-" * 70)
    if failed:
        print(f"VALIDATION FAILED: {failed} inconsistency(ies) found. Aborting.")
        raise ValidationError(f"{failed} validation check(s) failed")
    print(f"VALIDATION PASSED: all {len(results)} checks OK.")


# ---------------------------------------------------------------------------
# Summary statistics
# ---------------------------------------------------------------------------
def summary_statistics(matrix: pd.DataFrame,
                       matrix_filtered: pd.DataFrame,
                       dep_meta: pd.DataFrame,
                       votes_meta: pd.DataFrame) -> pd.DataFrame:
    total_cells = matrix.size
    na_cells = int(matrix.isna().to_numpy().sum())
    valid_cells = total_cells - na_cells
    na_pct = na_cells / total_cells if total_cells else float("nan")
    sparsity = na_pct  # fraction of empty (NA) cells

    votes_per_deputy = matrix.notna().sum(axis=1)
    deputies_per_rollcall = matrix.notna().sum(axis=0)

    stats = {
        "n_deputies_total": matrix.shape[0],
        "n_rollcalls_total": matrix.shape[1],
        "matrix_rows": matrix.shape[0],
        "matrix_cols": matrix.shape[1],
        "n_deputies_retained": int(dep_meta["kept_after_filter"].sum()),
        "n_deputies_removed": int((~dep_meta["kept_after_filter"]).sum()),
        "n_rollcalls_retained": int(votes_meta["kept_after_filter"].sum()),
        "n_rollcalls_removed": int((~votes_meta["kept_after_filter"]).sum()),
        "filtered_matrix_rows": matrix_filtered.shape[0],
        "filtered_matrix_cols": matrix_filtered.shape[1],
        "valid_cells": valid_cells,
        "na_cells": na_cells,
        "na_percentage": round(na_pct * 100, 4),
        "matrix_sparsity": round(sparsity, 6),
        "avg_valid_votes_per_deputy": round(float(votes_per_deputy.mean()), 4),
        "median_valid_votes_per_deputy": float(votes_per_deputy.median()),
        "min_valid_votes_per_deputy": int(votes_per_deputy.min()),
        "max_valid_votes_per_deputy": int(votes_per_deputy.max()),
        "avg_deputies_per_rollcall": round(float(deputies_per_rollcall.mean()), 4),
        "median_deputies_per_rollcall": float(deputies_per_rollcall.median()),
        "min_deputies_per_rollcall": int(deputies_per_rollcall.min()),
        "max_deputies_per_rollcall": int(deputies_per_rollcall.max()),
    }
    # Format values as clean strings (integers without trailing .0) so the
    # mixed-type column does not get coerced back to float on write.
    def _fmt(v):
        if isinstance(v, float) and v.is_integer():
            return str(int(v))
        return str(v)

    rows = [(k, _fmt(v)) for k, v in stats.items()]
    return pd.DataFrame(rows, columns=["statistic", "value"])


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    df = load_votes()
    dates = load_rollcall_dates()

    # --- metadata + filter decisions ---
    votes_meta = build_rollcall_metadata(df, dates)
    kept_rollcalls = set(votes_meta.loc[votes_meta["kept_after_filter"], "vote_id"])
    dep_meta = build_deputy_metadata(df, kept_rollcalls)
    kept_deputies = set(dep_meta.loc[dep_meta["kept_after_filter"], "deputy_id"])

    print("\n--- Filtering ---")
    print(f"Roll calls: {len(votes_meta):,} total | "
          f"{len(kept_rollcalls):,} retained | "
          f"{len(votes_meta) - len(kept_rollcalls):,} removed")
    print(f"Deputies:   {len(dep_meta):,} total | "
          f"{len(kept_deputies):,} retained | "
          f"{len(dep_meta) - len(kept_deputies):,} removed")

    # --- full (unfiltered) matrix ---
    matrix = build_matrix(df)
    # align metadata ordering to the full matrix for clean validation
    dep_meta = dep_meta.set_index("deputy_id").reindex(matrix.index.astype(str)).reset_index()
    votes_meta = votes_meta.set_index("vote_id").reindex(matrix.columns.astype(str)).reset_index()

    # --- validate the canonical (full) matrix ---
    validate(matrix, votes_meta, dep_meta, df)

    # --- filtered matrix (retained deputies x retained roll calls) ---
    keep_rows = matrix.index.astype(str).isin(kept_deputies)
    keep_cols = matrix.columns.astype(str).isin(kept_rollcalls)
    matrix_filtered = matrix.loc[keep_rows, keep_cols]

    # --- write outputs ---
    matrix.to_csv(config.OUTPUT_MATRIX_CSV, sep=config.CSV_SEPARATOR,
                  na_rep=config.NA_REPRESENTATION)
    matrix_filtered.to_csv(config.OUTPUT_MATRIX_FILTERED_CSV, sep=config.CSV_SEPARATOR,
                           na_rep=config.NA_REPRESENTATION)
    votes_meta.to_csv(config.OUTPUT_VOTES_METADATA_CSV, sep=config.CSV_SEPARATOR, index=False)
    dep_meta.to_csv(config.OUTPUT_DEPUTIES_METADATA_CSV, sep=config.CSV_SEPARATOR, index=False)

    stats = summary_statistics(matrix, matrix_filtered, dep_meta, votes_meta)
    stats.to_csv(config.OUTPUT_SUMMARY_STATS_CSV, sep=config.CSV_SEPARATOR, index=False)

    print("\n--- Outputs written ---")
    for p in (config.OUTPUT_MATRIX_CSV, config.OUTPUT_MATRIX_FILTERED_CSV,
              config.OUTPUT_VOTES_METADATA_CSV, config.OUTPUT_DEPUTIES_METADATA_CSV,
              config.OUTPUT_SUMMARY_STATS_CSV):
        print(f"  {p}")

    # --- distribution of valid votes (printed) ---
    vpd = matrix.notna().sum(axis=1)
    print("\nDistribution of valid votes per deputy (quantiles):")
    print(vpd.describe(percentiles=[.1, .25, .5, .75, .9]).to_string())

    # ------------------------------------------------------------------
    # Final terminal summary
    # ------------------------------------------------------------------
    sd = {k: (int(v) if isinstance(v, (int, float)) and float(v).is_integer() else v)
          for k, v in zip(stats["statistic"], stats["value"])}
    print("\n" + "=" * 70)
    print("FINAL SUMMARY")
    print("=" * 70)
    print(f"  Matrix dimensions          : {sd['matrix_rows']} deputies x {sd['matrix_cols']} roll calls")
    print(f"  Filtered matrix dimensions : {sd['filtered_matrix_rows']} deputies x {sd['filtered_matrix_cols']} roll calls")
    print(f"  Deputies retained          : {sd['n_deputies_retained']}")
    print(f"  Deputies removed           : {sd['n_deputies_removed']}")
    print(f"  Roll calls retained        : {sd['n_rollcalls_retained']}")
    print(f"  Roll calls removed         : {sd['n_rollcalls_removed']}")
    print(f"  Matrix sparsity (NA frac)  : {sd['matrix_sparsity']}  ({sd['na_percentage']}% NA)")
    print(f"  Output directory           : {config.OUTPUT_DIR}")
    print(f"  Report path                : docs/metodologia/ideologia-partidaria/"
          f"RELATORIO_MATRIZ_VOTACAO_WNOMINATE.md")
    print("=" * 70)


if __name__ == "__main__":
    main()
