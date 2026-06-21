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
cd dashboard/frontend
npm run dev -- --host 0.0.0.0 --port 5173
```

Acesse o dashboard em:

```text
http://localhost:5173
```

