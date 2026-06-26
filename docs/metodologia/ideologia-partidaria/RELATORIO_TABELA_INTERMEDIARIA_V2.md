# Relatorio da tabela intermediaria v2 - Classificacao ideologica partidaria

Data da etapa: 2026-06-25

## 1. Diferenca entre catalogo completo e universo analitico

O catalogo `catalogos/partidos.csv` contem 26 linhas (22 partidos ativos + 4 historicos + ARENA historico). Porem, nem todos devem entrar no universo analitico da 57a Legislatura.

| Categoria | Qtd | Descricao |
|---|---:|---|
| Partidos analiticos ativos | 21 | Partidos com representacao atual na Camara |
| Historicos mapeaveis | 4 | PATRIOTA, PROS, PSC, PTB - ainda presentes nos dados, com score Bolognesi |
| Historicos fora do escopo | 1 | ARENA - extinto, sem dados |
| Total na v2 | 25 | Excluindo ARENA |

Alem disso, os dados padronizados contem 12 siglas adicionais que sao aliases, abreviacoes ou formas truncadas e precisam de normalizacao (ver secao de aliases).

## 2. Decisao sobre ARENA

- ARENA (Alianca Renovadora Nacional) e partido extinto em 1979.
- Nao aparece em nenhum arquivo de dados da 57a Legislatura.
- Nao e registrado no TSE como partido ativo.
- Nao ha deputado atual filiado a ARENA.
- **Decisao: ARENA foi removida da tabela v2.** Nao recebe score ideologico. Permanece apenas na tabela de aliases como `historico_fora_do_escopo` e no relatorio de auditoria.

## 3. Decisao sobre MISSAO

- MISSAO (Partido Missao) e partido ativo, fundado pelo MBL, com registro TSE aprovado em 04/11/2025 (30a legenda do pais).
- Numero da legenda: 14. Presidente: Renan Antonio Ferreira dos Santos.
- Aparece nos dados: gastos (582), votos (67), orientacoes (70), proposicoes (123). Deputado: Kim Kataguiri (id 204536).
- **Nao existe na base Bolognesi 2022**: nenhuma coluna `ideol_18_missao` ou `ideol_22_missao` em `df_experts.csv`. O partido e posterior a rodada de expert survey de 2022.
- **Decisao: MISSAO foi classificado por regra complementar documentada**, com base em pesquisa de fontes externas. Classificacao: **Direita** (score operacional 7.750).

### Justificativa da classificacao complementar de MISSAO

Foram consultadas 6 fontes, das quais 4 de alta confiabilidade:

1. **TSE oficial** (alta): estatuto registrado descreve "carater liberal", defesa de "economia liberal com Estado regulador".
2. **Gazeta do Povo** (alta): materia descreve o partido como disputando "espaco na direita em 2026", com "visao descentralizadora da economia".
3. **Poder360** (alta): Kim Kataguiri declara "O MBL e uma direita nao bolsonarista".
4. **CNN Brasil** (alta): presidente Renan Santos descreve a sigla como "campo da direita, altamente pragmatica".
5. **Revista Crusoe** (media): analise editorial posiciona o partido no campo da direita.
6. **Wikipedia** (baixa): classifica como partido de direita. Usada apenas como apoio.

**Convergencia**: todas as fontes consultadas posicionam MISSAO no campo da direita. Nao ha divergencia relevante sobre o campo ideologico. Existe debate sobre se o partido e "centro-direita", "direita" ou "extrema direita", mas a posicao majoritaria das fontes confiaveis e **Direita**.

**Sintese metodologica**: Partido posterior a rodada Bolognesi 2022. Classificacao operacional complementar baseada em fontes oficiais para existencia/representacao (TSE, Camara) e fontes jornalisticas convergentes que posicionam o partido a direita (Gazeta do Povo, Poder360, CNN Brasil, Crusoe). O score 7.750 e ponto medio da faixa "Direita" (7.000 a 8.499), nao media de expert survey. Nao deve ser comparado estatisticamente com scores de Bolognesi.

**Registro**: `tipo_match = classificacao_complementar`, `fonte_ideologia = classificacao_complementar_documentada`. Fontes detalhadas em `fontes_complementares_ideologia.csv`.

