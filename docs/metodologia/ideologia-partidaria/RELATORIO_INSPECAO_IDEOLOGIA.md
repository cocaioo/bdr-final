# Relatorio de inspecao - ideologia partidaria

Data da inspecao: 2026-06-25

## 1. Arquivos encontrados

Arquivos metodologicos localizados em `docs/metodologia/ideologia-partidaria/`:

| Arquivo | Uso na inspecao |
|---|---|
| `df_experts.csv` | Base de respostas individuais de especialistas sobre ideologia e objetivo/comportamento dos partidos |
| `Codebook_experts.docx` | Codebook das variaveis da base |

Tambem ha PDFs na mesma pasta (`1807-0191-op-31-e31120.pdf` e `download.pdf`), mas esta inspecao ficou restrita aos arquivos solicitados: `df_experts.csv` e `Codebook_experts.docx`.

## 2. Resumo do `df_experts.csv`

| Item | Resultado |
|---|---|
| Caminho | `docs/metodologia/ideologia-partidaria/df_experts.csv` |
| Separador | `;` |
| Encoding lido com sucesso | `utf-8-sig` |
| Linhas | 1090 |
| Colunas | 135 |
| Rodadas identificadas pelo `id` | 2018 e 2022 |
| Linhas com `id` 2018 | 519 |
| Linhas com `id` 2022 | 571 |

A base esta em formato largo: cada linha e um especialista/respondente, e cada partido aparece como coluna. As primeiras quatro posicoes de `id` indicam o ano da rodada. Nas linhas de 2018, as colunas de 2022 aparecem vazias; nas linhas de 2022, as colunas de 2018 aparecem vazias.

### Padrao das colunas

| Grupo | Significado |
|---|---|
| `id` | Identificacao do respondente; os quatro primeiros digitos indicam o ano |
| `ideol_18_*` | Posicionamento ideologico do partido na rodada de 2018 |
| `obj_18_*` | Objetivo/comportamento dominante do partido na rodada de 2018 |
| `ideol_22_*` | Posicionamento ideologico do partido na rodada de 2022 |
| `obj_22_*` | Objetivo/comportamento dominante do partido na rodada de 2022 |

Sufixos de partidos encontrados em `ideol_18_*`:

`mdb`, `ptb`, `pdt`, `pt`, `dem`, `p_cdo_b`, `psb`, `psdb`, `ptc`, `psc`, `pmn`, `prp`, `pps`, `pv`, `avante`, `progressistas`, `pstu`, `pcb`, `prtb`, `phs`, `dc`, `pco`, `pode`, `psl`, `prb`, `psol`, `pr`, `psd`, `ppl`, `patri`, `pros`, `sdd`, `novo`, `rede`, `pmb`.

Sufixos de partidos encontrados em `ideol_22_*`:

`mdb`, `uniao`, `ptb`, `pdt`, `pt`, `p_cdo_b`, `psb`, `psdb`, `agir`, `psc`, `pmn`, `cdd`, `pv`, `avante`, `progre`, `pstu`, `pcb`, `prtb`, `dc`, `pco`, `podemos`, `rep`, `psol`, `pl`, `psd`, `patri`, `pros`, `sdd`, `novo`, `rede`, `pmb`, `up`.

Observacao: em 2018, a coluna ideologica do Progressistas vem como `ideol_18_progressistas`, enquanto a coluna de objetivo vem como `obj_18_progre`. Em 2022, o sufixo usado e `progre`.

### Primeiras 10 linhas, colunas selecionadas

Como o CSV tem 135 colunas, a amostra abaixo mostra as primeiras 10 linhas com colunas ideologicas selecionadas de 2018 e 2022.

