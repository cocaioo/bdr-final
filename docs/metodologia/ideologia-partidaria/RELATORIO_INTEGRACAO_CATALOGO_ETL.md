# Relatório de Integração: Catálogo de Partidos e ETL (v2 Bolognesi)

Data: 2026-06-25

## 1. Backup

Backup criado: `catalogos/partidos.before_ideologia_bolognesi_v2.csv`

Conteúdo original: 26 linhas, 3 colunas (`sigla_partido`, `status`, `ideologia`), separador `;`, encoding UTF-8.

## 2. Colunas adicionadas/atualizadas

O catálogo antigo tinha 3 colunas: `sigla_partido`, `status`, `ideologia`.

O catálogo atualizado tem 15 colunas:

| Coluna | Origem (v2) | Descrição |
|--------|-------------|-----------|
| `sigla_partido` | `sigla_partido` | Chave primária |
| `status` | `status_partido` | ativo, historico, historico_mapeavel_* |
| `ideologia_score` | `score_usado` | Score numérico contínuo (1-10) |
| `ideologia_faixa` | `ideologia_faixa` | Extrema esquerda, Esquerda, Centro-esquerda, Centro-direita, Direita, Extrema direita |
| `campo_ideologico` | `campo_ideologico` | esquerda ou direita (binário) |
| `fonte_ideologia` | `fonte_ideologia` | Fonte da classificação |
| `ano_base_ideologia` | `ano_base` | Ano da rodada utilizada |
| `tipo_match_ideologia` | `tipo_match` | direto, equivalencia, proxy_fusao, classificacao_complementar |
| `observacao_ideologia` | `observacao_equivalencia` | Notas metodológicas |
| `score_2018` | `score_2018` | Média da rodada 2018 |
| `score_2022` | `score_2022` | Média da rodada 2022 |
| `mediana_2022` | `mediana_2022` | Mediana da rodada 2022 |
| `n_respostas_2022` | `n_respostas_2022` | Número de respondentes em 2022 |
| `desvio_padrao_2022` | `desvio_padrao_2022` | Desvio padrão 2022 |
| `entra_universo_analitico` | nova | sim/nao — controla carga em partidos_ideologia |

A coluna `ideologia` (antigo campo ternário centro/esquerda/direita) foi removida do catálogo. O campo `campo_ideologico` (binário: esquerda/direita) assume seu papel no ETL. A classificação granular fica em `ideologia_faixa`.

## 3. Contagem de linhas

- Antes: 26 partidos (21 ativos + 5 históricos)
- Depois: 26 partidos (21 ativos + 5 históricos)
- Com `entra_universo_analitico = sim`: 25
- Com `entra_universo_analitico = nao`: 1 (ARENA)

## 4. Decisão sobre ARENA

- Mantida no catálogo com `status = historico` para preservar histórico.
- Marcada com `entra_universo_analitico = nao`.
- Sem score ideológico preenchido.
- Não será carregada na tabela `partidos_ideologia`.
- Motivo: partido do período militar, não contemplado pela base Bolognesi.

## 5. Decisão sobre MISSÃO

- Mantida no catálogo com `status = ativo`.
- `ideologia_score = 7.750` (ponto médio da faixa Direita 7.000–8.499).
- `ideologia_faixa = Direita`.
- `campo_ideologico = direita`.
- `tipo_match_ideologia = classificacao_complementar`.
- `fonte_ideologia = classificacao_complementar_documentada`.
- `entra_universo_analitico = sim`.
- Observação documenta que o score é operacional, não média de expert survey.

## 6. Decisão sobre PATRIOTA, PROS, PSC e PTB

Todos mantidos no catálogo com scores próprios da v2:

| Sigla | Score | Status | Sucessor |
|-------|-------|--------|----------|
| PATRIOTA | 8.601 | historico_mapeavel_PRD | PRD |
| PROS | 7.445 | historico_mapeavel_SOLIDARIEDADE | SOLIDARIEDADE |
| PSC | 8.410 | historico_mapeavel_PODE | PODE |
| PTB | 7.720 | historico_mapeavel_PRD | PRD |

