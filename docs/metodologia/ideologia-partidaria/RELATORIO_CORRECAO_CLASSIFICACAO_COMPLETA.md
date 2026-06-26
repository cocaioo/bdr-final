# Relatorio de correcao da classificacao ideologica completa

Data: 2026-06-25

## Erro identificado

A validacao oficial anterior carregou `grupo4.partidos_ideologia` apenas com a coluna legada `ideologia`, preenchida por duas categorias macro (`direita` e `esquerda`) derivadas de `campo_ideologico`.

Essa carga simplificou indevidamente a metodologia Bolognesi v2 e nao deve ser considerada final para Q9, Q10 ou Q11.

## Decisao de correcao

A tabela `partidos_ideologia` deve preservar a classificacao completa:

- `ideologia_score`
- `ideologia_faixa`
- `campo_ideologico`
- `fonte_ideologia`
- `ano_base_ideologia`
- `tipo_match_ideologia`
- `observacao_ideologia`

A coluna `ideologia` continua existindo apenas como compatibilidade temporaria e recebe o mesmo valor de `campo_ideologico`.

## Impacto nos artefatos

Os artefatos Q9/Q10/Q11 gerados na etapa binaria anterior nao sao finais. As consultas canonicas precisam preferir `ideologia_score`, `ideologia_faixa` e `campo_ideologico`, preservando a faixa de sete categorias quando disponivel.

`campo_ideologico` pode continuar existindo como agregacao macro (`esquerda`, `centro`, `direita`), mas nao pode ser a unica classificacao disponivel.

## Banco local

`Banco/init.sql` foi atualizado para o schema completo. Como esse arquivo so e aplicado automaticamente quando o volume Docker do PostgreSQL e recriado, ambientes com volume existente precisam recriar o banco ou aplicar `ALTER TABLE` manual antes de executar o ETL completo.
