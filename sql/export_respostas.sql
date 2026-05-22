\pset pager off
\pset null ''

SET search_path TO grupo4;

\o /respostas/q1_gastos_deputados.txt
SELECT
    d.id_deputado,
    d.nome,
    g.sigla_uf,
    g.sigla_partido,
    SUM(g.valor_liquido) AS gasto_total
FROM gastos_2026 g
JOIN deputados d ON d.id_deputado = g.id_deputado
GROUP BY d.id_deputado, d.nome, g.sigla_uf, g.sigla_partido
ORDER BY gasto_total DESC;

\o /respostas/q2_eixos_nuvem_palavras.txt
\echo Q2 - deputados por eixo/tema oficial
SELECT
    d.id_deputado,
    d.nome,
    t.tema AS eixo_ou_tema,
    COUNT(DISTINCT a.id_proposicao) AS qtd_proposicoes
FROM proposicoes_autores a
JOIN deputados d ON d.id_deputado = a.id_deputado
JOIN proposicoes_2026 p ON p.id_proposicao = a.id_proposicao
JOIN proposicoes_temas_2026 t ON t.uri_proposicao = p.uri_proposicao
GROUP BY d.id_deputado, d.nome, t.tema
ORDER BY d.nome, qtd_proposicoes DESC;

\echo
\echo Q2 - nuvem de palavras das proposicoes
WITH stopwords(word) AS (
    VALUES
        ('de'),('da'),('do'),('das'),('dos'),('e'),('a'),('o'),('as'),('os'),
        ('em'),('no'),('na'),('nos'),('nas'),('para'),('por'),('com'),('que'),
        ('um'),('uma'),('ao'),('aos'),('sobre'),('dispõe'),('dispoe')
),
tokens AS (
    SELECT lower(regexp_replace(w, '[^[:alnum:]]+', '', 'g')) AS token
    FROM proposicoes_2026 p,
         regexp_split_to_table(
             COALESCE(p.ementa, '') || ' ' ||
             COALESCE(p.ementa_detalhada, '') || ' ' ||
             COALESCE(p.keywords, ''),
             '\s+'
         ) AS w
)
SELECT token, COUNT(*) AS frequencia
FROM tokens
WHERE token <> ''
  AND length(token) >= 3
  AND token NOT IN (SELECT word FROM stopwords)
GROUP BY token
ORDER BY frequencia DESC
LIMIT 200;

\o /respostas/q3_voto_deputado_tema.txt
WITH deputado_alvo AS (
    SELECT vv.id_deputado
    FROM votacoes_votos_2026 vv
    JOIN votacoes_objetos_2026 vo ON vo.id_votacao = vv.id_votacao
    GROUP BY vv.id_deputado
    ORDER BY COUNT(*) DESC, vv.id_deputado
    LIMIT 1
),
tema_alvo AS (
    SELECT COALESCE(t.tema, vo.sigla_tipo_proposicao, 'Sem tema oficial') AS tema_ou_tipo
    FROM deputado_alvo da
    JOIN votacoes_votos_2026 vv ON vv.id_deputado = da.id_deputado
    JOIN votacoes_objetos_2026 vo ON vo.id_votacao = vv.id_votacao
    LEFT JOIN proposicoes_2026 p ON p.id_proposicao = vo.id_proposicao
    LEFT JOIN proposicoes_temas_2026 t ON t.uri_proposicao = COALESCE(p.uri_proposicao, vo.uri_proposicao)
    GROUP BY COALESCE(t.tema, vo.sigla_tipo_proposicao, 'Sem tema oficial')
    ORDER BY COUNT(*) DESC, COALESCE(t.tema, vo.sigla_tipo_proposicao, 'Sem tema oficial')
    LIMIT 1
)
SELECT
    d.id_deputado,
    d.nome,
    ta.tema_ou_tipo,
    vv.id_votacao,
    vv.voto,
    COALESCE(p.sigla_tipo, vo.sigla_tipo_proposicao) AS sigla_tipo,
    COALESCE(p.numero, vo.numero_proposicao) AS numero,
    COALESCE(p.ano, vo.ano_proposicao) AS ano,
    COALESCE(p.ementa, vo.ementa_proposicao) AS ementa
