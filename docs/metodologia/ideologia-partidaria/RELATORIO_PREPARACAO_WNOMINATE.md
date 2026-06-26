# Relatório de Preparação de Dados para Estimação de Ideal Points (W-NOMINATE)
**Módulo Q14 - Revealed Voting Position**

Este documento estabelece as bases técnicas, metodológicas e estruturais para a futura implementação da estimação de posições ideológicas comportamentais (revealed voting positions) dos deputados com base no histórico de votação nominal utilizando o algoritmo W-NOMINATE.

---

## 1. Arquivos de Dados Inspecionados

Os seguintes arquivos de dados padronizados e catálogos foram analisados:

*   **`dados_padronizados/votacoes_votos.csv`**: Contém o registro individual de cada voto proferido por cada deputado. (462.742 registros)
*   **`dados_padronizados/votacoes.csv`**: Contém metadados de cada votação nominal realizada (data, descrição, aprovação). (34.142 registros, com 1.566 correspondendo diretamente a votações nominais detalhadas)
*   **`dados_padronizados/deputados.csv`**: Contém dados biográficos e cadastrais dos deputados (id, nome civil, escolaridade). (640 registros)
*   **`dados_padronizados/partidos_ideologia.csv`**: Contém a classificação ideológica oficial dos partidos com base em Bolognesi et al. (2026) e classificações complementares. (25 registros)
*   **`catalogos/partidos.csv`**: Catálogo de referência de partidos com status, scores históricos e indicação de entrada no universo analítico. (28 registros)

---

## 2. Colunas Encontradas na Votação

No arquivo `dados_padronizados/votacoes_votos.csv`, as seguintes colunas estruturais foram identificadas:

*   `ano_dados`: Ano de referência dos dados (ex: `2023`).
*   `id_votacao`: Identificador único da votação (ex: `1197773-90`).
*   `id_deputado`: Identificador numérico do deputado (ex: `220714`).
*   `voto`: O voto registrado do deputado (ex: `Sim`, `Nao`, `Obstrucao`, `Abstencao`, `Artigo 17`).
*   `nome_deputado`: Nome parlamentar do deputado.
*   `sigla_partido`: Sigla partidária associada ao deputado no momento do voto.
*   `sigla_uf`: Estado de representação do deputado.

---

## 3. Distribuição de Valores de Voto e Proposta de Mapeamento

A análise dos 462.742 registros de voto em `votacoes_votos.csv` revelou a seguinte distribuição:

| Valor Encontrado | Frequência | Percentual | Proposta de Mapeamento | Descrição / Justificativa |
| :--- | :---: | :---: | :---: | :--- |
| **`Sim`** | 271.271 | 58,62% | `1` | Voto favorável ao objeto em deliberação. |
| **`Nao`** | 184.065 | 39,78% | `0` | Voto contrário ao objeto em deliberação. |
| **`Obstrucao`** | 5.272 | 1,14% | `NA` / Missing | Tática de obstrução regimental. Embora tenha peso político, não indica voto direto Sim/Não na proposição. |
| **`Abstencao`** | 1.110 | 0,24% | `NA` / Missing | Abstenção formal de voto pelo parlamentar. |
| **`Artigo 17`** | 1.024 | 0,22% | `NA` / Missing | Impedimento regimental (ex: Presidente da Câmara ou deputados impedidos). |

### Resumo do Mapeamento:
*   **Votos Válidos**: `Sim` (1) e `Nao` (0) somam **455.336 registros (98,40%)**.
*   **Votos Ausentes/Ignorados**: `Obstrucao`, `Abstencao` e `Artigo 17` somam **7.406 registros (1,60%)** e serão tratados como valores ausentes (`NA`) no W-NOMINATE.

---

## 4. Análise de Adequação das Votações (Roll-Calls)

Para a estimação de ideal points, votações consensuais ou quase unânimes fornecem pouca ou nenhuma informação para separar a posição dos parlamentares e geram ruído matemático no algoritmo. 

Foi realizada uma análise de adequação nas **1.566 votações únicas**:

*   **Votações quase unânimes (Unanimidade >= 95% do lado vencedor)**: **229 votações (14,62%)**.
*   **Votações com quórum muito baixo (< 20 votos válidos)**: **100 votações (6,39%)** (incluindo 2 votações com < 10 votos válidos).
*   **Votações com quórum baixo (< 50 votos válidos)**: **395 votações (25,22%)**.

