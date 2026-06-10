from __future__ import annotations

import json
from pathlib import Path

from app.filter_engine import FilterState
from app.service import DashboardService


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _state(**overrides) -> FilterState:
    values = {
        "anos": [],
        "eixos": [],
        "partidos": [],
        "ufs": [],
        "deputados": [],
        "escolaridade": [],
        "search": None,
        "sort_by": None,
        "sort_dir": "desc",
        "page": 1,
        "page_size": 10,
    }
    values.update(overrides)
    return FilterState(**values)


def _build_q3_service(root: Path) -> DashboardService:
    registry = {
        "legend": {},
        "questions": [
            {
                "id": "q3",
                "title": "Q3",
                "description": "Q3 normalizada",
                "response_files": [
                    "artifacts/q3/q3_resumos_agregados.csv",
                    "artifacts/q3/q3_votos_min.csv",
                    "artifacts/q3/q3_classificacao_votacoes.csv",
                ],
                "sql_file": "q3.sql",
                "chart_type": "bar_vertical",
                "supported_filters": ["anos", "eixos", "deputados"],
                "expected_columns": ["ano_dados", "eixo_principal", "votos_total"],
                "main_table_contains": "",
                "summary_table_contains": "",
                "explanation": "fixture",
                "chart": {"x_field": "eixo_principal", "y_fields": ["voto_sim"]},
            }
        ],
    }
    _write(root / "registry.json", json.dumps(registry))
    _write(root / "sql" / "q3.sql", "select 1;\n")
    _write(
        root / "dados_padronizados" / "deputados.csv",
        "id_deputado;uri_deputado;nome;nome_civil;cpf;id_legislatura_inicial;id_legislatura_final;escolaridade\n"
        "1;;Ana Publica;Ana;;57;57;Superior\n",
    )
    _write(
        root / "artifacts" / "q3" / "q3_resumos_agregados.csv",
        "\n".join(
            [
                "ano_dados;eixo_principal;sigla_partido;sigla_uf;id_deputado;nome;voto_sim;voto_nao;voto_abstencao;voto_outro;votos_total;votos_classificados",
                "2024;Social;PT;SP;1;Ana;2;1;0;0;3;3",
                "2024;Seguranca;PT;SP;1;Ana;0;1;0;0;1;1",
            ]
        )
        + "\n",
    )
    _write(
        root / "artifacts" / "q3" / "q3_votos_min.csv",
        "\n".join(
            [
                "ano_dados;data_votacao;id_votacao;id_deputado;nome;sigla_partido;sigla_uf;voto;voto_sim;voto_nao;voto_abstencao;voto_outro;eixo_principal;tem_classificacao_tematica",
                "2024;2024-01-01;v1;1;Ana;PT;SP;Sim;1;0;0;0;Social;true",
                "2024;2024-01-02;v2;1;Ana;PT;SP;Sim;1;0;0;0;Social;true",
                "2024;2024-01-03;v3;1;Ana;PT;SP;Nao;0;1;0;0;Social;true",
                "2024;2024-01-04;v4;1;Ana;PT;SP;Nao;0;1;0;0;Seguranca;true",
            ]
        )
        + "\n",
    )
    _write(
        root / "artifacts" / "q3" / "q3_classificacao_votacoes.csv",
        "\n".join(
            [
                "ano_dados;id_votacao;eixo_principal;eixos_secundarios;confianca_classificacao;evidencias_eixo_principal;materia_resumo;ementa_resumo;qtd_proposicoes_associadas;qtd_objetos_associados",
                "2024;v1;Social;;alta;e1;PL 1;Ementa 1;1;1",
                "2024;v2;Social;;alta;e2;PL 2;Ementa 2;1;1",
                "2024;v3;Social;;alta;e3;PL 3;Ementa 3;1;1",
                "2024;v4;Seguranca;Social;alta;e4;PL 4;Ementa 4;1;1",
            ]
        )
        + "\n",
    )
    return DashboardService(
        registry_path=root / "registry.json",
        responses_dir=root / "respostas",
        sql_dir=root / "sql",
        repo_root=root,
    )


def test_q3_meta_uses_question_specific_axes_and_deputy_ids(tmp_path: Path) -> None:
    service = _build_q3_service(tmp_path)

    meta = service.get_meta()
    q3_filters = meta.question_filters["q3"]

    assert [choice.value for choice in q3_filters.eixos] == ["Seguranca", "Social"]
    assert [(choice.value, choice.label) for choice in q3_filters.deputados] == [("1", "Ana Publica")]


def test_q3_uses_eixo_principal_for_totals_and_table_filter(tmp_path: Path) -> None:
    service = _build_q3_service(tmp_path)

    payload = service.get_question_payload("q3", _state(eixos=["Social"], deputados=["Ana"]))

    assert payload.table_spec.total == 3
    assert {row["eixo_principal"] for row in payload.table_spec.rows} == {"Social"}
    assert [column.key for column in payload.table_spec.columns] == [
        "ano_dados",
        "voto",
        "eixo_principal",
        "proposicao_votacao",
        "ementa_descricao",
    ]
    assert payload.summary_cards[0].value == "3"
    assert payload.chart_spec.categories == ["Sim", "Nao", "Abstencao", "Outros"]
    assert sum(payload.chart_spec.series[0]["data"]) == 3


def test_q3_requires_deputy_before_loading_vote_table(tmp_path: Path, monkeypatch) -> None:
    import app.service as service_module

    service = _build_q3_service(tmp_path)
    calls: list[str] = []
    original = service_module.parse_data_file

    def counting_parse(path: Path):
        calls.append(path.name)
        return original(path)

    monkeypatch.setattr(service_module, "parse_data_file", counting_parse)

    payload = service.get_question_payload("q3", _state())

    assert payload.empty_state.is_empty is True
    assert payload.empty_state.message == "Selecione um deputado para visualizar os votos."
    assert payload.table_spec.total == 0
    assert calls == ["q3_resumos_agregados.csv"]


def test_q3_enriches_only_paged_rows_without_duplication(tmp_path: Path) -> None:
    service = _build_q3_service(tmp_path)

    payload = service.get_question_payload("q3", _state(deputados=["Ana"], page=1, page_size=1))

    assert payload.table_spec.total == 4
    assert len(payload.table_spec.rows) == 1
    assert payload.table_spec.rows[0]["proposicao_votacao"] == "PL 1"
    assert payload.table_spec.rows[0]["ementa_descricao"] == "Ementa 1"


def test_q3_bundle_cache_avoids_reparsing_csvs(tmp_path: Path, monkeypatch) -> None:
    import app.service as service_module

    service = _build_q3_service(tmp_path)
    calls: list[str] = []
    original = service_module.parse_data_file

    def counting_parse(path: Path):
        calls.append(path.name)
        return original(path)

    monkeypatch.setattr(service_module, "parse_data_file", counting_parse)

    service.get_question_payload("q3", _state(deputados=["Ana"], page=1, page_size=1))
    service.get_question_payload("q3", _state(deputados=["Ana"], page=2, page_size=1))

    assert calls.count("q3_resumos_agregados.csv") == 1
    assert calls.count("q3_votos_min.csv") == 1
    assert calls.count("q3_classificacao_votacoes.csv") == 1
