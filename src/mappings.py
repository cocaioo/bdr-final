"""
Mapeamento de tabelas para o ETL da Câmara dos Deputados.

Cada entrada em TABLES define:
  - file: nome do CSV fonte na pasta de dados
  - table: nome da tabela no PostgreSQL
  - pk: colunas da PK (para deduplicação). [] = sem dedup (IDENTITY)
  - required: colunas obrigatórias (linhas com NULL nessas colunas são removidas)
  - columns: dict de {coluna_csv: (coluna_db, funcao_limpeza)}
  - skip_identity: colunas IDENTITY que NÃO devem ser incluídas no COPY
"""

from . import cleaning as C

# ============================================================
# Ordem de carga (respeita dependências de FK)
# ============================================================

LOAD_ORDER = [
    "deputados",
    "proposicoes_2026",
    "eventos_2026",
    "votacoes_2026",
    "gastos_2026",
    "votacoesvotos_2026",
    "votacoesorientacoes_2026",
    "votacoesobjetos_2026",
    "votacoesproposicoes_2026",
    "proposicoestemas_2026",
    # Tabelas sem CSV disponível (descomente quando tiver o CSV):
    # "eventospresencadeputados_2026",
    # "deputado_escolaridade",
    "proposicoesautores",
]

# ============================================================
# Ordem completa para TRUNCATE (dependentes primeiro)
# Inclui TODAS as tabelas, mesmo as sem CSV
# ============================================================

ALL_TABLES_ORDERED = [
    "deputados",
    "proposicoes_2026",
    "eventos_2026",
    "votacoes_2026",
    "gastos_2026",
    "votacoesvotos_2026",
    "votacoesorientacoes_2026",
    "votacoesobjetos_2026",
    "votacoesproposicoes_2026",
    "proposicoestemas_2026",
    "eventospresencadeputados_2026",
    "deputado_escolaridade",
    "proposicoesautores",
    "indicadores_deputado_2026",
]

TRUNCATE_ORDER = list(reversed(ALL_TABLES_ORDERED))

# ============================================================
# Definição de tabelas
# ============================================================

