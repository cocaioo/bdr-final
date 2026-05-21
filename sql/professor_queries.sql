-- Professor queries for 2026 data
-- Assumptions to review:
-- N/P/E = National/Party/State scopes (adjust if your class defines differently).
-- Party mapping and theme axis mapping must be filled by you.

SET search_path TO grupo4;

-- ----------------------------------------------------------------------
-- 0) Helper mappings (fill these tables once)
-- ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS grupo4.partido_ideologia (
    siglaPartido VARCHAR(20) PRIMARY KEY,
    ideologia VARCHAR(20) NOT NULL
);

-- TODO: insert your party classification
-- INSERT INTO grupo4.partido_ideologia (siglaPartido, ideologia) VALUES
-- ('PT', 'esquerda'),
-- ('PL', 'direita'),
-- ('PSD', 'centro');

CREATE TABLE IF NOT EXISTS grupo4.tema_eixo (
    tema VARCHAR(150) PRIMARY KEY,
    eixo VARCHAR(50) NOT NULL
);

-- TODO: map each tema to an eixo
-- INSERT INTO grupo4.tema_eixo (tema, eixo) VALUES
-- ('Saude', 'social'),
-- ('Seguranca Publica', 'seguranca');

CREATE TABLE IF NOT EXISTS grupo4.stopwords_pt (
    word TEXT PRIMARY KEY
);

-- TODO: add stopwords
-- INSERT INTO grupo4.stopwords_pt (word) VALUES
-- ('de'),('da'),('do'),('e'),('a'),('o'),('para'),('com');

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
-- 2) Agrupar deputados por eixo de atuacao (needs tema_eixo)
-- ----------------------------------------------------------------------

SELECT d.id_dep, d.nome, e.eixo, COUNT(DISTINCT p.id) AS qtd_proposicoes
FROM proposicoesautores a
JOIN deputados d ON d.id_dep = a.idautor
JOIN proposicoes_2026 p ON p.id = a.idproposicao
JOIN proposicoestemas_2026 t ON t.uriproposicao = p.uri
JOIN tema_eixo e ON e.tema = t.tema
GROUP BY d.id_dep, d.nome, e.eixo
ORDER BY d.nome, qtd_proposicoes DESC;

-- ----------------------------------------------------------------------
-- 3) Nuvem de palavras (ementa). Export result and build wordcloud
-- ----------------------------------------------------------------------

WITH tokens AS (
    SELECT
        lower(regexp_replace(w, '[^a-z0-9]+', '', 'g')) AS token
    FROM proposicoes_2026 p,
         regexp_split_to_table(COALESCE(p.ementa, ''), '\\s+') AS w
)
SELECT token, COUNT(*) AS freq
FROM tokens
WHERE token <> ''
  AND token NOT IN (SELECT word FROM stopwords_pt)
GROUP BY token
ORDER BY freq DESC
LIMIT 200;

-- ----------------------------------------------------------------------
-- 4) Como um deputado votou em um tema/eixo especifico
-- ----------------------------------------------------------------------
-- Parameters:
-- :deputado_id, :eixo

SELECT
    vv.deputado_id,
    vv.deputado_nome,
    vv.idvotacao,
    vv.voto,
    e.eixo,
    t.tema,
    p.siglatipo,
    p.numero,
    p.ano
FROM votacoesvotos_2026 vv
JOIN votacoesobjetos_2026 vo ON vo.idvotacao = vv.idvotacao
LEFT JOIN proposicoes_2026 p ON p.id = vo.proposicao_id
LEFT JOIN proposicoestemas_2026 t ON t.uriproposicao = p.uri
LEFT JOIN tema_eixo e ON e.tema = t.tema
WHERE vv.deputado_id = :deputado_id
  AND e.eixo = :eixo
ORDER BY vv.idvotacao;

-- ----------------------------------------------------------------------
-- 5) Agrupar deputados por escolaridade
-- ----------------------------------------------------------------------

SELECT
    COALESCE(e.grau_instrucao, i.escolaridade) AS escolaridade,
    COUNT(DISTINCT d.id_dep) AS qtd_deputados
FROM deputados d
LEFT JOIN deputado_escolaridade e ON e.iddeputado = d.id_dep OR e.cpf = d.cpf
LEFT JOIN indicadores_deputado_2026 i ON i.iddeputado = d.id_dep
GROUP BY COALESCE(e.grau_instrucao, i.escolaridade)
ORDER BY qtd_deputados DESC;

-- ----------------------------------------------------------------------
-- 6) Ordenar fornecedores por valores de contrato
-- ----------------------------------------------------------------------

