# BDR - Camara dos Deputados

Projeto local para padronizar dados da Camara dos Deputados, carregar o PostgreSQL via Docker e servir um dashboard com backend FastAPI e frontend React/Vite.

## O que tem aqui

- `src/`: ETL em Python para ler os CSVs, padronizar os dados e gerar as respostas.
- `Banco/` e `docker-compose.yml`: banco PostgreSQL e schema inicial.
- `dashboard/backend`: API FastAPI que entrega os arquivos e metadados do dashboard.
- `dashboard/frontend`: interface React/Vite.

## Requisitos

- Python 3.11+
- Docker Desktop
- Node.js 20+ e npm

## Como rodar

1. Suba o banco, se ele ainda nao estiver no ar: `docker compose up -d`
2. Abra um terminal na raiz do projeto e inicie a API:

```powershell
.\venv\Scripts\python.exe -m uvicorn app.main:app --app-dir dashboard/backend --reload --host 0.0.0.0 --port 8000
```

3. Abra outro terminal em `dashboard/frontend` e inicie o front:

```powershell
npm run dev -- --host 0.0.0.0 --port 5173
```

## Acesso

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000/api/health`
- Metadados: `http://localhost:8000/api/meta`

## Observacoes

- O dashboard le os arquivos exportados via API, sem consultar o banco direto.
- O backend aceita caminhos por membro/pergunta e mantem fallback para `respostas/` quando necessario.
