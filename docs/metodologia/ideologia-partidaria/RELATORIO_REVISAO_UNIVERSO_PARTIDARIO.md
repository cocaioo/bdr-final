# Relatorio de Revisao do Universo Partidario - BDR

Data: 2026-06-25

## 1. Problema identificado

A etapa anterior de construcao da tabela intermediaria Bolognesi deixou dois partidos sem classificacao ideologica: ARENA e MISSAO. A revisao revelou que esses dois casos exigem tratamentos completamente distintos:

- ARENA e um partido historico extinto em 1979, que nao deveria estar no universo analitico atual da 57a Legislatura.
- MISSAO e um partido ativo fundado em 2024 com representacao na Camara, que precisa de classificacao complementar.

Alem disso, os dados padronizados e os outputs de Q9/Q10/Q11 contem siglas nao normalizadas (DEM, PSL, PODEMOS, REP, REPUB, REPUBLICA, REPUBLICAN, SOLIDARIED, S.PART.) que precisam de mapeamento antes da integracao.

## 2. Por que ARENA nao deve ser tratada como partido atual

- ARENA (Alianca Renovadora Nacional) foi o partido de sustentacao do regime militar brasileiro, existindo de 1965 a 1979.
- Foi extinto pelo pacote de reformas partidarias de 1979. Nao existe registro de ARENA no TSE como partido ativo.
- ARENA nao aparece em nenhum dos cinco arquivos de dados padronizados da 57a Legislatura: nem em gastos, nem em votacoes, nem em proposicoes.
- ARENA nao aparece em nenhum output de Q9, Q10 ou Q11.
- Nao ha deputado atual filiado a ARENA.
- A presenca de ARENA no catalogo como "historico" e correta para registro, mas ela nao deve receber score ideologico nem entrar nas queries analiticas.

Conclusao: ARENA deve ser classificada como `historico_fora_do_escopo` e removida da tabela intermediaria de classificacao para Q9/Q10/Q11.

## 3. Siglas historicas ou aliases presentes no catalogo

O catalogo `catalogos/partidos.csv` lista 27 linhas: 22 partidos ativos e 5 historicos.

Partidos historicos no catalogo:

| Sigla | Status catalogo | Destino atual | Aparece nos dados? |
|---|---|---|---|
| ARENA | historico | nenhum (extinto 1979) | NAO |
| PATRIOTA | historico | PRD (incorporado 2023) | SIM: votos, orientacoes, proposicoes |
| PROS | historico | SOLIDARIEDADE (incorporado 2023) | SIM: votos, proposicoes |
| PSC | historico | PODE (incorporado 2023) | SIM: votos, proposicoes |
| PTB | historico | PRD (incorporado 2022) | SIM: proposicoes (1 registro) |

## 4. Siglas que aparecem nos dados mas nao estao no catalogo

Estas siglas foram encontradas nos dados padronizados e precisam de normalizacao:

| Sigla nos dados | O que e | Mapear para | Onde aparece | Qtd registros |
|---|---|---|---|---|
| DEM | Democratas (extinto) | UNIAO | proposicoes | 2 |
| PSL | Partido Social Liberal (extinto) | UNIAO | proposicoes | 11 |
| PODEMOS | Forma extensa de PODE | PODE | orientacoes (1), proposicoes (15) | 16 |
| REP | Abreviacao de Republicanos | REPUBLICANOS | proposicoes | 1 |
| REPUB | Abreviacao de Republicanos | REPUBLICANOS | proposicoes | 1 |
| REPUBLICA | Abreviacao de Republicanos | REPUBLICANOS | proposicoes | 1 |
| REPUBLICAN | Forma truncada | REPUBLICANOS | orientacoes | 1 |
| SOLIDARIED | Forma truncada | SOLIDARIEDADE | orientacoes | 121 |
| S.PART. | Sem partido | (flag, nao normalizar) | gastos (183), votos (77), proposicoes (85) | 345 |

## 5. Mapeamento de normalizacao recomendado

Siglas que devem ser normalizadas para partidos atuais na ETL:

- DEM -> UNIAO
- PSL -> UNIAO
- PODEMOS -> PODE
- REP -> REPUBLICANOS
- REPUB -> REPUBLICANOS
- REPUBLICA -> REPUBLICANOS
- REPUBLICAN -> REPUBLICANOS
- SOLIDARIED -> SOLIDARIEDADE
- PATRIOTA -> PRD
- PROS -> SOLIDARIEDADE
- PSC -> PODE
- PTB -> PRD

Siglas que devem ser excluidas do universo analitico ou tratadas como flag:

- ARENA -> historico_fora_do_escopo (nao aparece nos dados)
- S.PART. -> abreviacao_interna (flag de sem partido; nao normalizar para nenhum partido)

## 6. Analise especifica de ARENA

