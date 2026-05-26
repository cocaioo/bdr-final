\o
CREATE OR REPLACE TEMP VIEW resposta_partido_predominante_deputado AS
WITH fontes AS (
    SELECT ano_dados, id_deputado, sigla_partido FROM votacoes_votos WHERE sigla_partido IS NOT NULL
    UNION ALL
    SELECT ano_dados, id_deputado, sigla_partido FROM gastos WHERE sigla_partido IS NOT NULL
    UNION ALL
    SELECT ano_dados, id_deputado, sigla_partido FROM proposicoes_autores WHERE sigla_partido IS NOT NULL
),
ranked AS (
    SELECT
        ano_dados,
        id_deputado,
        sigla_partido,
        COUNT(*) AS ocorrencias,
        ROW_NUMBER() OVER (
            PARTITION BY ano_dados, id_deputado
            ORDER BY COUNT(*) DESC, sigla_partido
        ) AS rn
    FROM fontes
    GROUP BY ano_dados, id_deputado, sigla_partido
)
SELECT
    r.ano_dados,
    d.id_deputado,
    d.nome,
    r.sigla_partido,
    pi.ideologia,
    r.ocorrencias
FROM ranked r
JOIN deputados d ON d.id_deputado = r.id_deputado
LEFT JOIN partidos_ideologia pi ON pi.sigla_partido = r.sigla_partido
WHERE r.rn = 1;

CREATE OR REPLACE TEMP VIEW resposta_partido_tema AS
SELECT
    a.ano_dados,
    a.sigla_partido,
    pi.ideologia,
    t.tema,
    COUNT(DISTINCT (a.ano_dados, a.id_proposicao)) AS qtd_proposicoes
FROM proposicoes_autores a
JOIN proposicoes p
  ON p.ano_dados = a.ano_dados
 AND p.id_proposicao = a.id_proposicao
JOIN proposicoes_temas t
  ON t.ano_dados = p.ano_dados
 AND t.uri_proposicao = p.uri_proposicao
LEFT JOIN partidos_ideologia pi ON pi.sigla_partido = a.sigla_partido
WHERE a.sigla_partido IS NOT NULL
GROUP BY a.ano_dados, a.sigla_partido, pi.ideologia, t.tema;

CREATE OR REPLACE TEMP VIEW resposta_votos_ideologia AS
SELECT
    vv.ano_dados,
    vv.sigla_partido,
    pi.ideologia,
    vv.voto,
    COUNT(*) AS qtd_votos
FROM votacoes_votos vv
LEFT JOIN partidos_ideologia pi ON pi.sigla_partido = vv.sigla_partido
GROUP BY vv.ano_dados, vv.sigla_partido, pi.ideologia, vv.voto;

\o /respostas/q9_vies_deputado.txt
\qecho Q9 - vies ideologico e comportamento partidario
\qecho Resumo executivo - deputados por ideologia predominante
SELECT
    ano_dados,
    COALESCE(ideologia, 'Nao classificado') AS ideologia,
    COUNT(*) AS qtd_deputados
FROM resposta_partido_predominante_deputado
GROUP BY ano_dados, COALESCE(ideologia, 'Nao classificado')
ORDER BY ano_dados, qtd_deputados DESC, ideologia;

\qecho
\qecho Tabela principal - partido predominante de cada deputado
SELECT
    ano_dados,
    id_deputado,
    nome,
    sigla_partido,
    ideologia
FROM resposta_partido_predominante_deputado
ORDER BY ano_dados, ideologia, sigla_partido, nome;

\qecho
\qecho Complemento 1 - classificacao manual dos partidos
SELECT *
FROM partidos_ideologia
ORDER BY ideologia, sigla_partido;

\qecho
\qecho Complemento 2 - partido x tema de proposicao
SELECT
    ano_dados,
    sigla_partido,
    ideologia,
    tema,
    qtd_proposicoes
FROM resposta_partido_tema
ORDER BY ano_dados, sigla_partido, qtd_proposicoes DESC;

\qecho
\qecho Complemento 3 - votos por ideologia partidaria
SELECT
    ano_dados,
    sigla_partido,
    ideologia,
    voto,
    qtd_votos
FROM resposta_votos_ideologia
ORDER BY ano_dados, sigla_partido, qtd_votos DESC;
