\o /respostas/q4_escolaridade.txt
-- Universo da Q4: deputados unicos do cadastro oficial da 57a legislatura.
-- Regra de escolaridade: usa o campo deputados.escolaridade; nulos/vazios viram 'Nao informado'.
WITH deputados_legislatura_57 AS (
    SELECT DISTINCT
        d.id_deputado,
        COALESCE(NULLIF(BTRIM(d.nome_civil), ''), d.nome) AS nome,
        COALESCE(NULLIF(BTRIM(d.escolaridade), ''), 'Nao informado') AS escolaridade
    FROM deputados d
    WHERE d.id_legislatura_final = 57
)
SELECT
    escolaridade,
    COUNT(*) AS qtd_deputados
FROM deputados_legislatura_57
GROUP BY escolaridade
ORDER BY qtd_deputados DESC, escolaridade;

\o /respostas/q4_escolaridade_complementar.txt
WITH deputados_legislatura_57 AS (
    SELECT DISTINCT
        d.id_deputado,
        COALESCE(NULLIF(BTRIM(d.nome_civil), ''), d.nome) AS nome,
        COALESCE(NULLIF(BTRIM(d.escolaridade), ''), 'Nao informado') AS escolaridade
    FROM deputados d
    WHERE d.id_legislatura_final = 57
)
SELECT
    escolaridade,
    id_deputado,
    nome
FROM deputados_legislatura_57
ORDER BY escolaridade, nome, id_deputado;
