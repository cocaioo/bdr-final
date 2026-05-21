-- =========================================================
-- BANCO: dossie_grupo4
-- PostgreSQL 16+
-- =========================================================

CREATE SCHEMA IF NOT EXISTS grupo4;
SET search_path TO grupo4;

-- =========================================================
-- 1) TABELA: deputados
-- =========================================================

CREATE TABLE deputados (
    id_dep         INTEGER PRIMARY KEY,
    uri_dep        VARCHAR(255) NOT NULL UNIQUE,
    nome           VARCHAR(150) NOT NULL,
    nomeCivil      VARCHAR(200),
    cpf            CHAR(11) UNIQUE
);

-- =========================================================
-- 2) TABELA: proposicoes_2026
-- =========================================================

CREATE TABLE proposicoes_2026 (
    id                  INTEGER PRIMARY KEY,
    uri                 VARCHAR(255) NOT NULL UNIQUE,
    siglaTipo           VARCHAR(20),
    numero              INTEGER,
    ano                 INTEGER,
    ementa              TEXT,
    ementaDetalhada     TEXT,
    keywords            TEXT,
    descricaoSituacao   VARCHAR(255)
);

CREATE INDEX idx_proposicoes_tipo_ano
ON proposicoes_2026(siglaTipo, ano);

-- =========================================================
-- 3) TABELA: eventos_2026
-- =========================================================

CREATE TABLE eventos_2026 (
    idEvento          INTEGER PRIMARY KEY,
    uri               VARCHAR(255) UNIQUE,
    dataHoraInicio    TIMESTAMP,
    dataHoraFim       TIMESTAMP,
    descricaoTipo     VARCHAR(150),
    descricao         TEXT,
    localCamara       VARCHAR(150)
);

-- =========================================================
-- 4) TABELA: votacoes_2026
-- =========================================================

CREATE TABLE votacoes_2026 (
    id              VARCHAR(80) PRIMARY KEY,
    data            DATE,
    siglaOrgao      VARCHAR(30),
    idEvento        INTEGER,
    aprovacao       BOOLEAN,
    descricao       TEXT,

    CONSTRAINT fk_votacoes_evento
        FOREIGN KEY (idEvento)
        REFERENCES eventos_2026(idEvento)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX idx_votacoes_evento
ON votacoes_2026(idEvento);

-- =========================================================
-- 5) TABELA: Gastos_2026
-- =========================================================

CREATE TABLE Gastos_2026 (
    idGasto              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cpf                  CHAR(11),
    nuDeputadoId         INTEGER NOT NULL,
    txNomeParlamentar    VARCHAR(150) NOT NULL,
    sgUF                 CHAR(2) NOT NULL,
    sgPartido            VARCHAR(20) NOT NULL,
    vlrDocumento         NUMERIC(14,2),
    vlrGlosa             NUMERIC(14,2),
    vlrLiquido           NUMERIC(14,2) NOT NULL,
    txtDescricao         VARCHAR(255),
    txtFornecedor        VARCHAR(255),

    CONSTRAINT fk_gastos_deputado
        FOREIGN KEY (nuDeputadoId)
        REFERENCES deputados(id_dep)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_gastos_cpf
        FOREIGN KEY (cpf)
        REFERENCES deputados(cpf)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX idx_gastos_deputado
ON Gastos_2026(nuDeputadoId);

CREATE INDEX idx_gastos_cpf
ON Gastos_2026(cpf);

CREATE INDEX idx_gastos_partido
ON Gastos_2026(sgPartido);

CREATE INDEX idx_gastos_uf
ON Gastos_2026(sgUF);

-- =========================================================
-- 6) TABELA: votacoesVotos_2026
-- =========================================================

