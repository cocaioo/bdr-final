# Relatório de Regeneração — Q9, Q10 e Q11

Data: 2026-06-25

## 1. Estado da tabela `partidos_ideologia`

PostgreSQL **não disponível** no sandbox de execução. A regeneração foi realizada via Python/pandas, replicando a lógica dos SQLs canônicos contra os dados padronizados (`dados_padronizados/*.csv`) com a tabela `partidos_ideologia` simulada por `active_party_ideology_rows()` do catálogo atualizado (25 linhas, classificação binária esquerda/direita).

Para carga definitiva no banco, executar o ETL completo:
```bash
python -m src.main          # carrega todas as tabelas incluindo partidos_ideologia
```
Ou carga mínima:
```python
from src.party_catalog import active_party_ideology_rows
rows = active_party_ideology_rows()  # 25 dicts com sigla_partido + ideologia
# INSERT INTO partidos_ideologia ...
```

## 2. Arquivos regenerados

| Arquivo | Conteúdo |
|---------|----------|
| `JF/partidos-ideologia-votacao/q9/q9_vies_deputado.txt` | Q9.1 catálogo, Q9.2 correlação ideologia×proposição, Q9.3 aderência por deputado |
| `JF/partidos-ideologia-votacao/q9/q9_vies_deputado_detalhe.csv` | Detalhe voto-a-voto (462.665 linhas) |
| `JF/partidos-ideologia-votacao/q10/q10_alinhamento_partidos.txt` | Q10 ranking consolidado, por ano e disciplina individual |
| `JF/partidos-ideologia-votacao/q11/q11_ranking_partidos.txt` | Q11.a frequência, Q11.b proposições, Q11.c gastos, Q11.d nuvem de palavras |

Normalização `clean_party()` aplicada a todos os campos `sigla_partido` durante a regeneração, simulando um ETL completo com os novos aliases.

## 3. Validação de Q9

- 25 partidos classificados: 17 direita + 8 esquerda.
- Nenhum partido como "nao classificado".
- ARENA ausente.
- MISSÃO presente como direita.
- PATRIOTA, PROS, PSC e PTB classificados com campo ideológico próprio (direita).
- S.PART. excluído (não faz JOIN com `partidos_ideologia`, esperado por desenho).
- Aliases normalizados (PODEMOS, DEM, PSL, REP, REPUB, REPUBLICA) não aparecem como entradas separadas.
- 3.115 linhas de correlação ideologia×proposição (antes eram 3 campos, agora 2).
- 821 deputados no resumo de aderência.

## 4. Validação de Q10

- 23 partidos no ranking consolidado de alinhamento, todos classificados.
- Nenhum "nao classificado" (antes: PATRIOTA e PSC apareciam).
- ARENA ausente.
- MISSÃO presente como direita.
- PATRIOTA e PSC classificados como direita.
- PROS e PTB ausentes em Q10 — esperado: esses partidos históricos não têm orientações de bancada registradas no período, portanto não geram votos com diretriz.
- Matching de bancada: exato + fuzzy (bancada LIKE %partido%), consistente com o SQL original.
- Bancadas coletivas (GOVERNO, OPOSICAO, federações, blocos) não entram como partidos — tratadas apenas como fontes de orientação na junção.
- 276.466 votos com diretriz processados.

## 5. Validação de Q11

- Q11.a: 25 partidos, único "nao classificado" = S.PART. (esperado).
- Q11.b: 26 partidos (inclui S.PART.), único "nao classificado" = S.PART.
- Q11.c: 22 partidos, único "nao classificado" = S.PART.
- Q11.d: 26 partidos, único "nao classificado" = S.PART.
- ARENA ausente em todas as sub-consultas.
- MISSÃO classificada como direita.
- PATRIOTA, PROS, PSC, PTB classificados como direita.
- Aliases textuais (PODEMOS, DEM, PSL, REP, REPUB, REPUBLICA) eliminados — seus registros agora contabilizam sob a sigla canônica.