FROM deputado_alvo da
CROSS JOIN tema_alvo ta
JOIN deputados d ON d.id_deputado = da.id_deputado
JOIN votacoes_votos_2026 vv ON vv.id_deputado = da.id_deputado
JOIN votacoes_objetos_2026 vo ON vo.id_votacao = vv.id_votacao
LEFT JOIN proposicoes_2026 p ON p.id_proposicao = vo.id_proposicao
LEFT JOIN proposicoes_temas_2026 t ON t.uri_proposicao = COALESCE(p.uri_proposicao, vo.uri_proposicao)
WHERE COALESCE(t.tema, vo.sigla_tipo_proposicao, 'Sem tema oficial') = ta.tema_ou_tipo
ORDER BY vv.id_votacao;

\o /respostas/q4_escolaridade.txt
WITH ativos AS (
    SELECT id_deputado FROM gastos_2026
    UNION SELECT id_deputado FROM votacoes_votos_2026
    UNION SELECT id_deputado FROM eventos_presenca_deputados_2026
    UNION SELECT id_deputado FROM proposicoes_autores WHERE id_deputado IS NOT NULL
)
SELECT
    COALESCE(d.escolaridade, 'Nao informado') AS escolaridade,
    COUNT(*) AS qtd_deputados
FROM ativos a
JOIN deputados d ON d.id_deputado = a.id_deputado
GROUP BY COALESCE(d.escolaridade, 'Nao informado')
ORDER BY qtd_deputados DESC;

\o /respostas/q5_fornecedores.txt
SELECT
    fornecedor,
    COUNT(*) AS qtd_lancamentos,
    SUM(valor_liquido) AS total_pago
FROM gastos_2026
WHERE fornecedor IS NOT NULL
GROUP BY fornecedor
ORDER BY total_pago DESC;

\o /respostas/q6_escolaridade_correlacoes.txt
WITH gastos AS (
    SELECT id_deputado, SUM(valor_liquido) AS gasto_total
    FROM gastos_2026
    GROUP BY id_deputado
),
proposicoes AS (
    SELECT id_deputado, COUNT(DISTINCT id_proposicao) AS qtd_proposicoes
    FROM proposicoes_autores
    WHERE id_deputado IS NOT NULL
    GROUP BY id_deputado
),
presenca_eventos AS (
    SELECT id_deputado, COUNT(DISTINCT id_evento) AS presenca_eventos
    FROM eventos_presenca_deputados_2026
    GROUP BY id_deputado
),
presenca_plenario AS (
    SELECT id_deputado, COUNT(DISTINCT id_votacao) AS presenca_plenario
    FROM votacoes_votos_2026
    GROUP BY id_deputado
),
fidelidade AS (
    SELECT
        vv.id_deputado,
        ROUND(
            100.0 * COUNT(*) FILTER (WHERE vv.voto = o.orientacao) / NULLIF(COUNT(*), 0),
            2
        ) AS fidelidade_partidaria
    FROM votacoes_votos_2026 vv
    JOIN votacoes_orientacoes_2026 o
      ON o.id_votacao = vv.id_votacao
     AND o.sigla_bancada = vv.sigla_partido
    WHERE vv.voto IN ('Sim', 'Nao')
      AND o.orientacao IN ('Sim', 'Nao')
    GROUP BY vv.id_deputado
),
base AS (
    SELECT
        d.id_deputado,
        COALESCE(d.escolaridade, 'Nao informado') AS escolaridade,
        COALESCE(g.gasto_total, 0) AS gasto_total,
        f.fidelidade_partidaria,
        COALESCE(p.qtd_proposicoes, 0) AS qtd_proposicoes,
        COALESCE(pe.presenca_eventos, 0) AS presenca_eventos,
        COALESCE(pp.presenca_plenario, 0) AS presenca_plenario
    FROM deputados d
    LEFT JOIN gastos g ON g.id_deputado = d.id_deputado
    LEFT JOIN fidelidade f ON f.id_deputado = d.id_deputado
    LEFT JOIN proposicoes p ON p.id_deputado = d.id_deputado
    LEFT JOIN presenca_eventos pe ON pe.id_deputado = d.id_deputado
    LEFT JOIN presenca_plenario pp ON pp.id_deputado = d.id_deputado
    WHERE g.id_deputado IS NOT NULL
       OR f.id_deputado IS NOT NULL
       OR p.id_deputado IS NOT NULL
       OR pe.id_deputado IS NOT NULL
       OR pp.id_deputado IS NOT NULL
)
SELECT
    escolaridade,
    COUNT(*) AS qtd_deputados,
    ROUND(AVG(gasto_total), 2) AS media_gasto,
    ROUND(AVG(fidelidade_partidaria), 2) AS media_fidelidade,
    ROUND(AVG(qtd_proposicoes), 2) AS media_proposicoes,
    ROUND(AVG(presenca_eventos), 2) AS media_presenca_eventos,
    ROUND(AVG(presenca_plenario), 2) AS media_presenca_plenario
