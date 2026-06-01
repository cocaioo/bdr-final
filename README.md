# BDR - Camara dos Deputados

Projeto local para padronizar CSVs da Camara dos Deputados, carregar os dados em
PostgreSQL via Docker e exportar respostas em `.txt`.

## Visao geral da aplicacao

O projeto tem tres partes principais:

1. **Banco PostgreSQL via Docker**
   - Configurado em `docker-compose.yml`.
   - Banco: `dossie_grupo4`.
   - Usuario/senha: `admin/admin`.
   - Porta local: `5433`.
   - Schema criado por `init.sql`.

2. **ETL em Python**
   - Le os CSVs de `tabelas/`.
   - Gera CSVs padronizados em `dados_padronizados/`.
   - Carrega o PostgreSQL.
   - Exporta respostas `.txt` para `respostas/`.

3. **Interface**
   - Backend: FastAPI em `dashboard/backend`, porta `8000`.
   - Frontend: React/Vite em `dashboard/frontend`, porta `5173`.
    - A interface le os arquivos exportados via API, sem consultar o banco
       diretamente.

## Estrutura das respostas do dashboard

O dashboard agora aceita caminhos relativos por membro/pergunta dentro do
`question_registry.json`, por exemplo `Caio/q2/q2_eixos_nuvem_palavras.txt` e
`Caio/q4/q4_escolaridade.txt`.

Regras de resolucao:

- Caminhos relativos apontando para subpastas do repo sao aceitos diretamente.
- Se um arquivo nao existir no caminho novo, o backend tenta o nome legado em
   `respostas/`.
- Se o arquivo ainda nao tiver migrado, o backend continua aceitando o nome
   antigo sem quebrar a API.

Quando registrar uma pergunta nova ou migrar uma existente, use sempre o
menor caminho relativo possivel no `question_registry.json` e mantenha o nome
do arquivo consistente com a pergunta.

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
- Node.js 20+ e npm
- Make no terminal usado pelo projeto
- CSVs brutos em `tabelas/`

## Configuracao inicial

No PowerShell, dentro da pasta do projeto:

```powershell
cd C:\Users\Vinicius\Desktop\bd_final\bdr-final
```

Se voce ja tiver o ambiente `.venv`, instale as dependencias Python nele:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip install -r dashboard\backend\requirements.txt
```

Instale o frontend:

```powershell
cd dashboard\frontend
npm install
cd ..\..
```

Observacao: o `Makefile` espera, por padrao, um ambiente chamado `venv`. Se
voce quiser usar todos os comandos `make` sem adaptar nada, crie o ambiente
assim:

```powershell
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe -m pip install -r dashboard\backend\requirements.txt
```

Se preferir manter `.venv`, execute os comandos Python manualmente ou informe a
variavel `PYTHON` ao usar o `make`.

## Banco e carga dos dados

Abra o Docker Desktop primeiro. Depois rode:

```powershell
docker compose up -d
```

Para recriar o banco do zero, carregar os dados e gerar respostas:

```bash
make db-reset
make etl
make validate
make export-respostas
```

Esse fluxo recria o banco PostgreSQL, aplica `init.sql`, padroniza os CSVs de
`tabelas/`, carrega os dados e gera os arquivos `.txt` em `respostas/`.

Caso esteja usando `.venv`, rode o ETL manualmente assim:

```powershell
.\.venv\Scripts\python.exe -m src.main
docker compose exec -T postgres psql -U admin -d dossie_grupo4 -f /sql/validation_queries.sql
docker compose exec -T postgres psql -U admin -d dossie_grupo4 -f /sql/export_respostas.sql
```

Atalhos:

- `make up`: sobe o PostgreSQL.
- `make down`: para o container.
- `make db-reset`: recria o volume do banco e reaplica `init.sql`.
- `make etl`: padroniza os CSVs e carrega o banco.
- `make validate`: executa validacoes basicas.
- `make export-respostas`: gera arquivos em `respostas/`.
- `make dashboard-install`: instala dependencias Python do backend e npm do frontend.
- `make dashboard-api`: inicia a API FastAPI em `http://localhost:8000`.
- `make dashboard-web`: inicia o frontend Vite em `http://localhost:5173`.
- `make dashboard-dev`: inicia API e frontend em segundo plano.

## Como abrir a interface

A interface precisa de dois processos rodando: backend e frontend. Deixe dois
terminais abertos.

Terminal 1, API:

```powershell
cd C:\Users\Vinicius\Desktop\bd_final\bdr-final
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir dashboard/backend --reload --host 0.0.0.0 --port 8000
```

Terminal 2, frontend:

```powershell
cd C:\Users\Vinicius\Desktop\bd_final\bdr-final\dashboard\frontend
npm run dev -- --host 0.0.0.0 --port 5173
```

Depois abra no navegador:

```text
http://localhost:5173
```

Endpoints uteis da API:

```text
http://localhost:8000/api/health
http://localhost:8000/api/meta
```

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

As respostas sao exportadas por `sql/export_respostas.sql` para a arvore do
projeto por membro/pergunta. O backend continua com fallback para `respostas/`
quando necessario.

Exemplos de registro no dashboard:

- `Caio/q2/q2_eixos_nuvem_palavras.txt`
- `Caio/q2/q2_eixo_nuvens_complemento.txt`
- `Caio/q4/q4_escolaridade.txt`
- `Caio/q4/q4_escolaridade_complementar.txt`

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


