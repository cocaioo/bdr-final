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
votos_eixos_brutos AS (
    SELECT DISTINCT
        vv.ano_dados,
        vv.id_deputado,
        COALESCE(NULLIF(BTRIM(d.nome_civil), ''), d.nome) AS nome,
        vv.id_votacao,
        vv.voto,
        CAST(SPLIT_PART(vv.id_votacao, '-', 1) AS INTEGER) AS id_proposicao
    FROM votacoes_votos vv
    JOIN deputados d ON d.id_deputado = vv.id_deputado
    WHERE vv.ano_dados BETWEEN 2023 AND 2026
      AND d.id_legislatura_final = 57
),
votos_eixos_resolvidos AS (
    SELECT 
        v.ano_dados,
        v.id_deputado,
        v.nome,
        v.voto,
        COALESCE(
            te.eixo_maior,
            CASE v.id_proposicao
                WHEN 106701 THEN 'Ambiental e energetico'
                WHEN 135198 THEN 'Institucional e juridico'
                WHEN 146708 THEN 'Institucional e juridico'
                WHEN 259094 THEN 'Economico'
                WHEN 345311 THEN 'Ambiental e energetico'
                WHEN 575585 THEN 'Social'
                WHEN 589982 THEN 'Seguranca'
                WHEN 1243686 THEN 'Economico'
                WHEN 1302214 THEN 'Social'
                WHEN 1672171 THEN 'Social'
                WHEN 2053121 THEN 'Social'
                WHEN 2121416 THEN 'Social'
                WHEN 2121642 THEN 'Social'
                WHEN 2122682 THEN 'Institucional e juridico'
                WHEN 2125189 THEN 'Infraestrutura e tecnologia'
                WHEN 2157806 THEN 'Cultura e sociedade'
                WHEN 2162116 THEN 'Economico'
                WHEN 2162802 THEN 'Social'
                WHEN 2164336 THEN 'Social'
                WHEN 2166464 THEN 'Economico'
                WHEN 2178408 THEN 'Economico'
                WHEN 2181620 THEN 'Economico'
                WHEN 2190084 THEN 'Ambiental e energetico'
                WHEN 2191179 THEN 'Social'
                WHEN 2191678 THEN 'Social'
                WHEN 2193584 THEN 'Institucional e juridico'
                WHEN 2194861 THEN 'Social'
                WHEN 2195860 THEN 'Social'
                WHEN 2196833 THEN 'Economico'
                WHEN 2204088 THEN 'Economico'
                WHEN 2220819 THEN 'Seguranca'
                WHEN 2224999 THEN 'Cultura e sociedade'
                WHEN 2225224 THEN 'Social'
                WHEN 2227739 THEN 'Seguranca'
                WHEN 2228358 THEN 'Seguranca'
                WHEN 2231632 THEN 'Institucional e juridico'
                WHEN 2231888 THEN 'Social'
                WHEN 2233324 THEN 'Cultura e sociedade'
                WHEN 2237596 THEN 'Seguranca'
                WHEN 2238434 THEN 'Ambiental e energetico'
                WHEN 2252295 THEN 'Social'
                WHEN 2253943 THEN 'Economico'
                WHEN 2256159 THEN 'Social'
                WHEN 2257488 THEN 'Social'
                WHEN 2264300 THEN 'Social'
                WHEN 2269745 THEN 'Ambiental e energetico'
                WHEN 2270325 THEN 'Social'
                WHEN 2270800 THEN 'Social'
                WHEN 2288318 THEN 'Institucional e juridico'
                WHEN 2309053 THEN 'Economico'
                WHEN 2312373 THEN 'Economico'
                WHEN 2334279 THEN 'Economico'
                WHEN 2336393 THEN 'Economico'
                WHEN 2344938 THEN 'Economico'
                WHEN 2345368 THEN 'Ambiental e energetico'
                WHEN 2400068 THEN 'Cultura e sociedade'
                WHEN 2462009 THEN 'Seguranca'
                WHEN 2500080 THEN 'Ambiental e energetico'
                WHEN 2557414 THEN 'Ambiental e energetico'
                WHEN 2562173 THEN 'Economico'
                WHEN 2578879 THEN 'Institucional e juridico'
                WHEN 2595984 THEN 'Institucional e juridico'
                WHEN 2611717 THEN 'Economico'
            END
        ) AS eixo_maior
    FROM votos_eixos_brutos v
    LEFT JOIN proposicoes_temas pt ON pt.uri_proposicao = 'https://dadosabertos.camara.leg.br/api/v2/proposicoes/' || v.id_proposicao
    LEFT JOIN temas_eixos te ON te.cod_tema = pt.cod_tema
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
FROM votos_eixos_resolvidos
WHERE eixo_maior IS NOT NULL
GROUP BY ano_dados, id_deputado, nome, eixo_maior
ORDER BY nome, eixo_maior, ano_dados;