FROM base
GROUP BY escolaridade
ORDER BY escolaridade;

\o /respostas/q7_custo_beneficio.txt
WITH gastos AS (
    SELECT id_deputado, SUM(valor_liquido) AS gasto_total
    FROM gastos_2026
    GROUP BY id_deputado
),
situacoes AS (
    SELECT
        p.id_proposicao,
        CASE
            WHEN p.descricao_situacao IS NULL OR btrim(p.descricao_situacao) = '' THEN 'desconhecida'
            WHEN p.norm IN (
                'apresentada',
                'aguardando despacho',
                'aguardando parecer',
                'aguardando votacao',
                'aguardando votação',
                'pronta para pauta',
                'em tramitacao',
                'em tramitação',
                'tramitando em conjunto',
                'aguardando designacao de relator',
                'aguardando designação de relator',
                'recebendo emendas',
                'pronta para deliberacao',
                'pronta para deliberação'
            ) THEN 'ativa'
            WHEN p.norm IN (
                'aprovada',
                'aprovada em plenario',
                'aprovada em plenário',
                'aprovada conclusivamente',
                'aprovada com substitutivo',
                'aprovada parcialmente',
                'remetida ao senado',
                'enviada a sancao',
                'enviada à sanção',
                'transformada em norma juridica',
                'transformada em norma jurídica',
                'transformado em norma juridica',
                'transformado em norma jurídica',
                'transformada em lei',
                'promulgada'
            ) THEN 'aprovada'
            WHEN p.norm LIKE 'retirad% autor%' THEN 'rejeitada'
            WHEN p.norm IN (
                'rejeitada',
                'prejudicada',
                'declarada prejudicada',
                'vetada',
                'vetada parcialmente'
            ) THEN 'rejeitada'
            WHEN p.norm IN (
                'arquivada',
                'arquivada nos termos do art. 105',
                'arquivada ao final da legislatura',
                'arquivamento automatico',
                'arquivamento automático',
                'desarquivada'
            ) THEN 'arquivada'
            WHEN p.norm IN (
                'apensada',
                'desapensada',
                'devolvida ao autor',
                'suspensa',
                'sobrestada',
                'encerrada',
                'perda de objeto'
            ) THEN 'especial'
            ELSE 'desconhecida'
        END AS categoria_situacao
    FROM (
        SELECT
            id_proposicao,
            descricao_situacao,
            lower(regexp_replace(descricao_situacao, '[[:space:]]+', ' ', 'g')) AS norm
        FROM proposicoes_2026
    ) p
),
proposicoes AS (
    SELECT
        a.id_deputado,
        COUNT(DISTINCT a.id_proposicao) AS qtd_proposicoes,
        COUNT(DISTINCT a.id_proposicao) FILTER (WHERE s.categoria_situacao = 'aprovada') AS proposicoes_aprovadas
    FROM proposicoes_autores a
    LEFT JOIN situacoes s ON s.id_proposicao = a.id_proposicao
    WHERE a.id_deputado IS NOT NULL
    GROUP BY a.id_deputado
),
presenca AS (
    SELECT id_deputado, SUM(qtd) AS presenca_total
    FROM (
        SELECT id_deputado, COUNT(DISTINCT id_evento) AS qtd
        FROM eventos_presenca_deputados_2026
        GROUP BY id_deputado
        UNION ALL
        SELECT id_deputado, COUNT(DISTINCT id_votacao) AS qtd
        FROM votacoes_votos_2026
        GROUP BY id_deputado
    ) s
    GROUP BY id_deputado
),
base AS (
    SELECT
        d.id_deputado,
        d.nome,
        COALESCE(g.gasto_total, 0) AS gasto_total,
        COALESCE(p.qtd_proposicoes, 0) AS qtd_proposicoes,
        COALESCE(p.proposicoes_aprovadas, 0) AS proposicoes_aprovadas,
        COALESCE(pr.presenca_total, 0) AS presenca_total
    FROM deputados d
    LEFT JOIN gastos g ON g.id_deputado = d.id_deputado
    LEFT JOIN proposicoes p ON p.id_deputado = d.id_deputado
    LEFT JOIN presenca pr ON pr.id_deputado = d.id_deputado
)
SELECT
    id_deputado,
    nome,
    gasto_total,
    qtd_proposicoes,
    proposicoes_aprovadas,
    presenca_total,
    (qtd_proposicoes * 2.0 + proposicoes_aprovadas * 3.0 + presenca_total * 0.1) AS beneficio,
    (qtd_proposicoes * 2.0 + proposicoes_aprovadas * 3.0 + presenca_total * 0.1)
        / NULLIF(gasto_total, 0) AS custo_beneficio
