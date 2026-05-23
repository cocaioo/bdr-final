CREATE OR REPLACE TEMP VIEW resposta_temas_eixos AS
SELECT
    t.uri_proposicao,
    t.tema,
    CASE
        WHEN t.cod_tema IN (44, 46, 52, 56, 58, 86) THEN 'Social'
        WHEN t.cod_tema IN (40, 64, 66, 70) THEN 'Economico'
        WHEN t.cod_tema IN (43, 57) THEN 'Seguranca'
        WHEN t.cod_tema IN (34, 42, 53, 67, 68, 74, 76) THEN 'Institucional e juridico'
        WHEN t.cod_tema IN (48, 51, 54) THEN 'Ambiental e energetico'
        WHEN t.cod_tema IN (37, 41, 61, 62, 85) THEN 'Infraestrutura e tecnologia'
        WHEN t.cod_tema IN (35, 39, 60, 72) THEN 'Cultura e sociedade'
        WHEN t.cod_tema IN (55) THEN 'Internacional'
        ELSE 'Outros'
    END AS eixo_maior
FROM proposicoes_temas_2026 t;

CREATE OR REPLACE TEMP VIEW resposta_proposicoes_situacoes AS
SELECT
    p.id_proposicao,
    p.descricao_situacao,
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
) p;

CREATE OR REPLACE TEMP VIEW resposta_stopwords AS
SELECT word
FROM (
    VALUES
        ('de'),('da'),('do'),('das'),('dos'),('e'),('a'),('o'),('as'),('os'),
        ('em'),('no'),('na'),('nos'),('nas'),('para'),('por'),('com'),('que'),
        ('um'),('uma'),('ao'),('aos'),('sobre'),('dispõe'),('dispoe')
) AS sw(word);

CREATE OR REPLACE TEMP VIEW resposta_tokens_proposicoes AS
SELECT
    p.id_proposicao,
    lower(regexp_replace(w, '[^[:alnum:]]+', '', 'g')) AS token
FROM proposicoes_2026 p
CROSS JOIN LATERAL regexp_split_to_table(
    COALESCE(p.ementa, '') || ' ' ||
    COALESCE(p.ementa_detalhada, '') || ' ' ||
    COALESCE(p.keywords, ''),
    '\s+'
) AS w;

CREATE OR REPLACE TEMP VIEW resposta_tokens_validos_proposicoes AS
SELECT id_proposicao, token
FROM resposta_tokens_proposicoes
WHERE token <> ''
  AND length(token) >= 3
  AND token NOT IN (SELECT word FROM resposta_stopwords);

CREATE OR REPLACE TEMP VIEW resposta_deputados_ativos AS
SELECT id_deputado FROM gastos_2026
UNION
SELECT id_deputado FROM votacoes_votos_2026
UNION
SELECT id_deputado FROM eventos_presenca_deputados_2026
UNION
SELECT id_deputado FROM proposicoes_autores WHERE id_deputado IS NOT NULL;

CREATE OR REPLACE TEMP VIEW resposta_gastos_deputado AS
SELECT id_deputado, SUM(valor_liquido) AS gasto_total
FROM gastos_2026
GROUP BY id_deputado;

CREATE OR REPLACE TEMP VIEW resposta_proposicoes_deputado AS
SELECT
    a.id_deputado,
    COUNT(DISTINCT a.id_proposicao) AS qtd_proposicoes,
    COUNT(DISTINCT a.id_proposicao) FILTER (
        WHERE s.categoria_situacao = 'aprovada'
    ) AS proposicoes_aprovadas
FROM proposicoes_autores a
LEFT JOIN resposta_proposicoes_situacoes s ON s.id_proposicao = a.id_proposicao
WHERE a.id_deputado IS NOT NULL
GROUP BY a.id_deputado;

CREATE OR REPLACE TEMP VIEW resposta_presenca_deputado AS
SELECT
    id_deputado,
    SUM(presenca_eventos) AS presenca_eventos,
    SUM(presenca_plenario) AS presenca_plenario,
    SUM(presenca_eventos + presenca_plenario) AS presenca_total
FROM (
    SELECT
        id_deputado,
        COUNT(DISTINCT id_evento) AS presenca_eventos,
        0::bigint AS presenca_plenario
    FROM eventos_presenca_deputados_2026
    GROUP BY id_deputado
    UNION ALL
    SELECT
        id_deputado,
        0::bigint AS presenca_eventos,
        COUNT(DISTINCT id_votacao) AS presenca_plenario
    FROM votacoes_votos_2026
    GROUP BY id_deputado
) s
GROUP BY id_deputado;

CREATE OR REPLACE TEMP VIEW resposta_fidelidade_deputado AS
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
GROUP BY vv.id_deputado;
