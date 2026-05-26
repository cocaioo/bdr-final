\o /respostas/q3_voto_deputado_tema.txt
\qecho Q3 - votos por deputado e eixo de atuacao
WITH objetos AS (
    SELECT
        vo.ano_dados,
        vo.id_votacao,
        COALESCE(p.uri_proposicao, vo.uri_proposicao) AS uri_proposicao,
        lower(
            COALESCE(vo.titulo_proposicao, '') || ' ' ||
            COALESCE(vo.ementa_proposicao, '')
        ) AS texto_busca
    FROM votacoes_objetos vo
    LEFT JOIN proposicoes p
      ON p.ano_dados = vo.ano_dados
     AND p.id_proposicao = vo.id_proposicao
),
objetos_eixos AS (
    SELECT
        o.ano_dados,
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
    LEFT JOIN resposta_temas_eixos te
      ON te.ano_dados = o.ano_dados
     AND te.uri_proposicao = o.uri_proposicao
),
votos_eixos AS (
    SELECT DISTINCT
        vv.ano_dados,
        vv.id_deputado,
        vv.id_votacao,
        vv.voto,
        oe.eixo_maior
    FROM votacoes_votos vv
    JOIN objetos_eixos oe
      ON oe.ano_dados = vv.ano_dados
     AND oe.id_votacao = vv.id_votacao
)
SELECT
    ve.ano_dados,
    d.id_deputado,
    d.nome,
    ve.eixo_maior,
    COUNT(*) FILTER (WHERE ve.voto = 'Sim') AS votos_sim,
    COUNT(*) FILTER (WHERE ve.voto = 'Nao') AS votos_nao,
    COUNT(*) FILTER (WHERE ve.voto = 'Abstencao') AS abstencoes,
    COUNT(*) AS votos_total
FROM votos_eixos ve
JOIN deputados d ON d.id_deputado = ve.id_deputado
GROUP BY ve.ano_dados, d.id_deputado, d.nome, ve.eixo_maior
ORDER BY ve.ano_dados, d.nome, votos_total DESC, ve.eixo_maior;