FROM base
WHERE gasto_total > 0
ORDER BY custo_beneficio DESC NULLS LAST;

\o /respostas/q8_influencia.txt
WITH situacoes AS (
    SELECT
        p.id_proposicao,
        CASE
            WHEN p.descricao_situacao IS NULL OR btrim(p.descricao_situacao) = '' THEN 'desconhecida'
            WHEN p.norm IN (
                'apresentada',
                'aguardando despacho',
                'aguardando parecer',
                'aguardando votacao',
                'aguardando votação',
                'pronta para pauta',
                'em tramitacao',
                'em tramitação',
                'tramitando em conjunto',
                'aguardando designacao de relator',
                'aguardando designação de relator',
                'recebendo emendas',
                'pronta para deliberacao',
                'pronta para deliberação'
            ) THEN 'ativa'
            WHEN p.norm IN (
                'aprovada',
                'aprovada em plenario',
                'aprovada em plenário',
                'aprovada conclusivamente',
                'aprovada com substitutivo',
                'aprovada parcialmente',
                'remetida ao senado',
                'enviada a sancao',
                'enviada à sanção',
                'transformada em norma juridica',
                'transformada em norma jurídica',
                'transformado em norma juridica',
                'transformado em norma jurídica',
                'transformada em lei',
                'promulgada'
            ) THEN 'aprovada'
            WHEN p.norm LIKE 'retirad% autor%' THEN 'rejeitada'
            WHEN p.norm IN (
                'rejeitada',
                'prejudicada',
                'declarada prejudicada',
                'vetada',
                'vetada parcialmente'
            ) THEN 'rejeitada'
            WHEN p.norm IN (
                'arquivada',
                'arquivada nos termos do art. 105',
                'arquivada ao final da legislatura',
                'arquivamento automatico',
                'arquivamento automático',
                'desarquivada'
            ) THEN 'arquivada'
            WHEN p.norm IN (
                'apensada',
                'desapensada',
                'devolvida ao autor',
                'suspensa',
                'sobrestada',
                'encerrada',
                'perda de objeto'
            ) THEN 'especial'
            ELSE 'desconhecida'
        END AS categoria_situacao
    FROM (
        SELECT
            id_proposicao,
            descricao_situacao,
            lower(regexp_replace(descricao_situacao, '[[:space:]]+', ' ', 'g')) AS norm
        FROM proposicoes_2026
    ) p
),
autoria AS (
    SELECT
        a.id_deputado,
        COUNT(DISTINCT a.id_proposicao) AS proposicoes_autoria,
        COUNT(DISTINCT a.id_proposicao) FILTER (WHERE s.categoria_situacao = 'aprovada') AS proposicoes_aprovadas
    FROM proposicoes_autores a
    LEFT JOIN situacoes s ON s.id_proposicao = a.id_proposicao
    WHERE a.id_deputado IS NOT NULL
    GROUP BY a.id_deputado
)
SELECT
    d.id_deputado,
    d.nome,
    autoria.proposicoes_autoria,
    autoria.proposicoes_aprovadas,
    ROUND(100.0 * autoria.proposicoes_aprovadas / NULLIF(autoria.proposicoes_autoria, 0), 2) AS pct_aprovadas
