\o
CREATE OR REPLACE TEMP VIEW resposta_alinhamento_partidos_global AS
WITH votos_partido AS (
    SELECT
        id_votacao,
        sigla_partido,
        SUM(CASE WHEN voto = 'Sim' THEN 1 ELSE 0 END) AS votos_sim,
        SUM(CASE WHEN voto = 'Nao' THEN 1 ELSE 0 END) AS votos_nao
    FROM votacoes_votos
    WHERE sigla_partido IS NOT NULL
      AND voto IN ('Sim', 'Nao')
    GROUP BY id_votacao, sigla_partido
),
maioria AS (
    SELECT
        id_votacao,
        sigla_partido,
        CASE WHEN votos_sim >= votos_nao THEN 'Sim' ELSE 'Nao' END AS voto_majoritario
    FROM votos_partido
),
alinhados AS (
    SELECT
        vv.sigla_partido,
        COUNT(*) FILTER (WHERE vv.voto = m.voto_majoritario) AS votos_alinhados,
        COUNT(*) AS votos_total
    FROM votacoes_votos vv
    JOIN maioria m
      ON m.id_votacao = vv.id_votacao
     AND m.sigla_partido = vv.sigla_partido
    WHERE vv.voto IN ('Sim', 'Nao')
    GROUP BY vv.sigla_partido
)
SELECT
    sigla_partido,
    votos_alinhados,
    votos_total,
    ROUND(votos_alinhados::numeric / NULLIF(votos_total, 0), 4) AS alinhamento_interno
FROM alinhados;

\o /respostas/q10_alinhamento_interno_partidos.txt
\qecho Q10 - alinhamento interno dos partidos
\qecho Resumo executivo
SELECT
    COUNT(*) AS partidos,
    ROUND(AVG(alinhamento_interno), 4) AS media_alinhamento,
    ROUND(MIN(alinhamento_interno), 4) AS menor_alinhamento,
    ROUND(MAX(alinhamento_interno), 4) AS maior_alinhamento
FROM resposta_alinhamento_partidos_global;

\qecho
\qecho Tabela principal - partidos por alinhamento interno global
SELECT
    sigla_partido,
    votos_alinhados,
    votos_total,
    alinhamento_interno
FROM resposta_alinhamento_partidos_global
ORDER BY alinhamento_interno DESC, votos_total DESC;
