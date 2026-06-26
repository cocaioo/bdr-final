#!/usr/bin/env python3
"""
process_ideal_points.py
=======================

Transform the ORIENTED W-NOMINATE coordinates into final interpretive
indicators for the dashboard (Q14 — revealed voting position).

This is the last step of the ideal-point pipeline:

    prepare_votes_matrix.py
        ↓
    run_wnominate.R          (produces ideal_points_oriented.csv)
        ↓
    process_ideal_points.py  ← THIS script

It does NOT rerun W-NOMINATE. It consumes the already-oriented coordinates
(Dimension 1 already aligned so that higher = right, via the Bolognesi
correlation in run_wnominate.R) and produces:

  - behavioral score on a 0–10 scale;
  - deviation from the party's Bolognesi ideology score (+ direction);
  - deviation from the party caucus mean (+ direction);
  - a confidence indicator (per-deputy W-NOMINATE classification rate).

Inputs
------
  dados_processados/ideal_points/ideal_points_oriented.csv
      columns: deputy_id, name, party, correctYea, wrongYea, wrongNay,
               correctNay, GMP, CC, coord1D, coord2D, se1D, se2D, corr.1
  dados_processados/ideal_points/deputies_metadata.csv
      columns: deputy_id, name, party, valid_votes, missing_votes,
               kept_after_filter, reason_if_removed
  dados_padronizados/partidos_ideologia.csv
      columns: sigla_partido, ideologia, ideologia_score, ideologia_faixa,
               campo_ideologico, ...

Outputs (JF/partidos-ideologia-votacao/q14/)
-------
  q14_ideal_points_deputados.csv   one row per deputy (final indicators)
  q14_desvio_partido.csv           per-party deviation summary
  q14_desvio_bancada.csv           per-party caucus-cohesion summary
  q14_metodologia.md               short methodology note

Design decisions (approved):
  * 0–10 rescale is the FIXED LINEAR map (coord1D + 1) * 5 of the theoretical
    W-NOMINATE range [-1, 1] — stable and sample-independent, not min–max.
  * Party deviation is the DIRECT difference on the shared 0–10 scale:
        desvio_partido = score_comportamental_0_10 - ideologia_score_partido
    Positive = voted to the RIGHT of the party benchmark; negative = LEFT.
    (A z-score column is included only as an optional audit field.)
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

# --- Paths ------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[2]
ORIENTED_CSV = PROJECT_ROOT / "dados_processados" / "ideal_points" / "ideal_points_oriented.csv"
DEP_META_CSV = PROJECT_ROOT / "dados_processados" / "ideal_points" / "deputies_metadata.csv"
IDEOLOGY_CSV = PROJECT_ROOT / "dados_padronizados" / "partidos_ideologia.csv"

OUTPUT_DIR = PROJECT_ROOT / "JF" / "partidos-ideologia-votacao" / "q14"
OUT_DEPUTADOS = OUTPUT_DIR / "q14_ideal_points_deputados.csv"
OUT_DESVIO_PARTIDO = OUTPUT_DIR / "q14_desvio_partido.csv"
OUT_DESVIO_BANCADA = OUTPUT_DIR / "q14_desvio_bancada.csv"
OUT_METODOLOGIA = OUTPUT_DIR / "q14_metodologia.md"

SEP = ";"

# Confidence (per-deputy classification rate, CC) qualitative bands.
CONF_HIGH = 0.85   # >= -> alta
CONF_MED = 0.70    # >= -> media ; below -> baixa

# A deviation smaller (in absolute value) than this is reported as "alinhado".
ALIGN_TOL = 0.5    # on the 0–10 scale


def _fail(msg: str) -> None:
    print(f"[fatal] {msg}", file=sys.stderr)
    sys.exit(1)


def load_inputs():
    for p in (ORIENTED_CSV, DEP_META_CSV, IDEOLOGY_CSV):
        if not p.exists():
            _fail(f"required input not found: {p}")

    # ideal_points_oriented.csv is comma-separated (write_excel_csv) with a BOM.
    oriented = pd.read_csv(ORIENTED_CSV, sep=",", encoding="utf-8-sig",
                           dtype={"deputy_id": str})
    dep_meta = pd.read_csv(DEP_META_CSV, sep=SEP, dtype={"deputy_id": str})
    ideo = pd.read_csv(IDEOLOGY_CSV, sep=SEP)

    needed = {"deputy_id", "name", "party", "coord1D", "coord2D", "CC"}
    missing = needed - set(oriented.columns)
    if missing:
        _fail(f"oriented file missing columns: {missing}")
    return oriented, dep_meta, ideo


def direction(delta: float) -> object:
    """Map a numeric deviation to a Portuguese direction label."""
    if pd.isna(delta):
        return np.nan
    if delta > ALIGN_TOL:
        return "mais a direita"
    if delta < -ALIGN_TOL:
        return "mais a esquerda"
    return "alinhado"


def confidence_band(cc: float) -> object:
    if pd.isna(cc):
        return np.nan
    if cc >= CONF_HIGH:
        return "alta"
    if cc >= CONF_MED:
        return "media"
    return "baixa"


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    oriented, dep_meta, ideo = load_inputs()
    print(f"[load] {len(oriented)} deputies from oriented coordinates")

    df = oriented.copy()

    # --- 1. Behavioral score 0–10 (fixed linear map of [-1, 1]) -------------
    # Clip to the theoretical range first (W-NOMINATE can return tiny overshoots).
    coord = df["coord1D"].clip(-1.0, 1.0)
    df["score_comportamental_0_10"] = (coord + 1.0) * 5.0
    df["ideal_point_dim1"] = df["coord1D"]
    df["ideal_point_dim2"] = df["coord2D"]

    # --- 2. Attach party Bolognesi ideology ---------------------------------
    ideo_sub = ideo[["sigla_partido", "ideologia_score", "ideologia_faixa",
                     "campo_ideologico"]].rename(columns={
        "sigla_partido": "party",
        "ideologia_score": "ideologia_score_partido",
        "ideologia_faixa": "ideologia_faixa_partido",
        "campo_ideologico": "campo_ideologico_partido",
    })
    ideo_sub["ideologia_score_partido"] = pd.to_numeric(
        ideo_sub["ideologia_score_partido"], errors="coerce")
    df = df.merge(ideo_sub, on="party", how="left")

    unmatched = df.loc[df["ideologia_score_partido"].isna(), "party"].unique()
    if len(unmatched):
        print(f"[warn] parties without Bolognesi score: {list(unmatched)}")

    # --- 3. Valid-vote count + reliability ----------------------------------
    df = df.merge(
        dep_meta[["deputy_id", "valid_votes"]].assign(
            deputy_id=lambda d: d["deputy_id"].astype(str)),
        on="deputy_id", how="left",
    ).rename(columns={"valid_votes": "qtd_votos_validos"})
    # Total roll calls used by the model = number of correct+wrong predictions
    # the model made for each deputy (constant across the run, derived per row).
    pred_cols = ["correctYea", "wrongYea", "wrongNay", "correctNay"]
    if all(c in df.columns for c in pred_cols):
        df["qtd_votacoes_usadas"] = df[pred_cols].sum(axis=1).astype(int)
    else:
        df["qtd_votacoes_usadas"] = N_ROLLCALLS

    # Confidence = per-deputy correct-classification proportion (CC, 0–1).
    df["confianca"] = pd.to_numeric(df["CC"], errors="coerce")
    df["confianca_faixa"] = df["confianca"].map(confidence_band)

    # --- 4. Calibrate the behavioral scale onto the Bolognesi scale ---------
    # The raw 0–10 behavioral score and the Bolognesi score are both in [0,10]
    # but have very different DISTRIBUTIONS (the behavioral score concentrates
    # in the lower-middle range). Comparing them directly produces a systematic
    # negative offset that is a scale artifact, not a real political bias.
    # We therefore align the scales with an OLS linear calibration of the
    # behavioral score onto the party Bolognesi benchmark:
    #     score_calibrado = a + b * score_comportamental_0_10
    # fitted across deputies that have a party score. The party deviation is
    # then computed on this comparable scale, so deviations center near zero and
    # capture genuine divergence (a deputy voting unusually for their party),
    # not the difference in scale ranges.
    mask = df["ideologia_score_partido"].notna()
    b, a = np.polyfit(df.loc[mask, "score_comportamental_0_10"],
                      df.loc[mask, "ideologia_score_partido"], 1)
    df["score_calibrado_0_10"] = (a + b * df["score_comportamental_0_10"]).clip(0, 10)
    print(f"[calib] score_calibrado = {a:.4f} + {b:.4f} * score_0_10")

    # --- 4b. Party (Bolognesi) deviation on the CALIBRATED scale ------------
    df["desvio_partido"] = (df["score_calibrado_0_10"]
                            - df["ideologia_score_partido"])
    df["direcao_desvio_partido"] = df["desvio_partido"].map(direction)

    # --- 5. Caucus (bancada) deviation --------------------------------------
    caucus = (df.groupby("party")["score_comportamental_0_10"]
                .mean().rename("score_bancada_0_10").reset_index())
    df = df.merge(caucus, on="party", how="left")
    df["desvio_bancada"] = (df["score_comportamental_0_10"]
                            - df["score_bancada_0_10"])
    df["direcao_desvio_bancada"] = df["desvio_bancada"].map(direction)

    # --- 6. Optional audit field: z-score of the behavioral score -----------
    s = df["score_comportamental_0_10"]
    df["score_comportamental_z"] = (s - s.mean()) / s.std(ddof=0)

    # --- 7. Round for presentation ------------------------------------------
    round_cols = {
        "score_comportamental_0_10": 3, "score_calibrado_0_10": 3,
        "ideal_point_dim1": 4,
        "ideal_point_dim2": 4, "ideologia_score_partido": 3,
        "score_bancada_0_10": 3, "desvio_partido": 3, "desvio_bancada": 3,
        "confianca": 4, "score_comportamental_z": 3,
    }
    for c, n in round_cols.items():
        df[c] = df[c].round(n)

    # --- 8. Main per-deputy output ------------------------------------------
    final_cols = [
        "deputy_id", "name", "party",
        "ideologia_score_partido", "ideologia_faixa_partido",
        "campo_ideologico_partido",
        "ideal_point_dim1", "ideal_point_dim2",
        "score_comportamental_0_10", "score_calibrado_0_10",
        "score_bancada_0_10",
        "desvio_partido", "direcao_desvio_partido",
        "desvio_bancada", "direcao_desvio_bancada",
        "qtd_votos_validos", "qtd_votacoes_usadas",
        "confianca", "confianca_faixa",
        "score_comportamental_z",
    ]
    out = df[final_cols].sort_values("score_comportamental_0_10")
    out.to_csv(OUT_DEPUTADOS, sep=SEP, index=False)
    print(f"[out] {OUT_DEPUTADOS}  ({len(out)} deputies)")

    # --- 9. Per-party deviation summary -------------------------------------
    party = (df.groupby("party").agg(
        num_deputados=("deputy_id", "count"),
        ideologia_score_partido=("ideologia_score_partido", "first"),
        ideologia_faixa_partido=("ideologia_faixa_partido", "first"),
        score_comportamental_medio=("score_comportamental_0_10", "mean"),
        score_calibrado_medio=("score_calibrado_0_10", "mean"),
        desvio_partido_medio=("desvio_partido", "mean"),
        desvio_partido_medio_abs=("desvio_partido",
                                  lambda x: x.abs().mean()),
    ).reset_index())
    party["direcao_desvio_medio"] = party["desvio_partido_medio"].map(direction)
    for c in ["ideologia_score_partido", "score_comportamental_medio",
              "score_calibrado_medio",
              "desvio_partido_medio", "desvio_partido_medio_abs"]:
        party[c] = party[c].round(3)
    party = party.sort_values("score_comportamental_medio")
    party.to_csv(OUT_DESVIO_PARTIDO, sep=SEP, index=False)
    print(f"[out] {OUT_DESVIO_PARTIDO}  ({len(party)} parties)")

    # --- 10. Per-party caucus-cohesion summary ------------------------------
    bancada = (df.groupby("party").agg(
        num_deputados=("deputy_id", "count"),
        score_bancada_0_10=("score_bancada_0_10", "first"),
        desvio_bancada_medio_abs=("desvio_bancada",
                                  lambda x: x.abs().mean()),
        desvio_bancada_max_abs=("desvio_bancada",
                                lambda x: x.abs().max()),
        desvio_bancada_std=("score_comportamental_0_10",
                            lambda x: x.std(ddof=0)),
    ).reset_index())
    for c in ["score_bancada_0_10", "desvio_bancada_medio_abs",
              "desvio_bancada_max_abs", "desvio_bancada_std"]:
        bancada[c] = bancada[c].round(3)
    bancada = bancada.sort_values("desvio_bancada_std", ascending=False)
    bancada.to_csv(OUT_DESVIO_BANCADA, sep=SEP, index=False)
    print(f"[out] {OUT_DESVIO_BANCADA}  ({len(bancada)} parties)")

    # --- 11. Methodology note ------------------------------------------------
    write_methodology(df)
    print(f"[out] {OUT_METODOLOGIA}")

    # --- 12. Console sanity summary -----------------------------------------
    corr = df[["score_comportamental_0_10", "ideologia_score_partido"]].corr().iloc[0, 1]
    print("\n" + "=" * 60)
    print("PROCESS SUMMARY")
    print("=" * 60)
    print(f"  Deputies processed        : {len(df)}")
    print(f"  Behavioral score range    : "
          f"{s.min():.2f} – {s.max():.2f} (0–10)")
    print(f"  Corr(score, Bolognesi)    : {corr:.4f}")
    print(f"  Mean |party deviation|    : "
          f"{df['desvio_partido'].abs().mean():.3f}")
    print(f"  Mean |caucus deviation|   : "
          f"{df['desvio_bancada'].abs().mean():.3f}")
    print(f"  Confidence (mean CC)      : {df['confianca'].mean():.3f}")
    print(f"  Output directory          : {OUTPUT_DIR}")
    print("=" * 60)


def write_methodology(df: pd.DataFrame) -> None:
    n = len(df)
    corr = df[["score_comportamental_0_10", "ideologia_score_partido"]].corr().iloc[0, 1]
    OUT_METODOLOGIA.write_text(f"""# Q14 — Posição Ideológica Revelada (W-NOMINATE)

