\o
CREATE OR REPLACE TEMP VIEW resposta_deputado_categoria_gasto AS
SELECT
    g.ano_dados,
    d.id_deputado,
    d.nome,
    g.descricao_despesa,
    COUNT(*) AS qtd_lancamentos,
    SUM(g.valor_liquido) AS gasto_total
FROM gastos g
JOIN deputados d ON d.id_deputado = g.id_deputado
WHERE g.descricao_despesa IS NOT NULL
GROUP BY g.ano_dados, d.id_deputado, d.nome, g.descricao_despesa;

\o /respostas/q13_categorias_gasto_deputado.txt
\qecho Q13 - categorias de gasto por deputado
\qecho Resumo executivo
SELECT
    ano_dados,
    COUNT(*) AS pares_deputado_categoria,
    COUNT(DISTINCT id_deputado) AS deputados,
    COUNT(DISTINCT descricao_despesa) AS categorias,
    SUM(qtd_lancamentos) AS lancamentos,
    SUM(gasto_total) AS gasto_total
FROM resposta_deputado_categoria_gasto
GROUP BY ano_dados
ORDER BY ano_dados;

\qecho
\qecho Tabela principal - top 30 deputado x categoria por gasto
WITH ranked AS (
    SELECT
        *,
        RANK() OVER (
            PARTITION BY ano_dados
            ORDER BY gasto_total DESC
        ) AS posicao,
        SUM(gasto_total) OVER (PARTITION BY ano_dados) AS total_ano
    FROM resposta_deputado_categoria_gasto
)
SELECT
    ano_dados,
    id_deputado,
    nome,
    descricao_despesa,
    qtd_lancamentos,
    gasto_total,
    ROUND(100.0 * gasto_total / NULLIF(total_ano, 0), 2) AS pct_total
FROM ranked
WHERE posicao <= 30
ORDER BY ano_dados, gasto_total DESC;

\qecho
\qecho Complemento detalhado: q13_categorias_gasto_deputado_complemento.txt contem o ranking completo.

\o /respostas/q13_categorias_gasto_deputado_complemento.txt
\qecho Q13 complemento - ranking completo deputado x categoria de gasto
SELECT
    ano_dados,
    id_deputado,
    nome,
    descricao_despesa,
    qtd_lancamentos,
    gasto_total
FROM resposta_deputado_categoria_gasto
ORDER BY ano_dados, nome, gasto_total DESC;
