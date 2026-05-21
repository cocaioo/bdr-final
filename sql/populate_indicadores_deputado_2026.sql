-- Popula a tabela calculada indicadores_deputado_2026
-- Usa gastos, votacoes, autoria, presenca e escolaridade quando disponiveis.

SET search_path TO grupo4;

TRUNCATE TABLE grupo4.indicadores_deputado_2026;

WITH gastos AS (
    SELECT
        g.nudeputadoid AS id_deputado,
        SUM(g.vlrliquido) AS gasto_total,
        MAX(g.sgpartido) AS partido,
        MAX(g.sguf) AS uf
    FROM grupo4.gastos_2026 g
    GROUP BY g.nudeputadoid
),
votos AS (
    SELECT
        vv.deputado_id AS id_deputado,
        MAX(vv.deputado_siglapartido) AS partido,
        MAX(vv.deputado_siglauf) AS uf,
        COUNT(DISTINCT vv.idvotacao) AS presenca_plenario
    FROM grupo4.votacoesvotos_2026 vv
    GROUP BY vv.deputado_id
),
autoria AS (
    SELECT
        a.idautor AS id_deputado,
        COUNT(DISTINCT a.idproposicao) AS qtd_proposicoes
    FROM grupo4.proposicoesautores a
    WHERE a.idautor IS NOT NULL
    GROUP BY a.idautor
),
presenca_eventos AS (
    SELECT
        ep.iddeputado AS id_deputado,
        COUNT(DISTINCT ep.idevento) AS presenca_eventos
    FROM grupo4.eventospresencadeputados_2026 ep
    GROUP BY ep.iddeputado
),
party_votes AS (
    SELECT
        vv.idvotacao,
        vv.deputado_siglapartido AS partido,
        SUM(CASE WHEN vv.voto = 'Sim' THEN 1 ELSE 0 END) AS votos_sim,
        SUM(CASE WHEN vv.voto = 'Nao' THEN 1 ELSE 0 END) AS votos_nao
    FROM grupo4.votacoesvotos_2026 vv
    WHERE vv.deputado_siglapartido IS NOT NULL
      AND vv.voto IN ('Sim', 'Nao')
    GROUP BY vv.idvotacao, vv.deputado_siglapartido
),
party_majority AS (
    SELECT
        idvotacao,
        partido,
        CASE WHEN votos_sim >= votos_nao THEN 'Sim' ELSE 'Nao' END AS majority_vote
    FROM party_votes
),
fidelidade AS (
    SELECT
        vv.deputado_id AS id_deputado,
        ROUND(
            100.0 * COUNT(*) FILTER (WHERE vv.voto = pm.majority_vote) / NULLIF(COUNT(*), 0),
            2
        ) AS fidelidade_partidaria
    FROM grupo4.votacoesvotos_2026 vv
    JOIN party_majority pm
      ON pm.idvotacao = vv.idvotacao
     AND pm.partido = vv.deputado_siglapartido
    WHERE vv.voto IN ('Sim', 'Nao')
    GROUP BY vv.deputado_id
)
INSERT INTO grupo4.indicadores_deputado_2026 (
    iddeputado,
    nome,
    partido,
    uf,
    escolaridade,
    gasto_total,
    fidelidade_partidaria,
    qtd_proposicoes,
    presenca_eventos,
    presenca_plenario
)
SELECT
    d.id_dep,
    d.nome,
    COALESCE(g.partido, v.partido) AS partido,
    COALESCE(g.uf, v.uf) AS uf,
    esc.grau_instrucao AS escolaridade,
    COALESCE(g.gasto_total, 0) AS gasto_total,
    f.fidelidade_partidaria,
    COALESCE(a.qtd_proposicoes, 0) AS qtd_proposicoes,
    COALESCE(pe.presenca_eventos, 0) AS presenca_eventos,
    COALESCE(v.presenca_plenario, 0) AS presenca_plenario
FROM grupo4.deputados d
LEFT JOIN gastos g ON g.id_deputado = d.id_dep
LEFT JOIN votos v ON v.id_deputado = d.id_dep
LEFT JOIN autoria a ON a.id_deputado = d.id_dep
LEFT JOIN presenca_eventos pe ON pe.id_deputado = d.id_dep
LEFT JOIN fidelidade f ON f.id_deputado = d.id_dep
LEFT JOIN LATERAL (
    SELECT e.grau_instrucao
    FROM grupo4.deputado_escolaridade e
    WHERE e.iddeputado = d.id_dep OR e.cpf = d.cpf
    ORDER BY CASE WHEN e.iddeputado = d.id_dep THEN 0 ELSE 1 END
    LIMIT 1
) esc ON true
ORDER BY d.id_dep;

SELECT COUNT(*) AS indicadores_carregados
FROM grupo4.indicadores_deputado_2026;