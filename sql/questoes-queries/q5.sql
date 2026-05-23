\o
CREATE OR REPLACE TEMP VIEW resposta_fornecedores AS
SELECT
    fornecedor,
    COUNT(*) AS qtd_lancamentos,
    SUM(valor_liquido) AS total_pago
FROM gastos_2026
WHERE fornecedor IS NOT NULL
GROUP BY fornecedor;

\o /respostas/q5_fornecedores.txt
\qecho Q5 - fornecedores com maior total pago
\qecho Resumo executivo
SELECT
    COUNT(*) AS fornecedores,
    SUM(qtd_lancamentos) AS lancamentos,
    SUM(total_pago) AS total_pago,
    ROUND(100.0 * SUM(total_pago) FILTER (
        WHERE posicao <= 10
    ) / NULLIF(SUM(total_pago), 0), 2) AS pct_top_10
FROM (
    SELECT
        *,
        RANK() OVER (ORDER BY total_pago DESC) AS posicao
    FROM resposta_fornecedores
) r;

\qecho
\qecho Tabela principal - top 30 fornecedores por total pago
WITH ranked AS (
    SELECT
        *,
        RANK() OVER (ORDER BY total_pago DESC) AS posicao,
        SUM(total_pago) OVER () AS total_geral
    FROM resposta_fornecedores
)
SELECT
    posicao,
    fornecedor,
    qtd_lancamentos,
    total_pago,
    ROUND(100.0 * total_pago / NULLIF(total_geral, 0), 2) AS pct_total
FROM ranked
WHERE posicao <= 30
ORDER BY total_pago DESC, fornecedor;

\qecho
\qecho Complemento detalhado: q5_fornecedores_complemento.txt contem o ranking completo.

\o /respostas/q5_fornecedores_complemento.txt
\qecho Q5 complemento - ranking completo de fornecedores
SELECT
    fornecedor,
    qtd_lancamentos,
    total_pago
FROM resposta_fornecedores
ORDER BY total_pago DESC;
