-- =============================================================================
-- Q13 - CATEGORIAS DE GASTO POR DEPUTADO
-- Universo: 57ª Legislatura (2023-2027), Cota Parlamentar (CEAP)
--
-- Saída (via /respostas/):
--   q13_categorias_gasto_deputado.txt
--   q13_categorias_gasto_deputado_complemento.txt
-- =============================================================================

-- Tabela temporária para consolidar a agregação base
CREATE OR REPLACE TEMP VIEW resposta_deputado_categoria AS
SELECT
    g.ano_dados,
    g.id_deputado,
    COALESCE(NULLIF(BTRIM(d.nome_civil), ''), d.nome) AS nome,
    g.sigla_uf,
    g.sigla_partido,
    g.descricao_despesa,
    COUNT(*) AS qtd_lancamentos,
    SUM(g.valor_liquido) AS gasto_total
FROM gastos g
JOIN deputados d ON d.id_deputado = g.id_deputado
WHERE d.id_legislatura_final = 57
  AND g.valor_liquido > 0
GROUP BY
    g.ano_dados,
    g.id_deputado,
    COALESCE(NULLIF(BTRIM(d.nome_civil), ''), d.nome),
    g.sigla_uf,
    g.sigla_partido,
    g.descricao_despesa;

-- =============================================================================
-- ARQUIVO 1: q13_categorias_gasto_deputado.txt
-- =============================================================================
\o /respostas/q13_categorias_gasto_deputado.txt

-- 1. Resumo Executivo
\qecho Resumo executivo - totais gerais de despesas por ano
WITH resumo_ano AS (
    SELECT
        ano_dados,
        COUNT(DISTINCT id_deputado) AS total_deputados,
        SUM(qtd_lancamentos) AS total_lancamentos,
        SUM(gasto_total) AS total_gasto
    FROM resposta_deputado_categoria
    GROUP BY ano_dados
)
SELECT
    ano_dados,
    total_deputados,
    total_lancamentos,
    ROUND(total_gasto::NUMERIC, 2) AS total_gasto,
    ROUND((total_gasto / NULLIF(total_deputados, 0))::NUMERIC, 2) AS media_por_deputado
FROM resumo_ano
ORDER BY ano_dados;

\qecho

-- 2. Tabela Principal (Ranking Anual)
\qecho Tabela principal - ranking de gastos por deputado e categoria
WITH totais_ano AS (
    SELECT
        ano_dados,
        SUM(gasto_total) AS total_geral_ano
    FROM resposta_deputado_categoria
    GROUP BY ano_dados
)
SELECT
    r.ano_dados,
    r.id_deputado,
    r.nome,
    r.sigla_uf,
    r.sigla_partido,
    r.descricao_despesa,
    r.qtd_lancamentos,
    ROUND(r.gasto_total::NUMERIC, 2) AS gasto_total,
    ROUND((r.gasto_total * 100.0 / NULLIF(t.total_geral_ano, 0))::NUMERIC, 2) AS pct_total
FROM resposta_deputado_categoria r
JOIN totais_ano t ON t.ano_dados = r.ano_dados
ORDER BY r.ano_dados, r.gasto_total DESC, r.nome;

\qecho

-- 3. Tabela Principal Global (Ranking Consolidado)
\qecho Tabela principal global - consolidado de todos os anos
WITH global_deputado AS (
    SELECT
        id_deputado,
        nome,
        sigla_uf,
        sigla_partido,
        descricao_despesa,
        SUM(qtd_lancamentos) AS qtd_lancamentos,
        SUM(gasto_total) AS gasto_total
    FROM resposta_deputado_categoria
    GROUP BY id_deputado, nome, sigla_uf, sigla_partido, descricao_despesa
),
totais_global AS (
    SELECT SUM(gasto_total) AS total_geral_global
    FROM global_deputado
)
SELECT
    'GLOBAL' AS ano_dados,
    g.id_deputado,
    g.nome,
    g.sigla_uf,
    g.sigla_partido,
    g.descricao_despesa,
    g.qtd_lancamentos,
    ROUND(g.gasto_total::NUMERIC, 2) AS gasto_total,
    ROUND((g.gasto_total * 100.0 / NULLIF(t.total_geral_global, 0))::NUMERIC, 2) AS pct_total
FROM global_deputado g
CROSS JOIN totais_global t
ORDER BY g.gasto_total DESC, g.nome;

-- =============================================================================
-- ARQUIVO 2: q13_categorias_gasto_deputado_complemento.txt
-- =============================================================================
\o /respostas/q13_categorias_gasto_deputado_complemento.txt

-- 1. Tabela Complementar (Gastos por Categoria por Ano)
\qecho Tabela complementar - gastos consolidados por categoria
WITH categoria_ano AS (
    SELECT
        ano_dados,
        descricao_despesa,
        SUM(qtd_lancamentos) AS qtd_lancamentos,
        SUM(gasto_total) AS total_gasto
    FROM resposta_deputado_categoria
    GROUP BY ano_dados, descricao_despesa
),
totais_ano AS (
    SELECT
        ano_dados,
        SUM(total_gasto) AS total_geral_ano
    FROM categoria_ano
    GROUP BY ano_dados
)
SELECT
    c.ano_dados,
    c.descricao_despesa,
    ROUND(c.total_gasto::NUMERIC, 2) AS total_gasto,
    c.qtd_lancamentos,
    ROUND((c.total_gasto * 100.0 / NULLIF(t.total_geral_ano, 0))::NUMERIC, 2) AS pct_total
FROM categoria_ano c
JOIN totais_ano t ON t.ano_dados = c.ano_dados
ORDER BY c.ano_dados, c.total_gasto DESC, c.descricao_despesa;

\qecho

-- 2. Tabela Complementar Global (Gastos por Categoria Consolidado)
\qecho Tabela complementar global - gastos consolidados por categoria global
WITH categoria_global AS (
    SELECT
        descricao_despesa,
        SUM(qtd_lancamentos) AS qtd_lancamentos,
        SUM(gasto_total) AS total_gasto
    FROM resposta_deputado_categoria
    GROUP BY descricao_despesa
),
total_global AS (
    SELECT SUM(total_gasto) AS total_geral_global
    FROM categoria_global
)
SELECT
    'GLOBAL' AS ano_dados,
    c.descricao_despesa,
    ROUND(c.total_gasto::NUMERIC, 2) AS total_gasto,
    c.qtd_lancamentos,
    ROUND((c.total_gasto * 100.0 / NULLIF(t.total_geral_global, 0))::NUMERIC, 2) AS pct_total
FROM categoria_global c
CROSS JOIN total_global t
ORDER BY c.total_gasto DESC, c.descricao_despesa;
