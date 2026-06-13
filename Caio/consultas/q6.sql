\o

CREATE OR REPLACE TEMP VIEW resposta_deputados_ativos AS
SELECT DISTINCT ano_dados, id_deputado
FROM (
    SELECT ano_dados, id_deputado FROM gastos
    UNION
    SELECT ano_dados, id_deputado FROM votacoes_votos
    UNION
    SELECT ano_dados, id_deputado FROM proposicoes_autores WHERE id_deputado IS NOT NULL
    UNION
    SELECT ano_dados, id_deputado FROM eventos_presenca_deputados
) ativos
WHERE id_deputado IS NOT NULL;

CREATE OR REPLACE TEMP VIEW resposta_gastos_deputado AS
SELECT
    ano_dados,
    id_deputado,
    SUM(valor_liquido) AS gasto_total
FROM gastos
GROUP BY ano_dados, id_deputado;

CREATE OR REPLACE TEMP VIEW resposta_fidelidade_deputado AS
SELECT
    vv.ano_dados,
    vv.id_deputado,
    ROUND(
        100.0 * AVG(
            CASE
                WHEN vv.voto = vo.orientacao THEN 1
                ELSE 0
            END
        ),
        2
    ) AS fidelidade_partidaria
FROM votacoes_votos vv
JOIN votacoes_orientacoes vo
    ON vo.ano_dados = vv.ano_dados
   AND vo.id_votacao = vv.id_votacao
   AND vo.sigla_bancada = vv.sigla_partido
WHERE vv.voto IN ('Sim', 'Nao', 'Abstencao')
  AND vo.orientacao IN ('Sim', 'Nao', 'Abstencao')
GROUP BY vv.ano_dados, vv.id_deputado;

CREATE OR REPLACE TEMP VIEW resposta_proposicoes_deputado AS
SELECT
    ano_dados,
    id_deputado,
    COUNT(DISTINCT id_proposicao) AS qtd_proposicoes
FROM proposicoes_autores
WHERE id_deputado IS NOT NULL
GROUP BY ano_dados, id_deputado;

CREATE OR REPLACE TEMP VIEW resposta_presenca_deputado AS
SELECT
    pr.ano_dados,
    pr.id_deputado,
    COUNT(*) AS presenca_eventos,
    COUNT(*) FILTER (
        WHERE COALESCE(e.descricao_tipo, '') ILIKE '%plenario%'
           OR COALESCE(e.descricao, '') ILIKE '%plenario%'
           OR COALESCE(e.local_camara, '') ILIKE '%plenario%'
    ) AS presenca_plenario
FROM eventos_presenca_deputados pr
LEFT JOIN eventos e
    ON e.ano_dados = pr.ano_dados
   AND e.id_evento = pr.id_evento
GROUP BY pr.ano_dados, pr.id_deputado;

CREATE OR REPLACE TEMP VIEW resposta_escolaridade_indicadores AS
SELECT
    a.ano_dados,
    d.id_deputado,
    COALESCE(d.escolaridade, 'Nao informado') AS escolaridade,
    COALESCE(g.gasto_total, 0) AS gasto_total,
    f.fidelidade_partidaria,
    COALESCE(p.qtd_proposicoes, 0) AS qtd_proposicoes,
    COALESCE(pr.presenca_eventos, 0) AS presenca_eventos,
    COALESCE(pr.presenca_plenario, 0) AS presenca_plenario
FROM resposta_deputados_ativos a
JOIN deputados d ON d.id_deputado = a.id_deputado
LEFT JOIN resposta_gastos_deputado g
    ON g.ano_dados = a.ano_dados
 AND g.id_deputado = d.id_deputado
LEFT JOIN resposta_fidelidade_deputado f
    ON f.ano_dados = a.ano_dados
 AND f.id_deputado = d.id_deputado
LEFT JOIN resposta_proposicoes_deputado p
    ON p.ano_dados = a.ano_dados
 AND p.id_deputado = d.id_deputado
LEFT JOIN resposta_presenca_deputado pr
    ON pr.ano_dados = a.ano_dados
 AND pr.id_deputado = d.id_deputado;