SELECT g.txtfornecedor, SUM(g.vlrliquido) AS total_pago
FROM gastos_2026 g
WHERE g.txtfornecedor IS NOT NULL
GROUP BY g.txtfornecedor
ORDER BY total_pago DESC;

-- ----------------------------------------------------------------------
-- 7) Correlacionar escolaridade com gastos, fidelidade, proposicoes, presenca
-- ----------------------------------------------------------------------

WITH base AS (
    SELECT
        d.id_dep,
        COALESCE(e.grau_instrucao, i.escolaridade) AS escolaridade,
        COALESCE(i.gasto_total, SUM(g.vlrliquido)) AS gasto_total,
        i.fidelidade_partidaria,
        i.qtd_proposicoes,
        i.presenca_eventos,
        i.presenca_plenario
    FROM deputados d
    LEFT JOIN deputado_escolaridade e ON e.iddeputado = d.id_dep OR e.cpf = d.cpf
    LEFT JOIN indicadores_deputado_2026 i ON i.iddeputado = d.id_dep
    LEFT JOIN gastos_2026 g ON g.nudeputadoid = d.id_dep
    GROUP BY d.id_dep, COALESCE(e.grau_instrucao, i.escolaridade),
             i.gasto_total, i.fidelidade_partidaria, i.qtd_proposicoes,
             i.presenca_eventos, i.presenca_plenario
)
SELECT
    escolaridade,
    AVG(gasto_total) AS avg_gasto,
    AVG(fidelidade_partidaria) AS avg_fidelidade,
    AVG(qtd_proposicoes) AS avg_proposicoes,
    AVG(presenca_eventos) AS avg_presenca_eventos,
    AVG(presenca_plenario) AS avg_presenca_plenario
FROM base
GROUP BY escolaridade
ORDER BY escolaridade;

-- ----------------------------------------------------------------------
-- 8) Custo x beneficio (score ajustavel)
-- ----------------------------------------------------------------------
-- Benefit = (qtd_proposicoes + aprovadas_autor * 0.2) * presenca_rate
-- presenca_rate = presenca_total / max(presenca_total)

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
        COALESCE(i.qtd_proposicoes, 0) AS qtd_proposicoes,
        COALESCE(i.presenca_eventos, 0) + COALESCE(i.presenca_plenario, 0) AS presenca_total,
        COALESCE(i.gasto_total, SUM(g.vlrliquido)) AS gasto_total,
        COALESCE(pd.aprovadas_autor, 0) AS aprovadas_autor
    FROM deputados d
    LEFT JOIN indicadores_deputado_2026 i ON i.iddeputado = d.id_dep
    LEFT JOIN gastos_2026 g ON g.nudeputadoid = d.id_dep
    LEFT JOIN por_dep pd ON pd.id_dep = d.id_dep
    GROUP BY d.id_dep, d.nome, i.qtd_proposicoes, i.presenca_eventos,
             i.presenca_plenario, i.gasto_total, pd.aprovadas_autor
),
scored AS (
    SELECT
        *,
        presenca_total::numeric / NULLIF(MAX(presenca_total) OVER (), 0) AS presenca_rate,
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
-- 9) Influencia: % de propostas aprovadas por deputado
-- ----------------------------------------------------------------------

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
total AS (
    SELECT COUNT(*) AS total_aprovadas FROM aprovadas
)
SELECT
    d.id_dep,
    d.nome,
    COALESCE(pd.aprovadas_autor, 0) AS aprovadas_autor,
    t.total_aprovadas,
    (COALESCE(pd.aprovadas_autor, 0)::numeric / NULLIF(t.total_aprovadas, 0)) * 100 AS pct
FROM deputados d
LEFT JOIN por_dep pd ON pd.id_dep = d.id_dep
CROSS JOIN total t
ORDER BY pct DESC NULLS LAST;

-- ----------------------------------------------------------------------
-- 10) Vies do deputado (needs partido_ideologia)
-- ----------------------------------------------------------------------

-- Helper view: best-effort party by deputy from gastos
CREATE OR REPLACE VIEW grupo4.vw_deputado_partido AS
SELECT nudeputadoid AS id_dep, sgpartido
FROM (
    SELECT nudeputadoid, sgpartido,
           ROW_NUMBER() OVER (PARTITION BY nudeputadoid ORDER BY COUNT(*) DESC) AS rn
    FROM gastos_2026
    WHERE sgpartido IS NOT NULL
    GROUP BY nudeputadoid, sgpartido
) t
WHERE rn = 1;

SELECT d.id_dep, d.nome, p.sgpartido, i.ideologia
FROM deputados d
LEFT JOIN vw_deputado_partido p ON p.id_dep = d.id_dep
LEFT JOIN partido_ideologia i ON i.siglaPartido = p.sgpartido
ORDER BY d.nome;

