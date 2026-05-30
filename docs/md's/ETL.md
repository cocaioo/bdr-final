# ETL

## Conceito e objetivo

- ETL significa Extract, Transform, Load.
- Extrai CSVs brutos, transforma para um padrao unico e carrega no PostgreSQL.
- O objetivo e garantir tipagem, chaves e formatos consistentes para as queries.

## Entrada de dados

- Os CSVs ficam em `tabelas/`, com subpastas por ano quando necessario.
- O ETL busca arquivos por padroes como `Ano-*.csv`, `votacoes-*.csv`, `proposicoes-*.csv`.
- O ano e extraido do nome do arquivo e salvo em `ano_dados`.
- Para cada entidade, os CSVs anuais sao unidos no mesmo CSV padronizado.
- Cada CSV padronizado corresponde a uma tabela especifica e nao mistura entidades.

## Transformacoes e padronizacao

- Normaliza nomes de colunas para `snake_case`.
- Limpa texto, remove espacos extras e padroniza siglas e votos.
- Converte tipos: inteiro, decimal, money, data, timestamp, boolean e cpf.
- Remove linhas com campos obrigatorios vazios.
- Remove duplicatas por chave primaria quando aplicavel.
- Elimina registros de lideranca na tabela `gastos`.
- Valida colunas numericas e salva amostras de erros em `logs/`.
- Enriquecimento opcional pela API preenche `cpf`, `nome_civil` e `escolaridade`.

## Carga no banco

- `src/main.py` orquestra o pipeline completo.
- `src/mappings.py` define o mapeamento CSV -> tabela.
- `src/loaders.py` aplica a limpeza e grava CSVs em `dados_padronizados/`.
- `src/db.py` usa `COPY` para carga rapida no schema `grupo4`.
- Cada tabela gera seu proprio CSV padronizado, nao um unico arquivo gigante.

## Rastreabilidade e saida

- `logs/etl_load_manifest.csv` registra linhas lidas, limpas e carregadas por tabela.
- Arquivos `bad_rows_*.csv` guardam amostras de linhas invalidas.
- `sql/export_respostas.sql` executa as queries e grava os arquivos em `respostas/`.

## Configuracao util

- `RAW_DATA_DIR` e `CLEAN_DATA_DIR` definem entrada e saida.
- `ENRICH_DEPUTADOS_API` ativa ou desativa a consulta a API.
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` configuram o banco local.
