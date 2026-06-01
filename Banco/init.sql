DROP SCHEMA IF EXISTS grupo4 CASCADE;
CREATE SCHEMA grupo4;
SET search_path TO grupo4;

CREATE TABLE deputados (
    id_deputado      INTEGER PRIMARY KEY,
    uri_deputado     VARCHAR(255) NOT NULL UNIQUE,
    nome             VARCHAR(150) NOT NULL,
    nome_civil       VARCHAR(200),
    cpf              CHAR(11),
    id_legislatura_inicial INTEGER,
    id_legislatura_final   INTEGER,
    escolaridade     VARCHAR(100)
);

CREATE TABLE partidos_ideologia (
    sigla_partido    VARCHAR(20) PRIMARY KEY,
    ideologia        VARCHAR(20) NOT NULL
);

CREATE TABLE proposicoes (
    ano_dados           INTEGER NOT NULL,
    id_proposicao       INTEGER NOT NULL,
    uri_proposicao      VARCHAR(255) NOT NULL,
    sigla_tipo          VARCHAR(20),
    numero              INTEGER,
    ano                 INTEGER,
    ementa              TEXT,
    ementa_detalhada    TEXT,
    keywords            TEXT,
    descricao_situacao  VARCHAR(255),
    PRIMARY KEY (ano_dados, id_proposicao),
    UNIQUE (ano_dados, uri_proposicao)
);

CREATE TABLE eventos (
    ano_dados           INTEGER NOT NULL,
    id_evento           INTEGER NOT NULL,
    uri_evento          VARCHAR(255),
    data_hora_inicio    TIMESTAMP,
    data_hora_fim       TIMESTAMP,
    descricao_tipo      VARCHAR(150),
    descricao           TEXT,
    local_camara        VARCHAR(150),
    PRIMARY KEY (ano_dados, id_evento),
    UNIQUE (ano_dados, uri_evento)
);

CREATE TABLE votacoes (
    ano_dados      INTEGER NOT NULL,
    id_votacao     VARCHAR(80) NOT NULL,
    data_votacao   DATE,
    sigla_orgao    VARCHAR(30),
    id_evento      INTEGER,
    aprovacao      BOOLEAN,
    descricao      TEXT,
    PRIMARY KEY (ano_dados, id_votacao)
);

CREATE TABLE gastos (
    id_gasto           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ano_dados          INTEGER NOT NULL,
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

CREATE TABLE votacoes_votos (
    ano_dados      INTEGER NOT NULL,
    id_votacao     VARCHAR(80) NOT NULL,
    id_deputado    INTEGER NOT NULL,
    voto           VARCHAR(30) NOT NULL,
    nome_deputado  VARCHAR(150) NOT NULL,
    sigla_partido  VARCHAR(20),
    sigla_uf       CHAR(2),
    PRIMARY KEY (ano_dados, id_votacao, id_deputado),
    CONSTRAINT fk_votos_deputado
        FOREIGN KEY (id_deputado)
        REFERENCES deputados(id_deputado)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE votacoes_orientacoes (
    ano_dados      INTEGER NOT NULL,
    id_votacao     VARCHAR(80) NOT NULL,
    sigla_bancada  VARCHAR(30) NOT NULL,
    orientacao     VARCHAR(30),
    sigla_orgao    VARCHAR(30),
    descricao      TEXT,
    PRIMARY KEY (ano_dados, id_votacao, sigla_bancada)
);

CREATE TABLE votacoes_objetos (
    id_votacao_objeto       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ano_dados               INTEGER NOT NULL,
    id_votacao              VARCHAR(80) NOT NULL,
    id_proposicao           INTEGER,
    uri_proposicao          VARCHAR(255),
    titulo_proposicao       VARCHAR(255),
    ementa_proposicao       TEXT,
    sigla_tipo_proposicao   VARCHAR(20),
    numero_proposicao       INTEGER,
    ano_proposicao          INTEGER
);

CREATE TABLE proposicoes_temas (
    ano_dados       INTEGER NOT NULL,
    uri_proposicao  VARCHAR(255) NOT NULL,
    cod_tema        INTEGER NOT NULL,
    tema            VARCHAR(150) NOT NULL,
    relevancia      NUMERIC(5,2),
    PRIMARY KEY (ano_dados, uri_proposicao, cod_tema)
);

CREATE TABLE eventos_presenca_deputados (
    ano_dados       INTEGER NOT NULL,
    id_evento       INTEGER NOT NULL,
    id_deputado     INTEGER NOT NULL,
    nome_deputado   VARCHAR(150),
    sigla_partido   VARCHAR(20),
    sigla_uf        CHAR(2),
    PRIMARY KEY (ano_dados, id_evento, id_deputado),
    CONSTRAINT fk_presenca_deputado
        FOREIGN KEY (id_deputado)
        REFERENCES deputados(id_deputado)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE proposicoes_autores (
    id_autoria        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ano_dados         INTEGER NOT NULL,
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

CREATE INDEX idx_gastos_ano ON gastos(ano_dados);
CREATE INDEX idx_gastos_deputado ON gastos(id_deputado);
CREATE INDEX idx_gastos_partido ON gastos(sigla_partido);
CREATE INDEX idx_gastos_uf ON gastos(sigla_uf);
CREATE INDEX idx_votos_deputado ON votacoes_votos(id_deputado);
CREATE INDEX idx_votos_partido ON votacoes_votos(sigla_partido);
CREATE INDEX idx_objetos_votacao ON votacoes_objetos(ano_dados, id_votacao);
CREATE INDEX idx_objetos_proposicao ON votacoes_objetos(ano_dados, id_proposicao);
CREATE INDEX idx_temas_uri ON proposicoes_temas(ano_dados, uri_proposicao);
CREATE INDEX idx_presenca_deputado ON eventos_presenca_deputados(id_deputado);
CREATE INDEX idx_autores_deputado ON proposicoes_autores(id_deputado);
CREATE INDEX idx_autores_proposicao ON proposicoes_autores(ano_dados, id_proposicao);

CREATE OR REPLACE VIEW proposicoes_2026 AS
SELECT * FROM proposicoes WHERE ano_dados = 2026;

CREATE OR REPLACE VIEW eventos_2026 AS
SELECT * FROM eventos WHERE ano_dados = 2026;

CREATE OR REPLACE VIEW votacoes_2026 AS
SELECT * FROM votacoes WHERE ano_dados = 2026;

CREATE OR REPLACE VIEW gastos_2026 AS
SELECT * FROM gastos WHERE ano_dados = 2026;

CREATE OR REPLACE VIEW votacoes_votos_2026 AS
SELECT * FROM votacoes_votos WHERE ano_dados = 2026;

CREATE OR REPLACE VIEW votacoes_orientacoes_2026 AS
SELECT * FROM votacoes_orientacoes WHERE ano_dados = 2026;

CREATE OR REPLACE VIEW votacoes_objetos_2026 AS
SELECT * FROM votacoes_objetos WHERE ano_dados = 2026;

CREATE OR REPLACE VIEW proposicoes_temas_2026 AS
SELECT * FROM proposicoes_temas WHERE ano_dados = 2026;

CREATE OR REPLACE VIEW eventos_presenca_deputados_2026 AS
SELECT * FROM eventos_presenca_deputados WHERE ano_dados = 2026;
