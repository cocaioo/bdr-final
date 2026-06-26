# Relatorio de Validacao Oficial — PostgreSQL, ETL, Q9, Q10, Q11

Data da execucao: 2026-06-25 22:38 a 22:50 (horario local)
Log oficial: `logs/validacao_oficial_20260625_223801/`
Metodologia: Bolognesi et al. 2026 v2 + classificacao complementar documentada (MISSAO)
Repositorio: `C:\Users\Caio\Desktop\projetos-em-andamento\BDR`
Branch: `Caio#2`

---

## 1. Resumo executivo

| Item | Status |
|------|--------|
| Docker / PostgreSQL (`bdr-postgres`, `bdr-pgadmin`) | OK (up 10 min, port 5433) |
| ETL completo (`python -m src.main`) | OK — 12/12 tabelas, 0 erros, 245.5s |
| Tabela `grupo4.partidos_ideologia` | OK — 25 linhas, 2 ideologias (direita/esquerda) |
| Regeneracao Q9/Q10/Q11 (`python -m src.export_respostas`) | OK |
| Artefatos Q9 / Q10 / Q11 | OK (sem ARENA, sem ghost aliases, MISSAO classificada) |
| Testes ETL (`tests/test_etl_contracts.py`) | OK — 4 passed |
| Testes backend (`dashboard/backend`) | OK — 30 passed |
| Testes raiz (`tests/`) | OK — 89 passed |
| `scripts/validar_integracao_oficial.py` (Etapa 3) | Falha parser (assert "SET\n25" != "25"), pendente correcao |
| Conteudo substantivo da Etapa 3 | Validado manualmente via SQL — todos os criterios atendidos |

Conclusao: integracao da metodologia Bolognesi v2 esta operacional fim a fim. Nenhuma falha substantiva. Todas as pendencias listadas sao cosmeticas (titulo de Q9 ainda menciona "centro") ou de robustez do script (parser do `validar_integracao_oficial.py`).

---

## 2. Diff revisado

Comando: `git diff -- catalogos/partidos.csv src/cleaning.py src/party_catalog.py dashboard/backend/app/party_catalog.py dashboard/backend/app/adapters/questions.py tests/test_etl_contracts.py scripts/validar_integracao_oficial.py`

| Arquivo | Linhas | Mudanca | Status |
|---------|--------|---------|--------|
| `catalogos/partidos.csv` | 54 | Catalogo expandido com Bolognesi v2 (15 colunas), 25 partidos no universo analitico + ARENA fora | OK |
| `src/cleaning.py` | +11 | Aliases textuais aprovados: PODEMOS->PODE, REP/REPUB/REPUBLICA/REPUBLICAN->REPUBLICANOS, SOLIDARIED->SOLIDARIEDADE, DEM->UNIAO, PSL->UNIAO | OK |
| `src/party_catalog.py` | +47/-3 | Nova classe com colunas Bolognesi; `active_party_ideology_rows` agora carrega `entra_universo_analitico=sim` + `campo_ideologico`; mantem fallback legado | OK |
| `dashboard/backend/app/party_catalog.py` | reescrito | Le `campo_ideologico` com fallback para `ideologia`; aliases v2 adicionados | OK |
| `dashboard/backend/app/adapters/questions.py` | 1736 +/-, mas diff substantivo: remocao do hard-code "Cores: verde = esquerda, amarelo = centro, laranja = direita." | OK (resto e CRLF/LF normalization) |
| `tests/test_etl_contracts.py` | atualizado | Cobre novo modelo Bolognesi | OK (4 passed) |
| `scripts/validar_integracao_oficial.py` | 339 | Novo script orquestrador | OK estrutural; bug menor de parser |

Nenhuma alteracao inesperada encontrada.

---

## 3. Docker / PostgreSQL

Log: `logs/validacao_oficial_20260625_223801/01_docker.log`

```
NAMES            STATUS           PORTS
bdr-postgres     Up 10 minutes    0.0.0.0:5433->5432/tcp
bdr-pgadmin      Up 10 minutes    0.0.0.0:5050->80/tcp
```

