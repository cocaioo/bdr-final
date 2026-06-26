# Relatorio de validacao da classificacao ideologica completa - Q9/Q10/Q11

Data da execucao local: 2026-06-25

## 1. Erro identificado

A validacao anterior carregou `grupo4.partidos_ideologia` apenas com uma classificacao macro em `ideologia`, derivada de `campo_ideologico`, e apresentou Q9/Q10/Q11 como se o modelo fosse essencialmente `direita/esquerda`.

Essa validacao foi invalidada em `RELATORIO_CORRECAO_CLASSIFICACAO_COMPLETA.md`. Os artefatos daquela etapa nao sao finais.

## 2. Schema

`Banco/init.sql` foi atualizado. A tabela final tem:

| coluna | tipo | observacao |
|---|---:|---|
| `sigla_partido` | text | chave primaria |
| `ideologia` | text | legado; espelha `campo_ideologico` |
| `ideologia_score` | numeric(5,3) | score 0-10 |
| `ideologia_faixa` | text | faixa granular |
| `campo_ideologico` | text | macro: esquerda, centro, direita |
| `fonte_ideologia` | text | fonte da classificacao |
| `ano_base_ideologia` | text | ano base |
| `tipo_match_ideologia` | text | direto, equivalencia, proxy etc. |
| `observacao_ideologia` | text | nota metodologica |

Constraints adicionadas:

- `ideologia_score` entre 0 e 10 quando preenchido.
- `campo_ideologico` em `('esquerda', 'centro', 'direita')` quando preenchido.
- `ideologia` igual a `campo_ideologico` quando ambos existem.

## 3. ETL

`src/party_catalog.py` agora retorna as nove colunas de carga, filtrando `entra_universo_analitico = sim`.

`src/mappings.py` agora carrega:

`sigla_partido`, `ideologia`, `ideologia_score`, `ideologia_faixa`, `campo_ideologico`, `fonte_ideologia`, `ano_base_ideologia`, `tipo_match_ideologia`, `observacao_ideologia`.

O CSV `dados_padronizados/partidos_ideologia.csv` foi regenerado com essas colunas.

Resultado do ETL completo:

- 12 tabelas OK.
- `partidos_ideologia`: 25 linhas padronizadas e 25 carregadas.
- Aviso nao bloqueante: `votacoes_votos` removeu 421 linhas por campos obrigatorios nulos, comportamento ja tratado pelo ETL.

## 4. Banco local

Opcao escolhida: **B - ALTER TABLE manual**.

Motivo: o container `bdr-postgres` ja estava ativo com volume persistente; preservar o volume foi mais seguro do que remover dados locais. Foi aplicado ALTER idempotente em `grupo4.partidos_ideologia`, com adicao das novas colunas e constraints, seguido do ETL completo.

Validacao do banco:

- Total de linhas: 25.
- Linhas com score/faixa/fonte preenchidos: 25.
- `ideologia = campo_ideologico`: 25.
- ARENA ausente.
- S.PART. ausente.

Faixas presentes no catalogo carregado:

- Centro-direita
- Centro-esquerda
- Direita
- Esquerda
- Extrema direita
- Extrema esquerda

Observacao: a metodologia e o schema suportam `Centro`; nenhuma das 25 linhas carregadas nesta versao do catalogo esta nessa faixa.

## 5. Conteudo final de `partidos_ideologia`

| partido | score | faixa | campo | fonte/tipo |
|---|---:|---|---|---|
| PSOL | 1.415 | Extrema esquerda | esquerda | Bolognesi / direto |
| PCDOB | 1.778 | Esquerda | esquerda | Bolognesi / direto |
| PT | 2.679 | Esquerda | esquerda | Bolognesi / direto |
| PSB | 3.589 | Centro-esquerda | esquerda | Bolognesi / direto |
| REDE | 3.692 | Centro-esquerda | esquerda | Bolognesi / direto |
| PDT | 3.855 | Centro-esquerda | esquerda | Bolognesi / direto |
| PV | 4.123 | Centro-esquerda | esquerda | Bolognesi / direto |
| SOLIDARIEDADE | 6.007 | Centro-direita | direita | Bolognesi / equivalencia |
| CIDADANIA | 6.170 | Centro-direita | direita | Bolognesi / equivalencia |
| AVANTE | 6.473 | Centro-direita | direita | Bolognesi / direto |
| MDB | 6.499 | Centro-direita | direita | Bolognesi / direto |
| PSDB | 6.759 | Centro-direita | direita | Bolognesi / direto |
| PSD | 6.937 | Centro-direita | direita | Bolognesi / direto |
| PODE | 7.437 | Direita | direita | Bolognesi / equivalencia |
| PROS | 7.445 | Direita | direita | Bolognesi / direto |
| PTB | 7.720 | Direita | direita | Bolognesi / direto |
| MISSAO | 7.750 | Direita | direita | classificacao complementar / classificacao_complementar |
| PP | 8.153 | Direita | direita | Bolognesi / equivalencia |
| PRD | 8.161 | Direita | direita | Bolognesi / proxy_fusao |
| REPUBLICANOS | 8.333 | Direita | direita | Bolognesi / equivalencia |
| PSC | 8.410 | Direita | direita | Bolognesi / direto |
| UNIAO | 8.485 | Direita | direita | Bolognesi / direto |
| PATRIOTA | 8.601 | Extrema direita | direita | Bolognesi / equivalencia |
| NOVO | 8.666 | Extrema direita | direita | Bolognesi / direto |
| PL | 8.796 | Extrema direita | direita | Bolognesi / equivalencia |

