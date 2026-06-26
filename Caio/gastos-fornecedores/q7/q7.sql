\o

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

-- Q7 v1: indice simples e defensavel de custo-beneficio parlamentar.
-- A metrica evita contar proposicoes de forma bruta: cada autoria recebe
-- pesos por tipo, status e ordem de assinatura, e depois o total e suavizado.
--
-- Regra metodologica: o ranking global considera apenas anos completos.
-- Como 2026 esta incompleto em 24/06/2026, ele fica fora do global e aparece
-- apenas no ranking anual, marcado com ano_parcial = true.

CREATE OR REPLACE TEMP VIEW resposta_gastos_deputado AS
SELECT
    ano_dados,
    id_deputado,
    SUM(valor_liquido)::numeric AS gasto_total
FROM gastos
GROUP BY ano_dados, id_deputado;

CREATE OR REPLACE TEMP VIEW resposta_perfil_deputado_ano_q7 AS
WITH base AS (
    SELECT
        ano_dados,
        id_deputado,
        nome_parlamentar,
        sigla_uf,
        sigla_partido,
        COUNT(*) AS ocorrencias
    FROM gastos
    GROUP BY ano_dados, id_deputado, nome_parlamentar, sigla_uf, sigla_partido
),
ranked AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY ano_dados, id_deputado
            ORDER BY ocorrencias DESC, nome_parlamentar, sigla_uf, sigla_partido
        ) AS posicao
    FROM base
)
SELECT
    ano_dados,
    id_deputado,
    nome_parlamentar,
    sigla_uf,
    sigla_partido
FROM ranked
WHERE posicao = 1;

CREATE OR REPLACE TEMP VIEW resposta_perfil_deputado_global_q7 AS
WITH base AS (
    SELECT
        id_deputado,
        nome_parlamentar,
        sigla_uf,
        sigla_partido,
        COUNT(*) AS ocorrencias
    FROM gastos
    WHERE ano_dados < 2026
    GROUP BY id_deputado, nome_parlamentar, sigla_uf, sigla_partido
),
ranked AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY id_deputado
            ORDER BY ocorrencias DESC, nome_parlamentar, sigla_uf, sigla_partido
        ) AS posicao
    FROM base
)
SELECT
    id_deputado,
    nome_parlamentar,
    sigla_uf,
    sigla_partido
FROM ranked
WHERE posicao = 1;

