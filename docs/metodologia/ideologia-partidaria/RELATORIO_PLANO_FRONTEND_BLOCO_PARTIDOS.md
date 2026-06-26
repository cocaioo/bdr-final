# Relatório e Plano de Frontend — Bloco "Partidos, Ideologia e Votação"

> Documento de **inspeção de arquitetura e planejamento**. Esta etapa **não** implementa UI,
> **não** remove rotas e **não** altera CSS ou backend. Serve para alinhar a integração
> frontend do bloco analítico consolidado que consome Q9, Q10, Q11 e Q14.

Data: 2026-06-26 · Projeto: BDR · Frontend: `dashboard/frontend`

---

## 1. Resumo da arquitetura frontend atual

**Stack detectada:** React 19 + TypeScript + Vite 8, roteamento com `react-router-dom` v7,
gráficos com **ECharts 6**, tabelas com `@tanstack/react-table`. Testes com Vitest +
Testing Library e e2e com Playwright.

**Estrutura de pastas (`dashboard/frontend/src`):**

- `App.tsx` — shell, define todas as rotas (`<Routes>`), carrega `/api/meta` uma vez e
  injeta os filtros globais. Já contém a lógica de **aposentadoria das perguntas** do bloco.
- `api.ts` — cliente HTTP único. `API_BASE = VITE_API_URL ?? http://localhost:8001`.
  Função central `fetchQuestion(questionId, filters, table, supportedFilters)` →
  `GET /api/questions/{id}`. Há também `fetchMeta()` e a família `fetchGastos*`.
- `types.ts` — contratos compartilhados: `QuestionPayload`, `TableSpec`, `ChartSpec`,
  `SummaryCard`, `FilterState`, `MetaResponse`.
- `pages/` — uma página por **bloco/grupo** (não por pergunta):
  `HomePage`, `GastosDashboardPage`, `PerfilDashboardPage`, `PartiesDashboardPage`,
  `PanelOverviewPage` (placeholder), `DeputyProfilePage`, e `QuestionPage` (renderizador
  genérico legado de pergunta individual, usado pelas rotas `/q/:id` e `/pergunta/:id`).
- `components/` — biblioteca de componentes. **Já existem** vários do bloco de ideologia
  (ver seção 6).
- `utils/ideology.ts` — **fonte única de verdade ideológica**: ordem das faixas, cores,
  normalização de texto (`resolveRange`, `rangeColor`, `rangeLabel`, `rangeOrder`,
  `rangeField`), limites de score (0–10) e `toSpectrumParties()`.
- `utils/format.ts`, `utils/chartOptions.ts`, `utils/questionAvailability.ts`.

**Padrão de navegação por blocos:** o `Header` define `PANEL_LINKS` com 4 grupos:
`/grupos/gastos`, `/grupos/perfil`, `/grupos/producao-legislativa`,
`/grupos/partidos-votacoes`. A `HomePage` lista os mesmos grupos como cards.
**As perguntas individuais não aparecem na navegação.**

**Estado do bloco de partidos:** já existe e está parcialmente implementado.
`PartiesDashboardPage` (rota `/grupos/partidos-votacoes`) já consome **Q9, Q10 e Q11**
e renderiza 4 seções (espectro, distribuição, alinhamento, rankings). **Q14 ainda não
é consumida** por esta página — é o principal trabalho novo deste bloco.

**Sistema de estilo / tokens de tema:** CSS global em `index.css` + `visual-refresh.css`
(sem Tailwind, sem CSS-modules). Tokens em `:root`:

```
--bg: #12151c      --surface: rgba(22,28,38,.72)   --ink: #e2e8f0   --muted: #8a9ba8
--primary: #5b84a2 --accent: #b39ddb   --ok: #66bb6a --warn: #ffb74d --danger: #ef9a9a
--border: rgba(255,255,255,.08)        --shadow: 0 16px 36px rgba(0,0,0,.4)
```

Tema **escuro**, superfícies translúcidas, cantos arredondados (16px), fontes `Sora`
(títulos) e `IBM Plex Mono` (mono). As classes do bloco já existem em `index.css`
(`.parties-dashboard`, `.parties-hero`, `.parties-section`, `.ideology-legend`,
`.ranking-tabs`, `.ranking-table`, etc.).

---

## 2. Rota recomendada para o bloco

