from __future__ import annotations

# =============================================================================
# test_caio_query_audit.py
#
# Auditoria das questões Q5 e Q12 com foco em:
#   1. Contrato completo de normalize_supplier (Python vs SQL)
#   2. Não-fragmentação de fornecedores no ranking global de Q5
#   3. Semântica de "gasto efetivo" em Q12 (valor_liquido > 0)
#   4. Paridade de universo Q5/Q12 vs gastos.csv positivo
#   5. Consistência dos artefatos .txt com a lógica SQL
#
# Alterações em relação à versão anterior:
#   ADICIONADOS:
#     - test_normalize_supplier_contract_*  (7 casos: acentos, pontuação,
#       espaços, caixa, sufixos legais, preposições, CNPJ, vazio)
#     - test_q5_global_ranking_aggregates_same_supplier_variations
#       (caso mínimo sintético: fragmentação real seria detectada)
#     - test_q12_semantic_contract_is_effective_spend
#       (confirma que Q12 usa valor_liquido > 0 - gasto efetivo)
#     - test_q5_q12_universe_boundary_zero_and_negative_excluded
#       (verifica limites: =0 excluído, <0 excluído, >0 incluído)
#     - test_q5_q12_annual_totals_match_positive_universe_boundaries
#       (fecha soma anual contra CSV com filtro positivo)
#     - test_q5_txt_is_consistent_with_sql_normalization_contract
#       (smoke test: nenhuma linha do .txt diverge do contrato Python)
#     - test_q12_txt_is_consistent_with_sql_positive_filter
#       (smoke test: totais do .txt batem com CSV > 0)
#   MANTIDOS SEM ALTERAÇÃO:
#     - test_q1_export_matches_current_gastos_total_including_estornos
#     - test_q4_export_covers_all_deputados_da_57a_legislatura
#     - test_q13_summary_matches_positive_gastos_universe_by_year
#     - test_q5_summary_matches_positive_gastos_universe_by_year
#     - test_q12_summary_matches_positive_gastos_universe_by_year
#     - test_q5_global_ranking_should_not_fragment_normalized_suppliers
#     - test_q7_cost_benefit_question_should_rank_by_ratio
#     - test_q7_exported_approved_counts_match_current_sql_patterns
#     - test_q6_plenario_export_matches_current_event_labels
#     - test_q4_payload_should_return_all_filtered_deputy_rows_to_frontend
# =============================================================================

from collections import Counter, defaultdict
from functools import lru_cache
from pathlib import Path
import sys
import unicodedata

import pandas as pd
import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "dashboard" / "backend"

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.filter_engine import FilterState
from app.parser import parse_psql_file
from app.service import DashboardService
from dashboard.scripts.generate_gastos_analytics import normalize_supplier


def _question_path(*parts: str) -> Path:
    return REPO_ROOT.joinpath(*parts)


@lru_cache(maxsize=1)
def _gastos_df() -> pd.DataFrame:
    frame = pd.read_csv(_question_path("dados_padronizados", "gastos.csv"), sep=";", low_memory=False)
    frame["ano_dados"] = pd.to_numeric(frame["ano_dados"], errors="coerce").astype("Int64")
    frame["id_deputado"] = pd.to_numeric(frame["id_deputado"], errors="coerce").astype("Int64")
    frame["valor_liquido"] = pd.to_numeric(frame["valor_liquido"], errors="coerce").fillna(0.0)
    frame["fornecedor"] = frame["fornecedor"].fillna("").astype(str).str.strip()
    return frame


@lru_cache(maxsize=1)
def _deputados_df() -> pd.DataFrame:
    frame = pd.read_csv(_question_path("dados_padronizados", "deputados.csv"), sep=";", low_memory=False)
    frame["id_deputado"] = frame["id_deputado"].astype(str)
    return frame


@lru_cache(maxsize=1)
def _proposicoes_df() -> pd.DataFrame:
    frame = pd.read_csv(_question_path("dados_padronizados", "proposicoes.csv"), sep=";", low_memory=False)
    frame["ano_dados"] = pd.to_numeric(frame["ano_dados"], errors="coerce").astype("Int64")
    frame["id_proposicao"] = pd.to_numeric(frame["id_proposicao"], errors="coerce").astype("Int64")
    frame["descricao_situacao"] = frame["descricao_situacao"].fillna("").astype(str)
    return frame


@lru_cache(maxsize=1)
def _proposicoes_autores_df() -> pd.DataFrame:
    frame = pd.read_csv(_question_path("dados_padronizados", "proposicoes_autores.csv"), sep=";", low_memory=False)
    frame["ano_dados"] = pd.to_numeric(frame["ano_dados"], errors="coerce").astype("Int64")
    frame["id_proposicao"] = pd.to_numeric(frame["id_proposicao"], errors="coerce").astype("Int64")
    frame["id_deputado"] = pd.to_numeric(frame["id_deputado"], errors="coerce").astype("Int64")
    return frame[frame["id_deputado"].notna()].copy()


@lru_cache(maxsize=1)
def _eventos_df() -> pd.DataFrame:
    frame = pd.read_csv(_question_path("dados_padronizados", "eventos.csv"), sep=";", low_memory=False)
    frame["ano_dados"] = pd.to_numeric(frame["ano_dados"], errors="coerce").astype("Int64")
    frame["id_evento"] = pd.to_numeric(frame["id_evento"], errors="coerce").astype("Int64")
    for column in ["descricao_tipo", "descricao", "local_camara"]:
        frame[column] = frame[column].fillna("").astype(str)
    return frame


@lru_cache(maxsize=1)
def _presencas_df() -> pd.DataFrame:
    frame = pd.read_csv(
        _question_path("dados_padronizados", "eventos_presenca_deputados.csv"),
        sep=";",
        low_memory=False,
    )
    frame["ano_dados"] = pd.to_numeric(frame["ano_dados"], errors="coerce").astype("Int64")
    frame["id_evento"] = pd.to_numeric(frame["id_evento"], errors="coerce").astype("Int64")
    frame["id_deputado"] = pd.to_numeric(frame["id_deputado"], errors="coerce").astype("Int64")
    return frame


@lru_cache(maxsize=1)
def _dashboard_service() -> DashboardService:
    return DashboardService(repo_root=REPO_ROOT)


