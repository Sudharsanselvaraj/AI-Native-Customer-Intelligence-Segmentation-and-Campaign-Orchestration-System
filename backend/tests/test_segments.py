"""Tests for segment creation including NL→SQL flow (AI mocked)."""
import pytest
from unittest.mock import patch, MagicMock


MOCK_AI_RESPONSE = {
    "sql": "id IN (SELECT customer_id FROM orders GROUP BY customer_id HAVING SUM(amount) > 5000)",
    "description": "Customers with total spend over 5000",
}


class TestSegmentAPI:
    def test_list_segments_empty(self, client):
        resp = client.get("/api/segments")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data

    @patch("app.services.ai_service.AIService.generate_segment_sql", return_value=MOCK_AI_RESPONSE)
    def test_create_segment_from_nl(self, mock_ai, client):
        resp = client.post("/api/segments/from-nl", json={
            "natural_language": "customers who spent more than 5000",
            "name": "Big Spenders",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "segment_id" in data
        assert data["estimated_size"] >= 0
        mock_ai.assert_called_once()

    @patch("app.services.ai_service.AIService.generate_segment_sql", return_value=MOCK_AI_RESPONSE)
    def test_create_segment_auto_name(self, mock_ai, client):
        resp = client.post("/api/segments/from-nl", json={
            "natural_language": "customers from Mumbai who bought electronics",
        })
        assert resp.status_code == 201
        assert resp.json()["segment_id"] is not None

    @patch("app.services.ai_service.AIService.generate_segment_sql", side_effect=ValueError("AI failed"))
    def test_create_segment_ai_failure(self, mock_ai, client):
        resp = client.post("/api/segments/from-nl", json={
            "natural_language": "some query that fails",
        })
        assert resp.status_code == 422

    @patch("app.services.ai_service.AIService.generate_segment_sql", return_value=MOCK_AI_RESPONSE)
    def test_get_segment_customers(self, mock_ai, client):
        create_resp = client.post("/api/segments/from-nl", json={
            "natural_language": "high value customers",
            "name": "HighVal Test",
        })
        seg_id = create_resp.json()["segment_id"]
        resp = client.get(f"/api/segments/{seg_id}/customers")
        assert resp.status_code == 200

    def test_get_segment_not_found(self, client):
        resp = client.get("/api/segments/nonexistent-seg-id")
        assert resp.status_code == 404


class TestSegmentSQLSafety:
    """Ensure the SQL safety layer blocks DDL injection."""

    @patch("app.services.ai_service.AIService.generate_segment_sql")
    def test_blocks_drop_table(self, mock_ai, client):
        mock_ai.return_value = {
            "sql": "1=1; DROP TABLE customers; --",
            "description": "malicious",
        }
        resp = client.post("/api/segments/from-nl", json={
            "natural_language": "drop everything",
        })
        assert resp.status_code in (422, 400)

    @patch("app.services.ai_service.AIService.generate_segment_sql")
    def test_blocks_delete(self, mock_ai, client):
        mock_ai.return_value = {
            "sql": "1=1; DELETE FROM customers",
            "description": "malicious",
        }
        resp = client.post("/api/segments/from-nl", json={
            "natural_language": "delete all",
        })
        assert resp.status_code in (422, 400)