**Manter a rota já existente:** `/grupos/partidos-votacoes`.

- Já está registrada em `App.tsx` (`PARTIES_BLOCK_ROUTE`), no `Header` e na `HomePage`.
- Segue a convenção `/grupos/<slug>` usada por todos os outros blocos.
- Rótulo de navegação atual: **"Partidos e ideologia"**.

Não criar novas rotas. Q14 deve ser absorvida **dentro** desta página, como novas seções,
nunca como página própria.

---

## 3. Rotas / links obsoletos encontrados (não remover ainda)

A "aposentadoria" das perguntas do bloco **já foi iniciada** no código. Inventário:

| Item | Onde | Estado | Ação futura recomendada |
|------|------|--------|--------------------------|
| `/q/:questionId` e `/pergunta/:questionId` | `App.tsx` (rotas genéricas) | **Ainda em uso** por outras perguntas (q1–q7, q12, q13). Para `q9/q10/q11` já há `<Navigate>` → bloco. | **Manter as rotas genéricas.** Apenas estender o redirect para incluir `q14`. |
| `RETIRED_QUESTION_IDS = {q9, q10, q11}` | `App.tsx:21` | Redireciona essas perguntas para o bloco e oculta os `GlobalFilters`. | **Adicionar `q14`** ao conjunto na fase de implementação. |
| `/q/q9`, `/q/q10`, `/q/q11` | URLs externas/legadas | Já redirecionam (HTTP client-side) para `/grupos/partidos-votacoes`. | Manter o redirect. |
| `/q/q14`, `/pergunta/q14` | URLs legadas | **Ainda renderizam `QuestionPage`** (q14 não está em `RETIRED_QUESTION_IDS`). | **Aposentar:** incluir `q14` no redirect. |
| `QuestionPage.tsx` | Renderizador genérico de pergunta | Usado por perguntas que ainda têm página. | **Não remover** — só deixa de ser alcançável por q9/q10/q11/q14. |
| Links de navegação para q9–q14 | `Header`, `HomePage` | **Não existem** — a navegação já é por bloco. | Nenhuma ação. |

**Conclusão:** não há link de usuário apontando para páginas de pergunta q9–q14. A única
limpeza pendente é **adicionar `q14` à lista de aposentadas** (1 linha). Nada deve ser
deletado nesta etapa.

---

## 4. Fontes de dados e campos disponíveis

Todas as fontes vêm de `GET /api/questions/{id}` e retornam um `QuestionPayload`
com `table_spec` (tabela principal), `complement_tables[]` e `chart_spec`. Campos
**verificados a partir do backend em execução** (não inferidos).

### Q9 — `/api/questions/q9` · "Viés ideológico por score, faixa e campo"
`supported_filters: [anos, partidos, deputados]`

- **`table_spec` — Q9.1 (lista partido × ideologia, 25 linhas):**
  `sigla_partido`, **`ideologia_score`** (float 0–10), **`ideologia_faixa`** (texto pt-BR),
  **`campo_ideologico`** (`esquerda|centro|direita`), `fonte_ideologia`, `tipo_match_ideologia`.
- **`complement[0]` — Q9.2 (correlação ideologia × proposição):**
  `ano_dados`, `id_votacao`, `titulo_proposicao`, `ideologia_score_medio`, `ideologia_faixa`,
  `campo_ideologico`, `votos_sim`, `votos_nao`, `outros`, `total_votos`, `pct_sim`.

> Fonte do espectro. Já consumido por `toSpectrumParties()`.

### Q10 — `/api/questions/q10` · "Alinhamento interno dos partidos"
`supported_filters: [partidos]`

- **`table_spec` (ranking consolidado, 15 linhas):** `posicao`, `sigla_partido`,
  `ideologia_score`, `ideologia_faixa`, `campo_ideologico`, `qtd_deputados`,
  `total_votos_com_diretriz`, `votos_alinhados`, `votos_contrarios`, **`pct_alinhamento`**.
- **`complement[0]` — por ano:** `ano_dados`, `sigla_partido`, `ideologia_score`,
  `ideologia_faixa`, `campo_ideologico`, `total_votos`, `votos_alinhados`, `pct_alinhamento`.
- **`complement[1]` — disciplina individual:** `sigla_partido`, …, `id_deputado`,
  `nome_deputado`, `total_votos_com_diretriz`, `votos_alinhados`, `pct_disciplina_individual`.

