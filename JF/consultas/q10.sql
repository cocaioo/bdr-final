\o /respostas/q10_alinhamento_partidos.txt
\qecho Q10 - Alinhamento interno dos partidos
\qecho (Qual partido convence mais seus deputados a seguir a orientacao partidaria)

-- =======================================================================
-- Metodologia:
--   1. Considera apenas votacoes em que o partido emitiu orientacao
--      explicita (exclui "Liberado", "Abstencao", "Obstrucao").
--   2. Para cada voto com diretriz, verifica se o deputado votou
--      igual a orientacao do partido.
--   3. Calcula o percentual de alinhamento por partido.
--   4. Ordena do mais disciplinado ao menos disciplinado.
-- =======================================================================

-- -----------------------------------------------------------------------
-- Q10 - Ranking geral de alinhamento interno (todos os anos)
-- -----------------------------------------------------------------------
\qecho
\qecho Q10 - Ranking de alinhamento interno - consolidado (2023-2026)

WITH votos_com_diretriz AS (
    SELECT
        vv.ano_dados,
        vv.id_votacao,
        vv.id_deputado,
        vv.nome_deputado,
        vv.sigla_partido,
        vv.voto,
        vo.orientacao AS orientacao_partido
    FROM votacoes_votos vv
    JOIN votacoes_orientacoes vo
        ON vo.ano_dados  = vv.ano_dados
       AND vo.id_votacao = vv.id_votacao
       AND (
           -- caso 1: bancada individual (correspondencia exata)
           vo.sigla_bancada = vv.sigla_partido
           -- caso 2: federacao/bloco que contem o partido como componente
           OR vo.sigla_bancada LIKE '%' || vv.sigla_partido || '%'
       )
    WHERE
        -- exclui orientacoes sem diretriz clara
        vo.orientacao NOT IN ('Liberado', 'Abstencao', 'Obstrucao')
        -- exclui votos tecnicos/ausencias
        AND vv.voto NOT IN ('Abstencao', 'Artigo 17', 'Obstrucao')
),
alinhamento AS (
    SELECT
        sigla_partido,
        COUNT(DISTINCT id_deputado)                                   AS qtd_deputados,
        COUNT(*)                                                       AS total_votos_com_diretriz,
        COUNT(*) FILTER (WHERE voto = orientacao_partido)             AS votos_alinhados,
        COUNT(*) FILTER (WHERE voto != orientacao_partido)            AS votos_contrarios
    FROM votos_com_diretriz
    GROUP BY sigla_partido
)
SELECT
    RANK() OVER (ORDER BY
        ROUND(a.votos_alinhados * 100.0 / NULLIF(a.total_votos_com_diretriz, 0), 2) DESC
    )                                                                  AS posicao,
    a.sigla_partido,
    COALESCE(pi.ideologia, 'nao classificado')                         AS ideologia,
    a.qtd_deputados,
    a.total_votos_com_diretriz,
    a.votos_alinhados,
    a.votos_contrarios,
    ROUND(a.votos_alinhados * 100.0 / NULLIF(a.total_votos_com_diretriz, 0), 2) AS pct_alinhamento
FROM alinhamento a
LEFT JOIN partidos_ideologia pi ON pi.sigla_partido = a.sigla_partido
ORDER BY pct_alinhamento DESC, a.sigla_partido;

-- -----------------------------------------------------------------------
-- Q10 - Alinhamento por ano (evolucao temporal)
-- -----------------------------------------------------------------------
\qecho
\qecho Q10 - Alinhamento interno por ano

WITH votos_com_diretriz AS (
    SELECT
        vv.ano_dados,
        vv.id_votacao,
        vv.id_deputado,
        vv.sigla_partido,
        vv.voto,
        vo.orientacao AS orientacao_partido
    FROM votacoes_votos vv
    JOIN votacoes_orientacoes vo
        ON vo.ano_dados  = vv.ano_dados
       AND vo.id_votacao = vv.id_votacao
       AND (
           vo.sigla_bancada = vv.sigla_partido
           OR vo.sigla_bancada LIKE '%' || vv.sigla_partido || '%'
       )
    WHERE
        vo.orientacao NOT IN ('Liberado', 'Abstencao', 'Obstrucao')
        AND vv.voto NOT IN ('Abstencao', 'Artigo 17', 'Obstrucao')
),
alinhamento_ano AS (
    SELECT
        ano_dados,
        sigla_partido,
        COUNT(*)                                              AS total_votos,
        COUNT(*) FILTER (WHERE voto = orientacao_partido)    AS votos_alinhados
    FROM votos_com_diretriz
    GROUP BY ano_dados, sigla_partido
)
SELECT
    aa.ano_dados,
    aa.sigla_partido,
    COALESCE(pi.ideologia, 'nao classificado')               AS ideologia,
    aa.total_votos,
    aa.votos_alinhados,
    ROUND(aa.votos_alinhados * 100.0 / NULLIF(aa.total_votos, 0), 2) AS pct_alinhamento
FROM alinhamento_ano aa
LEFT JOIN partidos_ideologia pi ON pi.sigla_partido = aa.sigla_partido
ORDER BY aa.ano_dados, pct_alinhamento DESC, aa.sigla_partido;

-- -----------------------------------------------------------------------
-- Q10 - Detalhe por deputado: indice de disciplina individual
-- (Util para identificar deputados mais infieis ao partido)
-- -----------------------------------------------------------------------
\qecho
\qecho Q10 - Disciplina individual dos deputados

WITH votos_com_diretriz AS (
    SELECT
        vv.ano_dados,
        vv.id_votacao,
        vv.id_deputado,
        vv.nome_deputado,
        vv.sigla_partido,
        vv.voto,
        vo.orientacao AS orientacao_partido
    FROM votacoes_votos vv
    JOIN votacoes_orientacoes vo
        ON vo.ano_dados  = vv.ano_dados
       AND vo.id_votacao = vv.id_votacao
       AND (
           vo.sigla_bancada = vv.sigla_partido
           OR vo.sigla_bancada LIKE '%' || vv.sigla_partido || '%'
       )
    WHERE
        vo.orientacao NOT IN ('Liberado', 'Abstencao', 'Obstrucao')
        AND vv.voto NOT IN ('Abstencao', 'Artigo 17', 'Obstrucao')
),
disciplina_dep AS (
    SELECT
        id_deputado,
        nome_deputado,
        sigla_partido,
        COUNT(*)                                              AS total_votos_com_diretriz,
        COUNT(*) FILTER (WHERE voto = orientacao_partido)    AS votos_alinhados
    FROM votos_com_diretriz
    GROUP BY id_deputado, nome_deputado, sigla_partido
)
SELECT
    dd.sigla_partido,
    COALESCE(pi.ideologia, 'nao classificado')               AS ideologia,
    dd.id_deputado,
    dd.nome_deputado,
    dd.total_votos_com_diretriz,
    dd.votos_alinhados,
    ROUND(dd.votos_alinhados * 100.0 / NULLIF(dd.total_votos_com_diretriz, 0), 2) AS pct_disciplina_individual
FROM disciplina_dep dd
LEFT JOIN partidos_ideologia pi ON pi.sigla_partido = dd.sigla_partido
ORDER BY dd.sigla_partido, pct_disciplina_individual DESC, dd.nome_deputado;
