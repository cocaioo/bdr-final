\o

CREATE OR REPLACE TEMP VIEW resposta_gastos_deputado AS
SELECT
    ano_dados,
    id_deputado,
    SUM(valor_liquido) AS gasto_total
FROM gastos
GROUP BY ano_dados, id_deputado;

CREATE OR REPLACE TEMP VIEW resposta_proposicoes_deputado AS
SELECT
    pa.ano_dados,
    pa.id_deputado,
    COUNT(DISTINCT pa.id_proposicao) AS qtd_proposicoes,
    COUNT(DISTINCT pa.id_proposicao) FILTER (
        WHERE COALESCE(p.descricao_situacao, '') ILIKE '%aprov%'
           OR COALESCE(p.descricao_situacao, '') ILIKE '%sancao%'
           OR COALESCE(p.descricao_situacao, '') ILIKE '%norma juridica%'
           OR COALESCE(p.descricao_situacao, '') ILIKE '%promulg%'
    ) AS proposicoes_aprovadas
FROM proposicoes_autores pa
LEFT JOIN proposicoes p
    ON p.ano_dados = pa.ano_dados
   AND p.id_proposicao = pa.id_proposicao
WHERE pa.id_deputado IS NOT NULL
GROUP BY pa.ano_dados, pa.id_deputado;

CREATE OR REPLACE TEMP VIEW resposta_presenca_deputado AS
SELECT
    ano_dados,
    id_deputado,
    COUNT(*) AS presenca_total
FROM eventos_presenca_deputados
GROUP BY ano_dados, id_deputado;

CREATE OR REPLACE TEMP VIEW resposta_perfil_deputado_ano_q7 AS
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

CREATE OR REPLACE TEMP VIEW resposta_perfil_deputado_global_q7 AS
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

CREATE OR REPLACE TEMP VIEW resposta_custo_beneficio AS
SELECT
    g.ano_dados,
    d.id_deputado,
    d.nome,
    perfil.sigla_uf,
    perfil.sigla_partido,
    g.gasto_total,
    COALESCE(p.qtd_proposicoes, 0) AS qtd_proposicoes,
    COALESCE(p.proposicoes_aprovadas, 0) AS proposicoes_aprovadas,
    COALESCE(pr.presenca_total, 0) AS presenca_total,
    (
        COALESCE(p.qtd_proposicoes, 0) * 1.5 +
        COALESCE(p.proposicoes_aprovadas, 0) * 36.0 +
        COALESCE(pr.presenca_total, 0) * 0.1
    ) AS beneficio,
    (
        COALESCE(p.qtd_proposicoes, 0) * 1.5 +
        COALESCE(p.proposicoes_aprovadas, 0) * 36.0 +
        COALESCE(pr.presenca_total, 0) * 0.1
    ) / NULLIF(g.gasto_total, 0) AS custo_beneficio
FROM deputados d
JOIN resposta_gastos_deputado g ON g.id_deputado = d.id_deputado
LEFT JOIN resposta_perfil_deputado_ano_q7 perfil
    ON perfil.ano_dados = g.ano_dados
   AND perfil.id_deputado = d.id_deputado
LEFT JOIN resposta_proposicoes_deputado p
    ON p.ano_dados = g.ano_dados
 AND p.id_deputado = d.id_deputado
LEFT JOIN resposta_presenca_deputado pr
    ON pr.ano_dados = g.ano_dados
 AND pr.id_deputado = d.id_deputado
WHERE g.gasto_total > 0;

\o /respostas/q7_custo_beneficio.txt
\qecho Q7 - ranking de beneficio por deputado
\qecho Resumo executivo
SELECT
    ano_dados,
    COUNT(*) AS deputados_com_gasto,
    ROUND(AVG(beneficio), 2) AS media_beneficio,
    ROUND(MAX(beneficio), 2) AS maior_beneficio
FROM resposta_custo_beneficio
GROUP BY ano_dados
ORDER BY ano_dados;

