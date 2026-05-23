\o
CREATE OR REPLACE TEMP VIEW resposta_custo_beneficio AS
SELECT
    d.id_deputado,
    d.nome,
    g.gasto_total,
    COALESCE(p.qtd_proposicoes, 0) AS qtd_proposicoes,
    COALESCE(p.proposicoes_aprovadas, 0) AS proposicoes_aprovadas,
    COALESCE(pr.presenca_total, 0) AS presenca_total,
    (
        COALESCE(p.qtd_proposicoes, 0) * 2.0 +
        COALESCE(p.proposicoes_aprovadas, 0) * 3.0 +
        COALESCE(pr.presenca_total, 0) * 0.1
    ) AS beneficio,
    (
        COALESCE(p.qtd_proposicoes, 0) * 2.0 +
        COALESCE(p.proposicoes_aprovadas, 0) * 3.0 +
        COALESCE(pr.presenca_total, 0) * 0.1
    ) / NULLIF(g.gasto_total, 0) AS custo_beneficio
FROM deputados d
JOIN resposta_gastos_deputado g ON g.id_deputado = d.id_deputado
LEFT JOIN resposta_proposicoes_deputado p ON p.id_deputado = d.id_deputado
LEFT JOIN resposta_presenca_deputado pr ON pr.id_deputado = d.id_deputado
WHERE g.gasto_total > 0;

\o /respostas/q7_custo_beneficio.txt
\qecho Q7 - custo-beneficio por deputado
\qecho Resumo executivo
SELECT
    COUNT(*) AS deputados_com_gasto,
    ROUND(AVG(beneficio), 2) AS media_beneficio,
    ROUND(AVG(custo_beneficio), 8) AS media_custo_beneficio,
    ROUND(MAX(custo_beneficio), 8) AS maior_custo_beneficio
FROM resposta_custo_beneficio;

\qecho
\qecho Tabela principal - top 30 por custo-beneficio
SELECT
    id_deputado,
    nome,
    gasto_total,
    qtd_proposicoes,
    proposicoes_aprovadas,
    presenca_total,
    beneficio,
    custo_beneficio
FROM resposta_custo_beneficio
ORDER BY custo_beneficio DESC NULLS LAST
LIMIT 30;

\qecho
\qecho Complemento detalhado: q7_custo_beneficio_complemento.txt contem o ranking completo.

\o /respostas/q7_custo_beneficio_complemento.txt
\qecho Q7 complemento - ranking completo por custo-beneficio
SELECT
    id_deputado,
    nome,
    gasto_total,
    qtd_proposicoes,
    proposicoes_aprovadas,
    presenca_total,
    beneficio,
    custo_beneficio
FROM resposta_custo_beneficio
ORDER BY custo_beneficio DESC NULLS LAST;
