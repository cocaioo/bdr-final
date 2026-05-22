PYTHON ?= venv/Scripts/python
COMPOSE ?= docker compose

.PHONY: venv install up down db-reset etl validate export-respostas clean-outputs all

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
	$(COMPOSE) exec -T postgres psql -U admin -d dossie_grupo4 -f /sql/export_respostas.sql

clean-outputs:
	powershell -NoProfile -Command "Remove-Item -Path dados_padronizados -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item -Path respostas/*.txt -Force -ErrorAction SilentlyContinue"

all: up etl validate export-respostas
