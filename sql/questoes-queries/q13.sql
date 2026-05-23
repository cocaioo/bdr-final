\o
CREATE OR REPLACE TEMP VIEW resposta_deputado_categoria_gasto AS
SELECT
    d.id_deputado,
    d.nome,
    g.descricao_despesa,
    COUNT(*) AS qtd_lancamentos,
    SUM(g.valor_liquido) AS gasto_total
FROM gastos_2026 g
JOIN deputados d ON d.id_deputado = g.id_deputado
WHERE g.descricao_despesa IS NOT NULL
GROUP BY d.id_deputado, d.nome, g.descricao_despesa;

\o /respostas/q13_categorias_gasto_deputado.txt
\qecho Q13 - categorias de gasto por deputado
\qecho Resumo executivo
SELECT
    COUNT(*) AS pares_deputado_categoria,
    COUNT(DISTINCT id_deputado) AS deputados,
    COUNT(DISTINCT descricao_despesa) AS categorias,
    SUM(qtd_lancamentos) AS lancamentos,
    SUM(gasto_total) AS gasto_total
FROM resposta_deputado_categoria_gasto;

\qecho
\qecho Tabela principal - top 30 deputado x categoria por gasto
SELECT
    id_deputado,
    nome,
    descricao_despesa,
    qtd_lancamentos,
    gasto_total,
    ROUND(100.0 * gasto_total / SUM(gasto_total) OVER (), 2) AS pct_total
FROM resposta_deputado_categoria_gasto
ORDER BY gasto_total DESC
LIMIT 30;

\qecho
\qecho Complemento detalhado: q13_categorias_gasto_deputado_complemento.txt contem o ranking completo.

\o /respostas/q13_categorias_gasto_deputado_complemento.txt
\qecho Q13 complemento - ranking completo deputado x categoria de gasto
SELECT
    id_deputado,
    nome,
    descricao_despesa,
    qtd_lancamentos,
    gasto_total
FROM resposta_deputado_categoria_gasto
ORDER BY nome, gasto_total DESC;
