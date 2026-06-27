# Metodologia de Classificação Ideológica e Cálculo dos Scores Comportamentais (Q14)

Este documento detalha os fundamentos metodológicos e matemáticos para a classificação ideológica partidária e a estimação da **posição ideológica revelada** (scores comportamentais dos deputados) no âmbito do projeto BDR.

---

## 1. A Metodologia de Referência: Bolognesi et al. (2026/2022)

Para a classificação ideológica dos partidos políticos, adotou-se como principal benchmark o estudo de **Bolognesi et al. (2026)**, também referenciado pelo ano de coleta em 2022.

*   **Abordagem por Especialistas (*Expert Survey*):** Em vez de analisar estatutos ou discursos partidários, o estudo aplicou questionários estruturados a peritos (cientistas políticos e pesquisadores da área de política brasileira).
*   **Posicionamento no Espectro:** Os peritos foram solicitados a posicionar cada partido em uma escala contínua de **0 a 10**, onde:
    *   **0** representa a **extrema esquerda**.
    *   **5** representa o **centro político**.
    *   **10** representa a **extrema direita**.
*   **Métricas Geradas:** As avaliações dos peritos foram consolidadas para extrair:
    1.  `ideologia_score`: O score médio numérico atribuído ao partido.
    2.  `ideologia_faixa`: A classificação qualitativa em faixas de ideologia granular (ex: "Centro-esquerda", "Direita").
    3.  `campo_ideologico`: O agrupamento macro simplificado (Esquerda, Centro ou Direita).

---

## 2. Implementação e Classificação no BDR

