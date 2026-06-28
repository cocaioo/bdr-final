-- =============================================================================
-- Q1 - RANKING DE GASTOS POR DEPUTADO
-- Universo: 57a legislatura (2023-2027), Cota Parlamentar (CEAP)
--
-- Regra metodologica:
--   - usa apenas gasto efetivo (valor_liquido > 0), alinhado com Q5, Q7,
--     Q12 e Q13; isso exclui estornos, cancelamentos e ajustes com valor <= 0;
--   - gasto_total representa o total consumido da cota parlamentar, nao o
--     saldo liquido apos devolucoes.
-- =============================================================================

\o /query-staging/q1_gastos_deputados.txt
\qecho Ranking global - todos os anos

WITH gastos_totais AS (
    SELECT
        id_deputado,
        SUM(valor_liquido) AS gasto_total
    FROM gastos
    WHERE valor_liquido > 0
    GROUP BY id_deputado
),
perfil_por_partido AS (
    SELECT
        id_deputado,
        sigla_uf,
        sigla_partido,
        COUNT(*) AS ocorrencias,
        SUM(valor_liquido) AS gasto_no_partido
    FROM gastos
    WHERE valor_liquido > 0
    GROUP BY id_deputado, sigla_uf, sigla_partido
),
perfil_dominante AS (
    SELECT
        id_deputado,
        sigla_uf,
        sigla_partido
    FROM (
        SELECT
            *,
            ROW_NUMBER() OVER (
                PARTITION BY id_deputado
                ORDER BY ocorrencias DESC, gasto_no_partido DESC, sigla_uf, sigla_partido
            ) AS posicao
        FROM perfil_por_partido
    ) ranked
    WHERE posicao = 1
)
SELECT
    d.id_deputado,
    COALESCE(NULLIF(BTRIM(d.nome_civil), ''), d.nome) AS nome,
    p.sigla_uf,
    p.sigla_partido,
    g.gasto_total
FROM gastos_totais g
JOIN deputados d ON d.id_deputado = g.id_deputado
LEFT JOIN perfil_dominante p ON p.id_deputado = g.id_deputado
ORDER BY g.gasto_total DESC;