## 6. Comparação antes/depois

### Siglas "nao classificado"

| Questão | Antes | Depois |
|---------|-------|--------|
| Q9 | nenhuma | nenhuma |
| Q10 | PATRIOTA, PSC | nenhuma |
| Q11 | DEM, PATRIOTA, PODEMOS, PROS, PSC, PSL, PTB, REP, REPUB, REPUBLICA, S.PART. | S.PART. |

### Siglas corrigidas

- **Classificação própria**: PATRIOTA, PROS, PSC, PTB (4 partidos históricos que antes não tinham entrada em `partidos_ideologia`).
- **Normalização de aliases**: PODEMOS→PODE, DEM→UNIAO, PSL→UNIAO, REP→REPUBLICANOS, REPUB→REPUBLICANOS, REPUBLICA→REPUBLICANOS (6 aliases eliminados como entradas fantasma).
- **Total corrigido**: 10 siglas que antes apareciam como "nao classificado" ou entrada separada, agora resolvidas.

### Mudança semântica

A classificação passou de ternária (centro/esquerda/direita) para binária (esquerda/direita), conforme Bolognesi et al. 2026. Partidos antes classificados como "centro" (AVANTE, CIDADANIA, MDB, PODE, PRD, PSD, PSDB, SOLIDARIEDADE, UNIAO) agora constam como "direita" com base no score da expert survey (todos com score > 5.0).

## 7. Siglas ainda sem ideologia

Única: **S.PART.** — código especial de "sem partido" nos dados da Câmara. Não é um partido real e não deve receber classificação ideológica. Aparece em:
- votacoes_votos: 77 registros
- proposicoes_autores: 85 registros
- gastos: 183 registros

## 8. Tratamento de bancadas/blocos em Q10

`votacoes_orientacoes` contém `sigla_bancada` que pode ser:
- Partido individual (match exato com `sigla_partido`).
- Federação (ex: FDRPSOL-REDE, FDRPT-PCDOB-PV) — match fuzzy por substring.
- Bloco parlamentar (ex: BLMDBPSDREPPODE) — match fuzzy por substring.
- Categoria coletiva (GOVERNO, OPOSICAO, MAIORIA, MINORIA) — sem match com partido.

A lógica de Q10 usa `vo.sigla_bancada = vv.sigla_partido OR vo.sigla_bancada LIKE '%' || vv.sigla_partido || '%'`, consistente com o SQL canônico. Bancadas coletivas que não contêm nenhuma sigla de partido como substring são naturalmente excluídas do alinhamento.

## 9. Testes executados

| Teste | Resultado |
|-------|-----------|
| test_party_catalog_marks_historical_without_loading_as_active | PASSED |
| test_party_catalog_uses_entra_universo_analitico | PASSED |
| test_extract_table_frame_records_sources_years_and_raw_rows | PASSED |
| test_standardize_table_frame_preserves_normalization_validation_and_dedupe | PASSED |
| test_reconciliation_key_normalizes_values | PASSED |
| test_compare_frames_preserves_duplicate_differences | PASSED |
| test_diagnose_local_base_reports_required_scope | PASSED |

**7/7 PASSED**.

## 10. Pendências restantes

1. **Re-executar ETL completo** com PostgreSQL para carregar `partidos_ideologia` no banco com 25 linhas.
2. **Re-executar SQLs canônicos** contra o banco atualizado para gerar artefatos com formatação `\pset` nativa do psql (a regeneração via pandas é funcional mas com formatação simplificada).
3. **Validar adapters do backend** que consomem os artefatos Q9/Q10/Q11 — verificar se a mudança ternário→binário exige ajustes.
4. **Atualizar frontend** para refletir classificação binária (etapa posterior, não coberta aqui).
5. **Verificar se Q11 wordcloud SVGs** precisam ser regenerados com base nos novos dados.
