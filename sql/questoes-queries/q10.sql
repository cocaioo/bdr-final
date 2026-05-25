\o
CREATE OR REPLACE TEMP VIEW resposta_alinhamento_partidos AS
WITH votos_partido AS (
    SELECT
        ano_dados,
        id_votacao,
        sigla_partido,
        SUM(CASE WHEN voto = 'Sim' THEN 1 ELSE 0 END) AS votos_sim,
        SUM(CASE WHEN voto = 'Nao' THEN 1 ELSE 0 END) AS votos_nao
    FROM votacoes_votos
    WHERE sigla_partido IS NOT NULL
      AND voto IN ('Sim', 'Nao')
    GROUP BY ano_dados, id_votacao, sigla_partido
),
maioria AS (
    SELECT
        ano_dados,
        id_votacao,
        sigla_partido,
        CASE WHEN votos_sim >= votos_nao THEN 'Sim' ELSE 'Nao' END AS voto_majoritario
    FROM votos_partido
),
alinhados AS (
    SELECT
        vv.ano_dados,
        vv.sigla_partido,
        COUNT(*) FILTER (WHERE vv.voto = m.voto_majoritario) AS votos_alinhados,
        COUNT(*) AS votos_total
    FROM votacoes_votos vv
    JOIN maioria m
      ON m.ano_dados = vv.ano_dados
     AND m.id_votacao = vv.id_votacao
     AND m.sigla_partido = vv.sigla_partido
    WHERE vv.voto IN ('Sim', 'Nao')
    GROUP BY vv.ano_dados, vv.sigla_partido
)
SELECT
    ano_dados,
    sigla_partido,
    votos_alinhados,
    votos_total,
    ROUND(votos_alinhados::numeric / NULLIF(votos_total, 0), 4) AS alinhamento_interno
FROM alinhados;

\o /respostas/q10_alinhamento_interno_partidos.txt
\qecho Q10 - alinhamento interno dos partidos
\qecho Resumo executivo
SELECT
    ano_dados,
    COUNT(*) AS partidos,
    ROUND(AVG(alinhamento_interno), 4) AS media_alinhamento,
    ROUND(MIN(alinhamento_interno), 4) AS menor_alinhamento,
    ROUND(MAX(alinhamento_interno), 4) AS maior_alinhamento
FROM resposta_alinhamento_partidos
GROUP BY ano_dados
ORDER BY ano_dados;

\qecho
\qecho Tabela principal - partidos por alinhamento interno
SELECT
    ano_dados,
    sigla_partido,
    votos_alinhados,
    votos_total,
    alinhamento_interno
FROM resposta_alinhamento_partidos
ORDER BY ano_dados, alinhamento_interno DESC, votos_total DESC;
