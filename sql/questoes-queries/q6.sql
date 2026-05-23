\o
CREATE OR REPLACE TEMP VIEW resposta_escolaridade_indicadores AS
SELECT
    d.id_deputado,
    COALESCE(d.escolaridade, 'Nao informado') AS escolaridade,
    COALESCE(g.gasto_total, 0) AS gasto_total,
    f.fidelidade_partidaria,
    COALESCE(p.qtd_proposicoes, 0) AS qtd_proposicoes,
    COALESCE(pr.presenca_eventos, 0) AS presenca_eventos,
    COALESCE(pr.presenca_plenario, 0) AS presenca_plenario
FROM resposta_deputados_ativos a
JOIN deputados d ON d.id_deputado = a.id_deputado
LEFT JOIN resposta_gastos_deputado g ON g.id_deputado = d.id_deputado
LEFT JOIN resposta_fidelidade_deputado f ON f.id_deputado = d.id_deputado
LEFT JOIN resposta_proposicoes_deputado p ON p.id_deputado = d.id_deputado
LEFT JOIN resposta_presenca_deputado pr ON pr.id_deputado = d.id_deputado;

\o /respostas/q6_escolaridade_correlacoes.txt
\qecho Q6 - escolaridade e indicadores medios
\qecho Resumo executivo
SELECT
    COUNT(*) AS deputados_ativos,
    COUNT(DISTINCT escolaridade) AS grupos_escolaridade,
    ROUND(AVG(gasto_total), 2) AS media_geral_gasto,
    ROUND(AVG(fidelidade_partidaria), 2) AS media_geral_fidelidade,
    ROUND(AVG(qtd_proposicoes), 2) AS media_geral_proposicoes,
    ROUND(AVG(presenca_eventos), 2) AS media_geral_presenca_eventos,
    ROUND(AVG(presenca_plenario), 2) AS media_geral_presenca_plenario
FROM resposta_escolaridade_indicadores;

\qecho
\qecho Tabela principal - medias por escolaridade
SELECT
    escolaridade,
    COUNT(*) AS qtd_deputados,
    ROUND(AVG(gasto_total), 2) AS media_gasto,
    ROUND(AVG(fidelidade_partidaria), 2) AS media_fidelidade,
    ROUND(AVG(qtd_proposicoes), 2) AS media_proposicoes,
    ROUND(AVG(presenca_eventos), 2) AS media_presenca_eventos,
    ROUND(AVG(presenca_plenario), 2) AS media_presenca_plenario
FROM resposta_escolaridade_indicadores
GROUP BY escolaridade
ORDER BY escolaridade;