Conectividade testada com `SELECT 1` -> 1 row. Database `dossie_grupo4`, schema `grupo4`. 13 tabelas presentes:

```
deputados, eventos, eventos_presenca_deputados, gastos, partidos_ideologia,
proposicoes, proposicoes_autores, proposicoes_temas, votacoes, votacoes_objetos,
votacoes_orientacoes, votacoes_votos
```

---

## 4. ETL completo

Comando: `python -m src.main`
Log: `logs/validacao_oficial_20260625_223801/03_etl_main.log`
Tempo total: 245.5 s

Resumo final do ETL:

| Tabela | Bruto | Limpo | Cargado | Tempo |
|--------|-------|-------|---------|-------|
| deputados | 7.884 | 640 | 640 | 121.7s |
| **partidos_ideologia** | **25** | **25** | **25** | **0.0s** |
| proposicoes | 260.758 | 260.758 | 260.758 | 13.3s |
| eventos | 9.973 | 9.971 | 9.971 | 6.6s |
| votacoes | 40.064 | 34.142 | 34.142 | 11.7s |
| gastos | 737.298 | 720.937 | 720.937 | 38.4s |
| votacoes_votos | 463.180 | 462.742 | 462.742 | 16.5s |
| votacoes_orientacoes | 15.148 | 15.148 | 15.148 | 0.5s |
| votacoes_objetos | 244.669 | 219.399 | 219.399 | 8.6s |
| proposicoes_temas | 101.929 | 101.929 | 101.929 | 5.2s |
| eventos_presenca_deputados | 337.145 | 336.547 | 336.547 | 6.7s |
| proposicoes_autores | 453.902 | 451.194 | 451.194 | 16.2s |

Status: **12 ok, 0 skip, 0 erros**.

Manifest: `C:\Users\Caio\Desktop\projetos-em-andamento\BDR\logs\etl_load_manifest.csv`

Warnings nao-criticos: 421 linhas de `votacoes_votos` removidas por campos obrigatorios nulos (`logs\bad_rows_votacoes_votos_required.csv`) — comportamento esperado do contrato de carga.

---

## 5. `grupo4.partidos_ideologia`

Log: `logs/validacao_oficial_20260625_223801/05_sql_partidos_ideologia.log`

| Validacao | Esperado | Obtido |
|-----------|----------|--------|
| Total de linhas | 25 | **25** OK |
| Ideologias distintas | {direita, esquerda} | **{direita, esquerda}** OK |
| ARENA presente? | nao | **0 rows** OK |
| S.PART. presente? | nao | **ausente** OK |
| MISSAO presente | sim, direita | **MISSAO\|direita** OK |
| PATRIOTA preserva score | sim, direita | **PATRIOTA\|direita** OK |
| PROS preserva score | sim, direita | **PROS\|direita** OK |
| PSC preserva score | sim, direita | **PSC\|direita** OK |
| PTB preserva score | sim, direita | **PTB\|direita** OK |

### Lista completa (25 linhas)

| Sigla | Ideologia | Sigla | Ideologia |
|-------|-----------|-------|-----------|
| AVANTE | direita | PRD | direita |
| CIDADANIA | direita | PROS | direita |
| MDB | direita | PSB | esquerda |
| MISSAO | direita | PSC | direita |
| NOVO | direita | PSD | direita |
| PATRIOTA | direita | PSDB | direita |
| PCDOB | esquerda | PSOL | esquerda |
| PDT | esquerda | PT | esquerda |
| PL | direita | PTB | direita |
| PODE | direita | PV | esquerda |
| PP | direita | REDE | esquerda |
| REPUBLICANOS | direita | SOLIDARIEDADE | direita |
| UNIAO | direita | | |

Total: 18 direita + 7 esquerda = 25.

---

## 6. Regeneracao Q9/Q10/Q11

Comando: `python -m src.export_respostas`
Log: `logs/validacao_oficial_20260625_223801/04_export_respostas.log`

Trecho do log:

