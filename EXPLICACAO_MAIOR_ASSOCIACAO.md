# Explicação da métrica “Maior Associação”

## O que a métrica tentava mostrar

O card exibia o maior valor de eta quadrado (`η²`) calculado entre a escolaridade dos deputados e cinco indicadores numéricos: gastos, coincidência com a orientação partidária, número de proposições, registros de presença em eventos e registros ligados ao plenário.

O eta quadrado estima qual parcela da variação observada em um indicador pode ser associada às diferenças entre os grupos de escolaridade. Um valor próximo de zero indica que as médias dos grupos explicam muito pouco da variação total.

## Origem

A métrica vem do artefato `Caio/escolaridade-perfil/q6/q6_eta_complementar.txt`, produzido pela análise complementar em `q6_complementar.sql`. O cálculo usa registros anuais de deputados, exclui a categoria de escolaridade “Não informado” e compara a variação entre grupos com a variação total de cada indicador.

No artefato atual, o maior valor é `0,0120` para registros de presença em eventos, classificado como associação fraca. Os demais resultados também são fracos ou muito fracos.

## Natureza da métrica

É uma medida de tamanho de associação entre uma variável categórica e uma variável numérica. Não é correlação linear, ranking de desempenho, comparação direta entre dois deputados nem evidência de causalidade.

O resultado não permite afirmar que a escolaridade provoca diferenças em gastos, proposições, votos ou presenças. Outros fatores — partido, estado, tempo de mandato, função parlamentar, tamanho desigual dos grupos e cobertura dos dados — podem influenciar os valores.

## É seguro exibir para usuário leigo?

Não como um card isolado. Mostrar apenas “Maior Associação”, `η²` e um número decimal exige conhecimento estatístico e pode induzir o usuário a interpretar o maior valor como forte ou importante. No conjunto atual, até o maior resultado representa associação fraca.

Uma apresentação segura exigiria contexto metodológico, identificação do indicador, tamanho dos grupos, período, interpretação da escala e destaque explícito de que não há causalidade. Isso seria informação demais para um card executivo.

## Recomendação

Remover o card do painel integrado. A análise pode permanecer nos artefatos técnicos para auditoria e estudos metodológicos, mas não deve aparecer como destaque para o público leigo sem uma visualização e explicação próprias.

