-- Focus queries for class questions: 1, 2, 3, 4, 6, 8, 11
-- This file avoids dependencies on extra tables.
-- For eixo mapping, fill the inline CTE (tema_eixo) below.

SET search_path TO grupo4;

-- ----------------------------------------------------------------------
-- 1) Deputados ordenados por gasto (Z -> A)
-- ----------------------------------------------------------------------

-- N: total nacional
SELECT d.id_dep, d.nome, SUM(g.vlrliquido) AS gasto_total
FROM gastos_2026 g
JOIN deputados d ON d.id_dep = g.nudeputadoid
GROUP BY d.id_dep, d.nome
ORDER BY gasto_total DESC;

-- P: total por partido
SELECT g.sgpartido, d.id_dep, d.nome, SUM(g.vlrliquido) AS gasto_total
FROM gastos_2026 g
JOIN deputados d ON d.id_dep = g.nudeputadoid
GROUP BY g.sgpartido, d.id_dep, d.nome
ORDER BY g.sgpartido, gasto_total DESC;

-- E: total por estado
SELECT g.sguf, d.id_dep, d.nome, SUM(g.vlrliquido) AS gasto_total
FROM gastos_2026 g
JOIN deputados d ON d.id_dep = g.nudeputadoid
GROUP BY g.sguf, d.id_dep, d.nome
ORDER BY g.sguf, gasto_total DESC;

-- ----------------------------------------------------------------------
-- 2) Agrupar deputados por eixo de atuacao
-- ----------------------------------------------------------------------
-- Fill the mapping below. If empty, the query falls back to tema.

WITH tema_eixo AS (
    SELECT NULL::text AS tema, NULL::text AS eixo WHERE false
    -- Example:
    -- SELECT * FROM (VALUES
    -- ('Saude', 'social'),
    -- ('Seguranca Publica', 'seguranca'),
    -- ('Economia', 'economico')
    -- ) AS v(tema, eixo)
)
SELECT
    d.id_dep,
    d.nome,
    COALESCE(te.eixo, t.tema) AS eixo,
    COUNT(DISTINCT p.id) AS qtd_proposicoes
FROM proposicoesautores a
JOIN deputados d ON d.id_dep = a.idautor
JOIN proposicoes_2026 p ON p.id = a.idproposicao
JOIN proposicoestemas_2026 t ON t.uriproposicao = p.uri
LEFT JOIN tema_eixo te ON te.tema = t.tema
GROUP BY d.id_dep, d.nome, COALESCE(te.eixo, t.tema)
ORDER BY d.nome, qtd_proposicoes DESC;

-- ----------------------------------------------------------------------
-- 3) Nuvem de palavras (ementa)
-- ----------------------------------------------------------------------

WITH stopwords AS (
    SELECT word FROM (VALUES
        ('de'),('da'),('do'),('e'),('a'),('o'),('para'),('com'),('que'),('em'),
        ('por'),('na'),('no'),('as'),('os'),('ao'),('aos'),('das'),('dos'),
        ('um'),('uma'),('uns'),('umas'),('se'),('nao'),('mais'),('menos')
    ) AS t(word)
),
tokens AS (
    SELECT
        lower(regexp_replace(w, '[^a-z0-9]+', '', 'g')) AS token
    FROM proposicoes_2026 p,
         regexp_split_to_table(COALESCE(p.ementa, ''), '\\s+') AS w
)
SELECT token, COUNT(*) AS freq
FROM tokens
WHERE token <> ''
  AND length(token) >= 3
  AND token NOT IN (SELECT word FROM stopwords)
GROUP BY token
ORDER BY freq DESC
LIMIT 200;

-- ----------------------------------------------------------------------
-- 4) Como um deputado votou em um tema/eixo especifico
-- ----------------------------------------------------------------------
-- Parameters:
-- :deputado_id, :eixo_or_tema

WITH tema_eixo AS (
    SELECT NULL::text AS tema, NULL::text AS eixo WHERE false
)
SELECT
    vv.deputado_id,
    vv.deputado_nome,
    vv.idvotacao,
    vv.voto,
    COALESCE(te.eixo, t.tema) AS eixo,
    t.tema,
    p.siglatipo,
    p.numero,
    p.ano
