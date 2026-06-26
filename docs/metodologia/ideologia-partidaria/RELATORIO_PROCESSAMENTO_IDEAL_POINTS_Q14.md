# Relatório — Processamento dos Pontos Ideais (Q14)

**Etapa:** transformação das coordenadas W-NOMINATE orientadas em indicadores
interpretativos finais para o dashboard (Q14 — posição ideológica revelada).
**Status:** ✅ **Concluída e validada.** O W-NOMINATE **não** foi reexecutado.
**Data:** 2026-06-26

---

## 1. Entradas

| Arquivo | Uso |
|---------|-----|
| `dados_processados/ideal_points/ideal_points_oriented.csv` | Coordenadas W-NOMINATE já orientadas (Dim 1 alinhada ao Bolognesi). Colunas usadas: `deputy_id, name, party, coord1D, coord2D, CC, correct*/wrong*`. |
| `dados_processados/ideal_points/deputies_metadata.csv` | `valid_votes` por deputado. |
| `dados_padronizados/partidos_ideologia.csv` | Score ideológico partidário (Bolognesi). |

## 2. Indicadores produzidos

Para cada um dos **634 deputados**:

| Campo | Definição |
|-------|-----------|
| `score_comportamental_0_10` | Mapa linear fixo `(coord1D + 1) * 5` da coordenada W-NOMINATE [-1,1]. Estável e reprodutível (não min–max). |
| `score_calibrado_0_10` | Score comportamental **alinhado à escala Bolognesi** por regressão linear (ver §3). |
| `desvio_partido` / `direcao_desvio_partido` | `score_calibrado_0_10 − ideologia_score_partido`; direção em {mais a direita, mais a esquerda, alinhado} (tolerância ±0,5). |
| `score_bancada_0_10` | Média do score comportamental dos deputados do partido. |
| `desvio_bancada` / `direcao_desvio_bancada` | `score_comportamental_0_10 − score_bancada_0_10` (coesão interna). |
| `confianca` / `confianca_faixa` | Proporção de votos do deputado corretamente classificados pelo modelo (`CC`, 0–1); faixas: alta ≥ 0,85, média ≥ 0,70, baixa < 0,70. |
| `qtd_votos_validos`, `qtd_votacoes_usadas` | Participação do deputado. |
| `score_comportamental_z` | z-score do score bruto (campo auxiliar de auditoria). |

## 3. Calibração de escala (decisão metodológica)

A validação detectou um **viés de escala**: o score comportamental concentra-se na
faixa baixa-média (média global ≈ 3,7) enquanto o Bolognesi usa toda a amplitude
(PL ≈ 8,8). Comparar diretamente faria ~92% dos deputados parecerem "mais à
esquerda" que o partido — um artefato, não divergência política real.

**Solução aplicada (escolha do usuário): alinhar as escalas antes do desvio.** Uma
regressão linear (OLS) ajusta o score comportamental ao benchmark partidário:

```
score_calibrado_0_10 = 3.8497 + 0.7511 * score_comportamental_0_10
```

A correlação (ordenamento) é preservada; apenas a localização/amplitude muda. O
desvio em relação ao partido passa a ser calculado sobre o `score_calibrado_0_10`.

**Efeito:** desvio médio caiu de −2,11 (direto) para **−0,02** (calibrado), agora
centrado em zero. O `score_comportamental_0_10` bruto é mantido para transparência.

## 4. Resultados e validação

| Verificação | Resultado |
|-------------|-----------|
| Deputados processados | 634 (0 duplicados) |
| Scores em [0,10] | ✅ bruto [0,02; 9,74]; calibrado [3,86; 10,00] |
| Valores ausentes (score / Bolognesi) | 0 / 0 (todos os 21 partidos casaram) |
| Média do `desvio_partido` | −0,02 (centrado) |
| Distribuição de direção (partido) | 245 esquerda · 244 direita · 145 alinhado |
| Recálculo `desvio_partido` | ✅ consistente |
| Confiança média (CC) | 0,916 (alta: 549, média: 82, baixa: 3) |
| Corr score × Bolognesi (nível deputado) | 0,753 |

Ordenamento partidário (médias) coerente: PT/PCdoB/PSOL no extremo esquerdo,
PL/MISSÃO/NOVO no extremo direito.

## 5. Arquivos gerados

Em `JF/partidos-ideologia-votacao/q14/`:

| Arquivo | Conteúdo |
|---------|----------|
| `q14_ideal_points_deputados.csv` | Um deputado por linha — todos os indicadores finais (20 colunas). |
| `q14_desvio_partido.csv` | Resumo por partido: score médio, calibrado, desvio médio e absoluto. |
| `q14_desvio_bancada.csv` | Coesão de bancada por partido (desvio médio/máx, desvio-padrão interno). |
| `q14_metodologia.md` | Nota metodológica curta (gerada pelo script). |

As entradas (`ideal_points_oriented.csv`, `deputies_metadata.csv`,
`partidos_ideologia.csv`) **não foram modificadas**.

## 6. Limitações conhecidas

- Score comportamental e Bolognesi medem coisas correlatas mas distintas
  (voto revelado vs. ideologia declarada); desvios são divergência informativa,
  não erro.
- A execução-base do W-NOMINATE usou `trials = 1`, logo `se1D`/`se2D` = 0 e não há
  intervalo de confiança nas coordenadas.
- A calibração linear assume relação aproximadamente linear entre as duas escalas;
  partidos no centro (onde as escalas mais divergem) concentram maior incerteza.
- Bancadas unipessoais (ex.: MISSÃO, n=1) têm média de bancada pouco informativa.

## 7. Pipeline (completo)

```
prepare_votes_matrix.py   →  votes_matrix_filtered.csv
        ↓
run_wnominate.R           →  ideal_points_oriented.csv
        ↓
process_ideal_points.py   →  JF/partidos-ideologia-votacao/q14/*.csv   (ESTA etapa)
```

A etapa de estimação de pontos ideais está concluída de ponta a ponta.
