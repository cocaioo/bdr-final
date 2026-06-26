# Relatório — Matriz de Votação Nominal para W-NOMINATE

**Etapa:** construção, validação e documentação da matriz canônica de votações
nominais (insumo oficial para a futura estimação de pontos ideais).
**Status:** matriz construída e **integralmente validada**. W-NOMINATE ainda **não**
foi executado nesta etapa.
**Data de geração:** 2026-06-26

---

## 1. Objetivo

Transformar o dataset padronizado de votos (formato longo) em uma matriz
**Deputado × Votação** limpa e validada, no formato esperado por modelos espaciais
de votação (W-NOMINATE), preservando metadados completos e mantendo disponível a
matriz não filtrada. Nenhuma transformação específica do pacote R foi aplicada — a
matriz é mantida o mais genérica possível.

## 2. Insumos

- `dados_padronizados/votacoes_votos.csv` — votos em formato longo (separador `;`),
  462.742 registros de voto.
- `dados_padronizados/votacoes.csv` — metadados de votação (usado para obter a data
  de cada votação).

### Codificação de votos

| Voto original | Valor na matriz |
|---------------|-----------------|
| `Sim` | `1` |
| `Nao` | `0` |
| `Obstrucao`, `Abstencao`, `Artigo 17`, demais | `NA` |

Apenas `Sim` e `Nao` são tratados como votos comportamentais válidos. Nenhum outro
valor é gravado na matriz.

## 3. Parâmetros de filtragem

Definidos como constantes em `scripts/ideal_points/config.py` (sem números mágicos
no código):

| Constante | Valor | Descrição |
|-----------|-------|-----------|
| `MIN_VALID_VOTES_PER_ROLLCALL` | 20 | Mínimo de votos válidos para manter uma votação. |
| `MAX_UNANIMITY_RATE` | 0.97 | Votação cuja maioria ≥ 97% é "quase unânime" e removida. |
| `MIN_VALID_VOTES_PER_DEPUTY` | 20 | Mínimo de votos válidos (sobre votações retidas) para manter um deputado. |

As observações excluídas são **marcadas, nunca apagadas** (`kept_after_filter` +
`reason_if_removed`). A matriz não filtrada permanece sempre disponível.

## 4. Dimensões da matriz

| Métrica | Valor |
|---------|-------|
| Matriz canônica (não filtrada) | **636 deputados × 1.566 votações** |
| Matriz filtrada | **634 deputados × 1.325 votações** |
| Células válidas (1/0) | 455.336 |
| Células NA | 540.640 |
| **Esparsidade (fração NA)** | **0,542824 (54,28% NA)** |

## 5. Deputados removidos

**2 deputados** removidos (de 636), ambos por participação insuficiente:

| deputy_id | nome | votos válidos | motivo |
|-----------|------|---------------|--------|
| 204433 | Marcelo Calero | 17 | `too_few_valid_votes` (< 20 sobre votações retidas) |
| 225846 | Itamar Paim | 13 | `too_few_valid_votes` (< 20 sobre votações retidas) |

## 6. Votações removidas

**241 votações** removidas (de 1.566):

| Motivo | Quantidade |
|--------|-----------|
| Baixa participação (< 20 votos válidos) | 100 |
| Quase unânimes (maioria ≥ 97%) | 141 |
| **Total removido** | **241** |

## 7. Resultados da validação

A execução roda verificações de consistência e **aborta** caso alguma falhe.
Todas as **11 verificações passaram**:

```
[PASS] No duplicated deputies (rows)
[PASS] No duplicated roll calls (columns)
[PASS] Every matrix row corresponds to exactly one deputy
[PASS] Every matrix column corresponds to exactly one roll call
[PASS] Matrix deputies match deputy metadata exactly
[PASS] Matrix roll calls match roll-call metadata exactly
[PASS] Every cell is 1, 0 or NA
[PASS] Valid cells (455,336) == roll-call metadata valid_votes (455,336)
[PASS] Valid cells (455,336) == source valid votes (455,336)
[PASS] Sum of yes_votes matches number of 1-cells
[PASS] Sum of no_votes matches number of 0-cells
VALIDATION PASSED: all 11 checks OK.
```

### Estatísticas-resumo selecionadas

| Estatística | Valor |
|-------------|-------|
| Média de votos válidos por deputado | 715,94 |
| Mediana de votos válidos por deputado | 831 |
| Mín / Máx votos válidos por deputado | 16 / 1.317 |
| Média de deputados por votação | 290,76 |
| Mediana de deputados por votação | 377 |

## 8. Arquivos gerados

Em `dados_processados/ideal_points/`:

| Arquivo | Conteúdo |
|---------|----------|
| `votes_matrix.csv` | Matriz canônica não filtrada (636 × 1.566). |
| `votes_matrix_filtered.csv` | Matriz filtrada (634 × 1.325). |
| `votes_metadata.csv` | Metadados por votação (uma linha por roll-call). |
| `deputies_metadata.csv` | Metadados por deputado (uma linha por deputado). |
| `summary_statistics.csv` | Estatísticas-resumo. |

Scripts/documentação em `scripts/ideal_points/`: `config.py`,
`prepare_votes_matrix.py`, `README.md`.

## 9. Trabalho restante

- **Executar W-NOMINATE** (`run_wnominate.R`) sobre a matriz filtrada — etapa
  futura, fora do escopo deste passo.
- **Pós-processar** os pontos ideais brutos (`process_ideal_points.py`):
  calibrar a orientação esquerda-direita e reescalar (etapa futura).
- Decidir a polaridade/âncora da dimensão 1 no R (não definido aqui de propósito,
  para manter a matriz genérica).

## 10. Limitações conhecidas

- **Esparsidade alta (~54% NA):** decorrente de troca de legislatura, suplências e
  ausências; esperada para dados de câmara e tolerada por W-NOMINATE, mas reduz a
  informação disponível para deputados com poucos votos.
- **Partido = última filiação registrada:** deputados que trocaram de partido são
  rotulados pela filiação mais recente nos dados; o rótulo é apenas descritivo e
  não afeta a estimação.
- **Limiar de unanimidade (97%):** escolha de projeto; valores diferentes alteram
  quantas votações são retidas. É um parâmetro configurável, não um número mágico.
- **`valid_votes` do deputado** é contado **sobre as votações retidas**, de modo que
  o filtro de deputado é coerente com o conjunto de colunas efetivamente usado.
- Esta etapa **não** executa W-NOMINATE, **não** estima pontos ideais e **não**
  aplica nenhuma transformação específica do pacote R.
