from __future__ import annotations

import subprocess
import os
from unittest.mock import patch
from fastapi.testclient import TestClient

import app.main as main_module
from app.main import app
from app.service import DashboardService

def test_q14_registry_metadata() -> None:
    """Verify that Q14 is correctly registered as a block-only data source."""
    main_module.service = DashboardService()
    service = main_module.service
    q14 = service.registry.by_id("q14")
    assert q14 is not None
    assert q14.is_block_data_source is True
    assert q14.frontend_standalone_page is False
    assert q14.block_id == "partidos-ideologia-votacao"
    assert q14.group_id == "partidos"

    # Also verify through the /api/meta endpoint
    client = TestClient(app)
    response = client.get("/api/meta")
    assert response.status_code == 200
    meta = response.json()
    q14_meta = next((q for q in meta["questions"] if q["id"] == "q14"), None)
    assert q14_meta is not None
    assert q14_meta["is_block_data_source"] is True
    assert q14_meta["frontend_standalone_page"] is False
    assert q14_meta["block_id"] == "partidos-ideologia-votacao"
    assert q14_meta["group_id"] == "partidos"

def test_q14_endpoint_loads_data_without_subprocess() -> None:
    """Verify Q14 payload structure and ensure no external processes are spawned."""
    main_module.service = DashboardService()
    client = TestClient(app)

    # Use patches to capture any subprocess or system calls
    with patch("subprocess.run") as mock_run, \
         patch("subprocess.Popen") as mock_popen, \
         patch("os.system") as mock_system:

        response = client.get("/api/questions/q14?page_size=10")

        # Assert no subprocesses were called
        mock_run.assert_not_called()
        mock_popen.assert_not_called()
        mock_system.assert_not_called()

    assert response.status_code == 200
    payload = response.json()

    # Registry structure
    assert payload["question_id"] == "q14"
    assert "Posição ideológica" in payload["title"]

    # Table specifications and normalization
    table = payload["table_spec"]
    assert table["total"] > 0
    rows = table["rows"]
    assert len(rows) > 0

    # Verify deputy normalization fields
    first_deputy = rows[0]
    expected_fields = [
        "deputy_id",
        "deputy_name",
        "party",
        "party_ideology_score",
        "party_ideology_band",
        "party_ideology_range",
        "behavioral_score",
        "behavioral_score_calibrated",
        "party_deviation",
        "party_deviation_direction",
        "caucus_deviation",
        "caucus_deviation_direction",
        "valid_votes",
        "confidence",
        "confidence_band",
        "confidence_range",
    ]
    for field in expected_fields:
        assert field in first_deputy, f"Field '{field}' missing from deputy row"

    # Complement tables: party_deviation
    complements = payload["complement_tables"]
    assert len(complements) == 2

    party_dev_table = complements[0]
    assert "Desvio médio por partido" in party_dev_table["title"]
    assert party_dev_table["total"] > 0
    first_party_dev = party_dev_table["rows"][0]
    expected_party_fields = [
        "party",
        "num_deputies",
        "party_ideology_score",
        "party_ideology_band",
        "party_ideology_range",
        "behavioral_score_mean",
        "behavioral_score_calibrated_mean",
        "party_deviation_mean",
        "party_deviation_mean_abs",
        "deviation_direction_mean",
    ]
    for field in expected_party_fields:
        assert field in first_party_dev, f"Field '{field}' missing from party deviation row"

    # Complement tables: caucus_cohesion
    caucus_table = complements[1]
    assert "Coesão interna da bancada" in caucus_table["title"]
    assert caucus_table["total"] > 0
    first_caucus = caucus_table["rows"][0]
    expected_caucus_fields = [
        "party",
        "num_deputies",
        "caucus_score",
        "caucus_deviation_mean_abs",
        "caucus_deviation_max_abs",
        "caucus_deviation_std",
    ]
    for field in expected_caucus_fields:
        assert field in first_caucus, f"Field '{field}' missing from caucus cohesion row"

    # Precomputed helper arrays in chart_spec
    chart = payload["chart_spec"]
    assert chart["type"] == "scatter"
    assert "topRightDeviation" in chart["options"]
    assert "topLeftDeviation" in chart["options"]
    assert "mostAligned" in chart["options"]
    assert "partyCohesionRanking" in chart["options"]

    # Verify topRightDeviation elements have the confidence_range field
    top_right = chart["options"]["topRightDeviation"]
    assert len(top_right) > 0
    assert "confidence_range" in top_right[0]

    # Verify partyCohesionRanking elements have the num_deputies field
    cohesion = chart["options"]["partyCohesionRanking"]
    assert len(cohesion) > 0
    assert "num_deputies" in cohesion[0]

    # Verify methodology text exposure
    assert "methodology" in chart["options"]
    assert "text" in chart["options"]["methodology"]
    assert len(chart["options"]["methodology"]["text"]) > 100
