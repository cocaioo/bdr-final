import { useState } from 'react'

// ---------------------------------------------------------------------------
// Collapsible SQL/code block
// ---------------------------------------------------------------------------
interface SqlBlockProps {
  title: string
  code: string
  language?: string
}

function SqlBlock({ title, code, language = 'sql' }: SqlBlockProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="method-sql-block">
      <button
        type="button"
        className="method-sql-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="method-sql-toggle__icon">{open ? '▾' : '▸'}</span>
        <span className="method-sql-toggle__label">
          {language === 'sql' ? '🗄 ' : '🐍 '}
          {title}
        </span>
        <span className="method-sql-toggle__hint">{open ? 'ocultar' : 'ver código'}</span>
      </button>
      {open && (
        <pre className="method-sql-pre">
          <code>{code.trim()}</code>
        </pre>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
interface SectionProps {
  num: string
  title: string
  sub?: string
  children: React.ReactNode
}

function Section({ num, title, sub, children }: SectionProps) {
  return (
    <section className="method-section stagger-item">
      <div className="method-section__head">
        <span aria-hidden="true">{num}</span>
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
      </div>
      <div className="method-section__body">{children}</div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Example table helper
// ---------------------------------------------------------------------------
interface ExTableProps {
  headers: string[]
  rows: (string | number)[][]
  caption?: string
}

function ExTable({ headers, rows, caption }: ExTableProps) {
  return (
    <div className="method-ex-table-wrap">
      <table className="method-ex-table">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function MethodologyPage() {
  return (
    <main className="methodology-page">

      {/* Hero */}
      <section className="parties-hero stagger-item">
        <span className="parties-eyebrow">Transparência analítica</span>
        <h1>Metodologia</h1>
        <p>
          Documentação completa das fontes de dados, processos de ETL, consultas SQL e decisões
          metodológicas que sustentam cada indicador exibido no painel. Use esta página para
          entender <em>como</em> os números são calculados, não apenas <em>o que</em> eles significam.
        </p>
      </section>

      {/* 01 — Visão geral */}
      <Section num="01" title="Visão geral do projeto" sub="O que este painel analisa e por que ele existe.">
        <p>
          O <strong>BDR Painéis Parlamentares</strong> é um dashboard analítico sobre a 57ª
          Legislatura da Câmara dos Deputados (2023–2026). Seu objetivo é tornar acessíveis —
          visual e metodologicamente — indicadores sobre gastos parlamentares, produção legislativa,
          perfil dos deputados e comportamento ideológico-partidário.
        </p>
        <p style={{ marginTop: 12 }}>
          O painel se divide em três grandes blocos temáticos:
        </p>
        <ul className="method-list">
          <li>
            <strong>Gastos e Fornecedores</strong> — como os deputados utilizam a cota parlamentar
            (CEAP): quanto gastam, em que categorias, com quais fornecedores e qual a relação custo-benefício.
          </li>
          <li>
            <strong>Escolaridade e Perfil</strong> — distribuição educacional da bancada;
            correlações entre escolaridade e comportamento legislativo.
          </li>
          <li>
            <strong>Partidos, Ideologia e Votação</strong> — classificação ideológica dos partidos,
            disciplina partidária, ranking de atuação e posição ideológica revelada pelo comportamento
            de voto (via W-NOMINATE).
          </li>
        </ul>
      </Section>

      {/* 02 — Fontes de dados */}
      <Section num="02" title="Fontes de dados" sub="De onde vêm os dados brutos.">
        <p>Todas as fontes são públicas e oficiais:</p>
        <ul className="method-list">
          <li>
            <strong>API de Dados Abertos da Câmara dos Deputados</strong>{' '}
            (<code>dadosabertos.camara.leg.br</code>) — deputados, proposições, votações nominais,
            orientações partidárias, gastos (CEAP), eventos e órgãos.
          </li>
          <li>
            <strong>Bolognesi, Babireski e Kosop (2022)</strong> — escores ideológicos de partidos
            em escala 0–10 (esquerda → direita), usados como referência para classificação e calibração.
          </li>
          <li>
            <strong>Artefatos analíticos locais</strong> — CSVs e TXTs gerados pelo pipeline ETL,
            versionados nas pastas <code>JF/</code> e <code>Caio/</code> do repositório.
          </li>
        </ul>
        <p style={{ marginTop: 12 }}>
          O período coberto é <strong>2023–2026</strong> (anos disponíveis na API até o momento
          da coleta de dados).
        </p>
      </Section>

      {/* 03 — ETL e limpeza */}
      <Section num="03" title="ETL e pipeline de limpeza de dados" sub="Como os dados brutos são transformados antes de entrar no banco.">
        <p>O processo de ETL (Extract, Transform, Load) é implementado em Python e segue as etapas:</p>
        <ol className="method-list">
          <li>
            <strong>Extração</strong> — coleta via requests paginadas à API REST da Câmara, com
            rate-limiting e retry automático. Cada recurso é salvo em JSON bruto antes de qualquer
            transformação.
          </li>
          <li>
            <strong>Normalização</strong> — datas convertidas para <code>DATE</code>/<code>TIMESTAMP</code>;
            valores monetários para <code>NUMERIC</code>; IDs para <code>INTEGER</code>.
            Campos de texto são limpos (strip, lowercase onde adequado).
          </li>
          <li>
            <strong>Deduplicação</strong> — registros duplicados de gastos são eliminados por
            chave composta <code>(id_deputado, data_documento, valor_liquido, cnpj_cpf_fornecedor)</code>.
          </li>
          <li>
            <strong>Join com ideologia</strong> — a tabela <code>partidos_ideologia</code> é
            populada com os escores Bolognesi; partidos sem match exato recebem match por prefixo,
            registrado em <code>tipo_match_ideologia</code>.
          </li>
          <li>
            <strong>Carga</strong> — dados normalizados são inseridos via COPY ou INSERT em lote;
            índices são criados após a carga.
          </li>
        </ol>
        <SqlBlock
          title="Schema principal — tabelas de votação (init.sql)"
          code={`CREATE TABLE votacoes_votos (
    ano_dados      INTEGER      NOT NULL,
    id_votacao     VARCHAR(80)  NOT NULL,
    id_deputado    INTEGER      NOT NULL,
    nome_deputado  VARCHAR(150),
    sigla_partido  TEXT,
    voto           TEXT,   -- 'Sim', 'Nao', 'Abstencao', 'Obstrucao', 'Artigo 17'
    PRIMARY KEY (ano_dados, id_votacao, id_deputado)
);

CREATE TABLE votacoes_orientacoes (
    ano_dados      INTEGER      NOT NULL,
    id_votacao     VARCHAR(80)  NOT NULL,
    sigla_bancada  TEXT         NOT NULL,
    orientacao     TEXT,   -- 'Sim', 'Nao', 'Liberado', 'Abstencao', 'Obstrucao'
    PRIMARY KEY (ano_dados, id_votacao, sigla_bancada)
);

CREATE TABLE partidos_ideologia (
    sigla_partido          TEXT PRIMARY KEY,
    ideologia_score        NUMERIC(5,3),  -- 0 (esquerda) a 10 (direita)
    ideologia_faixa        TEXT,
    campo_ideologico       TEXT,          -- 'esquerda' | 'centro' | 'direita'
    fonte_ideologia        TEXT,
    tipo_match_ideologia   TEXT
);`}
        />
      </Section>

      {/* 04 — Banco e datasets */}
      <Section num="04" title="Banco de dados e datasets padronizados" sub="Estrutura do PostgreSQL e artefatos analíticos versionados.">
        <p>
          Todos os dados são armazenados em um <strong>PostgreSQL 15 local</strong> (Docker), dentro
          do schema <code>grupo4</code>. As principais tabelas:
        </p>
        <ExTable
          caption="Tabelas principais do schema grupo4"
          headers={['Tabela', 'Conteúdo principal']}
          rows={[
            ['deputados', 'Cadastro dos parlamentares (id, nome, escolaridade, UF, partido)'],
            ['gastos', 'Registros de despesas CEAP por deputado (valor, categoria, fornecedor)'],
            ['proposicoes', 'Projetos de lei, requerimentos e demais proposições'],
            ['votacoes', 'Sessões de votação nominal (data, órgão, aprovação)'],
            ['votacoes_votos', 'Voto individual de cada deputado em cada votação'],
            ['votacoes_orientacoes', 'Orientação oficial da bancada por votação'],
            ['partidos_ideologia', 'Score ideológico Bolognesi por partido (0–10)'],
          ]}
        />
        <p style={{ marginTop: 14 }}>
          Para dados que exigem processamento estatístico offline (ex.: W-NOMINATE), o pipeline gera{' '}
          <strong>artefatos analíticos versionados</strong> (CSV/TXT). Esses arquivos são lidos
          diretamente pelo backend via <code>FileAdapter</code>, sem consulta SQL em tempo de requisição:
        </p>
        <ul className="method-list">
          <li><code>q14_ideal_points_deputados.csv</code> — um deputado por linha, com score W-NOMINATE e desvios</li>
          <li><code>q14_desvio_partido.csv</code> — resumo de desvio agregado por partido</li>
          <li><code>q14_desvio_bancada.csv</code> — coesão interna de cada bancada</li>
        </ul>
      </Section>

      {/* 05 — Stack tecnológica */}
      <Section num="05" title="Stack tecnológica" sub="Ferramentas e linguagens utilizadas no projeto.">
        <ExTable
          caption="Componentes da stack BDR Painéis Parlamentares"
          headers={['Camada', 'Tecnologia', 'Papel']}
          rows={[
            ['ETL', 'Python 3.11 + requests + pandas', 'Extração, transformação e carga dos dados'],
            ['Análise estatística', 'R (pacote wnominate)', 'Estimação de coordenadas ideológicas por W-NOMINATE'],
            ['Banco de dados', 'PostgreSQL 15 (Docker)', 'Armazenamento relacional dos dados operacionais'],
            ['Backend', 'FastAPI + Uvicorn', 'API REST; registry de perguntas e adaptadores de fonte'],
            ['Frontend', 'React 18 + Vite + TypeScript', 'Interface do usuário, roteamento e gerência de estado'],
            ['Visualizações', 'Apache ECharts', 'Gráficos interativos (scatter, bar, sankey, wordcloud)'],
            ['Artefatos', 'CSV / TXT via FileAdapter', 'Dados pré-computados offline (W-NOMINATE, nuvens de palavras)'],
            ['Infraestrutura', 'Docker Compose', 'PostgreSQL + volumes persistentes em ambiente local'],
            ['Testes backend', 'Pytest', 'Cobertura de contrato de API e lógica de serviço'],
            ['Testes frontend', 'Vitest + Playwright', 'Testes unitários e end-to-end do dashboard'],
          ]}
        />
      </Section>

      {/* 07 — Gastos */}
      <Section num="07" title="Gastos parlamentares (CEAP)" sub="Como os gastos são agregados, categorizados e ranqueados.">
        <p>
          A <strong>Cota para o Exercício da Atividade Parlamentar (CEAP)</strong> é um benefício
          mensal pago a cada deputado para custear despesas do mandato. Os dados são públicos e
          disponibilizados pela API da Câmara.
        </p>
        <ul className="method-list" style={{ marginTop: 10 }}>
          <li>
            <strong>Gasto total por deputado (Q1)</strong> — soma de <code>valor_liquido</code> de
            todos os registros do deputado no período.
          </li>
          <li>
            <strong>Gasto por categoria (Q13)</strong> — agrupamento por <code>descricao_tipo</code>
            (ex.: "Combustíveis", "Passagem aérea", "Telefonia").
          </li>
          <li>
            <strong>Fornecedores com maior total pago (Q5)</strong> — soma por CNPJ/CPF do
            fornecedor, com número de deputados atendidos.
          </li>
          <li>
            <strong>Índice custo-benefício (Q7)</strong> — razão entre produção legislativa e gasto
            total. Penaliza quem gasta muito e produz pouco.
          </li>
        </ul>
        <SqlBlock
          title="Q1 — Gasto total por deputado"
          code={`WITH gastos_totais AS (
    SELECT
        id_deputado,
        SUM(valor_liquido) AS gasto_total
    FROM gastos
    GROUP BY id_deputado
),
-- Partido e UF dominantes (mais frequentes nos registros de despesa)
perfil_dominante AS (
    SELECT DISTINCT ON (id_deputado)
        id_deputado,
        sigla_uf,
        sigla_partido
    FROM (
        SELECT
            id_deputado, sigla_uf, sigla_partido,
            COUNT(*) AS ocorrencias
        FROM gastos
        GROUP BY id_deputado, sigla_uf, sigla_partido
    ) ranked
    ORDER BY id_deputado, ocorrencias DESC
)
SELECT
    d.id_deputado,
    COALESCE(NULLIF(BTRIM(d.nome_civil), ''), d.nome) AS nome,
    p.sigla_uf,
    p.sigla_partido,
    gt.gasto_total
FROM gastos_totais gt
JOIN deputados d USING (id_deputado)
LEFT JOIN perfil_dominante p USING (id_deputado)
ORDER BY gasto_total DESC;`}
        />
      </Section>

      {/* 08 — Escolaridade */}
      <Section num="08" title="Escolaridade e perfil dos deputados" sub="Como o perfil educacional é extraído e correlacionado com desempenho.">
        <p>
          O campo <code>escolaridade</code> vem do cadastro da Câmara (endpoint de deputados).
          Os valores são normalizados em categorias padronizadas: "Ensino Fundamental", "Ensino
          Médio", "Ensino Superior", "Pós-Graduação" e "Não informado".
        </p>
        <p style={{ marginTop: 10 }}>
          <strong>Correlação escolaridade × desempenho (Q6)</strong>: para cada combinação de
          escolaridade e indicador (gasto médio, proposições, alinhamento partidário), calcula-se a
          média do grupo. As correlações são exploratórias — não implicam causalidade.
        </p>
        <SqlBlock
          title="Q4 — Distribuição da bancada por escolaridade"
          code={`SELECT
    COALESCE(d.escolaridade, 'Não informado') AS escolaridade,
    COUNT(DISTINCT d.id_deputado)             AS qtd_deputados
FROM deputados d
GROUP BY escolaridade
ORDER BY qtd_deputados DESC;`}
        />
      </Section>

      {/* 09 — Ideologia partidária */}
      <Section
        num="09"
        title="Classificação ideológica dos partidos"
        sub="A escala Bolognesi et al. e como ela é aplicada no dashboard."
      >
        <div className="method-callout">
          <strong>Referência acadêmica</strong>
          <p>
            BOLOGNESI, Bruno; BABIRESKI, Flávia; KOSOP, Roberto.{' '}
            <em>Classificação ideológica dos partidos políticos brasileiros</em>. Curitiba, 2022.
            Os autores produziram um índice partidário com base em: (1) posicionamento declarado
            nos estatutos e manifestos dos partidos, (2) surveys com especialistas em ciência
            política brasileira e (3) análise de coligações e alianças históricas. O score 0–10
            é publicado em escala linear e amplamente adotado em pesquisas de comportamento
            legislativo no Brasil. Este projeto usa os escores da edição mais recente disponível
            como referência canônica de classificação ideológica.
          </p>
        </div>

        <p style={{ marginTop: 14 }}>
          <strong>Faixas ideológicas</strong> utilizadas no dashboard:
        </p>
        <ExTable
          caption="Faixas ideológicas (adaptado de Bolognesi et al.)"
          headers={['Faixa', 'Intervalo de score', 'Campo macro']}
          rows={[
            ['Extrema esquerda', '0,0 – 2,0', 'esquerda'],
            ['Esquerda', '2,0 – 4,0', 'esquerda'],
            ['Centro-esquerda', '4,0 – 4,9', 'centro'],
            ['Centro', '4,9 – 5,1', 'centro'],
            ['Centro-direita', '5,1 – 6,0', 'centro'],
            ['Direita', '6,0 – 8,0', 'direita'],
            ['Extrema direita', '8,0 – 10,0', 'direita'],
          ]}
        />
        <p style={{ marginTop: 12 }}>
          Partidos sem match exato na base Bolognesi recebem match por prefixo ou sigla aproximada.
          A coluna <code>tipo_match_ideologia</code> registra o método (
          <code>exato</code>, <code>prefixo</code>, <code>manual</code>).
        </p>
        <SqlBlock
          title="Q9 — Catálogo de partidos por faixa ideológica"
          code={`SELECT
    ideologia_faixa,
    campo_ideologico,
    ROUND(AVG(ideologia_score), 3)                           AS score_medio,
    COUNT(*)                                                 AS qtd_partidos,
    string_agg(sigla_partido, ', ' ORDER BY sigla_partido)  AS partidos
FROM partidos_ideologia
GROUP BY ideologia_faixa, campo_ideologico
ORDER BY MIN(ideologia_score) NULLS LAST;`}
        />
      </Section>

      {/* 10 — Votações nominais e alinhamento */}
      <Section
        num="10"
        title="Votações nominais e alinhamento partidário"
        sub="O que são roll-call votes, como os votos são representados e como o alinhamento é calculado."
      >
        <h3 className="method-subhead">O que são votações nominais (roll-call votes)?</h3>
        <p>
          Uma <strong>votação nominal</strong> é qualquer votação plenária em que o voto de cada
          deputado é registrado individualmente e tornado público. Na Câmara dos Deputados, a maioria
          das votações importantes é nominal — ao contrário das votações por aclamação ou por
          símbolos, nas quais o posicionamento individual não é identificado. É exatamente porque os
          votos são individualizados que podemos inferir padrões ideológicos a partir deles.
        </p>
        <p style={{ marginTop: 10 }}>
          Cada registro de voto tem a forma:
        </p>
        <ExTable
          caption="Exemplo de registros de votação nominal (dados hipotéticos)"
          headers={['Deputado', 'Partido', 'Votação', 'Voto', 'Orientação do partido']}
          rows={[
            ['Dep. Ana', 'PT', 'PL 1234/2023', 'Sim', 'Sim'],
            ['Dep. Bruno', 'PT', 'PL 1234/2023', 'Sim', 'Sim'],
            ['Dep. Carla', 'PL', 'PL 1234/2023', 'Não', 'Não'],
            ['Dep. Diego', 'PL', 'PL 1234/2023', 'Sim', 'Não'],
            ['Dep. Eva', 'NOVO', 'PL 1234/2023', 'Abstencao', 'Liberado'],
          ]}
        />
        <p style={{ marginTop: 10 }}>
          Dep. Diego votou "Sim" enquanto seu partido orientou "Não" — ele contrariou a diretriz.
          Dep. Eva está em partido que liberou o voto — esse voto <em>não entra</em> no cálculo de
          alinhamento.
        </p>

        <h3 className="method-subhead" style={{ marginTop: 20 }}>Tipos de voto e tratamento metodológico</h3>
        <ExTable
          caption="Como cada tipo de voto é tratado"
          headers={['Voto registrado', 'Entra no cálculo?', 'Motivo']}
          rows={[
            ['Sim', 'Sim', 'Voto substantivo — alinhado se orientação = Sim'],
            ['Não', 'Sim', 'Voto substantivo — alinhado se orientação = Não'],
            ['Abstenção', 'Não', 'Voto neutro — não indica concordância ou discordância'],
            ['Obstrução', 'Não', 'Estratégia de bancada, não posição individual'],
            ['Artigo 17', 'Não', 'Ausência justificada pela presidência da Mesa'],
            ['Ausência', 'Não', 'Não gera registro; deputado simplesmente não está presente'],
          ]}
        />
        <p style={{ marginTop: 10 }}>
          Da mesma forma, votações em que o partido orientou "Liberado", "Abstenção" ou "Obstrução"
          são <strong>excluídas do denominador</strong> — não há posição oficial a seguir, então
          nenhum voto pode ser contado como "alinhado" ou "contrário".
        </p>

        <h3 className="method-subhead" style={{ marginTop: 20 }}>Cálculo do percentual de alinhamento</h3>
        <p>Para um partido <em>P</em> no período analisado:</p>
        <div className="method-formula">
          <code>
            pct_alinhamento(P) = votos_alinhados(P) ÷ total_votos_com_diretriz(P) × 100
          </code>
        </div>
        <p style={{ marginTop: 10 }}>
          Onde <code>votos_alinhados</code> conta votos individuais que coincidiram com a orientação
          "Sim" ou "Não" da bancada, e <code>total_votos_com_diretriz</code> exclui abstenções,
          obstruções e artigos 17 tanto do deputado quanto do partido.
        </p>

        <h3 className="method-subhead" style={{ marginTop: 20 }}>Exemplo numérico passo a passo</h3>
        <p>Considere o partido fictício "PX" com 3 deputados e 2 votações com diretriz "Sim":</p>
        <ExTable
          caption="Dados brutos de votação"
          headers={['Votação', 'Deputado', 'Voto', 'Orientação PX', 'Alinhado?']}
          rows={[
            ['V-01', 'Dep. A', 'Sim', 'Sim', '✓ alinhado'],
            ['V-01', 'Dep. B', 'Não', 'Sim', '✗ contrário'],
            ['V-01', 'Dep. C', 'Sim', 'Sim', '✓ alinhado'],
            ['V-02', 'Dep. A', 'Sim', 'Sim', '✓ alinhado'],
            ['V-02', 'Dep. B', 'Sim', 'Sim', '✓ alinhado'],
            ['V-02', 'Dep. C', 'Abstencao', 'Sim', '— excluído'],
          ]}
        />
        <p style={{ marginTop: 10 }}>
          <code>votos_alinhados = 4</code> &nbsp;|&nbsp;
          <code>total_votos_com_diretriz = 5</code> (abstenção de C em V-02 excluída)<br />
          <strong>pct_alinhamento(PX) = 4 ÷ 5 × 100 = 80%</strong>
        </p>

        <h3 className="method-subhead" style={{ marginTop: 20 }}>Limitações do indicador de alinhamento</h3>
        <ul className="method-list">
          <li>Mede <em>disciplina formal</em>, não convicção política — um deputado pode votar com
            o partido por lealdade, negociação ou coincidência.</li>
          <li>Partidos que emitem "Liberado" com frequência têm denominador menor e percentuais
            não diretamente comparáveis a partidos com diretriz constante.</li>
          <li>Blocos suprapartidários e bancadas temáticas não são tratados como partidos neste cálculo.</li>
        </ul>
        <SqlBlock
          title="Q10 — Ranking completo de alinhamento partidário"
          code={`WITH votos_com_diretriz AS (
    SELECT
        vv.ano_dados,
        vv.id_votacao,
        vv.id_deputado,
        vv.sigla_partido,
        vv.voto,
        vo.orientacao AS orientacao_partido
    FROM votacoes_votos vv
    JOIN votacoes_orientacoes vo
        ON vo.ano_dados     = vv.ano_dados
       AND vo.id_votacao    = vv.id_votacao
       AND vo.sigla_bancada = vv.sigla_partido
    WHERE
        vo.orientacao NOT IN ('Liberado', 'Abstencao', 'Obstrucao')
        AND vv.voto NOT IN ('Abstencao', 'Artigo 17', 'Obstrucao')
        AND vv.sigla_partido IS NOT NULL
        AND vv.sigla_partido <> 'S.PART.'
),
alinhamento AS (
    SELECT
        sigla_partido,
        COUNT(DISTINCT id_deputado)                           AS qtd_deputados,
        COUNT(*)                                              AS total_votos_com_diretriz,
        COUNT(*) FILTER (WHERE voto = orientacao_partido)    AS votos_alinhados,
        COUNT(*) FILTER (WHERE voto != orientacao_partido)   AS votos_contrarios
    FROM votos_com_diretriz
    GROUP BY sigla_partido
)
SELECT
    RANK() OVER (
        ORDER BY
            ROUND(a.votos_alinhados * 100.0 / NULLIF(a.total_votos_com_diretriz, 0), 2) DESC
    )                                                               AS posicao,
    a.sigla_partido,
    pi.ideologia_score,
    pi.ideologia_faixa,
    pi.campo_ideologico,
    a.qtd_deputados,
    a.total_votos_com_diretriz,
    a.votos_alinhados,
    a.votos_contrarios,
    ROUND(
        a.votos_alinhados * 100.0 / NULLIF(a.total_votos_com_diretriz, 0), 2
    )                                                               AS pct_alinhamento
FROM alinhamento a
LEFT JOIN partidos_ideologia pi ON pi.sigla_partido = a.sigla_partido
ORDER BY pct_alinhamento DESC;`}
        />
      </Section>

      {/* 11 — Comportamento ideológico em votações */}
      <Section
        num="11"
        title="Comportamento ideológico em votações"
        sub="Como o voto coletivo de cada campo ideológico é mensurado por proposição."
      >
        <p>
          Além da disciplina ao líder, o painel analisa se deputados de diferentes campos ideológicos
          votam de forma coerente com sua posição. Para isso, cruza o voto individual com a{' '}
          <strong>faixa ideológica do partido</strong> (Bolognesi).
        </p>
        <p style={{ marginTop: 10 }}>
          O resultado é um mapa de <em>convergência ideológica por proposição</em>: para cada
          votação, vemos qual percentual dos deputados de esquerda, centro e direita votou "Sim".
          Quando esse percentual diverge fortemente entre campos, a votação é ideologicamente clivada.
        </p>
        <ExTable
          caption="Exemplo: % de votos Sim por campo ideológico em uma votação hipotética"
          headers={['Campo', 'Votos Sim', 'Total votaram', '% Sim']}
          rows={[
            ['Esquerda', '8', '82', '9,8%'],
            ['Centro', '35', '60', '58,3%'],
            ['Direita', '112', '120', '93,3%'],
          ]}
        />
        <p style={{ marginTop: 10 }}>
          Este padrão — esquerda contra, direita a favor — caracteriza alta clivagem ideológica.
          O indicador Q9.2 permite explorar esse comportamento votação a votação.
        </p>
        <SqlBlock
          title="Q9.2 — % de votos Sim por faixa ideológica por votação"
          code={`WITH votos_classif AS (
    SELECT
        vv.ano_dados,
        vv.id_votacao,
        pi.ideologia_faixa,
        pi.campo_ideologico,
        ROUND(AVG(pi.ideologia_score), 3)               AS score_medio,
        COUNT(*) FILTER (WHERE vv.voto = 'Sim')         AS votos_sim,
        COUNT(*) FILTER (WHERE vv.voto = 'Nao')         AS votos_nao,
        COUNT(*)                                        AS total_votos
    FROM votacoes_votos vv
    JOIN partidos_ideologia pi ON pi.sigla_partido = vv.sigla_partido
    GROUP BY vv.ano_dados, vv.id_votacao, pi.ideologia_faixa, pi.campo_ideologico
)
SELECT
    vc.ano_dados,
    vc.id_votacao,
    ob.titulo_proposicao,
    vc.ideologia_faixa,
    vc.campo_ideologico,
    vc.votos_sim,
    vc.votos_nao,
    vc.total_votos,
    ROUND(vc.votos_sim * 100.0 / NULLIF(vc.total_votos, 0), 1) AS pct_sim
FROM votos_classif vc
LEFT JOIN (
    SELECT DISTINCT ON (ano_dados, id_votacao)
        ano_dados, id_votacao, titulo_proposicao
    FROM votacoes_objetos
    ORDER BY ano_dados, id_votacao
) ob USING (ano_dados, id_votacao)
ORDER BY vc.ano_dados, vc.id_votacao, vc.score_medio NULLS LAST;`}
        />
      </Section>

      {/* 12 — W-NOMINATE */}
      <Section
        num="12"
        title="W-NOMINATE e posição ideológica revelada"
        sub="Modelos espaciais de votação: intuição, matemática, implementação e limitações."
      >
        <h3 className="method-subhead">Referência acadêmica</h3>
        <div className="method-callout">
          <strong>POOLE, Keith T.; ROSENTHAL, Howard.</strong>{' '}
          <em>A Spatial Model for Legislative Roll Call Analysis.</em>{' '}
          American Journal of Political Science, v. 29, n. 2, p. 357–384, 1985.
          Posteriormente expandido em: <em>Congress: A Political-Economic History of Roll Call
          Voting.</em> Oxford University Press, 1997.
          <p style={{ marginTop: 8 }}>
            O W-NOMINATE (Weighted NOMINAL Three-step Estimation) estima posições ideológicas
            latentes de legisladores a partir do padrão de concordância em votações nominais.
            É o método padrão em ciência política quantitativa para escalonamento de câmaras
            legislativas. Sua premissa: <em>legisladores próximos no espaço ideológico votam
            de forma semelhante</em>.
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>Relevância para este projeto:</strong> aplicamos W-NOMINATE às votações
            nominais da 57ª Legislatura para estimar a posição ideológica <em>revelada pelo
            comportamento</em> de cada deputado — independente de declarações ou filiações
            partidárias. O resultado é calibrado para a escala Bolognesi, permitindo comparar
            comportamento observado com classificação teórica do partido.
          </p>
        </div>

        <h3 className="method-subhead" style={{ marginTop: 24 }}>A intuição: por que votos revelam ideologia?</h3>
        <p>
          Imagine que toda votação plenária é um teste de posição. Um deputado de esquerda tende
          a votar "Não" a projetos de privatização e "Sim" a projetos de expansão social.
          Um de direita faz o oposto. Quanto mais votações observamos, mais precisamente
          conseguimos localizar cada deputado no espectro.
        </p>
        <p style={{ marginTop: 10 }}>
          O W-NOMINATE formaliza essa intuição: representa cada legislador e cada proposição
          como <strong>pontos em um espaço n-dimensional</strong>. Na prática, a Dimensão 1
          captura a clivagem esquerda–direita, que responde pela maior parte da variação
          no comportamento legislativo.
        </p>

        <h3 className="method-subhead" style={{ marginTop: 20 }}>Representação geométrica</h3>
        <p>
          Imagine um eixo de −1 (esquerda) a +1 (direita). Cada deputado ocupa um ponto nesse
          eixo, e cada votação tem um "ponto de corte" que separa os prováveis "Sim" dos
          prováveis "Não":
        </p>
        <div className="method-diagram">
          <div className="method-diagram__axis">
            <span>−1 (esquerda)</span>
            <div className="method-diagram__line">
              <div className="method-diagram__cut" style={{ left: '38%' }} title="ponto de corte da votação V1" />
            </div>
            <span>+1 (direita)</span>
          </div>
          <div className="method-diagram__points">
            <div style={{ left: '5%' }}>● Dep. A<br /><small>−0.8</small></div>
            <div style={{ left: '28%' }}>● Dep. B<br /><small>−0.3</small></div>
            <div style={{ left: '50%' }}>● Dep. C<br /><small>0.0</small></div>
            <div style={{ left: '70%' }}>● Dep. D<br /><small>+0.4</small></div>
            <div style={{ left: '88%' }}>● Dep. E<br /><small>+0.8</small></div>
          </div>
          <p className="method-diagram__legend">
            ▲ ponto de corte da votação V1 (≈ −0.25): deputados à esquerda do corte → Não; à direita → Sim
          </p>
        </div>
        <p style={{ marginTop: 10 }}>
          Para a votação V1 com corte em −0.25: Dep. A e Dep. B (à esquerda do corte) votam
          "Não"; Dep. C, D e E (à direita) votam "Sim". O modelo ajusta os pontos dos deputados
          e os cortes das votações para maximizar os votos <em>corretamente classificados</em>.
        </p>

        <h3 className="method-subhead" style={{ marginTop: 20 }}>Por que similaridade de voto revela proximidade ideológica</h3>
        <p>
          Se Dep. A (−0.8) e Dep. B (−0.3) concordam em 87% das votações, é porque a maioria
          dos pontos de corte ficou à direita de ambos — ambos estão no mesmo lado. Se Dep. A
          e Dep. E (+0.8) concordam em apenas 18%, é porque a maioria dos cortes ficou entre
          eles — eles estão em campos opostos. O W-NOMINATE usa esse raciocínio em escala:
          500+ deputados e 1000+ votações.
        </p>

        <h3 className="method-subhead" style={{ marginTop: 20 }}>Exemplo passo a passo com dados hipotéticos</h3>
        <p>4 deputados, 3 votações:</p>
        <ExTable
          caption="Matriz de votos (S = Sim, N = Não)"
          headers={['Deputado', 'V1', 'V2', 'V3']}
          rows={[
            ['Dep. A', 'N', 'N', 'N'],
            ['Dep. B', 'N', 'N', 'S'],
            ['Dep. C', 'S', 'N', 'S'],
            ['Dep. D', 'S', 'S', 'S'],
          ]}
        />
        <ol className="method-list" style={{ marginTop: 12 }}>
          <li>
            <strong>Inicialização</strong>: o algoritmo atribui coordenadas iniciais (ex.: via
            análise de componentes principais da matriz de concordância par-a-par).
          </li>
          <li>
            <strong>Estimação dos cortes</strong>: para cada votação, estima o ponto de corte
            que melhor separa "Sim" de "Não" dadas as coordenadas atuais dos deputados.
          </li>
          <li>
            <strong>Atualização das coordenadas</strong>: recalcula as posições dos deputados
            para maximizar a probabilidade dos votos observados (função gaussiana de utilidade).
          </li>
          <li>
            <strong>Iteração</strong>: repete os passos 2–3 até convergência (mudança abaixo de
            limiar definido).
          </li>
          <li>
            <strong>Orientação</strong>: a Dimensão 1 pode sair invertida (alto = esquerda).
            Corrigimos isso data-driven: correlacionamos a média da Dim. 1 por partido com o
            score Bolognesi e invertemos o sinal se necessário para que alto = direita.
          </li>
        </ol>
        <p>Resultado hipotético após convergência:</p>
        <ExTable
          caption="Coordenadas estimadas pelo W-NOMINATE"
          headers={['Deputado', 'Coord. Dim. 1', 'Score 0–10', 'Confiança (CC)']}
          rows={[
            ['Dep. A', '−0.87', '0,65', '100%'],
            ['Dep. B', '−0.31', '3,45', '100%'],
            ['Dep. C', '+0.18', '5,90', '67%'],
            ['Dep. D', '+0.79', '8,95', '100%'],
          ]}
        />

        <h3 className="method-subhead" style={{ marginTop: 20 }}>Conversão para score 0–10</h3>
        <p>
          A Dimensão 1 tem intervalo teórico [−1, +1]. Para comparar com o Bolognesi (0–10),
          aplicamos um mapa linear fixo:
        </p>
        <div className="method-formula">
          <code>score_comportamental_0_10 = (coord1D + 1) × 5</code>
        </div>
        <p style={{ marginTop: 10 }}>
          Exemplos: −1 → 0 (extrema esquerda); 0 → 5 (centro); +1 → 10 (extrema direita).
          A escala teórica fixa (não min–max da amostra) garante estabilidade entre conjuntos
          de dados.
        </p>

        <h3 className="method-subhead" style={{ marginTop: 20 }}>Calibração por OLS</h3>
        <p>
          O score comportamental bruto e o Bolognesi estão na mesma faixa, mas têm distribuições
          diferentes. Comparar diretamente produziria desvios sistemáticos — artefato de escala,
          não divergência real. Para corrigir, ajustamos uma regressão linear simples (OLS):
        </p>
        <div className="method-formula">
          <code>score_calibrado = a + b × score_comportamental_0_10</code>
        </div>
        <p style={{ marginTop: 10 }}>
          O score calibrado preserva o ordenamento original do W-NOMINATE, mas passa a ocupar
          a mesma distribuição do Bolognesi. Os desvios subsequentes tornam-se interpretáveis
          como divergência genuína entre comportamento e posição oficial do partido.
        </p>

        <h3 className="method-subhead" style={{ marginTop: 20 }}>Desvio em relação ao partido</h3>
        <div className="method-formula">
          <code>desvio_partido = score_calibrado − ideologia_score_partido</code>
        </div>
        <p style={{ marginTop: 10 }}>
          <strong>Positivo (+)</strong>: o deputado vota mais à direita que a posição oficial do partido.<br />
          <strong>Negativo (−)</strong>: vota mais à esquerda.<br />
          <strong>Tolerância ±0,5</strong>: desvios dentro dessa faixa são rotulados como "alinhado".
        </p>
        <ExTable
          caption="Exemplo: três deputados do mesmo partido (score Bolognesi = 6,0)"
          headers={['Deputado', 'Score calibrado', 'Score do partido', 'Desvio', 'Direção']}
          rows={[
            ['Dep. X', '5,2', '6,0', '−0,8', 'mais à esquerda'],
            ['Dep. Y', '5,8', '6,0', '−0,2', 'alinhado (|desvio| < 0,5)'],
            ['Dep. Z', '7,1', '6,0', '+1,1', 'mais à direita'],
          ]}
        />

        <h3 className="method-subhead" style={{ marginTop: 20 }}>Desvio em relação à bancada (coesão interna)</h3>
        <div className="method-formula">
          <code>
            score_bancada = média dos scores comportamentais do partido<br />
            desvio_bancada = score_comportamental − score_bancada
          </code>
        </div>
        <p style={{ marginTop: 10 }}>
          Este desvio é <strong>independente do Bolognesi</strong> — mede apenas uniformidade
          interna. Uma bancada com desvio médio absoluto baixo é coesa; alta, heterogênea.
          O painel exibe o índice de coesão como <code>10 − desvio_médio_absoluto</code>,
          de modo que 10 = coesão máxima.
        </p>

        <h3 className="method-subhead" style={{ marginTop: 20 }}>Índice de confiança (CC — Correct Classification)</h3>
        <p>
          A coluna <code>confianca</code> é a proporção de votos do deputado{' '}
          <em>corretamente classificados</em> pelo modelo. Um deputado com CC = 0.95 teve 95%
          dos seus votos explicados pela sua posição no espaço ideológico. CC abaixo de 0.70
          indica que o modelo captura mal o padrão daquele parlamentar — talvez porque ele seja
          estrategicamente volátil ou pertença a bancada com poucos deputados.
        </p>

        <h3 className="method-subhead" style={{ marginTop: 20 }}>Implementação: acadêmica vs. simplificada</h3>
        <div className="method-compare">
          <div className="method-compare__col">
            <h4>Método acadêmico (Poole &amp; Rosenthal)</h4>
            <ul className="method-list">
              <li>Maximização de verossimilhança via função gaussiana</li>
              <li>Múltiplas dimensões com erros-padrão por bootstrap</li>
              <li>Centenas de iterações com critério de convergência rigoroso</li>
              <li>Intervalos de confiança nas coordenadas (SE1D, SE2D)</li>
              <li>Software <code>wnominate</code> (R) com parâmetros default</li>
            </ul>
          </div>
          <div className="method-compare__col">
            <h4>Implementação deste projeto</h4>
            <ul className="method-list">
              <li>Pacote <code>wnominate</code> (R) com <code>trials = 1</code> — sem bootstrap</li>
              <li>Dimensão 1 orientada data-driven (correlação média partido × Bolognesi)</li>
              <li>Calibração OLS para alinhar escala ao Bolognesi</li>
              <li><strong>Sem erros-padrão</strong>: SE1D = SE2D = 0 — coordenadas pontuais</li>
              <li>634 deputados processados; correlação comportamental × Bolognesi: <strong>r = 0,753</strong></li>
            </ul>
          </div>
        </div>

        <h3 className="method-subhead" style={{ marginTop: 20 }}>Cautelas e limitações</h3>
        <ul className="method-list">
          <li>
            <strong>Comportamento ≠ convicção</strong>: desvios revelam como o deputado votou,
            não o que ele pensa. Um voto contra o partido pode refletir negociação, ausência
            momentânea ou erro de registro.
          </li>
          <li>
            <strong>Bancadas pequenas</strong>: partidos com poucos deputados têm médias de
            bancada e desvios com pouca significância estatística.
          </li>
          <li>
            <strong>trials = 1</strong>: sem bootstrap, não há intervalo de confiança nas
            coordenadas. Use o índice CC para avaliar a robustez individual.
          </li>
          <li>
            <strong>Votações selecionadas</strong>: apenas votações com participação mínima
            entram no modelo; votações unânimes são descartadas (sem poder discriminatório).
          </li>
          <li>
            <strong>Comparação entre anos</strong>: o espaço é reconstruído para o conjunto
            completo; comparações entre legislaturas exigem ancoragem adicional.
          </li>
          <li>
            <strong>Escala Bolognesi × comportamento</strong>: as duas métricas medem coisas
            correlatas, mas distintas — ideologia declarada (especialistas) vs. comportamento
            revelado (votos). Desvio não implica erro; implica divergência informativa.
          </li>
        </ul>
      </Section>

      {/* 14 — Transparência das consultas */}
      <Section
        num="14"
        title="Transparência das consultas"
        sub="Como acessar o SQL que gerou cada indicador exibido no painel."
      >
        <p>
          Cada gráfico e tabela do painel tem um botão <strong>"ver consulta"</strong> (ícone de
          banco de dados) que exibe o SQL exato enviado ao banco ou o código Python que processou
          o artefato analítico. Este mecanismo é implementado pelo componente{' '}
          <code>QueryDrawer</code>.
        </p>
        <p style={{ marginTop: 10 }}>
          O registry de perguntas (<code>question_registry.json</code>) documenta para cada
          indicador:
        </p>
        <ul className="method-list">
          <li><code>sql_file</code> — caminho para o arquivo <code>.sql</code> de origem</li>
          <li><code>response_files</code> — artefatos CSV/TXT gerados pelo pipeline</li>
          <li><code>explanation</code> — descrição textual da lógica de cálculo</li>
          <li><code>methodology_file</code> — Markdown de metodologia detalhada (quando aplicável)</li>
        </ul>
        <p style={{ marginTop: 10 }}>
          Todo o código-fonte é versionado no repositório do projeto (pasta <code>BDR/</code>)
          e pode ser auditado ou reproduzido localmente com Docker + PostgreSQL.
        </p>
      </Section>

    </main>
  )
}