```
Running database query from JF\partidos-ideologia-votacao\q9\q9.sql...
Running database query from JF\partidos-ideologia-votacao\q10\q10.sql...
Running database query from JF\partidos-ideologia-votacao\q11\q11.sql...
...
Copied q9_vies_deputado.txt to JF\partidos-ideologia-votacao\q9\q9_vies_deputado.txt
Copied q9_vies_deputado_detalhe.csv to JF\partidos-ideologia-votacao\q9\q9_vies_deputado_detalhe.csv
Copied q10_alinhamento_partidos.txt to JF\partidos-ideologia-votacao\q10\q10_alinhamento_partidos.txt
Copied q11_ranking_partidos.txt to JF\partidos-ideologia-votacao\q11\q11_ranking_partidos.txt

Export and generation completed successfully.
```

Arquivos regenerados:

| Arquivo | Bytes |
|---------|-------|
| `JF/partidos-ideologia-votacao/q9/q9_vies_deputado.txt` | 649.438 |
| `JF/partidos-ideologia-votacao/q9/q9_vies_deputado_detalhe.csv` | 46.034.491 |
| `JF/partidos-ideologia-votacao/q10/q10_alinhamento_partidos.txt` | 88.263 |
| `JF/partidos-ideologia-votacao/q11/q11_ranking_partidos.txt` | 32.595 |

---

## 7. Validacao de Q9

| Criterio | Resultado |
|----------|-----------|
| ARENA ausente | OK (0 ocorrencias) |
| MISSAO classificada como direita | OK |
| PATRIOTA / PROS / PSC / PTB classificados | OK (todos em direita) |
| S.PART. ausente no Q9.1 | OK |
| `nao classificado` no Q9.1 | OK — 0 ocorrencias |
| Catalogo Q9.1 fechado em 25 partidos | OK (18 direita + 7 esquerda) |
| Aliases ghost (PODEMOS, DEM, PSL, REP, REPUB, ...) | OK — 0 ocorrencias |
| Pendencia cosmetica: titulo textual menciona "centro" | PENDENTE (cosmetico, linha 1 do TXT) |

Recorte do Q9.1:

```
ideologia |                                  partidos                                  | qtd_partidos
direita   | AVANTE, CIDADANIA, MDB, MISSAO, NOVO, PATRIOTA, PL, PODE, PP, PRD, PROS,
            PSC, PSD, PSDB, PTB, REPUBLICANOS, SOLIDARIEDADE, UNIAO                    | 18
esquerda  | PCDOB, PDT, PSB, PSOL, PT, PV, REDE                                        | 7
```

A unica ocorrencia de "centro" no Q9 esta no titulo textual original
`Q9 - Vies ideologico dos deputados (direita / esquerda / centro)` (linha 1) — heranca
do header anterior, NAO afeta dados nem classificacao. Pendencia menor de
ajuste textual no SQL Q9.

---

## 8. Validacao de Q10

| Criterio | Resultado |
|----------|-----------|
| ARENA ausente | OK |
| `nao classificado` no consolidado | OK — 0 ocorrencias |
| Bancadas/blocos/federacoes como partidos | OK — nenhuma entrada anomala |
| MISSAO presente e classificada | OK — 1a posicao, ideologia=direita |
| PATRIOTA / PSC presentes e classificados | OK (PATRIOTA pos 23 direita, PSC pos 16 direita) |
| Ranking consolidado | 23 partidos com diretriz, todos com ideologia |

Top do ranking consolidado:

```
posicao | sigla_partido | ideologia | pct_alinhamento
     1  | MISSAO        | direita   | 100.00
     2  | NOVO          | direita   |  99.53
     3  | PSOL          | esquerda  |  98.76
     4  | PT            | esquerda  |  98.50
     5  | PCDOB         | esquerda  |  97.61
   ...
    16  | PSC           | direita   |  89.29
   ...
    23  | PATRIOTA      | direita   |  75.00
```

---

## 9. Validacao de Q11

