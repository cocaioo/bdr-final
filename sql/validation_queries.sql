\pset pager off
\pset null ''

SET search_path TO grupo4;

SELECT 'deputados' AS tabela, COUNT(*) AS linhas FROM deputados
UNION ALL SELECT 'partidos_ideologia', COUNT(*) FROM partidos_ideologia
UNION ALL SELECT 'proposicoes', COUNT(*) FROM proposicoes
UNION ALL SELECT 'eventos', COUNT(*) FROM eventos
UNION ALL SELECT 'votacoes', COUNT(*) FROM votacoes
UNION ALL SELECT 'gastos', COUNT(*) FROM gastos
UNION ALL SELECT 'votacoes_votos', COUNT(*) FROM votacoes_votos
UNION ALL SELECT 'votacoes_orientacoes', COUNT(*) FROM votacoes_orientacoes
UNION ALL SELECT 'votacoes_objetos', COUNT(*) FROM votacoes_objetos
UNION ALL SELECT 'proposicoes_temas', COUNT(*) FROM proposicoes_temas
UNION ALL SELECT 'eventos_presenca_deputados', COUNT(*) FROM eventos_presenca_deputados
UNION ALL SELECT 'proposicoes_autores', COUNT(*) FROM proposicoes_autores
ORDER BY tabela;

SELECT tabela, ano_dados, linhas
FROM (
    SELECT 'proposicoes' AS tabela, ano_dados, COUNT(*) AS linhas FROM proposicoes GROUP BY ano_dados
    UNION ALL SELECT 'eventos', ano_dados, COUNT(*) FROM eventos GROUP BY ano_dados
    UNION ALL SELECT 'votacoes', ano_dados, COUNT(*) FROM votacoes GROUP BY ano_dados
    UNION ALL SELECT 'gastos', ano_dados, COUNT(*) FROM gastos GROUP BY ano_dados
    UNION ALL SELECT 'votacoes_votos', ano_dados, COUNT(*) FROM votacoes_votos GROUP BY ano_dados
    UNION ALL SELECT 'votacoes_orientacoes', ano_dados, COUNT(*) FROM votacoes_orientacoes GROUP BY ano_dados
    UNION ALL SELECT 'votacoes_objetos', ano_dados, COUNT(*) FROM votacoes_objetos GROUP BY ano_dados
    UNION ALL SELECT 'proposicoes_temas', ano_dados, COUNT(*) FROM proposicoes_temas GROUP BY ano_dados
    UNION ALL SELECT 'eventos_presenca_deputados', ano_dados, COUNT(*) FROM eventos_presenca_deputados GROUP BY ano_dados
    UNION ALL SELECT 'proposicoes_autores', ano_dados, COUNT(*) FROM proposicoes_autores GROUP BY ano_dados
) s
ORDER BY tabela, ano_dados;

SELECT COUNT(*) AS deputados_com_escolaridade
FROM deputados
WHERE escolaridade IS NOT NULL;

SELECT COUNT(*) AS gastos_sem_deputado
FROM gastos g
LEFT JOIN deputados d ON d.id_deputado = g.id_deputado
WHERE d.id_deputado IS NULL;

SELECT COUNT(*) AS votos_sem_deputado
FROM votacoes_votos v
LEFT JOIN deputados d ON d.id_deputado = v.id_deputado
WHERE d.id_deputado IS NULL;

SELECT COUNT(*) AS votos_sem_votacao
FROM votacoes_votos vv
LEFT JOIN votacoes v
  ON v.ano_dados = vv.ano_dados
 AND v.id_votacao = vv.id_votacao
WHERE v.id_votacao IS NULL;

SELECT COUNT(*) AS temas_sem_proposicao
FROM proposicoes_temas t
LEFT JOIN proposicoes p
  ON p.ano_dados = t.ano_dados
 AND p.uri_proposicao = t.uri_proposicao
WHERE p.uri_proposicao IS NULL;

SELECT ano_dados, id_votacao, id_deputado, COUNT(*) AS duplicatas
FROM votacoes_votos
GROUP BY ano_dados, id_votacao, id_deputado
HAVING COUNT(*) > 1;
