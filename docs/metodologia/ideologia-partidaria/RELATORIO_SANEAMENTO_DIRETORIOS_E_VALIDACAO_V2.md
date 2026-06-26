# Relatorio de saneamento de diretorios e validacao v2

Data: 2026-06-25

## 1. Diretorio oficial definido

`docs/metodologia/ideologia-partidaria/`

Todos os arquivos metodologicos sobre ideologia partidaria do BDR devem estar neste diretorio. Nenhum outro caminho deve ser usado para novos arquivos.

## 2. Pastas antigas encontradas

| Caminho | Status antes | Acao |
|---|---|---|
| `docs/metodologia/ideologia_partidaria/` | Continha 5 arquivos | Arquivos movidos para diretorio oficial. Pasta nao pode ser removida (permissao). README.md criado marcando como obsoleta. |
| `metodologias/` | Nao existe | Nenhuma acao |
| `metologias/` | Nao existe | Nenhuma acao |

## 3. Arquivos movidos

| Arquivo | Origem | Destino | Conflito? |
|---|---|---|---|
| `df_experts.csv` | ideologia_partidaria/ | ideologia-partidaria/ | Nao |
| `Codebook_experts.docx` | ideologia_partidaria/ | ideologia-partidaria/ | Nao |
| `1807-0191-op-31-e31120.pdf` | ideologia_partidaria/ | ideologia-partidaria/ | Nao |
| `download.pdf` | ideologia_partidaria/ | ideologia-partidaria/ | Nao |
| `RELATORIO_INSPECAO_IDEOLOGIA.md` | ideologia_partidaria/ | ideologia-partidaria/ | Nao |

Nenhum conflito de nomes. Nenhum arquivo duplicado encontrado.

## 4. Referências internas atualizadas

| Arquivo | Referencia antiga | Referencia nova |
|---|---|---|
| `RELATORIO_TABELA_INTERMEDIARIA.md` | `docs/metodologia/ideologia_partidaria/df_experts.csv` | `docs/metodologia/ideologia-partidaria/df_experts.csv` |
| `RELATORIO_TABELA_INTERMEDIARIA.md` | `docs/metodologia/ideologia_partidaria/Codebook_experts.docx` | `docs/metodologia/ideologia-partidaria/Codebook_experts.docx` |

Apos a atualizacao, nenhuma referencia a `ideologia_partidaria` permanece em arquivos `.md`, `.csv`, `.py` ou `.sql` do repositorio.

## 5. Inventario final do diretorio oficial

| Arquivo | Tipo | Descricao |
|---|---|---|
| `df_experts.csv` | dados fonte | Base de experts Bolognesi (1090 respondentes, 135 colunas) |
| `Codebook_experts.docx` | documentacao fonte | Codebook da base de experts |
| `1807-0191-op-31-e31120.pdf` | artigo academico | Artigo Bolognesi et al. |
| `download.pdf` | artigo academico | PDF complementar |
| `partidos_ideologia_bolognesi_2022.csv` | tabela intermediaria v1 | Versao original (com ARENA, MISSAO sem classificacao) |
| `partidos_ideologia_bolognesi_2022_v2.csv` | tabela intermediaria v2 | Versao revisada (sem ARENA, MISSAO classificado) |
| `fontes_complementares_ideologia.csv` | fontes documentais | Registro de fontes para classificacao complementar |
| `partidos_aliases_normalizacao.csv` | tabela de aliases | Mapeamento de siglas historicas/abreviacoes |
| `universo_partidario_bdr_auditoria.csv` | auditoria | Auditoria completa do universo partidario |
| `RELATORIO_INSPECAO_IDEOLOGIA.md` | relatorio | Inspecao inicial da base de experts |
| `RELATORIO_TABELA_INTERMEDIARIA.md` | relatorio | Relatorio da v1 |
| `RELATORIO_TABELA_INTERMEDIARIA_V2.md` | relatorio | Relatorio da v2 |
| `RELATORIO_REVISAO_UNIVERSO_PARTIDARIO.md` | relatorio | Revisao do universo partidario |
| `RELATORIO_SANEAMENTO_DIRETORIOS_E_VALIDACAO_V2.md` | relatorio | Este relatorio |