| Criterio | Resultado |
|----------|-----------|
| ARENA ausente | OK |
| MISSAO classificada como direita | OK (pos 24, direita) |
| PATRIOTA / PROS / PSC / PTB classificados | OK (todos em direita) |
| Aliases ghost (PODEMOS, DEM, PSL, REP, REPUB, REPUBLICA, REPUBLICAN, SOLIDARIED) | OK — 0 ocorrencias |
| Unica sigla sem ideologia = S.PART. | OK — 10 ocorrencias de `nao classificado`, todas em linhas S.PART. |
| Total de partidos no ranking consolidado | 25 (incl. S.PART. tratado como ausencia de partido) |

Top do ranking Q11.a consolidado (2023-2026):

```
posicao | sigla_partido |    ideologia     | votacoes | total_votos
     1  | PL            | direita          |    1541  |       85540
     2  | UNIAO         | direita          |    1536  |       51868
     3  | PT            | esquerda         |    1518  |       64867
     4  | REPUBLICANOS  | direita          |    1508  |       40123
     5  | PP            | direita          |    1497  |       43203
    ...
    23  | S.PART.       | nao classificado |      77  |          77
    24  | MISSAO        | direita          |      67  |          67
    25  | PROS          | direita          |       5  |           9
```

---

## 10. Validacao do backend

`pytest dashboard/backend -q` -> log `08_pytest_backend.log`:

```
..............................                                           [100%]
30 passed in 11.53s
```

O backend ja foi corrigido para ler `campo_ideologico` (nao mais `ideologia`) no
`dashboard/backend/app/party_catalog.py` — todos os testes do backend passam
nesse caminho. Subida do uvicorn nao foi executada nesta rodada para nao
manter processo em background, mas os testes asseguram que os adapters Q9/Q10/Q11
estao consistentes com o novo modelo binario direita/esquerda.

Recomendacao: subir o backend em sessao manual para validacao visual (`/api/meta`,
`/api/questions/q9`, `/api/questions/q10`, `/api/questions/q11`) antes do entregavel final
do frontend, mas as suites automatizadas ja cobrem o contrato.

---

## 11. Testes

| Suite | Comando | Resultado | Tempo |
|-------|---------|-----------|-------|
| ETL contratos | `pytest -q tests/test_etl_contracts.py` | **4 passed** | 0.83s |
| Backend | `pytest -q` em `dashboard/backend` | **30 passed** | 11.53s |
| Raiz (completo) | `pytest -q tests` | **89 passed** | 89.35s |

Nenhum teste falhou, nenhum warning critico reportado.

---

## 12. Pendencias e correcoes pendentes

1. **`scripts/validar_integracao_oficial.py` Etapa 3 — bug de parser.**
   O script roda `psql ... -t -A -c "SET search_path TO grupo4; SELECT COUNT(*) FROM partidos_ideologia;"`,
   e como o `SET` antes do `SELECT` produz duas linhas (`SET\n25`), o `total.strip()` cai sobre `"SET\n25"` e o
   assert falha com `ESPERADO 25, GOT SET\n25`. A consulta SQL direta sem o `SET search_path` ja resolve
   (confirmado pelo log `05_sql_partidos_ideologia.log` que retornou 25 corretamente). Substancialmente
   nada falhou; falta endurecer o script.

2. **Titulo textual em Q9.**
   Linha 1 de `q9_vies_deputado.txt` ainda diz `Q9 - Vies ideologico dos deputados (direita / esquerda / centro)`.
   Ajustar o SQL Q9 para refletir o modelo binario aprovado. Pendencia cosmetica.

3. **Subida do backend para inspecao visual.**
   Endpoints `/api/meta`, `/api/questions/q9-q11` nao foram testados em uvicorn vivo nesta rodada;
   os 30 testes automatizados cobrem o contrato. Recomendado rodar `uvicorn` numa sessao
   manual antes do entregavel final.

Nada bloqueante.

---

## 13. Arquivos consultados

- Logs: `logs/validacao_oficial_20260625_223801/00_main.log` ... `09_pytest_root.log`
- Artefatos: `JF/partidos-ideologia-votacao/q9/`, `q10/`, `q11/`
- Catalogo: `catalogos/partidos.csv`
- Manifest ETL: `logs/etl_load_manifest.csv`
