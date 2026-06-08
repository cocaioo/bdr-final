\o /respostas/q11_ranking_partidos.txt
\qecho Q11 - Ordenar os partidos por frequencia, proposicoes, gastos e nuvem de palavras

-- =======================================================================
-- Q11.a - Frequencia dos partidos nas votacoes
-- Conta quantos votos cada partido registrou (participacao em votacoes).
-- =======================================================================
\qecho
\qecho Q11.a - Ranking de partidos por frequencia nas votacoes (consolidado)

WITH freq_votacoes AS (
    SELECT
        vv.sigla_partido,
        COUNT(DISTINCT vv.id_votacao)  AS votacoes_participadas,
        COUNT(*)                       AS total_votos_registrados
    FROM votacoes_votos vv
    GROUP BY vv.sigla_partido
)
SELECT
    RANK() OVER (ORDER BY fv.votacoes_participadas DESC)  AS posicao,
    fv.sigla_partido,
    COALESCE(pi.ideologia, 'nao classificado')            AS ideologia,
    fv.votacoes_participadas,
    fv.total_votos_registrados
FROM freq_votacoes fv
LEFT JOIN partidos_ideologia pi ON pi.sigla_partido = fv.sigla_partido
ORDER BY fv.votacoes_participadas DESC, fv.sigla_partido;

-- -----------------------------------------------------------------------
-- Q11.a - Frequencia por ano
-- -----------------------------------------------------------------------
\qecho
\qecho Q11.a - Frequencia nas votacoes por ano

WITH freq_ano AS (
    SELECT
        vv.ano_dados,
        vv.sigla_partido,
        COUNT(DISTINCT vv.id_votacao)  AS votacoes_participadas,
        COUNT(*)                       AS total_votos_registrados
    FROM votacoes_votos vv
    GROUP BY vv.ano_dados, vv.sigla_partido
)
SELECT
    fa.ano_dados,
    RANK() OVER (PARTITION BY fa.ano_dados ORDER BY fa.votacoes_participadas DESC) AS posicao,
    fa.sigla_partido,
    COALESCE(pi.ideologia, 'nao classificado')  AS ideologia,
    fa.votacoes_participadas,
    fa.total_votos_registrados
FROM freq_ano fa
LEFT JOIN partidos_ideologia pi ON pi.sigla_partido = fa.sigla_partido
ORDER BY fa.ano_dados, fa.votacoes_participadas DESC, fa.sigla_partido;

-- =======================================================================
-- Q11.b - Proposicoes de projetos por partido
-- Conta proposicoes distintas onde o partido e autor.
-- =======================================================================
\qecho
\qecho Q11.b - Ranking de partidos por proposicoes de projetos (consolidado)

WITH prop_partido AS (
    SELECT
        pa.sigla_partido,
        COUNT(DISTINCT (pa.ano_dados, pa.id_proposicao))  AS total_proposicoes
    FROM proposicoes_autores pa
    WHERE pa.sigla_partido IS NOT NULL
      AND pa.sigla_partido != ''
    GROUP BY pa.sigla_partido
)
SELECT
    RANK() OVER (ORDER BY pp.total_proposicoes DESC)  AS posicao,
    pp.sigla_partido,
    COALESCE(pi.ideologia, 'nao classificado')        AS ideologia,
    pp.total_proposicoes
FROM prop_partido pp
LEFT JOIN partidos_ideologia pi ON pi.sigla_partido = pp.sigla_partido
ORDER BY pp.total_proposicoes DESC, pp.sigla_partido;

-- -----------------------------------------------------------------------
-- Q11.b - Proposicoes por ano
-- -----------------------------------------------------------------------
\qecho
\qecho Q11.b - Proposicoes por partido por ano

WITH prop_ano AS (
    SELECT
        pa.ano_dados,
        pa.sigla_partido,
        COUNT(DISTINCT pa.id_proposicao)  AS total_proposicoes
    FROM proposicoes_autores pa
    WHERE pa.sigla_partido IS NOT NULL
      AND pa.sigla_partido != ''
    GROUP BY pa.ano_dados, pa.sigla_partido
)
SELECT
    pna.ano_dados,
    RANK() OVER (PARTITION BY pna.ano_dados ORDER BY pna.total_proposicoes DESC) AS posicao,
    pna.sigla_partido,
    COALESCE(pi.ideologia, 'nao classificado')  AS ideologia,
    pna.total_proposicoes
FROM prop_ano pna
LEFT JOIN partidos_ideologia pi ON pi.sigla_partido = pna.sigla_partido
ORDER BY pna.ano_dados, pna.total_proposicoes DESC, pna.sigla_partido;

-- =======================================================================
-- Q11.c - Gastos por partido
-- Soma valor_liquido agrupado por partido.
-- =======================================================================
\qecho
\qecho Q11.c - Ranking de partidos por gastos (consolidado)

WITH gastos_partido AS (
    SELECT
        g.sigla_partido,
        SUM(g.valor_liquido)   AS gasto_total,
        COUNT(*)               AS qtd_despesas,
        COUNT(DISTINCT g.id_deputado) AS qtd_deputados
    FROM gastos g
    GROUP BY g.sigla_partido
)
SELECT
    RANK() OVER (ORDER BY gp.gasto_total DESC)     AS posicao,
    gp.sigla_partido,
    COALESCE(pi.ideologia, 'nao classificado')     AS ideologia,
    gp.qtd_deputados,
    gp.qtd_despesas,
    gp.gasto_total,
    ROUND(gp.gasto_total / NULLIF(gp.qtd_deputados, 0), 2) AS gasto_medio_por_deputado
FROM gastos_partido gp
LEFT JOIN partidos_ideologia pi ON pi.sigla_partido = gp.sigla_partido
ORDER BY gp.gasto_total DESC, gp.sigla_partido;