TABLES = {

    # ----------------------------------------------------------
    # 1. Deputados
    # ----------------------------------------------------------
    "deputados": {
        "file": "deputados.csv",
        "table": "deputados",
        "pk": ["id_dep"],
        "required": ["id_dep", "uri_dep", "nome"],
        "skip_identity": [],
        "columns": {
            "uri":       ("uri_dep",   C.clean_text),
            "_id_dep":   ("id_dep",    None),  # extraído da URI, tratado no transform
            "nome":      ("nome",      C.clean_text),
            "nomeCivil": ("nomecivil", C.clean_text),
            "cpf":       ("cpf",       C.clean_cpf),
        },
        # Transform especial: id_dep é extraído da URI
        "transform": "_deputados",
    },

    # ----------------------------------------------------------
    # 2. Proposições 2026
    # ----------------------------------------------------------
    "proposicoes_2026": {
        "file": "proposicoes-2026.csv",
        "table": "proposicoes_2026",
        "pk": ["id"],
        "required": ["id", "uri"],
        "skip_identity": [],
        "columns": {
            "id":                              ("id",                C.clean_int),
            "uri":                             ("uri",               C.clean_text),
            "siglaTipo":                       ("siglatipo",         C.clean_upper),
            "numero":                          ("numero",            C.clean_int),
            "ano":                             ("ano",               C.clean_int),
            "ementa":                          ("ementa",            C.clean_text),
            "ementaDetalhada":                 ("ementadetalhada",   C.clean_text),
            "keywords":                        ("keywords",          C.clean_text),
            "ultimoStatus_descricaoSituacao":   ("descricaosituacao", C.clean_text),
        },
    },

    # ----------------------------------------------------------
    # 3. Eventos 2026
    # ----------------------------------------------------------
    "eventos_2026": {
        "file": "eventos-2026.csv",
        "table": "eventos_2026",
        "pk": ["idevento"],
        "required": ["idevento"],
        "skip_identity": [],
        "columns": {
            "id":               ("idevento",       C.clean_int),
            "uri":              ("uri",             C.clean_text),
            "dataHoraInicio":   ("datahorainicio",  C.clean_timestamp),
            "dataHoraFim":      ("datahorafim",     C.clean_timestamp),
            "descricaoTipo":    ("descricaotipo",   C.clean_text),
            "descricao":        ("descricao",       C.clean_text),
            "localCamara.nome": ("localcamara",     C.clean_text),
        },
    },

    # ----------------------------------------------------------
    # 4. Votações 2026
    # ----------------------------------------------------------
    "votacoes_2026": {
        "file": "votacoes-2026.csv",
        "table": "votacoes_2026",
        "pk": ["id"],
        "required": ["id"],
        "skip_identity": [],
        "columns": {
            "id":         ("id",         C.clean_text),
            "data":       ("data",       C.clean_date),
            "siglaOrgao": ("siglaorgao", C.clean_upper),
            "idEvento":   ("idevento",   C.clean_int),
            "aprovacao":  ("aprovacao",  C.clean_boolean),
            "descricao":  ("descricao",  C.clean_text),
        },
        # Transform especial: idEvento=0 vira NULL
        "transform": "_votacoes",
    },

    # ----------------------------------------------------------
    # 5. Gastos 2026
    # ----------------------------------------------------------
    "gastos_2026": {
        "file": "Ano-2026.csv",
        "table": "gastos_2026",
        "pk": [],  # IDENTITY, sem dedup
        "required": ["nudeputadoid", "txnomeparlamentar", "sguf", "sgpartido", "vlrliquido"],
        "skip_identity": ["idgasto"],
        "columns": {
            "cpf":               ("cpf",               C.clean_cpf),
            "nuDeputadoId":      ("nudeputadoid",      C.clean_int),
            "txNomeParlamentar": ("txnomeparlamentar",  C.clean_text),
            "sgUF":              ("sguf",               C.clean_upper),
            "sgPartido":         ("sgpartido",          C.clean_upper),
            "vlrDocumento":      ("vlrdocumento",       C.clean_money),
            "vlrGlosa":          ("vlrglosa",           C.clean_money),
            "vlrLiquido":        ("vlrliquido",         C.clean_money),
            "txtDescricao":      ("txtdescricao",       C.clean_text),
            "txtFornecedor":     ("txtfornecedor",      C.clean_text),
        },
    },

    # ----------------------------------------------------------
    # 6. Votações Votos 2026
    # ----------------------------------------------------------
    "votacoesvotos_2026": {
        "file": "votacoesVotos-2026.csv",
        "table": "votacoesvotos_2026",
        "pk": ["idvotacao", "deputado_id"],
        "required": ["idvotacao", "deputado_id", "voto", "deputado_nome"],
        "skip_identity": [],
        "columns": {
            "idVotacao":              ("idvotacao",              C.clean_text),
            "deputado_id":            ("deputado_id",            C.clean_int),
            "voto":                   ("voto",                   C.clean_text),
            "deputado_nome":          ("deputado_nome",          C.clean_text),
            "deputado_siglaPartido":  ("deputado_siglapartido",  C.clean_upper),
            "deputado_siglaUf":       ("deputado_siglauf",       C.clean_upper),
        },
    },

    # ----------------------------------------------------------
    # 7. Votações Orientações 2026
    # ----------------------------------------------------------
    "votacoesorientacoes_2026": {
        "file": "votacoesOrientacoes-2026.csv",
        "table": "votacoesorientacoes_2026",
        "pk": ["idvotacao", "siglabancada"],
        "required": ["idvotacao", "siglabancada"],
        "skip_identity": [],
        "columns": {
            "idVotacao":    ("idvotacao",    C.clean_text),
            "siglaBancada": ("siglabancada", C.clean_text),
            "orientacao":   ("orientacao",   C.clean_text),
            "siglaOrgao":   ("siglaorgao",   C.clean_upper),
            "descricao":    ("descricao",    C.clean_text),
        },
    },

    # ----------------------------------------------------------
    # 8. Votações Objetos 2026
    # ----------------------------------------------------------
    "votacoesobjetos_2026": {
        "file": "votacoesObjetos-2026.csv",
        "table": "votacoesobjetos_2026",
        "pk": [],  # IDENTITY, sem dedup
        "required": ["idvotacao"],
        "skip_identity": ["idvotacaoobjeto"],
        "columns": {
            "idVotacao":            ("idvotacao",            C.clean_text),
            "proposicao_id":        ("proposicao_id",        C.clean_int),
            "proposicao_uri":       ("proposicao_uri",       C.clean_text),
            "proposicao_titulo":    ("proposicao_titulo",    C.clean_text),
            "proposicao_ementa":    ("proposicao_ementa",    C.clean_text),
            "proposicao_siglaTipo": ("proposicao_siglatipo", C.clean_upper),
            "proposicao_numero":    ("proposicao_numero",    C.clean_int),
            "proposicao_ano":       ("proposicao_ano",       C.clean_int),
        },
    },

    # ----------------------------------------------------------
    # 9. Votações Proposições 2026 (mesmo CSV que Objetos)
    # ----------------------------------------------------------
    "votacoesproposicoes_2026": {
        "file": "votacoesObjetos-2026.csv",
        "table": "votacoesproposicoes_2026",
        "pk": ["idvotacao", "proposicao_id"],
        "required": ["idvotacao", "proposicao_id"],
        "skip_identity": [],
        "columns": {
            "idVotacao":         ("idvotacao",         C.clean_text),
            "proposicao_id":     ("proposicao_id",     C.clean_int),
            "proposicao_uri":    ("proposicao_uri",    C.clean_text),
            "proposicao_titulo": ("proposicao_titulo", C.clean_text),
            "proposicao_ementa": ("proposicao_ementa", C.clean_text),
            "data":              ("data",              C.clean_date),
        },
    },

    # ----------------------------------------------------------
    # 10. Proposições Temas 2026
    # ----------------------------------------------------------
    "proposicoestemas_2026": {
        "file": "proposicoesTemas-2026.csv",
        "table": "proposicoestemas_2026",
        "pk": ["uriproposicao", "codtema"],
        "required": ["uriproposicao", "codtema", "tema"],
        "skip_identity": [],
        "columns": {
            "uriProposicao": ("uriproposicao", C.clean_text),
            "codTema":       ("codtema",       C.clean_int),
            "tema":          ("tema",          C.clean_text),
            "relevancia":    ("relevancia",    C.clean_decimal),
        },
    },

    # ----------------------------------------------------------
    # 11. Eventos Presença Deputados 2026 (SEM CSV)
    # ----------------------------------------------------------
    "eventospresencadeputados_2026": {
        "file": None,  # CSV não disponível
        "table": "eventospresencadeputados_2026",
        "pk": ["idevento", "iddeputado"],
        "required": ["idevento", "iddeputado"],
        "skip_identity": [],
        "columns": {
            "idEvento":     ("idevento",     C.clean_int),
            "idDeputado":   ("iddeputado",   C.clean_int),
            "nomeDeputado": ("nomedeputado", C.clean_text),
            "siglaPartido": ("siglapartido", C.clean_upper),
            "siglaUf":      ("siglauf",      C.clean_upper),
        },
    },

    # ----------------------------------------------------------
    # 12. Deputado Escolaridade (SEM CSV)
    # ----------------------------------------------------------
    "deputado_escolaridade": {
        "file": None,  # CSV não disponível
        "table": "deputado_escolaridade",
        "pk": ["cpf"],
        "required": ["cpf", "nome_candidato", "cargo", "grau_instrucao"],
        "skip_identity": [],
        "columns": {
            "cpf":            ("cpf",            C.clean_cpf),
            "idDeputado":     ("iddeputado",     C.clean_int),
            "nome_candidato": ("nome_candidato", C.clean_text),
            "nome_urna":      ("nome_urna",      C.clean_text),
            "uf":             ("uf",             C.clean_upper),
            "cargo":          ("cargo",          C.clean_text),
            "partido":        ("partido",        C.clean_text),
            "grau_instrucao": ("grau_instrucao", C.clean_text),
            "situacao_turno": ("situacao_turno", C.clean_text),
        },
    },

    # ----------------------------------------------------------
    # 13. Proposições Autores
    # ----------------------------------------------------------
    "proposicoesautores": {
        "file": "proposicoesAutores-2026.csv",
        "table": "proposicoesautores",
        "pk": [],  # IDENTITY, sem dedup
        "required": ["idproposicao", "nomeautor", "tipoautor"],
        "skip_identity": ["idautoria"],
        "columns": {
            "idProposicao":    ("idproposicao",    C.clean_int),
            "uriProposicao":   ("uriproposicao",   C.clean_text),
            "idDeputadoAutor": ("idautor",         C.clean_int),
            "nomeAutor":       ("nomeautor",       lambda v: C.clip_text(v, 200)),
            "tipoAutor":       ("tipoautor",       C.clean_text),
            "ordemAssinatura": ("ordemassinatura",  C.clean_int),
            "proponente":      ("pesoautoria",     C.clean_decimal),
        },
    },
}
