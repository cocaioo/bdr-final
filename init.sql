DROP SCHEMA IF EXISTS grupo4 CASCADE;
CREATE SCHEMA grupo4;
SET search_path TO grupo4;

CREATE TABLE deputados (
    id_deputado      INTEGER PRIMARY KEY,
    uri_deputado     VARCHAR(255) NOT NULL UNIQUE,
    nome             VARCHAR(150) NOT NULL,
    nome_civil       VARCHAR(200),
    cpf              CHAR(11),
    escolaridade     VARCHAR(100)
);

CREATE TABLE partidos_ideologia (
    sigla_partido    VARCHAR(20) PRIMARY KEY,
    ideologia        VARCHAR(20) NOT NULL
);

CREATE TABLE proposicoes_2026 (
    id_proposicao       INTEGER PRIMARY KEY,
    uri_proposicao      VARCHAR(255) NOT NULL UNIQUE,
    sigla_tipo          VARCHAR(20),
    numero              INTEGER,
    ano                 INTEGER,
    ementa              TEXT,
    ementa_detalhada    TEXT,
    keywords            TEXT,
    descricao_situacao  VARCHAR(255)
);

CREATE TABLE eventos_2026 (
    id_evento           INTEGER PRIMARY KEY,
    uri_evento          VARCHAR(255) UNIQUE,
    data_hora_inicio    TIMESTAMP,
    data_hora_fim       TIMESTAMP,
    descricao_tipo      VARCHAR(150),
    descricao           TEXT,
    local_camara        VARCHAR(150)
);

CREATE TABLE votacoes_2026 (
    id_votacao     VARCHAR(80) PRIMARY KEY,
    data_votacao   DATE,
    sigla_orgao    VARCHAR(30),
    id_evento      INTEGER,
    aprovacao      BOOLEAN,
    descricao      TEXT,
    CONSTRAINT fk_votacoes_evento
        FOREIGN KEY (id_evento)
        REFERENCES eventos_2026(id_evento)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE TABLE gastos_2026 (
    id_gasto           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cpf                CHAR(11),
    id_deputado        INTEGER NOT NULL,
    nome_parlamentar   VARCHAR(150) NOT NULL,
    sigla_uf           CHAR(2) NOT NULL,
    sigla_partido      VARCHAR(20) NOT NULL,
    valor_documento    NUMERIC(14,2),
    valor_glosa        NUMERIC(14,2),
    valor_liquido      NUMERIC(14,2) NOT NULL,
    descricao_despesa  VARCHAR(255),
    fornecedor         VARCHAR(255),
    CONSTRAINT fk_gastos_deputado
        FOREIGN KEY (id_deputado)
        REFERENCES deputados(id_deputado)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE votacoes_votos_2026 (
    id_votacao     VARCHAR(80) NOT NULL,
    id_deputado    INTEGER NOT NULL,
    voto           VARCHAR(30) NOT NULL,
    nome_deputado  VARCHAR(150) NOT NULL,
    sigla_partido  VARCHAR(20),
    sigla_uf       CHAR(2),
    PRIMARY KEY (id_votacao, id_deputado),
    CONSTRAINT fk_votos_votacao
        FOREIGN KEY (id_votacao)
        REFERENCES votacoes_2026(id_votacao)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_votos_deputado
        FOREIGN KEY (id_deputado)
        REFERENCES deputados(id_deputado)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE votacoes_orientacoes_2026 (
    id_votacao     VARCHAR(80) NOT NULL,
    sigla_bancada  VARCHAR(30) NOT NULL,
    orientacao     VARCHAR(30),
    sigla_orgao    VARCHAR(30),
    descricao      TEXT,
    PRIMARY KEY (id_votacao, sigla_bancada),
    CONSTRAINT fk_orientacoes_votacao
        FOREIGN KEY (id_votacao)
        REFERENCES votacoes_2026(id_votacao)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE votacoes_objetos_2026 (
    id_votacao_objeto       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_votacao              VARCHAR(80) NOT NULL,
    id_proposicao           INTEGER,
    uri_proposicao          VARCHAR(255),
    titulo_proposicao       VARCHAR(255),
    ementa_proposicao       TEXT,
    sigla_tipo_proposicao   VARCHAR(20),
    numero_proposicao       INTEGER,
    ano_proposicao          INTEGER,
    CONSTRAINT fk_objetos_votacao
        FOREIGN KEY (id_votacao)
        REFERENCES votacoes_2026(id_votacao)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE proposicoes_temas_2026 (
    uri_proposicao  VARCHAR(255) NOT NULL,
    cod_tema        INTEGER NOT NULL,
    tema            VARCHAR(150) NOT NULL,
    relevancia      NUMERIC(5,2),
    PRIMARY KEY (uri_proposicao, cod_tema),
    CONSTRAINT fk_temas_proposicao
        FOREIGN KEY (uri_proposicao)
        REFERENCES proposicoes_2026(uri_proposicao)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE eventos_presenca_deputados_2026 (
    id_evento       INTEGER NOT NULL,
    id_deputado     INTEGER NOT NULL,
    nome_deputado   VARCHAR(150),
    sigla_partido   VARCHAR(20),
    sigla_uf        CHAR(2),
    PRIMARY KEY (id_evento, id_deputado),
    CONSTRAINT fk_presenca_deputado
        FOREIGN KEY (id_deputado)
        REFERENCES deputados(id_deputado)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE proposicoes_autores (
    id_autoria        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_proposicao     INTEGER NOT NULL,
    uri_proposicao    VARCHAR(255),
    id_deputado       INTEGER,
    nome_autor        VARCHAR(200) NOT NULL,
    tipo_autor        VARCHAR(80) NOT NULL,
    sigla_partido     VARCHAR(20),
    sigla_uf          CHAR(2),
    ordem_assinatura  INTEGER,
    peso_autoria      NUMERIC(4,2)
);

CREATE INDEX idx_gastos_deputado ON gastos_2026(id_deputado);
CREATE INDEX idx_gastos_partido ON gastos_2026(sigla_partido);
CREATE INDEX idx_gastos_uf ON gastos_2026(sigla_uf);
CREATE INDEX idx_votos_deputado ON votacoes_votos_2026(id_deputado);
CREATE INDEX idx_votos_partido ON votacoes_votos_2026(sigla_partido);
CREATE INDEX idx_objetos_votacao ON votacoes_objetos_2026(id_votacao);
CREATE INDEX idx_objetos_proposicao ON votacoes_objetos_2026(id_proposicao);
CREATE INDEX idx_temas_uri ON proposicoes_temas_2026(uri_proposicao);
CREATE INDEX idx_presenca_deputado ON eventos_presenca_deputados_2026(id_deputado);
CREATE INDEX idx_autores_deputado ON proposicoes_autores(id_deputado);
CREATE INDEX idx_autores_proposicao ON proposicoes_autores(id_proposicao);
