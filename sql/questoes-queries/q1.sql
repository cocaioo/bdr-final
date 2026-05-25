\o /respostas/q1_gastos_deputados.txt
SELECT
    g.ano_dados,
    d.id_deputado,
    d.nome,
    g.sigla_uf,
    g.sigla_partido,
    SUM(g.valor_liquido) AS gasto_total
FROM gastos g
JOIN deputados d ON d.id_deputado = g.id_deputado
GROUP BY g.ano_dados, d.id_deputado, d.nome, g.sigla_uf, g.sigla_partido
ORDER BY g.ano_dados, gasto_total DESC;