| id | ideol_18_mdb | ideol_18_pt | ideol_18_psdb | ideol_18_prb | ideol_18_pr | ideol_18_psl | ideol_22_mdb | ideol_22_pt | ideol_22_psdb | ideol_22_rep | ideol_22_pl | ideol_22_uniao |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 20180001 | 4 | 3 | 4 | 8 | 7 | 6 |  |  |  |  |  |  |
| 20180002 | 6 | 1 | 6 | 6 | 8 | 7 |  |  |  |  |  |  |
| 20180003 |  | 2 | 4 | 6 | 4 | 7 |  |  |  |  |  |  |
| 20180004 | 5 | 2 |  | 7 | 6 | 9 |  |  |  |  |  |  |
| 20180005 |  |  | 10 | 10 | 10 | 10 |  |  |  |  |  |  |
| 20180006 | 6 | 3 | 7 | 6 | 10 | 7 |  |  |  |  |  |  |
| 20180007 | 6 | 3 | 7 | 7 | 9 | 8 |  |  |  |  |  |  |
| 20180008 | 6 | 3 | 6 | 8 | 8 | 9 |  |  |  |  |  |  |
| 20180009 |  | 2 | 10 | 10 | 10 | 10 |  |  |  |  |  |  |
| 20180010 |  | 1 | 9 | 8 | 8 | 4 |  |  |  |  |  |  |

### Variaveis de ideologia e agregacao

As colunas relevantes para classificacao esquerda-direita sao `ideol_18_*` e `ideol_22_*`.

Nao ha colunas prontas de media, mediana, desvio-padrao ou score agregado por partido. A base contem respostas individuais dos especialistas. Portanto, para usar a base no BDR, e necessario agregar as respostas por partido e ano. Nesta inspecao, os scores abaixo foram calculados como media aritmetica dos valores numericos nao vazios. O valor `0` e uma resposta valida na escala, nao missing.

As colunas `obj_18_*` e `obj_22_*` representam objetivo/comportamento partidario, nao ideologia. Valores observados nessas colunas incluem `policy-seeking`, `office-seeking`, `vote-seeking` e `nao sei`.

## 3. Resumo do `Codebook_experts.docx`

O codebook contem seis paragrafos e define:

| Variavel | Significado |
|---|---|
| `Id` | Identificacao do respondente; os quatro primeiros digitos indicam o ano dos dados |
| `Ideo_18_...` | Posicionamento ideologico do partido X na rodada de 2018 |
| `Obj_18_...` | Objetivo/comportamento dominante do partido X na rodada de 2018, segundo classificacao de Wolinetz (2002): `policy-seeking`, `office-seeking`, `vote-seeking` |
| `Ideo_22_...` | Posicionamento ideologico do partido X na rodada de 2022 |
| `Obj_22_...` | Objetivo/comportamento dominante do partido X na rodada de 2022, segundo classificacao de Wolinetz (2002): `policy-seeking`, `office-seeking`, `vote-seeking` |

Escala ideologica identificada:

| Valor | Interpretacao |
|---:|---|
| 0 | Extrema esquerda |
| 10 | Extrema direita |

O codebook confirma que a escala vai da esquerda para a direita: `0` representa extrema esquerda e `10` representa extrema direita.

O codebook nao recomenda explicitamente uma variavel final agregada, nem define se o uso final deve ser media, mediana ou outro estimador. Tambem nao traz regra especifica para missing values ou partidos sem classificacao. Pela estrutura do CSV, as celulas vazias devem ser tratadas como missing; ja o valor `0` deve ser preservado como resposta valida.

## 4. Comparacao com `catalogos/partidos.csv`

O catalogo atual tem 26 partidos: 21 ativos e 5 historicos.

### Diagnostico partido a partido

Scores abaixo sao medias das respostas validas nas colunas `ideol_*`. Para partidos criados por fusao ou mudanca de nome, a coluna de observacao explicita a equivalencia usada. O `score_2022` e o candidato natural para `score_usado` na 57a Legislatura.