### Q11 — `/api/questions/q11` · "Rankings partidários"
`supported_filters: [anos, partidos]`

- **`table_spec` — Q11.a (frequência nas votações):** `ano_dados`, `posicao`, `sigla_partido`,
  `ideologia_score`, `ideologia_faixa`, `campo_ideologico`, **`votacoes_participadas`**,
  `total_votos_registrados`.
- **`complement[0]` — Q11.b (proposições):** + **`total_proposicoes`**.
- **`complement[1]` — Q11.c (gastos):** + `qtd_deputados`, `qtd_despesas`, **`gasto_total`**,
  `gasto_medio_por_deputado`.

### Q14 — `/api/questions/q14` · "Posição ideológica revelada por votos"
`supported_filters: [partidos, deputados]` · **fonte nova, ainda não consumida**

> ⚠️ **Atenção a naming:** Q14 expõe cada campo em **duas grafias** — pt-BR e EN (alias).
> Recomenda-se padronizar o frontend nos aliases EN, mais estáveis e usados nos
> helper arrays e nos testes de contrato (`tests/test_q14.py`).

- **`table_spec` — por deputado (634 linhas).** Campos relevantes (pt-BR → EN):
  - `deputy_id` / `id_deputado`; `deputy_name` / `name` / `nome`
  - `party` / `sigla_partido`
  - `ideologia_score_partido` → **`party_ideology_score`**
  - `ideologia_faixa_partido` → **`party_ideology_band`** (texto faixa)
  - `campo_ideologico_partido` → `party_ideology_field`
  - `ideal_point_dim1`, `ideal_point_dim2` (coordenadas do ponto ideal — eixo do scatter)
  - `score_comportamental_0_10` → `behavioral_score`
  - **`score_calibrado_0_10`** → **`behavioral_score_calibrated`**
  - `score_bancada_0_10` → `caucus_score`
  - **`desvio_partido`** → **`party_deviation`** ; `direcao_desvio_partido` → `party_deviation_direction`
  - **`desvio_bancada`** → **`caucus_deviation`** ; `direcao_desvio_bancada` → `caucus_deviation_direction`
  - `qtd_votos_validos` → `valid_votes` ; `qtd_votacoes_usadas` → `used_votings`
  - `confianca` → `confidence` ; **`confianca_faixa`** → **`confidence_band`** (e `confidence_range`)
  - `score_comportamental_z`
- **`complement[0]` — Q14 desvio médio por partido:** `party`, `num_deputados`,
  `ideologia_score_partido`, `ideologia_faixa_partido`, `score_comportamental_medio`,
  `score_calibrado_medio`, `desvio_partido_medio`, **`desvio_partido_medio_abs`**,
  `direcao_desvio_medio`.
- **`complement[1]` — Q14 coesão interna da bancada:** `party`, `num_deputados`,
  `score_bancada_0_10`, **`desvio_bancada_medio_abs`**, `desvio_bancada_max_abs`,
  `desvio_bancada_std`.
- **`chart_spec` (type `scatter`) — helper arrays pré-computados** (consumir direto, sem
  recalcular no cliente):
  - `x_name`, `y_name`, `sections` (`deputies`, `party_deviation`, `caucus_cohesion`, `methodology`)
  - **`topRightDeviation[]`** / **`topLeftDeviation[]`** — deputados fora da curva do partido
    (cada item: `deputy_id`, `deputy_name`, `party`, `party_ideology_score`,
    `behavioral_score_calibrated`, `party_deviation`, `party_deviation_direction`,
    `caucus_deviation`, `confidence`, `confidence_band`).
  - **`mostAligned[]`** — deputados mais alinhados (mesma forma).
  - **`partyCohesionRanking[]`** — ranking de coesão (`party`, `num_deputados`, `caucus_score`,
    `caucus_deviation_mean_abs`, `caucus_deviation_max_abs`, `caucus_deviation_std`).
  - **`methodology`** — `source`, `summary`, `text` (texto longo pronto para exibição).

