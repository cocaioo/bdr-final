\o /query-staging/q9_vies_deputado.txt
\qecho Q9 - Vies ideologico dos deputados por score, faixa e campo ideologico

-- =======================================================================
-- Q9.1 - Classificacao completa dos partidos por ideologia
-- =======================================================================
\qecho
\qecho Q9.1 - Catalogo de partidos por faixa e campo ideologico

SELECT
    ideologia_faixa,
    campo_ideologico,
    ROUND(AVG(ideologia_score), 3) AS ideologia_score_medio,
    COUNT(*) AS qtd_partidos,
    string_agg(sigla_partido, ', ' ORDER BY sigla_partido) AS partidos
FROM partidos_ideologia
GROUP BY ideologia_faixa, campo_ideologico
ORDER BY MIN(ideologia_score) NULLS LAST, ideologia_faixa, campo_ideologico;

\qecho
\qecho Q9.1 - Lista completa partidos x ideologia

SELECT
    sigla_partido,
    ideologia_score,
    ideologia_faixa,
    campo_ideologico,
    fonte_ideologia,
    tipo_match_ideologia
FROM partidos_ideologia
ORDER BY ideologia_score NULLS LAST, sigla_partido;

-- =======================================================================
-- Q9.2 - Correlacao ideologia x proposicao
-- Para cada votacao, calcula o percentual de votos "Sim" por faixa
-- ideologica e preserva tambem o campo macro.
-- =======================================================================
\qecho
\qecho Q9.2 - Correlacao ideologia x proposicao (pct de Sim por faixa e campo)

WITH votos_classif AS (
    SELECT
        vv.ano_dados,
        vv.id_votacao,
        pi.ideologia_faixa,
        pi.campo_ideologico,
        ROUND(AVG(pi.ideologia_score), 3) AS ideologia_score_medio,
        COUNT(*) FILTER (WHERE vv.voto = 'Sim') AS votos_sim,
        COUNT(*) FILTER (WHERE vv.voto = 'Nao') AS votos_nao,
        COUNT(*) FILTER (WHERE vv.voto NOT IN ('Sim', 'Nao')) AS outros,
        COUNT(*) AS total_votos
    FROM votacoes_votos vv
    JOIN partidos_ideologia pi ON pi.sigla_partido = vv.sigla_partido
    GROUP BY vv.ano_dados, vv.id_votacao, pi.ideologia_faixa, pi.campo_ideologico
),
objetos AS (
    SELECT DISTINCT ON (ano_dados, id_votacao)
        ano_dados,
        id_votacao,
        titulo_proposicao,
        ementa_proposicao
    FROM votacoes_objetos
    ORDER BY ano_dados, id_votacao, id_votacao_objeto
)
SELECT
    vc.ano_dados,
    vc.id_votacao,
    COALESCE(ob.titulo_proposicao, '(sem proposicao vinculada)') AS titulo_proposicao,
    vc.ideologia_score_medio,
    vc.ideologia_faixa,
    vc.campo_ideologico,
    vc.votos_sim,
    vc.votos_nao,
    vc.outros,
    vc.total_votos,
    ROUND(vc.votos_sim * 100.0 / NULLIF(vc.total_votos, 0), 1) AS pct_sim
FROM votos_classif vc
LEFT JOIN objetos ob
    ON ob.ano_dados = vc.ano_dados
   AND ob.id_votacao = vc.id_votacao
ORDER BY vc.ano_dados, vc.id_votacao, vc.ideologia_score_medio NULLS LAST, vc.ideologia_faixa;

-- =======================================================================
-- Q9.3 - Resumo consolidado de votos e aderencia por deputado
-- =======================================================================
\qecho
\qecho Q9.3 - Resumo consolidado de votos e aderencia por deputado

