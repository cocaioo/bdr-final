# Relatorio de auditoria final Q9/Q10/Q11 pre-frontend

Data da auditoria local: 2026-06-25

## 1. Cobertura do join direto da Q10

Consulta de cobertura em `grupo4.votacoes_orientacoes`:

| metrica | total |
|---|---:|
| total_orientacoes | 15.148 |
| orientacoes_com_match_partidario | 4.875 |
| orientacoes_sem_match_partidario | 10.273 |

Principais `sigla_bancada` sem match partidario direto:

| sigla_bancada | qtd |
|---|---:|
| MINORIA | 1.412 |
| GOVERNO | 1.391 |
| OPOSICAO | 1.391 |
| FDRPSOL-REDE | 1.343 |
| MAIORIA | 1.335 |
| FDRPT-PCDOB-PV | 1.251 |
| BLUNIPPFDRPSDBCID... | 561 |
| BLMDBPSDREPPODE | 474 |
| BLAVANSOLIDPRD... | 411 |
| BLPLFDRPTUNIPP... | 227 |
| BLUNIPPPSD... | 224 |
| BLMDBPSDREPPODEPSC | 94 |
| BLPLUNIPPPSD... | 79 |
| FDRPSDB-CIDADAN | 62 |
| FDRPSDB-CIDADANIA | 13 |
| BLOCOPARLAMENTAR | 5 |

Auditoria de aliases de alerta:

- `PODEMOS`, `REP`, `REPUB`, `REPUBLICA`, `REPUBLICAN`, `SOLIDARIED`, `DEM`, `PSL`, `UNIAO` e `UNIAO` com variacao inesperada: 0 ocorrencias sem match.
- Rechecagem aplicando `clean_party()` nas bancadas sem match: 0 casos normalizariam para partido real do catalogo.

Comparacao com o join antigo frouxo em votos com diretriz:

| metrica | total |
|---|---:|
| votos com diretriz no join direto | 68.044 |
| votos com diretriz no join frouxo antigo | 252.955 |
| diferenca | 184.911 |
| direto sobre frouxo | 26,90% |

Conclusao: a queda quantitativa e relevante e fica documentada. Ela decorre da remocao intencional de orientacoes coletivas, blocos e federacoes que o join antigo capturava por substring. Nao foi identificado partido real ou alias partidario perdido pelo join direto. A Q10 passa na auditoria de cobertura para o escopo aprovado: alinhamento apenas quando ha orientacao partidaria direta.

## 2. Inspecao dos artefatos Q9/Q10/Q11

Arquivos inspecionados:

- `JF/partidos-ideologia-votacao/q9/q9_vies_deputado.txt`
- `JF/partidos-ideologia-votacao/q9/q9_vies_deputado_detalhe.csv`
- `JF/partidos-ideologia-votacao/q10/q10_alinhamento_partidos.txt`
- `JF/partidos-ideologia-votacao/q11/q11_ranking_partidos.txt`

Resultado:

| artefato | ideologia_score | ideologia_faixa | campo_ideologico | observacao |
|---|---|---|---|---|
| Q9 TXT | sim | sim | sim | titulo corrigido; sem modelo binario |
| Q9 detalhe CSV | sim | sim | sim | cabecalho contem as tres colunas |
| Q10 TXT | sim | sim | sim | sem `nao classificado` |
| Q11 TXT | sim | sim | sim | `nao classificado` aparece apenas para S.PART. |

Validacoes especificas:

- Q9 nao descreve mais a metodologia como `direita / esquerda / centro`.
- Q9.1 lista score, faixa, campo, fonte e tipo de match.
- Q9.2 usa `ideologia_faixa` como dimensao granular e preserva `campo_ideologico`.
- Q9.3 e o CSV de detalhe incluem score/faixa/campo.
- Q10 inclui score/faixa/campo no consolidado, por ano e disciplina individual.
- Q10 nao inclui S.PART. e nao inclui bancadas/blocos como partidos.
- Q10 mostra MISSAO e PATRIOTA classificados quando ha dados. PROS, PSC e PTB nao aparecem na Q10 por nao terem registros qualificados com orientacao partidaria direta no resultado atual.
- Q11 inclui score/faixa/campo nos rankings de votacoes, proposicoes, gastos e score composto.
- Q11 pode exibir S.PART. como `nao classificado`; nenhum partido real ficou `nao classificado`.
- Aliases ghost nao aparecem como entradas separadas: `PODEMOS`, `REP`, `REPUB`, `REPUBLICA`, `REPUBLICAN`, `SOLIDARIED`, `DEM`, `PSL`.

## 3. Backend vivo

Backend iniciado localmente em `http://127.0.0.1:8000` apenas para a auditoria e parado ao final.

Snapshots salvos em:

`logs/validacao_backend_q9_q10_q11/`

| endpoint | HTTP | JSON valido | score/faixa/campo | warnings |
|---|---:|---|---|---:|
| `/api/meta` | 200 | sim | nao aplicavel | nao aplicavel |
| `/api/questions/q9` | 200 | sim | sim | 0 |
| `/api/questions/q10` | 200 | sim | sim | 0 |
| `/api/questions/q11` | 200 | sim | sim | 0 |

Arquivos gerados:

- `meta.json`
- `q9.json`
- `q10.json`
- `q11.json`
- `uvicorn_stdout.log`
- `uvicorn_stderr.log`

Logs do backend:

- Sem traceback.
- Sem erro.
- Sem warning relevante sobre coluna ausente.
- Requisicoes registradas com `200 OK`.

## 4. Testes executados

| comando | resultado |
|---|---|
| `.\venv\Scripts\python.exe -m compileall -q src dashboard\backend\app` | OK |
| `.\venv\Scripts\python.exe -m json.tool dashboard\backend\app\question_registry.json` | OK |
| `.\venv\Scripts\python.exe -m pytest -q tests/test_etl_contracts.py` | 9 passed |
| `cd dashboard\backend; ..\..\venv\Scripts\python.exe -m pytest -q` | 30 passed |

Nao foi necessario rodar novamente toda a suite da raiz porque nao houve alteracao de codigo nesta auditoria; a rodada completa anterior ja havia passado.

## 5. Pendencias para a etapa de frontend

- Frontend ainda nao foi alterado.
- Adaptar visualizacoes para expor `ideologia_score`, `ideologia_faixa` e `campo_ideologico`.
- Revisar legendas e cores no frontend para refletir faixa granular ou fallback macro.
- Decidir como comunicar visualmente que `Centro` e suportado pela metodologia, embora nao esteja presente nos 25 partidos carregados agora.

## 6. Conclusao

A auditoria final pre-frontend esta aprovada.

- Q10 nao perdeu partidos reais por causa do join direto.
- A queda de cobertura frente ao join antigo frouxo e real, mas corresponde a exclusao de blocos/federacoes/bancadas coletivas, nao a perda de partidos do catalogo.
- Q9/Q10/Q11 preservam `ideologia_score`, `ideologia_faixa` e `campo_ideologico`.
- O backend responde Q9/Q10/Q11 sem erro e sem warnings de coluna ausente.
- Nenhum arquivo de frontend foi alterado nesta auditoria.