## 6. Mudancas em Q9

`JF/partidos-ideologia-votacao/q9/q9.sql` foi atualizado.

- Titulo corrigido para `Q9 - Vies ideologico dos deputados por score, faixa e campo ideologico`.
- Q9.1 lista partidos com score, faixa, campo, fonte e tipo de match.
- Q9.2 agrupa por `ideologia_faixa` e preserva `campo_ideologico`.
- Q9.3 e o CSV de detalhe incluem `ideologia_score`, `ideologia_faixa` e `campo_ideologico`.

Artefatos:

- `q9_vies_deputado.txt` - 2.126.503 bytes.
- `q9_vies_deputado_detalhe.csv` - 54.397.599 bytes.

## 7. Mudancas em Q10

`JF/partidos-ideologia-votacao/q10/q10.sql` foi atualizado.

- Ranking consolidado, por ano e disciplina individual incluem `ideologia_score`, `ideologia_faixa` e `campo_ideologico`.
- A logica de alinhamento agora usa somente `vo.sigla_bancada = vv.sigla_partido`.
- O casamento por `LIKE '%partido%'` foi removido para nao tratar blocos/bancadas como partidos.
- `S.PART.` continua ignorado.

Artefato:

- `q10_alinhamento_partidos.txt` - 108.458 bytes.

## 8. Mudancas em Q11

`JF/partidos-ideologia-votacao/q11/q11.sql` foi atualizado.

- Rankings de votacoes, proposicoes, gastos e score composto incluem `ideologia_score`, `ideologia_faixa` e `campo_ideologico`.
- O ranking composto preserva a faixa ideologica.
- Texto antigo de cores binario/ternario foi removido do adapter.
- `dashboard/scripts/generate_q11_wordclouds.py` foi revisado para considerar `ideologia_faixa` e usar fallback por `campo_ideologico` quando necessario.
- Os assets publicos do frontend nao foram alterados nesta etapa, em respeito ao escopo.

Artefato:

- `q11_ranking_partidos.txt` - 54.337 bytes.

## 9. Backend

`dashboard/backend/app/party_catalog.py` agora le as colunas novas quando presentes, mantendo compatibilidade com `ideologia` legado.

`dashboard/backend/app/adapters/questions.py` foi ajustado:

- Q9 usa `ideologia_faixa` como dimensao primaria do sankey, com fallback para `ideologia`.
- Q10/Q11 docstrings e descricoes foram atualizadas para score/faixa/campo.
- Q11 removeu descricao antiga de cores por esquerda/direita.

`dashboard/backend/app/question_registry.json` agora espera as colunas novas em Q9/Q10/Q11.

## 10. Testes executados

| comando | resultado |
|---|---|
| `.\venv\Scripts\python.exe -m compileall -q src dashboard\backend\app` | OK |
| `.\venv\Scripts\python.exe -m json.tool dashboard\backend\app\question_registry.json` | OK |
| `.\venv\Scripts\python.exe -m pytest -q tests/test_etl_contracts.py` | 9 passed |
| `cd dashboard\backend; ..\..\venv\Scripts\python.exe -m pytest -q` | 30 passed |
| `.\venv\Scripts\python.exe -m pytest -q tests` | 94 passed |

Nenhum timeout foi observado.

## 11. Pendencias

- Frontend nao foi alterado nesta etapa.
- Se outro ambiente ja tiver volume PostgreSQL criado, ele deve recriar o banco ou aplicar ALTER TABLE equivalente antes do ETL.
- Relatorios antigos que descrevem a etapa binaria permanecem como historico e nao devem ser usados como validacao final.

## 12. Conclusao

A integracao esta aprovada nesta etapa: `partidos_ideologia` e os artefatos Q9/Q10/Q11 preservam score, faixa, campo, fonte e tipo de match. A metodologia Bolognesi completa foi mantida, com MISSAO documentado como classificacao complementar e ARENA/S.PART. fora da tabela analitica.
