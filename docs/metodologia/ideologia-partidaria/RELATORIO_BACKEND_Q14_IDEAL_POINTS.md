# Relatório Técnico de Integração — Backend Q14 Ideal Points

Este relatório descreve a integração da camada de dados do W-NOMINATE (**Q14 — Posição Ideológica Revelada por Votos**) no backend do projeto BDR, como parte do bloco consolidado **"Partidos, Ideologia e Votação"** (`partidos-ideologia-votacao`).

---

## 1. Arquivos Consumidos

Os seguintes artefatos estáticos, gerados pelo pipeline W-NOMINATE e salvos em `JF/partidos-ideologia-votacao/q14/`, são consumidos diretamente pelo backend a cada requisição:

1. **`q14_ideal_points_deputados.csv`**: Contém as coordenadas estimadas do W-NOMINATE para 634 deputados, convertidas para a escala comportamental de 0–10 e calibradas por regressão linear (OLS) em relação ao índice partidário (Bolognesi).
2. **`q14_desvio_partido.csv`**: Agregações de desvios médios absolutos e direções em nível partidário.
3. **`q14_desvio_bancada.csv`**: Métricas de dispersão (desvio-padrão, desvio máximo e médio absoluto) para medir a coesão interna das bancadas.
4. **`q14_metodologia.md`**: Documento de metodologia técnica que é exposto na resposta da API para consumo do frontend.

---

## 2. Alterações no Registro de Perguntas

A pergunta Q14 foi integrada no arquivo `dashboard/backend/app/question_registry.json` com os seguintes parâmetros chave:

* **ID**: `q14`
* **Título**: `Posição ideológica revelada por votos`
* **Grupo**: `partidos` (Partidos e Ideologia)
* **Bloco Analítico**: `partidos-ideologia-votacao`
* **Fonte de dados do bloco (`is_block_data_source`)**: `true` (Indica que os dados são expostos como uma camada de dados consolidada para o bloco, não gerando uma rota/página individual de pergunta no frontend)
* **Standalone no Frontend (`frontend_standalone_page`)**: `false` (Garante que o gerador de rotas do frontend ignore Q14 como rota independente)
* **Filtros suportados**: `partidos`, `deputados`
* **Caminho SQL**: `JF/partidos-ideologia-votacao/q14/q14.sql` (Aponta para um arquivo descritivo contendo a explicação de que o carregamento é estático e precomputado).

---

## 3. Implementação do Adaptador Backend (`Q14Adapter`)

O adaptador `Q14Adapter` foi estendido em `dashboard/backend/app/adapters/questions.py` para processar e normalizar os dados, gerando a seguinte resposta estruturada:

### A. Tabela Principal (`deputies`)
A tabela principal lê `q14_ideal_points_deputados.csv` e injeta aliases amigáveis para o frontend (`deputy_id`, `deputy_name`, `party_ideology_range`, `confidence_range`, etc.), além dos nomes esperados pelo motor de filtros do backend (`id_deputado`, `nome`, `sigla_partido`).

### B. Tabelas Complementares
* **`party_deviation`**: Lê `q14_desvio_partido.csv` e expõe métricas médias de desvio por partido, com colunas normalizadas (`num_deputies`, `party_ideology_range`, `party_deviation_mean_abs`, etc.).
* **`caucus_cohesion`**: Lê `q14_desvio_bancada.csv` e expõe a dispersão de votos de cada partido (`num_deputies`, `caucus_deviation_std`, `caucus_deviation_max_abs`).

### C. Estrutura do Gráfico (`chart_spec`)
* **Gráfico Scatter**: Mapeia o score Bolognesi do partido (eixo X) contra o score comportamental calibrado do deputado (eixo Y).
* **Precomputed Helper Arrays**: Injeta em `chart_spec.options` arrays auxiliares ordenados:
  * `topRightDeviation`: Deputados que mais se desviaram à direita do partido.
  * `topLeftDeviation`: Deputados que mais se desviaram à esquerda do partido.
  * `mostAligned`: Deputados mais alinhados à ideologia oficial do partido.
  * `partyCohesionRanking`: Lista de partidos ordenada por dispersão (desvio-padrão).
* **Metodologia**: Injeta o resumo e o texto integral de `q14_metodologia.md` diretamente em `chart_spec.options.methodology.text`.

---

## 4. Estrutura da API (`/api/questions/q14`)

A resposta JSON segue o contrato do modelo `QuestionPayload`:

