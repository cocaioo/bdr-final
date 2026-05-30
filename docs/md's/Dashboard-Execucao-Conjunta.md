BDR Dashboard - Execucao conjunta

Pre-requisitos
- Docker Desktop ativo.
- Respostas geradas em `respostas/`.

Passo a passo

1) Subir banco
```bash
docker compose up -d
```

2) Exportar respostas
```bash
MSYS2_ARG_CONV_EXCL='*' docker compose exec -T postgres psql -U admin -d dossie_grupo4 -f /sql/export_respostas.sql
```

3) Subir backend
```bash
venv/Scripts/python -m uvicorn app.main:app --app-dir dashboard/backend --reload --host 0.0.0.0 --port 8000
```

4) Subir frontend
```bash
cd dashboard/frontend
npm.cmd run dev -- --host 0.0.0.0 --port 5173
```

Acesso
- API: http://localhost:8000
- Front: http://localhost:5173

Opcional (se o `make` estiver disponivel)
```bash
make dashboard-dev
```
