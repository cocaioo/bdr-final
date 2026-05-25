BDR Dashboard - Frontend

Visao geral
- React + TypeScript + Vite em `dashboard/frontend`.
- ECharts para graficos.
- Consome a API em `http://localhost:8000` por padrao.

Arquivos-chave
- `src/main.tsx`: bootstrap do React.
- `src/App.tsx`: layout, rotas e estado global de filtros.
- `src/api.ts`: chamadas `GET /api/meta` e `GET /api/questions/{id}`.
- `src/components/ChartPanel.tsx`: instancia ECharts.
- `src/utils/chartOptions.ts`: mapeia `chart_spec` para opcoes do ECharts.

Dados recebidos
- `MetaResponse`: filtros globais, perguntas e legenda.
- `QuestionPayload`: `chart_spec`, `table_spec`, `complement_tables` e `query_panel`.

Configuracao por env
- `VITE_API_URL`: URL da API (ex.: `http://localhost:8000`).

Como rodar (somente front)

```bash
cd dashboard/frontend
npm.cmd install
npm.cmd run dev -- --host 0.0.0.0 --port 5173
```
