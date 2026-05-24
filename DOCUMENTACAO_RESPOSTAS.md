# Documentacao do projeto e das respostas

Este arquivo documenta como o projeto foi organizado, por que os dados foram padronizados e como as respostas em `respostas/` sao produzidas. A ideia e deixar rastreavel tanto a engenharia do dado quanto a leitura analitica final.

## Objetivo do projeto

O projeto parte dos CSVs brutos da Camara, trata inconsistencias de nomes e chaves, carrega o resultado em PostgreSQL e exporta respostas reproduziveis em SQL.

## Estrutura das pastas

- `tabelas/`: CSVs brutos de origem, sem padronizacao.
- `dados_padronizados/`: arquivos gerados pelo ETL com nomes e campos uniformizados.
- `src/`: codigo Python de limpeza, mapeamento, carga e enriquecimento.
- `sql/`: orquestrador de exportacao, queries de validacao e arquivos SQL por questao.
- `sql/questoes-queries/`: consultas separadas por questao, chamadas por `sql/export_respostas.sql`.
- `respostas/`: saida final em `.txt` para cada questao.
- `logs/`: caches e registros auxiliares, como o cache da API de deputados.
- `data/`: area auxiliar para insumos ou intermediarios, quando necessario.

## Decisoes de padronizacao

- Usamos `snake_case` em todo o schema para evitar nomes diferentes para a mesma informacao.
- Centralizamos identificadores como `id_deputado`, `id_votacao`, `id_evento` e `id_proposicao` para facilitar joins e validacoes.
- Mantemos os CSVs originais em `tabelas/` e gravamos o resultado limpo em `dados_padronizados/` para preservar a rastreabilidade.
- Carregamos arquivos anuais recursivamente e preservamos `ano_dados` nas tabelas de eventos, gastos, proposicoes e votacoes para evitar misturar chaves de anos diferentes.
- Usamos `ideCadastro` nos gastos como `id_deputado`, pois esse identificador cruza corretamente com deputados, votos, presencas e autores.
- Vinculos incompletos entre extratos oficiais, como temas sem proposicao correspondente, sao reportados em `sql/validation_queries.sql` em vez de bloquear a carga.
- Complementamos `deputados` pela API oficial apenas para campos ausentes ou inconsistentes, como `cpf`, `nome_civil` e `escolaridade`.
- Mantemos a geracao das respostas em SQL para que cada resultado seja reproduzivel e auditavel diretamente no banco.
- Quando o dado oficial usa varias descricoes para a mesma situacao, normalizamos a leitura na query em vez de depender de um unico termo literal.

## Geracao das respostas

As respostas sao geradas por `sql/export_respostas.sql` a partir do schema `grupo4` no PostgreSQL. O arquivo principal funciona como orquestrador: configura o `psql`, define `search_path`, carrega `sql/questoes-queries/_common.sql` e inclui as consultas `q1.sql` a `q13.sql` em ordem.

Cada arquivo em `sql/questoes-queries/` fica responsavel por uma questao e pelos respectivos arquivos `.txt` em `respostas/`. Quando uma questao tem complemento, o complemento permanece no mesmo arquivo da questao para manter o fluxo de leitura junto do resultado principal.

O script usa views temporarias apenas durante a sessao de exportacao para centralizar regras repetidas, como eixo maior de temas, categoria normalizada de situacao, tokens de palavras, deputados ativos e metricas agregadas. Essas views nao alteram tabelas do banco. As views compartilhadas ficam em `sql/questoes-queries/_common.sql`; views temporarias especificas de uma questao ficam no proprio arquivo da questao.

Nas questoes com rankings muito grandes, o arquivo principal traz resumo executivo e uma tabela enxuta. O ranking completo fica em arquivo complementar para manter a leitura do resultado principal sem perder rastreabilidade.

As principais fontes sao:

- `deputados`
- `gastos`
- `proposicoes`
- `proposicoes_autores`
- `proposicoes_temas`
- `votacoes`
- `votacoes_votos`
- `votacoes_orientacoes`
- `votacoes_objetos`
- `eventos`
- `eventos_presenca_deputados`
- `partidos_ideologia`

## O que cada arquivo mostra

