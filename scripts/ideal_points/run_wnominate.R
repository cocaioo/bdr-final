#!/usr/bin/env Rscript
# =============================================================================
# run_wnominate.R
# -----------------------------------------------------------------------------
# Estimate behavioral ideal points (revealed voting positions) for deputies
# using W-NOMINATE, from the canonical FILTERED roll-call matrix produced by
# prepare_votes_matrix.py.
#
# Orientation of Dimension 1 (left-right axis) is DATA-DRIVEN, not fixed by an
# arbitrary party/deputy anchor:
#   1. W-NOMINATE requires a `polarity` index only to break the sign
#      indeterminacy; any legislator works for that purely technical purpose.
#   2. After estimation, we compute each party's mean Dimension-1 coordinate and
#      correlate it with the external Bolognesi ideology score.
#   3. If that correlation is NEGATIVE, we multiply Dimension 1 by -1 so that
#      HIGHER score = RIGHT, matching the Bolognesi convention.
# This keeps the orientation reproducible and free of arbitrary choices.
#
# Inputs:
#   dados_processados/ideal_points/votes_matrix_filtered.csv   (deputy x rollcall)
#   dados_processados/ideal_points/deputies_metadata.csv       (name, party)
#   dados_padronizados/partidos_ideologia.csv                  (Bolognesi score)
#
# Outputs (written to dados_processados/ideal_points/):
#   raw_ideal_points.csv        - W-NOMINATE output as-estimated (pre-orientation)
#   ideal_points_oriented.csv   - with Dim1 oriented to Bolognesi (final raw scale)
#   wnominate_fit_summary.txt    - model fit summary
#   wnominate_orientation.csv    - party means vs Bolognesi + correlation/flip flag
#
# This script does NOT rescale to 0-10 or compute deputy deviations; that is the
# job of the next step (process_ideal_points.py).
#
# Usage (from repository root):
#   Rscript scripts/ideal_points/run_wnominate.R
# =============================================================================

suppressPackageStartupMessages({
  library(readr)
  library(dplyr)
  library(pscl)
  library(wnominate)
})

# --- Configuration ----------------------------------------------------------
MATRIX_PATH    <- "dados_processados/ideal_points/votes_matrix_filtered.csv"
DEP_META_PATH  <- "dados_processados/ideal_points/deputies_metadata.csv"
IDEOLOGY_PATH  <- "dados_padronizados/partidos_ideologia.csv"
OUTPUT_DIR     <- "dados_processados/ideal_points"
N_DIMS         <- 2
N_TRIALS       <- 1   # minimum accepted by wnominate(); effectively no
                      # meaningful bootstrap (fast first run, no real SEs)

stop_if_missing <- function(path) {
  if (!file.exists(path)) {
    stop(sprintf("Required input not found: %s (run the previous step first).",
                 path), call. = FALSE)
  }
}

cat("==============================================================\n")
cat("W-NOMINATE ideal-point estimation\n")
cat("==============================================================\n")

# --- 1. Load the filtered matrix --------------------------------------------
stop_if_missing(MATRIX_PATH)
stop_if_missing(DEP_META_PATH)
stop_if_missing(IDEOLOGY_PATH)

cat(sprintf("[1] Reading filtered matrix: %s\n", MATRIX_PATH))
mat_df <- read_delim(MATRIX_PATH, delim = ";", show_col_types = FALSE,
                     col_types = cols(.default = col_double(),
                                      deputy_id = col_character()))

deputy_ids <- mat_df$deputy_id
vote_cols  <- setdiff(names(mat_df), "deputy_id")
votes_mat  <- as.matrix(mat_df[, vote_cols])
rownames(votes_mat) <- deputy_ids
cat(sprintf("    matrix: %d deputies x %d roll calls\n",
            nrow(votes_mat), ncol(votes_mat)))

# --- 2. Attach deputy metadata (name, party) --------------------------------
cat(sprintf("[2] Reading deputy metadata: %s\n", DEP_META_PATH))
dep_meta <- read_delim(DEP_META_PATH, delim = ";", show_col_types = FALSE,
                       col_types = cols(.default = col_character()))
# Keep only deputies present in the matrix, in matrix order.
dep_meta <- dep_meta %>%
  mutate(deputy_id = as.character(deputy_id)) %>%
  filter(deputy_id %in% deputy_ids)
dep_meta <- dep_meta[match(deputy_ids, dep_meta$deputy_id), ]
stopifnot(identical(dep_meta$deputy_id, deputy_ids))

legis_data <- data.frame(
  deputy_id = dep_meta$deputy_id,
  name      = dep_meta$name,
  party     = dep_meta$party,
  stringsAsFactors = FALSE,
  row.names = deputy_ids
)

# --- 3. Build the rollcall object -------------------------------------------
cat("[3] Building rollcall object (1 = Yea, 0 = Nay, NA = missing) ...\n")
rc <- rollcall(
  data        = votes_mat,
  yea         = 1,
  nay         = 0,
  missing     = NA,
  legis.names = deputy_ids,
  legis.data  = legis_data,
  vote.names  = vote_cols
)