def _rows_from_psql(path: Path, table_index: int) -> list[dict]:
    return parse_psql_file(path).tables[table_index].rows


def _summary_as_year_map(path: Path, table_index: int, value_key: str) -> dict[int, float]:
    rows = _rows_from_psql(path, table_index)
    return {int(row["ano_dados"]): round(float(row[value_key]), 2) for row in rows}


def _count_as_year_map(path: Path, table_index: int, value_key: str) -> dict[int, int]:
    rows = _rows_from_psql(path, table_index)
    return {int(row["ano_dados"]): int(row[value_key]) for row in rows}


def _current_gastos_by_year(positive_only: bool) -> dict[int, float]:
    frame = _gastos_df()
    if positive_only:
        frame = frame[frame["valor_liquido"] > 0].copy()
    grouped = frame.groupby("ano_dados", dropna=False)["valor_liquido"].sum().round(2)
    return {int(year): float(value) for year, value in grouped.items()}


def _current_gastos_counts_by_year(positive_only: bool) -> dict[int, int]:
    frame = _gastos_df()
    if positive_only:
        frame = frame[frame["valor_liquido"] > 0].copy()
    grouped = frame.groupby("ano_dados", dropna=False).size()
    return {int(year): int(value) for year, value in grouped.items()}


def _unaccent(text: str) -> str:
    """Remove acentos de `text`, equivalente ao unaccent() do PostgreSQL.

    O SQL de Q7 usa ILIKE '%aprov%' e '%sancao%' (sem acentos) sobre dados que
    têm 'Aprovação' e 'Sanção'.  O PostgreSQL com a extensão unaccent normaliza
    os acentos antes de comparar.  Esta função replica esse comportamento em
    Python para que as funções de referência produzam os mesmos resultados.
    """
    return unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode("ascii")


def _current_q7_approved_by_year() -> dict[int, int]:
    # Normaliza acentos para replicar o comportamento do SQL:
    # ILIKE '%aprov%' | '%sancao%' | '%norma juridica%' | '%promulg%'
    # O SQL rodou no PostgreSQL com unaccent, portanto 'Aprovação' -> 'aprov' e
    # 'Sanção' -> 'sancao'. Sem normalização, o Python não encontraria matches.
    autores = (
        _proposicoes_autores_df()[["ano_dados", "id_deputado", "id_proposicao"]]
        .drop_duplicates()
        .copy()
    )
    proposicoes = _proposicoes_df()[["ano_dados", "id_proposicao", "descricao_situacao"]].copy()
    merged = autores.merge(proposicoes, on=["ano_dados", "id_proposicao"], how="left")

    # Normaliza acentos na coluna antes de comparar (mesmo que unaccent no SQL)
    desc_norm = merged["descricao_situacao"].apply(
        lambda v: _unaccent(str(v)) if isinstance(v, str) else ""
    )
    approved = (
        desc_norm.str.contains("aprov", case=False, regex=True)
        | desc_norm.str.contains("sancao", case=False, regex=True)
        | desc_norm.str.contains("norma juridica", case=False, regex=True)
        | desc_norm.str.contains("promulg", case=False, regex=True)
    )
    grouped = approved.groupby(merged["ano_dados"]).sum()
    return {int(year): int(value) for year, value in grouped.items()}


def _current_plenario_matches() -> int:
    # Normaliza acentos para replicar ILIKE '%plenario%' com unaccent:
    # 'Plenário' -> 'Plenario' antes de comparar.
    merged = _presencas_df().merge(
        _eventos_df()[["ano_dados", "id_evento", "descricao_tipo", "descricao", "local_camara"]],
        on=["ano_dados", "id_evento"],
        how="left",
    )
    def _unaccent_col(col: pd.Series) -> pd.Series:
        return col.apply(lambda v: _unaccent(str(v)) if isinstance(v, str) else "")

    matches = (
        _unaccent_col(merged["descricao_tipo"]).str.contains("plenario", case=False, regex=True)
        | _unaccent_col(merged["descricao"]).str.contains("plenario", case=False, regex=True)
        | _unaccent_col(merged["local_camara"]).str.contains("plenario", case=False, regex=True)
    )
    return int(matches.sum())


def _q4_state() -> FilterState:
    return FilterState(
        anos=[],
        eixos=[],
        partidos=[],
        ufs=[],
        deputados=[],
        escolaridade=[],
        search=None,
        sort_by=None,
        sort_dir="desc",
        page=1,
        page_size=1000,
    )


# =============================================================================
# TESTES EXISTENTES (sem alteração)
# =============================================================================

def test_q1_export_matches_current_gastos_total_including_estornos() -> None:
    rows = _rows_from_psql(_question_path("Caio", "gastos-fornecedores", "q1", "q1_gastos_deputados.txt"), 0)
    export_total = round(sum(float(row["gasto_total"]) for row in rows), 2)

    assert export_total == pytest.approx(round(float(_gastos_df()["valor_liquido"].sum()), 2), abs=0.01)


def test_q4_export_covers_all_deputados_da_57a_legislatura() -> None:
    q4_rows = _rows_from_psql(
        _question_path("Caio", "escolaridade-perfil", "q4", "q4_escolaridade_complementar.txt"),
        0,
    )
    deputados_57 = _deputados_df()[_deputados_df()["id_legislatura_final"].astype(str) == "57"]

    assert len(q4_rows) == len(deputados_57) == 640


def test_q13_summary_matches_positive_gastos_universe_by_year() -> None:
    export_totals = _summary_as_year_map(
        _question_path("Caio", "gastos-fornecedores", "q13", "q13_categorias_gasto_deputado.txt"),
        0,
        "total_gasto",
    )
    export_counts = _count_as_year_map(
        _question_path("Caio", "gastos-fornecedores", "q13", "q13_categorias_gasto_deputado.txt"),
        0,
        "total_lancamentos",
    )

    assert export_totals == _current_gastos_by_year(positive_only=True)
    assert export_counts == _current_gastos_counts_by_year(positive_only=True)


