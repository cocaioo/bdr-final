# Relatorio de revisao: normalizacao de aliases vs. sucessoes partidarias

Data: 2026-06-25

## 1. Motivacao

A tabela anterior `partidos_aliases_normalizacao.csv` misturava dois tipos de regra sob a mesma acao "normalizar":

- aliases textuais e siglas truncadas (ex.: PODEMOS para PODE, SOLIDARIED para SOLIDARIEDADE);
- sucessoes, fusoes e incorporacoes partidarias (ex.: PATRIOTA para PRD, PSC para PODE).

Esses dois tipos de regra tem consequencias analiticas diferentes. Um alias textual e uma correcao de grafia que nao altera o conteudo ideologico do registro. Uma sucessao partidaria, por outro lado, pode alterar a classificacao ideologica do registro se o partido sucessor tiver score diferente do predecessor.

Este relatorio documenta a separacao dessas regras e as recomendacoes para tratamento na ETL e nas queries analiticas.

## 2. Diferenca entre alias textual e sucessao partidaria

**Alias textual ou sigla truncada**: a sigla que aparece nos dados e uma variante ortografica do partido correto. O partido e o mesmo; so a grafia difere. Exemplos: PODEMOS e a forma extensa de PODE; REPUBLICAN e a forma truncada de REPUBLICANOS. Normalizar e inofensivo e necessario.

**Sucessao partidaria**: o partido original deixou de existir e seus membros foram incorporados a outro partido. Os dois partidos podem ter posicionamentos ideologicos distintos. Exemplos: PATRIOTA (score 8.601, Extrema direita) foi incorporado ao PRD (score 8.161, Direita); PROS (score 7.445, Direita) foi incorporado ao SOLIDARIEDADE (score 6.007, Centro-direita). Normalizar automaticamente atribuiria ao registro historico a ideologia do partido sucessor, nao a do partido que o deputado de fato representava no momento da acao legislativa.

## 3. Regras seguras para normalizacao automatica

As 6 siglas abaixo sao aliases textuais ou truncamentos inequivocos. A normalizacao pode ser aplicada automaticamente na ETL sem risco de distorcao analitica:

| Sigla original | Sigla normalizada | Tipo | Registros |
|---|---|---|---|
| PODEMOS | PODE | alias_textual | 16 |
| REP | REPUBLICANOS | sigla_truncada | 1 |
| REPUB | REPUBLICANOS | sigla_truncada | 1 |
| REPUBLICA | REPUBLICANOS | sigla_truncada | 1 |
| REPUBLICAN | REPUBLICANOS | sigla_truncada | 1 |
| SOLIDARIED | SOLIDARIEDADE | sigla_truncada | 121 |

Total de registros afetados: 141.

Justificativa: em todos os casos, a sigla original e a normalizada referem-se ao mesmo partido, ao mesmo CNPJ, ao mesmo programa partidario. Nao ha mudanca de entidade juridica ou ideologica.

## 4. Regras que devem preservar score historico

As 4 siglas abaixo sao partidos historicos que foram incorporados a outros partidos, mas que possuem score Bolognesi proprio na tabela v2 e aparecem nos dados da 57a Legislatura com volume significativo de registros:

| Sigla | Sucessor | Score proprio | Score sucessor | Diferenca | Faixa propria | Faixa sucessor | Registros |
|---|---|---|---|---|---|---|---|
| PATRIOTA | PRD | 8.601 | 8.161 | 0.440 | Extrema direita | Direita | 2422 |
| PROS | SOLIDARIEDADE | 7.445 | 6.007 | 1.438 | Direita | Centro-direita | 240 |
| PSC | PODE | 8.410 | 7.437 | 0.973 | Direita | Direita | 817 |
| PTB | PRD | 7.720 | 8.161 | -0.441 | Direita | Direita | 1 |

Total de registros afetados: 3480.

Observacoes criticas:

- PROS para SOLIDARIEDADE apresenta a maior distorcao: 1.438 pontos e mudanca de faixa (Direita para Centro-direita) e mudanca de campo ideologico (direita para direita, mas na fronteira com centro). 240 registros seriam reclassificados incorretamente.
- PATRIOTA para PRD muda de Extrema direita para Direita e afeta 2422 registros, o maior volume.
- PSC para PODE mantem a mesma faixa (Direita), mas a diferenca de ~1 ponto nao e desprezivel.
- PTB para PRD tem impacto minimo (1 registro) e a diferenca e pequena, mas o principio metodologico de preservar score proprio se aplica igualmente.

Recomendacao: manter as siglas historicas com score proprio na tabela v2 e no join ideologico. Registros com sigla PATRIOTA devem ser classificados pelo score de PATRIOTA (8.601), nao pelo score de PRD (8.161).

## 5. Fusoes sem score proprio

DEM e PSL foram fundidos para formar Uniao Brasil em 2022. Nenhum dos dois possui linha propria na tabela v2. Aparecem apenas em proposicoes_autores (2 e 11 registros, respectivamente).

Recomendacao: normalizar para UNIAO, mas registrar a operacao como fusao (nao como alias). Os 13 registros afetados receberao o score de UNIAO (8.485). Como DEM e PSL nao possuem score proprio na v2, nao ha distorcao.

## 6. Codigo especial: S.PART.

S.PART. e um codigo interno para deputados sem filiacao partidaria no momento do registro. 345 registros (183 gastos, 77 votos, 85 proposicoes).

