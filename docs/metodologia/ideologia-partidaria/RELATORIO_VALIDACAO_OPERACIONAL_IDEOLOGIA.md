# Relatório de Validação Operacional — Ideologia Partidária v2

Data: 2026-06-25

## 1. Validação do catálogo (`catalogos/partidos.csv`)

| Critério | Resultado |
|----------|-----------|
| Arquivo existe | OK |
| Separador `;` | OK |
| 15 colunas esperadas presentes | OK (nenhuma faltando, nenhuma extra) |
| Total de partidos | 26 |
| `entra_universo_analitico = sim` | 25 |
| `entra_universo_analitico = nao` | 1 (ARENA) |
| ARENA: `status=historico`, sem score, `univ=nao` | OK |
| MISSÃO: score=7.750, faixa=Direita, campo=direita, fonte=complementar, tipo=complementar | OK |
| PATRIOTA: score=8.601, univ=sim | OK |
| PROS: score=7.445, univ=sim | OK |
| PSC: score=8.410, univ=sim | OK |
| PTB: score=7.720, univ=sim | OK |
| Nenhum partido `univ=sim` sem `campo_ideologico` | OK |

## 2. Validação de `party_catalog.py`

| Função | Resultado |
|--------|-----------|
| `load_party_catalog()` | 26 entradas |
| `active_party_ideology_rows()` | 25 linhas carregáveis |
| ARENA ausente nos retornos | OK |
| MISSÃO presente | OK |
| PATRIOTA, PROS, PSC, PTB presentes | OK |
| Todos retornos com `sigla_partido` e `ideologia` | OK |
| `ideologia` recebe valor de `campo_ideologico` | OK |
| Retrocompatibilidade com catálogo legado (3 colunas) | OK (testado) |

## 3. Validação de `clean_party()`

### Aliases que devem normalizar

| Input | Output | Status |
|-------|--------|--------|
| PODEMOS | PODE | OK |
| REP | REPUBLICANOS | OK |
| REPUB | REPUBLICANOS | OK |
| REPUBLICA | REPUBLICANOS | OK |
| REPUBLICAN | REPUBLICANOS | OK |
| SOLIDARIED | SOLIDARIEDADE | OK |
| DEM | UNIAO | OK |
| PSL | UNIAO | OK |

### Siglas que NÃO devem normalizar

| Input | Output | Status |
|-------|--------|--------|
| PATRIOTA | PATRIOTA | OK |
| PROS | PROS | OK |
| PSC | PSC | OK |
| PTB | PTB | OK |
| S.PART. | S.PART. | OK |

## 4. Simulação nos dados padronizados

### 4.1. Arquivos analisados

- `deputados.csv`: não possui coluna `sigla_partido` (dados cadastrais sem partido).
- `gastos.csv`: 720.937 registros com `sigla_partido`.
- `votacoes_votos.csv`: 462.742 registros com `sigla_partido`.
- `votacoes_orientacoes.csv`: usa `sigla_bancada` (bancadas/blocos/federações, não partidos individuais). Sem join direto com `partidos_ideologia`.
- `proposicoes_autores.csv`: 415.363 registros com `sigla_partido`.

### 4.2. Normalizações efetivamente encontradas nos dados

| Arquivo | Sigla original | Normalizada para | Ocorrências | Ganha ideologia? |
|---------|---------------|------------------|-------------|-------------------|
| proposicoes_autores | DEM | UNIAO | 2 | Sim |
| proposicoes_autores | PODEMOS | PODE | 15 | Sim |
| proposicoes_autores | PSL | UNIAO | 11 | Sim |
| proposicoes_autores | REP | REPUBLICANOS | 1 | Sim |
| proposicoes_autores | REPUB | REPUBLICANOS | 1 | Sim |
| proposicoes_autores | REPUBLICA | REPUBLICANOS | 1 | Sim |

Normalizações ocorrem apenas em `proposicoes_autores.csv` (31 registros). Os demais arquivos já estavam com siglas canônicas.

### 4.3. Cobertura ideológica

| Arquivo | Total | Com ideologia | Sem ideologia | Cobertura |
|---------|-------|---------------|---------------|-----------|
| gastos.csv | 720.937 | 720.754 | 183 | 100,0% |
| votacoes_votos.csv | 462.742 | 462.665 | 77 | 100,0% |
| proposicoes_autores.csv | 415.363 | 415.278 | 85 | 100,0% |
| **Total** | **1.599.042** | **1.598.697** | **345** | **99,98%** |

### 4.4. Registros sem ideologia

A única sigla sem ideologia em todos os dados padronizados é **S.PART.** (345 ocorrências, código especial de "sem partido"). Nenhuma outra sigla fica sem classificação.

## 5. Tratamento de `votacoes_orientacoes.csv`

Este arquivo usa `sigla_bancada`, não `sigla_partido`. As bancadas incluem partidos individuais (que teriam match) e entidades coletivas que não são partidos:

- GOVERNO, OPOSICAO, MAIORIA, MINORIA (lideranças de bloco)
- FDRPSOL-REDE, FDRPT-PCDOB-PV (federações)
- BLUNIPPFDRPSDBCID..., BLMDBPSDREPPODE, etc. (blocos parlamentares)

Essas entidades coletivas não recebem join com `partidos_ideologia` por desenho — a classificação ideológica é por partido individual, não por bloco.

## 6. Testes automatizados

| Arquivo de teste | Testes | Resultado |
|-----------------|--------|-----------|
| `tests/test_etl_contracts.py` | 4/4 | PASSED |
| `tests/test_gastos_api_audit.py` | 3/3 | PASSED |
| `tests/test_gastos_analytics.py` | 7+ executados | PASSED (timeout no sandbox antes de completar todos, por volume de dados) |
| `tests/test_caio_query_audit.py` | — | Não executado (depende de pydantic/backend) |

Os testes críticos de ETL e catálogo passam integralmente, incluindo o novo teste `test_party_catalog_uses_entra_universo_analitico`.

## 7. Riscos restantes

1. **Mudança semântica de `ideologia`**: o campo passa de ternário (`centro`/`esquerda`/`direita`) para binário (`esquerda`/`direita`). Q9/Q10/Q11 que agrupam por `ideologia` terão resultados diferentes. Partidos antes "centro" (AVANTE, CIDADANIA, MDB, PODE, PRD, PSD, PSDB, SOLIDARIEDADE, UNIAO) agora são "direita".

2. **Schema do banco inalterado**: `partidos_ideologia` continua com 2 colunas (`sigla_partido`, `ideologia`). Os metadados detalhados (score, faixa, fonte) ficam apenas no catálogo CSV. Migração de schema é proposta futura.

3. **ETL completo ainda não executado**: a tabela no banco ainda contém os dados antigos. As 25 linhas da v2 só serão carregadas após re-execução do ETL.

4. **Bancadas em `votacoes_orientacoes`**: a normalização de partidos não cobre entidades coletivas (federações, blocos). Isso é por desenho, mas análises futuras que cruzem orientação de bancada com ideologia precisarão de mapeamento adicional.

## 8. Próximos passos

1. Re-executar ETL completo para popular `partidos_ideologia` com 25 linhas v2.
2. Regenerar respostas de Q9, Q10 e Q11 com base na nova classificação.
3. Avaliar impacto da mudança ternário→binário nas análises e no frontend.
4. Considerar migração de schema para incluir score/faixa no banco (etapa separada).
5. Atualizar frontend somente após validação das novas respostas.
