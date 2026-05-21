-- ============================================================
-- Views Analíticas — Câmara dos Deputados (Grupo 4)
-- ============================================================

-- 1. Gastos totais por deputado
CREATE OR REPLACE VIEW grupo4.vw_gastos_por_deputado AS
SELECT
    g.nudeputadoid,
    d.nome AS deputado_nome,
    g.sguf,
    g.sgpartido,
    COUNT(*) AS qtd_gastos,
    SUM(g.vlrliquido) AS gasto_total,
    AVG(g.vlrliquido) AS gasto_medio
FROM grupo4.gastos_2026 g
LEFT JOIN grupo4.deputados d ON d.id_dep = g.nudeputadoid
GROUP BY g.nudeputadoid, d.nome, g.sguf, g.sgpartido;

-- 2. Gastos por partido
CREATE OR REPLACE VIEW grupo4.vw_gastos_por_partido AS
SELECT
    g.sgpartido,
    COUNT(DISTINCT g.nudeputadoid) AS qtd_deputados,
    COUNT(*) AS qtd_gastos,
    SUM(g.vlrliquido) AS gasto_total,
    AVG(g.vlrliquido) AS gasto_medio
FROM grupo4.gastos_2026 g
GROUP BY g.sgpartido
ORDER BY gasto_total DESC;

-- 3. Gastos por UF
CREATE OR REPLACE VIEW grupo4.vw_gastos_por_uf AS
SELECT
    g.sguf,
    COUNT(DISTINCT g.nudeputadoid) AS qtd_deputados,
    SUM(g.vlrliquido) AS gasto_total,
    AVG(g.vlrliquido) AS gasto_medio
FROM grupo4.gastos_2026 g
GROUP BY g.sguf
ORDER BY gasto_total DESC;

-- 4. Resumo de votações (votos Sim/Não/Outros)
CREATE OR REPLACE VIEW grupo4.vw_votacoes_resumo AS
SELECT
    v.id,
    v.data,
    v.siglaorgao,
    v.aprovacao,
    COUNT(*) FILTER (WHERE vv.voto = 'Sim') AS votos_sim,
    COUNT(*) FILTER (WHERE vv.voto ILIKE '%não%' OR vv.voto = 'Nao') AS votos_nao,
    COUNT(*) AS votos_total
FROM grupo4.votacoes_2026 v
LEFT JOIN grupo4.votacoesvotos_2026 vv ON vv.idvotacao = v.id
GROUP BY v.id, v.data, v.siglaorgao, v.aprovacao;

-- 5. Proposições por tema
CREATE OR REPLACE VIEW grupo4.vw_proposicoes_por_tema AS
SELECT
    t.tema,
    COUNT(DISTINCT t.uriproposicao) AS qtd_proposicoes
FROM grupo4.proposicoestemas_2026 t
GROUP BY t.tema
ORDER BY qtd_proposicoes DESC;

-- 6. Top 10 deputados por gasto total
CREATE OR REPLACE VIEW grupo4.vw_top_gastadores AS
SELECT
    g.nudeputadoid,
    d.nome,
    g.sgpartido,
    g.sguf,
    SUM(g.vlrliquido) AS gasto_total
FROM grupo4.gastos_2026 g
LEFT JOIN grupo4.deputados d ON d.id_dep = g.nudeputadoid
GROUP BY g.nudeputadoid, d.nome, g.sgpartido, g.sguf
ORDER BY gasto_total DESC
LIMIT 10;

-- 7. Participação em votações por deputado
CREATE OR REPLACE VIEW grupo4.vw_participacao_votacoes AS
SELECT
    vv.deputado_id,
    vv.deputado_nome,
    vv.deputado_siglapartido AS partido,
    vv.deputado_siglauf AS uf,
    COUNT(DISTINCT vv.idvotacao) AS votacoes_participadas,
    COUNT(*) FILTER (WHERE vv.voto = 'Sim') AS votos_sim,
    COUNT(*) FILTER (WHERE vv.voto ILIKE '%não%' OR vv.voto = 'Nao') AS votos_nao
FROM grupo4.votacoesvotos_2026 vv
GROUP BY vv.deputado_id, vv.deputado_nome, vv.deputado_siglapartido, vv.deputado_siglauf;

-- 8. Autoria de proposições por deputado
CREATE OR REPLACE VIEW grupo4.vw_autoria_por_deputado AS
SELECT
    a.idautor,
    a.nomeautor,
    COUNT(DISTINCT a.idproposicao) AS qtd_proposicoes
FROM grupo4.proposicoesautores a
WHERE a.tipoautor = 'Deputado(a)'
GROUP BY a.idautor, a.nomeautor
ORDER BY qtd_proposicoes DESC;

-- 9. Fornecedores mais frequentes
CREATE OR REPLACE VIEW grupo4.vw_fornecedores_frequentes AS
SELECT
    g.txtfornecedor,
    COUNT(*) AS qtd_gastos,
    SUM(g.vlrliquido) AS valor_total
FROM grupo4.gastos_2026 g
WHERE g.txtfornecedor IS NOT NULL
GROUP BY g.txtfornecedor
ORDER BY valor_total DESC;
