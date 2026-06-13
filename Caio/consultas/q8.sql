\o

CREATE OR REPLACE TEMP VIEW resposta_proposicoes_situacoes AS
SELECT
    ano_dados,
    id_proposicao,
    CASE
        WHEN COALESCE(descricao_situacao, '') ILIKE '%aprov%'
          OR COALESCE(descricao_situacao, '') ILIKE '%sancao%'
          OR COALESCE(descricao_situacao, '') ILIKE '%norma juridica%'
          OR COALESCE(descricao_situacao, '') ILIKE '%promulg%'
        THEN 'aprovada'
        ELSE 'outra'
    END AS categoria_situacao
FROM proposicoes;

CREATE OR REPLACE TEMP VIEW resposta_proposicoes_deputado AS
SELECT
    pa.ano_dados,
    pa.id_deputado,
    COUNT(DISTINCT pa.id_proposicao) AS qtd_proposicoes,
    COUNT(DISTINCT pa.id_proposicao) FILTER (
        WHERE ps.categoria_situacao = 'aprovada'
    ) AS proposicoes_aprovadas
FROM proposicoes_autores pa
LEFT JOIN resposta_proposicoes_situacoes ps
    ON ps.ano_dados = pa.ano_dados
   AND ps.id_proposicao = pa.id_proposicao
WHERE pa.id_deputado IS NOT NULL
GROUP BY pa.ano_dados, pa.id_deputado;

CREATE OR REPLACE TEMP VIEW resposta_total_proposicoes_aprovadas AS
SELECT COUNT(DISTINCT (ano_dados, id_proposicao)) AS total_aprovadas
FROM resposta_proposicoes_situacoes
WHERE categoria_situacao = 'aprovada';

CREATE OR REPLACE TEMP VIEW resposta_influencia_global AS
SELECT
    d.id_deputado,
    d.nome,
    SUM(p.qtd_proposicoes) AS proposicoes_autoria,
    SUM(p.proposicoes_aprovadas) AS proposicoes_aprovadas,
    ROUND(
        100.0 * SUM(p.proposicoes_aprovadas) / NULLIF(t.total_aprovadas, 0),
        2
    ) AS pct_aprovadas
FROM resposta_proposicoes_deputado p
JOIN deputados d ON d.id_deputado = p.id_deputado
CROSS JOIN resposta_total_proposicoes_aprovadas t
GROUP BY d.id_deputado, d.nome, t.total_aprovadas;

\o /respostas/q8_influencia.txt
\qecho Q8 - influencia legislativa por participacao no total aprovado
\qecho Resumo executivo
SELECT
    COUNT(*) AS deputados_com_autoria,
    SUM(proposicoes_autoria) AS proposicoes_autoria,
    MAX(t.total_aprovadas) AS proposicoes_aprovadas_global,
    COUNT(*) FILTER (WHERE proposicoes_aprovadas > 0) AS deputados_com_proposicoes_aprovadas
FROM resposta_influencia_global
CROSS JOIN resposta_total_proposicoes_aprovadas t;

\qecho
\qecho Tabela principal - top 30 por participacao no total aprovado
WITH ranked AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            ORDER BY pct_aprovadas DESC NULLS LAST, proposicoes_aprovadas DESC, nome ASC, id_deputado ASC
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
ORDER BY pct_aprovadas DESC NULLS LAST, proposicoes_aprovadas DESC, nome ASC, id_deputado ASC;

\qecho
\qecho Complemento detalhado: q8_influencia_complemento.txt contem o ranking completo.

\o /respostas/q8_influencia_complemento.txt
\qecho Q8 complemento - ranking completo de influencia legislativa global
SELECT
    id_deputado,
    nome,
    proposicoes_autoria,
    proposicoes_aprovadas,
    pct_aprovadas
FROM resposta_influencia_global
ORDER BY pct_aprovadas DESC NULLS LAST, proposicoes_aprovadas DESC, nome ASC, id_deputado ASC;

\o