FROM autoria
JOIN deputados d ON d.id_deputado = autoria.id_deputado
ORDER BY pct_aprovadas DESC NULLS LAST, proposicoes_aprovadas DESC;

\o /respostas/q9_vies_deputado.txt
\echo Q9 - classificacao manual dos partidos
SELECT * FROM partidos_ideologia ORDER BY ideologia, sigla_partido;

\echo
\echo Q9 - vies do deputado por partido predominante
WITH partidos_deputado AS (
    SELECT
        id_deputado,
        sigla_partido,
        ROW_NUMBER() OVER (PARTITION BY id_deputado ORDER BY COUNT(*) DESC, sigla_partido) AS rn
    FROM (
        SELECT id_deputado, sigla_partido FROM votacoes_votos_2026 WHERE sigla_partido IS NOT NULL
        UNION ALL
        SELECT id_deputado, sigla_partido FROM gastos_2026 WHERE sigla_partido IS NOT NULL
        UNION ALL
        SELECT id_deputado, sigla_partido FROM proposicoes_autores WHERE sigla_partido IS NOT NULL
    ) s
    GROUP BY id_deputado, sigla_partido
)
SELECT
    d.id_deputado,
    d.nome,
    pd.sigla_partido,
    pi.ideologia
FROM partidos_deputado pd
JOIN deputados d ON d.id_deputado = pd.id_deputado
LEFT JOIN partidos_ideologia pi ON pi.sigla_partido = pd.sigla_partido
WHERE pd.rn = 1
ORDER BY pi.ideologia, pd.sigla_partido, d.nome;

\echo
\echo Q9 - partido x proposta por tema
SELECT
    a.sigla_partido,
    pi.ideologia,
    t.tema,
    COUNT(DISTINCT a.id_proposicao) AS qtd_proposicoes
FROM proposicoes_autores a
JOIN proposicoes_2026 p ON p.id_proposicao = a.id_proposicao
JOIN proposicoes_temas_2026 t ON t.uri_proposicao = p.uri_proposicao
LEFT JOIN partidos_ideologia pi ON pi.sigla_partido = a.sigla_partido
WHERE a.sigla_partido IS NOT NULL
GROUP BY a.sigla_partido, pi.ideologia, t.tema
ORDER BY a.sigla_partido, qtd_proposicoes DESC;

\echo
\echo Q9 - votos por ideologia partidaria
SELECT
    vv.sigla_partido,
    pi.ideologia,
    vv.voto,
    COUNT(*) AS qtd_votos
FROM votacoes_votos_2026 vv
LEFT JOIN partidos_ideologia pi ON pi.sigla_partido = vv.sigla_partido
GROUP BY vv.sigla_partido, pi.ideologia, vv.voto
ORDER BY vv.sigla_partido, qtd_votos DESC;

\o /respostas/q10_alinhamento_interno_partidos.txt
WITH votos_partido AS (
    SELECT
        id_votacao,
        sigla_partido,
        SUM(CASE WHEN voto = 'Sim' THEN 1 ELSE 0 END) AS votos_sim,
        SUM(CASE WHEN voto = 'Nao' THEN 1 ELSE 0 END) AS votos_nao
    FROM votacoes_votos_2026
    WHERE sigla_partido IS NOT NULL
      AND voto IN ('Sim', 'Nao')
    GROUP BY id_votacao, sigla_partido
),
maioria AS (
    SELECT
        id_votacao,
        sigla_partido,
        CASE WHEN votos_sim >= votos_nao THEN 'Sim' ELSE 'Nao' END AS voto_majoritario
    FROM votos_partido
),
alinhados AS (
    SELECT
        vv.sigla_partido,
        COUNT(*) FILTER (WHERE vv.voto = m.voto_majoritario) AS votos_alinhados,
        COUNT(*) AS votos_total
    FROM votacoes_votos_2026 vv
    JOIN maioria m
      ON m.id_votacao = vv.id_votacao
     AND m.sigla_partido = vv.sigla_partido
    WHERE vv.voto IN ('Sim', 'Nao')
    GROUP BY vv.sigla_partido
)
SELECT
    sigla_partido,
    votos_alinhados,
    votos_total,
    ROUND(votos_alinhados::numeric / NULLIF(votos_total, 0), 4) AS alinhamento_interno