\qecho
\qecho Tabela principal - top 30 por beneficio
WITH ranked AS (
    SELECT
        *,
        RANK() OVER (
            PARTITION BY ano_dados
            ORDER BY beneficio DESC NULLS LAST
        ) AS posicao
    FROM resposta_custo_beneficio
)
SELECT
    ano_dados,
    id_deputado,
    nome,
    sigla_uf,
    sigla_partido,
    gasto_total,
    qtd_proposicoes,
    proposicoes_aprovadas,
    presenca_total,
    beneficio,
    custo_beneficio
FROM ranked
WHERE posicao <= 30
ORDER BY ano_dados, beneficio DESC NULLS LAST;

\qecho
\qecho Ranking global - todos os anos
WITH global_gastos AS (
    SELECT
        id_deputado,
        SUM(gasto_total) AS gasto_total
    FROM resposta_gastos_deputado
    GROUP BY id_deputado
    HAVING SUM(gasto_total) > 0
),
global_proposicoes AS (
    SELECT
        id_deputado,
        SUM(qtd_proposicoes) AS qtd_proposicoes,
        SUM(proposicoes_aprovadas) AS proposicoes_aprovadas
    FROM resposta_proposicoes_deputado
    GROUP BY id_deputado
),
global_presencas AS (
    SELECT
        id_deputado,
        SUM(presenca_total) AS presenca_total
    FROM resposta_presenca_deputado
    GROUP BY id_deputado
),
deputado_labels AS (
    SELECT
        id_deputado,
        MAX(nome) AS nome
    FROM deputados
    GROUP BY id_deputado
),
global_metricas AS (
    SELECT
        'GLOBAL' AS ano_dados,
        g.id_deputado,
        d.nome,
        perfil.sigla_uf,
        perfil.sigla_partido,
        g.gasto_total,
        COALESCE(p.qtd_proposicoes, 0) AS qtd_proposicoes,
        COALESCE(p.proposicoes_aprovadas, 0) AS proposicoes_aprovadas,
        COALESCE(pr.presenca_total, 0) AS presenca_total,
        (
            COALESCE(p.qtd_proposicoes, 0) * 1.5 +
            COALESCE(p.proposicoes_aprovadas, 0) * 36.0 +
            COALESCE(pr.presenca_total, 0) * 0.1
        ) AS beneficio,
        (
            COALESCE(p.qtd_proposicoes, 0) * 1.5 +
            COALESCE(p.proposicoes_aprovadas, 0) * 36.0 +
            COALESCE(pr.presenca_total, 0) * 0.1
        ) / NULLIF(g.gasto_total, 0) AS custo_beneficio
    FROM global_gastos g
    LEFT JOIN global_proposicoes p ON p.id_deputado = g.id_deputado
    LEFT JOIN global_presencas pr ON pr.id_deputado = g.id_deputado
    LEFT JOIN deputado_labels d ON d.id_deputado = g.id_deputado
    LEFT JOIN resposta_perfil_deputado_global_q7 perfil
        ON perfil.id_deputado = g.id_deputado
)
SELECT
    ano_dados,
    id_deputado,
    nome,
    sigla_uf,
    sigla_partido,
    gasto_total,
    qtd_proposicoes,
    proposicoes_aprovadas,
    presenca_total,
    beneficio,
    custo_beneficio
FROM global_metricas
ORDER BY beneficio DESC NULLS LAST;

\qecho
\qecho Complemento detalhado: q7_custo_beneficio_complemento.txt contem o ranking completo por beneficio.

\o /respostas/q7_custo_beneficio_complemento.txt
\qecho Q7 complemento - ranking completo por beneficio
SELECT
    ano_dados,
    id_deputado,
    nome,
    gasto_total,
    qtd_proposicoes,
    proposicoes_aprovadas,
    presenca_total,
    beneficio,
    custo_beneficio
FROM resposta_custo_beneficio
ORDER BY ano_dados, beneficio DESC NULLS LAST;
