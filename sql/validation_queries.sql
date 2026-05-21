-- Row counts
SELECT 'deputados' AS table, COUNT(*) AS rows FROM grupo4.deputados
UNION ALL
SELECT 'proposicoes_2026', COUNT(*) FROM grupo4.proposicoes_2026
UNION ALL
SELECT 'eventos_2026', COUNT(*) FROM grupo4.eventos_2026
UNION ALL
SELECT 'votacoes_2026', COUNT(*) FROM grupo4.votacoes_2026
UNION ALL
SELECT 'gastos_2026', COUNT(*) FROM grupo4.gastos_2026
UNION ALL
SELECT 'votacoesvotos_2026', COUNT(*) FROM grupo4.votacoesvotos_2026
UNION ALL
SELECT 'votacoesorientacoes_2026', COUNT(*) FROM grupo4.votacoesorientacoes_2026
UNION ALL
SELECT 'votacoesobjetos_2026', COUNT(*) FROM grupo4.votacoesobjetos_2026
UNION ALL
SELECT 'votacoesproposicoes_2026', COUNT(*) FROM grupo4.votacoesproposicoes_2026
UNION ALL
SELECT 'proposicoestemas_2026', COUNT(*) FROM grupo4.proposicoestemas_2026
UNION ALL
SELECT 'eventospresencadeputados_2026', COUNT(*) FROM grupo4.eventospresencadeputados_2026
UNION ALL
SELECT 'deputado_escolaridade', COUNT(*) FROM grupo4.deputado_escolaridade
UNION ALL
SELECT 'proposicoesautores', COUNT(*) FROM grupo4.proposicoesautores;

-- FK checks
SELECT COUNT(*) AS missing_evento
FROM grupo4.votacoes_2026 v
LEFT JOIN grupo4.eventos_2026 e ON v.idevento = e.idevento
WHERE v.idevento IS NOT NULL AND e.idevento IS NULL;

SELECT COUNT(*) AS missing_deputado_gastos
FROM grupo4.gastos_2026 g
LEFT JOIN grupo4.deputados d ON g.nudeputadoid = d.id_dep
WHERE g.nudeputadoid IS NOT NULL AND d.id_dep IS NULL;

SELECT COUNT(*) AS missing_deputado_votos
FROM grupo4.votacoesvotos_2026 vv
LEFT JOIN grupo4.deputados d ON vv.deputado_id = d.id_dep
WHERE vv.deputado_id IS NOT NULL AND d.id_dep IS NULL;

SELECT COUNT(*) AS missing_votacao_votos
FROM grupo4.votacoesvotos_2026 vv
LEFT JOIN grupo4.votacoes_2026 v ON vv.idvotacao = v.id
WHERE vv.idvotacao IS NOT NULL AND v.id IS NULL;

SELECT COUNT(*) AS missing_proposicao_temas
FROM grupo4.proposicoestemas_2026 t
LEFT JOIN grupo4.proposicoes_2026 p ON t.uriproposicao = p.uri
WHERE t.uriproposicao IS NOT NULL AND p.uri IS NULL;

-- Duplicates check for composite PKs
SELECT idvotacao, deputado_id, COUNT(*) AS cnt
FROM grupo4.votacoesvotos_2026
GROUP BY idvotacao, deputado_id
HAVING COUNT(*) > 1;
