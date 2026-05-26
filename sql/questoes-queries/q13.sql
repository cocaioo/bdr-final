\o
CREATE OR REPLACE TEMP VIEW resposta_perfil_deputado_ano_q13 AS
WITH base AS (
    SELECT
        ano_dados,
        id_deputado,
        sigla_uf,
        sigla_partido,
        COUNT(*) AS ocorrencias
    FROM gastos
    GROUP BY ano_dados, id_deputado, sigla_uf, sigla_partido
),
ranked AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY ano_dados, id_deputado
            ORDER BY ocorrencias DESC, sigla_uf, sigla_partido
        ) AS posicao
    FROM base
)
SELECT
    ano_dados,
    id_deputado,
    sigla_uf,
    sigla_partido
FROM ranked
WHERE posicao = 1;

CREATE OR REPLACE TEMP VIEW resposta_perfil_deputado_global_q13 AS
WITH base AS (
    SELECT
        id_deputado,
        sigla_uf,
        sigla_partido,
        COUNT(*) AS ocorrencias
    FROM gastos
    GROUP BY id_deputado, sigla_uf, sigla_partido
),
ranked AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY id_deputado
            ORDER BY ocorrencias DESC, sigla_uf, sigla_partido
        ) AS posicao
    FROM base
)
SELECT
    id_deputado,
    sigla_uf,
    sigla_partido
FROM ranked
WHERE posicao = 1;

CREATE OR REPLACE TEMP VIEW resposta_deputado_categoria_gasto AS
SELECT
    g.ano_dados,
    d.id_deputado,
    d.nome,
    perfil.sigla_uf,
    perfil.sigla_partido,
    g.descricao_despesa,
    COUNT(*) AS qtd_lancamentos,
    SUM(g.valor_liquido) AS gasto_total
FROM gastos g
JOIN deputados d ON d.id_deputado = g.id_deputado
LEFT JOIN resposta_perfil_deputado_ano_q13 perfil
    ON perfil.ano_dados = g.ano_dados
   AND perfil.id_deputado = g.id_deputado
WHERE g.descricao_despesa IS NOT NULL
GROUP BY
    g.ano_dados,
    d.id_deputado,
    d.nome,
    perfil.sigla_uf,
    perfil.sigla_partido,
    g.descricao_despesa;

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
    sigla_uf,
    sigla_partido,
    descricao_despesa,
    qtd_lancamentos,
    gasto_total,
    ROUND(100.0 * gasto_total / NULLIF(total_ano, 0), 2) AS pct_total
FROM ranked
WHERE posicao <= 30
ORDER BY ano_dados, gasto_total DESC;

\qecho
\qecho Ranking global - todos os anos
WITH global_totais AS (
    SELECT
        r.id_deputado,
        MAX(r.nome) AS nome,
        perfil.sigla_uf,
        perfil.sigla_partido,
        r.descricao_despesa,
        SUM(r.qtd_lancamentos) AS qtd_lancamentos,
        SUM(r.gasto_total) AS gasto_total
    FROM resposta_deputado_categoria_gasto r
    LEFT JOIN resposta_perfil_deputado_global_q13 perfil
        ON perfil.id_deputado = r.id_deputado
    GROUP BY
        r.id_deputado,
        perfil.sigla_uf,
        perfil.sigla_partido,
        r.descricao_despesa
),
ranked AS (
    SELECT
        *,
        SUM(gasto_total) OVER () AS total_geral
    FROM global_totais
)
SELECT
    'GLOBAL' AS ano_dados,
    id_deputado,
    nome,
    sigla_uf,
    sigla_partido,
    descricao_despesa,
    qtd_lancamentos,
    gasto_total,
    ROUND(100.0 * gasto_total / NULLIF(total_geral, 0), 2) AS pct_total
FROM ranked
ORDER BY gasto_total DESC, id_deputado, descricao_despesa;

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