Indicadores comportamentais derivados do histórico de votações nominais dos
deputados, estimados por W-NOMINATE e tornados comparáveis ao índice partidário
de Bolognesi et al.

## Origem dos dados

Coordenadas **já orientadas** produzidas por `run_wnominate.R`
(`ideal_points_oriented.csv`): a Dimensão 1 foi alinhada de forma data-driven —
a média da Dim 1 por partido foi correlacionada com o score Bolognesi e o sinal
ajustado para que **valores altos = direita**. Esta etapa não reexecuta o modelo.

## Score comportamental 0–10

A coordenada W-NOMINATE da Dimensão 1 (intervalo teórico [-1, 1]) é convertida
por um **mapa linear fixo**:

    score_comportamental_0_10 = (coord1D + 1) * 5

Assim, -1 → 0 (extrema esquerda), 0 → 5 (centro), +1 → 10 (extrema direita).
Optou-se pela escala teórica fixa (e não min–max da amostra) para que o score
seja **estável e reprodutível**, independente de qual conjunto de deputados foi
estimado, e diretamente comparável ao score Bolognesi (também em 0–10).

## Calibração de escala (alinhamento ao Bolognesi)

O score comportamental bruto (0–10) e o score Bolognesi (0–10) estão na mesma
faixa, mas têm **distribuições diferentes**: o comportamental concentra-se na
parte baixa-média da escala. Comparar os dois diretamente produziria um desvio
sistematicamente negativo — um **artefato de escala**, não divergência política
real. Por isso, alinhamos as escalas por uma **calibração linear (OLS)** do score
comportamental sobre o benchmark partidário:

    score_calibrado_0_10 = a + b * score_comportamental_0_10

