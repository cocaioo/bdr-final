import { useState } from 'react'
import { WNominateStory } from '../components/WNominateStory'
import {
  Q1Story, Q3Story, Q5Story, Q7Story, Q10Story, Q14Story,
} from '../components/MethodologyStories'

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
// Collapsible technical details panel
// ---------------------------------------------------------------------------
interface TechDetailsProps {
  children: React.ReactNode
}

function TechDetails({ children }: TechDetailsProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="method-tech-details">
      <button
        type="button"
        className="method-tech-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="method-sql-toggle__icon">{open ? '▾' : '▸'}</span>
        <span>Detalhes técnicos</span>
        <span className="method-sql-toggle__hint">{open ? 'ocultar' : 'ver'}</span>
      </button>
      {open && (
        <div className="method-tech-body">
          {children}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StorySection — card wrapping a story presentation
// ---------------------------------------------------------------------------
interface StorySectionProps {
  num: string
  title: string
  sub: string
  children: React.ReactNode          // the Story component
  techDetails?: React.ReactNode      // old documentation
}

function StorySection({ num, title, sub, children, techDetails }: StorySectionProps) {
  return (
    <section className="method-section stagger-item">
      <div className="method-section__head">
        <span aria-hidden="true">{num}</span>
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
      </div>
      <div className="method-story-wrap">
        {children}
      </div>
      {techDetails && (
        <TechDetails>{techDetails}</TechDetails>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper (plain docs sections, kept as-is)
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
// W-NOMINATE section — tabbed (Documentação | Demonstração interativa)
// ---------------------------------------------------------------------------
function WNominateSection() {
  const [tab, setTab] = useState<'doc' | 'story'>('story')
  return (
    <>
      <div className="wnominate-section-tabs" role="tablist" aria-label="Seções do W-NOMINATE">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'story'}
          aria-controls="wnominate-panel-story"
          id="wnominate-tab-story"
          className={`wnominate-tab${tab === 'story' ? ' wnominate-tab--active' : ''}`}
          onClick={() => setTab('story')}
        >
          🎓 Apresentação
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'doc'}
          aria-controls="wnominate-panel-doc"
          id="wnominate-tab-doc"
          className={`wnominate-tab${tab === 'doc' ? ' wnominate-tab--active' : ''}`}
          onClick={() => setTab('doc')}
        >
          📄 Documentação técnica
        </button>
      </div>

      {tab === 'story' && (
        <div id="wnominate-panel-story" role="tabpanel" aria-labelledby="wnominate-tab-story">
          <WNominateStory />
        </div>
      )}

      {tab === 'doc' && (
        <div id="wnominate-panel-doc" role="tabpanel" aria-labelledby="wnominate-tab-doc">

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

        <h3 className="method-subhead" style={{ marginTop: 20 }}>Conversão para score 0–10</h3>
        <div className="method-formula">
          <code>score_comportamental_0_10 = (coord1D + 1) × 5</code>
        </div>

        <h3 className="method-subhead" style={{ marginTop: 20 }}>Calibração por OLS</h3>
        <div className="method-formula">
          <code>score_calibrado = a + b × score_comportamental_0_10</code>
        </div>

        <h3 className="method-subhead" style={{ marginTop: 20 }}>Desvio em relação ao partido</h3>
        <div className="method-formula">
          <code>desvio_partido = score_calibrado − ideologia_score_partido</code>
        </div>

        <h3 className="method-subhead" style={{ marginTop: 20 }}>Cautelas e limitações</h3>
        <ul className="method-list">
          <li><strong>Comportamento ≠ convicção</strong>: desvios revelam como o deputado votou, não o que ele pensa.</li>
          <li><strong>Bancadas pequenas</strong>: partidos com poucos deputados têm médias com pouca significância estatística.</li>
          <li><strong>trials = 1</strong>: sem bootstrap, não há intervalo de confiança nas coordenadas. Use o índice CC para avaliar a robustez individual.</li>
          <li><strong>Votações selecionadas</strong>: apenas votações com participação mínima entram no modelo; votações unânimes são descartadas.</li>
        </ul>

        </div>
      )}
    </>
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
        <span className="parties-eyebrow">Mini-curso interativo</span>
        <h1>Metodologia</h1>
        <p>
          Cada indicador do painel é explicado como uma apresentação de slides curta.
          Avance no seu ritmo — cada slide introduz um único conceito.
          Os detalhes técnicos completos estão disponíveis abaixo de cada apresentação.
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
            rate-limiting e retry automático.
          </li>
          <li>
            <strong>Normalização</strong> — datas convertidas para <code>DATE</code>/<code>TIMESTAMP</code>;
            valores monetários para <code>NUMERIC</code>; IDs para <code>INTEGER</code>.
          </li>
          <li>
            <strong>Deduplicação</strong> — registros duplicados de gastos são eliminados por
            chave composta <code>(id_deputado, data_documento, valor_liquido, cnpj_cpf_fornecedor)</code>.
          </li>
          <li>
            <strong>Join com ideologia</strong> — a tabela <code>partidos_ideologia</code> é
            populada com os escores Bolognesi.
          </li>
          <li>
            <strong>Carga</strong> — dados normalizados são inseridos via COPY ou INSERT em lote.
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
          do schema <code>grupo4</code>.
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

      {/* ─── INTERACTIVE STORIES ─────────────────────────────────────────────── */}

      {/* 06 — Gastos (Q1) */}
      <StorySection
        num="06"
        title="Como os gastos parlamentares são calculados?"
        sub="Cota CEAP: da API ao ranking — em 5 slides."
        techDetails={
          <>
            <h3 className="method-subhead">CEAP — Cota para o Exercício da Atividade Parlamentar</h3>
            <p>
              A CEAP é um benefício mensal pago a cada deputado para custear despesas do mandato.
              Os dados são públicos e disponibilizados pela API da Câmara.
            </p>
            <ul className="method-list" style={{ marginTop: 10 }}>
              <li><strong>Gasto total por deputado (Q1)</strong> — soma de <code>valor_liquido</code> de todos os registros no período.</li>
              <li><strong>Gasto por categoria (Q13)</strong> — agrupamento por <code>descricao_tipo</code>.</li>
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
perfil_dominante AS (
    SELECT DISTINCT ON (id_deputado)
        id_deputado, sigla_uf, sigla_partido
    FROM (
        SELECT id_deputado, sigla_uf, sigla_partido, COUNT(*) AS ocorrencias
        FROM gastos
        GROUP BY id_deputado, sigla_uf, sigla_partido
    ) ranked
    ORDER BY id_deputado, ocorrencias DESC
)
SELECT
    d.id_deputado,
    COALESCE(NULLIF(BTRIM(d.nome_civil), ''), d.nome) AS nome,
    p.sigla_uf, p.sigla_partido, gt.gasto_total
FROM gastos_totais gt
JOIN deputados d USING (id_deputado)
LEFT JOIN perfil_dominante p USING (id_deputado)
ORDER BY gasto_total DESC;`}
            />
          </>
        }
      >
        <Q1Story />
      </StorySection>

      {/* 07 — Votações por tema (Q3) */}
      <StorySection
        num="07"
        title="Como os votos são classificados por tema?"
        sub="De registros brutos a uma nuvem de temas — em 5 slides."
        techDetails={
          <>
            <h3 className="method-subhead">Classificação temática de proposições</h3>
            <p>
              O campo <code>titulo_proposicao</code> das votações é analisado por palavras-chave
              para atribuir uma categoria temática. Quando não há match, o tema é "Outros".
            </p>
            <SqlBlock
              title="Q9.2 — % de votos Sim por faixa ideológica por votação"
              code={`WITH votos_classif AS (
    SELECT
        vv.ano_dados, vv.id_votacao,
        pi.ideologia_faixa, pi.campo_ideologico,
        ROUND(AVG(pi.ideologia_score), 3)               AS score_medio,
        COUNT(*) FILTER (WHERE vv.voto = 'Sim')         AS votos_sim,
        COUNT(*) FILTER (WHERE vv.voto = 'Nao')         AS votos_nao,
        COUNT(*)                                        AS total_votos
    FROM votacoes_votos vv
    JOIN partidos_ideologia pi ON pi.sigla_partido = vv.sigla_partido
    GROUP BY vv.ano_dados, vv.id_votacao, pi.ideologia_faixa, pi.campo_ideologico
)
SELECT vc.*, ob.titulo_proposicao,
    ROUND(vc.votos_sim * 100.0 / NULLIF(vc.total_votos, 0), 1) AS pct_sim
FROM votos_classif vc
LEFT JOIN (
    SELECT DISTINCT ON (ano_dados, id_votacao) ano_dados, id_votacao, titulo_proposicao
    FROM votacoes_objetos ORDER BY ano_dados, id_votacao
) ob USING (ano_dados, id_votacao)
ORDER BY vc.ano_dados, vc.id_votacao, vc.score_medio NULLS LAST;`}
            />
          </>
        }
      >
        <Q3Story />
      </StorySection>

      {/* 08 — Fornecedores (Q5) */}
      <StorySection
        num="08"
        title="Quem são os maiores fornecedores dos parlamentares?"
        sub="Normalização de CNPJ e ranking de fornecedores — em 5 slides."
        techDetails={
          <>
            <h3 className="method-subhead">Normalização de fornecedores</h3>
            <p>
              O mesmo fornecedor pode aparecer com grafias diferentes. Usamos o CNPJ/CPF
              como identificador canônico para unificar todas as variações.
            </p>
            <p style={{ marginTop: 8 }}>
              <strong>Fornecedores com maior total pago (Q5)</strong>: soma por CNPJ/CPF com número de deputados atendidos.
            </p>
          </>
        }
      >
        <Q5Story />
      </StorySection>

      {/* 09 — Custo-benefício (Q7) */}
      <StorySection
        num="09"
        title="Qual o índice custo-benefício de cada deputado?"
        sub="Produção legislativa versus gasto total — em 4 slides."
        techDetails={
          <>
            <h3 className="method-subhead">Fórmula do índice custo-benefício</h3>
            <div className="method-formula">
              <code>score = proposições_aprovadas ÷ gasto_total</code>
            </div>
            <p style={{ marginTop: 10 }}>
              <strong>Índice custo-benefício (Q7)</strong>: razão entre produção legislativa e gasto total.
              Penaliza quem gasta muito e produz pouco. Deputies de estados próximos a Brasília tendem
              a ter custo de deslocamento menor, o que deve ser considerado na interpretação comparativa.
            </p>
          </>
        }
      >
        <Q7Story />
      </StorySection>

      {/* 10 — Alinhamento (Q10) */}
      <StorySection
        num="10"
        title="Como é calculado o alinhamento partidário?"
        sub="Votos, orientações e disciplina — em 4 slides."
        techDetails={
          <>
            <h3 className="method-subhead">Cálculo do percentual de alinhamento</h3>
            <div className="method-formula">
              <code>pct_alinhamento(P) = votos_alinhados(P) ÷ total_votos_com_diretriz(P) × 100</code>
            </div>
            <p style={{ marginTop: 10 }}>
              Abstenções, obstruções e "Liberado" são excluídos do denominador.
            </p>
            <ExTable
              caption="Como cada tipo de voto é tratado"
              headers={['Voto registrado', 'Entra no cálculo?', 'Motivo']}
              rows={[
                ['Sim', 'Sim', 'Voto substantivo'],
                ['Não', 'Sim', 'Voto substantivo'],
                ['Abstenção', 'Não', 'Voto neutro'],
                ['Obstrução', 'Não', 'Estratégia de bancada'],
                ['Artigo 17', 'Não', 'Ausência justificada'],
              ]}
            />
            <SqlBlock
              title="Q10 — Ranking completo de alinhamento partidário"
              code={`WITH votos_com_diretriz AS (
    SELECT vv.ano_dados, vv.id_votacao, vv.id_deputado,
           vv.sigla_partido, vv.voto, vo.orientacao AS orientacao_partido
    FROM votacoes_votos vv
    JOIN votacoes_orientacoes vo
        ON vo.ano_dados = vv.ano_dados AND vo.id_votacao = vv.id_votacao
       AND vo.sigla_bancada = vv.sigla_partido
    WHERE vo.orientacao NOT IN ('Liberado', 'Abstencao', 'Obstrucao')
      AND vv.voto NOT IN ('Abstencao', 'Artigo 17', 'Obstrucao')
      AND vv.sigla_partido IS NOT NULL AND vv.sigla_partido <> 'S.PART.'
),
alinhamento AS (
    SELECT sigla_partido,
           COUNT(DISTINCT id_deputado) AS qtd_deputados,
           COUNT(*) AS total_votos_com_diretriz,
           COUNT(*) FILTER (WHERE voto = orientacao_partido) AS votos_alinhados,
           COUNT(*) FILTER (WHERE voto != orientacao_partido) AS votos_contrarios
    FROM votos_com_diretriz GROUP BY sigla_partido
)
SELECT RANK() OVER (ORDER BY ROUND(a.votos_alinhados * 100.0 / NULLIF(a.total_votos_com_diretriz, 0), 2) DESC) AS posicao,
    a.sigla_partido, pi.ideologia_score, pi.ideologia_faixa, pi.campo_ideologico,
    a.qtd_deputados, a.total_votos_com_diretriz, a.votos_alinhados, a.votos_contrarios,
    ROUND(a.votos_alinhados * 100.0 / NULLIF(a.total_votos_com_diretriz, 0), 2) AS pct_alinhamento
FROM alinhamento a
LEFT JOIN partidos_ideologia pi ON pi.sigla_partido = a.sigla_partido
ORDER BY pct_alinhamento DESC;`}
            />
          </>
        }
      >
        <Q10Story />
      </StorySection>

      {/* 11 — Coesão (Q14) */}
      <StorySection
        num="11"
        title="Como é medida a coesão interna de bancada?"
        sub="Concordância entre deputados do mesmo partido — em 4 slides."
        techDetails={
          <>
            <h3 className="method-subhead">Coesão via W-NOMINATE</h3>
            <div className="method-formula">
              <code>
                score_bancada = média dos scores W-NOMINATE do partido{'\n'}
                desvio_bancada = score_comportamental − score_bancada{'\n'}
                coesão = 10 − desvio_médio_absoluto
              </code>
            </div>
            <p style={{ marginTop: 10 }}>
              Este desvio é <strong>independente do Bolognesi</strong> — mede apenas uniformidade
              interna. Uma bancada com desvio médio absoluto baixo é coesa; alta, heterogênea.
            </p>
            <p style={{ marginTop: 8 }}>
              Artefatos: <code>q14_desvio_bancada.csv</code> — coesão interna de cada bancada.
            </p>
          </>
        }
      >
        <Q14Story />
      </StorySection>

      {/* 12 — W-NOMINATE */}
      <Section
        num="12"
        title="W-NOMINATE e posição ideológica revelada"
        sub="Modelos espaciais de votação: intuição, matemática, implementação e limitações."
      >
        <WNominateSection />
      </Section>

      {/* 13 — Ideologia partidária */}
      <Section
        num="13"
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
            política brasileira e (3) análise de coligações e alianças históricas.
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
          Todo o código-fonte é versionado no repositório do projeto (pasta <code>BDR/</code>)
          e pode ser auditado ou reproduzido localmente com Docker + PostgreSQL.
        </p>
      </Section>

    </main>
  )
}
