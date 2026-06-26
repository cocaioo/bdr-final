# Q14 — Posição Ideológica Revelada (W-NOMINATE)

Indicadores comportamentais derivados do histórico de votações nominais dos
deputados, estimados por W-NOMINATE e tornados comparáveis ao índice partidário
de Bolognesi et al.

## Origem dos dados

Coordenadas **já orientadas** produzidas por `run_wnominate.R`
(`ideal_points_oriented.csv`): a Dimensão 1 foi alinhada de forma data-driven —
a média da Dim 1 por partido foi correlacionada com o score Bolognesi e o sinal
ajustado para que **valores altos = direita**. Esta etapa não reexecuta o modelo.

## Score comportamental 0–10

A coordenada W-NOMINATE da Dimensão 1 (intervalo teórico [-1, 1]) é convertida
por um **mapa linear fixo**:

    score_comportamental_0_10 = (coord1D + 1) * 5

Assim, -1 → 0 (extrema esquerda), 0 → 5 (centro), +1 → 10 (extrema direita).
Optou-se pela escala teórica fixa (e não min–max da amostra) para que o score
seja **estável e reprodutível**, independente de qual conjunto de deputados foi
estimado, e diretamente comparável ao score Bolognesi (também em 0–10).

## Calibração de escala (alinhamento ao Bolognesi)

O score comportamental bruto (0–10) e o score Bolognesi (0–10) estão na mesma
faixa, mas têm **distribuições diferentes**: o comportamental concentra-se na
parte baixa-média da escala. Comparar os dois diretamente produziria um desvio
sistematicamente negativo — um **artefato de escala**, não divergência política
real. Por isso, alinhamos as escalas por uma **calibração linear (OLS)** do score
comportamental sobre o benchmark partidário:

    score_calibrado_0_10 = a + b * score_comportamental_0_10

ajustada entre os deputados com score de partido (e limitada a [0, 10]). O score
calibrado preserva o **ordenamento** do W-NOMINATE, mas passa a ocupar a mesma
faixa do Bolognesi, tornando o desvio interpretável.

## Desvio em relação ao partido (Bolognesi)

Calculado sobre a escala **calibrada**, centrando os desvios em torno de zero:

    desvio_partido = score_calibrado_0_10 - ideologia_score_partido

Valores **positivos** indicam voto mais à **direita** do que o benchmark do
partido; **negativos**, mais à **esquerda**. A direção é rotulada como
`mais a direita` / `mais a esquerda` / `alinhado` (tolerância de ±0.5
ponto). Mantém-se também a coluna `score_comportamental_0_10` (bruto) para
transparência, e `score_comportamental_z` (z-score) como campo de auditoria.

## Desvio em relação à bancada

    score_bancada_0_10 = média do score comportamental dos deputados do partido
    desvio_bancada     = score_comportamental_0_10 - score_bancada_0_10

Mede a coesão interna: quão distante o deputado está da média da própria bancada.

## Confiança

`confianca` = proporção de votos do deputado **corretamente classificados** pelo
modelo W-NOMINATE (coluna `CC`, 0–1). Faixas: alta (≥ 0.85),
média (≥ 0.7), baixa (< 0.7). É um indicador de quão bem o modelo
explica o comportamento daquele deputado.

## Síntese

- Deputados processados: **634**.
- Correlação score comportamental × Bolognesi (nível deputado): **0.753**.

## Arquivos gerados

- `q14_ideal_points_deputados.csv` — um deputado por linha (indicadores finais).
- `q14_desvio_partido.csv` — resumo de desvio por partido.
- `q14_desvio_bancada.csv` — coesão de bancada por partido.

## Limitações

- A escala 0–10 e o score Bolognesi medem coisas correlatas mas distintas
  (comportamento de voto revelado vs. ideologia declarada por especialistas);
  desvios não implicam erro, e sim divergência informativa.
- A execução-base usou `trials = 1` no W-NOMINATE (sem erros-padrão); `se1D`/`se2D`
  são 0 e não há intervalo de confiança nas coordenadas.
- Partidos com poucos deputados (ex.: bancadas unipessoais) têm média de bancada
  pouco informativa.
