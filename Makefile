PYTHON ?= python
VENV ?= .venv
VENV_BIN := $(VENV)/Scripts

.PHONY: venv install up down etl validate

venv:
	$(PYTHON) -m venv $(VENV)

install:
	$(VENV_BIN)/pip install -r requirements.txt

up:
	docker compose up -d

down:
	docker compose down

etl:
	$(VENV_BIN)/python -m src.main

validate:
	psql "postgresql://admin:admin@localhost:5432/dossie_grupo4" -f sql/validation_queries.sql
