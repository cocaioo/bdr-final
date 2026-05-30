# Estrutura do Banco

## Visao geral

- Banco PostgreSQL 16 em container.
- Schema `grupo4` isola os dados do projeto.
- Modelo separado por entidade para reduzir repeticao.
- Dados multi-ano ficam na mesma tabela com `ano_dados`.
- Cada tabela agrega todos os anos da mesma entidade (ex.: `gastos` junta todos os `Ano-*.csv`).
- Nao ha mistura de entidades diferentes na mesma tabela.

## Tabelas e papeis

- `deputados`: cadastro base e chave para cruzamentos.
- `partidos_ideologia`: dicionario de siglas e ideologias.
- `proposicoes`, `eventos`, `votacoes`: fatos legislativos por ano.
- `gastos`: despesas detalhadas por deputado e ano.
- `votacoes_votos` e `votacoes_orientacoes`: votos individuais e orientacao partidaria.
- `votacoes_objetos`: objetos de votacao e vinculo com proposicoes.
- `proposicoes_temas`: temas e relevancia por proposicao.
- `eventos_presenca_deputados`: presencas em eventos oficiais.
- `proposicoes_autores`: autoria, tipo de autor e peso de assinatura.

## Chaves e integridade

- `proposicoes`, `eventos`, `votacoes` usam chave composta `ano_dados` + id.
- `gastos`, `votacoes_objetos`, `proposicoes_autores` usam `identity` para carga simples.
- FKs ligam `gastos`, `votacoes_votos` e `eventos_presenca_deputados` a `deputados`.
- Outras relacoes usam ids logicos sem FK para nao travar a carga quando algum dado falta.
- `ON DELETE RESTRICT` protege o historico de despesas e votos.

## Performance e consultas

- Indices em `ano_dados`, `id_deputado`, `sigla_partido`, `sigla_uf` e `id_votacao`.
- Indices extras cobrem buscas por proposicao, tema e presenca.
- O foco e acelerar agregacoes por deputado, partido, ano e votacao.

## Views de compatibilidade

- Views como `proposicoes_2026`, `eventos_2026`, `votacoes_2026` e `gastos_2026`.
- Elas apontam para as tabelas multi-ano com filtro em `ano_dados`.
- Isso mantem consultas antigas sem duplicar tabelas.
