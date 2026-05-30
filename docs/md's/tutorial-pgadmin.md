## 1. Subir o pgAdmin

Em outro terminal, inicie a interface do pgAdmin:

```bash
docker compose -f docker-compose.pgadmin.yml up -d
```

## 3. Abrir a interface

Depois que o container ficar `Up`, acesse:

- http://localhost:5050

## 4. Fazer login

Use as credenciais definidas no compose:

- e-mail: `admin@example.com`
- senha: `admin`

## 5. Registrar o PostgreSQL no pgAdmin

No pgAdmin, adicione um novo servidor com estes dados:

- Nome: qualquer nome, por exemplo `Postgres BDR`
- Host name/address: `host.docker.internal`
- Port: `5434`
- Maintenance database: `dossie_grupo4`
- Username: `admin`
- Password: `admin`