FROM alinhados
ORDER BY alinhamento_interno DESC, votos_total DESC;

\o /respostas/q11_rankings_partidos.txt
\echo Q11a - partidos por frequencia em votacoes
SELECT
    sigla_partido,
    COUNT(*) AS votos_registrados,
    COUNT(DISTINCT id_deputado) AS deputados_votantes,
    COUNT(DISTINCT id_votacao) AS votacoes
FROM votacoes_votos_2026
WHERE sigla_partido IS NOT NULL
GROUP BY sigla_partido
ORDER BY votos_registrados DESC;

\echo
\echo Q11b - partidos por proposicoes
SELECT
    sigla_partido,
    COUNT(DISTINCT id_proposicao) AS qtd_proposicoes
FROM proposicoes_autores
WHERE sigla_partido IS NOT NULL
GROUP BY sigla_partido
ORDER BY qtd_proposicoes DESC;

\echo
\echo Q11c - partidos por gastos
SELECT
    sigla_partido,
    SUM(valor_liquido) AS gasto_total
FROM gastos_2026
GROUP BY sigla_partido
ORDER BY gasto_total DESC;

\echo
\echo Q11d - nuvem de palavras por partido
WITH stopwords(word) AS (
    VALUES
        ('de'),('da'),('do'),('das'),('dos'),('e'),('a'),('o'),('as'),('os'),
        ('em'),('no'),('na'),('nos'),('nas'),('para'),('por'),('com'),('que'),
        ('um'),('uma'),('ao'),('aos'),('sobre'),('dispõe'),('dispoe')
),
tokens AS (
    SELECT
        a.sigla_partido,
        lower(regexp_replace(w, '[^[:alnum:]]+', '', 'g')) AS token
    FROM proposicoes_autores a
    JOIN proposicoes_2026 p ON p.id_proposicao = a.id_proposicao,
         regexp_split_to_table(
             COALESCE(p.ementa, '') || ' ' ||
             COALESCE(p.ementa_detalhada, '') || ' ' ||
             COALESCE(p.keywords, ''),
             '\s+'
         ) AS w
    WHERE a.sigla_partido IS NOT NULL
)
SELECT sigla_partido, token, COUNT(*) AS frequencia
FROM tokens
WHERE token <> ''
  AND length(token) >= 3
  AND token NOT IN (SELECT word FROM stopwords)
GROUP BY sigla_partido, token
ORDER BY sigla_partido, frequencia DESC;

\o /respostas/q12_deputado_fornecedor.txt
SELECT
    d.id_deputado,
    d.nome,
    g.fornecedor,
    COUNT(*) AS qtd_lancamentos,
    SUM(g.valor_liquido) AS total_pago
FROM gastos_2026 g
JOIN deputados d ON d.id_deputado = g.id_deputado
WHERE g.fornecedor IS NOT NULL
GROUP BY d.id_deputado, d.nome, g.fornecedor
ORDER BY total_pago DESC;

\o /respostas/q13_categorias_gasto_deputado.txt
SELECT
    d.id_deputado,
    d.nome,
    g.descricao_despesa,
    COUNT(*) AS qtd_lancamentos,
    SUM(g.valor_liquido) AS gasto_total
FROM gastos_2026 g
JOIN deputados d ON d.id_deputado = g.id_deputado
WHERE g.descricao_despesa IS NOT NULL
GROUP BY d.id_deputado, d.nome, g.descricao_despesa
ORDER BY d.nome, gasto_total DESC;

\o
