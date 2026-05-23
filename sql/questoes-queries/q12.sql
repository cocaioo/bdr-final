\o
CREATE OR REPLACE TEMP VIEW resposta_deputado_fornecedor AS
SELECT
    d.id_deputado,
    d.nome,
    g.fornecedor,
    COUNT(*) AS qtd_lancamentos,
    SUM(g.valor_liquido) AS total_pago
FROM gastos_2026 g
JOIN deputados d ON d.id_deputado = g.id_deputado
WHERE g.fornecedor IS NOT NULL
GROUP BY d.id_deputado, d.nome, g.fornecedor;

\o /respostas/q12_deputado_fornecedor.txt
\qecho Q12 - deputado x fornecedor
\qecho Resumo executivo
SELECT
    COUNT(*) AS pares_deputado_fornecedor,
    COUNT(DISTINCT id_deputado) AS deputados,
    COUNT(DISTINCT fornecedor) AS fornecedores,
    SUM(qtd_lancamentos) AS lancamentos,
    SUM(total_pago) AS total_pago
FROM resposta_deputado_fornecedor;

\qecho
\qecho Tabela principal - top 30 pares por total pago
SELECT
    id_deputado,
    nome,
    fornecedor,
    qtd_lancamentos,
    total_pago,
    ROUND(100.0 * total_pago / SUM(total_pago) OVER (), 2) AS pct_total
FROM resposta_deputado_fornecedor
ORDER BY total_pago DESC
LIMIT 30;

\qecho
\qecho Complemento detalhado: q12_deputado_fornecedor_complemento.txt contem o ranking completo.

\o /respostas/q12_deputado_fornecedor_complemento.txt
\qecho Q12 complemento - ranking completo deputado x fornecedor
SELECT
    id_deputado,
    nome,
    fornecedor,
    qtd_lancamentos,
    total_pago
FROM resposta_deputado_fornecedor
ORDER BY total_pago DESC;