```json
{
  "question_id": "q14",
  "title": "Posição ideológica revelada por votos",
  "filters_supported": ["partidos", "deputados"],
  "summary_cards": [
    { "id": "total_deputados", "label": "Deputados analisados", "value": "634", "unit": "deputados" },
    { "id": "desvio_medio_abs", "label": "Desvio médio absoluto do partido", "value": "1.37", "unit": "pontos" },
    { "id": "confianca_alta", "label": "Deputados com confiança alta", "value": "598", "unit": "deputados" }
  ],
  "chart_spec": {
    "type": "scatter",
    "title": "Posição ideológica do partido × comportamento calibrado",
    "series": [
      {
        "name": "Deputados",
        "data": [
          { "name": "Paulo Teixeira", "deputy_id": 141488, "party": "PT", "value": [2.679, 3.863] }
        ]
      }
    ],
    "options": {
      "topRightDeviation": [...],
      "topLeftDeviation": [...],
      "mostAligned": [...],
      "partyCohesionRanking": [...],
      "methodology": {
        "summary": "...",
        "text": "# Q14 — Posição Ideológica Revelada (W-NOMINATE)..."
      }
    }
  },
  "table_spec": {
    "title": "Q14 - Posição ideológica revelada por deputado",
    "columns": [...],
    "rows": [
      {
        "deputy_id": 141488,
        "deputy_name": "Paulo Teixeira",
        "party": "PT",
        "party_ideology_score": 2.679,
        "party_ideology_band": "Esquerda",
        "party_ideology_range": "Esquerda",
        "behavioral_score": 0.018,
        "behavioral_score_calibrated": 3.863,
        "party_deviation": 1.184,
        "party_deviation_direction": "mais a direita",
        "confidence": 1.0,
        "confidence_band": "alta",
        "confidence_range": "alta"
      }
    ],
    "total": 634
  },
  "complement_tables": [
    {
      "title": "Q14 - Desvio médio por partido",
      "rows": [
        {
          "party": "PT",
          "num_deputies": 76,
          "party_deviation_mean_abs": 1.596,
          "deviation_direction_mean": "mais a direita"
        }
      ]
    },
    {
      "title": "Q14 - Coesão interna da bancada",
      "rows": [
        {
          "party": "PRD",
          "num_deputies": 6,
          "caucus_deviation_std": 1.803
        }
      ]
    }
  ]
}
```

---

## 5. Testes Backend Executados

Um conjunto completo de testes automatizados foi adicionado em `dashboard/backend/tests/test_q14.py`. Os testes validam:

1. **Testes de Contrato da API**: Verificam se o endpoint retorna `HTTP 200` com os campos normativos, se as tabelas complementares e display columns estão presentes e ordenadas.
2. **Normalização de Campos**: Garantem a presença e equivalência dos campos como `party_ideology_range` e `confidence_range`.
3. **Verificação de Performance e Segurança (Sem Subprocessos)**: Mocks interceptam tentativas de execução do sistema para assegurar que chamadas a comandos como `R`, `Rscript`, `subprocess.Popen` ou `os.system` **nunca** ocorram em tempo de requisição. Apenas os arquivos precomputados do W-NOMINATE são lidos.
4. **Verificação do Registro**: Confirma se Q14 é configurado com `is_block_data_source=true` e `frontend_standalone_page=false` para evitar exposição de rotas individuais no frontend.

Todos os 32 testes do backend passaram com sucesso.

---

## 6. Orientações para Integração no Frontend

O frontend não deve exibir uma página independente para a pergunta Q14 (pois `frontend_standalone_page` está marcado como `false`). Em vez disso, o bloco analítico consolidado `partidos-ideologia-votacao` deve consumir a API da seguinte forma:

1. **Dispersão e Desvio Individual**: Utilizar a tabela principal (`table_spec.rows`) ou a série de dados do gráfico de dispersão (`chart_spec.series`) para plotar o scatter-plot interativo (Eixo X: Ideologia Oficial/Bolognesi, Eixo Y: Posição Comportamental Revelada).
2. **Deputados fora da Curva / Alinhados**: Usar as listas ordenadas injetadas em `chart_spec.options`:
   * `topRightDeviation` (maior desvio à direita)
   * `topLeftDeviation` (maior desvio à esquerda)
   * `mostAligned` (mais disciplinados ideologicamente)
3. **Mapeamento de Coesão de Bancada**: Exibir o gráfico de barras verticais utilizando `chart_spec.options.partyCohesionRanking`, ordenado decrescentemente pelo desvio-padrão (`caucus_deviation_std`), destacando os partidos com menor coesão interna.
4. **Visualização de Metodologia**: Renderizar o texto markdown contido em `chart_spec.options.methodology.text` de forma colapsável ou modal.