| Partido BDR | Status | Match | Score 2018 | N 2018 | Score 2022 | N 2022 | Faixa 2022 | Observacao |
|---|---|---|---:|---:|---:|---:|---|---|
| AVANTE | ativo | direto | 6.317 | 451 | 6.473 | 423 | Centro-direita | `avante` |
| CIDADANIA | ativo | equivalencia | 4.926 | 472 | 6.170 | 412 | Centro-direita | `pps` em 2018; `cdd` em 2022, inferido como Cidadania |
| MDB | ativo | direto | 7.015 | 453 | 6.499 | 473 | Centro-direita | `mdb` |
| MISSAO | ativo | sem solucao |  |  |  |  |  | Nao localizado na base |
| NOVO | ativo | direto | 8.133 | 474 | 8.666 | 494 | Extrema direita | `novo` |
| PCDOB | ativo | direto | 1.920 | 512 | 1.778 | 508 | Esquerda | `p_cdo_b`, match por normalizacao grafica |
| PDT | ativo | direto | 3.925 | 483 | 3.855 | 463 | Centro-esquerda | `pdt` |
| PL | ativo | equivalencia | 7.781 | 488 | 8.796 | 489 | Extrema direita | `pr` em 2018; `pl` em 2022 |
| PODE | ativo | equivalencia | 7.243 | 469 | 7.437 | 471 | Direita | `pode` em 2018; `podemos` em 2022 |
| PP | ativo | equivalencia | 8.198 | 496 | 8.153 | 498 | Direita | `progressistas`/`progre` |
| PRD | ativo | equivalencia | 7.324 | 971 | 8.161 | 974 | Direita | Proxy por media simples de PTB e Patriota |
| PSB | ativo | direto | 4.047 | 468 | 3.589 | 465 | Centro-esquerda | `psb` |
| PSD | ativo | direto | 7.092 | 479 | 6.937 | 443 | Centro-direita | `psd` |
| PSDB | ativo | direto | 7.115 | 496 | 6.759 | 453 | Centro-direita | `psdb` |
| PSOL | ativo | direto | 1.283 | 513 | 1.415 | 509 | Extrema esquerda | `psol` |
| PT | ativo | direto | 2.974 | 504 | 2.679 | 501 | Esquerda | `pt` |
| PV | ativo | direto | 5.290 | 435 | 4.123 | 398 | Centro-esquerda | `pv` |
| REDE | ativo | direto | 4.774 | 451 | 3.692 | 451 | Centro-esquerda | `rede` |
| REPUBLICANOS | ativo | equivalencia | 7.778 | 495 | 8.333 | 492 | Direita | `prb` em 2018; `rep` em 2022 |
| SOLIDARIEDADE | ativo | equivalencia | 6.501 | 469 | 6.007 | 407 | Centro-direita | `sdd` |
| UNIAO | ativo | direto | 8.341 | 1000 | 8.485 | 507 | Direita | `uniao` em 2022; 2018 calculado por media simples DEM + PSL apenas como historico |
| ARENA | historico | sem solucao |  |  |  |  |  | Nao localizado na base |
| PATRIOTA | historico | equivalencia | 8.551 | 490 | 8.601 | 491 | Extrema direita | `patri` |
| PROS | historico | direto | 7.475 | 472 | 7.445 | 440 | Direita | `pros` |
| PSC | historico | direto | 8.329 | 505 | 8.410 | 497 | Direita | `psc` |
| PTB | historico | direto | 6.098 | 481 | 7.720 | 483 | Direita | `ptb` |

### Resumo dos matches

| Categoria | Quantidade | Partidos |
|---|---:|---|
| Match direto ou por normalizacao grafica simples | 16 | AVANTE, MDB, NOVO, PCDOB, PDT, PSB, PSD, PSDB, PSOL, PT, PV, REDE, UNIAO, PROS, PSC, PTB |
| Exigem equivalencia, abreviacao ou proxy | 8 | CIDADANIA, PL, PODE, PP, PRD, REPUBLICANOS, SOLIDARIEDADE, PATRIOTA |
| Sem classificacao clara | 2 | MISSAO, ARENA |

### Equivalencias relevantes

| Regra esperada | Situacao na base |
|---|---|
| PRB -> Republicanos | Aplicavel: `ideol_18_prb` e `ideol_22_rep` |
| PR -> PL | Aplicavel: `ideol_18_pr` e `ideol_22_pl` |
| PPS -> Cidadania | Aplicavel para 2018: `ideol_18_pps`; em 2022 aparece `ideol_22_cdd`, inferido como Cidadania |
| DEM + PSL -> Uniao Brasil | Aplicavel como historico de 2018; em 2022 ha `ideol_22_uniao`, que deve prevalecer |
| PTB + Patriota -> PRD | Nao ha PRD direto; proxy possivel por media simples de `ideol_22_ptb` e `ideol_22_patri` |
| PODE/PTN -> Podemos | Aplicavel para PODE/Podemos; PTN nao aparece no CSV inspecionado |
| PP/Progressistas/PPB | Aplicavel para Progressistas/`progre`; PPB nao aparece no CSV inspecionado |

