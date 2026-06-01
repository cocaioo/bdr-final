BDR Dashboard - Backend

Visao geral
- FastAPI em `dashboard/backend/app`.
- Gera payloads a partir de arquivos em `respostas/`.
- Usa `question_registry.json` para mapear perguntas, arquivos e tipo de grafico.

Endpoints
- `GET /api/health`
- `GET /api/meta`
- `GET /api/questions/{id}` com filtros, ordenacao e paginacao.

Carregamento de dados
- Le `respostas/*.txt` e interpreta tabelas psql via `parser.py`.
- `service.py` monta `MetaResponse` e `QuestionPayload`.
- `FilterEngine` aplica filtros em `ano_dados`, `sigla_partido`, `sigla_uf`, `id_deputado`, `nome`.
- O filtro de partidos usa `catalogos/partidos.csv` como catalogo canonico e
  expoe por padrao apenas siglas com `status=ativo`.
- A Q1 mantem a coluna `nome`, mas o valor exibido passa a ser o nome civil
  quando disponivel, com fallback para o nome parlamentar.

Cache
- Cache em memoria com TTL de 300s.

Configuracao por env
- `DASHBOARD_RESPONSES_DIR`: diretorio das respostas.
- `DASHBOARD_SQL_DIR`: diretorio dos SQLs (questoes-queries).
- `DASHBOARD_REGISTRY_PATH`: caminho do `question_registry.json`.

Como rodar (somente back)

```bash
venv/Scripts/python -m pip install -r dashboard/backend/requirements.txt
venv/Scripts/python -m uvicorn app.main:app --app-dir dashboard/backend --reload --host 0.0.0.0 --port 8000
```