Total: 14 arquivos no diretorio oficial.

## 6. Validacao da tabela v2

| Validacao | Resultado |
|---|---|
| Arquivo existe no diretorio oficial | OK |
| ARENA ausente | OK |
| MISSAO presente | OK |
| MISSAO score_usado = 7.750 | OK |
| MISSAO ideologia_faixa = Direita | OK |
| MISSAO campo_ideologico = direita | OK |
| MISSAO fonte_ideologia = classificacao_complementar_documentada | OK |
| MISSAO tipo_match = classificacao_complementar | OK |
| MISSAO sem fonte Bolognesi | OK |
| S.PART. ausente | OK |
| Todos os 21 ativos com score_usado | OK |
| Todos os scores em [0,10] | OK |
| Partidos Bolognesi com fonte correta | OK |
| Partidos complementares com fonte complementar | OK |
| Total partidos v2 | 25 |

## 7. Validacao da tabela de aliases

| Validacao | Resultado |
|---|---|
| DEM -> UNIAO | OK |
| PSL -> UNIAO | OK |
| PODEMOS -> PODE | OK |
| REP -> REPUBLICANOS | OK |
| REPUB -> REPUBLICANOS | OK |
| REPUBLICA -> REPUBLICANOS | OK |
| REPUBLICAN -> REPUBLICANOS | OK |
| SOLIDARIED -> SOLIDARIEDADE | OK |
| PATRIOTA -> PRD | OK |
| PROS -> SOLIDARIEDADE | OK |
| PSC -> PODE | OK |
| PTB -> PRD | OK |
| S.PART. -> codigo_especial_sem_partido | OK |
| ARENA -> historico_fora_do_escopo | OK |
| Total aliases | 14 |

## 8. Validacao das fontes complementares

| Validacao | Resultado |
|---|---|
| MISSAO tem fontes registradas | OK (6 fontes) |
| Todas com URL | OK |
| Todas com tipo de fonte | OK |
| Todas com classificacao | OK |
| Nenhuma atribuida a Bolognesi | OK |

## 9. Decisao metodologica final sobre ARENA

ARENA (Alianca Renovadora Nacional) e partido extinto em 1979. Nao aparece em nenhum dado da 57a Legislatura. Nao e registrado no TSE como partido ativo. Removida da tabela v2 de classificacao ideologica. Consta na tabela de aliases como `historico_fora_do_escopo`. Nao deve receber score ideologico.

## 10. Decisao metodologica final sobre MISSAO

Partido posterior a rodada Bolognesi 2022. Fundado pelo MBL em 2024, registro TSE aprovado em 04/11/2025. Classificacao operacional complementar baseada em fontes oficiais para existencia/representacao (TSE, Camara) e fontes jornalisticas convergentes que posicionam o partido a direita (Gazeta do Povo, Poder360, CNN Brasil, Crusoe). O score 7.750 e ponto medio da faixa "Direita" (7.000 a 8.499), nao media de expert survey. Fontes registradas em `fontes_complementares_ideologia.csv`.

## 11. Pendencias antes da integracao no catalogo

1. Aprovar a classificacao complementar de MISSAO (Direita, score 7.750).
2. Decidir estrategia de normalizacao de siglas historicas na ETL (PATRIOTA->PRD, PSC->PODE, PROS->SOLIDARIEDADE, etc.).
3. Decidir tratamento de S.PART. nas queries (excluir ou manter como "sem_partido").
4. Decidir se partidos historicos (PATRIOTA, PROS, PSC, PTB) devem manter score Bolognesi proprio ou ser normalizados para o partido sucessor.

## 12. Proximos passos recomendados

1. Aprovar este relatorio e as decisoes metodologicas.
2. Atualizar `catalogos/partidos.csv` conforme a v2 (remover ARENA, ajustar ideologia de MISSAO para "direita").
3. Implementar normalizacao de aliases na ETL conforme `partidos_aliases_normalizacao.csv`.
4. Atualizar tabela `partidos_ideologia` no banco a partir da v2.
5. Reexecutar Q9, Q10, Q11 apos integracao.
6. Validar que nenhum partido aparece como "nao classificado" nos outputs (exceto S.PART., se mantido).