CREATE OR REPLACE TEMP VIEW resposta_proposicoes_ponderadas AS
WITH autorias_unicas AS (
    SELECT
        pa.ano_dados,
        pa.id_proposicao,
        pa.id_deputado,
        MIN(pa.ordem_assinatura) AS ordem_assinatura
    FROM proposicoes_autores pa
    WHERE pa.id_deputado IS NOT NULL
    GROUP BY pa.ano_dados, pa.id_proposicao, pa.id_deputado
),
proposicoes_base AS (
    SELECT
        au.ano_dados,
        au.id_proposicao,
        au.id_deputado,
        UPPER(COALESCE(p.sigla_tipo, '')) AS sigla_tipo_norm,
        LOWER(public.unaccent(COALESCE(p.descricao_situacao, ''))) AS situacao_norm,
        au.ordem_assinatura
    FROM autorias_unicas au
    LEFT JOIN proposicoes p
        ON p.ano_dados = au.ano_dados
       AND p.id_proposicao = au.id_proposicao
),
proposicoes_pontuadas AS (
    SELECT
        ano_dados,
        id_proposicao,
        id_deputado,
        CASE
            WHEN sigla_tipo_norm IN ('PEC', 'PLP', 'MPV', 'PLV') THEN 10.0
            WHEN sigla_tipo_norm IN ('PL', 'PDL', 'PRC', 'PLN') THEN 6.0
            WHEN sigla_tipo_norm IN ('PFC', 'MSC', 'EMC', 'SBT', 'EMR', 'PRL') THEN 2.0
            ELSE 0.3
        END AS peso_tipo,
        CASE
            WHEN situacao_norm IS NULL OR BTRIM(situacao_norm) = '' THEN 0.8
            WHEN situacao_norm LIKE '%aprovad%'
              OR situacao_norm LIKE '%transformad%'
              OR situacao_norm LIKE '%convertid%'
              OR situacao_norm LIKE '%norma%'
              OR situacao_norm ~ '(^|[^a-z])lei([^a-z]|$)' THEN 1.3
            WHEN situacao_norm LIKE '%tramitacao%'
              OR situacao_norm LIKE '%aguardando%'
              OR situacao_norm LIKE '%pronta%'
              OR situacao_norm LIKE '%sujeita%'
              OR situacao_norm LIKE '%apreciacao%' THEN 1.0
            WHEN situacao_norm LIKE '%arquivad%'
              OR situacao_norm LIKE '%rejeitad%'
              OR situacao_norm LIKE '%prejudicad%'
              OR situacao_norm LIKE '%retirad%'
              OR situacao_norm LIKE '%devolvid%' THEN 0.4
            ELSE 0.8
        END AS peso_status,
        CASE
            WHEN ordem_assinatura = 1 THEN 1.0
            WHEN ordem_assinatura > 1 THEN 0.5
            ELSE 0.7
        END AS peso_autoria,
        sigla_tipo_norm,
        situacao_norm
    FROM proposicoes_base
)
SELECT
    ano_dados,
    id_deputado,
    COUNT(*) AS total_proposicoes,
    SUM(CASE WHEN sigla_tipo_norm <> '' THEN 1 ELSE 0 END) AS total_proposicoes_validas,
    SUM(CASE WHEN sigla_tipo_norm IN ('PEC', 'PLP', 'MPV', 'PLV', 'PL', 'PDL', 'PRC', 'PLN', 'PFC', 'MSC') THEN 1 ELSE 0 END) AS total_proposicoes_substantivas,
    SUM(CASE WHEN situacao_norm LIKE '%aprovad%'
              OR situacao_norm LIKE '%transformad%'
              OR situacao_norm LIKE '%convertid%'
              OR situacao_norm LIKE '%norma%'
              OR situacao_norm ~ '(^|[^a-z])lei([^a-z]|$)' THEN 1 ELSE 0 END) AS total_proposicoes_aprovadas,
    SUM(CASE WHEN situacao_norm LIKE '%tramitacao%'
              OR situacao_norm LIKE '%aguardando%'
              OR situacao_norm LIKE '%pronta%'
              OR situacao_norm LIKE '%sujeita%'
              OR situacao_norm LIKE '%apreciacao%' THEN 1 ELSE 0 END) AS total_proposicoes_em_tramitacao,
    SUM(CASE WHEN situacao_norm LIKE '%arquivad%'
              OR situacao_norm LIKE '%rejeitad%'
              OR situacao_norm LIKE '%prejudicad%'
              OR situacao_norm LIKE '%retirad%'
              OR situacao_norm LIKE '%devolvid%' THEN 1 ELSE 0 END) AS total_proposicoes_baixo_impacto,
    SUM(peso_tipo * peso_status * peso_autoria)::numeric AS score_proposicoes_total
FROM proposicoes_pontuadas
GROUP BY ano_dados, id_deputado;

CREATE OR REPLACE TEMP VIEW resposta_q7_base_anual AS
SELECT
    g.ano_dados,
    g.id_deputado,
    COALESCE(perfil.nome_parlamentar, d.nome) AS nome_parlamentar,
    perfil.sigla_partido,
    perfil.sigla_uf,
    g.gasto_total,
    p.total_proposicoes,
    p.total_proposicoes_validas,
    p.total_proposicoes_substantivas,
    p.total_proposicoes_aprovadas,
    p.total_proposicoes_em_tramitacao,
    p.total_proposicoes_baixo_impacto,
    p.score_proposicoes_total
FROM resposta_gastos_deputado g
JOIN resposta_proposicoes_ponderadas p
    ON p.ano_dados = g.ano_dados
   AND p.id_deputado = g.id_deputado
LEFT JOIN resposta_perfil_deputado_ano_q7 perfil
    ON perfil.ano_dados = g.ano_dados
   AND perfil.id_deputado = g.id_deputado
LEFT JOIN deputados d
    ON d.id_deputado = g.id_deputado;