### Partidos da base que nao aparecem no catalogo BDR

Apos considerar as equivalencias acima, os seguintes partidos/sufixos aparecem na base de experts, mas nao aparecem em `catalogos/partidos.csv`:

| Ano | Sufixo na base | Media ideologica | N |
|---:|---|---:|---:|
| 2018 | `ptc` | 7.858 | 480 |
| 2018 | `pmn` | 6.881 | 444 |
| 2018 | `prp` | 7.595 | 472 |
| 2018 | `pstu` | 0.514 | 514 |
| 2018 | `pcb` | 0.906 | 512 |
| 2018 | `prtb` | 7.450 | 462 |
| 2018 | `phs` | 6.959 | 443 |
| 2018 | `dc` | 8.111 | 503 |
| 2018 | `pco` | 0.607 | 509 |
| 2018 | `ppl` | 7.269 | 465 |
| 2018 | `pmb` | 6.903 | 431 |
| 2022 | `agir` | 7.550 | 422 |
| 2022 | `pmn` | 6.742 | 403 |
| 2022 | `pstu` | 0.514 | 508 |
| 2022 | `pcb` | 0.686 | 507 |
| 2022 | `prtb` | 7.490 | 431 |
| 2022 | `dc` | 8.211 | 488 |
| 2022 | `pco` | 0.547 | 503 |
| 2022 | `pmb` | 7.292 | 418 |
| 2022 | `up` | 1.626 | 441 |

## 5. Recomendacao operacional para o BDR

Como o BDR analisa a 57a Legislatura, de 2023 a 2026, a recomendacao e usar a rodada de 2022 como referencia principal.

Regra proposta:

1. `score_usado` = media aritmetica das respostas validas da coluna `ideol_22_*` correspondente ao partido.
2. `score_2018` deve ser mantido apenas como historico/comparativo.
3. `score_2022` deve prevalecer sobre proxies de partidos predecessores quando existir coluna direta de 2022. Exemplo: para UNIAO, usar `ideol_22_uniao`, nao a media DEM + PSL.
4. Para partidos com mudanca de nome/sigla, usar equivalencia documentada em `observacao_equivalencia`.
5. Para PRD, como nao ha coluna direta, ha duas opcoes metodologicas:
   - opcao conservadora: deixar `score_usado` nulo ate aprovacao da regra de fusao;
   - opcao operacional recomendada se o BDR precisar classificar PRD: usar media simples de `ideol_22_ptb` e `ideol_22_patri`, resultando em score aproximado de 8.161, com observacao explicita de proxy por fusao.
6. Para MISSAO e ARENA, manter sem score da base Bolognesi et al. ate definicao manual ou outra fonte.

Nao parece adequado usar media entre 2018 e 2022 como regra geral para a 57a Legislatura, porque isso diluiria a informacao mais proxima do ciclo eleitoral que antecede 2023-2026. A media 2018-2022 pode ser guardada como indicador de estabilidade historica, mas nao como score principal.

## 6. Estrutura sugerida para tabela intermediaria

Proposta de tabela intermediaria, ainda sem criacao nesta etapa:

| Campo | Tipo sugerido | Observacao |
|---|---|---|
| `sigla_partido` | texto | Sigla canonica usada pelo BDR |
| `nome_partido` | texto | Nome por extenso, quando disponivel |
| `score_2018` | numerico | Media das respostas validas de 2018; pode ser nulo |
| `score_2022` | numerico | Media das respostas validas de 2022; pode ser nulo |
| `score_usado` | numerico | Preferencialmente `score_2022` para a 57a Legislatura |
| `ideologia_faixa` | texto | Faixa derivada do `score_usado` |
| `campo_ideologico` | texto | Esquerda, centro ou direita, derivado da faixa |
| `fonte_ideologia` | texto | Ex.: `Bolognesi et al., expert survey 2018-2022` |
| `ano_base` | inteiro | Ano principal do score usado; recomendado: 2022 |
| `observacao_equivalencia` | texto | Regra de match, fusao, mudanca de nome ou ausencia de classificacao |

