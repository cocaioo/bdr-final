# Contexto de Etapa: Classificação Ideológica Partidária (Q9, Q10 e Q11)

## Contexto Geral

O objetivo desta etapa foi aprimorar a análise das questões Q9, Q10 e Q11 introduzindo uma classificação ideológica partidária metodologicamente robusta. A fonte principal adotada para os dados de classificação foi o estudo de **Bolognesi et al. (2026)**.

A classificação correta foi estruturada de modo a preservar as seguintes colunas metodológicas fundamentais:
* `ideologia_score`: O score contínuo que indica a posição ideológica do partido.
* `ideologia_faixa`: A classificação ideológica granular.
* `campo_ideologico`: O agrupamento ideológico macro.
* `fonte_ideologia`: A identificação da fonte de dados utilizada.
* `ano_base_ideologia`: O ano de referência do dado de ideologia.
* `tipo_match_ideologia`: Se a correspondência foi exata ou por alias/sucessão.
* `observacao_ideologia`: Detalhes e justificativas metodológicas.

---

## Problema Encontrado

Durante a primeira validação oficial, constatou-se que a tabela `partidos_ideologia` foi carregada de forma simplificada, contendo apenas a distinção binária `direita/esquerda`. Isso ocorreu porque o schema antigo de banco de dados previa apenas as colunas:
* `sigla_partido`
* `ideologia`

Diante dessa limitação, o processo de ETL acabou preenchendo a coluna `ideologia` diretamente com o valor de `campo_ideologico`. Essa abordagem simplificou indevidamente a metodologia e descartou as informações ricas de score, faixa e fonte nos artefatos gerados para Q9, Q10 e Q11. Consequentemente, essa validação binária inicial foi descontinuada e invalidada.

---

## Correção Feita

Para resolver o problema e garantir a integridade dos dados, realizamos correções estruturais e de lógica nos seguintes componentes:
* **`Banco/init.sql`**: Atualização do schema da tabela `partidos_ideologia` para criar todas as novas colunas metodológicas.
* **`src/party_catalog.py`**: Adaptação da leitura para retornar o conjunto completo de colunas metodológicas do catálogo de partidos.
* **`src/mappings.py`**: Ajuste dos mapeamentos do pipeline de ETL para carregar todas as novas colunas e inseri-las no banco.
* **`src/cleaning.py`**: Definição de aliases seguros de siglas de partidos políticos para garantir resoluções precisas.
* **Queries SQL de Q9, Q10 e Q11 (`JF/partidos-ideologia-votacao/`)**: Reescrevemos as queries para calcular e expor adequadamente `ideologia_score`, `ideologia_faixa` e `campo_ideologico`.
* **Backend (`dashboard/backend/app/adapters/questions.py` e `party_catalog.py`)**: Adaptação dos adapters e dos endpoints para ler e expor os novos dados estruturados nas respostas das APIs.
* **Testes (`tests/test_etl_contracts.py`)**: Criação de novas asserções para validar e garantir a conformidade do novo contrato de dados estruturado do ETL.

---

## Decisões Metodológicas Importantes

As seguintes diretrizes e definições metodológicas foram consolidadas:
* **`ideologia_score`**: Posicionamento em um espectro contínuo de 0 a 10.
* **`ideologia_faixa`**: Representa a classificação granular (ex: "Direita", "Centro-Direita", "Esquerda", "Centro-Esquerda").
* **`campo_ideologico`**: Agrupamento simplificado e macro (ex: "Direita", "Esquerda", "Centro").
* **`ideologia`**: Mantida como coluna legada, espelhando fielmente o valor do `campo_ideologico` para garantir retrocompatibilidade.
* **ARENA**: Excluída do universo analítico por ser uma sigla histórica que precede o escopo analítico contemporâneo do projeto.
* **S.PART. (Sem Partido)**: Não recebe classificação ideológica.
* **MISSÃO**: Classificada através de uma classificação complementar devidamente documentada.
* **PATRIOTA, PROS, PSC e PTB**: Preservam seus respectivos scores próprios conforme mapeamento metodológico.
* **Suporte à faixa `Centro`**: A estrutura de banco e backend suporta plenamente a classificação de partidos como `Centro`, embora nesta versão específica nenhum dos 25 partidos efetivamente carregados tenha caído nessa faixa.

---

## Q10 e Queda de Cobertura

Uma mudança significativa foi efetuada na forma como a Q10 calcula os votos com diretriz:
* **Problema anterior**: O JOIN antigo de relacionamento baseava-se em correspondência frouxa por substring. Isso causava uma inflação incorreta nos votos, pois associava votos orientados por blocos partidários, federações e bancadas coletivas como se fossem diretrizes de partidos individuais.
* **Nova abordagem**: O JOIN foi corrigido para considerar apenas orientações partidárias diretas (casamento exato e direto da sigla partidária com a orientação da votação).
* **Consequência**: A cobertura de votos mapeados caiu de `252.955` para `68.044` votos associados a diretrizes de partidos.
* **Justificativa**: Essa redução drástica é esperada, metodologicamente correta e necessária. Agora, a Q10 descreve estritamente o alinhamento individual do parlamentar às orientações partidárias diretas de sua própria legenda, eliminando ruídos gerados por orientações de governo, oposição, federação ou blocos.

---

## Validações Realizadas

Asseguramos a integridade do sistema através das seguintes verificações:
* Execução do ETL completo com sucesso.
* A tabela `partidos_ideologia` foi populada com exatamente 25 linhas, todas contendo score, faixa e fonte válidos.
* As tabelas e artefatos de Q9, Q10 e Q11 foram regenerados e possuem corretamente as colunas `ideologia_score`, `ideologia_faixa` e `campo_ideologico`.
* O backend respondeu com código HTTP 200 nas rotas críticas:
  * `/api/meta`
  * `/api/questions/q9`
  * `/api/questions/q10`
  * `/api/questions/q11`
* Todos os testes automatizados da suíte passaram com sucesso, incluindo os testes de contrato em `tests/test_etl_contracts.py` e testes específicos do backend.

---

## Próximos Passos

### 1. Ajustes no Frontend
A próxima etapa focará na adequação do painel visual:
* Adaptar as visualizações de Q9, Q10 e Q11 para exibir a nova estrutura.
* Utilizar `ideologia_faixa` como a classificação principal nas interfaces.
* Utilizar `campo_ideologico` como a dimensão de agrupamento macro.
* Apresentar `ideologia_score` em tabelas, tooltips informativos ou modais de detalhes.
* Revisar e padronizar as cores e legendas do espectro político.
* Explicar graficamente aos usuários que a categoria de `Centro` é suportada nativamente pela aplicação, mesmo que nenhuma legenda ativa esteja ocupando essa faixa no recorte de dados atual.

### 2. Expansões Futuras
* **Criação de Q14 / Expansão da Q9**: Estimar a posição ideológica revelada diretamente pelo comportamento de voto dos deputados.
* **Modelos Espaciais**: Avaliar o uso de algoritmos como W-NOMINATE ou modelos de ideal points baseados em votações nominais para traçar o mapa de dispersão de scores comportamentais dos deputados.
* **Análise Comparativa**: Comparar o score comportamental revelado do parlamentar com o score oficial de seu partido e a média de sua respectiva bancada.