> **Mapa de campos pedidos na tarefa → realidade do backend:**
> `ideologia_score` ✓ (Q9/Q10/Q11) · `ideologia_faixa` ✓ · `campo_ideologico` ✓ ·
> `score_calibrado_0_10` ✓ (Q14, alias `behavioral_score_calibrated`) ·
> `desvio_partido` ✓ (Q14, alias `party_deviation`) · `desvio_bancada` ✓ (alias `caucus_deviation`) ·
> `confianca_faixa` ✓ (alias `confidence_band`) · helper arrays do Q14 ✓ (no `chart_spec.options`).

---

## 5. Layout proposto para o dashboard

Estender a página existente `PartiesDashboardPage`, preservando as 4 seções atuais e
inserindo as novas seções de Q14 ao final, antes da metodologia:

1. **Header + cards de resumo** — `parties-hero` + `ExecutiveCards`.
   Acrescentar cards de Q14: *deputados analisados*, *desvio médio*, *bancada mais coesa*.
2. **Espectro ideológico** (Q9) — *já existe* (`IdeologySpectrum` + `IdeologyLegend`).
3. **Distribuição ideológica** (Q9) — *já existe* (`IdeologyBarChart`).
4. **Comportamento de voto / Alinhamento partidário** (Q10) — *já existe*
   (`PartyAlignmentRanking`).
5. **Rankings partidários** (Q11) — *já existe* (`PartyRankingTabs`).
6. **Alinhamento direto / Posição revelada** (Q14, **novo**) — scatter
   `ideal_point_dim1 × score_calibrado` colorido por faixa.
7. **Deputados fora da curva** (Q14, **novo**) — `topRightDeviation` + `topLeftDeviation`.
8. **Coesão das bancadas** (Q14, **novo**) — `partyCohesionRanking`.
9. **Metodologia** (Q14, **novo**) — card com `chart_spec.options.methodology.text`.

---

## 6. Componentes reutilizáveis propostos

A tarefa sugeriu nomes genéricos; abaixo o mapeamento para a **convenção já existente**
no projeto. Vários já existem e devem ser reaproveitados, não recriados.

| Sugerido na tarefa | Já existe? | Nome a usar no projeto |
|--------------------|-----------|------------------------|
| `IdeologyBadge` | ✅ | `components/IdeologyBadge.tsx` (`{ range, compact? }`) |
| `IdeologyLegend` | ✅ | `components/IdeologyLegend.tsx` (`{ counts }`) |
| `IdeologyTooltip` | ⚠️ parcial | hoje inline no `IdeologySpectrum`; extrair se reutilizado |
| `IdeologySpectrumChart` | ✅ | `components/IdeologySpectrum.tsx` (`{ parties }`) |
| `PartyAlignmentRanking` | ✅ | `components/PartyAlignmentRanking.tsx` (`{ rows }`) |
| `PartyRankingTabs` | ✅ | `components/PartyRankingTabs.tsx` (`{ tables }`) |
| `RevealedPositionScatter` | ❌ novo | `components/RevealedPositionScatter.tsx` — reutilizar setup ECharts do `IdeologySpectrum` |
| `OutlierDeputiesRanking` | ❌ novo | `components/OutlierDeputiesRanking.tsx` — consome `topRightDeviation`/`topLeftDeviation` |
| `CaucusCohesionChart` | ❌ novo | `components/CaucusCohesionChart.tsx` — consome `partyCohesionRanking`; reusar `IdeologyBarChart` |
| `MethodologyCard` | ❌ novo | `components/MethodologyCard.tsx` — renderiza `methodology.text` |

Reaproveitar sempre: `ExecutiveCards`, `NoDataState`, `IdeologyBarChart` e os utilitários
de `utils/ideology.ts`. Buscar dados de Q14 via o `fetchQuestion('q14', …)` já existente —
**sem novo cliente de API**.

---

## 7. Estratégia de cores

A paleta ideológica **já está definida e em uso** em `utils/ideology.ts`. Recomenda-se
**mantê-la** (é sóbria, distinta e alinhada à identidade do tema escuro). Progressão:

| Faixa | Cor | Campo macro |
|-------|-----|-------------|
| Extrema esquerda | `#5363df` (índigo) | esquerda |
| Esquerda | `#468bc7` (azul) | esquerda |
| Centro-esquerda | `#3ea79f` (verde-azulado) | esquerda |
| Centro | `#8895a3` (cinza-azulado neutro) | centro |
| Centro-direita | `#ce913d` (âmbar) | direita |
| Direita | `#cf673f` (telha) | direita |
| Extrema direita | `#bd4946` (vermelho-tijolo) | direita |

