\o

CREATE OR REPLACE TEMP VIEW resposta_deputados_ativos AS
SELECT DISTINCT ano_dados, id_deputado
FROM (
    SELECT ano_dados, id_deputado FROM gastos
    UNION
    SELECT ano_dados, id_deputado FROM votacoes_votos
    UNION
    SELECT ano_dados, id_deputado FROM proposicoes_autores WHERE id_deputado IS NOT NULL
    UNION
    SELECT ano_dados, id_deputado FROM eventos_presenca_deputados
) ativos
WHERE id_deputado IS NOT NULL;

CREATE OR REPLACE TEMP VIEW resposta_gastos_deputado AS
SELECT
    ano_dados,
    id_deputado,
    SUM(valor_liquido) AS gasto_total
FROM gastos
GROUP BY ano_dados, id_deputado;

CREATE OR REPLACE TEMP VIEW resposta_fidelidade_deputado AS
SELECT
    vv.ano_dados,
    vv.id_deputado,
    ROUND(
        100.0 * AVG(
            CASE
                WHEN vv.voto = vo.orientacao THEN 1
                ELSE 0
            END
        ),
        2
    ) AS fidelidade_partidaria
FROM votacoes_votos vv
JOIN votacoes_orientacoes vo
    ON vo.ano_dados = vv.ano_dados
   AND vo.id_votacao = vv.id_votacao
   AND vo.sigla_bancada = vv.sigla_partido
WHERE vv.voto IN ('Sim', 'Nao', 'Abstencao')
  AND vo.orientacao IN ('Sim', 'Nao', 'Abstencao')
GROUP BY vv.ano_dados, vv.id_deputado;

CREATE OR REPLACE TEMP VIEW resposta_proposicoes_deputado AS
SELECT
    ano_dados,
    id_deputado,
    COUNT(DISTINCT id_proposicao) AS qtd_proposicoes
FROM proposicoes_autores
WHERE id_deputado IS NOT NULL
GROUP BY ano_dados, id_deputado;

CREATE OR REPLACE TEMP VIEW resposta_presenca_deputado AS
SELECT
    pr.ano_dados,
    pr.id_deputado,
    COUNT(*) AS presenca_eventos,
    COUNT(*) FILTER (
        WHERE COALESCE(e.descricao_tipo, '') ILIKE '%plenario%'
           OR COALESCE(e.descricao, '') ILIKE '%plenario%'
           OR COALESCE(e.local_camara, '') ILIKE '%plenario%'
    ) AS presenca_plenario
FROM eventos_presenca_deputados pr
LEFT JOIN eventos e
    ON e.ano_dados = pr.ano_dados
   AND e.id_evento = pr.id_evento
GROUP BY pr.ano_dados, pr.id_deputado;

DROP TABLE IF EXISTS tmp_q6_eta_escolaridade_indicadores;

CREATE TEMP TABLE tmp_q6_eta_escolaridade_indicadores AS
SELECT
    a.ano_dados,
    d.id_deputado,
    COALESCE(d.escolaridade, 'Nao informado') AS escolaridade,
    COALESCE(g.gasto_total, 0) AS gasto_total,
    f.fidelidade_partidaria,
    COALESCE(p.qtd_proposicoes, 0) AS qtd_proposicoes,
    COALESCE(pr.presenca_eventos, 0) AS presenca_eventos,
    COALESCE(pr.presenca_plenario, 0) AS presenca_plenario
FROM resposta_deputados_ativos a
JOIN deputados d ON d.id_deputado = a.id_deputado
LEFT JOIN resposta_gastos_deputado g
    ON g.ano_dados = a.ano_dados
   AND g.id_deputado = d.id_deputado
LEFT JOIN resposta_fidelidade_deputado f
    ON f.ano_dados = a.ano_dados
   AND f.id_deputado = d.id_deputado
LEFT JOIN resposta_proposicoes_deputado p
    ON p.ano_dados = a.ano_dados
   AND p.id_deputado = d.id_deputado
LEFT JOIN resposta_presenca_deputado pr
    ON pr.ano_dados = a.ano_dados
   AND pr.id_deputado = d.id_deputado;

CREATE INDEX idx_tmp_q6_eta_escolaridade
    ON tmp_q6_eta_escolaridade_indicadores (escolaridade);