# --- 4. Run W-NOMINATE ------------------------------------------------------
# polarity is a TECHNICAL sign-breaker only; orientation is fixed later by the
# Bolognesi correlation. We use the first legislator for each dimension.
polarity_idx <- rep(1L, N_DIMS)
cat(sprintf("[4] Running W-NOMINATE: dims = %d, trials = %d ...\n",
            N_DIMS, N_TRIALS))
result <- wnominate(
  rc,
  dims     = N_DIMS,
  polarity = polarity_idx,
  trials   = N_TRIALS,
  verbose  = FALSE
)
cat("    W-NOMINATE finished.\n")

# --- 5. Extract coordinates -------------------------------------------------
coords <- result$legislators
coords$deputy_id <- deputy_ids
coords$name      <- legis_data$name
coords$party     <- legis_data$party

dir.create(OUTPUT_DIR, showWarnings = FALSE, recursive = TRUE)
raw_path <- file.path(OUTPUT_DIR, "raw_ideal_points.csv")
write_excel_csv(coords, raw_path)
cat(sprintf("[5] Raw ideal points written: %s\n", raw_path))

# --- 6. Data-driven orientation against Bolognesi ---------------------------
cat("[6] Orienting Dimension 1 using the Bolognesi ideology benchmark ...\n")
ideo <- read_delim(IDEOLOGY_PATH, delim = ";", show_col_types = FALSE,
                   col_types = cols(.default = col_character())) %>%
  transmute(party = sigla_partido,
            bolognesi_score = as.numeric(ideologia_score))

party_means <- coords %>%
  filter(!is.na(coord1D)) %>%
  group_by(party) %>%
  summarise(mean_dim1 = mean(coord1D, na.rm = TRUE),
            n_deputies = n(), .groups = "drop") %>%
  left_join(ideo, by = "party")

corr <- suppressWarnings(
  cor(party_means$mean_dim1, party_means$bolognesi_score,
      use = "complete.obs"))
flip <- !is.na(corr) && corr < 0

cat(sprintf("    correlation(mean Dim1, Bolognesi) = %.4f\n", corr))
if (flip) {
  cat("    correlation NEGATIVE -> flipping Dimension 1 (x -1) so higher = right.\n")
  coords$coord1D <- -coords$coord1D
  party_means$mean_dim1 <- -party_means$mean_dim1
} else {
  cat("    correlation POSITIVE -> Dimension 1 already oriented (higher = right).\n")
}
corr_oriented <- suppressWarnings(
  cor(party_means$mean_dim1, party_means$bolognesi_score, use = "complete.obs"))

# Save oriented coordinates.
oriented_path <- file.path(OUTPUT_DIR, "ideal_points_oriented.csv")
write_excel_csv(coords, oriented_path)
cat(sprintf("    oriented ideal points written: %s\n", oriented_path))

# Save orientation diagnostics (party means vs benchmark).
party_means <- party_means %>% arrange(mean_dim1)
orient_path <- file.path(OUTPUT_DIR, "wnominate_orientation.csv")
write_excel_csv(party_means, orient_path)
cat(sprintf("    orientation table written: %s\n", orient_path))

# --- 7. Fit summary ---------------------------------------------------------
fit_path <- file.path(OUTPUT_DIR, "wnominate_fit_summary.txt")
sink(fit_path)
cat("W-NOMINATE fit summary\n")
cat("======================\n\n")
cat(sprintf("Deputies (rows)   : %d\n", nrow(votes_mat)))
cat(sprintf("Roll calls (cols) : %d\n", ncol(votes_mat)))
cat(sprintf("Dimensions        : %d\n", N_DIMS))
cat(sprintf("Bootstrap trials  : %d\n", N_TRIALS))
cat(sprintf("Orientation corr (raw)      : %.4f\n", corr))
cat(sprintf("Dimension 1 flipped         : %s\n", ifelse(flip, "YES", "NO")))
cat(sprintf("Orientation corr (oriented) : %.4f\n\n", corr_oriented))
print(summary(result))
sink()
cat(sprintf("[7] Fit summary written: %s\n", fit_path))

# --- 8. Console summary -----------------------------------------------------
cat("\n==============================================================\n")
cat("SUMMARY\n")
cat("==============================================================\n")
cat(sprintf("  Deputies estimated   : %d\n",
            sum(!is.na(coords$coord1D))))
cat(sprintf("  Roll calls used      : %d\n", ncol(votes_mat)))
cat(sprintf("  Dimensions           : %d\n", N_DIMS))
cat(sprintf("  Orientation corr     : %.4f (oriented: %.4f)\n",
            corr, corr_oriented))
cat(sprintf("  Dimension 1 flipped  : %s\n", ifelse(flip, "YES", "NO")))
cat("  Most LEFT parties (low Dim1):\n")
print(utils::head(party_means[, c("party", "mean_dim1", "bolognesi_score")], 3))
cat("  Most RIGHT parties (high Dim1):\n")
print(utils::tail(party_means[, c("party", "mean_dim1", "bolognesi_score")], 3))
cat("--------------------------------------------------------------\n")
cat("Outputs in dados_processados/ideal_points/:\n")
cat("  raw_ideal_points.csv, ideal_points_oriented.csv,\n")
cat("  wnominate_orientation.csv, wnominate_fit_summary.txt\n")
cat("DONE.\n")