-- 10.1) Partido x proposta (por tema/eixo)
SELECT p.sgpartido, e.eixo, COUNT(DISTINCT a.idproposicao) AS qtd
FROM proposicoesautores a
JOIN vw_deputado_partido p ON p.id_dep = a.idautor
JOIN proposicoes_2026 pr ON pr.id = a.idproposicao
JOIN proposicoestemas_2026 t ON t.uriproposicao = pr.uri
JOIN tema_eixo e ON e.tema = t.tema
GROUP BY p.sgpartido, e.eixo
ORDER BY p.sgpartido, qtd DESC;

-- 10.2) Voto do deputado em uma proposicao
-- Parameter: :proposicao_id
SELECT
    vv.deputado_id,
    vv.deputado_nome,
    vv.voto,
    vv.idvotacao
FROM votacoesvotos_2026 vv
JOIN votacoesobjetos_2026 vo ON vo.idvotacao = vv.idvotacao
WHERE vo.proposicao_id = :proposicao_id
ORDER BY vv.deputado_nome;

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
    GROUP BY vv.deputado_siglapartido
)
SELECT partido,
       SUM(aligned)::numeric / NULLIF(SUM(total), 0) AS alinhamento
FROM aligned
GROUP BY partido
ORDER BY alinhamento DESC;

-- ----------------------------------------------------------------------
-- 12) Ordenar partidos por area, proposicoes, gastos, nuvem de palavras
-- ----------------------------------------------------------------------

-- 12a) Por area/eixo
SELECT p.sgpartido, e.eixo, COUNT(DISTINCT a.idproposicao) AS qtd
FROM proposicoesautores a
JOIN vw_deputado_partido p ON p.id_dep = a.idautor
JOIN proposicoes_2026 pr ON pr.id = a.idproposicao
JOIN proposicoestemas_2026 t ON t.uriproposicao = pr.uri
JOIN tema_eixo e ON e.tema = t.tema
GROUP BY p.sgpartido, e.eixo
ORDER BY p.sgpartido, qtd DESC;

-- 12b) Por proposicoes (volume)
SELECT p.sgpartido, COUNT(DISTINCT a.idproposicao) AS qtd_proposicoes
FROM proposicoesautores a
JOIN vw_deputado_partido p ON p.id_dep = a.idautor
GROUP BY p.sgpartido
ORDER BY qtd_proposicoes DESC;

-- 12c) Por gastos
SELECT g.sgpartido, SUM(g.vlrliquido) AS gasto_total
FROM gastos_2026 g
GROUP BY g.sgpartido
ORDER BY gasto_total DESC;

-- 12d) Nuvem de palavras por partido (ementa)
WITH party_props AS (
    SELECT p.sgpartido, pr.ementa
    FROM proposicoesautores a
    JOIN vw_deputado_partido p ON p.id_dep = a.idautor
    JOIN proposicoes_2026 pr ON pr.id = a.idproposicao
),
party_tokens AS (
    SELECT
        sgpartido,
        lower(regexp_replace(w, '[^a-z0-9]+', '', 'g')) AS token
    FROM party_props,
         regexp_split_to_table(COALESCE(ementa, ''), '\\s+') AS w
)
SELECT sgpartido, token, COUNT(*) AS freq
FROM party_tokens
WHERE token <> ''
  AND token NOT IN (SELECT word FROM stopwords_pt)
GROUP BY sgpartido, token
ORDER BY sgpartido, freq DESC;

-- ----------------------------------------------------------------------
-- 13) Correlacionar deputado com fornecedor
-- ----------------------------------------------------------------------

SELECT d.id_dep, d.nome, g.txtfornecedor, SUM(g.vlrliquido) AS total_pago
FROM gastos_2026 g
JOIN deputados d ON d.id_dep = g.nudeputadoid
WHERE g.txtfornecedor IS NOT NULL
GROUP BY d.id_dep, d.nome, g.txtfornecedor
ORDER BY d.nome, total_pago DESC;

-- ----------------------------------------------------------------------
-- 14) Com o que o deputado mais gasta (categoria)
-- ----------------------------------------------------------------------

SELECT d.id_dep, d.nome, g.txtdescricao, SUM(g.vlrliquido) AS total_pago
FROM gastos_2026 g
JOIN deputados d ON d.id_dep = g.nudeputadoid
WHERE g.txtdescricao IS NOT NULL
GROUP BY d.id_dep, d.nome, g.txtdescricao
ORDER BY d.nome, total_pago DESC;
