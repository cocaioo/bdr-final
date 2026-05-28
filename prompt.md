# Prompt para CODEX: Implementar nuvens de eixos temáticos (Q2)

## Objetivo

- Substituir as nuvens de palavras da questão 2 para usar os próprios eixos temáticos (cada eixo = "palavra"), com tamanho proporcional à quantidade de proposições; gerar nuvens por ano e consolidado (2023–2026).
- Gerar tabela CSV/JSON com contagem de proposições por eixo por ano que embasa as nuvens.
- Reaproveitar o consumo do front-end (não alterar contratos/rotas); apenas trocar artefatos/imagens geradas.

## Entradas de dados

- Fonte primária: arquivos em `tabelas/2023/`, `tabelas/2024/`, `tabelas/2025/`, `tabelas/2026/` ou `tabelas/` agregadas. Alternativa: `dados_padronizados/proposicoes.csv` se presente.
- Validar/usar campo `eixo` (ou mapear usando a lógica atual em `dashboard/scripts/generate_q2_artifacts.py` ou `src/enrichment.py`).

## Tarefas (prioridade alta)

- **Script de processamento:** Atualizar/criar `dashboard/scripts/generate_q2_artifacts.py` para:
	- Agrupar por `year` e `eixo` e salvar `artifacts/q2/eixos_counts_by_year.csv` (`year,eixo,count`).
	- Gerar `artifacts/q2/eixos_consolidado.csv` (`eixo,count`) e versões JSON.
- **Geração de nuvens:** No mesmo script:
	- Gerar imagens: `artifacts/q2/nuvem_2023.png`, `artifacts/q2/nuvem_2024.png`, ..., `artifacts/q2/nuvem_consolidado.png`.
	- Cada nuvem: eixos como palavras; `count` como peso. Usar `wordcloud`/`matplotlib` (ou libs já no `dashboard/backend/requirements.txt`).
	- Aceitar flags: `--years 2023,2024` e `--all`.
- **Integração com front-end/assets:**
	- Não alterar rotas; gravar imagens no local consumido pelo front-end (se conhecido) ou em `artifacts/q2/`. Incluir instrução clara para copiar/servir caso o front-end espere outro caminho.
- **Documentação/validação:**
	- Atualizar `docs/Dashboard-Fluxo-Dados.md` ou `dashboard/README.md` com comandos e localização dos artefatos.
	- Script deve imprimir as top-10 contagens e verificar soma total de proposições lidas.

## Exemplo de trechos (colar no script)

```python
# Agrupamento com pandas
import pandas as pd
df = pd.read_csv('tabelas/proposicoes.csv')  # path adaptável
df['year'] = pd.to_datetime(df['data']).dt.year
counts = df.groupby(['year','eixo']).size().reset_index(name='count')
counts.to_csv('artifacts/q2/eixos_counts_by_year.csv', index=False)

# Word cloud
from wordcloud import WordCloud
df_year = counts[counts['year']==2023]
freqs = dict(zip(df_year['eixo'], df_year['count']))
wc = WordCloud(background_color='white', width=800, height=600).generate_from_frequencies(freqs)
wc.to_file('artifacts/q2/nuvem_2023.png')
```

## Critérios de aceitação

- Existem `artifacts/q2/eixos_counts_by_year.csv` e `artifacts/q2/eixos_consolidado.csv`.
- Imagens `artifacts/q2/nuvem_<year>.png` para cada ano solicitado e `nuvem_consolidado.png`.
- Contagens nos CSVs batem com os números mostrados em `respostas/q2_eixos_nuvem_palavras.txt` (ou divergências documentadas).
- Front-end não precisa de mudanças de rota; ao colocar as imagens no local esperado, elas são exibidas.

## Entregáveis no PR

- Novo/atualizado `dashboard/scripts/generate_q2_artifacts.py`.
- Instruções de uso e localização dos artefatos em `docs/Dashboard-Fluxo-Dados.md` ou `dashboard/README.md`.
- Recomenda-se adicionar `wordcloud` ao `dashboard/backend/requirements.txt` se não existir.

## Restrições/observações

- Não modificar contratos API do front-end sem aviso.
- Se o mapping de `eixo` não existir nos CSVs, reaplicar a lógica presente em `src/enrichment.py` ou no script original.
- Preferir bibliotecas já listadas em `dashboard/backend/requirements.txt`; caso contrário, atualizar o `requirements.txt`.

---

Cole isto no CODEX para gerar a implementação automática.

