# ETL — Câmara dos Deputados (Grupo 4)

Pipeline ETL para dados abertos da Câmara dos Deputados do Brasil.  
Projeto acadêmico — Banco de Dados Relacional.

## Pré-requisitos

- Python 3.11+
- Docker Desktop (para PostgreSQL 16)
- CSVs baixados da API da Câmara

## Setup

### 1. Subir o banco de dados

```bash
docker-compose up -d
```

O container PostgreSQL será criado com:
- Porta: `5433`
- Banco: `dossie_grupo4`
- Schema: `grupo4`
- Usuário/Senha: `admin/admin`

O schema é criado automaticamente via `init.sql`.

### 2. Configurar o ambiente

```bash
# Copiar template de configuração
copy .env.example .env

# Criar e ativar virtualenv
python -m venv venv
venv\Scripts\activate

# Instalar dependências
pip install -r requirements.txt
```

### 3. Colocar os CSVs

Os CSVs devem estar na pasta `tabelas/` (configurável no `.env`).

Arquivos esperados:

| CSV | Tabela |
|-----|--------|
| `deputados.csv` | deputados |
| `proposicoes-2026.csv` | proposicoes_2026 |
| `eventos-2026.csv` | eventos_2026 |
| `votacoes-2026.csv` | votacoes_2026 |
| `Ano-2026.csv` | Gastos_2026 |
| `votacoesVotos-2026.csv` | votacoesVotos_2026 |
| `votacoesOrientacoes-2026.csv` | votacoesOrientacoes_2026 |
| `votacoesObjetos-2026.csv` | votacoesObjetos_2026 + votacoesProposicoes_2026 |
| `proposicoesTemas-2026.csv` | proposicoesTemas_2026 |
| `proposicoesAutores-2026.csv` | proposicoesAutores |

## Executar o ETL

```bash
python -m src.main
```

O pipeline:
1. Lê cada CSV
2. Limpa e normaliza os dados
3. Remove duplicatas
4. Exporta CSVs limpos em `cleaned/`
5. Carrega no PostgreSQL via `COPY`
6. Mostra resumo final no terminal

### Saída esperada

```
============================================================
ETL — Câmara dos Deputados (Grupo 4)
============================================================
Schema: grupo4
Tabelas: 11

[1/11] deputados
  Lendo deputados.csv...
  39.124 linhas lidas
  ✓ 513 linhas carregadas no banco

...

RESUMO FINAL
  Tabela                              Status     Bruto      Limpo    Cargado    Tempo
  deputados                           ✓ ok          39.124        513        513     1.2s
  ...
============================================================
```

## Estrutura do Projeto

```
BDR/
├── tabelas/              ← CSVs brutos da API
├── cleaned/              ← CSVs limpos (gerados pelo ETL)
├── logs/                 ← Logs de execução
│
├── sql/
│   ├── index_suggestions.sql
│   ├── views_analiticas.sql
│   └── validation_queries.sql
│
├── src/
│   ├── __init__.py
│   ├── main.py           ← Pipeline principal
│   ├── db.py             ← Conexão PostgreSQL + COPY
│   ├── cleaning.py       ← Funções de limpeza
│   ├── loaders.py        ← Loader genérico
│   ├── mappings.py       ← Configuração de tabelas
│   └── utils.py          ← Logging + helpers
│
├── init.sql              ← Schema SQL (usado pelo Docker)
├── docker-compose.yml
├── requirements.txt
├── .env
└── README.md
```

## Queries de Validação

Após o ETL, execute as queries em `sql/validation_queries.sql` para verificar:
- Contagem de linhas por tabela
- Integridade referencial (FKs)
- Duplicatas

## Views Analíticas

As views em `sql/views_analiticas.sql` incluem:
- Gastos por deputado
- Gastos por partido e UF
- Resumo de votações
- Proposições por tema
- Presença em eventos

## Tecnologias

- Python 3.11+
- pandas
- psycopg2
- python-dotenv
- PostgreSQL 16
- Docker
