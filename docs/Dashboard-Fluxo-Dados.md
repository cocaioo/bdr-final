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

Artefatos da Q2 - nuvens de eixos tematicos
```bash
venv/Scripts/python dashboard/scripts/generate_q2_artifacts.py --all
venv/Scripts/python dashboard/scripts/generate_q2_artifacts.py --years 2023,2024
```

O script usa `dados_padronizados/proposicoes.csv` e `dados_padronizados/proposicoes_temas.csv`,
conta proposicoes por `year,eixo` e gera:
- `artifacts/q2/eixos_counts_by_year.csv` e `.json`
- `artifacts/q2/eixos_consolidado.csv` e `.json`
- `artifacts/q2/nuvem_<ano>.png` e `artifacts/q2/nuvem_consolidado.png`

As imagens anuais tambem sao gravadas em `dashboard/frontend/public/wordclouds/` como
`q2_nuvem_palavras_<ano>.png`, que e o caminho publico consumido pelo front-end.