FROM votacoesvotos_2026 vv
JOIN votacoesobjetos_2026 vo ON vo.idvotacao = vv.idvotacao
LEFT JOIN proposicoes_2026 p ON p.id = vo.proposicao_id
LEFT JOIN proposicoestemas_2026 t ON t.uriproposicao = p.uri
LEFT JOIN tema_eixo te ON te.tema = t.tema
WHERE vv.deputado_id = :deputado_id
  AND COALESCE(te.eixo, t.tema) = :eixo_or_tema
ORDER BY vv.idvotacao;

-- ----------------------------------------------------------------------
-- 6) Ordenar fornecedores por valores de contrato
-- ----------------------------------------------------------------------

SELECT g.txtfornecedor, SUM(g.vlrliquido) AS total_pago
FROM gastos_2026 g
WHERE g.txtfornecedor IS NOT NULL
GROUP BY g.txtfornecedor
ORDER BY total_pago DESC;

-- ----------------------------------------------------------------------
-- 8) Custo x beneficio
-- ----------------------------------------------------------------------
-- Beneficio = (qtd_proposicoes + aprovadas_autor * 0.2) * presenca_rate
-- presenca_rate = votos_total / max(votos_total)

WITH aprovadas AS (
    SELECT id
    FROM proposicoes_2026
    WHERE descricaosituacao ILIKE '%Aprov%'
),
por_dep AS (
    SELECT a.idautor AS id_dep, COUNT(DISTINCT a.idproposicao) AS aprovadas_autor
    FROM proposicoesautores a
    JOIN aprovadas p ON p.id = a.idproposicao
    WHERE a.idautor IS NOT NULL
    GROUP BY a.idautor
),
base AS (
    SELECT
        d.id_dep,
        d.nome,
        COUNT(DISTINCT a.idproposicao) AS qtd_proposicoes,
        COUNT(DISTINCT vv.idvotacao) AS votos_total,
        SUM(g.vlrliquido) AS gasto_total,
        COALESCE(pd.aprovadas_autor, 0) AS aprovadas_autor
    FROM deputados d
    LEFT JOIN proposicoesautores a ON a.idautor = d.id_dep
    LEFT JOIN votacoesvotos_2026 vv ON vv.deputado_id = d.id_dep
    LEFT JOIN gastos_2026 g ON g.nudeputadoid = d.id_dep
    LEFT JOIN por_dep pd ON pd.id_dep = d.id_dep
    GROUP BY d.id_dep, d.nome, pd.aprovadas_autor
),
scored AS (
    SELECT
        *,
        votos_total::numeric / NULLIF(MAX(votos_total) OVER (), 0) AS presenca_rate,
        (qtd_proposicoes + aprovadas_autor * 0.2) AS prop_score
    FROM base
)
SELECT
    id_dep,
    nome,
    gasto_total,
    (prop_score * presenca_rate) AS beneficio,
    (prop_score * presenca_rate) / NULLIF(gasto_total, 0) AS custo_beneficio
FROM scored
ORDER BY custo_beneficio DESC NULLS LAST;

-- ----------------------------------------------------------------------
-- 11) Alinhamento interno do partido (coesao de voto)
-- ----------------------------------------------------------------------

WITH party_votes AS (
    SELECT
        idvotacao,
        deputado_siglapartido AS partido,
        SUM(CASE WHEN voto = 'Sim' THEN 1 ELSE 0 END) AS sim,
        SUM(CASE WHEN voto = 'Nao' THEN 1 ELSE 0 END) AS nao,
        COUNT(*) AS total
    FROM votacoesvotos_2026
    WHERE deputado_siglapartido IS NOT NULL
      AND voto IN ('Sim', 'Nao')
    GROUP BY idvotacao, deputado_siglapartido
),
party_majority AS (
    SELECT
        idvotacao,
        partido,
        CASE WHEN sim >= nao THEN 'Sim' ELSE 'Nao' END AS majority_vote
    FROM party_votes
),
aligned AS (
    SELECT
        vv.deputado_siglapartido AS partido,
        COUNT(*) FILTER (WHERE vv.voto = pm.majority_vote) AS aligned,
        COUNT(*) AS total
    FROM votacoesvotos_2026 vv
    JOIN party_majority pm
      ON pm.idvotacao = vv.idvotacao
     AND pm.partido = vv.deputado_siglapartido
    WHERE vv.voto IN ('Sim', 'Nao')
    GROUP BY vv.deputado_siglapartido
)
SELECT partido,
       SUM(aligned)::numeric / NULLIF(SUM(total), 0) AS alinhamento
FROM aligned
GROUP BY partido
ORDER BY alinhamento DESC;