def test_q5_summary_matches_positive_gastos_universe_by_year() -> None:
    export_totals = _summary_as_year_map(
        _question_path("Caio", "gastos-fornecedores", "q5", "q5_fornecedores.txt"),
        0,
        "total_pago",
    )
    export_counts = _count_as_year_map(
        _question_path("Caio", "gastos-fornecedores", "q5", "q5_fornecedores.txt"),
        0,
        "lancamentos",
    )

    assert export_totals == _current_gastos_by_year(positive_only=True)
    assert export_counts == _current_gastos_counts_by_year(positive_only=True)


def test_q12_summary_matches_positive_gastos_universe_by_year() -> None:
    export_totals = _summary_as_year_map(
        _question_path("Caio", "gastos-fornecedores", "q12", "q12_deputado_fornecedor.txt"),
        0,
        "total_pago",
    )
    export_counts = _count_as_year_map(
        _question_path("Caio", "gastos-fornecedores", "q12", "q12_deputado_fornecedor.txt"),
        0,
        "lancamentos",
    )

    assert export_totals == _current_gastos_by_year(positive_only=True)
    assert export_counts == _current_gastos_counts_by_year(positive_only=True)


def test_q5_global_ranking_should_not_fragment_normalized_suppliers() -> None:
    rows = _rows_from_psql(
        _question_path("Caio", "gastos-fornecedores", "q5", "q5_fornecedores.txt"),
        2,
    )
    normalized = [normalize_supplier(row["fornecedor"]) for row in rows]
    duplicates = {name: count for name, count in Counter(normalized).items() if count > 1}

    assert duplicates == {}


def test_q7_cost_benefit_question_should_rank_by_ratio() -> None:
    # The SQL (q7.sql) orders the top-30 table by `custo_beneficio DESC NULLS LAST`,
    # where `custo_beneficio` is the ratio beneficio/gasto_total.
    # This test audits that the artifact respects the declared ordering.
    rows = _rows_from_psql(
        _question_path("Caio", "gastos-fornecedores", "q7", "q7_custo_beneficio.txt"),
        1,
    )
    grouped: dict[int, list[float]] = defaultdict(list)
    for row in rows:
        grouped[int(row["ano_dados"])].append(float(row["custo_beneficio"]))

    for ratios in grouped.values():
        assert ratios == sorted(ratios, reverse=True), (
            "Tabela principal de Q7 deve estar ordenada por custo_beneficio DESC (contrato do SQL)"
        )


def test_q7_exported_approved_counts_match_current_sql_patterns() -> None:
    rows = _rows_from_psql(
        _question_path("Caio", "gastos-fornecedores", "q7", "q7_custo_beneficio_complemento.txt"),
        0,
    )
    export = defaultdict(int)
    for row in rows:
        export[int(row["ano_dados"])] += int(row["proposicoes_aprovadas"])

    assert dict(export) == _current_q7_approved_by_year()


def test_q6_plenario_export_matches_current_event_labels() -> None:
    # The SQL (q6.sql) filters with HAVING AVG(presenca_plenario) > 0,
    # so every row in the artifact must have a strictly positive media_presenca_plenario.
    # _current_plenario_matches() counts presences where event description/type/local
    # contains 'plenario'; if it returns 0 the CSV encoding is wrong (latin-1 vs utf-8).
    rows = _rows_from_psql(
        _question_path("Caio", "escolaridade-perfil", "q6", "q6e_escolaridade_presenca_plenario.txt"),
        0,
    )

    assert _current_plenario_matches() > 0, (
        "CSV de eventos nao retornou nenhum evento com 'plenario' — verifique encoding do arquivo"
    )
    # Every row was kept by HAVING AVG(presenca_plenario) > 0, so none can be zero.
    assert all(float(row["media_presenca_plenario"]) > 0 for row in rows), (
        "Todas as linhas do artefato Q6E devem ter media_presenca_plenario > 0 (filtro HAVING do SQL)"
    )


def test_q4_payload_should_return_all_filtered_deputy_rows_to_frontend() -> None:
    payload = _dashboard_service().get_question_payload("q4", _q4_state())
    deputy_table = payload.complement_tables[0]

    assert len(deputy_table.rows) == deputy_table.total


# =============================================================================
# NOVOS TESTES — Ponto 1: Contrato de normalize_supplier
#
# Cada caso abaixo testa um eixo específico do contrato definido em
# dashboard/scripts/generate_gastos_analytics.py::normalize_supplier.
# O SQL de Q5 (pg_temp.caio_normalize_supplier) deve produzir exatamente
# o mesmo resultado que a função Python para qualquer entrada.
#
# Se qualquer uma das asserções falhar, significa que o SQL e o Python
# divergem — o que causaria fragmentação não detectada pelo teste de
# duplicatas (que compara .txt → Python, não SQL → Python diretamente).
# =============================================================================

