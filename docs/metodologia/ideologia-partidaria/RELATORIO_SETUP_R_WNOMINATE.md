# Relatório — Setup do Ambiente R para W-NOMINATE

**Etapa:** validação do ambiente R local e preparação da execução do W-NOMINATE.
**Status:** ✅ **Ambiente validado — pronto para executar o W-NOMINATE.**
**Data:** 2026-06-26

---

## 1. Versões do R

| Item | Versão |
|------|--------|
| R | 4.6.0 (2026-04-24 ucrt) |
| Rscript | 4.6.0 (2026-04-24) |
| Plataforma | x86_64-w64-mingw32 (Windows 64-bit) |

R e Rscript estão instalados e acessíveis pelo PATH do usuário
(`C:\Program Files\R\R-4.6.0\bin`). Observação: no PowerShell, `R` sozinho colide
com o atalho `Invoke-History`; usar `R.exe` ou `Rscript`.

## 2. Pacotes R verificados/instalados

Instalados na **biblioteca de usuário** (gravável, sem necessidade de admin):
`C:/Users/Caio/AppData/Local/R/win-library/4.6`

| Pacote | Versão | Status |
|--------|--------|--------|
| `wnominate` | 1.5 | ✅ instalado e carregado |
| `pscl` | 1.5.9 | ✅ instalado e carregado |
| `dplyr` | 1.2.1 | ✅ instalado e carregado |
| `readr` | 2.2.0 | ✅ instalado e carregado |

## 3. Resultado do setup

`scripts/ideal_points/setup_r_packages.R` — **passou.** Todos os quatro pacotes
foram verificados, carregados e tiveram suas versões reportadas.

## 4. Resultado do smoke test

`scripts/ideal_points/smoke_test_wnominate.R` — **passou.** O teste, sem usar os
dados do BDR:

- carregou `wnominate` e `pscl`;
- confirmou a disponibilidade de `pscl::rollcall` e `wnominate::wnominate`;
- construiu um objeto `rollcall` sintético (dados artificiais);
- executou o `wnominate` de ponta a ponta sobre esses dados;
- imprimiu a mensagem de sucesso.

**Teste adicional (`readr` + `dplyr`):** escrita/leitura de um CSV temporário e
transformação dos dados — funcionou corretamente.

## 5. Arquivos da matriz encontrados

Os três arquivos exigidos existem em `dados_processados/ideal_points/` e **não
foram modificados**:

| Arquivo | Tamanho |
|---------|---------|
| `votes_matrix_filtered.csv` | 2.088.332 bytes |
| `votes_metadata.csv` | 135.869 bytes |
| `deputies_metadata.csv` | 25.213 bytes |

## 6. Prontidão para o W-NOMINATE

**O projeto está PRONTO para executar o W-NOMINATE.** Estão satisfeitos:

- R/Rscript 4.6.0 no PATH;
- `wnominate`, `pscl`, `dplyr`, `readr` instalados e carregáveis;
- pipeline `rollcall` → `wnominate` validado com dados sintéticos;
- matriz canônica filtrada e metadados presentes e íntegros.

A execução real (`run_wnominate.R` sobre `votes_matrix_filtered.csv`) é a próxima
etapa e **não** faz parte deste passo.

## 7. Problemas encontrados (e resolução)

- **Biblioteca padrão não gravável.** A instalação inicial falhou porque o R
  tentava gravar em `C:/Program Files/R/R-4.6.0/library`, protegido pelo Windows
  (requer admin). **Resolução:** uso da biblioteca de usuário
  `C:/Users/Caio/AppData/Local/R/win-library/4.6`, gravável sem privilégios
  elevados. O `setup_r_packages.R` foi atualizado para criar/usar essa biblioteca
  de usuário automaticamente e instalar nela, evitando a recorrência do problema.
- **Sem outros problemas.** Setup, smoke test e teste adicional passaram.

## 8. Arquivos relevantes

```
scripts/ideal_points/
├── setup_r_packages.R        # verifica/instala pacotes (usa biblioteca de usuário)
├── smoke_test_wnominate.R    # smoke test sintético (sem dados do BDR)
├── run_wnominate.R           # PRÓXIMA etapa (não executada aqui)
├── config.py
├── prepare_votes_matrix.py
└── README.md

dados_processados/ideal_points/
├── votes_matrix_filtered.csv
├── votes_metadata.csv
└── deputies_metadata.csv
```
