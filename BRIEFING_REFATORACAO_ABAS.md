# Briefing para refatoracao de abas no dashboard BDR

## Contexto da conversa

O objetivo e melhorar a UX/UI do dashboard agrupando perguntas semelhantes em abas ou secoes tematicas. Hoje o painel exibe as perguntas Q1-Q13 principalmente como itens individuais, tanto na navegacao superior quanto na Home.

Foi discutido que a melhor abordagem e criar agrupamentos por metadados, evitando hardcode espalhado no frontend.

Stack atual do frontend:

- React 19
- TypeScript
- Vite 8
- React Router DOM 7
- ECharts 6
- TanStack React Table 8
- CSS global em `dashboard/frontend/src/index.css`
- Testes com Vitest, Testing Library e Playwright

Arquivos importantes:

- Registro das perguntas: `dashboard/backend/app/question_registry.json`
- Loader do registro: `dashboard/backend/app/registry.py`
- Modelos da API: `dashboard/backend/app/models.py`
- Montagem do `/api/meta`: `dashboard/backend/app/service.py`
- App shell e rotas: `dashboard/frontend/src/App.tsx`
- Navegacao superior: `dashboard/frontend/src/components/Header.tsx`
- Home atual: `dashboard/frontend/src/pages/HomePage.tsx`
- Tipos do frontend: `dashboard/frontend/src/types.ts`
- Pagina individual da pergunta: `dashboard/frontend/src/pages/QuestionPage.tsx`

## Agrupamento sugerido

Usar 4 grupos principais:

1. Gastos e Fornecedores
   - Q1: Gastos por deputado
   - Q5: Fornecedores com maior total pago
   - Q7: Indice de custo-beneficio
   - Q12: Deputado x fornecedor
   - Q13: Categorias de gasto por deputado

2. Escolaridade e Perfil
   - Q4: Escolaridade da 57a legislatura
   - Q6: Correlacoes por escolaridade

3. Producao Legislativa e Temas
   - Q2: Eixos e nuvem de palavras
   - Q3: Votos por eixo principal da votacao
   - Q8: Influencia legislativa

4. Partidos e Ideologia
   - Q9: Vies ideologico e partidario
   - Q10: Alinhamento interno dos partidos
   - Q11: Rankings partidarios

Observacao: Q4 e Q6 conversam com gastos/escolaridade. A sugestao e manter cada pergunta em um grupo principal e usar `tags` para relacoes secundarias, em vez de duplicar perguntas em varias abas.

## O que fazer

1. Comecar pelo backend/metadados.
   - Adicionar uma chave `groups` no `question_registry.json`.
   - Adicionar `group_id` e possivelmente `tags` em cada pergunta.
   - Exemplo de formato:

```json
{
  "groups": [
    {
      "id": "gastos",
      "label": "Gastos e Fornecedores",
      "description": "Despesas parlamentares, fornecedores, categorias e custo-beneficio."
    }
  ],
  "questions": [
    {
      "id": "q1",
      "title": "Gastos por deputado",
      "group_id": "gastos",
      "tags": ["gastos", "deputados"]
    }
  ]
}
```

2. Atualizar os modelos e loader.
   - `registry.py`: carregar `groups`, `group_id` e `tags`.
   - `models.py`: expor esses campos no contrato da API.
   - `service.py`: incluir os grupos e os novos campos no retorno de `/api/meta`.

3. Atualizar os tipos do frontend.
   - `types.ts`: criar algo como `QuestionGroup`.
   - Estender `QuestionMeta` com `group_id?: string` e `tags?: string[]`.
   - Estender `MetaResponse` com `groups?: QuestionGroup[]`.

4. Refatorar primeiro a Home.
   - Em `HomePage.tsx`, trocar o grid unico de perguntas por uma visualizacao agrupada.
   - Pode ser por abas ou por secoes.
   - Manter os links apontando para as rotas atuais `/q/q1`, `/q/q2`, etc.

5. Depois ajustar o Header.
   - O `Header.tsx` hoje mostra `Home`, `Q1`, `Q2`, etc.
   - Ele pode passar a mostrar grupos/abas e, dentro de cada grupo, as perguntas.
   - Se a solucao do Header ficar grande demais, criar componentes pequenos, por exemplo:
     - `QuestionGroupTabs`
     - `GroupedQuestionGrid`

6. Rodar verificacoes.
   - Frontend:

```bash
cd dashboard/frontend
npm test
npm run build
```

   - Backend, se o contrato da API for alterado:

```bash
cd dashboard/backend
pytest
```

## O que NAO fazer

- Nao quebrar as rotas atuais `/q/:questionId`.
- Nao mover a logica dos adapters das perguntas sem necessidade.
- Nao duplicar perguntas em varios grupos principais. Usar `tags` para relacoes secundarias.
- Nao hardcodar os grupos apenas no frontend se puder vir do `question_registry.json`.
- Nao reescrever o design system inteiro.
- Nao adicionar biblioteca de UI nova sem necessidade. A stack atual ja basta.
- Nao alterar dados, CSVs, SQLs ou respostas das perguntas para essa etapa.
- Nao remover testes existentes.
- Nao fazer refatoracao ampla em `QuestionPage.tsx` antes de validar a Home agrupada.
- Nao mexer em arquivos fora do escopo da navegacao/metadados/contrato, salvo ajuste necessario de teste.

## Direcao recomendada

Implementar em duas fases:

Fase 1:

- Metadados de grupos no backend.
- Tipos atualizados no frontend.
- Home agrupada.
- Testes/build passando.

Fase 2:

- Header com navegacao por grupos.
- Badges/tags de relacao secundaria.
- Possivel secao "perguntas relacionadas" na pagina individual.

Essa ordem reduz risco porque a Home pode validar a nova UX sem afetar a carga individual de cada pergunta.
