BDR Dashboard - Fluxo de dados

Visao geral
1) CSVs brutos ficam em `tabelas/`.
2) ETL em `src/main.py` padroniza e grava em `dados_padronizados/`.
3) ETL carrega o PostgreSQL no schema `grupo4` definido em `init.sql`.
4) `sql/export_respostas.sql` gera `respostas/*.txt` a partir das queries Q1-Q13.
5) Backend le `respostas/` e monta payloads via `parser.py` e `adapters`.
6) Frontend consome `GET /api/meta` e `GET /api/questions/{id}`.

Onde o backend busca os dados
- `respostas/`: fonte principal das tabelas exibidas.
- `sql/questoes-queries/`: texto SQL exibido no painel e usado no hash da versao.
- `question_registry.json`: define quais arquivos e o tipo de grafico de cada Q.

Versao do dataset
- Calculada em `service.py` com hash dos arquivos em `respostas/` e dos SQLs.

Como atualizar dados
```bash
venv/Scripts/python -m src.main
MSYS2_ARG_CONV_EXCL='*' docker compose exec -T postgres psql -U admin -d dossie_grupo4 -f /sql/export_respostas.sql
```
