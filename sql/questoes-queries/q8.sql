\o
CREATE OR REPLACE TEMP VIEW resposta_influencia AS
SELECT
    d.id_deputado,
    d.nome,
    p.qtd_proposicoes AS proposicoes_autoria,
    p.proposicoes_aprovadas,
    ROUND(
        100.0 * p.proposicoes_aprovadas / NULLIF(p.qtd_proposicoes, 0),
        2
    ) AS pct_aprovadas
FROM resposta_proposicoes_deputado p
JOIN deputados d ON d.id_deputado = p.id_deputado;

\o /respostas/q8_influencia.txt
\qecho Q8 - influencia legislativa por autoria aprovada
\qecho Resumo executivo
SELECT
    COUNT(*) AS deputados_com_autoria,
    SUM(proposicoes_autoria) AS proposicoes_autoria,
    SUM(proposicoes_aprovadas) AS proposicoes_aprovadas,
    ROUND(100.0 * SUM(proposicoes_aprovadas) / NULLIF(SUM(proposicoes_autoria), 0), 2) AS pct_aprovadas_geral
FROM resposta_influencia;

\qecho
\qecho Tabela principal - top 30 por percentual de aprovacao
SELECT
    id_deputado,
    nome,
    proposicoes_autoria,
    proposicoes_aprovadas,
    pct_aprovadas
FROM resposta_influencia
ORDER BY pct_aprovadas DESC NULLS LAST, proposicoes_aprovadas DESC
LIMIT 30;

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
FROM resposta_influencia
ORDER BY pct_aprovadas DESC NULLS LAST, proposicoes_aprovadas DESC;
