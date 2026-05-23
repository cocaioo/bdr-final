\o /respostas/q2_eixos_nuvem_palavras.txt
\qecho Q2.1 - deputados por eixo maior de atuacao
WITH q2_1 AS (
    SELECT
        d.id_deputado,
        d.nome,
        te.eixo_maior,
        COUNT(DISTINCT a.id_proposicao) AS qtd_proposicoes
    FROM proposicoes_autores a
    JOIN deputados d ON d.id_deputado = a.id_deputado
    JOIN proposicoes_2026 p ON p.id_proposicao = a.id_proposicao
    JOIN resposta_temas_eixos te ON te.uri_proposicao = p.uri_proposicao
    GROUP BY d.id_deputado, d.nome, te.eixo_maior
)
SELECT *
FROM q2_1
ORDER BY nome, qtd_proposicoes DESC;

\qecho
\qecho Q2.2 - nuvem de palavras das proposicoes
SELECT token, COUNT(*) AS frequencia
FROM resposta_tokens_validos_proposicoes
GROUP BY token
ORDER BY frequencia DESC
LIMIT 200;

\o /respostas/q2_eixo_nuvens_complemento.txt
\qecho Q2 complemento - eixo mais atuante por deputado
WITH eixos_deputado AS (
    SELECT
        d.id_deputado,
        d.nome,
        te.eixo_maior,
        COUNT(DISTINCT a.id_proposicao) AS qtd_proposicoes
    FROM proposicoes_autores a
    JOIN deputados d ON d.id_deputado = a.id_deputado
    JOIN proposicoes_2026 p ON p.id_proposicao = a.id_proposicao
    JOIN resposta_temas_eixos te ON te.uri_proposicao = p.uri_proposicao
    GROUP BY d.id_deputado, d.nome, te.eixo_maior
),
ranked AS (
    SELECT
        *,
        RANK() OVER (
            PARTITION BY id_deputado
            ORDER BY qtd_proposicoes DESC
        ) AS posicao
    FROM eixos_deputado
)
SELECT
    id_deputado,
    nome,
    eixo_maior AS eixo_mais_atuante,
    qtd_proposicoes
FROM ranked
WHERE posicao = 1
ORDER BY nome, eixo_mais_atuante;
