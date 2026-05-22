\pset pager off
\pset null ''

SET search_path TO grupo4;

SELECT 'deputados' AS tabela, COUNT(*) AS linhas FROM deputados
UNION ALL SELECT 'partidos_ideologia', COUNT(*) FROM partidos_ideologia
UNION ALL SELECT 'proposicoes_2026', COUNT(*) FROM proposicoes_2026
UNION ALL SELECT 'eventos_2026', COUNT(*) FROM eventos_2026
UNION ALL SELECT 'votacoes_2026', COUNT(*) FROM votacoes_2026
UNION ALL SELECT 'gastos_2026', COUNT(*) FROM gastos_2026
UNION ALL SELECT 'votacoes_votos_2026', COUNT(*) FROM votacoes_votos_2026
UNION ALL SELECT 'votacoes_orientacoes_2026', COUNT(*) FROM votacoes_orientacoes_2026
UNION ALL SELECT 'votacoes_objetos_2026', COUNT(*) FROM votacoes_objetos_2026
UNION ALL SELECT 'proposicoes_temas_2026', COUNT(*) FROM proposicoes_temas_2026
UNION ALL SELECT 'eventos_presenca_deputados_2026', COUNT(*) FROM eventos_presenca_deputados_2026
UNION ALL SELECT 'proposicoes_autores', COUNT(*) FROM proposicoes_autores
ORDER BY tabela;

SELECT COUNT(*) AS deputados_com_escolaridade
FROM deputados
WHERE escolaridade IS NOT NULL;

SELECT COUNT(*) AS gastos_sem_deputado
FROM gastos_2026 g
LEFT JOIN deputados d ON d.id_deputado = g.id_deputado
WHERE d.id_deputado IS NULL;

SELECT COUNT(*) AS votos_sem_deputado
FROM votacoes_votos_2026 v
LEFT JOIN deputados d ON d.id_deputado = v.id_deputado
WHERE d.id_deputado IS NULL;

SELECT COUNT(*) AS votos_sem_votacao
FROM votacoes_votos_2026 vv
LEFT JOIN votacoes_2026 v ON v.id_votacao = vv.id_votacao
WHERE v.id_votacao IS NULL;

SELECT COUNT(*) AS temas_sem_proposicao
FROM proposicoes_temas_2026 t
LEFT JOIN proposicoes_2026 p ON p.uri_proposicao = t.uri_proposicao
WHERE p.uri_proposicao IS NULL;

SELECT id_votacao, id_deputado, COUNT(*) AS duplicatas
FROM votacoes_votos_2026
GROUP BY id_votacao, id_deputado
HAVING COUNT(*) > 1;
