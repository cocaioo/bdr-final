\o /respostas/q4_escolaridade.txt
SELECT
    a.ano_dados,
    COALESCE(d.escolaridade, 'Nao informado') AS escolaridade,
    COUNT(*) AS qtd_deputados
FROM resposta_deputados_ativos a
JOIN deputados d ON d.id_deputado = a.id_deputado
GROUP BY a.ano_dados, COALESCE(d.escolaridade, 'Nao informado')
ORDER BY a.ano_dados, qtd_deputados DESC;

\o /respostas/q4_escolaridade_complementar.txt
SELECT
    a.ano_dados,
    COALESCE(d.escolaridade, 'Nao informado') AS escolaridade,
    d.id_deputado,
    d.nome
FROM resposta_deputados_ativos a
JOIN deputados d ON d.id_deputado = a.id_deputado
ORDER BY a.ano_dados, COALESCE(d.escolaridade, 'Nao informado'), d.nome;
