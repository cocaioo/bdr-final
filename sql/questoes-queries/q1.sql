\o /respostas/q1_gastos_deputados.txt
\qecho Ranking global - todos os anos
SELECT
    d.id_deputado,
    MAX(d.nome) AS nome,
    MAX(g.sigla_uf) AS sigla_uf,
    MAX(g.sigla_partido) AS sigla_partido,
    SUM(g.valor_liquido) AS gasto_total
FROM gastos g
JOIN deputados d ON d.id_deputado = g.id_deputado
GROUP BY d.id_deputado
ORDER BY gasto_total DESC;