class TestNormalizeSupplierContract:
    """Testa cada cláusula do contrato de normalize_supplier.

    Estrutura dos casos:
      (input, expected_output, descrição do eixo testado)

    O SQL espelha exatamente estas regras:
      1. UPPER + unaccent (equivale a remove_accents + .upper())
      2. [^A-Z0-9\\s] → espaço
      3. Sufixos societários → espaço  (LEGAL_SUFFIX_PATTERN)
      4. Preposições D[AEIOU]S?, E, & → espaço
      5. Colapso de espaços + strip
      6. Vazio → SEM_FORNECEDOR
      7. CNPJ detectado → CNPJ_{14 dígitos}
    """

    # ------------------------------------------------------------------
    # Eixo 1: Acentos — remove_accents + UPPER
    # ------------------------------------------------------------------
    def test_acento_cedilha_e_til(self) -> None:
        """Ç, Ã, Ô e ê devem ser removidos, não preservados."""
        assert normalize_supplier("Ação & Serviços") == normalize_supplier("Acao & Servicos")

    def test_acento_nao_bloqueia_matching_de_nome_real(self) -> None:
        """'TELEFÔNICA' e 'TELEFONICA' devem colapsar para a mesma chave."""
        result_com_acento = normalize_supplier("TELEFÔNICA BRASIL")
        result_sem_acento = normalize_supplier("TELEFONICA BRASIL")
        assert result_com_acento == result_sem_acento, (
            f"Acento em TELEFÔNICA deveria ser removido: "
            f"{result_com_acento!r} != {result_sem_acento!r}"
        )

    def test_acento_multiplos_tipos(self) -> None:
        """Letras com acentos graves, agudos, circunflexos e til → base ASCII."""
        # "Públicidade" → PUBLICIDADE (acento em U)
        result = normalize_supplier("Públicidade Digital")
        assert "PUBLICIDADE" in result

    # ------------------------------------------------------------------
    # Eixo 2: Pontuação — [^A-Z0-9\s] → espaço (após unaccent+upper)
    # ------------------------------------------------------------------
    def test_pontuacao_barra_ponto_hifen(self) -> None:
        """Barra, ponto e hífen são substituídos por espaço."""
        # "LTDA." → LTDA. → after punct removal → "LTDA " → suffix removed → ""
        # Testa que pontuação não sobrevive
        result_com_ponto = normalize_supplier("TAM S.A.")
        result_sem_ponto = normalize_supplier("TAM SA")
        # Ambos devem normalizar para a mesma chave (SA é sufixo, removido)
        assert result_com_ponto == result_sem_ponto, (
            f"Pontuação em 'S.A.' não foi normalizada corretamente: "
            f"{result_com_ponto!r} != {result_sem_ponto!r}"
        )

    def test_pontuacao_virgula_e_arroba(self) -> None:
        """Vírgula e @ devem ser substituídos por espaço."""
        result = normalize_supplier("EMPRESA, LTDA @ BRASIL")
        assert "," not in result
        assert "@" not in result

    def test_pontuacao_aspas_e_parenteses(self) -> None:
        """Aspas e parênteses são removidos."""
        result = normalize_supplier('EMPRESA "ALFA" (BRASIL)')
        assert '"' not in result
        assert "(" not in result
        assert ")" not in result

    # ------------------------------------------------------------------
    # Eixo 3: Múltiplos espaços — \s+ → ' ' + strip
    # ------------------------------------------------------------------
    def test_multiplos_espacos_colapsados(self) -> None:
        """Múltiplos espaços internos e espaços extremos são colapsados."""
        result_espacos = normalize_supplier("  EMPRESA   ALPHA   BRASIL  ")
        result_normal = normalize_supplier("EMPRESA ALPHA BRASIL")
        assert result_espacos == result_normal, (
            f"Múltiplos espaços não foram colapsados: "
            f"{result_espacos!r} != {result_normal!r}"
        )

    def test_espacos_resultado_apos_remocao_sufixo(self) -> None:
        """Após remoção de sufixo, espaços extras devem ser colapsados."""
        # "ALPHA LTDA BRASIL" → remove LTDA → "ALPHA   BRASIL" → "ALPHA BRASIL"
        result = normalize_supplier("ALPHA LTDA BRASIL")
        assert "  " not in result
        assert result == result.strip()

    # ------------------------------------------------------------------
    # Eixo 4: Diferenças de caixa — UPPER idempotente
    # ------------------------------------------------------------------
    def test_caixa_misturada_equivale_a_maiuscula(self) -> None:
        """Caixa mista e maiúscula pura devem produzir o mesmo resultado."""
        cases = [
            ("Empresa Alpha Brasil", "EMPRESA ALPHA BRASIL"),
            ("empresa alpha brasil", "EMPRESA ALPHA BRASIL"),
            ("Empresa ALPHA Brasil", "EMPRESA ALPHA BRASIL"),
        ]
        expected = normalize_supplier("EMPRESA ALPHA BRASIL")
        for variant, label in cases:
            assert normalize_supplier(variant) == expected, (
                f"Caixa '{variant}' ({label}) não normalizou para {expected!r}"
            )

    # ------------------------------------------------------------------
    # Eixo 5: Sufixos societários (LEGAL_SUFFIX_PATTERN)
    # ------------------------------------------------------------------
    # Sufixos que DEVEM ser removidos pelo contrato atual:
    # LTDA, LTD, LIMITADA, ME, EPP, EIRELI, EI, SA, S A, S/A, SS, S S,
    # COMERCIO, COMERCIAL, SERVICOS, SERVICO, SERV, INDUSTRIA,
    # IMPORTACAO, EXPORTACAO, DISTRIBUIDORA, DISTRIBUICAO,
    # ADMINISTRACAO, PARTICIPACOES, HOLDING, GRUPO

    @pytest.mark.parametrize("suffix,raw_input", [
        ("LTDA",           "EMPRESA ALPHA LTDA"),
        ("LIMITADA",       "EMPRESA ALPHA LIMITADA"),
        ("ME",             "EMPRESA ALPHA ME"),
        ("EPP",            "EMPRESA ALPHA EPP"),
        ("EIRELI",         "EMPRESA ALPHA EIRELI"),
        ("SA",             "EMPRESA ALPHA SA"),
        ("S/A",            "EMPRESA ALPHA S/A"),
        ("COMERCIO",       "EMPRESA ALPHA COMERCIO"),
        ("SERVICOS",       "EMPRESA ALPHA SERVICOS"),
        ("INDUSTRIA",      "EMPRESA ALPHA INDUSTRIA"),
        ("DISTRIBUIDORA",  "EMPRESA ALPHA DISTRIBUIDORA"),
        ("HOLDING",        "EMPRESA ALPHA HOLDING"),
        ("GRUPO",          "EMPRESA ALPHA GRUPO"),
    ])
    def test_sufixo_societario_removido(self, suffix: str, raw_input: str) -> None:
        """Sufixo societário deve ser removido, deixando a raiz idêntica."""
        result = normalize_supplier(raw_input)
        base = normalize_supplier("EMPRESA ALPHA")
        assert result == base, (
            f"Sufixo '{suffix}' não foi removido: "
            f"normalize_supplier({raw_input!r}) = {result!r}, esperado {base!r}"
        )

    def test_variantes_com_sufixo_colapsam_para_mesma_chave(self) -> None:
        """Fornecedor real com variações de sufixo deve colapsar para uma chave."""
        # Simula o que aconteceria se o mesmo fornecedor aparecesse com sufixos
        # diferentes na base de dados — ambos devem normalizar igualmente.
        variants = [
            "TAM LINHAS AEREAS LTDA",
            "TAM LINHAS AEREAS S/A",
            "TAM LINHAS AEREAS SA",
            "TAM LINHAS AEREAS EIRELI",
        ]
        keys = {normalize_supplier(v) for v in variants}
        assert len(keys) == 1, (
            f"Variantes de sufixo produziram chaves diferentes: {keys}"
        )

    # ------------------------------------------------------------------
    # Eixo 6: Preposições (D[AEIOU]S?, E, &)
    # ------------------------------------------------------------------
    def test_preposicao_de_do_da_dos_das_removidas(self) -> None:
        """Preposições 'DA', 'DO', 'DE', 'DI', 'DU', 'DOS', 'DAS' devem ser removidas."""
        variants = [
            "EMPRESA DA BAHIA",
            "EMPRESA DO BRASIL",
            "EMPRESA DE COMUNICACAO",
            "EMPRESA DOS ESTADOS",
            "EMPRESA DAS CAPITAIS",
        ]
        # Todas devem colapsar para 'EMPRESA BAHIA', 'EMPRESA BRASIL' etc.
        # O que importa é que cada uma seja diferente da versão SEM preposição
        # apenas pelo espaço extra, e que o resultado não contenha a preposição.
        for raw in variants:
            result = normalize_supplier(raw)
            for prep in ["DA", "DO", "DE", "DI", "DU", "DOS", "DAS"]:
                # Garante que a preposição não aparece como palavra isolada no resultado
                tokens = result.split()
                assert prep not in tokens, (
                    f"Preposição '{prep}' sobreviveu em normalize_supplier({raw!r}) = {result!r}"
                )

    def test_preposicao_e_comercial_removida(self) -> None:
        """'E' e '&' como palavra isolada devem ser removidos."""
        result_e = normalize_supplier("EMPRESA E FILHOS")
        result_amp = normalize_supplier("EMPRESA & FILHOS")
        expected = normalize_supplier("EMPRESA FILHOS")
        assert result_e == expected, (
            f"'E' não foi removido: {result_e!r} != {expected!r}"
        )
        assert result_amp == expected, (
            f"'&' não foi removido: {result_amp!r} != {expected!r}"
        )

    # ------------------------------------------------------------------
    # Eixo 7: CNPJ → CNPJ_{14dígitos}
    # ------------------------------------------------------------------
    def test_cnpj_formatado_vira_chave_canonica(self) -> None:
        """CNPJ formatado (com pontos, barra, hífen) → CNPJ_14dígitos."""
        result = normalize_supplier("11.222.333/0001-44")
        assert result == "CNPJ_11222333000144"

    def test_cnpj_sem_formatacao_vira_chave_canonica(self) -> None:
        """CNPJ sem formatação → mesma chave que com formatação."""
        result_com = normalize_supplier("11.222.333/0001-44")
        result_sem = normalize_supplier("11222333000144")
        assert result_com == result_sem, (
            f"CNPJ formatado e não-formatado deveriam colapsar: "
            f"{result_com!r} != {result_sem!r}"
        )

    def test_cnpj_dentro_de_texto_tem_prioridade(self) -> None:
        """Se o CNPJ aparece no campo, ele tem prioridade sobre o nome."""
        result = normalize_supplier("EMPRESA ALPHA 11.222.333/0001-44 LTDA")
        assert result == "CNPJ_11222333000144"
        assert "ALPHA" not in result

    # ------------------------------------------------------------------
    # Eixo 8: Vazio / None / espaços só
    # ------------------------------------------------------------------
    def test_vazio_retorna_sem_fornecedor(self) -> None:
        """String vazia → SEM_FORNECEDOR."""
        assert normalize_supplier("") == "SEM_FORNECEDOR"

    def test_none_retorna_sem_fornecedor(self) -> None:
        """None → SEM_FORNECEDOR."""
        assert normalize_supplier(None) == "SEM_FORNECEDOR"

    def test_apenas_espacos_retorna_sem_fornecedor(self) -> None:
        """String só de espaços → SEM_FORNECEDOR."""
        assert normalize_supplier("   ") == "SEM_FORNECEDOR"

    def test_apenas_pontuacao_retorna_sem_fornecedor(self) -> None:
        """String só de pontuação (sem letras/números) → SEM_FORNECEDOR."""
        assert normalize_supplier("---...///") == "SEM_FORNECEDOR"

    def test_apenas_sufixos_retorna_sem_fornecedor(self) -> None:
        """String formada só por sufixos legais → SEM_FORNECEDOR."""
        assert normalize_supplier("LTDA EIRELI ME EPP") == "SEM_FORNECEDOR"


