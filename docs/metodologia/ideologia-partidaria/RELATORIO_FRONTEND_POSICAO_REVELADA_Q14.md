# Correção da visualização "Posição ideológica revelada" (Q14)

Data: 2026-06-26 · Bloco: Partidos, Ideologia e Votação · Rota: `/grupos/partidos-votacoes`

## Causa raiz das contagens erradas

O gráfico mostrava "0 à esquerda · 0 alinhados · 200 à direita" quando o
processamento de Q14 produz **245 à esquerda, 145 alinhados, 244 à direita**.

A causa **não** estava na classificação por direção, e sim na **paginação**:

- O endpoint `/api/questions/q14` retorna `table_spec.total = 634`, mas o backend
  **limita `page_size` a 200** (qualquer valor maior é ignorado e ecoado como 200).
- A página buscava apenas a **primeira página** (`fetchQuestion`, 1 requisição).
- As linhas vêm **ordenadas por desvio decrescente**, então os 200 primeiros
  registros são justamente os de maior desvio à direita — todos `mais a direita`.
- Resultado: o gráfico via só 200 deputados, todos à direita → colapso para uma
  única direção.

Confirmação empírica (paginando as 4 páginas, 200+200+200+34 = 634 únicos):

| Direção | Por valor numérico (limiar 0.5) | Pela string da API |
|---|---|---|
| Mais à esquerda | 245 | 245 (`mais a esquerda`) |
| Alinhados | 145 | 145 (`alinhado`) |
| Mais à direita | 244 | 244 (`mais a direita`) |

Os dois métodos coincidem exatamente.

## Campo usado como fonte de verdade

Conforme solicitado, a classificação passou a usar o **valor numérico do desvio**
(`party_deviation` / alias pt-BR `desvio_partido`) com o limiar **±0.5**, que é o
mesmo documentado na metodologia de Q14
(`mais a direita` / `mais a esquerda` / `alinhado`, tolerância de ±0.5 sobre a
escala calibrada). A regra ficou centralizada em `classifyDeviation()`:

```
desvio < -0.5  → mais à esquerda que o partido
|desvio| ≤ 0.5 → alinhado
desvio >  0.5  → mais à direita que o partido
```

A leitura de campos continua tolerante a EN/pt-BR; nenhum rótulo em inglês é
hardcoded como fonte de verdade.

### Correção da paginação

Novo helper `fetchAllQuestionRows(questionId, …)` em `src/api.ts`: lê a primeira
página, descobre `total` e `page_size` reais e busca as páginas restantes em
paralelo, devolvendo um payload com `table_spec.rows` completo. A página passou a
usar esse helper para Q14, trazendo os 634 deputados. **Sem alteração de backend**
(os dados já estavam disponíveis via paginação).

## Interação de clique implementada

- O histograma de desvio agora é **clicável**: clicar numa barra (ou num cartão de
  resumo) seleciona a categoria correspondente.
- Estado inicial mostra a mensagem: *"Clique em uma barra para ver os deputados deste grupo."*
- Após o clique, abaixo do gráfico aparece um título contextual
  ("Deputados mais à direita que o partido", "…à esquerda…", "…alinhados ao partido")
  e uma lista de **cartões** com: foto do deputado (reutilizando `DeputyAvatar`),
  nome, partido + faixa ideológica, score do partido (Bolognesi), score calibrado
  (W-NOMINATE), desvio do partido, direção do desvio, faixa de confiança e nº de
  votos válidos.
- A lista é ordenada por **|desvio| decrescente**, limitada a **10** itens, com
  botão **"Ver mais"** (passos de 20) e botão **"Limpar"**.
- Design mantido limpo: o gráfico não exibe os 634 deputados por padrão; a lista só
  aparece sob demanda.

## Testes adicionados

- `src/utils/q14.test.ts` — `classifyDeviation` respeita o limiar ±0.5 e não colapsa
  para uma única direção com dados mistos.
- `src/components/RevealedPositionScatter.test.tsx` — contagens left/aligned/right a
  partir do desvio numérico; placeholder antes do clique; o clique mostra a lista com
  nome, partido e desvio; ordenação por |desvio| desc.
- `src/__tests__/api.q14Paging.test.ts` — `fetchAllQuestionRows` agrega todas as
  páginas até 634 (não apenas as 200 primeiras) e preserva as três direções.

## Resultado de validação

- **Testes:** 18 arquivos, todos verdes (executados em lotes devido à lentidão do
  ambiente jsdom). Inclui os novos testes acima.
- **Build:** `vite build` conclui sem erros (655 módulos).
- **Lint:** limpo nos arquivos alterados. Permanece **1 erro pré-existente**
  (`react-hooks/set-state-in-effect` em `PartiesDashboardPage.tsx:74`, guarda de
  early-return já existente antes destas mudanças — fora do escopo).

> Observação: `npm run build` roda `tsc -b && vite build`. A versão de TypeScript do
> projeto (6.0.3, pré-release) emite um falso TS1128 em `App.tsx`, pré-existente e não
> relacionado a estas mudanças; o empacotamento real (Vite/rolldown) compila sem erros.

## Arquivos alterados

- `src/api.ts` — novo `fetchAllQuestionRows` (paginação).
- `src/pages/PartiesDashboardPage.tsx` — usa paginação para Q14.
- `src/utils/q14.ts` — `ALIGNMENT_TOLERANCE` + `classifyDeviation`.
- `src/components/RevealedPositionScatter.tsx` — classificação numérica + clique + lista.
- `src/index.css` — estilos da lista de deputados e estados interativos.
- Testes: `q14.test.ts`, `RevealedPositionScatter.test.tsx`, `api.q14Paging.test.ts`.
