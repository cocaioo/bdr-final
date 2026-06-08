\o /respostas/q3_voto_deputado_tema.txt

WITH temas_eixos (cod_tema, eixo_maior) AS (
    VALUES
        (44, 'Social'), (46, 'Social'), (52, 'Social'), (56, 'Social'), (58, 'Social'), (86, 'Social'),
        (40, 'Economico'), (64, 'Economico'), (66, 'Economico'), (70, 'Economico'),
        (43, 'Seguranca'), (57, 'Seguranca'),
        (34, 'Institucional e juridico'), (42, 'Institucional e juridico'), (53, 'Institucional e juridico'),
        (67, 'Institucional e juridico'), (68, 'Institucional e juridico'), (74, 'Institucional e juridico'), (76, 'Institucional e juridico'),
        (48, 'Ambiental e energetico'), (51, 'Ambiental e energetico'), (54, 'Ambiental e energetico'),
        (37, 'Infraestrutura e tecnologia'), (41, 'Infraestrutura e tecnologia'), (61, 'Infraestrutura e tecnologia'),
        (62, 'Infraestrutura e tecnologia'), (85, 'Infraestrutura e tecnologia'),
        (35, 'Cultura e sociedade'), (39, 'Cultura e sociedade'), (60, 'Cultura e sociedade'), (72, 'Cultura e sociedade'),
        (55, 'Internacional')
),
proposicao_materia AS (
    SELECT DISTINCT ON (id_proposicao)
        id_proposicao,
        uri_proposicao
    FROM proposicoes
    ORDER BY id_proposicao, ano_dados DESC
),
votos_eixos AS (
    SELECT DISTINCT
        vv.ano_dados,
        vv.id_deputado,
        COALESCE(NULLIF(BTRIM(d.nome_civil), ''), d.nome) AS nome,
        te.eixo_maior,
        vv.id_votacao,
        vv.voto
    FROM votacoes_votos vv
    JOIN deputados d
      ON d.id_deputado = vv.id_deputado
    JOIN proposicao_materia pm
      ON pm.id_proposicao = CAST(SPLIT_PART(vv.id_votacao, '-', 1) AS INTEGER)
    JOIN proposicoes_temas pt
      ON pt.uri_proposicao = pm.uri_proposicao
    JOIN temas_eixos te
      ON te.cod_tema = pt.cod_tema
    WHERE vv.ano_dados BETWEEN 2023 AND 2026
)
SELECT
    ano_dados,
    id_deputado,
    nome,
    eixo_maior,
    SUM(CASE WHEN voto = 'Sim' THEN 1 ELSE 0 END) AS votos_sim,
    SUM(CASE WHEN voto = 'Nao' THEN 1 ELSE 0 END) AS votos_nao,
    SUM(CASE WHEN voto = 'Abstencao' THEN 1 ELSE 0 END) AS abstencoes,
    COUNT(*) AS votos_total
FROM votos_eixos
GROUP BY ano_dados, id_deputado, nome, eixo_maior
ORDER BY nome, eixo_maior, ano_dados;