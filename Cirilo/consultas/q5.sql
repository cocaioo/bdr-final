-- =============================================================================
-- Q5 - FORNECEDORES ORDENADOS POR VALOR DE CONTRATO
-- Universo: 57ª Legislatura (2023-2027), Cota Parlamentar (CEAP)
--
-- Saída (via /respostas/, copiado pelo export_respostas.py para):
--   Cirilo/q5/q5_fornecedores.txt
--   Cirilo/q5/q5_fornecedores_por_categoria.txt
--   respostas/q5_fornecedores.txt
--   respostas/q5_fornecedores_por_categoria.txt
--
-- Filtros aplicados em todas as queries:
--   cod_legislatura = 57    -> exclui lancamentos da 56a leg. presentes no Ano-2023.csv
--   valor_liquido   > 0     -> exclui estornos e glosas do ranking de gastos efetivos
-- =============================================================================


-- A view 'gastos' baseada na tabela 'despesas' foi removida porque a tabela
-- física 'gastos' criada no init.sql já está padronizada e carregada pelo ETL.


-- =============================================================================
-- SEÇÃO 2 - Q5: FORNECEDORES POR VALOR (57ª LEGISLATURA)
-- =============================================================================

\o /respostas/q5_fornecedores.txt

CREATE OR REPLACE TEMP VIEW resposta_fornecedores AS
SELECT
    g.ano_dados,
    REPLACE(REPLACE(g.fornecedor, '|', '/'), CHR(8211), '-') AS fornecedor,
    COUNT(*)                              AS qtd_lancamentos,
    SUM(g.valor_liquido)                  AS total_pago
FROM gastos g
JOIN deputados d ON d.id_deputado = g.id_deputado
WHERE d.id_legislatura_final = 57
  AND g.fornecedor           IS NOT NULL
  AND g.valor_liquido        > 0
GROUP BY
    g.ano_dados,
    REPLACE(REPLACE(g.fornecedor, '|', '/'), CHR(8211), '-');

\qecho Q5 - fornecedores com maior total pago (57a Legislatura - Cota Parlamentar)
\qecho =============================================================================
\qecho
\qecho Resumo executivo - totais por ano e concentracao no top 30
SELECT
    ano_dados,
    COUNT(*)                            AS fornecedores,
    SUM(qtd_lancamentos)                AS lancamentos,
    ROUND(SUM(total_pago)::NUMERIC, 2)  AS total_pago,
    ROUND(
        100.0 * SUM(total_pago) FILTER (
            WHERE posicao <= 30
        ) / NULLIF(SUM(total_pago), 0),
        2
    )                                   AS pct_top_30
FROM (
    SELECT
        ano_dados,
        fornecedor,
        qtd_lancamentos,
        total_pago,
        RANK() OVER (
            PARTITION BY ano_dados
            ORDER BY total_pago DESC
        ) AS posicao
    FROM resposta_fornecedores
) r
GROUP BY ano_dados
ORDER BY ano_dados;

\qecho
\qecho Tabela principal - top 30 fornecedores por ano (maior total pago)
WITH ranked AS (
    SELECT
        ano_dados,
        fornecedor,
        qtd_lancamentos,
        total_pago,
        RANK() OVER (
            PARTITION BY ano_dados
            ORDER BY total_pago DESC
        )                                           AS posicao,
        SUM(total_pago) OVER (
            PARTITION BY ano_dados
        )                                           AS total_geral
    FROM resposta_fornecedores
)
SELECT
    ano_dados,
    posicao,
    fornecedor,
    qtd_lancamentos,
    ROUND(total_pago::NUMERIC, 2)                   AS total_pago,
    ROUND(
        100.0 * total_pago / NULLIF(total_geral, 0),
        2
    )                                               AS pct_total
FROM ranked
WHERE posicao <= 30
ORDER BY ano_dados, total_pago DESC, fornecedor;

\qecho
\qecho Ranking global - todos os anos da 57a legislatura consolidados
WITH global_totais AS (
    SELECT
        fornecedor,
        SUM(qtd_lancamentos)    AS qtd_lancamentos,
        SUM(total_pago)         AS total_pago
    FROM resposta_fornecedores
    GROUP BY fornecedor
),
ranked AS (
    SELECT
        *,
        RANK() OVER (
            ORDER BY total_pago DESC
        )                       AS posicao,
        SUM(total_pago) OVER () AS total_geral
    FROM global_totais
)
SELECT
    'GLOBAL'                                AS ano_dados,
    posicao,
    fornecedor,
    qtd_lancamentos,
    ROUND(total_pago::NUMERIC, 2)           AS total_pago,
    ROUND(
        100.0 * total_pago / NULLIF(total_geral, 0),
        2
    )                                       AS pct_total
FROM ranked
WHERE posicao <= 30
ORDER BY total_pago DESC, fornecedor;


-- =============================================================================
-- SEÇÃO 3 - Q5 EXTRA: TOP 10 POR CATEGORIA DE GASTO
-- =============================================================================

\o /respostas/q5_fornecedores_complemento.txt
\qecho Q5 complemento - top 5 fornecedores por categoria de gasto e por ano (57a leg.)
WITH por_categoria AS (
    SELECT
        g.ano_dados,
        g.descricao_despesa                     AS categoria,
        REPLACE(REPLACE(g.fornecedor, '|', '/'), CHR(8211), '-') AS fornecedor,
        COUNT(*)                                AS qtd_lancamentos,
        SUM(g.valor_liquido)                    AS total_pago,
        RANK() OVER (
            PARTITION BY g.ano_dados, g.descricao_despesa
            ORDER BY SUM(g.valor_liquido) DESC
        )                                       AS posicao
    FROM gastos g
    JOIN deputados d ON d.id_deputado = g.id_deputado
    WHERE d.id_legislatura_final = 57
      AND g.fornecedor           IS NOT NULL
      AND g.valor_liquido        > 0
    GROUP BY
        g.ano_dados,
        g.descricao_despesa,
        REPLACE(REPLACE(g.fornecedor, '|', '/'), CHR(8211), '-')
)
SELECT
    ano_dados,
    posicao,
    categoria,
    fornecedor,
    qtd_lancamentos,
    ROUND(total_pago::NUMERIC, 2)   AS total_pago
FROM por_categoria
WHERE posicao <= 5
ORDER BY
    ano_dados,
    categoria,
    posicao,
    fornecedor;