WITH voto_detalhado AS (
    SELECT
        vv.ano_dados,
        vv.id_votacao,
        vv.id_deputado,
        vv.nome_deputado,
        vv.sigla_partido,
        pi.ideologia_score,
        pi.ideologia_faixa,
        pi.campo_ideologico,
        vv.voto,
        vo.orientacao                                          AS orientacao_bancada,
        CASE
            WHEN vo.orientacao IS NULL
                THEN 'Sem orientacao registrada'
            WHEN vo.orientacao IN ('Liberado', 'Abstencao', 'Obstrucao')
                THEN 'Liberado/Abstencao'
            WHEN vv.voto = vo.orientacao
                THEN 'Seguiu'
            ELSE 'Contrariou'
        END                                                    AS aderiu_orientacao
    FROM votacoes_votos vv
    JOIN partidos_ideologia pi
        ON pi.sigla_partido = vv.sigla_partido
    LEFT JOIN votacoes_orientacoes vo
        ON vo.ano_dados   = vv.ano_dados
       AND vo.id_votacao  = vv.id_votacao
       AND vo.sigla_bancada = vv.sigla_partido
)
SELECT
    sigla_partido,
    id_deputado,
    nome_deputado,
    ideologia_score,
    ideologia_faixa,
    campo_ideologico,
    COUNT(*) AS total_votos,
    COUNT(*) FILTER (WHERE voto = 'Sim') AS votos_sim,
    COUNT(*) FILTER (WHERE voto = 'Nao') AS votos_nao,
    COUNT(*) FILTER (WHERE voto NOT IN ('Sim', 'Nao')) AS outros_votos,
    COUNT(*) FILTER (WHERE aderiu_orientacao = 'Seguiu') AS seguiu_orientacao,
    COUNT(*) FILTER (WHERE aderiu_orientacao = 'Contrariou') AS contrariou_orientacao,
    ROUND(COUNT(*) FILTER (WHERE aderiu_orientacao = 'Seguiu') * 100.0 / NULLIF(COUNT(*) FILTER (WHERE aderiu_orientacao IN ('Seguiu', 'Contrariou')), 0), 1) AS pct_aderencia_partido
FROM voto_detalhado
GROUP BY sigla_partido, id_deputado, nome_deputado, ideologia_score, ideologia_faixa, campo_ideologico
ORDER BY sigla_partido, nome_deputado;

-- =======================================================================
-- Q9.3 - Voto de cada deputado por proposicao (Detalhe para Auditoria)
-- =======================================================================
\o /query-staging/q9_vies_deputado_detalhe.csv
\pset format csv

WITH voto_detalhado AS (
    SELECT
        vv.ano_dados,
        vv.id_votacao,
        vv.id_deputado,
        vv.nome_deputado,
        vv.sigla_partido,
        pi.ideologia_score,
        pi.ideologia_faixa,
        pi.campo_ideologico,
        vv.voto,
        vo.orientacao                                          AS orientacao_bancada,
        CASE
            WHEN vo.orientacao IS NULL
                THEN 'Sem orientacao registrada'
            WHEN vo.orientacao IN ('Liberado', 'Abstencao', 'Obstrucao')
                THEN 'Liberado/Abstencao'
            WHEN vv.voto = vo.orientacao
                THEN 'Seguiu'
            ELSE 'Contrariou'
        END                                                    AS aderiu_orientacao
    FROM votacoes_votos vv
    JOIN partidos_ideologia pi
        ON pi.sigla_partido = vv.sigla_partido
    LEFT JOIN votacoes_orientacoes vo
        ON vo.ano_dados   = vv.ano_dados
       AND vo.id_votacao  = vv.id_votacao
       AND vo.sigla_bancada = vv.sigla_partido
),
objetos AS (
    SELECT DISTINCT ON (ano_dados, id_votacao)
        ano_dados,
        id_votacao,
        titulo_proposicao,
        ementa_proposicao
    FROM votacoes_objetos
    ORDER BY ano_dados, id_votacao, id_votacao_objeto
)
SELECT
    vd.ano_dados,
    vd.id_votacao,
    COALESCE(ob.titulo_proposicao, '(sem proposicao vinculada)') AS titulo_proposicao,
    vd.id_deputado,
    vd.nome_deputado,
    vd.sigla_partido,
    vd.ideologia_score,
    vd.ideologia_faixa,
    vd.campo_ideologico,
    vd.voto,
    COALESCE(vd.orientacao_bancada, '-')                       AS orientacao_bancada,
    vd.aderiu_orientacao
FROM voto_detalhado vd
LEFT JOIN objetos ob
    ON ob.ano_dados  = vd.ano_dados
   AND ob.id_votacao = vd.id_votacao
ORDER BY
    vd.ano_dados,
    vd.id_votacao,
    vd.ideologia_score NULLS LAST,
    vd.sigla_partido,
    vd.nome_deputado;