## 4. Tratamento de S.PART.

- S.PART. e codigo interno usado pela API da Camara para deputados sem filiacao partidaria no momento do registro.
- Nao e partido politico.
- Aparece em gastos (183 registros), votos (77 registros) e proposicoes (85 registros).
- **Decisao: S.PART. nao recebe classificacao ideologica.** Deve ser tratado nas queries como `sem_partido` ou `nao_classificado`. Consta na tabela de aliases como `codigo_especial_sem_partido`. Nao entra na tabela v2 de partidos.

## 5. Tabela de aliases

Foram documentados 14 mapeamentos de normalizacao em `partidos_aliases_normalizacao.csv`:

| Sigla original | Sigla normalizada | Tipo | Registros nos dados |
|---|---|---|---|
| DEM | UNIAO | partido extinto incorporado | 2 proposicoes |
| PSL | UNIAO | partido extinto fusao | 11 proposicoes |
| PODEMOS | PODE | forma extensa da sigla | 1 orientacao + 15 proposicoes |
| REP | REPUBLICANOS | abreviacao API | 1 proposicao |
| REPUB | REPUBLICANOS | abreviacao API | 1 proposicao |
| REPUBLICA | REPUBLICANOS | abreviacao API | 1 proposicao |
| REPUBLICAN | REPUBLICANOS | forma truncada | 1 orientacao |
| SOLIDARIED | SOLIDARIEDADE | forma truncada | 121 orientacoes |
| PATRIOTA | PRD | partido extinto incorporado | votos + orientacoes + 1415 proposicoes |
| PROS | SOLIDARIEDADE | partido extinto incorporado | votos + 231 proposicoes |
| PSC | PODE | partido extinto incorporado | votos + 568 proposicoes |
| PTB | PRD | partido extinto incorporado | 1 proposicao |

Entradas especiais (nao sao normalizacoes de sigla):

| Sigla | Acao | Motivo |
|---|---|---|
| S.PART. | codigo_especial_sem_partido | Nao e partido; flag de ausencia |
| ARENA | historico_fora_do_escopo | Extinto 1979; sem dados atuais |

## 6. Partidos cobertos por Bolognesi - match direto (13 partidos)

AVANTE, MDB, NOVO, PCDOB, PDT, PSB, PSD, PSDB, PSOL, PT, PV, REDE, UNIAO

Todos possuem coluna `ideol_22_*` correspondente direta em `df_experts.csv`.

## 7. Partidos cobertos por Bolognesi - equivalencia (7 partidos)

| Partido | Coluna Bolognesi | Observacao |
|---|---|---|
| CIDADANIA | ideol_22_cdd | PPS em 2018 |
| PL | ideol_22_pl | PR em 2018 |
| PODE | ideol_22_podemos | pode em 2018 |
| PP | ideol_22_progre | progressistas em 2018 |
| REPUBLICANOS | ideol_22_rep | PRB em 2018 |
| SOLIDARIEDADE | ideol_22_sdd | sdd |
| PATRIOTA | ideol_22_patri | historico, incorporado ao PRD |

## 8. Partidos cobertos por Bolognesi - proxy de fusao (1 partido)

| Partido | Componentes | Score |
|---|---|---|
| PRD | media simples de PTB + Patriota | 8.161 |

UNIAO possui match direto em 2022 (`ideol_22_uniao`), mas proxy historico em 2018 por media de DEM + PSL.

## 9. Partidos historicos com score Bolognesi mantidos na v2 (4 partidos)

| Partido | Status v2 | Score | Mapear para |
|---|---|---|---|
| PATRIOTA | historico_mapeavel_PRD | 8.601 | PRD |
| PROS | historico_mapeavel_SOLIDARIEDADE | 7.445 | SOLIDARIEDADE |
| PSC | historico_mapeavel_PODE | 8.410 | PODE |
| PTB | historico_mapeavel_PRD | 7.720 | PRD |

Estes partidos mantidos com score proprio permitem que registros de 2023 (pre-incorporacao) tenham classificacao ideologica sem precisar de normalizacao retroativa na ETL. A normalizacao e a alternativa preferida, mas ambas as abordagens sao validas.

## 10. Partidos por classificacao complementar (1 partido)

