# BDR - Camara dos Deputados

Projeto local para padronizar dados da Camara dos Deputados, carregar o PostgreSQL via Docker e servir um dashboard com backend FastAPI e frontend React/Vite.

## Estrutura

- `src/`: ETL em Python para ler os CSVs, padronizar os dados e gerar os arquivos das questoes.
- `Banco/`: banco PostgreSQL, `docker-compose.yml` e schema inicial.
- `dashboard/backend`: API FastAPI usada pelo dashboard.
- `dashboard/frontend`: interface React/Vite.
- `Caio/gastos-fornecedores/`: Q1, Q5, Q7, Q12, Q13 e analytics do bloco de gastos.
- `Caio/escolaridade-perfil/`: Q4 e Q6.
- `JF/producao-legislativa-temas/`: Q2, Q3 e Q8.
- `JF/partidos-ideologia-votacao/`: Q9, Q10 e Q11.

## Requisitos

- Python 3.11+
- Docker Desktop
- Node.js 20+ e npm
- PowerShell

## Primeira vez no projeto

Na raiz do projeto, crie o ambiente Python e instale as dependencias:

```powershell
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe -m pip install -r dashboard/backend/requirements.txt
```

Instale tambem as dependencias do frontend:

```powershell
cd dashboard\frontend
npm install
cd ..\..
```

## Como subir o dashboard

Use 3 terminais separados.

### Terminal 1: banco de dados

Na raiz do projeto:

```powershell
cd Banco
docker compose up -d
cd ..
```

O banco sobe pela configuracao em `Banco/docker-compose.yml`.

### Terminal 2: backend

Na raiz do projeto:

```powershell


.\venv\Scripts\python.exe -m uvicorn app.main:app --app-dir dashboard/backend --reload --host 0.0.0.0 --port 8000
```

Quando estiver rodando, teste no navegador:

```text
http://localhost:8000/api/health
```

### Terminal 3: frontend

Na raiz do projeto:

```powershell
cd dashboard\frontend
npm run dev -- --host 0.0.0.0 --port 5173
```

Acesse o dashboard em:

```text
http://localhost:5173
```

O frontend envia as chamadas `/api` para o backend em `http://127.0.0.1:8000`.

## Atalho com Makefile

Se preferir usar os atalhos do `Makefile`, rode pela raiz do projeto:

```powershell
make dashboard-install
make dashboard-api
```

Em outro terminal, tambem na raiz:

```powershell
make dashboard-web
```

Para abrir backend e frontend de uma vez em processos separados:

```powershell
make dashboard-dev
```

## Enderecos uteis

- Frontend: `http://localhost:5173`
- Saude da API: `http://localhost:8000/api/health`
- Metadados: `http://localhost:8000/api/meta`

## Problemas comuns

- Se `npm run dev` abrir outra porta, confira se a `5173` ja esta ocupada.
- Se o frontend abrir mas nao carregar dados, confirme se o backend esta rodando na porta `8000`.
- Se o backend reclamar de dependencia ausente, rode novamente:

```powershell
.\venv\Scripts\python.exe -m pip install -r dashboard/backend/requirements.txt
```

- Se o banco nao subir, confirme se o Docker Desktop esta aberto antes de rodar `docker compose up -d`.

## Observacoes

- O dashboard le os arquivos exportados via API, sem consultar o banco direto.
- O `dashboard/backend/app/question_registry.json` e a fonte unica da verdade para os caminhos das questoes.
