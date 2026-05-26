\o
CREATE OR REPLACE TEMP VIEW resposta_influencia_global AS
SELECT
    d.id_deputado,
    d.nome,
    SUM(p.qtd_proposicoes) AS proposicoes_autoria,
    SUM(p.proposicoes_aprovadas) AS proposicoes_aprovadas,
    ROUND(
        100.0 * SUM(p.proposicoes_aprovadas) / NULLIF(SUM(p.qtd_proposicoes), 0),
        2
    ) AS pct_aprovadas
FROM resposta_proposicoes_deputado p
JOIN deputados d ON d.id_deputado = p.id_deputado
GROUP BY d.id_deputado, d.nome;

\o /respostas/q8_influencia.txt
\qecho Q8 - influencia legislativa por autoria aprovada
\qecho Resumo executivo
SELECT
    COUNT(*) AS deputados_com_autoria,
    SUM(proposicoes_autoria) AS proposicoes_autoria,
    SUM(proposicoes_aprovadas) AS proposicoes_aprovadas,
    ROUND(100.0 * SUM(proposicoes_aprovadas) / NULLIF(SUM(proposicoes_autoria), 0), 2) AS pct_aprovadas_geral
FROM resposta_influencia_global;

\qecho
\qecho Tabela principal - top 30 por percentual de aprovacao
WITH ranked AS (
    SELECT
        *,
        RANK() OVER (
            ORDER BY pct_aprovadas DESC NULLS LAST, proposicoes_aprovadas DESC
        ) AS posicao
    FROM resposta_influencia_global
)
SELECT
    id_deputado,
    nome,
    proposicoes_autoria,
    proposicoes_aprovadas,
    pct_aprovadas
FROM ranked
WHERE posicao <= 30
ORDER BY pct_aprovadas DESC NULLS LAST, proposicoes_aprovadas DESC;

\qecho
\qecho Complemento detalhado: q8_influencia_complemento.txt contem o ranking completo.

\o /respostas/q8_influencia_complemento.txt
\qecho Q8 complemento - ranking completo de influencia legislativa
SELECT
    id_deputado,
    nome,
    proposicoes_autoria,
    proposicoes_aprovadas,
    pct_aprovadas
FROM resposta_influencia_global
ORDER BY pct_aprovadas DESC NULLS LAST, proposicoes_aprovadas DESC;
