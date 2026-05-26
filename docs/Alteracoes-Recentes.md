Alteracoes recentes (2026-05-26)

Resumo do que foi ajustado nas respostas, backend e frontend do dashboard.

Respostas (SQL)
- Q1: mantido apenas ranking global (sem recorte por ano) em sql/questoes-queries/q1.sql.
- Q4: escolaridade agregada globalmente (2023-2026) em sql/questoes-queries/q4.sql.
- Q8: influencia legislativa agora global, com resumo e ranking baseados em totais agregados em sql/questoes-queries/q8.sql.
- Q5 e Q12: sanitizacao de fornecedor com REPLACE('|', '/') para evitar quebra do parser.
- Q7, Q12 e Q13: adicionadas colunas sigla_uf e sigla_partido nas tabelas anuais e globais.
- Q5, Q7, Q8, Q12, Q13: blocos de ranking global adicionados (quando aplicavel).

Backend
- Tabelas complementares com titulo contendo "Ranking global" ignoram filtro de anos no backend.
- Filtro de anos nao exibe o valor GLOBAL no catalogo.
- Q1/Q4/Q8 removidos de supported_filters para "anos" no registry.
- Q6 mudou chart_type para bar_vertical no registry.

Frontend
- Tabelas complementares com titulo "Ranking global" usam DataTablePanel, mantendo ordenacao e paginacao.

Exportacao das respostas
- A exportacao foi executada via:
  MSYS_NO_PATHCONV=1 docker compose exec -T postgres psql -U admin -d dossie_grupo4 -f /sql/export_respostas.sql

Observacoes
- O backend possui cache com TTL; pode ser necessario reiniciar o servidor para refletir as novas respostas.