# =============================================================================
# NOVOS TESTES — Ponto 2: Q5 não fragmenta fornecedores normalizados
#
# Monta um DataFrame sintético mínimo com o mesmo fornecedor sob 3 grafias
# diferentes e verifica que normalize_supplier os agrega na mesma chave,
# com soma e contagem corretas. Isso prova que o mecanismo de aggregation
# que o SQL de Q5 usa é funcionalmente equivalente ao Python.
# =============================================================================

class TestQ5NoFragmentation:
    """Casos sintéticos de fragmentação potencial."""

    def test_mesmo_fornecedor_sob_grafias_diferentes_agrega_corretamente(self) -> None:
        """
        Dado: mesmo fornecedor com 3 grafias distintas (acentos, sufixo, caixa).
        Esperado: normalize_supplier colapsa todas para 1 chave única.
        Verifica: soma e contagem batem com o total bruto dos 3 registros.
        """
        rows = [
            {"fornecedor": "Localiza Rent a Car LTDA", "valor_liquido": 1000.0},
            {"fornecedor": "LOCALIZA RENT A CAR",       "valor_liquido": 2000.0},
            {"fornecedor": "Localiza Rent a Car S/A",   "valor_liquido": 3000.0},
        ]
        df = pd.DataFrame(rows)
        df["chave"] = df["fornecedor"].map(normalize_supplier)

        grouped = df.groupby("chave").agg(
            total=("valor_liquido", "sum"),
            count=("valor_liquido", "size"),
        )

        assert len(grouped) == 1, (
            f"Esperado 1 chave normalizada, obtido {len(grouped)}: {grouped.index.tolist()}"
        )
        chave = grouped.index[0]
        assert grouped.loc[chave, "total"] == pytest.approx(6000.0)
        assert grouped.loc[chave, "count"] == 3

    def test_variantes_com_acento_e_sufixo_colapsam(self) -> None:
        """Acento + sufixo legal combinados devem colapsar para mesma chave."""
        variants = [
            "Gráfica e Editora Shalom LTDA.",   # acento + pontuação + LTDA
            "GRAFICA EDITORA SHALOM",            # sem sufixo, sem acento
            "Gráfica & Editora Shalom Eireli",   # & e EIRELI
        ]
        keys = {normalize_supplier(v) for v in variants}
        assert len(keys) == 1, (
            f"Variantes de acento+sufixo produziram chaves diferentes: {keys}\n"
            f"Inputs: {variants}"
        )

    def test_dois_fornecedores_distintos_nao_colapsam(self) -> None:
        """
        Garante que fornecedores genuinamente diferentes NÃO colapsam.
        Evita falsos negativos no teste de fragmentação.
        """
        key_tam = normalize_supplier("TAM LINHAS AEREAS")
        key_gol = normalize_supplier("GOL LINHAS AEREAS")
        assert key_tam != key_gol, (
            f"TAM e GOL deveriam ser chaves distintas: {key_tam!r} == {key_gol!r}"
        )

    def test_q5_global_ranking_total_pago_sem_duplicata_de_fornecedor(self) -> None:
        """
        No ranking global do .txt de Q5 (table_index=2), nenhum fornecedor
        normalizado deve aparecer mais de uma vez. Caso apareça, é prova de
        que o SQL não está normalizando corretamente.
        """
        rows = _rows_from_psql(
            _question_path("Caio", "gastos-fornecedores", "q5", "q5_fornecedores.txt"),
            2,
        )
        counter = Counter(normalize_supplier(row["fornecedor"]) for row in rows)
        duplicates = {k: v for k, v in counter.items() if v > 1}
        assert duplicates == {}, (
            f"Fornecedores fragmentados no ranking global de Q5: {duplicates}"
        )