CREATE INDEX idx_tmp_q6_eta_ano_deputado
    ON tmp_q6_eta_escolaridade_indicadores (ano_dados, id_deputado);

ANALYZE tmp_q6_eta_escolaridade_indicadores;

\o /respostas/q6_eta_complementar.txt
\qecho Q6 - analise complementar por eta quadrado
\qecho eta quadrado foi usado porque escolaridade e uma variavel categorica e os indicadores sao numericos.
\qecho eta quadrado mede a forca da associacao entre escolaridade e cada indicador parlamentar.
\qecho A analise indica associacao, nao causalidade.
\qecho A Q6 original continua sendo a analise descritiva por medias; este arquivo e apenas complementar.
\qecho
\qecho Tabela principal - forca da associacao entre escolaridade e indicadores
WITH valores AS (
    SELECT 'gastos' AS indicador, escolaridade, gasto_total::numeric AS valor
    FROM tmp_q6_eta_escolaridade_indicadores
    WHERE escolaridade <> 'Nao informado'

    UNION ALL

    SELECT 'fidelidade_partidaria' AS indicador, escolaridade, fidelidade_partidaria::numeric AS valor
    FROM tmp_q6_eta_escolaridade_indicadores
    WHERE escolaridade <> 'Nao informado'
      AND fidelidade_partidaria IS NOT NULL

    UNION ALL

    SELECT 'numero_proposicoes' AS indicador, escolaridade, qtd_proposicoes::numeric AS valor
    FROM tmp_q6_eta_escolaridade_indicadores
    WHERE escolaridade <> 'Nao informado'

    UNION ALL

    SELECT 'presenca_eventos' AS indicador, escolaridade, presenca_eventos::numeric AS valor
    FROM tmp_q6_eta_escolaridade_indicadores
    WHERE escolaridade <> 'Nao informado'

    UNION ALL

    SELECT 'presenca_plenario' AS indicador, escolaridade, presenca_plenario::numeric AS valor
    FROM tmp_q6_eta_escolaridade_indicadores
    WHERE escolaridade <> 'Nao informado'
),
media_geral AS (
    SELECT
        indicador,
        COUNT(*) AS registros_validos,
        COUNT(DISTINCT escolaridade) AS grupos_escolaridade,
        AVG(valor) AS media_indicador
    FROM valores
    GROUP BY indicador
),
media_grupo AS (
    SELECT
        indicador,
        escolaridade,
        COUNT(*) AS registros_grupo,
        AVG(valor) AS media_escolaridade
    FROM valores
    GROUP BY indicador, escolaridade
),
sq_total AS (
    SELECT
        v.indicador,
        SUM(POWER(v.valor - mg.media_indicador, 2)) AS valor_sq_total
    FROM valores v
    JOIN media_geral mg ON mg.indicador = v.indicador
    GROUP BY v.indicador
),
sq_entre_grupos AS (
    SELECT
        m.indicador,
        SUM(m.registros_grupo * POWER(m.media_escolaridade - mg.media_indicador, 2)) AS valor_sq_entre_grupos
    FROM media_grupo m
    JOIN media_geral mg ON mg.indicador = m.indicador
    GROUP BY m.indicador
),
eta AS (
    SELECT
        mg.indicador,
        mg.registros_validos,
        mg.grupos_escolaridade,
        (seg.valor_sq_entre_grupos / NULLIF(st.valor_sq_total, 0))::numeric AS eta_quadrado
    FROM media_geral mg
    JOIN sq_total st ON st.indicador = mg.indicador
    JOIN sq_entre_grupos seg ON seg.indicador = mg.indicador
)
SELECT
    indicador,
    registros_validos,
    grupos_escolaridade,
    ROUND(eta_quadrado, 4) AS eta_quadrado,
    CASE
        WHEN eta_quadrado < 0.01 THEN 'associacao muito fraca'
        WHEN eta_quadrado < 0.06 THEN 'associacao fraca'
        WHEN eta_quadrado < 0.14 THEN 'associacao moderada'
        ELSE 'associacao forte'
    END AS interpretacao
FROM eta
ORDER BY eta_quadrado DESC NULLS LAST, indicador;

\o
