# BDR - Camara dos Deputados

Projeto local para padronizar CSVs da Camara dos Deputados, carregar os dados em
PostgreSQL via Docker e exportar respostas em `.txt`.

## Diagnostico da refatoracao

O projeto anterior carregava parte dos dados, mas nao atendia totalmente aos
requisitos: gravava em `cleaned/`, mantinha chaves com nomes diferentes para a
mesma informacao (`id_dep`, `nudeputadoid`, `deputado_id`, `iddeputado`), nao
carregava `eventosPresencaDeputados-2026.csv`, nao preenchia escolaridade pela
API oficial e tinha respostas antigas geradas sobre um schema inconsistente.

Esta versao usa um unico padrao em `snake_case`, com chaves como
`id_deputado`, `id_votacao`, `id_evento`, `id_proposicao`, `uri_deputado`,
`uri_proposicao`, `sigla_partido` e `sigla_uf`.

## Requisitos

- Python 3.11+
- Docker Desktop
- CSVs brutos em `tabelas/`

## Execucao

```bash
python -m pip install -r requirements.txt
make db-reset
make etl
make validate
make export-respostas
```

Atalhos:

- `make up`: sobe o PostgreSQL.
- `make down`: para o container.
- `make db-reset`: recria o volume do banco e reaplica `init.sql`.
- `make etl`: padroniza os CSVs e carrega o banco.
- `make validate`: executa validacoes basicas.
- `make export-respostas`: gera arquivos em `respostas/`.

## Banco local

O `docker-compose.yml` sobe PostgreSQL 16 com:

- Porta local: `5433` por padrao (`DB_PORT` no `.env`, ajustavel se a porta estiver ocupada)
- Banco: `dossie_grupo4`
- Schema: `grupo4`
- Usuario/senha: `admin/admin`

O schema e criado por `init.sql`.

## Dados padronizados

O ETL le os CSVs de `tabelas/` de forma recursiva, padroniza os nomes e salva
tudo em `dados_padronizados/`. Essa pasta substitui a antiga `cleaned/`.

Arquivos anuais como `tabelas/2026/Ano-2026.csv` sao encontrados
automaticamente por padroes como `Ano-*.csv`. Com `RAW_DATA_DIR=./tabelas`, a
carga agrega todos os anos disponiveis. Com `RAW_DATA_DIR=./tabelas/2026`, a
carga fica restrita aos CSVs anuais daquela pasta; `deputados.csv` pode ser
lido do diretorio pai quando existir.

As tabelas anuais agora sao bases multi-ano com a coluna `ano_dados`. O schema
mantem views como `gastos_2026` e `votacoes_votos_2026` apenas para
compatibilidade com consultas antigas.

Tabelas geradas:

- `deputados.csv`
- `partidos_ideologia.csv`
- `proposicoes.csv`
- `eventos.csv`
- `votacoes.csv`
- `gastos.csv`
- `votacoes_votos.csv`
- `votacoes_orientacoes.csv`
- `votacoes_objetos.csv`
- `proposicoes_temas.csv`
- `eventos_presenca_deputados.csv`
- `proposicoes_autores.csv`

Ao fim da carga, `logs/etl_load_manifest.csv` registra tabela, arquivos fonte,
anos carregados, linhas lidas, linhas padronizadas, linhas carregadas e status.

## Enriquecimento via API

A tabela `deputados` e complementada com a API oficial da Camara:

`GET https://dadosabertos.camara.leg.br/api/v2/deputados/{id}`

Campos integrados:

- `cpf`
- `nome_civil`
- `escolaridade`

O cache fica em `logs/deputados_api_cache.json`. Para desabilitar chamadas de
API em uma execucao, ajuste `.env`:

```env
ENRICH_DEPUTADOS_API=false
```

## Respostas

As respostas sao exportadas por `sql/export_respostas.sql` para `respostas/`.
O arquivo cobre as perguntas Q1 a Q13 do PDF:

- gastos por deputado
- eixo/tema e nuvem de palavras
- voto de deputado por tema
- escolaridade
- fornecedores
- correlacoes por escolaridade
- custo-beneficio
- influencia legislativa
- vies ideologico
- alinhamento interno de partidos
- rankings partidarios
- deputado x fornecedor
- categorias de gasto por deputado

Documentacao detalhada do projeto e das respostas: [DOCUMENTACAO_RESPOSTAS.md](DOCUMENTACAO_RESPOSTAS.md)

## Arquivos principais

- `src/main.py`: pipeline principal
- `src/mappings.py`: padrao de nomes e mapeamento CSV -> banco
- `src/loaders.py`: padronizacao e carga
- `src/enrichment.py`: integracao com API oficial
- `init.sql`: schema PostgreSQL
- `sql/validation_queries.sql`: validacoes
- `sql/export_respostas.sql`: exportacao das respostas


## Questao 1 
1. Deputados Ordenados por gasto - A Scopo :: N, P, E
Filtro de A a Z
Ideia de Resolução 
 Ela resolve a Q1 somando valor_liquido da tabela gastos, a
 associando cada gasto ao deputado correspondente pela tabela deputados. O resultado é agrupado
por deputado, UF e partido, e ordenado do maior gasto total para o menor.

- valor_liquido: valor efetivo após descontar a glosa.

## Questao 2
2. Agrupar deputados por eixo de atuação (Nuvem de Palavras) - Ex: Eixo social, econômico, tributário, segurança, saúde, etc. nuvem de palavras 

Solução 
 1. Agrupa deputados por tema oficial de atuação
 2. Gera uma frequência de palavras das proposições, que serve como base para nuvem de palavras:
 3. Agrupar em categorias nesse caso, Viação, Transporte e Mobilidade  seria uma subcategoria de uma categoria maior que ela mais se encaixa, 
 Nesse caso, Viacao , transporte e mobilidade seria SOCIAL ou poderia ser ECONOMICO 

## QUESTAO 3

Como um deputado votou em um temaleixo
específico