\o /respostas/q6_escolaridade_correlacoes.txt
\qecho Q6 - escolaridade e indicadores medios
\qecho Tabela principal - medias por escolaridade
SELECT
    ano_dados,
    escolaridade,
    COUNT(*) AS qtd_deputados,
    ROUND(AVG(gasto_total), 2) AS media_gasto,
    ROUND(AVG(fidelidade_partidaria), 2) AS media_fidelidade,
    ROUND(AVG(qtd_proposicoes), 2) AS media_proposicoes,
    ROUND(AVG(presenca_eventos), 2) AS media_presenca_eventos,
    ROUND(AVG(presenca_plenario), 2) AS media_presenca_plenario
FROM resposta_escolaridade_indicadores
GROUP BY ano_dados, escolaridade
ORDER BY ano_dados, escolaridade;

\o /respostas/q6a_escolaridade_gastos.txt
\qecho Q6A - escolaridade x gastos
\qecho Tabela principal - media geral de gastos por escolaridade
SELECT
    escolaridade,
    COUNT(*) AS qtd_registros_deputado_ano,
    COUNT(DISTINCT id_deputado) AS qtd_deputados,
    ROUND(AVG(gasto_total), 2) AS media_gasto
FROM resposta_escolaridade_indicadores
GROUP BY escolaridade
HAVING AVG(gasto_total) > 0
ORDER BY media_gasto DESC NULLS LAST, escolaridade;

\o /respostas/q6b_escolaridade_fidelidade.txt
\qecho Q6B - escolaridade x fidelidade partidaria
\qecho Tabela principal - media geral de fidelidade partidaria por escolaridade
SELECT
    escolaridade,
    COUNT(*) AS qtd_registros_deputado_ano,
    COUNT(fidelidade_partidaria) AS qtd_registros_com_fidelidade,
    COUNT(DISTINCT id_deputado) AS qtd_deputados,
    ROUND(AVG(fidelidade_partidaria), 2) AS media_fidelidade
FROM resposta_escolaridade_indicadores
GROUP BY escolaridade
HAVING AVG(fidelidade_partidaria) > 0
ORDER BY media_fidelidade DESC NULLS LAST, escolaridade;

\o /respostas/q6c_escolaridade_proposicoes.txt
\qecho Q6C - escolaridade x numero de proposicoes
\qecho Tabela principal - media geral de proposicoes por escolaridade
SELECT
    escolaridade,
    COUNT(*) AS qtd_registros_deputado_ano,
    COUNT(DISTINCT id_deputado) AS qtd_deputados,
    ROUND(AVG(qtd_proposicoes), 2) AS media_proposicoes
FROM resposta_escolaridade_indicadores
GROUP BY escolaridade
HAVING AVG(qtd_proposicoes) > 0
ORDER BY media_proposicoes DESC NULLS LAST, escolaridade;

\o /respostas/q6d_escolaridade_presenca_eventos.txt
\qecho Q6D - escolaridade x presenca em eventos
\qecho Tabela principal - media geral de presenca em eventos por escolaridade
SELECT
    escolaridade,
    COUNT(*) AS qtd_registros_deputado_ano,
    COUNT(DISTINCT id_deputado) AS qtd_deputados,
    ROUND(AVG(presenca_eventos), 2) AS media_presenca_eventos
FROM resposta_escolaridade_indicadores
GROUP BY escolaridade
HAVING AVG(presenca_eventos) > 0
ORDER BY media_presenca_eventos DESC NULLS LAST, escolaridade;

\o /respostas/q6e_escolaridade_presenca_plenario.txt
\qecho Q6E - escolaridade x presenca no plenario
\qecho Tabela principal - media geral de presenca no plenario por escolaridade
SELECT
    escolaridade,
    COUNT(*) AS qtd_registros_deputado_ano,
    COUNT(DISTINCT id_deputado) AS qtd_deputados,
    ROUND(AVG(presenca_plenario), 2) AS media_presenca_plenario
FROM resposta_escolaridade_indicadores
GROUP BY escolaridade
HAVING AVG(presenca_plenario) > 0
ORDER BY media_presenca_plenario DESC NULLS LAST, escolaridade;

\o
