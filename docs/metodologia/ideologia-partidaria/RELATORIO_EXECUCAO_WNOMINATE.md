# Relatório — Execução do W-NOMINATE

**Etapa:** estimação dos pontos ideais comportamentais (revealed voting positions)
dos deputados via W-NOMINATE, a partir da matriz canônica filtrada.
**Status:** ✅ **Execução concluída com sucesso. Resultados validados.**
**Data:** 2026-06-26

---

## 1. Configuração da execução

| Parâmetro | Valor |
|-----------|-------|
| Script | `scripts/ideal_points/run_wnominate.R` |
| Insumo | `dados_processados/ideal_points/votes_matrix_filtered.csv` |
| Metadados | `deputies_metadata.csv`, `dados_padronizados/partidos_ideologia.csv` |
| Deputados (linhas) | 634 |
| Votações (colunas) | 1.325 |
| Dimensões | 2 |
| Bootstrap (`trials`) | 1 (sem erros-padrão — primeira execução rápida) |
| Tempo de execução | ~569 s (≈ 9,5 min) |

## 2. Orientação data-driven (Dimensão 1)

A direção do eixo esquerda-direita **não** foi fixada por âncora arbitrária. Em vez
disso: estimou-se o modelo, calculou-se a média da Dimensão 1 por partido e
correlacionou-se com o score ideológico externo de **Bolognesi et al.**
(`ideologia_score`). Como a correlação foi **negativa**, a Dimensão 1 foi
multiplicada por −1, de modo que **score alto = direita**.

| Métrica | Valor |
|---------|-------|
| Correlação Dim1 × Bolognesi (bruta) | **−0,8231** |
| Dimensão 1 invertida? | **SIM** |
| Correlação após orientação | **+0,8231** |

Uma correlação de **+0,82** entre o comportamento de voto revelado e o benchmark
de especialistas é uma forte validação convergente: o eixo comportamental recupera
bem o espectro ideológico declarado.

## 3. Qualidade do ajuste do modelo

| Métrica | Dim 1 | 2 Dims |
|---------|-------|--------|
| Classificação correta | 91,17% | 91,75% |
| APRE | 0,652 | 0,675 |
| GMP | 0,791 | 0,812 |

- Previsões "Sim" corretas: 215.556 de 231.628 (93,1%).
- Previsões "Não" corretas: 160.394 de 178.148 (90,0%).
- **0 legisladores e 0 votações descartados** pelo W-NOMINATE (todos atenderam aos
  requisitos mínimos de participação e de "lopsidedness"). Isso confirma que a
  filtragem feita em `prepare_votes_matrix.py` já entregou uma matriz adequada.

## 4. Sanidade do ordenamento partidário (médias da Dim 1, já orientada)

| Posição | Partido | Média Dim 1 | Bolognesi | n |
|---------|---------|-------------|-----------|---|
| Esquerda | PT | −0,887 | 2,68 | 76 |
| | PCdoB | −0,866 | 1,78 | 11 |
| | PSOL | −0,741 | 1,42 | 15 |
| | PSB | −0,669 | 3,59 | 14 |
| | PDT | −0,589 | 3,86 | 19 |
| Centro | PSD | −0,325 | 6,94 | 65 |
| | MDB | −0,256 | 6,50 | 49 |
| Direita | PP | −0,156 | 8,15 | 63 |
| | PL | +0,416 | 8,80 | 110 |
| | MISSÃO | +0,476 | 7,75 | 1 |
| | NOVO | +0,815 | 8,67 | 5 |

O ordenamento é coerente: blocos de esquerda (PT, PCdoB, PSOL) no extremo negativo e
de direita (NOVO, PL) no extremo positivo. A tabela completa dos 21 partidos está em
`wnominate_orientation.csv`.

## 5. Arquivos gerados

Em `dados_processados/ideal_points/`:

| Arquivo | Conteúdo |
|---------|----------|
| `raw_ideal_points.csv` | Saída bruta do W-NOMINATE (antes da orientação). Inclui `coord1D`, `coord2D`, contagens de acerto, GMP, CC por deputado. |
| `ideal_points_oriented.csv` | Coordenadas com a **Dim 1 orientada** ao benchmark Bolognesi (score alto = direita). |
| `wnominate_orientation.csv` | Médias da Dim 1 por partido vs score Bolognesi (diagnóstico de orientação). |
| `wnominate_fit_summary.txt` | Resumo de ajuste do modelo (classificação, APRE, GMP). |

A matriz de entrada (`votes_matrix_filtered.csv`, `votes_metadata.csv`,
`deputies_metadata.csv`) **não foi modificada**.

## 6. Limitações conhecidas

- **Sem erros-padrão.** A execução usou `trials = 1` (mínimo aceito pelo
  `wnominate`), priorizando velocidade. Não há intervalos de confiança nas
  coordenadas. Para erros-padrão por bootstrap, reexecutar com `trials = 100` —
  bem mais lento.
- **Desvios pontuais ideologia declarada × comportamento.** Alguns partidos
  pequenos (ex.: PV, REDE) aparecem mais à esquerda na Dim 1 do que no score
  Bolognesi. Isso é esperado: o W-NOMINATE capta o eixo governo–oposição/disciplina
  de voto do período, que nem sempre coincide com a ideologia declarada por
  especialistas. Não compromete a orientação global (corr +0,82).
- **MISSÃO tem n = 1 deputado**, então sua média partidária é pouco informativa.
- **Dimensão 2 não interpretada** aqui — fica para a etapa de pós-processamento.

## 7. Próxima etapa

`process_ideal_points.py` (ainda **não** executado): reescalar as coordenadas para
0–10, calibrar/validar a orientação esquerda-direita, calcular desvios individuais
em relação ao score do partido e à média da bancada, e exportar os arquivos finais.

## 8. Correções aplicadas durante a execução

Dois ajustes na API do `pscl`/`wnominate` foram necessários e já estão no script:

1. Removido `notInLegis = NA` do `rollcall()` — colidia com `missing = NA`
   ("codes are not unique").
2. `trials` ajustado de `0` para `1` — o `wnominate()` não aceita `trials` < 1.