| Partido | Faixa | Score operacional | Fontes |
|---|---|---|---|
| MISSAO | Direita | 7.750 | 4 fontes alta + 1 media + 1 baixa |

## 11. Fontes complementares consultadas

Todas registradas em `fontes_complementares_ideologia.csv`:

1. TSE oficial: pagina do Partido Missao no TSE (alta confiabilidade)
2. Gazeta do Povo: materia sobre disputa na direita (alta)
3. Poder360: declaracao de Kim Kataguiri (alta)
4. CNN Brasil: declaracao de Renan Santos (alta)
5. Revista Crusoe: analise ideologica (media)
6. Wikipedia: verbete do partido (baixa, apoio)

## 12. Limitacoes metodologicas

1. **Score operacional vs. expert survey**: o score 7.750 de MISSAO e um ponto medio de faixa, nao uma media de respostas de experts. Comparacoes estatisticas diretas com scores Bolognesi (que possuem N, mediana e desvio-padrao) nao sao validas.

2. **Partido recente**: MISSAO foi registrado em novembro de 2025 e tem atuacao parlamentar apenas desde 2024 (via Kim Kataguiri, que migrou do UNIAO). A base de evidencias para classificacao e menor do que para partidos estabelecidos.

3. **Possivel reclassificacao futura**: se uma nova rodada de expert survey for publicada apos 2025, MISSAO provavelmente sera incluido e podera receber score empirico. Nesse caso, o score complementar deve ser substituido.

4. **Partidos historicos na v2**: PATRIOTA, PROS, PSC e PTB estao na v2 com score proprio para cobrir registros de 2023. A decisao de usar seus scores proprios ou normalizar para o partido sucessor depende da estrategia de ETL adotada.

5. **S.PART.**: 345 registros nos dados nao recebem classificacao ideologica. Queries que calculam percentuais por ideologia devem tratar S.PART. como exclusao ou como categoria separada.

## 13. Validacoes executadas

| Validacao | Resultado |
|---|---|
| ARENA ausente da v2 | OK - confirmado |
| MISSAO presente na v2 | OK - classificado como Direita |
| MISSAO nao tem fonte Bolognesi | OK - fonte = classificacao_complementar_documentada |
| S.PART. sem classificacao | OK - ausente da v2, tratado como codigo especial |
| Nenhum partido analitico atual sem classificacao | OK - todos os 21 ativos classificados |
| Scores numericos entre 0 e 10 | OK - todos verificados |
| Partidos Bolognesi com fonte correta | OK - todos com Bolognesi et al. 2026 |
| MISSAO com registro em fontes_complementares | OK - 6 fontes registradas |
| Total de partidos na v2 | 25 (21 ativos + 4 historicos mapeaveis) |

## 14. Proximos passos para integracao

1. **Aprovar a classificacao complementar de MISSAO** como Direita (score 7.750).
2. **Decidir estrategia de normalizacao na ETL**: normalizar siglas historicas nos dados padronizados (PATRIOTA->PRD, etc.) ou manter historicos com score proprio na tabela `partidos_ideologia`.
3. **Decidir tratamento de S.PART.**: excluir das queries ou manter como "sem_partido".
4. **Atualizar `catalogos/partidos.csv`**: remover ARENA, ajustar campo ideologia de MISSAO de "centro" para "direita".
5. **Implementar normalizacao de aliases na ETL** conforme `partidos_aliases_normalizacao.csv`.
6. **Atualizar tabela `partidos_ideologia` no banco** a partir da v2.
7. **Reexecutar Q9, Q10, Q11** apos integracao.
8. **Validar outputs** para confirmar que nenhum partido aparece como "nao classificado" (exceto S.PART., se mantido).

## Arquivos gerados nesta etapa

| Arquivo | Descricao |
|---|---|
| `partidos_ideologia_bolognesi_2022_v2.csv` | Tabela intermediaria revisada, sem ARENA, com MISSAO classificado |
| `fontes_complementares_ideologia.csv` | Registro de fontes usadas para classificacao complementar |
| `partidos_aliases_normalizacao.csv` | Tabela de aliases e normalizacao de siglas |
| `RELATORIO_TABELA_INTERMEDIARIA_V2.md` | Este relatorio |
