# Prompt para agente: evoluir Painel de Gastos para dashboard premium

## Contexto

O projeto BDR ja passou por uma primeira refatoracao:

- `question_registry.json` ja possui `groups`, `group_id` e `tags`.
- A Home ja agrupa perguntas por tema.
- Existe uma pagina consolidada para o grupo de gastos em `dashboard/frontend/src/pages/GastosDashboardPage.tsx`.
- A rota atual do painel consolidado e `/grupos/gastos`.
- As rotas individuais `/q/q1`, `/q/q5`, `/q/q7`, `/q/q12` e `/q/q13` devem continuar funcionando.
- O painel global de filtros ja deve aparecer apenas nas paginas de questoes; o painel de gastos tem seus proprios filtros internos.

Agora a direcao e transformar o **Painel de Gastos e Fornecedores** em uma experiencia visual premium, mais executiva, menos parecida com uma colecao de tabelas.

## Objetivo principal

Refatorar apenas o painel consolidado de gastos para uma experiencia "premium/HD":

- mais visual;
- mais minimalista;
- mais analitica;
- sem tabelas no painel consolidado;
- com mais graficos, rankings visuais, cards e perfis de deputados;
- preservando as tabelas nas paginas individuais para auditoria/transparencia.

## Escopo

Trabalhar principalmente em:

- `dashboard/frontend/src/pages/GastosDashboardPage.tsx`
- `dashboard/frontend/src/index.css`
- componentes novos em `dashboard/frontend/src/components/`, se fizer sentido
- utilitarios novos em `dashboard/frontend/src/utils/`, se fizer sentido
- tipos em `dashboard/frontend/src/types.ts`, somente se necessario

Evitar mexer no backend nesta etapa, salvo se for absolutamente necessario.

## Dados disponiveis

O painel de gastos deve continuar usando os payloads existentes via `fetchQuestion()`:

- Q1: `q1` - Gastos por deputado
- Q5: `q5` - Fornecedores com maior total pago
- Q7: `q7` - Indice de custo-beneficio
- Q12: `q12` - Deputado x fornecedor
- Q13: `q13` - Categorias de gasto por deputado

Cada payload possui:

- `summary_cards`
- `chart_spec`
- `table_spec`
- `complement_tables`

Mesmo que as tabelas nao aparecam mais no painel consolidado, os dados de `table_spec.rows` podem e devem ser usados para montar visualizacoes customizadas.

## Fotos dos deputados

E possivel montar URL de foto com base em `id_deputado`.

Formato:

