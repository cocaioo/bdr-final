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

O ETL le os CSVs de `tabelas/`, padroniza os nomes e salva tudo em
`dados_padronizados/`. Essa pasta substitui a antiga `cleaned/`.

Tabelas geradas:

- `deputados.csv`
- `partidos_ideologia.csv`
- `proposicoes_2026.csv`
- `eventos_2026.csv`
- `votacoes_2026.csv`
- `gastos_2026.csv`
- `votacoes_votos_2026.csv`
- `votacoes_orientacoes_2026.csv`
- `votacoes_objetos_2026.csv`
- `proposicoes_temas_2026.csv`
- `eventos_presenca_deputados_2026.csv`
- `proposicoes_autores.csv`

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
