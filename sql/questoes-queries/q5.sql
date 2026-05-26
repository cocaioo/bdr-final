\o
CREATE OR REPLACE TEMP VIEW resposta_fornecedores AS
SELECT
    ano_dados,
    REPLACE(fornecedor, '|', '/') AS fornecedor,
    COUNT(*) AS qtd_lancamentos,
    SUM(valor_liquido) AS total_pago
FROM gastos
WHERE fornecedor IS NOT NULL
GROUP BY ano_dados, REPLACE(fornecedor, '|', '/');

\o /respostas/q5_fornecedores.txt
\qecho Q5 - fornecedores com maior total pago
\qecho Resumo executivo
SELECT
    ano_dados,
    COUNT(*) AS fornecedores,
    SUM(qtd_lancamentos) AS lancamentos,
    SUM(total_pago) AS total_pago,
    ROUND(100.0 * SUM(total_pago) FILTER (
        WHERE posicao <= 10
    ) / NULLIF(SUM(total_pago), 0), 2) AS pct_top_10
FROM (
    SELECT
        ano_dados,
        fornecedor,
        qtd_lancamentos,
        total_pago,
        RANK() OVER (PARTITION BY ano_dados ORDER BY total_pago DESC) AS posicao
    FROM resposta_fornecedores
) r
GROUP BY ano_dados
ORDER BY ano_dados;

\qecho
\qecho Tabela principal - top 30 fornecedores por total pago
WITH ranked AS (
    SELECT
        ano_dados,
        fornecedor,
        qtd_lancamentos,
        total_pago,
        RANK() OVER (PARTITION BY ano_dados ORDER BY total_pago DESC) AS posicao,
        SUM(total_pago) OVER (PARTITION BY ano_dados) AS total_geral
    FROM resposta_fornecedores
)
SELECT
    ano_dados,
    posicao,
    fornecedor,
    qtd_lancamentos,
    total_pago,
    ROUND(100.0 * total_pago / NULLIF(total_geral, 0), 2) AS pct_total
FROM ranked
WHERE posicao <= 30
ORDER BY ano_dados, total_pago DESC, fornecedor;

\qecho
\qecho Ranking global - todos os anos
WITH global_totais AS (
    SELECT
        fornecedor,
        SUM(qtd_lancamentos) AS qtd_lancamentos,
        SUM(total_pago) AS total_pago
    FROM resposta_fornecedores
    GROUP BY fornecedor
),
ranked AS (
    SELECT
        *,
        RANK() OVER (ORDER BY total_pago DESC) AS posicao,
        SUM(total_pago) OVER () AS total_geral
    FROM global_totais
)
SELECT
    'GLOBAL' AS ano_dados,
    posicao,
    fornecedor,
    qtd_lancamentos,
    total_pago,
    ROUND(100.0 * total_pago / NULLIF(total_geral, 0), 2) AS pct_total
FROM ranked
ORDER BY total_pago DESC, fornecedor;

\qecho
\qecho Complemento detalhado: q5_fornecedores_complemento.txt contem o ranking completo.

\o /respostas/q5_fornecedores_complemento.txt
\qecho Q5 complemento - ranking completo de fornecedores
SELECT
    ano_dados,
    fornecedor,
    qtd_lancamentos,
    total_pago
FROM resposta_fornecedores
ORDER BY ano_dados, total_pago DESC;
