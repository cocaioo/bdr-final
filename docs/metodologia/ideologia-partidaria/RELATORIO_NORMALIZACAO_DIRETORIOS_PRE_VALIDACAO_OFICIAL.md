# Relatorio de Normalizacao de Diretorios — Pre-Validacao Oficial

Data: 2026-06-25

## 1. Diretorio oficial

`docs/metodologia/ideologia-partidaria/`

## 2. Pastas encontradas

| Pasta | Estado | Acao |
|-------|--------|------|
| `docs/metodologia/ideologia-partidaria/` | Diretorio oficial, com todos os arquivos | Mantido como esta |
| `docs/metodologia/ideologia_partidaria/` | Obsoleto, contem apenas `README.md` | Mantido com README de redirecionamento |

A consolidacao dos arquivos da pasta com underscore para a pasta oficial ja havia sido realizada em sessao anterior (documentada em `RELATORIO_SANEAMENTO_DIRETORIOS_E_VALIDACAO_V2.md`).

## 3. Arquivos no diretorio oficial

### Dados e fontes

| Arquivo | Descricao |
|---------|-----------|
| `df_experts.csv` | Dados brutos da expert survey Bolognesi et al. |
| `Codebook_experts.docx` | Codebook da pesquisa com especialistas |
| `1807-0191-op-31-e31120.pdf` | Artigo academico de referencia |
| `download.pdf` | PDF complementar |
| `partidos_ideologia_bolognesi_2022.csv` | Tabela v1 (25 partidos, classificacao inicial) |
| `partidos_ideologia_bolognesi_2022_v2.csv` | Tabela v2 (25 partidos, classificacao final com scores e faixas) |
| `fontes_complementares_ideologia.csv` | Fontes complementares usadas para MISSAO |
| `partidos_aliases_normalizacao.csv` | Mapeamento de aliases aprovados |
| `partidos_normalizacao_revisada.csv` | Revisao de normalizacao com decisoes finais |
| `impacto_siglas_historicas_aliases.csv` | Analise de impacto das siglas historicas |
| `universo_partidario_bdr_auditoria.csv` | Auditoria completa do universo partidario |

### Relatorios

| Arquivo | Descricao |
|---------|-----------|
| `RELATORIO_INSPECAO_IDEOLOGIA.md` | Inspecao inicial da metodologia existente |
| `RELATORIO_INTEGRACAO_CATALOGO_ETL.md` | Integracao do catalogo e ETL (Fase 1) |
| `RELATORIO_NORMALIZACAO_ALIAS_SUCESSOES.md` | Decisoes sobre aliases e sucessoes |
| `RELATORIO_REGENERACAO_Q9_Q10_Q11.md` | Regeneracao preliminar via pandas (Fase 3) |
| `RELATORIO_REVISAO_UNIVERSO_PARTIDARIO.md` | Revisao do universo partidario |
| `RELATORIO_SANEAMENTO_DIRETORIOS_E_VALIDACAO_V2.md` | Saneamento de diretorios (sessao anterior) |
| `RELATORIO_TABELA_INTERMEDIARIA.md` | Tabela intermediaria v1 |
| `RELATORIO_TABELA_INTERMEDIARIA_V2.md` | Tabela intermediaria v2 |
| `RELATORIO_VALIDACAO_OPERACIONAL_IDEOLOGIA.md` | Validacao operacional (Fase 2) |

## 4. Arquivos duplicados

Nenhum. Todos os arquivos existem apenas no diretorio oficial. A pasta `ideologia_partidaria/` contem apenas o README.md de redirecionamento.

## 5. Referencias internas atualizadas

Busca por `ideologia_partidaria` (underscore) em `*.md`, `*.py`, `*.sql`, `*.csv` nos diretorios `src/`, `JF/`, `catalogos/`, `docs/`:

- **Codigo-fonte (src/, JF/, catalogos/)**: nenhuma referencia ao caminho antigo.
- **Relatorios (docs/)**: unica referencia e no `RELATORIO_SANEAMENTO_DIRETORIOS_E_VALIDACAO_V2.md`, que documenta historicamente a migracao. Referencia preservada como registro historico.

## 6. Estado da pasta obsoleta

`docs/metodologia/ideologia_partidaria/` contem apenas `README.md` informando:
- Que o diretorio esta obsoleto.
- Que o caminho oficial e `docs/metodologia/ideologia-partidaria/`.
- Que nao se deve criar novos arquivos nela.

## 7. Pendencias

Nenhuma. Diretorios ja estavam normalizados de sessao anterior. Confirmacao realizada antes de prosseguir para ETL/PostgreSQL.