| Arquivo | O que mede | Principais tabelas | Observacoes |
| --- | --- | --- | --- |
| `q1_gastos_deputados.txt` | Soma total de gastos por deputado | `gastos`, `deputados` | Agrupa por deputado e ordena pelo maior gasto. |
| `q2_eixos_nuvem_palavras.txt` | Relacao entre deputados, eixos maiores e frequencia de palavras nas proposicoes | `proposicoes_autores`, `proposicoes`, `proposicoes_temas` | Ha duas saidas: Q2.1 por eixo maior e Q2.2 com a nuvem de palavras. |
| `q2_eixo_nuvens_complemento.txt` | Eixo mais atuante de cada deputado | `proposicoes_autores`, `proposicoes`, `proposicoes_temas` | Mantem mais de um eixo quando houver empate na maior quantidade de proposicoes. |
| `q3_voto_deputado_tema.txt` | Quantidade de votos Sim, Nao e Abstencao por deputado e eixo de atuacao | `votacoes_votos`, `votacoes_objetos`, `proposicoes`, `proposicoes_temas` | Usa tema oficial quando disponivel e palavras-chave de titulo/ementa como fallback. |
| `q4_escolaridade.txt` | Distribuicao de escolaridade entre deputados ativos | `deputados`, `gastos`, `votacoes_votos`, `eventos_presenca_deputados`, `proposicoes_autores` | Conta apenas deputados que aparecem em ao menos uma fonte de atividade. |
| `q4_escolaridade_complementar.txt` | Lista deputados e escolaridade individual | `deputados`, `gastos`, `votacoes_votos`, `eventos_presenca_deputados`, `proposicoes_autores` | Ordena por escolaridade e depois por nome, mantendo deputados de mesma escolaridade agrupados. |
| `q5_fornecedores.txt` | Ranking enxuto de fornecedores e total pago | `gastos` | Traz resumo executivo, top 30 fornecedores, percentual do total e referencia ao complemento. |
| `q5_fornecedores_complemento.txt` | Ranking completo de fornecedores | `gastos` | Mantem a mesma agregacao completa da consulta original. |
| `q6_escolaridade_correlacoes.txt` | Medias por escolaridade de gasto, fidelidade, proposicoes e presenca | `deputados`, `gastos`, `votacoes_votos`, `votacoes_orientacoes`, `proposicoes_autores`, `eventos_presenca_deputados` | Traz resumo geral e tabela por escolaridade. |
| `q7_custo_beneficio.txt` | Indice simples de custo-beneficio por deputado | `gastos`, `proposicoes_autores`, `votacoes_votos`, `eventos_presenca_deputados`, `deputados` | Mostra resumo e top 30. O indice combina autoria, aprovacao e presenca dividido pelo gasto total. |
| `q7_custo_beneficio_complemento.txt` | Ranking completo de custo-beneficio | Mesmas tabelas da Q7 | Mantem todos os deputados com gasto positivo. |
| `q8_influencia.txt` | Influencia legislativa baseada na autoria de proposicoes | `proposicoes_autores`, `proposicoes`, `deputados` | Traz resumo e top 30 por percentual de aprovacao. A aprovacao usa categorias de status normalizadas. |
| `q8_influencia_complemento.txt` | Ranking completo de influencia legislativa | Mesmas tabelas da Q8 | Mantem todos os deputados com autoria vinculada. |
| `q9_vies_deputado.txt` | Leitura de vies partidario e ideologico | `partidos_ideologia`, `votacoes_votos`, `gastos`, `proposicoes_autores`, `proposicoes`, `proposicoes_temas` | O arquivo junta tres visoes: partido predominante do deputado, partido x tema e votos por ideologia. |
| `q10_alinhamento_interno_partidos.txt` | Nivel de alinhamento interno de cada partido | `votacoes_votos` | Compara o voto individual com a maioria do proprio partido em cada votacao. |
| `q11_rankings_partidos.txt` | Painel partidario compacto | `votacoes_votos`, `proposicoes_autores`, `gastos`, `proposicoes` | Junta votos, proposicoes, gastos e posicoes de ranking em uma tabela principal, mais top palavras por partido. |
| `q11_nuvem_palavras_partidos_complemento.txt` | Nuvem completa de palavras por partido | `proposicoes_autores`, `proposicoes` | Mantem o detalhamento completo da nuvem, separado do painel principal. |
| `q12_deputado_fornecedor.txt` | Ligacao enxuta entre deputado e fornecedor | `gastos`, `deputados` | Traz resumo e top 30 pares deputado-fornecedor por total pago. |
| `q12_deputado_fornecedor_complemento.txt` | Ranking completo deputado x fornecedor | Mesmas tabelas da Q12 | Mantem todas as combinacoes deputado-fornecedor. |
| `q13_categorias_gasto_deputado.txt` | Categorias de despesa por deputado | `gastos`, `deputados` | Traz resumo e top 30 pares deputado-categoria por gasto. |
| `q13_categorias_gasto_deputado_complemento.txt` | Ranking completo deputado x categoria de gasto | Mesmas tabelas da Q13 | Mantem todas as combinacoes deputado-categoria. |

## Como interpretar os status de proposicoes

A coluna `descricao_situacao` vem de `proposicoes` e representa o ultimo status conhecido da proposicao. No export atual, ela foi normalizada em categorias para evitar depender de um unico texto literal.

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

A Q7 depende de cruzar gastos com autoria e presenca por `id_deputado`. Nos CSVs
de cotas, o identificador compativel com as demais fontes e `ideCadastro`; por
isso a carga de `gastos` usa esse campo, nao `nuDeputadoId`.

## Observacao importante sobre Q8

A Q8 deixa de depender de uma comparacao textual fraca como `ILIKE '%Aprov%'` e passa a usar a classificacao por categoria. Isso evita que variantes como `Transformado em Norma Juridica` ou `Enviada a sancao` fiquem fora do calculo de aprovacao.
