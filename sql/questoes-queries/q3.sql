\o /respostas/q3_voto_deputado_tema.txt
\qecho Q3 - votos por deputado e eixo de atuacao
WITH objetos AS (
    SELECT
        vo.id_votacao,
        COALESCE(p.uri_proposicao, vo.uri_proposicao) AS uri_proposicao,
        lower(
            COALESCE(vo.titulo_proposicao, '') || ' ' ||
            COALESCE(vo.ementa_proposicao, '')
        ) AS texto_busca
    FROM votacoes_objetos_2026 vo
    LEFT JOIN proposicoes_2026 p ON p.id_proposicao = vo.id_proposicao
),
objetos_eixos AS (
    SELECT
        o.id_votacao,
        COALESCE(
            te.eixo_maior,
            CASE
                WHEN o.texto_busca LIKE ANY (ARRAY[
                    '%saude%', '%saúde%', '%educacao%', '%educação%', '%previdencia%', '%previdência%',
                    '%assistencia%', '%assistência%', '%direitos humanos%', '%trabalho%', '%emprego%',
                    '%mulher%', '%crianca%', '%criança%', '%deficiencia%', '%deficiência%', '%indigena%', '%indígena%'
                ]) THEN 'Social'
                WHEN o.texto_busca LIKE ANY (ARRAY[
                    '%economia%', '%tribut%', '%imposto%', '%orcamento%', '%orçamento%', '%financas%', '%finanças%',
                    '%fiscal%', '%credito%', '%crédito%', '%comercio%', '%comércio%', '%industria%', '%indústria%',
                    '%agricultura%', '%agropecu%', '%pecuaria%', '%pecuária%'
                ]) THEN 'Economico'
                WHEN o.texto_busca LIKE ANY (ARRAY[
                    '%seguranca%', '%segurança%', '%penal%', '%criminal%', '%policia%', '%polícia%',
                    '%maioridade penal%', '%arma%', '%violencia%', '%violência%'
                ]) THEN 'Seguranca'
                WHEN o.texto_busca LIKE ANY (ARRAY[
                    '%constituicao%', '%constituição%', '%justica%', '%justiça%', '%cidadania%',
                    '%processo legislativo%', '%eleicao%', '%eleição%', '%partido%', '%administracao publica%', '%administração pública%'
                ]) THEN 'Institucional e juridico'
                WHEN o.texto_busca LIKE ANY (ARRAY[
                    '%meio ambiente%', '%ambiental%', '%sustentavel%', '%sustentável%', '%energia%',
                    '%mineracao%', '%mineração%', '%hidrico%', '%hídrico%', '%fundiaria%', '%fundiária%'
                ]) THEN 'Ambiental e energetico'
                WHEN o.texto_busca LIKE ANY (ARRAY[
                    '%transporte%', '%mobilidade%', '%comunicacao%', '%comunicação%', '%tecnologia%',
                    '%inovacao%', '%inovação%', '%cidade%', '%urbano%', '%infraestrutura%'
                ]) THEN 'Infraestrutura e tecnologia'
                WHEN o.texto_busca LIKE ANY (ARRAY[
                    '%cultura%', '%religiao%', '%religião%', '%esporte%', '%lazer%', '%turismo%', '%homenagem%'
                ]) THEN 'Cultura e sociedade'
                WHEN o.texto_busca LIKE ANY (ARRAY[
                    '%internacional%', '%comercio exterior%', '%comércio exterior%', '%relacoes exteriores%', '%relações exteriores%'
                ]) THEN 'Internacional'
                ELSE 'Outros'
            END
        ) AS eixo_maior
    FROM objetos o
    LEFT JOIN resposta_temas_eixos te ON te.uri_proposicao = o.uri_proposicao
),
votos_eixos AS (
    SELECT DISTINCT
        vv.id_deputado,
        vv.id_votacao,
        vv.voto,
        oe.eixo_maior
    FROM votacoes_votos_2026 vv
    JOIN objetos_eixos oe ON oe.id_votacao = vv.id_votacao
)
SELECT
    d.id_deputado,
    d.nome,
    ve.eixo_maior,
    COUNT(*) FILTER (WHERE ve.voto = 'Sim') AS votos_sim,
    COUNT(*) FILTER (WHERE ve.voto = 'Nao') AS votos_nao,
    COUNT(*) FILTER (WHERE ve.voto = 'Abstencao') AS abstencoes,
    COUNT(*) AS votos_total
FROM votos_eixos ve
JOIN deputados d ON d.id_deputado = ve.id_deputado
GROUP BY d.id_deputado, d.nome, ve.eixo_maior
ORDER BY d.nome, votos_total DESC, ve.eixo_maior;
