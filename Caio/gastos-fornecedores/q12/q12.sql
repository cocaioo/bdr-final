-- =============================================================================
-- Q12 - DEPUTADO X FORNECEDOR
-- Universo: 57a legislatura (2023-2027), Cota Parlamentar (CEAP)
--
-- Regra metodologica:
--   - usa apenas gasto efetivo (valor_liquido > 0), para ficar alinhado com
--     Q5 e Q13; isso exclui estornos, glosas e ajustes com valor <= 0;
--   - preserva o rotulo do fornecedor como veio no gasto, sem consolidacao
--     entre grafias, porque aqui o foco e a rastreabilidade do par.
-- =============================================================================

\o

CREATE OR REPLACE TEMP VIEW resposta_gastos_validos_q12 AS
SELECT
    ano_dados,
    id_deputado,
    sigla_uf,
    sigla_partido,
    fornecedor,
    valor_liquido
FROM gastos
WHERE valor_liquido > 0;

CREATE OR REPLACE TEMP VIEW resposta_perfil_deputado_ano_q12 AS
WITH base AS (
    SELECT
        ano_dados,
        id_deputado,
        sigla_uf,
        sigla_partido,
        COUNT(*) AS ocorrencias
    FROM resposta_gastos_validos_q12
    GROUP BY ano_dados, id_deputado, sigla_uf, sigla_partido
),
ranked AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY ano_dados, id_deputado
            ORDER BY ocorrencias DESC, sigla_uf, sigla_partido
        ) AS posicao
    FROM base
)
SELECT
    ano_dados,
    id_deputado,
    sigla_uf,
    sigla_partido
FROM ranked
WHERE posicao = 1;

CREATE OR REPLACE TEMP VIEW resposta_perfil_deputado_global_q12 AS
WITH base AS (
    SELECT
        id_deputado,
        sigla_uf,
        sigla_partido,
        COUNT(*) AS ocorrencias
    FROM resposta_gastos_validos_q12
    GROUP BY id_deputado, sigla_uf, sigla_partido
),
ranked AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY id_deputado
            ORDER BY ocorrencias DESC, sigla_uf, sigla_partido
        ) AS posicao
    FROM base
)
SELECT
    id_deputado,
    sigla_uf,
    sigla_partido
FROM ranked
WHERE posicao = 1;

CREATE OR REPLACE TEMP VIEW resposta_deputado_fornecedor AS
SELECT
    g.ano_dados,
    d.id_deputado,
    d.nome,
    perfil.sigla_uf,
    perfil.sigla_partido,
    REPLACE(g.fornecedor, '|', '/') AS fornecedor,
    COUNT(*) AS qtd_lancamentos,
    SUM(g.valor_liquido) AS total_pago
FROM resposta_gastos_validos_q12 g
JOIN deputados d ON d.id_deputado = g.id_deputado
LEFT JOIN resposta_perfil_deputado_ano_q12 perfil
    ON perfil.ano_dados = g.ano_dados
   AND perfil.id_deputado = g.id_deputado
WHERE g.fornecedor IS NOT NULL
  AND BTRIM(g.fornecedor) <> ''
GROUP BY
    g.ano_dados,
    d.id_deputado,
    d.nome,
    perfil.sigla_uf,
    perfil.sigla_partido,
    REPLACE(g.fornecedor, '|', '/');

\o /query-staging/q12_deputado_fornecedor.txt
\qecho Q12 - deputado x fornecedor
\qecho Resumo executivo
SELECT
    ano_dados,
    COUNT(*) AS pares_deputado_fornecedor,
    COUNT(DISTINCT id_deputado) AS deputados,
    COUNT(DISTINCT fornecedor) AS fornecedores,
    SUM(qtd_lancamentos) AS lancamentos,
    ROUND(SUM(total_pago)::NUMERIC, 2) AS total_pago
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
    sigla_uf,
    sigla_partido,
    fornecedor,
    qtd_lancamentos,
    ROUND(total_pago::NUMERIC, 2) AS total_pago,
    ROUND(100.0 * total_pago / NULLIF(total_ano, 0), 2) AS pct_total
FROM ranked
WHERE posicao <= 30
ORDER BY ano_dados, total_pago DESC;

\qecho
\qecho Ranking global - todos os anos
WITH global_totais AS (
    SELECT
        r.id_deputado,
        MAX(r.nome) AS nome,
        perfil.sigla_uf,
        perfil.sigla_partido,
        r.fornecedor,
        SUM(r.qtd_lancamentos) AS qtd_lancamentos,
        SUM(r.total_pago) AS total_pago
    FROM resposta_deputado_fornecedor r
    LEFT JOIN resposta_perfil_deputado_global_q12 perfil
        ON perfil.id_deputado = r.id_deputado
    GROUP BY
        r.id_deputado,
        perfil.sigla_uf,
        perfil.sigla_partido,
        r.fornecedor
),
ranked AS (
    SELECT
        *,
        SUM(total_pago) OVER () AS total_geral
    FROM global_totais
)
SELECT
    'GLOBAL' AS ano_dados,
    id_deputado,
    nome,
    sigla_uf,
    sigla_partido,
    fornecedor,
    qtd_lancamentos,
    ROUND(total_pago::NUMERIC, 2) AS total_pago,
    ROUND(100.0 * total_pago / NULLIF(total_geral, 0), 2) AS pct_total
FROM ranked
ORDER BY total_pago DESC, id_deputado, fornecedor;

\qecho
\qecho Complemento detalhado: q12_deputado_fornecedor_complemento.txt contem o ranking completo.

\o /query-staging/q12_deputado_fornecedor_complemento.txt
\qecho Q12 complemento - ranking completo deputado x fornecedor
SELECT
    ano_dados,
    id_deputado,
    nome,
    fornecedor,
    qtd_lancamentos,
    ROUND(total_pago::NUMERIC, 2) AS total_pago
FROM resposta_deputado_fornecedor
ORDER BY ano_dados, total_pago DESC;