### Filtros Recomendados para Votações:
1.  **Mínimo de Votos Válidos**: Excluir votações com menos de **20 votos válidos** (Sim/Não).
2.  **Margem de Unanimidade**: Excluir votações onde o lado majoritário obteve **>= 95% dos votos válidos**.

*   **Impacto esperado**: A aplicação desses filtros retém **1.260 votações (80,46% do total)**, preservando uma base de alta qualidade informativa para o modelo estatístico.

---

## 5. Análise de Adequação dos Deputados

A análise da participação individual dos **636 deputados únicos** na base de votações revelou:

*   **Deputados com menos de 10 votos válidos**: **0 deputados**.
*   **Deputados com menos de 20 votos válidos**: **1 deputado**.
*   **Deputados com menos de 50 votos válidos**: **20 deputados**.
*   **Deputados com menos de 100 votos válidos**: **62 deputados**.

### Filtros Recomendados para Deputados:
*   **Mínimo de Participação**: Excluir deputados com menos de **20 votos válidos** (ou robustamente menos de **50 votos**).
*   *Recomendação*: Utilizar o limite de **20 votos válidos** como corte operacional básico (apenas 1 parlamentar excluído) e avaliar o corte de **50 votos válidos** para testes de sensibilidade (20 deputados excluídos).

### Tratamento de Troca de Partido (Switching):
*   Constatou-se que **170 deputados (26,73%)** registraram votos sob mais de uma sigla partidária.
*   **Proposta**: Como o W-NOMINATE estima um único ponto ideal por deputado por período (comportamento agregado), recomenda-se associar o deputado à sua **última filiação partidária ativa registrada na base** para fins de cálculo de desvio oficial e visualização final.

---

## 6. Disponibilidade de Ideologia Partidária

Confirmou-se que a tabela `dados_padronizados/partidos_ideologia.csv` possui os seguintes campos necessários para o cálculo de desvio da Q14:
*   `sigla_partido`: Chave para JOIN com a votação.
*   `ideologia_score`: Nota de 0 a 10 representando o posicionamento oficial da legenda (Bolognesi et al. 2026).
*   `ideologia_faixa`: Classificação granular do partido.
*   `campo_ideologico`: Campo macro de ideologia (direita/esquerda/centro).

### Tratamento de Casos Especiais:
*   **Sem Partido (`S.PART.`)**: Identificado em **77 registros de voto** (afetando 3 deputados: Yury do Paredão, Marcelo Lima e Chiquinho Brazão). Não receberá score de ideologia oficial partidária (definido como `NA`), mas seu ponto ideal será estimado normalmente.
*   **MISSÃO**: Receberá o score complementar de 7,750 para cálculo de desvio.
*   **Incorporados (PTB, PSC, PROS, PATRIOTA)**: Mapeados conforme score histórico oficial de Bolognesi 2022.

---

## 7. Proposta de Estrutura de Diretórios e Scripts

Propõe-se a seguinte estrutura sob a pasta `scripts/ideal_points/` (cujos rascunhos técnicos já foram criados como fundação):

*   **`scripts/ideal_points/prepare_votes_matrix.py`**: Lê a base de dados, filtra deputados e votações pelos parâmetros estabelecidos, faz o mapeamento Sim/Não (1/0) e gera a matriz pivô wide `data/votes_matrix.csv`.
*   **`scripts/ideal_points/run_wnominate.R`**: Lê a matriz em R, cria o objeto `rollcall` (pacote `pscl`), define o deputado âncora do PL/NOVO para calibrar a polaridade da Dimensão 1 e roda o `wnominate`. Salva os pontos ideais brutos em `data/raw_ideal_points.csv`.
*   **`scripts/ideal_points/process_ideal_points.py`**: Lê as estimativas brutas em Python, calibra a polaridade do espectro para alinhar a direita com valores maiores, rescala para 0 a 10, calcula os desvios partidário e de bancada, e exporta os resultados consolidados para a pasta de entrega.
*   **`scripts/ideal_points/README.md`**: Instruções e documentação dos scripts e dependências de ambiente.

---

## 8. Proposta de Estrutura de Arquivos de Entrega (Output)

Os arquivos finais da Q14 serão gerados em: `JF/partidos-ideologia-votacao/q14/`