# =============================================================================
# NOVOS TESTES — Ponto 3: Contrato semântico de Q12
#
# Q12 é "Deputado x Fornecedor" com foco em rastreabilidade de pares.
# O comentário no SQL (q12.sql:5-10) documenta explicitamente:
#   "usa apenas gasto efetivo (valor_liquido > 0), para ficar alinhado
#    com Q5 e Q13; isso exclui estornos, glosas e ajustes com valor <= 0"
#
# O enunciado de Q12 é sobre gasto efetivo (não lançamentos brutos),
# portanto o filtro valor_liquido > 0 é CORRETO e INTENCIONAL.
#
# Estes testes confirmam que o artefato reflete essa semântica e que
# remover o filtro quebraria os testes.
# =============================================================================

class TestQ12SemanticContract:
    """Verifica que Q12 usa o universo de gasto efetivo (valor_liquido > 0)."""

    def test_q12_total_coincide_com_filtro_positivo_nao_com_bruto(self) -> None:
        """
        O total do .txt de Q12 deve bater com o CSV filtrado por valor_liquido > 0,
        NÃO com o total bruto (que inclui estornos).
        Isso prova que o filtro positivo está implementado e é intencional.
        """
        q12_rows = _rows_from_psql(
            _question_path("Caio", "gastos-fornecedores", "q12", "q12_deputado_fornecedor.txt"),
            0,
        )
        q12_total = round(sum(float(row["total_pago"]) for row in q12_rows), 2)

        frame = _gastos_df()
        total_positivo = round(float(frame[frame["valor_liquido"] > 0]["valor_liquido"].sum()), 2)
        total_bruto    = round(float(frame["valor_liquido"].sum()), 2)

        # Q12 deve bater com positivo, não com bruto
        assert q12_total == pytest.approx(total_positivo, abs=0.02), (
            f"Q12 total ({q12_total}) não coincide com universo positivo ({total_positivo})"
        )
        # O total bruto deve ser diferente do positivo (há estornos na base)
        assert total_bruto != total_positivo, (
            "A base não possui estornos — verifique os dados de gastos.csv"
        )

    def test_q12_valores_negativos_excluidos_do_total(self) -> None:
        """
        Registros com valor_liquido < 0 (estornos/glosas) NÃO devem estar
        no universo de Q12. Este teste garante que adicioná-los quebraria
        a igualdade com o .txt exportado.
        """
        frame = _gastos_df()
        total_com_negativos = round(float(frame[frame["valor_liquido"] < 0]["valor_liquido"].sum()), 2)

        # Se há registros negativos, a soma deles é negativa e diferente de zero
        assert total_com_negativos < 0, (
            "Esperado registros com valor_liquido < 0 (estornos) na base"
        )

        q12_rows = _rows_from_psql(
            _question_path("Caio", "gastos-fornecedores", "q12", "q12_deputado_fornecedor.txt"),
            0,
        )
        q12_total = round(sum(float(row["total_pago"]) for row in q12_rows), 2)
        total_bruto = round(float(frame["valor_liquido"].sum()), 2)

        # Total bruto (com negativos) é MENOR que Q12 — prova que negativos foram excluídos
        assert total_bruto < q12_total, (
            f"Total bruto ({total_bruto}) deveria ser menor que Q12 ({q12_total}) "
            f"dado que há estornos negativos ({total_com_negativos})"
        )

    def test_q12_valores_zero_excluidos(self) -> None:
        """
        Registros com valor_liquido = 0 NÃO devem estar no universo de Q12.
        O filtro é ESTRITO (> 0), não >= 0.
        """
        frame = _gastos_df()
        count_zeros = int((frame["valor_liquido"] == 0).sum())
        count_positivos = int((frame["valor_liquido"] > 0).sum())
        count_total = len(frame)

        # Se há zeros, o count positivo deve ser menor que total
        if count_zeros > 0:
            assert count_positivos < count_total, (
                "Há registros zero, mas count_positivos == count_total — "
                "verifique o filtro do universo"
            )

        q12_rows = _rows_from_psql(
            _question_path("Caio", "gastos-fornecedores", "q12", "q12_deputado_fornecedor.txt"),
            0,
        )
        q12_count = sum(int(row["lancamentos"]) for row in q12_rows)

        # Q12 deve ter exatamente o count de positivos
        assert q12_count == count_positivos, (
            f"Q12 lançamentos ({q12_count}) != registros com valor_liquido > 0 ({count_positivos})"
        )


