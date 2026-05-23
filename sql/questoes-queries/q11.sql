\o
CREATE OR REPLACE TEMP VIEW resposta_partido_metricas AS
WITH partidos AS (
    SELECT sigla_partido FROM partidos_ideologia
    UNION
    SELECT sigla_partido FROM votacoes_votos_2026 WHERE sigla_partido IS NOT NULL
    UNION
    SELECT sigla_partido FROM proposicoes_autores WHERE sigla_partido IS NOT NULL
    UNION
    SELECT sigla_partido FROM gastos_2026 WHERE sigla_partido IS NOT NULL
),
votacoes AS (
    SELECT
        sigla_partido,
        COUNT(*) AS votos_registrados,
        COUNT(DISTINCT id_deputado) AS deputados_votantes,
        COUNT(DISTINCT id_votacao) AS votacoes
    FROM votacoes_votos_2026
    WHERE sigla_partido IS NOT NULL
    GROUP BY sigla_partido
),
proposicoes AS (
    SELECT
        sigla_partido,
        COUNT(DISTINCT id_proposicao) AS qtd_proposicoes
    FROM proposicoes_autores
    WHERE sigla_partido IS NOT NULL
    GROUP BY sigla_partido
),
gastos AS (
    SELECT
        sigla_partido,
        SUM(valor_liquido) AS gasto_total
    FROM gastos_2026
    GROUP BY sigla_partido
)
SELECT
    p.sigla_partido,
    pi.ideologia,
    COALESCE(v.votos_registrados, 0) AS votos_registrados,
    COALESCE(v.deputados_votantes, 0) AS deputados_votantes,
    COALESCE(v.votacoes, 0) AS votacoes,
    COALESCE(pr.qtd_proposicoes, 0) AS qtd_proposicoes,
    COALESCE(g.gasto_total, 0) AS gasto_total
FROM partidos p
LEFT JOIN partidos_ideologia pi ON pi.sigla_partido = p.sigla_partido
LEFT JOIN votacoes v ON v.sigla_partido = p.sigla_partido
LEFT JOIN proposicoes pr ON pr.sigla_partido = p.sigla_partido
LEFT JOIN gastos g ON g.sigla_partido = p.sigla_partido;

CREATE OR REPLACE TEMP VIEW resposta_tokens_partido AS
SELECT
    a.sigla_partido,
    t.token,
    COUNT(*) AS frequencia
FROM proposicoes_autores a
JOIN resposta_tokens_validos_proposicoes t ON t.id_proposicao = a.id_proposicao
WHERE a.sigla_partido IS NOT NULL
GROUP BY a.sigla_partido, t.token;

\o /respostas/q11_rankings_partidos.txt
\qecho Q11 - rankings partidarios
\qecho Resumo executivo
SELECT
    COUNT(*) AS partidos,
    SUM(votos_registrados) AS votos_registrados,
    SUM(qtd_proposicoes) AS proposicoes,
    SUM(gasto_total) AS gasto_total
FROM resposta_partido_metricas;

\qecho
\qecho Tabela principal - painel compacto por partido
SELECT
    sigla_partido,
    ideologia,
    votos_registrados,
    deputados_votantes,
    votacoes,
    qtd_proposicoes,
    gasto_total,
    RANK() OVER (ORDER BY votos_registrados DESC) AS pos_votos,
    RANK() OVER (ORDER BY qtd_proposicoes DESC) AS pos_proposicoes,
    RANK() OVER (ORDER BY gasto_total DESC) AS pos_gastos
FROM resposta_partido_metricas
ORDER BY votos_registrados DESC;

\qecho
\qecho Complemento enxuto - top palavras por partido
WITH ranked AS (
    SELECT
        sigla_partido,
        token,
        frequencia,
        RANK() OVER (
            PARTITION BY sigla_partido
            ORDER BY frequencia DESC
        ) AS posicao
    FROM resposta_tokens_partido
)
SELECT
    sigla_partido,
    posicao,
    token,
    frequencia
FROM ranked
WHERE posicao <= 10
ORDER BY sigla_partido, posicao, token;

\qecho
\qecho Complemento detalhado: q11_nuvem_palavras_partidos_complemento.txt contem a nuvem completa.

\o /respostas/q11_nuvem_palavras_partidos_complemento.txt
\qecho Q11 complemento - nuvem de palavras completa por partido
SELECT
    sigla_partido,
    token,
    frequencia
FROM resposta_tokens_partido
ORDER BY sigla_partido, frequencia DESC;
