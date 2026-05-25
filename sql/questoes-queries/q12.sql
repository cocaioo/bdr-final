\o
CREATE OR REPLACE TEMP VIEW resposta_deputado_fornecedor AS
SELECT
    g.ano_dados,
    d.id_deputado,
    d.nome,
    g.fornecedor,
    COUNT(*) AS qtd_lancamentos,
    SUM(g.valor_liquido) AS total_pago
FROM gastos g
JOIN deputados d ON d.id_deputado = g.id_deputado
WHERE g.fornecedor IS NOT NULL
GROUP BY g.ano_dados, d.id_deputado, d.nome, g.fornecedor;

\o /respostas/q12_deputado_fornecedor.txt
\qecho Q12 - deputado x fornecedor
\qecho Resumo executivo
SELECT
    ano_dados,
    COUNT(*) AS pares_deputado_fornecedor,
    COUNT(DISTINCT id_deputado) AS deputados,
    COUNT(DISTINCT fornecedor) AS fornecedores,
    SUM(qtd_lancamentos) AS lancamentos,
    SUM(total_pago) AS total_pago
FROM resposta_deputado_fornecedor
GROUP BY ano_dados
ORDER BY ano_dados;

\qecho
\qecho Tabela principal - top 30 pares por total pago
WITH ranked AS (
    SELECT
        *,
        RANK() OVER (
            PARTITION BY ano_dados
            ORDER BY total_pago DESC
        ) AS posicao,
        SUM(total_pago) OVER (PARTITION BY ano_dados) AS total_ano
    FROM resposta_deputado_fornecedor
)
SELECT
    ano_dados,
    id_deputado,
    nome,
    fornecedor,
    qtd_lancamentos,
    total_pago,
    ROUND(100.0 * total_pago / NULLIF(total_ano, 0), 2) AS pct_total
FROM ranked
WHERE posicao <= 30
ORDER BY ano_dados, total_pago DESC;

\qecho
\qecho Complemento detalhado: q12_deputado_fornecedor_complemento.txt contem o ranking completo.

\o /respostas/q12_deputado_fornecedor_complemento.txt
\qecho Q12 complemento - ranking completo deputado x fornecedor
SELECT
    ano_dados,
    id_deputado,
    nome,
    fornecedor,
    qtd_lancamentos,
    total_pago
FROM resposta_deputado_fornecedor
ORDER BY ano_dados, total_pago DESC;
