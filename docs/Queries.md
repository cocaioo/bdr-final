# Queries

## Como sao executadas

- `sql/export_respostas.sql` define o `search_path` e inclui `_common.sql` e Q1 a Q13.
- Cada arquivo usa `\o` para gravar as saidas em `respostas/`.
- As consultas dependem do schema `grupo4` e das tabelas carregadas pelo ETL.

## Base comum (_common.sql)

- `resposta_temas_eixos`: mapeia `cod_tema` para um `eixo_maior` unico.
- `resposta_proposicoes_situacoes`: normaliza `descricao_situacao` e cria categorias.
- `resposta_stopwords` e `resposta_tokens_*`: tokenizam e filtram termos curtos.
- `resposta_deputados_ativos`: filtra deputados com atividade real nas bases.
- `resposta_gastos_deputado`: soma `valor_liquido` por deputado.
- `resposta_proposicoes_deputado`: conta proposicoes e aprovadas por deputado.
- `resposta_presenca_deputado`: soma presencas em eventos e votacoes.
- `resposta_fidelidade_deputado`: mede votos alinhados a orientacao do partido.

## Q1 - Gastos por deputado

- Soma `valor_liquido` para refletir o gasto efetivo.
- Agrupa por deputado, UF e partido para manter o contexto politico.
- Ordena por gasto total para criar o ranking.

## Q2 - Eixos e nuvem de palavras

- Parte 1: junta autores, proposicoes e temas para contar atuacao por eixo.
- Parte 2: tokeniza ementas e keywords para frequencia de termos.
- Complemento: identifica o eixo mais atuante por deputado.

## Q3 - Voto por deputado e eixo

- Liga votacoes a proposicoes via `votacoes_objetos`.
- Usa tema oficial quando existe e faz fallback por palavras-chave.
- Conta `Sim`, `Nao` e `Abstencao` por eixo e deputado.

## Q4 - Escolaridade

- Usa `resposta_deputados_ativos` para evitar contagem de inativos.
- Agrupa por escolaridade e gera lista detalhada no complemento.

## Q5 - Fornecedores

- Agrega `gastos` por fornecedor para medir concentracao de pagamentos.
- Resumo mostra tamanho do universo e peso do top 10.
- Tabela principal traz top 30 e o complemento lista o ranking completo.

## Q6 - Correlacoes por escolaridade

- Junta gasto, fidelidade, proposicoes e presenca por deputado.
- Calcula medias por escolaridade para comparar grupos.

## Q7 - Custo-beneficio

- Cria um indice de beneficio com pesos para proposicoes e presenca.
- Divide beneficio pelo gasto total para comparar eficiencia.
- Mostra top 30 e ranking completo.

## Q8 - Influencia legislativa

- Calcula percentual de aprovacao por deputado.
- Ordena por aprovacao para destacar maior influencia.
- Complemento apresenta o ranking completo.

## Q9 - Vies ideologico

- Define partido predominante por ocorrencias em gastos, votos e autoria.
- Mapeia siglas para ideologia via `partidos_ideologia`.
- Complementos mostram temas por partido e votos por ideologia.

## Q10 - Alinhamento interno de partidos

- Define o voto majoritario do partido em cada votacao.
- Calcula a razao entre votos alinhados e total do partido.

## Q11 - Rankings partidarios

- Junta metricas de votos, proposicoes e gastos por partido.
- Usa ranking por metrica e gera nuvem de palavras por sigla.

## Q12 - Deputado x fornecedor

- Agrega gastos por par deputado/fornecedor.
- Mostra top 30 e ranking completo para analise detalhada.

## Q13 - Deputado x categoria de gasto

- Agrega gastos por deputado e `descricao_despesa`.
- Mostra top 30 e ranking completo para evidenciar concentracoes.
