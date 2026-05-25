\o /respostas/q2_eixos_nuvem_palavras.txt
\qecho Q2.1 - deputados por eixo maior de atuacao
WITH q2_1 AS (
    SELECT
        a.ano_dados,
        d.id_deputado,
        d.nome,
        te.eixo_maior,
        COUNT(DISTINCT (a.ano_dados, a.id_proposicao)) AS qtd_proposicoes
    FROM proposicoes_autores a
    JOIN deputados d ON d.id_deputado = a.id_deputado
    JOIN proposicoes p
      ON p.ano_dados = a.ano_dados
     AND p.id_proposicao = a.id_proposicao
    JOIN resposta_temas_eixos te
      ON te.ano_dados = p.ano_dados
     AND te.uri_proposicao = p.uri_proposicao
    GROUP BY a.ano_dados, d.id_deputado, d.nome, te.eixo_maior
)
SELECT *
FROM q2_1
ORDER BY ano_dados, nome, qtd_proposicoes DESC;

\qecho
\qecho Q2.2 - nuvem de palavras das proposicoes
WITH ranked AS (
    SELECT
        ano_dados,
        token,
        COUNT(*) AS frequencia,
        ROW_NUMBER() OVER (
            PARTITION BY ano_dados
            ORDER BY COUNT(*) DESC, token
        ) AS posicao
    FROM resposta_tokens_validos_proposicoes
    GROUP BY ano_dados, token
)
SELECT
    ano_dados,
    token,
    frequencia
FROM ranked
WHERE posicao <= 200
ORDER BY ano_dados, frequencia DESC, token;

\o /respostas/q2_eixo_nuvens_complemento.txt
\qecho Q2 complemento - eixo mais atuante por deputado
WITH eixos_deputado AS (
    SELECT
        a.ano_dados,
        d.id_deputado,
        d.nome,
        te.eixo_maior,
        COUNT(DISTINCT (a.ano_dados, a.id_proposicao)) AS qtd_proposicoes
    FROM proposicoes_autores a
    JOIN deputados d ON d.id_deputado = a.id_deputado
    JOIN proposicoes p
      ON p.ano_dados = a.ano_dados
     AND p.id_proposicao = a.id_proposicao
    JOIN resposta_temas_eixos te
      ON te.ano_dados = p.ano_dados
     AND te.uri_proposicao = p.uri_proposicao
    GROUP BY a.ano_dados, d.id_deputado, d.nome, te.eixo_maior
),
ranked AS (
    SELECT
        *,
        RANK() OVER (
            PARTITION BY ano_dados, id_deputado
            ORDER BY qtd_proposicoes DESC
        ) AS posicao
    FROM eixos_deputado
)
SELECT
    ano_dados,
    id_deputado,
    nome,
    eixo_maior AS eixo_mais_atuante,
    qtd_proposicoes
FROM ranked
WHERE posicao = 1
ORDER BY ano_dados, nome, eixo_mais_atuante;