-- -----------------------------------------------------------------------
-- Q11.c - Gastos por ano
-- -----------------------------------------------------------------------
\qecho
\qecho Q11.c - Gastos por partido por ano

WITH gastos_ano AS (
    SELECT
        g.ano_dados,
        g.sigla_partido,
        SUM(g.valor_liquido)           AS gasto_total,
        COUNT(*)                       AS qtd_despesas,
        COUNT(DISTINCT g.id_deputado)  AS qtd_deputados
    FROM gastos g
    GROUP BY g.ano_dados, g.sigla_partido
)
SELECT
    ga.ano_dados,
    RANK() OVER (PARTITION BY ga.ano_dados ORDER BY ga.gasto_total DESC) AS posicao,
    ga.sigla_partido,
    COALESCE(pi.ideologia, 'nao classificado')  AS ideologia,
    ga.qtd_deputados,
    ga.qtd_despesas,
    ga.gasto_total,
    ROUND(ga.gasto_total / NULLIF(ga.qtd_deputados, 0), 2) AS gasto_medio_por_deputado
FROM gastos_ano ga
LEFT JOIN partidos_ideologia pi ON pi.sigla_partido = ga.sigla_partido
ORDER BY ga.ano_dados, ga.gasto_total DESC, ga.sigla_partido;

-- =======================================================================
-- Q11.d - Nuvem de palavras: score composto por partido
-- Combina as 3 dimensoes (votacoes, proposicoes, gastos) normalizadas
-- em um score unico. O nome do partido e o "termo" e o score e a
-- "frequencia" para a nuvem de palavras.
-- =======================================================================
\qecho
\qecho Q11.d - Nuvem de palavras - score composto por partido (consolidado)
\qecho Cada partido e um termo; a frequencia e um score normalizado combinando votacoes, proposicoes e gastos.

WITH freq_votacoes AS (
    SELECT
        sigla_partido,
        COUNT(DISTINCT id_votacao) AS valor
    FROM votacoes_votos
    GROUP BY sigla_partido
),
freq_proposicoes AS (
    SELECT
        sigla_partido,
        COUNT(DISTINCT (ano_dados, id_proposicao)) AS valor
    FROM proposicoes_autores
    WHERE sigla_partido IS NOT NULL
      AND sigla_partido != ''
    GROUP BY sigla_partido
),
freq_gastos AS (
    SELECT
        sigla_partido,
        SUM(valor_liquido) AS valor
    FROM gastos
    GROUP BY sigla_partido
),
-- Reunir todos os partidos que aparecem em qualquer dimensao
todos_partidos AS (
    SELECT sigla_partido FROM freq_votacoes
    UNION
    SELECT sigla_partido FROM freq_proposicoes
    UNION
    SELECT sigla_partido FROM freq_gastos
),
-- Juntar os valores brutos
dados AS (
    SELECT
        tp.sigla_partido,
        COALESCE(fv.valor, 0)  AS votacoes,
        COALESCE(fp.valor, 0)  AS proposicoes,
        COALESCE(fg.valor, 0)  AS gastos
    FROM todos_partidos tp
    LEFT JOIN freq_votacoes    fv ON fv.sigla_partido = tp.sigla_partido
    LEFT JOIN freq_proposicoes fp ON fp.sigla_partido = tp.sigla_partido
    LEFT JOIN freq_gastos      fg ON fg.sigla_partido = tp.sigla_partido
),
-- Normalizar cada dimensao de 0 a 100 (min-max)
limites AS (
    SELECT
        MAX(votacoes)    AS max_v, MIN(votacoes)    AS min_v,
        MAX(proposicoes) AS max_p, MIN(proposicoes) AS min_p,
        MAX(gastos)      AS max_g, MIN(gastos)      AS min_g
    FROM dados
),
normalizado AS (
    SELECT
        d.sigla_partido,
        d.votacoes,
        d.proposicoes,
        d.gastos,
        ROUND(
            CASE WHEN l.max_v = l.min_v THEN 50
                 ELSE (d.votacoes    - l.min_v) * 100.0 / (l.max_v - l.min_v)
            END, 2
        ) AS norm_votacoes,
        ROUND(
            CASE WHEN l.max_p = l.min_p THEN 50
                 ELSE (d.proposicoes - l.min_p) * 100.0 / (l.max_p - l.min_p)
            END, 2
        ) AS norm_proposicoes,
        ROUND(
            CASE WHEN l.max_g = l.min_g THEN 50
                 ELSE (d.gastos      - l.min_g) * 100.0 / (l.max_g - l.min_g)
            END, 2
        ) AS norm_gastos
    FROM dados d
    CROSS JOIN limites l
)
SELECT
    RANK() OVER (
        ORDER BY (n.norm_votacoes + n.norm_proposicoes + n.norm_gastos) DESC
    )                                                              AS posicao,
    n.sigla_partido                                                AS termo,
    COALESCE(pi.ideologia, 'nao classificado')                     AS ideologia,
    n.votacoes                                                     AS votacoes_bruto,
    n.proposicoes                                                  AS proposicoes_bruto,
    n.gastos                                                       AS gastos_bruto,
    n.norm_votacoes,
    n.norm_proposicoes,
    n.norm_gastos,
    ROUND(n.norm_votacoes + n.norm_proposicoes + n.norm_gastos, 2) AS score_total,
    ROUND(
        (n.norm_votacoes + n.norm_proposicoes + n.norm_gastos) / 3.0, 2
    )                                                              AS frequencia
FROM normalizado n
LEFT JOIN partidos_ideologia pi ON pi.sigla_partido = n.sigla_partido
ORDER BY score_total DESC, n.sigla_partido;