| Pergunta | Resposta |
|---|---|
| Aparece no TSE como partido atual? | NAO |
| Aparece nos dados do BDR 2023-2026? | NAO (nenhum arquivo) |
| Aparece em algum parlamentar atual? | NAO |
| Deve permanecer no catalogo analitico? | NAO |
| Deve ser removida da tabela intermediaria? | SIM |
| Deve ficar em lista historica? | SIM, apenas como registro |
| Deve receber score ideologico? | NAO |

Decisao: remover ARENA da tabela intermediaria `partidos_ideologia_bolognesi_2022.csv` ou marca-la explicitamente como `historico_fora_do_escopo` sem score. Nao criar score ideologico para ARENA.

## 7. Analise especifica de MISSAO

| Pergunta | Resposta |
|---|---|
| Existe coluna ideol_22_* para MISSAO em df_experts.csv? | NAO |
| Existe coluna ideol_18_* para MISSAO em df_experts.csv? | NAO |
| Existe mencao no codebook? | NAO (partido fundado apos a rodada de 2022) |
| Aparece nos dados do BDR? | SIM: gastos (582), votos (67), orientacoes (70), proposicoes (123) |
| Aparece na bancada atual da Camara? | SIM: deputado Kim Kataguiri (id 204536) |
| Por que nao esta em Bolognesi? | O partido Missao foi fundado em 2024, apos a rodada de expert survey de 2022 |
| Qual regra complementar usar? | Classificacao manual com fonte propria, separada de Bolognesi |

Recomendacao para classificacao complementar de MISSAO:

- Fonte: classificacao manual/editorial, nao Bolognesi.
- Justificativa: MISSAO foi fundado por Kim Kataguiri em 2024, com posicionamento declarado de centro-direita liberal.
- A classificacao deve ser registrada com `tipo_match = classificacao_complementar` e `fonte_ideologia` diferente de Bolognesi.
- O campo `observacao_equivalencia` deve explicar que o partido e posterior a rodada de 2022 e foi classificado por criterio editorial.
- NAO fingir que Bolognesi classificou MISSAO.

## 8. Lista final de partidos para Q9/Q10/Q11

### Partidos ja cobertos por Bolognesi 2022 (20 partidos)

AVANTE, CIDADANIA, MDB, NOVO, PCDOB, PDT, PL, PODE, PP, PRD, PSB, PSD, PSDB, PSOL, PT, PV, REDE, REPUBLICANOS, SOLIDARIEDADE, UNIAO

### Partidos historicos com score Bolognesi (uteis para dados de 2023 pre-incorporacao)

PATRIOTA (score 8.601), PROS (score 7.445), PSC (score 8.410), PTB (score 7.720)

### Partidos que exigem regra complementar (1 partido)

- MISSAO: precisa de classificacao complementar com fonte propria

### Partidos fora do universo analitico

- ARENA: historico extinto, sem dados

### Codigos especiais

- S.PART.: flag de ausencia de partido; nao classificar ideologicamente; tratar como "nao classificado" nas queries

## 9. Resumo dos outputs de Q9/Q10/Q11 com problemas

Os outputs atuais mostram as seguintes siglas como "nao classificado":

- PATRIOTA: 300 votacoes, 922 proposicoes (deveria mapear para PRD ou usar score proprio)
- PSC: 100 votacoes, 360 proposicoes (deveria mapear para PODE ou usar score proprio)
- PROS: 5 votacoes, 193 proposicoes (deveria mapear para SOLIDARIEDADE ou usar score proprio)
- S.PART.: 77 votacoes, 85 proposicoes, R$ 399 mil gastos (flag de sem partido)
- PODEMOS: 15 proposicoes (deveria normalizar para PODE)
- PSL: 11 proposicoes (deveria normalizar para UNIAO)
- DEM: 2 proposicoes (deveria normalizar para UNIAO)
- PTB: 1 proposicao (deveria normalizar para PRD)
- REP: 1 proposicao (deveria normalizar para REPUBLICANOS)
- REPUB: 1 proposicao (deveria normalizar para REPUBLICANOS)
- REPUBLICA: 1 proposicao (deveria normalizar para REPUBLICANOS)

Nota: MISSAO aparece como "centro" nos outputs de Q9/Q10/Q11 porque o catalogo atual a classifica como centro. No entanto, essa classificacao nao tem base em Bolognesi e precisa ser formalizada com regra complementar.

## 10. Proximos passos (antes de alterar qualquer artefato)

1. Aprovar a classificacao de ARENA como `historico_fora_do_escopo`.
2. Definir o score e a faixa ideologica de MISSAO por regra complementar, com fonte editorial explicita.
3. Decidir se PATRIOTA, PROS, PSC devem manter seus proprios scores historicos de Bolognesi nos dados de 2023 (pre-incorporacao) ou se devem ser normalizados para o partido atual.
4. Decidir o tratamento de S.PART. nas queries (excluir? manter como "nao classificado"?).
5. Criar a regra de normalizacao de siglas na ETL (DEM->UNIAO, PSL->UNIAO, PODEMOS->PODE, etc.).
6. Somente apos essas decisoes, atualizar: `catalogos/partidos.csv`, tabela intermediaria, SQLs de Q9/Q10/Q11, ETL, backend.
