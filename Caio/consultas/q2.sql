\o /respostas/q2_eixos_nuvem_palavras.txt
\qecho Q2 - eixos tematicos, nuvens de palavras e atuacao parlamentar
\qecho Resumo executivo - periodo consolidado
WITH proposicoes_eixo AS (
    SELECT DISTINCT
        a.ano_dados,
        a.id_proposicao,
        a.id_deputado,
        d.nome,
        te.eixo_maior,
        COALESCE(s.categoria_situacao = 'aprovada', false) AS aprovada
    FROM proposicoes_autores a
    JOIN deputados d ON d.id_deputado = a.id_deputado
    JOIN proposicoes p
      ON p.ano_dados = a.ano_dados
     AND p.id_proposicao = a.id_proposicao
    JOIN resposta_temas_eixos te
      ON te.ano_dados = p.ano_dados
     AND te.uri_proposicao = p.uri_proposicao
    LEFT JOIN resposta_proposicoes_situacoes s
      ON s.ano_dados = p.ano_dados
     AND s.id_proposicao = p.id_proposicao
    WHERE a.ano_dados BETWEEN 2023 AND 2026
      AND a.id_deputado IS NOT NULL
)
SELECT
    '2023-2026' AS periodo,
    COUNT(DISTINCT id_deputado) AS deputados,
    COUNT(DISTINCT eixo_maior) AS eixos,
    COUNT(DISTINCT (id_deputado, eixo_maior)) AS registros_deputado_eixo,
    COUNT(DISTINCT (ano_dados, id_proposicao, id_deputado, eixo_maior)) AS proposicoes,
    COUNT(DISTINCT (ano_dados, id_proposicao, id_deputado, eixo_maior)) FILTER (WHERE aprovada) AS proposicoes_aprovadas
FROM proposicoes_eixo;

\qecho
\qecho Tabela analitica - deputados por eixo tematico (2023-2026)
WITH proposicoes_eixo AS (
    SELECT DISTINCT
        a.ano_dados,
        a.id_proposicao,
        a.id_deputado,
        d.nome,
        te.eixo_maior,
        COALESCE(s.categoria_situacao = 'aprovada', false) AS aprovada
    FROM proposicoes_autores a
    JOIN deputados d ON d.id_deputado = a.id_deputado
    JOIN proposicoes p
      ON p.ano_dados = a.ano_dados
     AND p.id_proposicao = a.id_proposicao
    JOIN resposta_temas_eixos te
      ON te.ano_dados = p.ano_dados
     AND te.uri_proposicao = p.uri_proposicao
    LEFT JOIN resposta_proposicoes_situacoes s
      ON s.ano_dados = p.ano_dados
     AND s.id_proposicao = p.id_proposicao
    WHERE a.ano_dados BETWEEN 2023 AND 2026
      AND a.id_deputado IS NOT NULL
),
consolidado AS (
    SELECT
        id_deputado,
        nome,
        eixo_maior,
        COUNT(DISTINCT (ano_dados, id_proposicao)) AS qtd_proposicoes,
        COUNT(DISTINCT (ano_dados, id_proposicao)) FILTER (WHERE aprovada) AS proposicoes_aprovadas
    FROM proposicoes_eixo
    GROUP BY id_deputado, nome, eixo_maior
),
ranked AS (
    SELECT
        *,
        MAX(qtd_proposicoes) OVER (PARTITION BY id_deputado) AS maior_qtd_deputado
    FROM consolidado
),
labels AS (
    SELECT
        id_deputado,
        string_agg(eixo_maior, ', ' ORDER BY eixo_maior) AS eixo_mais_atuante_deputado
    FROM ranked
    WHERE qtd_proposicoes = maior_qtd_deputado
    GROUP BY id_deputado
)
SELECT
    r.id_deputado,
    r.nome,
    r.eixo_maior,
    r.qtd_proposicoes,
    r.proposicoes_aprovadas,
    CASE WHEN r.qtd_proposicoes = r.maior_qtd_deputado THEN 'Sim' ELSE 'Nao' END AS maior_atuacao_no_eixo,
    l.eixo_mais_atuante_deputado
FROM ranked r
JOIN labels l ON l.id_deputado = r.id_deputado
ORDER BY r.qtd_proposicoes DESC, r.proposicoes_aprovadas DESC, r.nome, r.eixo_maior;

\qecho
\qecho Q2.2 - termos para nuvens de palavras por ano
WITH ranked AS (
    SELECT
        t.ano_dados,
        t.token,
        COUNT(*) AS frequencia,
        ROW_NUMBER() OVER (
            PARTITION BY t.ano_dados
            ORDER BY COUNT(*) DESC, t.token
        ) AS posicao
    FROM resposta_tokens_validos_proposicoes t
    JOIN proposicoes p
      ON p.ano_dados = t.ano_dados
     AND p.id_proposicao = t.id_proposicao
    JOIN resposta_temas_eixos te
      ON te.ano_dados = p.ano_dados
     AND te.uri_proposicao = p.uri_proposicao
    WHERE t.ano_dados BETWEEN 2023 AND 2026
      AND EXISTS (
          SELECT 1 
          FROM proposicoes_autores a
          JOIN deputados d ON d.id_deputado = a.id_deputado
          WHERE a.ano_dados = p.ano_dados
            AND a.id_proposicao = p.id_proposicao
      )
    GROUP BY t.ano_dados, t.token
)
SELECT
    ano_dados,
    token,
    frequencia
FROM ranked
WHERE posicao <= 200
ORDER BY ano_dados, frequencia DESC, token;

\o /respostas/q2_eixo_nuvens_complemento.txt
\qecho Q2 complemento - eixo mais atuante por deputado no periodo 2023-2026
\qecho Eixo mais atuante por deputado - consolidado
WITH proposicoes_eixo AS (
    SELECT DISTINCT
        a.ano_dados,
        a.id_proposicao,
        a.id_deputado,
        d.nome,
        te.eixo_maior,
        COALESCE(s.categoria_situacao = 'aprovada', false) AS aprovada
    FROM proposicoes_autores a
    JOIN deputados d ON d.id_deputado = a.id_deputado
    JOIN proposicoes p
      ON p.ano_dados = a.ano_dados
     AND p.id_proposicao = a.id_proposicao
    JOIN resposta_temas_eixos te
      ON te.ano_dados = p.ano_dados
     AND te.uri_proposicao = p.uri_proposicao
    LEFT JOIN resposta_proposicoes_situacoes s
      ON s.ano_dados = p.ano_dados
     AND s.id_proposicao = p.id_proposicao
    WHERE a.ano_dados BETWEEN 2023 AND 2026
      AND a.id_deputado IS NOT NULL
),
consolidado AS (
    SELECT
        id_deputado,
        nome,
        eixo_maior,
        COUNT(DISTINCT (ano_dados, id_proposicao)) AS qtd_proposicoes,
        COUNT(DISTINCT (ano_dados, id_proposicao)) FILTER (WHERE aprovada) AS proposicoes_aprovadas
    FROM proposicoes_eixo
    GROUP BY id_deputado, nome, eixo_maior
),
ranked AS (
    SELECT
        *,
        RANK() OVER (
            PARTITION BY id_deputado
            ORDER BY qtd_proposicoes DESC
        ) AS posicao
    FROM consolidado
)
SELECT
    id_deputado,
    nome,
    eixo_maior AS eixo_mais_atuante,
    qtd_proposicoes,
    proposicoes_aprovadas
FROM ranked
WHERE posicao = 1
ORDER BY nome, eixo_mais_atuante;
