# Documentacao das respostas

Este arquivo explica o que cada resposta em `respostas/` mede, quais tabelas alimentam cada saida e quais cuidados sao importantes para interpretar os resultados.

## Visao geral

As respostas sao geradas por `sql/export_respostas.sql` a partir do schema `grupo4` no PostgreSQL. O processo consulta as tabelas padronizadas e grava os arquivos `.txt` em `respostas/`.

As principais fontes sao:

- `deputados`
- `gastos_2026`
- `proposicoes_2026`
- `proposicoes_autores`
- `proposicoes_temas_2026`
- `votacoes_2026`
- `votacoes_votos_2026`
- `votacoes_orientacoes_2026`
- `votacoes_objetos_2026`
- `eventos_2026`
- `eventos_presenca_deputados_2026`
- `partidos_ideologia`

## O que cada arquivo mostra

| Arquivo | O que mede | Principais tabelas | Observacoes |
| --- | --- | --- | --- |
| `q1_gastos_deputados.txt` | Soma total de gastos por deputado | `gastos_2026`, `deputados` | Agrupa por deputado e ordena pelo maior gasto. |
| `q2_eixos_nuvem_palavras.txt` | Relacao entre deputados, temas oficiais e frequencia de palavras nas proposicoes | `proposicoes_autores`, `proposicoes_2026`, `proposicoes_temas_2026` | Ha duas saidas: uma por tema e outra com a nuvem de palavras. |
| `q3_voto_deputado_tema.txt` | Votos de um deputado no tema mais recorrente da sua historico de votacao | `votacoes_votos_2026`, `votacoes_objetos_2026`, `proposicoes_2026`, `proposicoes_temas_2026` | Seleciona o deputado com mais votos registrados e o tema mais frequente desse deputado. |
| `q4_escolaridade.txt` | Distribuicao de escolaridade entre deputados ativos | `deputados`, `gastos_2026`, `votacoes_votos_2026`, `eventos_presenca_deputados_2026`, `proposicoes_autores` | Conta apenas deputados que aparecem em ao menos uma fonte de atividade. |
| `q5_fornecedores.txt` | Ranking de fornecedores e total pago | `gastos_2026` | Mostra quantidade de lancamentos e valor total por fornecedor. |
| `q6_escolaridade_correlacoes.txt` | Medias por escolaridade de gasto, fidelidade, proposicoes e presenca | `deputados`, `gastos_2026`, `votacoes_votos_2026`, `votacoes_orientacoes_2026`, `proposicoes_autores`, `eventos_presenca_deputados_2026` | Resume variaveis de comportamento legislativo por nivel de escolaridade. |
| `q7_custo_beneficio.txt` | Indice simples de custo-beneficio por deputado | `gastos_2026`, `proposicoes_autores`, `votacoes_votos_2026`, `eventos_presenca_deputados_2026`, `deputados` | O indice combina autoria, aprovacao e presenca dividido pelo gasto total. |
| `q8_influencia.txt` | Influencia legislativa baseada na autoria de proposicoes | `proposicoes_autores`, `proposicoes_2026`, `deputados` | A aprovacao agora usa categorias de status normalizadas em vez de um texto literal. |
| `q9_vies_deputado.txt` | Leitura de vies partidario e ideologico | `partidos_ideologia`, `votacoes_votos_2026`, `gastos_2026`, `proposicoes_autores`, `proposicoes_2026`, `proposicoes_temas_2026` | O arquivo junta tres visoes: partido predominante do deputado, partido x tema e votos por ideologia. |
| `q10_alinhamento_interno_partidos.txt` | Nivel de alinhamento interno de cada partido | `votacoes_votos_2026` | Compara o voto individual com a maioria do proprio partido em cada votacao. |
| `q11_rankings_partidos.txt` | Rankings partidarios por votacao, proposicoes, gastos e palavras | `votacoes_votos_2026`, `proposicoes_autores`, `gastos_2026`, `proposicoes_2026` | Sao quatro saidas: frequencia em votacoes, proposicoes, gastos e nuvem de palavras por partido. |
| `q12_deputado_fornecedor.txt` | Ligacao entre deputado e fornecedor | `gastos_2026`, `deputados` | Agrupa gastos por deputado e fornecedor, mostrando contagem e total pago. |
| `q13_categorias_gasto_deputado.txt` | Categorias de despesa por deputado | `gastos_2026`, `deputados` | Agrupa por descricao de despesa para ver como cada deputado concentra seus gastos. |

## Como interpretar os status de proposicoes

A coluna `descricao_situacao` vem de `proposicoes_2026` e representa o ultimo status conhecido da proposicao. No export atual, ela foi normalizada em categorias para evitar depender de um unico texto literal.

As categorias usadas sao:

- `ativa`
- `aprovada`
- `rejeitada`
- `arquivada`
- `especial`
- `desconhecida`

Exemplos de situacoes mapeadas como `aprovada`:

- `Aprovada`
- `Aprovada em Plenario`
- `Aprovada conclusivamente`
- `Aprovada com substitutivo`
- `Aprovada parcialmente`
- `Remetida ao Senado`
- `Enviada a sancao`
- `Transformado em Norma Juridica`
- `Transformado em Lei`
- `Promulgada`

## Observacao importante sobre Q7

No recorte atual do banco, os deputados que entram por `gastos_2026` nao possuem interseccao com `proposicoes_autores` na base usada para a Q7. Por isso, a saida pode manter `qtd_proposicoes` e `proposicoes_aprovadas` em zero mesmo com a query correta.

Isso nao indica erro de calculo. Indica apenas que, para esse subconjunto, a base nao tem autoria legislativa vinculada aos deputados gastos.

## Observacao importante sobre Q8

A Q8 deixa de depender de uma comparacao textual fraca como `ILIKE '%Aprov%'` e passa a usar a classificacao por categoria. Isso evita que variantes como `Transformado em Norma Juridica` ou `Enviada a sancao` fiquem fora do calculo de aprovacao.
