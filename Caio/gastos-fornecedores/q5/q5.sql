-- =============================================================================
-- Q5 - FORNECEDORES ORDENADOS POR VALOR DE CONTRATO
-- Universo: 57a legislatura (2023-2027), Cota Parlamentar (CEAP)
--
-- Regras metodologicas:
--   - usa apenas gasto efetivo (valor_liquido > 0), como Q13;
--   - normaliza o nome do fornecedor para reduzir fragmentacao por grafia,
--     caixa, acento e sufixos societarios simples;
--   - os totais por ano e global devem fechar com dados_padronizados/gastos.csv.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION pg_temp.caio_normalize_supplier(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
WITH base AS (
    SELECT UPPER(public.unaccent(COALESCE(value, ''))) AS text
),
cnpj_match AS (
    SELECT (regexp_match(text, '\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}'))[1] AS cnpj
    FROM base
),
normalized AS (
    SELECT
        CASE
            WHEN cnpj IS NOT NULL THEN 'CNPJ_' || regexp_replace(cnpj, '\D', '', 'g')
            ELSE regexp_replace(
                regexp_replace(
                    regexp_replace(
                        text,
                        '[^A-Z0-9\s]',
                        ' ',
                        'g'
                    ),
                    '\m(LTDA|LTD|LIMITADA|ME|EPP|EIRELI|EI|SA|S A|S/A|SS|S S|COMERCIO|COMERCIAL|SERVICOS|SERVICO|SERV|INDUSTRIA|IMPORTACAO|EXPORTACAO|DISTRIBUIDORA|DISTRIBUICAO|ADMINISTRACAO|PARTICIPACOES|HOLDING|GRUPO)\M',
                    ' ',
                    'g'
                ),
                '\m(D[AEIOU]S?|E)\M',
                ' ',
                'g'
            )
        END AS text
    FROM base
    LEFT JOIN cnpj_match ON TRUE
)
SELECT COALESCE(
    NULLIF(
        BTRIM(regexp_replace(text, '\s+', ' ', 'g')),
        ''
    ),
    'SEM_FORNECEDOR'
)
FROM normalized;
$$;

\o /query-staging/q5_fornecedores.txt

CREATE OR REPLACE TEMP VIEW resposta_fornecedores AS
WITH gastos_base AS (
    SELECT
        g.ano_dados,
        pg_temp.caio_normalize_supplier(REPLACE(REPLACE(g.fornecedor, '|', '/'), CHR(8211), '-')) AS fornecedor,
        g.valor_liquido
    FROM gastos g
    JOIN deputados d ON d.id_deputado = g.id_deputado
    WHERE d.id_legislatura_final = 57
      AND g.fornecedor IS NOT NULL
      AND BTRIM(g.fornecedor) <> ''
      AND g.valor_liquido > 0
)
SELECT
    ano_dados,
    fornecedor,
    COUNT(*) AS qtd_lancamentos,
    SUM(valor_liquido) AS total_pago
FROM gastos_base
GROUP BY ano_dados, fornecedor;

\qecho Q5 - fornecedores com maior total pago (57a legislatura - Cota Parlamentar)
\qecho =============================================================================
\qecho
\qecho Resumo executivo - totais por ano e concentracao no top 30
SELECT
    ano_dados,
    COUNT(*)                           AS fornecedores,
    SUM(qtd_lancamentos)               AS lancamentos,
    ROUND(SUM(total_pago)::NUMERIC, 2) AS total_pago,
    ROUND(
        100.0 * SUM(total_pago) FILTER (WHERE posicao <= 30)
        / NULLIF(SUM(total_pago), 0),
        2
    )                                  AS pct_top_30
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
) ranked
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
        ) AS posicao,
        SUM(total_pago) OVER (
            PARTITION BY ano_dados
        ) AS total_geral
    FROM resposta_fornecedores
)
SELECT
    ano_dados,
    posicao,
    fornecedor,
    qtd_lancamentos,
    ROUND(total_pago::NUMERIC, 2) AS total_pago,
    ROUND(100.0 * total_pago / NULLIF(total_geral, 0), 2) AS pct_total
FROM ranked
WHERE posicao <= 30
ORDER BY ano_dados, total_pago DESC, fornecedor;

\qecho
\qecho Ranking global - todos os anos da 57a legislatura consolidados
WITH global_totais AS (
    SELECT
        fornecedor,
        SUM(qtd_lancamentos) AS qtd_lancamentos,
        SUM(total_pago) AS total_pago
    FROM resposta_fornecedores
    GROUP BY fornecedor
),
ranked AS (
    SELECT
        fornecedor,
        qtd_lancamentos,
        total_pago,
        RANK() OVER (
            ORDER BY total_pago DESC
        ) AS posicao,
        SUM(total_pago) OVER () AS total_geral
    FROM global_totais
)
SELECT
    'GLOBAL' AS ano_dados,
    posicao,
    fornecedor,
    qtd_lancamentos,
    ROUND(total_pago::NUMERIC, 2) AS total_pago,
    ROUND(100.0 * total_pago / NULLIF(total_geral, 0), 2) AS pct_total
FROM ranked
WHERE posicao <= 30
ORDER BY total_pago DESC, fornecedor;


-- =============================================================================
-- Q5 EXTRA: TOP 5 POR CATEGORIA DE GASTO
-- =============================================================================

\o /query-staging/q5_fornecedores_complemento.txt
\qecho Q5 complemento - top 5 fornecedores por categoria de gasto e por ano (57a leg.)
WITH fornecedores_categoria AS (
    SELECT
        g.ano_dados,
        g.descricao_despesa AS categoria,
        pg_temp.caio_normalize_supplier(REPLACE(REPLACE(g.fornecedor, '|', '/'), CHR(8211), '-')) AS fornecedor,
        COUNT(*) AS qtd_lancamentos,
        SUM(g.valor_liquido) AS total_pago,
        RANK() OVER (
            PARTITION BY g.ano_dados, g.descricao_despesa
            ORDER BY SUM(g.valor_liquido) DESC
        ) AS posicao
    FROM gastos g
    JOIN deputados d ON d.id_deputado = g.id_deputado
    WHERE d.id_legislatura_final = 57
      AND g.fornecedor IS NOT NULL
      AND BTRIM(g.fornecedor) <> ''
      AND g.valor_liquido > 0
    GROUP BY
        g.ano_dados,
        g.descricao_despesa,
        fornecedor
)
SELECT
    ano_dados,
    posicao,
    categoria,
    fornecedor,
    qtd_lancamentos,
    ROUND(total_pago::NUMERIC, 2) AS total_pago
FROM fornecedores_categoria
WHERE posicao <= 5
ORDER BY ano_dados, categoria, posicao, fornecedor;
