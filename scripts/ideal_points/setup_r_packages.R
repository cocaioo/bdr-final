#!/usr/bin/env Rscript
# =============================================================================
# setup_r_packages.R
# -----------------------------------------------------------------------------
# Verify (and install, if missing) the R packages required by the W-NOMINATE
# step of the ideal-point pipeline.
#
# For each package it:
#   - checks whether the package is installed;
#   - installs it from CRAN if missing;
#   - loads it;
#   - prints its installed version.
#
# The script exits with a NON-ZERO status if any package cannot be installed
# or loaded, so it can be used as a gate before running W-NOMINATE.
#
# Usage:
#   Rscript scripts/ideal_points/setup_r_packages.R
# =============================================================================

# Packages required for the roll-call / ideal-point pipeline.
required_packages <- c("wnominate", "pscl", "dplyr", "readr")

# A reliable default CRAN mirror (used only if none is configured).
CRAN_MIRROR <- "https://cloud.r-project.org"

cat("==============================================================\n")
cat("R PACKAGE SETUP - W-NOMINATE ideal-point pipeline\n")
cat("==============================================================\n")
cat(sprintf("R version : %s\n", R.version.string))
cat(sprintf("Platform  : %s\n", R.version$platform))

# ---------------------------------------------------------------------------
# Ensure a WRITABLE library exists.
# ---------------------------------------------------------------------------
# The default system library (e.g. C:/Program Files/R/<ver>/library) is NOT
# writable without administrator rights on Windows. We therefore make sure the
# per-user library exists and is first on the search path, so install.packages()
# always has somewhere it can write. This is the R-recommended behaviour.
user_lib <- Sys.getenv("R_LIBS_USER")
if (nzchar(user_lib)) {
  user_lib <- normalizePath(user_lib, winslash = "/", mustWork = FALSE)
  if (!dir.exists(user_lib)) {
    dir.create(user_lib, recursive = TRUE, showWarnings = FALSE)
    cat(sprintf("[info] created user library: %s\n", user_lib))
  }
  # Put the user library first so installs and loads prefer it.
  .libPaths(c(user_lib, .libPaths()))
}

cat(sprintf("Library   : %s\n", paste(.libPaths(), collapse = "; ")))
cat("--------------------------------------------------------------\n\n")

# Make sure a CRAN mirror is set (non-interactive Rscript has none by default).
repos <- getOption("repos")
if (is.null(repos["CRAN"]) || is.na(repos["CRAN"]) || repos["CRAN"] == "@CRAN@") {
  options(repos = c(CRAN = CRAN_MIRROR))
  cat(sprintf("[info] CRAN mirror set to: %s\n\n", CRAN_MIRROR))
}

# Track outcomes for a clean summary + exit code.
failures <- character(0)
results  <- list()

for (pkg in required_packages) {
  cat(sprintf(">>> Package: %s\n", pkg))

  installed <- requireNamespace(pkg, quietly = TRUE)

  if (!installed) {
    cat(sprintf("    not installed -> installing from CRAN ...\n"))
    install_ok <- tryCatch({
      # Install into the first (writable) library on the path.
      install.packages(pkg, lib = .libPaths()[1], quiet = TRUE)
      requireNamespace(pkg, quietly = TRUE)
    }, error = function(e) {
      cat(sprintf("    [error] install failed: %s\n", conditionMessage(e)))
      FALSE
    })
    if (!isTRUE(install_ok)) {
      cat(sprintf("    [FAIL] could not install '%s'\n\n", pkg))
      failures <- c(failures, pkg)
      results[[pkg]] <- "INSTALL FAILED"
      next
    }
    cat("    installed successfully.\n")
  } else {
    cat("    already installed.\n")
  }

  # Try to load it.
  load_ok <- tryCatch(
    suppressPackageStartupMessages(
      library(pkg, character.only = TRUE, logical.return = TRUE)
    ),
    error = function(e) {
      cat(sprintf("    [error] load failed: %s\n", conditionMessage(e)))
      FALSE
    }
  )

  if (!isTRUE(load_ok)) {
    cat(sprintf("    [FAIL] could not load '%s'\n\n", pkg))
    failures <- c(failures, pkg)
    results[[pkg]] <- "LOAD FAILED"
    next
  }

  ver <- as.character(utils::packageVersion(pkg))
  cat(sprintf("    [OK] loaded '%s' version %s\n\n", pkg, ver))
  results[[pkg]] <- ver
}

# ----------------------------------------------------------------------------
# Summary
# ----------------------------------------------------------------------------
cat("==============================================================\n")
cat("SUMMARY\n")
cat("==============================================================\n")
for (pkg in required_packages) {
  cat(sprintf("  %-12s : %s\n", pkg, results[[pkg]]))
}
cat("--------------------------------------------------------------\n")

if (length(failures) > 0) {
  cat(sprintf("RESULT: FAILED (%d package(s): %s)\n",
              length(failures), paste(failures, collapse = ", ")))
  quit(status = 1, save = "no")
}

cat("RESULT: ALL PACKAGES OK\n")
quit(status = 0, save = "no")