Os dados do estudo foram integrados na base de dados (tabela `partidos_ideologia` no arquivo [init.sql](file:///c:/Users/Caio/Desktop/projetos-em-andamento/BDR/Banco/init.sql)). Para classificar os partidos da nossa base, o pipeline de ETL ([mappings.py](file:///c:/Users/Caio/Desktop/projetos-em-andamento/BDR/src/mappings.py)) segue as diretrizes:

*   **Match Direto:** Siglas com correspondência exata na época do estudo (como PT, PL, PSD e MDB) herdaram seus respectivos scores originais.
*   **Equivalências e Sucessões Históricas:**
    *   **Cidadania:** Utiliza o histórico do antigo PPS para a equivalência.
    *   **União Brasil:** Recebeu score baseado na fusão de DEM e PSL, mantendo a consistência metodológica.
    *   **PRD:** Classificado via proxy da fusão entre Patriota e PTB.
    *   **Legendas Incorporadas:** Partidos como PTB, PSC, PROS e Patriota preservam seus respectivos scores históricos.
*   **Exclusões e Exceções:** 
    *   Siglas históricas fora do recorte temporal analítico contemporâneo (como a ARENA) foram excluídas.
    *   Parlamentares rotulados como sem partido (`S.PART.`) não recebem score oficial partidário.
    *   O partido **MISSÃO** recebeu classificação complementar oficializada em 7,750 (Direita).

---

## 3. O Algoritmo W-NOMINATE em R

Para estimar a posição ideológica revelada (comportamental) baseada nas votações nominais dos parlamentares, é utilizado o algoritmo **W-NOMINATE** (implementado no script [run_wnominate.R](file:///c:/Users/Caio/Desktop/projetos-em-andamento/BDR/scripts/ideal_points/run_wnominate.R)).

### Como Funciona
O W-NOMINATE é um método de escalonamento multidimensional espacial. Ele assume que cada parlamentar tem um "ponto ideal" e cada deliberação (voto) tem coordenadas de escolha (Sim vs. Não). Ele busca posicionar legisladores e votos em um espaço geométrico de forma a maximizar a probabilidade de que os votos previstos pelo modelo coincidam com os votos reais.

### Entradas e Processamento
1.  **Matriz de Votação Filtrada (`votes_matrix_filtered.csv`):** Uma tabela dinâmica contendo os deputados nas linhas e as votações nas colunas. Os votos são mapeados da seguinte forma:
    *   `Sim` $\rightarrow$ `1`
    *   `Não` $\rightarrow$ `0`
    *   `Abstenção`, `Obstrução`, `Artigo 17` $\rightarrow$ `NA` (valores ausentes).
2.  **Filtragem de Ruído:** São descartados deputados com baixíssima participação (menos de 20 votos) e votações quase unânimes (onde o lado vencedor obteve $\ge 95\%$ dos votos), pois fornecem pouca informação sobre a clivagem política.

### Ajuste de Sinal (Orientação Data-Driven)
Por definição matemática, os sinais das coordenadas geradas pelo W-NOMINATE são arbitrários (indeterminação de sinal). Para que o eixo signifique a escala clássica (esquerda à esquerda, direita à direita), o script [run_wnominate.R](file:///c:/Users/Caio/Desktop/projetos-em-andamento/BDR/scripts/ideal_points/run_wnominate.R) faz o seguinte:
1.  Calcula a média da coordenada da Dimensão 1 (`coord1D`) para cada bancada partidária.
2.  Mede a correlação estatística entre essas médias partidárias e o score ideológico oficial de *Bolognesi*.
3.  Se a correlação for **negativa** (indicando que valores negativos do W-NOMINATE correspondem a partidos de direita no benchmark), o script **multiplica todas as coordenadas da Dimensão 1 por $-1$**.
    *   *No nosso processamento real, a correlação inicial foi de $-0,8231$. Após o flip (inversão), a correlação ajustada ficou em $+0,8231$, consolidando que **eixo positivo = direita**.*

---

## 4. Pós-Processamento e Fórmulas de Score (Python)

Uma vez geradas as coordenadas W-NOMINATE orientadas (cujo intervalo teórico é $[-1, 1]$), o script Python [process_ideal_points.py](file:///c:/Users/Caio/Desktop/projetos-em-andamento/BDR/scripts/ideal_points/process_ideal_points.py) executa o cálculo final dos indicadores.

### 4.1. Score Comportamental Bruto (0 a 10)
A coordenada original `coord1D` é convertida para uma escala de 0 a 10 usando um mapeamento linear fixo:

$$\text{score\_comportamental\_0\_10} = (\text{coord1D} + 1) \times 5$$

*   $\text{coord1D} = -1 \rightarrow \text{Score } 0$ (Extrema Esquerda)
*   $\text{coord1D} = 0 \rightarrow \text{Score } 5$ (Centro)
*   $\text{coord1D} = 1 \rightarrow \text{Score } 10$ (Extrema Direita)

### 4.2. Calibração Linear via OLS
Os scores comportamentais brutos (0–10) tendem a concentrar os deputados na faixa de 2 a 5 da escala (devido a dinâmicas de votação da base governista e governabilidade). Compará-los diretamente com as notas de especialistas produziria uma distorção sistemática.

Para alinhar as escalas sem alterar a ordem dos parlamentares, realiza-se uma **calibração de regressão linear por Mínimos Quadrados Ordinários (OLS)** sobre os deputados que possuem score do partido:

$$\text{score\_calibrado\_0\_10} = a + b \times \text{score\_comportamental\_0\_10}$$

Com base nos dados reais estimados no pipeline, a reta de ajuste calculada foi:

$$\text{score\_calibrado\_0\_10} = 3.8497 + 0.7511 \times \text{score\_comportamental\_0\_10}$$

*O valor gerado é truncado no intervalo $[0, 10]$ para evitar extrapolações inválidas.*

### 4.3. Desvio Partidário e Direção
O desvio comportamental do deputado em relação à ideologia declarada do seu partido é calculado na escala calibrada:

$$\text{desvio\_partido} = \text{score\_calibrado\_0\_10} - \text{ideologia\_score\_partido}$$

Para classificar a direção do desvio (`direcao_desvio_partido`), adota-se uma **tolerância de segurança de $\pm 0.5$**:
*   Se $\text{desvio\_partido} > 0.5 \rightarrow$ **"mais a direita"**
*   Se $\text{desvio\_partido} < -0.5 \rightarrow$ **"mais a esquerda"**
*   Se $-0.5 \le \text{desvio\_partido} \le 0.5 \rightarrow$ **"alinhado"**

### 4.4. Desvio da Bancada (Coesão)
Mede o quanto o parlamentar difere do comportamento médio de sua própria bancada:

$$\text{score\_bancada\_0\_10} = \text{média do score comportamental dos deputados do partido}$$
$$\text{desvio\_bancada} = \text{score\_comportamental\_0\_10} - \text{score\_bancada\_0\_10}$$

---

## 5. Exemplos Práticos com Deputados Reais

Abaixo, detalhamos três casos reais presentes nos outputs gerados do banco de dados (recorte Q14).

### Caso A: Paulo Teixeira (PT) — Esquerda
*   **Partido:** PT (Score Oficial do Partido: $2,679$)
*   **Coordenada W-NOMINATE (`coord1D`):** $-0,9965$ (Extremo Esquerdo)
*   **Participação:** 33 votos válidos computados.

#### Passos do Cálculo:
1.  **Score Comportamental Bruto (0-10):**
    $$\text{score\_bruto} = (-0.9965 + 1) \times 5 = 0.0035 \times 5 = 0.0175 \approx 0,018$$
2.  **Score Calibrado (Alinhado ao Bolognesi):**
    $$\text{score\_calibrado} = 3.8497 + 0.7511 \times 0.0175 = 3.8497 + 0.0131 = 3.8628 \approx 3,863$$
3.  **Desvio Partidário:**
    $$\text{desvio\_partido} = 3.863 - 2.679 = 1.184$$
    *   Como $1.184 > 0.5$, ele é classificado como **"mais a direita"** que a ideologia teórica da legenda.
4.  **Desvio da Bancada:**
    *   A média da bancada do PT (`score_bancada_0_10`) é $0,566$.
    $$\text{desvio\_bancada} = 0.018 - 0.566 = -0.548 \approx -0,549$$
    *   Como $-0.549 < -0.5$, ele é classificado como **"mais a esquerda"** que a média prática do seu partido de votação.

---

### Caso B: Kim Kataguiri (UNIÃO/MISSÃO) — Centro-Direita/Direita
*   **Partido:** MISSÃO (Score Oficial do Partido: $7,750$)
*   **Coordenada W-NOMINATE (`coord1D`):** $0,4755$ (Centro-Direita)
*   **Participação:** 913 votos válidos computados.

#### Passos do Cálculo:
1.  **Score Comportamental Bruto (0-10):**
    $$\text{score\_bruto} = (0.4755 + 1) \times 5 = 1.4755 \times 5 = 7.3775 \approx 7,378$$
2.  **Score Calibrado (Alinhado ao Bolognesi):**
    $$\text{score\_calibrado} = 3.8497 + 0.7511 \times 7.3775 = 3.8497 + 5.5412 = 9.3909 \approx 9,391$$
3.  **Desvio Partidário:**
    $$\text{desvio\_partido} = 9.391 - 7.75 = 1.641$$
    *   Como $1.641 > 0.5$, ele é classificado como **"mais a direita"** que o benchmark oficial estabelecido.
4.  **Desvio da Bancada:**
    *   Por ser o único deputado computado sob a legenda ativa do MISSÃO no recorte de votações, a média da bancada é seu próprio score bruto ($7,378$).
    $$\text{desvio\_bancada} = 7.378 - 7.378 = 0.000$$
    *   Como o desvio está na faixa tolerada, ele é classificado como **"alinhado"** com a bancada.

---

### Caso C: Nikolas Ferreira (PL) — Direita/Extrema Direita
*   **Partido:** PL (Score Oficial do Partido: $8,796$)
*   **Coordenada W-NOMINATE (`coord1D`):** $0,6931$ (Direita)
*   **Participação:** 917 votos válidos computados.

#### Passos do Cálculo:
1.  **Score Comportamental Bruto (0-10):**
    $$\text{score\_bruto} = (0.6931 + 1) \times 5 = 1.6931 \times 5 = 8.4655 \approx 8,466$$
2.  **Score Calibrado (Alinhado ao Bolognesi):**
    $$\text{score\_calibrado} = 3.8497 + 0.7511 \times 8.4655 = 3.8497 + 6.3584 = 10.2081$$
    *   *Nota:* Como $10.2081 > 10.0$, o valor é limitado (**clipped**) para o teto de **$10,000$**.
3.  **Desvio Partidário:**
    $$\text{desvio\_partido} = 10.000 - 8.796 = 1.204$$
    *   Como $1.204 > 0.5$, ele é classificado como **"mais a direita"** que o benchmark oficial do PL.
4.  **Desvio da Bancada:**
    *   A média da bancada do PL (`score_bancada_0_10`) é $7,079$.
    $$\text{desvio\_bancada} = 8.466 - 7.079 = 1.387$$
    *   Como $1.387 > 0.5$, ele é classificado como **"mais a direita"** que a média geral de votações do PL.