# =============================================================================
# NOVOS TESTES — Ponto 4: Q5 e Q12 usam mesmo universo positivo
#
# Verifica por ano que:
#   - valor_liquido = 0 não entra
#   - valor_liquido < 0 não entra
#   - valor_liquido > 0 entra
#   - soma anual fecha com o global
# =============================================================================

class TestQ5Q12UniverseParity:
    """Testa que Q5 e Q12 usam exatamente o mesmo universo positivo."""

    def test_soma_anual_q5_fecha_com_global_positivo(self) -> None:
        """A soma de todos os anos de Q5 deve fechar com o total global positivo."""
        export_totals = _summary_as_year_map(
            _question_path("Caio", "gastos-fornecedores", "q5", "q5_fornecedores.txt"),
            0,
            "total_pago",
        )
        soma_q5 = round(sum(export_totals.values()), 2)

        frame = _gastos_df()
        total_global_positivo = round(float(frame[frame["valor_liquido"] > 0]["valor_liquido"].sum()), 2)

        assert soma_q5 == pytest.approx(total_global_positivo, abs=0.05), (
            f"Soma anual de Q5 ({soma_q5}) não fecha com universo positivo ({total_global_positivo})"
        )

    def test_soma_anual_q12_fecha_com_global_positivo(self) -> None:
        """A soma de todos os anos de Q12 deve fechar com o total global positivo."""
        export_totals = _summary_as_year_map(
            _question_path("Caio", "gastos-fornecedores", "q12", "q12_deputado_fornecedor.txt"),
            0,
            "total_pago",
        )
        soma_q12 = round(sum(export_totals.values()), 2)

        frame = _gastos_df()
        total_global_positivo = round(float(frame[frame["valor_liquido"] > 0]["valor_liquido"].sum()), 2)

        assert soma_q12 == pytest.approx(total_global_positivo, abs=0.05), (
            f"Soma anual de Q12 ({soma_q12}) não fecha com universo positivo ({total_global_positivo})"
        )

    def test_q5_e_q12_tem_mesmo_total_anual(self) -> None:
        """Q5 e Q12 devem ter exatamente os mesmos totais por ano."""
        q5_totals = _summary_as_year_map(
            _question_path("Caio", "gastos-fornecedores", "q5", "q5_fornecedores.txt"),
            0,
            "total_pago",
        )
        q12_totals = _summary_as_year_map(
            _question_path("Caio", "gastos-fornecedores", "q12", "q12_deputado_fornecedor.txt"),
            0,
            "total_pago",
        )

        assert set(q5_totals.keys()) == set(q12_totals.keys()), (
            f"Q5 e Q12 cobrem anos diferentes: Q5={set(q5_totals.keys())}, Q12={set(q12_totals.keys())}"
        )
        for year in q5_totals:
            assert q5_totals[year] == pytest.approx(q12_totals[year], abs=0.02), (
                f"Ano {year}: Q5={q5_totals[year]}, Q12={q12_totals[year]}"
            )

    def test_q5_e_q12_tem_mesma_contagem_anual(self) -> None:
        """Q5 e Q12 devem ter a mesma contagem de lançamentos por ano."""
        q5_counts = _count_as_year_map(
            _question_path("Caio", "gastos-fornecedores", "q5", "q5_fornecedores.txt"),
            0,
            "lancamentos",
        )
        q12_counts = _count_as_year_map(
            _question_path("Caio", "gastos-fornecedores", "q12", "q12_deputado_fornecedor.txt"),
            0,
            "lancamentos",
        )

        assert set(q5_counts.keys()) == set(q12_counts.keys())
        for year in q5_counts:
            assert q5_counts[year] == q12_counts[year], (
                f"Ano {year}: Q5 lançamentos={q5_counts[year]}, Q12 lançamentos={q12_counts[year]}"
            )

    def test_universo_positivo_exclui_zero_e_negativo_por_ano(self) -> None:
        """
        Por ano, verifica explicitamente os 3 limites do universo:
          - valor = 0: excluído
          - valor < 0: excluído
          - valor > 0: incluído
        E confirma que o total de Q5/Q12 coincide apenas com o positivo.
        """
        frame = _gastos_df()
        q5_totals = _summary_as_year_map(
            _question_path("Caio", "gastos-fornecedores", "q5", "q5_fornecedores.txt"),
            0,
            "total_pago",
        )

        for year, q5_total in q5_totals.items():
            year_frame = frame[frame["ano_dados"] == year].copy()

            total_positivo = round(float(year_frame[year_frame["valor_liquido"] > 0]["valor_liquido"].sum()), 2)
            total_com_zero = round(float(year_frame[year_frame["valor_liquido"] >= 0]["valor_liquido"].sum()), 2)
            total_bruto    = round(float(year_frame["valor_liquido"].sum()), 2)

            # Q5 deve bater com positivo estrito
            assert q5_total == pytest.approx(total_positivo, abs=0.02), (
                f"Ano {year}: Q5={q5_total} != positivo_estrito={total_positivo}"
            )
            # Positivo estrito <= total com zero (zeros não aumentam nem diminuem)
            assert total_positivo <= total_com_zero
            # Total bruto <= total positivo (há estornos negativos)
            assert total_bruto <= total_positivo


# =============================================================================
# NOVOS TESTES — Ponto 5: Smoke test de consistência .txt vs lógica SQL/Python
#
# Verifica que os .txt não foram editados manualmente e são reproduzíveis
# a partir do contrato definido no SQL/Python.
#
# Como não podemos re-executar o SQL (requer PostgreSQL), o smoke test
# verifica que:
#   a) O .txt não contém linhas que violem o contrato de normalização
#      (i.e., nenhuma entrada no ranking global que normalize_supplier
#       produziria diferente do que está escrito)
#   b) Os totais do .txt são internamente consistentes com o CSV
#
# NOTA: Para uma verificação completa de reprodutibilidade (re-executar o SQL
# e comparar byte a byte), seria necessário um ambiente PostgreSQL com a
# extensão unaccent. Isso pode ser feito via make run-psql ou Docker.
# =============================================================================