Todos com `entra_universo_analitico = sim`. Carregados em `partidos_ideologia` com campo ideológico próprio, sem normalização para sucessores.

## 7. Regras de normalização implementadas

Implementadas em `src/cleaning.py`, função `clean_party()`:

Aliases textuais:
- PODEMOS → PODE
- REP → REPUBLICANOS
- REPUB → REPUBLICANOS
- REPUBLICA → REPUBLICANOS
- REPUBLICAN → REPUBLICANOS
- SOLIDARIED → SOLIDARIEDADE

Fusões sem score próprio:
- DEM → UNIAO
- PSL → UNIAO

## 8. Regras deliberadamente NÃO implementadas

- PATRIOTA não normaliza para PRD (score próprio).
- PROS não normaliza para SOLIDARIEDADE (score próprio).
- PSC não normaliza para PODE (score próprio).
- PTB não normaliza para PRD (score próprio).
- S.PART. não recebe normalização nem score. Tratado como sem partido na camada de dados.

## 9. Alterações no ETL

### `src/party_catalog.py`

- `PartyCatalogEntry` ampliado com 13 novos campos.
- Nova propriedade `in_analytic_universe` verifica `entra_universo_analitico == "sim"`.
- `active_party_ideology_rows()` agora carrega partidos por `entra_universo_analitico = sim` + `campo_ideologico` preenchido.
- Retrocompatibilidade: se o catálogo não tem as novas colunas, usa o filtro legado (`status == ativo`).

### `src/cleaning.py`

- `clean_party()`: adicionados 8 novos aliases (PODEMOS, REP, REPUB, REPUBLICA, REPUBLICAN, SOLIDARIED, DEM, PSL).

### `tests/test_etl_contracts.py`

- Teste existente ajustado para novo formato de catálogo.
- Novo teste `test_party_catalog_uses_entra_universo_analitico` valida que partidos históricos com score são carregados e ARENA é excluída.

## 10. Schema da tabela `partidos_ideologia`

Schema atual (não alterado):
```sql
CREATE TABLE partidos_ideologia (
    sigla_partido    VARCHAR(20) PRIMARY KEY,
    ideologia        VARCHAR(20) NOT NULL
);
```

O schema comporta a carga das 25 linhas: `sigla_partido` recebe a sigla, `ideologia` recebe `campo_ideologico` (esquerda/direita).

Alteração mínima futura proposta (em etapa separada) para preservar score e metodologia no banco:
```sql
ALTER TABLE partidos_ideologia
    ADD COLUMN ideologia_score NUMERIC(5,3),
    ADD COLUMN ideologia_faixa VARCHAR(30),
    ADD COLUMN fonte_ideologia VARCHAR(100),
    ADD COLUMN tipo_match VARCHAR(40);
```

## 11. Impacto esperado em Q9/Q10/Q11

- Q9, Q10 e Q11 fazem JOIN com `partidos_ideologia` pela coluna `ideologia`.
- Com a atualização, `ideologia` passa de ternário (centro/esquerda/direita) para binário (esquerda/direita).
- Partidos antes classificados como "centro" agora ficam em "direita" (ex: AVANTE, CIDADANIA, MDB, PODE, PSD, PSDB, SOLIDARIEDADE, UNIAO, PRD).
- As respostas de Q9/Q10/Q11 precisarão ser regeneradas após o ETL ser re-executado com o novo catálogo.
- Nenhum arquivo de Q9/Q10/Q11 foi alterado nesta etapa.
- Nenhum arquivo de frontend foi alterado.

## 12. Pendências antes de regenerar respostas

1. Re-executar ETL completo para popular `partidos_ideologia` com 25 linhas.
2. Decidir se o schema do banco precisa das colunas extras (score, faixa, etc.) para queries futuras.
3. Regenerar respostas de Q9, Q10 e Q11 com base na nova classificação binária.
4. Atualizar frontend somente após validação das novas respostas.