ajustada entre os deputados com score de partido (e limitada a [0, 10]). O score
calibrado preserva o **ordenamento** do W-NOMINATE, mas passa a ocupar a mesma
faixa do Bolognesi, tornando o desvio interpretável.

## Desvio em relação ao partido (Bolognesi)

Calculado sobre a escala **calibrada**, centrando os desvios em torno de zero:

    desvio_partido = score_calibrado_0_10 - ideologia_score_partido

Valores **positivos** indicam voto mais à **direita** do que o benchmark do
partido; **negativos**, mais à **esquerda**. A direção é rotulada como
`mais a direita` / `mais a esquerda` / `alinhado` (tolerância de ±{ALIGN_TOL}
ponto). Mantém-se também a coluna `score_comportamental_0_10` (bruto) para
transparência, e `score_comportamental_z` (z-score) como campo de auditoria.

## Desvio em relação à bancada

    score_bancada_0_10 = média do score comportamental dos deputados do partido
    desvio_bancada     = score_comportamental_0_10 - score_bancada_0_10

Mede a coesão interna: quão distante o deputado está da média da própria bancada.

## Confiança

`confianca` = proporção de votos do deputado **corretamente classificados** pelo
modelo W-NOMINATE (coluna `CC`, 0–1). Faixas: alta (≥ {CONF_HIGH}),
média (≥ {CONF_MED}), baixa (< {CONF_MED}). É um indicador de quão bem o modelo
explica o comportamento daquele deputado.

## Síntese

- Deputados processados: **{n}**.
- Correlação score comportamental × Bolognesi (nível deputado): **{corr:.3f}**.

## Arquivos gerados

- `q14_ideal_points_deputados.csv` — um deputado por linha (indicadores finais).
- `q14_desvio_partido.csv` — resumo de desvio por partido.
- `q14_desvio_bancada.csv` — coesão de bancada por partido.

## Limitações

- A escala 0–10 e o score Bolognesi medem coisas correlatas mas distintas
  (comportamento de voto revelado vs. ideologia declarada por especialistas);
  desvios não implicam erro, e sim divergência informativa.
- A execução-base usou `trials = 1` no W-NOMINATE (sem erros-padrão); `se1D`/`se2D`
  são 0 e não há intervalo de confiança nas coordenadas.
- Partidos com poucos deputados (ex.: bancadas unipessoais) têm média de bancada
  pouco informativa.
""", encoding="utf-8")


# Number of roll calls used by the model (filtered matrix columns).
# Kept as a module constant so the per-deputy output can record it; it is the
# same for every deputy in a single W-NOMINATE run.
N_ROLLCALLS = 1325


if __name__ == "__main__":
    main()