Princípios já adotados: a progressão comunica **deslocamento no espectro**, não juízo de
valor; fallback cinza (`#7a8794`) para valores não classificados. Os novos componentes de
Q14 devem colorir por faixa via `rangeColor(faixa)` — garantindo consistência total.

---

## 8. Fases de implementação

- **Fase 0 — Aposentadoria de Q14 (1 linha):** adicionar `'q14'` a `RETIRED_QUESTION_IDS`
  em `App.tsx`, fazendo `/q/q14` e `/pergunta/q14` redirecionarem ao bloco. Sem outras mudanças.
- **Fase 1 — Camada de dados Q14:** estender `PartiesDashboardPage` para também buscar
  `q14` (`fetchQuestion('q14', …)`); adicionar tipos auxiliares para os helper arrays do
  `chart_spec`. Sem UI nova ainda — apenas estado carregado e logado.
- **Fase 2 — Seção "Posição revelada":** `RevealedPositionScatter`.
- **Fase 3 — Seção "Fora da curva":** `OutlierDeputiesRanking` (Top direita/esquerda).
- **Fase 4 — Seção "Coesão das bancadas":** `CaucusCohesionChart`.
- **Fase 5 — Metodologia + cards de resumo Q14:** `MethodologyCard` + novos `SummaryCard`.
- **Fase 6 — CSS e polish:** classes em `index.css` seguindo o padrão `.parties-section`.
- **Fase 7 — Testes:** estender `pages/__tests__/PartiesDashboardPage.test.tsx`, adicionar
  testes unitários dos novos componentes e e2e em `e2e/panel-navigation.spec.ts`.

---

## 9. Riscos

- **Naming dual em Q14:** misturar grafias pt/EN gera bugs silenciosos. Mitigar fixando
  os aliases EN como contrato do frontend e centralizando o mapeamento.
- **Volume de dados:** `table_spec` de Q14 tem 634 linhas; o scatter deve usar canvas
  (já é o renderer do ECharts no projeto) e paginar/limitar tabelas auxiliares.
- **Duplicação de lógica de score composto/normalização** já existe em `PartyRankingTabs`;
  evitar reescrever — extrair util se necessário.
- **Dependência de `chart_spec.options`:** se o backend mudar a forma dos helper arrays,
  a UI quebra. Mitigar com os testes de contrato existentes (`test_q14.py`) e checagens defensivas.
- **Filtros globais:** o bloco hoje usa `EMPTY_FILTERS` fixos. Decidir se Q14 respeitará
  filtros de partido/deputado ou permanecerá agregado.

---

## 10. Perguntas em aberto

1. O scatter de "posição revelada" deve usar `ideal_point_dim1 × ideal_point_dim2`
   (espaço W-NOMINATE 2D) ou `ideal_point_dim1 × score_calibrado_0_10`? (a tarefa pede
   "posição revelada"; o backend oferece ambos).
2. Q14 deve respeitar os `GlobalFilters` (partido/deputado) ou permanecer sempre agregado?
3. Os cards de resumo devem incluir métricas de Q14 ou manter os 4 atuais?
4. Confirmar o rótulo de navegação: manter "Partidos e ideologia" ou alinhar ao título
   pleno "Partidos, Ideologia e Votação"?
5. Limiar de confiança (`confidence_band`) para destacar/filtrar deputados com poucos votos
   válidos no ranking de outliers?

---

## Apêndice — Resumo verificado

- Framework: **React 19 + TS + Vite 8**, router v7, **ECharts 6**.
- Rota do bloco: **`/grupos/partidos-votacoes`** (já existe).
- Perguntas q9/q10/q11 **já aposentadas** (redirect no `App.tsx`); **q14 ainda não**.
- Página `PartiesDashboardPage` já consome Q9/Q10/Q11; **Q14 é o trabalho novo**.
- Componentes de ideologia já existentes: `IdeologyBadge`, `IdeologyLegend`,
  `IdeologySpectrum`, `IdeologyBarChart`, `PartyAlignmentRanking`, `PartyRankingTabs`,
  `ExecutiveCards`, `NoDataState` + utilitário central `utils/ideology.ts`.
- Paleta ideológica de 7 faixas já definida e em uso.