Campos adicionais uteis antes de publicar:

| Campo | Motivo |
|---|---|
| `n_respostas_2018` | Auditar cobertura por partido |
| `n_respostas_2022` | Auditar cobertura por partido |
| `mediana_2018` | Comparar robustez contra media |
| `mediana_2022` | Comparar robustez contra media |
| `desvio_padrao_2022` | Medir dispersao entre especialistas |

## 7. Proposta de faixas ideologicas

Como o codebook confirma escala 0-10, nao e necessario normalizar esta base antes de aplicar faixas. Se no futuro for usada uma escala 1-11, normalizar antes para 0-10 com formula geral: `(valor - minimo) / (maximo - minimo) * 10`.

Faixas sugeridas para `score_usado` em escala 0-10:

| Intervalo | `ideologia_faixa` | `campo_ideologico` |
|---:|---|---|
| 0.00 a 1.49 | Extrema esquerda | esquerda |
| 1.50 a 2.99 | Esquerda | esquerda |
| 3.00 a 4.49 | Centro-esquerda | esquerda |
| 4.50 a 5.49 | Centro | centro |
| 5.50 a 6.99 | Centro-direita | direita |
| 7.00 a 8.49 | Direita | direita |
| 8.50 a 10.00 | Extrema direita | direita |

Essas faixas deixam o centro mais estreito ao redor do ponto medio 5 e preservam as extremidades da escala. Antes de alterar o catalogo, vale validar se o BDR prefere uma divisao simetrica em sete grupos de largura semelhante ou uma classificacao com centro mais amplo.

## 8. Coluna recomendada como score ideologico

Nao existe uma unica coluna pronta chamada "score final". A coluna base recomendada e o conjunto `ideol_22_*`, agregado por partido.

Para cada partido:

`score_2022 = media dos valores validos em ideol_22_<partido>`

Para a 57a Legislatura:

`score_usado = score_2022`

Excecoes:

| Partido | Regra proposta |
|---|---|
| PRD | Sem coluna direta; proxy possivel por media simples de PTB e Patriota em 2022 |
| MISSAO | Sem correspondencia na base |
| ARENA | Sem correspondencia na base |
| Partidos sem coluna 2022 mas com predecessor | Usar apenas se houver regra de equivalencia aprovada e documentada |

## 9. Proximos passos antes de alterar o catalogo

1. Validar a referencia bibliografica final da fonte Bolognesi et al. a ser gravada em `fonte_ideologia`.
2. Decidir formalmente se a agregacao principal sera media ou mediana. A media foi usada nesta inspecao por ser simples e transparente, mas a mediana pode ser mais robusta a respostas extremas.
3. Aprovar a tabela de equivalencias, especialmente `cdd` -> Cidadania, `rep` -> Republicanos, `sdd` -> Solidariedade e `progre` -> PP/Progressistas.
4. Decidir a regra do PRD: deixar sem score ou usar proxy PTB + Patriota.
5. Definir como tratar MISSAO e ARENA.
6. Criar uma tabela intermediaria versionada antes de alterar `catalogos/partidos.csv`.
7. Atualizar depois, em etapa separada, os processos que alimentam `partidos_ideologia` e validar os impactos nas questoes Q9, Q10 e Q11.

## 10. Resumo executivo

| Pergunta | Resposta |
|---|---|
| A base pode ser usada para atualizar a metodologia? | Sim, com agregacao das respostas individuais e tabela de equivalencias documentada |
| Coluna/familia de colunas para score ideologico | `ideol_22_*`, agregada por media das respostas validas |
| Ha score de 2022? | Sim, para 32 partidos/sufixos na base |
| Quantos partidos do BDR tem match direto? | 16 de 26 |
| Quantos exigem equivalencia/proxy? | 8 de 26 |
| Quantos ficaram sem solucao clara? | 2 de 26: MISSAO e ARENA |
| Regra recomendada para a 57a Legislatura | Usar score de 2022 como `score_usado`; manter 2018 como historico |

