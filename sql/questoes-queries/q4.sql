\o /respostas/q4_escolaridade.txt
WITH deputados_ativos_global AS (
    SELECT DISTINCT id_deputado
    FROM resposta_deputados_ativos
)
SELECT
    COALESCE(d.escolaridade, 'Nao informado') AS escolaridade,
    COUNT(*) AS qtd_deputados
FROM deputados_ativos_global a
JOIN deputados d ON d.id_deputado = a.id_deputado
GROUP BY COALESCE(d.escolaridade, 'Nao informado')
ORDER BY qtd_deputados DESC, escolaridade;

\o /respostas/q4_escolaridade_complementar.txt
WITH deputados_ativos_global AS (
    SELECT DISTINCT id_deputado
    FROM resposta_deputados_ativos
)
SELECT
    COALESCE(d.escolaridade, 'Nao informado') AS escolaridade,
    d.id_deputado,
    d.nome
FROM deputados_ativos_global a
JOIN deputados d ON d.id_deputado = a.id_deputado
ORDER BY COALESCE(d.escolaridade, 'Nao informado'), d.nome;
