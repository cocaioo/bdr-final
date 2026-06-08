from __future__ import annotations

import os
from pathlib import Path


APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
DASHBOARD_DIR = BACKEND_DIR.parent
REPO_ROOT = DASHBOARD_DIR.parent

RESPONSES_DIR = Path(
    os.getenv("DASHBOARD_RESPONSES_DIR", str(REPO_ROOT / "respostas"))
).resolve()
SQL_DIR = Path(os.getenv("DASHBOARD_SQL_DIR", str(REPO_ROOT))).resolve()
REGISTRY_PATH = Path(
    os.getenv("DASHBOARD_REGISTRY_PATH", str(APP_DIR / "question_registry.json"))
).resolve()

