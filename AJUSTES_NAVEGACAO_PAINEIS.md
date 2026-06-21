# Ajustes da navegação por painéis

## O que mudou

A Home e o Header passaram a apresentar módulos analíticos, em vez de uma lista de questões numeradas. Foram removidos da navegação principal o menu Q1–Q13, o expansor de questões individuais e todos os links visíveis para `/q/q1`, `/q/q2` e demais páginas técnicas.

A pesquisa por deputado foi mantida na Home porque leva a um perfil parlamentar, não a uma questão isolada.

## Painéis disponíveis na navegação

- **Gastos parlamentares** — rota `/grupos/gastos`, com o painel consolidado já disponível.
- **Escolaridade e perfil dos deputados** — rota `/grupos/perfil`, com o painel consolidado já disponível.
- **Produção legislativa** — rota `/grupos/producao-legislativa`, atualmente com uma página de entrada enquanto a composição integrada é consolidada.
- **Partidos e votações** — rota `/grupos/partidos-votacoes`, atualmente com uma página de entrada enquanto a composição integrada é consolidada.

## Mapeamento das análises antigas

| Análises internas | Painel correspondente |
|---|---|
| Q1, Q5, Q7, Q12 e Q13 | Gastos parlamentares |
| Q4 e Q6 | Escolaridade e perfil dos deputados |
| Q2, Q3 e Q8 | Produção legislativa |
| Q9, Q10 e Q11 | Partidos e votações |

Esse mapeamento orienta a consolidação futura e não altera contratos de dados.

## Compatibilidade mantida

A rota `/q/:questionId` continua registrada e funcional. Os endpoints `/api/questions/{question_id}`, o registry, os adapters e os arquivos das questões não foram removidos ou alterados.

As rotas antigas podem ser acessadas diretamente por URL, por exemplo `/q/q1`, para testes, auditoria e compatibilidade técnica. Elas não são anunciadas na Home nem no Header.

## Decisões para reduzir risco

1. As rotas antigas foram mantidas em vez de redirecionadas, evitando quebrar links técnicos, testes e fluxos de auditoria.
2. Os dois painéis já consolidados não tiveram sua lógica interna modificada.
3. Os dois módulos ainda em consolidação receberam rotas próprias e páginas informativas, sem reutilizar telas isoladas como se fossem painéis completos.
4. Nenhum endpoint, adapter, dado, SQL, ETL ou artefato foi alterado.