```ts
function getDeputyPhotoUrl(id: string | number) {
  return `https://www.camara.leg.br/internet/deputado/bandep/${id}.jpg`
}
```

Exemplo verificado:

```txt
https://www.camara.leg.br/internet/deputado/bandep/220593.jpg
```

Os dados dos deputados tambem existem em:

```txt
dados_padronizados/deputados.csv
```

Esse CSV possui `id_deputado`, `uri_deputado`, `nome`, `nome_civil`, `escolaridade`, etc.

Nesta etapa, prefira montar a URL diretamente pelo `id_deputado` no frontend. Se a imagem falhar, usar fallback visual com iniciais do deputado.

## Fase 1: Remover tabelas do painel consolidado

No arquivo `GastosDashboardPage.tsx`:

- Remover a importacao de `DataTablePanel`, se ela ficar sem uso.
- Remover estados e logica ligados a tabelas:
  - `tableStates`, se nao for mais necessario para paginacao.
  - `showTables`.
  - `handleTableChange`.
  - `toggleTable`.
- Parar de renderizar qualquer `DataTablePanel` no painel consolidado.
- Continuar chamando `fetchQuestion()` com um `TableState` fixo grande o suficiente para alimentar visualizacoes, por exemplo:

```ts
const VISUAL_TABLE_STATE = {
  page: 1,
  pageSize: 100,
  sortDir: 'desc',
} satisfies TableState
```

- Importante: nao remover tabelas das paginas individuais em `QuestionPage.tsx`.

## Fase 2: Criar componentes visuais especificos

Criar componentes pequenos e reutilizaveis, se fizer sentido:

- `DeputyAvatar`
- `MetricHero`
- `VisualRanking`
- `InsightCard`
- `DeputyFinancialProfile`
- `SupplierCardGrid`
- `CategoryTreemapPanel` ou aproveitar `ChartPanel` quando suficiente

Sugestao de responsabilidades:

### DeputyAvatar

- Recebe `id_deputado`, `nome`, `size`.
- Usa foto da Camara.
- Em caso de erro de imagem, mostra iniciais.

### VisualRanking

- Mostra ranking sem tabela.
- Pode receber linhas de `table_spec.rows`.
- Para Q1, exibir deputado, foto, partido/UF e gasto total.
- Para Q5, exibir fornecedor, total pago e percentual.
- Para Q12, exibir deputado, fornecedor e total pago.

### DeputyFinancialProfile

Painel exibido quando o usuario seleciona/busca um deputado.

Deve cruzar dados disponiveis:

- Q1: gasto total do deputado.
- Q7: custo-beneficio, beneficio, presenca/proposicoes se disponiveis.
- Q12: principais fornecedores do deputado.
- Q13: principais categorias de gasto do deputado.

Se algum dado nao estiver disponivel, exibir fallback elegante.

## Fase 3: Busca por deputado

Adicionar busca/autocomplete no painel de gastos.

Fonte inicial:

- preferir nomes vindos de `q1Data.table_spec.rows`, porque Q1 e o ranking principal de deputados com gastos.

Comportamento:

- Campo de busca no topo do painel, perto dos filtros.
- Ao selecionar ou digitar um deputado, destacar esse deputado nos rankings/graficos quando possivel.
- Renderizar `DeputyFinancialProfile`.
- Permitir limpar selecao.

Nao precisa criar um mecanismo perfeito de fuzzy search nesta etapa. Um filtro por substring ja basta.

## Fase 4: Mais graficos e visual premium

Usar os `chart_spec` existentes e os dados de `table_spec.rows` para enriquecer o painel.

Blocos esperados:

1. Hero executivo
   - titulo;
   - descricao curta;
   - KPIs principais;
   - possivel destaque de maior gasto/maior fornecedor.

2. Ranking de gastos por deputado
   - grafico principal de Q1;
   - ranking visual com avatar;
   - sem tabela.

3. Fornecedores
   - grafico de Q5;
   - cards dos maiores fornecedores;
   - participacao percentual quando disponivel.

4. Custo-beneficio
   - scatterplot Q7;
   - cards de melhores e piores relacoes custo-beneficio;
   - formula em card discreto.

5. Deputado x fornecedor
   - grafico Q12;
   - cards ou lista visual dos pares mais relevantes.

6. Categorias de gasto
   - treemap Q13;
   - chips/cards das categorias dominantes.

## Fase 5: CSS premium e responsivo

Adicionar estilos incrementais em `index.css`, sem reescrever o design system inteiro.

Direcao visual:

- layout executivo;
- cards limpos;
- contraste melhor;
- menos cara de planilha;
- graficos maiores;
- rankings com foto;
- bons estados de loading/erro;
- responsivo para desktop e mobile.

Classes sugeridas:

- `.gastos-dashboard-premium`
- `.premium-hero`
- `.premium-kpi-grid`
- `.premium-dashboard-grid`
- `.premium-panel`
- `.visual-ranking`
- `.ranking-row`
- `.deputy-avatar`
- `.deputy-profile-panel`
- `.supplier-card-grid`
- `.insight-card`
- `.deputy-search`

Evitar mexer pesado em classes globais existentes como `.chart-section`, `.summary-card`, `.question-card`, a menos que seja necessario.

## O que NAO fazer

- Nao mexer nas rotas individuais `/q/:questionId`.
- Nao remover tabelas das paginas individuais.
- Nao remover `QueryDrawer` das paginas individuais.
- Nao criar endpoint agregado no backend agora.
- Nao alterar SQLs, CSVs, arquivos de resposta ou adapters.
- Nao refatorar os outros grupos (`perfil`, `producao`, `partidos`) nesta etapa.
- Nao adicionar framework CSS ou biblioteca de UI nova.
- Nao fazer chamadas para API da Camara para cada deputado em tempo real; use URL de foto por `id_deputado`.
- Nao deixar falha de imagem quebrar layout; usar fallback com iniciais.
- Nao depender de dados perfeitos: trate campos ausentes com fallback.

## Verificacao

Rodar no frontend:

```powershell
cd dashboard/frontend
npm test
npm run build
```

Verificar manualmente:

- `/grupos/gastos` nao possui tabelas.
- `/grupos/gastos` possui visual mais rico e executivo.
- Fotos dos deputados aparecem quando ha `id_deputado`.
- Fallback de avatar funciona quando a foto falha.
- Busca por deputado funciona e pode ser limpa.
- Filtros do painel de gastos continuam funcionando.
- Rotas individuais `/q/q1`, `/q/q5`, `/q/q7`, `/q/q12`, `/q/q13` continuam com seus detalhes e tabelas.

## Resultado esperado

O Painel de Gastos deve deixar de parecer uma reuniao de perguntas/tabelas e passar a parecer um dashboard executivo premium:

- graficos grandes;
- rankings visuais;
- fotos dos deputados;
- perfil financeiro por deputado;
- cards de insights;
- zero tabelas no painel consolidado;
- tabelas preservadas apenas nas paginas individuais.