### 8.1. `q14_ideal_points_deputados.csv`
Contém a tabela principal com os pontos ideais estimados e rescalados de cada deputado, comparados aos valores partidários.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id_deputado` | Integer | ID único do deputado na Câmara. |
| `nome_deputado` | String | Nome parlamentar. |
| `sigla_partido` | String | Última sigla partidária registrada na base. |
| `ideologia_score_partido` | Decimal | Score contínuo oficial do partido (Bolognesi). |
| `ideologia_faixa_partido` | String | Classificação granular do partido. |
| `campo_ideologico_partido` | String | Campo político macro do partido. |
| `ideal_point_dim1` | Decimal | Coordenada na Dimensão 1 do W-NOMINATE (original). |
| `ideal_point_dim2` | Decimal | Coordenada na Dimensão 2 do W-NOMINATE. |
| `score_voto_0_10` | Decimal | Posição comportamental revelada (rescalada para 0 a 10). |
| `score_bancada_0_10` | Decimal | Média dos scores comportamentais dos deputados da bancada. |
| `desvio_partido` | Decimal | Desvio comportamental (`score_voto_0_10 - ideologia_score_partido`). |
| `desvio_bancada` | Decimal | Desvio em relação à sua bancada (`score_voto_0_10 - score_bancada_0_10`). |
| `direcao_desvio_partido` | String | `'mais a direita'` (positivo) ou `'mais a esquerda'` (negativo). |
| `direcao_desvio_bancada` | String | `'mais a direita'` (positivo) ou `'mais a esquerda'` (negativo). |
| `qtd_votos_validos` | Integer | Quantidade de votos Sim/Não válidos computados para o deputado. |
| `qtd_votacoes_usadas` | Integer | Quantidade de votações incluídas no modelo final. |
| `confiabilidade` | Decimal | Percentual de acerto de classificação individual do modelo (0-1). |

### 8.2. `q14_desvio_partido.csv`
Resumo por partido dos desvios médios da ideologia oficial.
*   `sigla_partido` | `num_deputados` | `ideologia_score_partido` | `score_votos_medio` | `desvio_medio_absoluto` | `desvio_medio_direcional`

### 8.3. `q14_desvio_bancada.csv`
Resumo da coesão comportamental interna das bancadas.
*   `sigla_partido` | `num_deputados` | `desvio_bancada_medio_absoluto` | `desvio_bancada_max_absoluto`

### 8.4. `q14_votacoes_utilizadas.csv`
Lista de todas as votações processadas com os respectivos indicadores de retenção/descarte do modelo.
*   `id_votacao` | `yes_votes` | `no_votes` | `valid_votes` | `yes_pct` | `no_pct` | `nearly_unanimous` | `retained`

### 8.5. `q14_metodologia.md`
Texto metodológico explicativo para apresentação no portal do projeto.

---

## 9. Riscos e Questões em Aberto

1.  **Indisponibilidade do Ambiente R local**: O pipeline exige que a máquina de execução do ETL possua uma instalação funcional de R e do pacote `wnominate`. Caso não seja possível instalar pacotes R por barreiras de rede/permissão, o ETL deve prever um mecanismo de fallback (como logs explicativos ou desativação elegante do módulo).
2.  **Troca de Partido Extremamente Frequente**: Parlamentares que migram de blocos ou que entram/saem de licença temporária podem enviesar o cálculo da média de bancada. Associar o deputado à última filiação partidária registrada na base mitiga esse risco, mas casos específicos devem ser inspecionados.
3.  **Votos de Obstrução**: A proposta atual classifica `Obstrucao` como valor ausente. No entanto, em votações altamente polarizadas, a instrução de obstrução é um sinal político fortíssimo. Futuras rodadas de calibração podem testar tratar `Obstrucao` como voto `Não` ou `Sim` a depender do posicionamento de liderança de oposição/governo, embora o padrão internacional para W-NOMINATE seja omitir.

---

## 10. Próximos Passos de Implementação

1.  **Validação dos Drafts**: Execução de teste local dos rascunhos de scripts criados em `scripts/ideal_points/` em ambiente com R instalado para calibrar os parâmetros `MIN_VOTES_PER_ROLLCALL` e `MIN_VOTES_PER_DEPUTY`.
2.  **Integração do Módulo no ETL Oficial**: Registrar o processamento do pipeline Python/R no fluxo contínuo do projeto (ex: Makefile ou `src/mappings.py`).
3.  **Visualização Gráfica (Frontend/Backend)**: Adaptar a API de backend para expor os resultados e implementar o gráfico de dispersão espacial bidimensional (Dim1 x Dim2) ou unidimensional comparativo no painel Q14.