Recomendacao: nao normalizar. Nao atribuir score ideologico. Nos joins ideologicos, S.PART. deve resultar em NULL/nao classificado. Nas queries Q9/Q10/Q11, filtrar ou tratar como categoria propria.

## 7. Historico fora do escopo: ARENA

Zero registros nos dados da 57a Legislatura. Partido extinto em 1979. Fora do escopo temporal do BDR.

Recomendacao: nao incluir no universo analitico. Nao classificar. Ja removida da v2.

## 8. Impacto quantitativo consolidado

| Categoria | Siglas | Registros totais | Acao |
|---|---|---|---|
| Alias textual / sigla truncada | 6 | 141 | Normalizar automaticamente |
| Fusao sem score proprio | 2 | 13 | Normalizar com rastreio |
| Incorporacao com score proprio | 4 | 3480 | Manter sigla historica |
| Codigo especial | 1 | 345 | Tratar como sem_partido |
| Historico fora do escopo | 1 | 0 | Excluir |
| **Total** | **14** | **3979** | |

## 9. Estado da tabela v2

A tabela `partidos_ideologia_bolognesi_2022_v2.csv` ja contem as 4 siglas historicas (PATRIOTA, PROS, PSC, PTB) com seus scores proprios. Nao e necessario alterar a v2 nesta etapa:

- 21 partidos ativos (incluindo MISSAO com classificacao complementar)
- 4 partidos historicos mapeaveis com score proprio
- Total: 25 linhas
- ARENA ausente (correto)
- S.PART. ausente (correto)
- MISSAO com score 7.750, classificacao_complementar_documentada (correto)

## 10. Recomendacao para Q9/Q10/Q11

As queries Q9, Q10 e Q11 usam LEFT JOIN com a tabela `partidos_ideologia`. O comportamento recomendado:

1. A tabela `partidos_ideologia` no banco deve conter as 25 linhas da v2, incluindo PATRIOTA, PROS, PSC e PTB com scores proprios.
2. Registros com sigla PATRIOTA nos dados farao join com a linha PATRIOTA da tabela, recebendo score 8.601.
3. Registros com sigla PROS farao join com a linha PROS, recebendo score 7.445.
4. Aliases textuais (PODEMOS, REP, REPUB, REPUBLICA, REPUBLICAN, SOLIDARIED) devem ser normalizados antes do join, na ETL ou via CASE WHEN na query.
5. DEM e PSL devem ser normalizados para UNIAO antes do join.
6. S.PART. resultara em NULL no join (sem linha correspondente na tabela). Isso e correto.

## 11. Recomendacao para ETL

A ETL deve implementar duas camadas de normalizacao:

**Camada 1 - Normalizacao automatica (aplicar sempre):**

- PODEMOS -> PODE
- REP -> REPUBLICANOS
- REPUB -> REPUBLICANOS
- REPUBLICA -> REPUBLICANOS
- REPUBLICAN -> REPUBLICANOS
- SOLIDARIED -> SOLIDARIEDADE
- DEM -> UNIAO
- PSL -> UNIAO

**Camada 2 - Siglas historicas (nao normalizar):**

- PATRIOTA: manter como PATRIOTA (join com score proprio 8.601)
- PROS: manter como PROS (join com score proprio 7.445)
- PSC: manter como PSC (join com score proprio 8.410)
- PTB: manter como PTB (join com score proprio 7.720)

A camada 2 preserva a rastreabilidade e a classificacao ideologica correta dos registros historicos.

## 12. Pendencias antes de atualizar catalogos/partidos.csv

1. Aprovar a separacao entre alias textual e sucessao partidaria documentada neste relatorio.
2. Aprovar a decisao de manter PATRIOTA, PROS, PSC e PTB com score proprio.
3. Decidir se DEM e PSL devem ser normalizados na ETL (recomendado: sim, pois nao tem score proprio).
4. Decidir tratamento de S.PART. nas queries (recomendado: NULL/excluir de metricas ideologicas).
5. Implementar normalizacao na ETL conforme camadas 1 e 2.
6. Carregar tabela `partidos_ideologia` no banco a partir da v2 (25 linhas).
7. Reexecutar Q9, Q10, Q11 e validar outputs.

## 13. Arquivos gerados nesta etapa

| Arquivo | Descricao |
|---|---|
| `partidos_normalizacao_revisada.csv` | Tabela revisada com classificacao por tipo de regra |
| `impacto_siglas_historicas_aliases.csv` | Impacto quantitativo de cada sigla nos dados |
| `RELATORIO_NORMALIZACAO_ALIAS_SUCESSOES.md` | Este relatorio |

## 14. Validacoes realizadas

| Validacao | Resultado |
|---|---|
| ARENA nao entra no join ideologico | OK |
| S.PART. nao entra no join ideologico | OK |
| MISSAO continua classificado como complementar na v2 | OK |
| PATRIOTA mantem score proprio 8.601 na v2 | OK |
| PROS mantem score proprio 7.445 na v2 | OK |
| PSC mantem score proprio 8.410 na v2 | OK |
| PTB mantem score proprio 7.720 na v2 | OK |
| Aliases textuais inequivocos podem ser normalizados automaticamente | OK (6 siglas) |
| Sucessoes partidarias nao sao tratadas como simples alias | OK (6 siglas separadas) |
| Nenhum arquivo canonico foi alterado | OK |