CREATE OR REPLACE TEMP VIEW resposta_ranking_q7 AS
WITH ranking_global_totais AS (
    SELECT
        id_deputado,
        SUM(gasto_total)::numeric AS gasto_total,
        SUM(total_proposicoes) AS total_proposicoes,
        SUM(total_proposicoes_validas) AS total_proposicoes_validas,
        SUM(total_proposicoes_substantivas) AS total_proposicoes_substantivas,
        SUM(total_proposicoes_aprovadas) AS total_proposicoes_aprovadas,
        SUM(total_proposicoes_em_tramitacao) AS total_proposicoes_em_tramitacao,
        SUM(total_proposicoes_baixo_impacto) AS total_proposicoes_baixo_impacto,
        SUM(score_proposicoes_total)::numeric AS score_proposicoes_total
    FROM resposta_q7_base_anual
    WHERE ano_dados < 2026
    GROUP BY id_deputado
),
ranking_global AS (
    SELECT
        'global' AS escopo,
        NULL::integer AS ano_dados,
        'Global' AS periodo_label,
        FALSE AS ano_parcial,
        g.id_deputado,
        COALESCE(perfil.nome_parlamentar, d.nome) AS nome_parlamentar,
        perfil.sigla_partido,
        perfil.sigla_uf,
        g.gasto_total,
        g.total_proposicoes,
        g.total_proposicoes_validas,
        g.total_proposicoes_substantivas,
        g.total_proposicoes_aprovadas,
        g.total_proposicoes_em_tramitacao,
        g.total_proposicoes_baixo_impacto,
        g.score_proposicoes_total
    FROM ranking_global_totais g
    LEFT JOIN resposta_perfil_deputado_global_q7 perfil
        ON perfil.id_deputado = g.id_deputado
    LEFT JOIN deputados d
        ON d.id_deputado = g.id_deputado
),
ranking_anual AS (
    SELECT
        'anual' AS escopo,
        ano_dados,
        ano_dados::text AS periodo_label,
        (ano_dados = 2026) AS ano_parcial,
        id_deputado,
        nome_parlamentar,
        sigla_partido,
        sigla_uf,
        gasto_total,
        total_proposicoes,
        total_proposicoes_validas,
        total_proposicoes_substantivas,
        total_proposicoes_aprovadas,
        total_proposicoes_em_tramitacao,
        total_proposicoes_baixo_impacto,
        score_proposicoes_total
    FROM resposta_q7_base_anual
),
ranking_unificado AS (
    SELECT * FROM ranking_global
    UNION ALL
    SELECT * FROM ranking_anual
),
calculado AS (
    SELECT
        escopo,
        ano_dados,
        periodo_label,
        ano_parcial,
        id_deputado,
        nome_parlamentar,
        sigla_partido,
        sigla_uf,
        gasto_total,
        total_proposicoes,
        total_proposicoes_validas,
        total_proposicoes_substantivas,
        total_proposicoes_aprovadas,
        total_proposicoes_em_tramitacao,
        total_proposicoes_baixo_impacto,
        score_proposicoes_total,
        CASE
            WHEN gasto_total >= 10000
             AND score_proposicoes_total >= 5
             AND total_proposicoes_validas >= 2
             AND total_proposicoes_substantivas >= 1
            THEN TRUE
            ELSE FALSE
        END AS elegivel_ranking,
        CASE
            WHEN NOT (gasto_total >= 10000
                  AND score_proposicoes_total >= 5
                  AND total_proposicoes_validas >= 2
                  AND total_proposicoes_substantivas >= 1)
            THEN 'Gasto abaixo do mínimo, baixa atividade parlamentar ou ausência de proposições substantivas'
            ELSE NULL
        END AS motivo_inelegibilidade,
        POWER(score_proposicoes_total, 0.75)::numeric AS score_proposicoes_ajustado,
        POWER(1 + gasto_total / 1000.0, 0.75)::numeric AS gasto_ajustado,
        POWER(score_proposicoes_total, 0.75)::numeric
            / NULLIF(POWER(1 + gasto_total / 1000.0, 0.75)::numeric, 0)
            AS indice_custo_beneficio
    FROM ranking_unificado
)
SELECT
    CASE 
        WHEN elegivel_ranking THEN
            ROW_NUMBER() OVER (
                PARTITION BY escopo, ano_dados, elegivel_ranking
                ORDER BY indice_custo_beneficio DESC NULLS LAST, id_deputado
            )
        ELSE NULL
    END AS posicao,
    *
