# Ideal-Point Pipeline — Vote Matrix Preparation

This directory holds the pipeline that estimates **behavioral ideal points**
(revealed voting positions) for deputies from nominal roll-call votes.

This step (`prepare_votes_matrix.py`) **only builds, validates and documents the
canonical roll-call vote matrix**. It does **not** run W-NOMINATE and contains
**no R-specific transformations**. The matrix produced here is the official input
for every future ideal-point estimation.

## Purpose

Convert the standardized long-format vote dataset into a clean, validated
deputy × roll-call matrix suitable for spatial voting models (W-NOMINATE),
while preserving full metadata and keeping the unfiltered matrix available.

## Inputs

| File | Description |
|------|-------------|
| `dados_padronizados/votacoes_votos.csv` | Long-format votes: one row per (deputy, roll call). Columns: `ano_dados;id_votacao;id_deputado;voto;nome_deputado;sigla_partido;sigla_uf` (separator `;`). |
| `dados_padronizados/votacoes.csv` | Roll-call metadata, used to attach the `date` of each roll call. |

### Vote encoding

Only `Sim` and `Nao` are valid behavioral votes. Everything else
(`Obstrucao`, `Abstencao`, `Artigo 17`, …) becomes missing (NA).

```
Sim  -> 1
Nao  -> 0
else -> NA
```

No other value is ever written into the matrix.

## Outputs

Written to `dados_processados/ideal_points/`:

| File | Description |
|------|-------------|
| `votes_matrix.csv` | **Canonical, unfiltered** matrix: every deputy × every roll call. Rows = deputies, columns = roll calls, cells ∈ {1, 0, NA}. |
| `votes_matrix_filtered.csv` | Filtered matrix: only retained deputies × retained roll calls. |
| `votes_metadata.csv` | One row per roll call: `vote_id, year, date, valid_votes, yes_votes, no_votes, yes_percentage, no_percentage, missing_votes, kept_after_filter, reason_if_removed`. |
| `deputies_metadata.csv` | One row per deputy: `deputy_id, name, party, valid_votes, missing_votes, kept_after_filter, reason_if_removed`. |
| `summary_statistics.csv` | Dimensions, sparsity, NA %, averages and the distribution of valid votes. |

Excluded observations are **marked, never deleted** — the unfiltered matrix always
remains available, and the metadata records the removal reason for each row/column.

## Filtering

All thresholds live in `config.py` (no magic numbers in the code):

| Constant | Meaning |
|----------|---------|
| `MIN_VALID_VOTES_PER_ROLLCALL` | Minimum valid (Sim/Nao) votes for a roll call to be kept. |
| `MAX_UNANIMITY_RATE` | A roll call whose majority side ≥ this fraction is "nearly unanimous" and removed. |
| `MIN_VALID_VOTES_PER_DEPUTY` | Minimum valid votes (over **retained** roll calls) for a deputy to be kept. |

## Validation

The script runs consistency checks and **aborts** if any fail:

- every row corresponds to exactly one deputy, every column to one roll call;
- every cell is `1`, `0`, or `NA`;
- valid-cell counts equal the metadata totals (and the source totals);
- no duplicated deputies or roll calls.

## Folder structure

```
scripts/ideal_points/
├── config.py                 # all paths + thresholds (single source of truth)
├── prepare_votes_matrix.py   # THIS step: build/validate/document the matrix
├── run_wnominate.R           # FUTURE: runs W-NOMINATE (not part of this step)
├── process_ideal_points.py   # FUTURE: post-process / rescale raw ideal points
└── README.md

dados_processados/ideal_points/   # generated outputs (see table above)
```

## Future execution order

```
prepare_votes_matrix.py        (this step — produces votes_matrix*.csv)
        ↓
run_wnominate.R                (NOT YET — estimates raw ideal points in R)
        ↓
process_ideal_points.py        (NOT YET — rescales / calibrates results)
```

## How to run this step

From the repository root:

```bash
python scripts/ideal_points/prepare_votes_matrix.py
```

Requires `pandas` and `numpy`. To change the canonical input, edit the
constants in `config.py` and re-run — do not hardcode values elsewhere.