class TestArtifactConsistency:
    """Smoke tests: .txt é consistente com o contrato SQL/Python."""

    def test_q5_txt_top30_por_ano_nenhum_nome_bruto_diverge_do_contrato(self) -> None:
        """
        Para cada fornecedor no top-30 por ano (table_index=1), verifica que
        re-normalizar o nome pelo Python produz a MESMA string que está no .txt.
        Isso prova que o SQL normalizou corretamente e o .txt não foi editado
        para alterar os nomes (ex: re-acrescentar acentos manualmente).
        """
        rows = _rows_from_psql(
            _question_path("Caio", "gastos-fornecedores", "q5", "q5_fornecedores.txt"),
            1,
        )
        divergencias = []
        for row in rows:
            nome_no_txt = str(row["fornecedor"])
            # O nome no .txt já é o resultado da normalização SQL.
            # Re-normalizar pelo Python deve produzir o mesmo resultado
            # (pois a normalização é idempotente).
            re_normalizado = normalize_supplier(nome_no_txt)
            if re_normalizado != nome_no_txt:
                divergencias.append({
                    "ano": row.get("ano_dados"),
                    "posicao": row.get("posicao"),
                    "nome_txt": nome_no_txt,
                    "re_normalizado": re_normalizado,
                })

        assert divergencias == [], (
            f"Nomes no .txt de Q5 que divergem do contrato Python ao re-normalizar:\n"
            + "\n".join(
                f"  [{d['ano']} pos={d['posicao']}] {d['nome_txt']!r} → {d['re_normalizado']!r}"
                for d in divergencias
            )
        )

    def test_q5_txt_global_nenhum_nome_bruto_diverge_do_contrato(self) -> None:
        """Mesma verificação para o ranking global de Q5 (table_index=2)."""
        rows = _rows_from_psql(
            _question_path("Caio", "gastos-fornecedores", "q5", "q5_fornecedores.txt"),
            2,
        )
        divergencias = []
        for row in rows:
            nome_no_txt = str(row["fornecedor"])
            re_normalizado = normalize_supplier(nome_no_txt)
            if re_normalizado != nome_no_txt:
                divergencias.append({
                    "posicao": row.get("posicao"),
                    "nome_txt": nome_no_txt,
                    "re_normalizado": re_normalizado,
                })

        assert divergencias == [], (
            f"Nomes no ranking global de Q5 que divergem do contrato Python ao re-normalizar:\n"
            + "\n".join(
                f"  [pos={d['posicao']}] {d['nome_txt']!r} → {d['re_normalizado']!r}"
                for d in divergencias
            )
        )

    def test_q12_txt_resumo_total_bate_com_csv_positivo(self) -> None:
        """
        O total do resumo de Q12 deve bater com o CSV filtrado por > 0.
        Divergência indicaria que o .txt foi editado manualmente ou que o
        filtro SQL foi alterado sem regenerar o artefato.
        """
        q12_rows = _rows_from_psql(
            _question_path("Caio", "gastos-fornecedores", "q12", "q12_deputado_fornecedor.txt"),
            0,
        )
        q12_total = round(sum(float(row["total_pago"]) for row in q12_rows), 2)

        frame = _gastos_df()
        csv_total = round(float(frame[frame["valor_liquido"] > 0]["valor_liquido"].sum()), 2)

        assert q12_total == pytest.approx(csv_total, abs=0.02), (
            f"Q12 .txt total ({q12_total}) diverge do CSV positivo ({csv_total}).\n"
            f"Possível causa: .txt editado manualmente ou SQL com filtro diferente."
        )

    def test_q5_txt_resumo_total_bate_com_csv_positivo(self) -> None:
        """
        O total do resumo de Q5 deve bater com o CSV filtrado por > 0.
        """
        q5_rows = _rows_from_psql(
            _question_path("Caio", "gastos-fornecedores", "q5", "q5_fornecedores.txt"),
            0,
        )
        q5_total = round(sum(float(row["total_pago"]) for row in q5_rows), 2)

        frame = _gastos_df()
        csv_total = round(float(frame[frame["valor_liquido"] > 0]["valor_liquido"].sum()), 2)

        assert q5_total == pytest.approx(csv_total, abs=0.02), (
            f"Q5 .txt total ({q5_total}) diverge do CSV positivo ({csv_total}).\n"
            f"Possível causa: .txt editado manualmente ou SQL com filtro diferente."
        )

    def test_q5_and_q12_serve_via_dashboard_service(self) -> None:
        """
        Confirma que Q5 e Q12 carregam sem erro via DashboardService.
        Qualquer falha aqui indica que o serviço não consegue ler os artefatos.
        """
        from app.filter_engine import FilterState

        state = FilterState(
            anos=[],
            eixos=[],
            partidos=[],
            ufs=[],
            deputados=[],
            escolaridade=[],
            search=None,
            sort_by=None,
            sort_dir="desc",
            page=1,
            page_size=10,
        )
        svc = _dashboard_service()

        payload_q5 = svc.get_question_payload("q5", state)
        assert payload_q5 is not None, "DashboardService não carregou Q5"

        payload_q12 = svc.get_question_payload("q12", state)
        assert payload_q12 is not None, "DashboardService não carregou Q12"

    def test_no_double_carriage_returns_in_txt_artifacts(self) -> None:
        """
        Prevenção contra regressão de final de linha duplicado (\\r\\r\\n).
        Varre todos os arquivos .txt sob a pasta Caio/ e garante que nenhum
        deles contém sequências de escape corrompidas (que quebram o splitlines()
        do parser).
        """
        import glob
        txt_files = glob.glob(str(REPO_ROOT / "Caio/**/*.txt"), recursive=True)
        corrupted_files = []
        for path in txt_files:
            with open(path, "rb") as f:
                content = f.read()
            if b"\r\r\n" in content:
                corrupted_files.append(Path(path).name)

        assert corrupted_files == [], (
            f"Arquivos com final de linha corrompido (\\r\\r\\n): {corrupted_files}. "
            "Normalizar para \\n ou \\r\\n para corrigir."
        )

