#!/usr/bin/env Rscript
# =============================================================================
# smoke_test_wnominate.R
# -----------------------------------------------------------------------------
# Minimal environment smoke test for the W-NOMINATE step.
#
# This test does NOT touch the BDR dataset and does NOT estimate the real model.
# It only confirms that the R environment can:
#   - load the 'wnominate' and 'pscl' packages;
#   - access the functions needed for roll-call modeling
#     (pscl::rollcall and wnominate::wnominate);
#   - build a tiny synthetic rollcall object end-to-end.
#
# It prints a clear SUCCESS message on success, and exits NON-ZERO on any
# failure so it can gate the pipeline.
#
# Usage:
#   Rscript scripts/ideal_points/smoke_test_wnominate.R
# =============================================================================

fail <- function(msg) {
  cat(sprintf("\n[SMOKE TEST FAILED] %s\n", msg))
  quit(status = 1, save = "no")
}

cat("==============================================================\n")
cat("W-NOMINATE SMOKE TEST (no BDR data, synthetic only)\n")
cat("==============================================================\n\n")

# --- 1. Load required packages ---------------------------------------------
cat("[1/4] Loading packages ...\n")
ok_pscl <- suppressPackageStartupMessages(
  requireNamespace("pscl", quietly = TRUE))
if (!ok_pscl) fail("package 'pscl' is not available")
suppressPackageStartupMessages(library(pscl))
cat(sprintf("      pscl      OK (version %s)\n", utils::packageVersion("pscl")))

ok_wnom <- suppressPackageStartupMessages(
  requireNamespace("wnominate", quietly = TRUE))
if (!ok_wnom) fail("package 'wnominate' is not available")
suppressPackageStartupMessages(library(wnominate))
cat(sprintf("      wnominate OK (version %s)\n\n",
            utils::packageVersion("wnominate")))

# --- 2. Confirm required functions exist -----------------------------------
cat("[2/4] Checking required functions ...\n")
if (!exists("rollcall", where = asNamespace("pscl"), inherits = FALSE))
  fail("pscl::rollcall not found")
cat("      pscl::rollcall        available\n")
if (!exists("wnominate", where = asNamespace("wnominate"), inherits = FALSE))
  fail("wnominate::wnominate not found")
cat("      wnominate::wnominate  available\n\n")

# --- 3. Build a tiny synthetic rollcall object ------------------------------
cat("[3/4] Building a synthetic rollcall object ...\n")
set.seed(42)
n_legis <- 20    # synthetic legislators
n_votes <- 30    # synthetic roll calls

# Two clearly separated blocs so the toy problem is well-conditioned.
left  <- matrix(rbinom(n_legis / 2 * n_votes, 1, 0.85),
                nrow = n_legis / 2)
right <- matrix(rbinom(n_legis / 2 * n_votes, 1, 0.15),
                nrow = n_legis / 2)
votes <- rbind(left, right)
rownames(votes) <- paste0("legis", seq_len(n_legis))
colnames(votes) <- paste0("vote", seq_len(n_votes))

rc <- tryCatch(
  pscl::rollcall(votes, yea = 1, nay = 0, missing = NA,
                 legis.names = rownames(votes),
                 vote.names  = colnames(votes)),
  error = function(e) fail(sprintf("rollcall() failed: %s", conditionMessage(e)))
)
cat(sprintf("      rollcall object created: %d legislators x %d votes\n\n",
            rc$n, rc$m))

# --- 4. Run wnominate on the synthetic object -------------------------------
cat("[4/4] Running wnominate on synthetic data (2 anchors) ...\n")
result <- tryCatch(
  suppressWarnings(suppressMessages(
    wnominate::wnominate(rc, dims = 2, polarity = c(1, 1),
                         verbose = FALSE)
  )),
  error = function(e) fail(sprintf("wnominate() failed: %s",
                                   conditionMessage(e)))
)
if (is.null(result) || is.null(result$legislators))
  fail("wnominate() returned no legislator coordinates")
n_coords <- sum(!is.na(result$legislators$coord1D))
cat(sprintf("      wnominate ran; %d legislators received coordinates\n\n",
            n_coords))

cat("==============================================================\n")
cat("SMOKE TEST PASSED: R + pscl + wnominate are working correctly.\n")
cat("Environment is ready to run W-NOMINATE on the BDR matrix.\n")
cat("==============================================================\n")
quit(status = 0, save = "no")