CREATE TABLE votacoesVotos_2026 (
    idVotacao               VARCHAR(80) NOT NULL,
    deputado_id             INTEGER NOT NULL,
    voto                    VARCHAR(30) NOT NULL,
    deputado_nome           VARCHAR(150) NOT NULL,
    deputado_siglaPartido   VARCHAR(20),
    deputado_siglaUf        CHAR(2),

    PRIMARY KEY (idVotacao, deputado_id),

    CONSTRAINT fk_votos_votacao
        FOREIGN KEY (idVotacao)
        REFERENCES votacoes_2026(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_votos_deputado
        FOREIGN KEY (deputado_id)
        REFERENCES deputados(id_dep)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_votos_deputado
ON votacoesVotos_2026(deputado_id);

-- =========================================================
-- 7) TABELA: votacoesOrientacoes_2026
-- =========================================================

CREATE TABLE votacoesOrientacoes_2026 (
    idVotacao        VARCHAR(80) NOT NULL,
    siglaBancada     VARCHAR(30) NOT NULL,
    orientacao       VARCHAR(30),
    siglaOrgao       VARCHAR(30),
    descricao        TEXT,

    PRIMARY KEY (idVotacao, siglaBancada),

    CONSTRAINT fk_orientacoes_votacao
        FOREIGN KEY (idVotacao)
        REFERENCES votacoes_2026(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- =========================================================
-- 8) TABELA: votacoesObjetos_2026
-- =========================================================

CREATE TABLE votacoesObjetos_2026 (
    idVotacaoObjeto        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    idVotacao              VARCHAR(80) NOT NULL,
    proposicao_id          INTEGER,
    proposicao_uri         VARCHAR(255),
    proposicao_titulo      VARCHAR(255),
    proposicao_ementa      TEXT,
    proposicao_siglaTipo   VARCHAR(20),
    proposicao_numero      INTEGER,
    proposicao_ano         INTEGER,

    CONSTRAINT fk_objetos_votacao
        FOREIGN KEY (idVotacao)
        REFERENCES votacoes_2026(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_objetos_proposicao_id
        FOREIGN KEY (proposicao_id)
        REFERENCES proposicoes_2026(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_objetos_proposicao_uri
        FOREIGN KEY (proposicao_uri)
        REFERENCES proposicoes_2026(uri)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX idx_objetos_votacao
ON votacoesObjetos_2026(idVotacao);

CREATE INDEX idx_objetos_prop_id
ON votacoesObjetos_2026(proposicao_id);

CREATE INDEX idx_objetos_prop_uri
ON votacoesObjetos_2026(proposicao_uri);

-- =========================================================
-- 9) TABELA: votacoesProposicoes_2026
-- =========================================================

CREATE TABLE votacoesProposicoes_2026 (
    idVotacao            VARCHAR(80) NOT NULL,
    proposicao_id        INTEGER NOT NULL,
    proposicao_uri       VARCHAR(255),
    proposicao_titulo    VARCHAR(255),
    proposicao_ementa    TEXT,
    data                 DATE,

    PRIMARY KEY (idVotacao, proposicao_id),

    CONSTRAINT fk_vp_votacao
        FOREIGN KEY (idVotacao)
        REFERENCES votacoes_2026(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_vp_proposicao_id
        FOREIGN KEY (proposicao_id)
        REFERENCES proposicoes_2026(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_vp_proposicao_uri
        FOREIGN KEY (proposicao_uri)
        REFERENCES proposicoes_2026(uri)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

-- =========================================================
-- 10) TABELA: proposicoesTemas_2026
-- =========================================================

CREATE TABLE proposicoesTemas_2026 (
    uriProposicao     VARCHAR(255) NOT NULL,
    codTema           INTEGER NOT NULL,
    tema              VARCHAR(150) NOT NULL,
    relevancia        NUMERIC(5,2),

    PRIMARY KEY (uriProposicao, codTema),

    CONSTRAINT fk_temas_proposicao
        FOREIGN KEY (uriProposicao)
        REFERENCES proposicoes_2026(uri)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX idx_temas_uri
ON proposicoesTemas_2026(uriProposicao);

-- =========================================================
-- 11) TABELA: eventosPresencaDeputados_2026
-- =========================================================

CREATE TABLE eventosPresencaDeputados_2026 (
    idEvento         INTEGER NOT NULL,
    idDeputado       INTEGER NOT NULL,
    nomeDeputado     VARCHAR(150),
    siglaPartido     VARCHAR(20),
    siglaUf          CHAR(2),

    PRIMARY KEY (idEvento, idDeputado),

    CONSTRAINT fk_presenca_evento
        FOREIGN KEY (idEvento)
        REFERENCES eventos_2026(idEvento)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_presenca_deputado
        FOREIGN KEY (idDeputado)
        REFERENCES deputados(id_dep)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_presenca_deputado
ON eventosPresencaDeputados_2026(idDeputado);

-- =========================================================
-- 12) TABELA: deputado_escolaridade
-- =========================================================

CREATE TABLE deputado_escolaridade (
    cpf                CHAR(11) PRIMARY KEY,
    idDeputado         INTEGER UNIQUE,
    nome_candidato     VARCHAR(200) NOT NULL,
    nome_urna          VARCHAR(150),
    uf                 CHAR(2),
    cargo              VARCHAR(80) NOT NULL,
    partido            VARCHAR(20),
    grau_instrucao     VARCHAR(100) NOT NULL,
    situacao_turno     VARCHAR(100),

    CONSTRAINT fk_escolaridade_cpf
        FOREIGN KEY (cpf)
        REFERENCES deputados(cpf)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_escolaridade_deputado
        FOREIGN KEY (idDeputado)
        REFERENCES deputados(id_dep)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

-- =========================================================
-- 13) TABELA: proposicoesAutores
-- =========================================================

CREATE TABLE proposicoesAutores (
    idAutoria          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    idProposicao       INTEGER NOT NULL,
    uriProposicao      VARCHAR(255),
    idAutor            INTEGER,
    nomeAutor          VARCHAR(200) NOT NULL,
    tipoAutor          VARCHAR(80) NOT NULL,
    ordemAssinatura    INTEGER,
    pesoAutoria        NUMERIC(4,2),

    CONSTRAINT fk_autoria_proposicao
        FOREIGN KEY (idProposicao)
        REFERENCES proposicoes_2026(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_autoria_uri
        FOREIGN KEY (uriProposicao)
        REFERENCES proposicoes_2026(uri)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_autoria_deputado
        FOREIGN KEY (idAutor)
        REFERENCES deputados(id_dep)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX idx_autoria_proposicao
ON proposicoesAutores(idProposicao);

CREATE INDEX idx_autoria_autor
ON proposicoesAutores(idAutor);

-- =========================================================
-- 14) TABELA: indicadores_deputado_2026
-- =========================================================

CREATE TABLE indicadores_deputado_2026 (
    idDeputado               INTEGER PRIMARY KEY,
    nome                     VARCHAR(150) NOT NULL,
    partido                  VARCHAR(20),
    uf                       CHAR(2),
    escolaridade             VARCHAR(100),
    gasto_total              NUMERIC(14,2),
    fidelidade_partidaria    NUMERIC(5,2),
    qtd_proposicoes          INTEGER,
    presenca_eventos         INTEGER,
    presenca_plenario        INTEGER,

    CONSTRAINT fk_indicadores_deputado
        FOREIGN KEY (idDeputado)
        REFERENCES deputados(id_dep)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- =========================================================
-- COMENTÁRIOS IMPORTANTES
-- =========================================================
-- 1. O modelo contempla todas as tabelas descritas no PDF.
-- 2. Todos os relacionamentos do dicionário foram implementados.
-- 3. Foram adicionadas chaves técnicas onde o documento não
--    especificava PK explícita:
--       - Gastos_2026.idGasto
--       - votacoesObjetos_2026.idVotacaoObjeto
--       - proposicoesAutores.idAutoria
--
-- 4. O schema foi criado como "grupo4".
-- 5. Compatível com PostgreSQL 14+ e idealmente 16+.
--
-- Fonte:
-- Dossiê Grupo 4 / Dicionário de Dados. :contentReference[oaicite:0]{index=0}