\o

CREATE OR REPLACE TEMP VIEW resposta_q8_influencia_por_voto_extra AS
WITH votos_classificados AS (
    SELECT DISTINCT
        vv.ano_dados,
        vv.id_deputado,
        vv.id_votacao,
        vv.voto,
        v.aprovacao,
        CASE
            WHEN vv.voto = 'Sim' AND v.aprovacao IS TRUE THEN 1
            WHEN vv.voto = 'Nao' AND v.aprovacao IS FALSE THEN 1
            WHEN vv.voto IN ('Sim', 'Nao') AND v.aprovacao IS NOT NULL THEN 0
            ELSE NULL
        END AS alinhado
    FROM votacoes_votos vv
    JOIN votacoes v
      ON v.ano_dados = vv.ano_dados
     AND v.id_votacao = vv.id_votacao
    WHERE vv.voto IN ('Sim', 'Nao')
      AND v.aprovacao IS NOT NULL
),
metricas AS (
    SELECT
        vc.ano_dados,
        d.id_deputado,
        d.nome,
        COUNT(*) AS votacoes_consideradas,
        SUM(alinhado) AS votacoes_alinhadas,
        COUNT(*) - SUM(alinhado) AS votacoes_desalinhadas,
        ROUND(
            100.0 * SUM(alinhado) / NULLIF(COUNT(*), 0),
            2
        ) AS taxa_alinhamento_resultado
    FROM votos_classificados vc
    JOIN deputados d ON d.id_deputado = vc.id_deputado
    WHERE alinhado IS NOT NULL
    GROUP BY vc.ano_dados, d.id_deputado, d.nome
)
SELECT
    ano_dados,
    id_deputado,
    nome,
    votacoes_consideradas,
    votacoes_alinhadas,
    votacoes_desalinhadas,
    taxa_alinhamento_resultado,
    ROUND(
        (
            (votacoes_alinhadas - votacoes_desalinhadas)::numeric
            * taxa_alinhamento_resultado / 100.0
        ),
        2
    ) AS indice_influencia_ponderado
FROM metricas;

CREATE OR REPLACE TEMP VIEW resposta_q8_influencia_por_voto_global_extra AS
WITH metricas_globais AS (
    SELECT
        id_deputado,
        MAX(nome) AS nome,
        SUM(votacoes_consideradas) AS votacoes_consideradas,
        SUM(votacoes_alinhadas) AS votacoes_alinhadas,
        SUM(votacoes_desalinhadas) AS votacoes_desalinhadas,
        ROUND(
            100.0 * SUM(votacoes_alinhadas) / NULLIF(SUM(votacoes_consideradas), 0),
            2
        ) AS taxa_alinhamento_resultado
    FROM resposta_q8_influencia_por_voto_extra
    GROUP BY id_deputado
)
SELECT
    'GLOBAL' AS ano_dados,
    id_deputado,
    nome,
    votacoes_consideradas,
    votacoes_alinhadas,
    votacoes_desalinhadas,
    taxa_alinhamento_resultado,
    ROUND(
        (
            (votacoes_alinhadas - votacoes_desalinhadas)::numeric
            * taxa_alinhamento_resultado / 100.0
        ),
        2
    ) AS indice_influencia_ponderado
FROM metricas_globais;

\o /respostas/q8_influencia_por_voto_extra.txt
\qecho Q8 extra - alinhamento do voto ao resultado da votacao
\qecho Formula: votacoes alinhadas / votacoes consideradas.
\qecho Uma votacao alinhada e aquela em que o deputado votou Sim e a votacao foi aprovada, ou votou Nao e a votacao foi rejeitada.
\qecho Observacao: a contagem e por votacao, nao por proposicao. Cada voto em uma votacao recebe apenas uma classificacao: alinhado ou desalinhado.
\qecho
\qecho Resumo executivo
SELECT
    COUNT(*) AS deputados_com_votos_validos,
    SUM(votacoes_consideradas) AS votacoes_consideradas,
    SUM(votacoes_alinhadas) AS votacoes_alinhadas,
    SUM(votacoes_desalinhadas) AS votacoes_desalinhadas,
    ROUND(AVG(indice_influencia_ponderado), 2) AS media_indice_influencia_ponderado,
    ROUND(
        100.0 * SUM(votacoes_alinhadas) / NULLIF(SUM(votacoes_consideradas), 0),
        2
    ) AS taxa_alinhamento_resultado_geral
FROM resposta_q8_influencia_por_voto_extra;

\qecho
\qecho Ranking global - todos os anos por indice de alinhamento ponderado
SELECT
    ano_dados,
    id_deputado,
    nome,
    votacoes_consideradas,
    votacoes_alinhadas,
    votacoes_desalinhadas,
    taxa_alinhamento_resultado,
    indice_influencia_ponderado
FROM resposta_q8_influencia_por_voto_global_extra
ORDER BY indice_influencia_ponderado DESC NULLS LAST,
         taxa_alinhamento_resultado DESC NULLS LAST,
         votacoes_alinhadas DESC,
         votacoes_consideradas DESC,
         nome;

\qecho
\qecho Tabela extra - ranking anual completo por alinhamento ao resultado da votacao
SELECT
    ano_dados,
    id_deputado,
    nome,
    votacoes_consideradas,
    votacoes_alinhadas,
    votacoes_desalinhadas,
    taxa_alinhamento_resultado,
    indice_influencia_ponderado
FROM resposta_q8_influencia_por_voto_extra
ORDER BY ano_dados,
         indice_influencia_ponderado DESC NULLS LAST,
         taxa_alinhamento_resultado DESC NULLS LAST,
         votacoes_alinhadas DESC,
         votacoes_consideradas DESC,
         nome;
