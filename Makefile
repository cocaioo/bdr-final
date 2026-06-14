PYTHON ?= venv/Scripts/python
COMPOSE ?= docker compose

.PHONY: venv install up down db-reset etl validate export-respostas gastos-analytics gastos-audit-api clean-outputs all dashboard-install dashboard-api dashboard-web dashboard-dev dashboard-test

venv:
	python -m venv venv

install: venv
	$(PYTHON) -m pip install -r requirements.txt

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

db-reset:
	$(COMPOSE) down -v
	$(COMPOSE) up -d

etl:
	$(PYTHON) -m src.main

validate:
	$(COMPOSE) exec -T postgres psql -U admin -d dossie_grupo4 -f /sql/validation_queries.sql

export-respostas:
	powershell -NoProfile -Command "New-Item -ItemType Directory -Force respostas | Out-Null; Remove-Item -Path respostas/*.txt -Force -ErrorAction SilentlyContinue"
	$(PYTHON) -m src.export_respostas

gastos-analytics:
	$(PYTHON) dashboard/scripts/generate_gastos_analytics.py

gastos-audit-api:
	$(PYTHON) dashboard/scripts/audit_gastos_api.py

clean-outputs:
	powershell -NoProfile -Command "Remove-Item -Path dados_padronizados -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item -Path respostas/*.txt -Force -ErrorAction SilentlyContinue"

all: up etl validate export-respostas

dashboard-install:
	$(PYTHON) -m pip install -r dashboard/backend/requirements.txt
	cd dashboard/frontend && npm.cmd install

dashboard-api:
	$(PYTHON) -m uvicorn app.main:app --app-dir dashboard/backend --reload --host 0.0.0.0 --port 8000

dashboard-web:
	cd dashboard/frontend && npm.cmd run dev -- --host 0.0.0.0 --port 5173

dashboard-dev:
	powershell -NoProfile -Command "Start-Process -WindowStyle Hidden -WorkingDirectory '$(CURDIR)' -FilePath 'venv\\Scripts\\python.exe' -ArgumentList '-m','uvicorn','app.main:app','--app-dir','dashboard/backend','--reload','--host','0.0.0.0','--port','8000'; Start-Process -WindowStyle Hidden -WorkingDirectory '$(CURDIR)\\dashboard\\frontend' -FilePath 'npm.cmd' -ArgumentList 'run','dev','--','--host','0.0.0.0','--port','5173'"

dashboard-test:
	cd dashboard/backend && ..\\..\\venv\\Scripts\\python -m pytest
	cd dashboard/frontend && npm.cmd run test
