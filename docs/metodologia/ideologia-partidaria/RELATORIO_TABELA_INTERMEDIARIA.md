# Relatorio da tabela intermediaria - Bolognesi 2022

Data da etapa: 2026-06-25

## Fonte usada

- Base: `docs/metodologia/ideologia-partidaria/df_experts.csv`
- Codebook: `docs/metodologia/ideologia-partidaria/Codebook_experts.docx`
- Catalogo BDR: `catalogos/partidos.csv`
- Fonte registrada na tabela: `Bolognesi et al. 2026, expert survey 2018-2022`

## Inspecao tecnica

| Item | Resultado |
|---|---|
| Separador do `df_experts.csv` | `;` |
| Encoding lido | `utf-8-sig` |
| Total de linhas da base de experts | 1090 |
| Total de colunas da base de experts | 135 |
| Colunas `ideol_18_*` | 35 |
| Colunas `ideol_22_*` | 32 |
| Colunas `obj_*` | 67 |

As colunas `obj_18_*` e `obj_22_*` foram apenas conferidas estruturalmente e nao foram usadas para calcular score ideologico.

## Regra de calculo do score

- `score_2018`: media das respostas validas nas colunas `ideol_18_*` correspondentes.
- `score_2022`: media das respostas validas nas colunas `ideol_22_*` correspondentes.
- Celulas vazias foram tratadas como missing.
- O valor `0` foi preservado como resposta valida.
- Medianas e desvios-padrao foram calculados sobre respostas validas; o desvio-padrao usa a formula amostral.
- Scores, medianas e desvios foram arredondados para 3 casas decimais.
- `score_usado` = `score_2022`, quando houver score de 2022.

Para proxies de fusao, o score foi calculado por media simples dos scores dos componentes. O campo `n_respostas_*` soma as respostas validas dos componentes, e medianas/desvios de proxy usam media simples das estatisticas dos componentes.

## Motivo de usar 2022

A rodada principal para o BDR e 2022 porque o projeto analisa a 57a Legislatura, de 2023 a 2026. A rodada de 2018 foi mantida como informacao historica e de auditoria.

## Regra de faixas

| Intervalo do `score_usado` | Ideologia faixa | Campo ideologico |
|---:|---|---|
| 0.000 a 1.499 | Extrema esquerda | esquerda |
| 1.500 a 2.999 | Esquerda | esquerda |
| 3.000 a 4.499 | Centro-esquerda | esquerda |
| 4.500 a 5.499 | Centro | centro |
| 5.500 a 6.999 | Centro-direita | direita |
| 7.000 a 8.499 | Direita | direita |
| 8.500 a 10.000 | Extrema direita | direita |

## Partidos por tipo de match

| Tipo | Quantidade | Partidos |
|---|---:|---|
| direto | 16 | AVANTE, MDB, NOVO, PCDOB, PDT, PSB, PSD, PSDB, PSOL, PT, PV, REDE, UNIAO, PROS, PSC, PTB |
| equivalencia | 7 | CIDADANIA, PL, PODE, PP, REPUBLICANOS, SOLIDARIEDADE, PATRIOTA |
| proxy_fusao | 1 | PRD |
| sem_classificacao | 2 | MISSAO, ARENA |

Observacao: `UNIAO` usa match direto no `score_usado` de 2022, mas possui proxy historico em 2018 por media simples de DEM + PSL.

## Partidos com equivalencia

- CIDADANIA: PPS em 2018 e `cdd` em 2022.
- PL: PR como historico de 2018 e `pl` em 2022.
- PODE: `pode` em 2018 e `podemos` em 2022.
- PP: `progressistas` em 2018 e `progre` em 2022.
- REPUBLICANOS: PRB em 2018 e `rep` em 2022.
- SOLIDARIEDADE: `sdd`.
- PATRIOTA: `patri`.

## Partidos com proxy

- PRD: `score_2022` e `score_usado` por media simples de PTB + Patriota.
- UNIAO: proxy historico de 2018 por media simples de DEM + PSL; em 2022 usa coluna propria `ideol_22_uniao`.

## Partidos sem classificacao

- MISSAO: partido posterior a rodada de 2022 e ausente na base.
- ARENA: partido historico fora da base utilizada.

## Validacoes executadas

- O CSV final contem todos os partidos de `catalogos/partidos.csv`.
- Nenhum partido do catalogo desapareceu.
- Todo `score_usado` preenchido esta entre 0 e 10.
- Partidos sem `score_usado` nao possuem `ideologia_faixa` nem `campo_ideologico`.
- Partidos com `score_usado` possuem `ideologia_faixa` e `campo_ideologico`.
- O arquivo foi salvo com separador `;` e encoding UTF-8.

## Proximos passos

1. Revisar e aprovar a tabela de equivalencias e proxies, especialmente PRD.
2. Decidir se `score_usado` deve permanecer como media ou se a mediana sera preferida para reduzir sensibilidade a respostas extremas.
3. Revisar MISSAO e ARENA para decidir se permanecem sem classificacao ou se receberao regra externa/manual.
4. Depois da aprovacao metodologica, atualizar `catalogos/partidos.csv` ou a camada que alimenta `partidos_ideologia` em uma etapa separada.
5. Validar os impactos nas questoes Q9, Q10 e Q11.
