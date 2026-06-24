# Explicação dos gráficos de Escolaridade e Perfil

## Produção legislativa média por escolaridade

O gráfico mostra a média anual de proposições de autoria atribuídas a deputados de cada nível de escolaridade. Para cada deputado e ano com atividade registrada, a base conta proposições distintas de sua autoria; depois calcula a média dentro de cada grupo educacional.

Valores maiores significam que, naquele grupo, a quantidade média anual de proposições por deputado foi maior. Valores menores significam uma média anual menor. O gráfico não mede qualidade, relevância, aprovação ou impacto das proposições.

Grupos pequenos podem produzir médias instáveis. A comparação também não demonstra que a escolaridade causou a diferença.

## O que significa “registro deputado-ano”

Um “registro deputado-ano” é uma observação formada por um deputado em um determinado ano. O mesmo parlamentar pode aparecer uma vez em 2023, outra em 2024 e assim por diante, desde que tenha atividade identificada na base naquele ano.

Esse termo é técnico e deve sair da interface principal. A frase recomendada para a UI é:

> Média anual de proposições de autoria por deputado, agrupada por escolaridade.

No período completo, deputados com atividade em vários anos contribuem com uma observação em cada ano. Ao selecionar um ano, a comparação considera apenas aquele período.

## Presença média por escolaridade

O gráfico compara duas contagens médias anuais por deputado:

- todos os registros de presença associados a eventos;
- o subconjunto desses registros ligado a atividades identificadas como plenário.

Valores maiores indicam mais registros anuais de presença, em média, para o grupo de escolaridade. Eles não representam porcentagem de comparecimento.

## O que entra como presença

A fonte é `eventos_presenca_deputados`. Cada linha associada a um deputado é contada como um registro de presença. A métrica soma esses registros por deputado e ano e depois calcula a média por escolaridade.

Um evento é uma atividade presente no catálogo `eventos` e vinculada aos registros de presença por ano e identificador do evento.

Uma atividade é classificada como plenário quando o local na Câmara é exatamente "Plenário da Câmara dos Deputados". Portanto, "plenário" refere-se especificamente às sessões no Plenário Principal, diferenciando-as de reuniões de comissões em salas de comissão (que ocorrem em locais como "Anexo II, Plenário 01", etc.).

## Limitações da presença

- A base não fornece, nesta métrica, o total de sessões ou eventos em que cada deputado poderia comparecer. Por isso não é possível calcular taxa de presença.
- Mais registros não significam necessariamente maior assiduidade relativa, pois a quantidade de eventos elegíveis pode variar.
- A classificação de plenário é restrita ao local principal de votações da Câmara; eventos em outros locais (como salas de comissão) não são contados nesta categoria.
- Diferenças de cobertura entre anos e grupos afetam as médias.
- A métrica não deve ser usada isoladamente para avaliar desempenho parlamentar.

O texto recomendado para a UI é:

> Média anual de registros de presença. "Todos os eventos" inclui reuniões de comissão e demais sessões oficiais, enquanto "Atividades de plenário" restringe-se estritamente às votações no Plenário Principal da Câmara.