FROM calculado;

\o /query-staging/q7_custo_beneficio.txt
\qecho Q7 - ranking de custo-beneficio por deputado
\qecho Resumo executivo
SELECT
    escopo,
    ano_dados,
    periodo_label,
    CASE WHEN ano_parcial THEN 'true' ELSE 'false' END AS ano_parcial,
    COUNT(*) AS deputados_rankeados,
    ROUND(SUM(gasto_total), 2) AS gasto_total,
    SUM(total_proposicoes) AS total_proposicoes,
    ROUND(AVG(score_proposicoes_total), 2) AS media_score_proposicoes_total,
    ROUND(AVG(indice_custo_beneficio), 6) AS media_indice_custo_beneficio,
    ROUND(MAX(indice_custo_beneficio), 6) AS maior_indice_custo_beneficio
FROM resposta_ranking_q7
WHERE elegivel_ranking = TRUE
GROUP BY escopo, ano_dados, periodo_label, ano_parcial
ORDER BY
    CASE WHEN escopo = 'global' THEN 0 ELSE 1 END,
    ano_dados DESC NULLS FIRST;

\qecho
\qecho Tabela principal - ranking global e anual
SELECT
    posicao,
    escopo,
    ano_dados,
    periodo_label,
    CASE WHEN ano_parcial THEN 'true' ELSE 'false' END AS ano_parcial,
    id_deputado,
    nome_parlamentar,
    sigla_partido,
    sigla_uf,
    ROUND(gasto_total, 2) AS gasto_total,
    total_proposicoes,
    total_proposicoes_validas,
    total_proposicoes_substantivas,
    total_proposicoes_aprovadas,
    total_proposicoes_em_tramitacao,
    total_proposicoes_baixo_impacto,
    ROUND(score_proposicoes_total, 4) AS score_proposicoes_total,
    ROUND(score_proposicoes_ajustado, 6) AS score_proposicoes_ajustado,
    ROUND(gasto_ajustado, 6) AS gasto_ajustado,
    ROUND(indice_custo_beneficio, 6) AS indice_custo_beneficio,
    CASE WHEN elegivel_ranking THEN 'true' ELSE 'false' END AS elegivel_ranking,
    motivo_inelegibilidade
FROM resposta_ranking_q7
WHERE elegivel_ranking = TRUE
ORDER BY
    CASE WHEN escopo = 'global' THEN 0 ELSE 1 END,
    ano_dados DESC NULLS FIRST,
    posicao;

\qecho
\qecho Nota metodologica: o ranking global considera apenas anos completos; 2026 fica disponivel apenas na analise anual como periodo parcial.
\qecho Complemento detalhado: q7_custo_beneficio_complemento.txt contem o mesmo ranking unificado completo para auditoria.

\o /query-staging/q7_custo_beneficio_complemento.txt
\qecho Q7 complemento - ranking unificado completo por indice de custo-beneficio
SELECT
    posicao,
    escopo,
    ano_dados,
    periodo_label,
    CASE WHEN ano_parcial THEN 'true' ELSE 'false' END AS ano_parcial,
    id_deputado,
    nome_parlamentar,
    sigla_partido,
    sigla_uf,
    ROUND(gasto_total, 2) AS gasto_total,
    total_proposicoes,
    total_proposicoes_validas,
    total_proposicoes_substantivas,
    total_proposicoes_aprovadas,
    total_proposicoes_em_tramitacao,
    total_proposicoes_baixo_impacto,
    ROUND(score_proposicoes_total, 4) AS score_proposicoes_total,
    ROUND(score_proposicoes_ajustado, 6) AS score_proposicoes_ajustado,
    ROUND(gasto_ajustado, 6) AS gasto_ajustado,
    ROUND(indice_custo_beneficio, 6) AS indice_custo_beneficio,
    CASE WHEN elegivel_ranking THEN 'true' ELSE 'false' END AS elegivel_ranking,
    motivo_inelegibilidade
FROM resposta_ranking_q7
ORDER BY
    CASE WHEN escopo = 'global' THEN 0 ELSE 1 END,
    ano_dados DESC NULLS FIRST,
    elegivel_ranking DESC,
    posicao NULLS LAST,
    id_deputado;
