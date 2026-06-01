# Dashboard Q1-Q13

Implementacao modular em duas camadas:

- `backend` (`FastAPI`): resolve respostas por caminho relativo por membro/pergunta, com fallback para `respostas/`, aplica parser, filtros server-side, paginacao, cache e entrega payload padrao.
- `frontend` (`React + Vite + TypeScript`): renderiza home + rotas `q1..q13`, graficos `ECharts`, tabelas e drawer de query.

## Como executar

Na raiz do projeto:

```bash
make dashboard-install
make dashboard-api
make dashboard-web
```

Ou iniciar ambos os processos em background:

```bash
make dashboard-dev
```

## Contrato da API

- `GET /api/meta`
- `GET /api/questions/{id}?anos=&partidos=&ufs=&deputados=&search=&sort_by=&sort_dir=&page=&page_size=`

O frontend consome apenas `available_filters` e `questions` de `/api/meta` e
`/api/questions/{id}`. A busca por ID de deputado nao e exposta na UI atual;
os filtros visiveis sao os que fazem sentido para uso final no painel.

## Arquivos chave para manutencao

- `backend/app/question_registry.json`: metadados declarativos de Q1..Q13.
- `backend/app/adapters/questions.py`: classes de adapter por pergunta.
- `backend/app/adapters/base.py`: logica comum de transformacao.
- `backend/app/parser.py`: parser generico de saida psql.
- `frontend/src/types.ts`: contrato tipado frontend/backend.
- `frontend/src/pages/QuestionPage.tsx`: fluxo principal das telas de pergunta.

## Como ajustar respostas revisadas no futuro

1. Atualize os arquivos no caminho relativo do membro/pergunta.
2. Registre o caminho novo no `backend/app/question_registry.json`.
3. Se o arquivo ainda nao tiver migrado, mantenha o nome legado e deixe o
	fallback de `respostas/` cobrir a transicao.
4. Se mudarem colunas, ajuste `expected_columns` no `question_registry.json`.
5. Se mudarem regras visuais, ajuste `chart` no `question_registry.json` ou o adapter da pergunta.
4. Rode testes:

```bash
cd dashboard/backend && ..\\..\\venv\\Scripts\\python -m pytest
cd dashboard/frontend && npm.cmd run test && npm.cmd run build
```

