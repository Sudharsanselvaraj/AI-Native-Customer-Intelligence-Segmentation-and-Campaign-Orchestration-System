"""Tests for the AI copilot endpoint (AI calls are mocked)."""
import pytest
from unittest.mock import patch, MagicMock


MOCK_COPILOT_RESPONSE = {
    "message": "I've created a segment for high-value customers.",
    "actions_taken": [{"tool": "list_segments", "args": {}, "result": {"segments": []}}],
}


class TestCopilotAPI:
    @patch("app.services.ai_service.AIService.copilot_chat", return_value=MOCK_COPILOT_RESPONSE)
    def test_basic_chat(self, mock_chat, client):
        resp = client.post("/api/copilot", json={
            "message": "Show me all segments",
            "conversation_history": [],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data
        assert "actions_taken" in data
        assert "session_id" in data

    @patch("app.services.ai_service.AIService.copilot_chat", return_value=MOCK_COPILOT_RESPONSE)
    def test_chat_with_history(self, mock_chat, client):
        resp = client.post("/api/copilot", json={
            "message": "Launch it",
            "conversation_history": [
                {"role": "user", "content": "Create a campaign for fashion buyers"},
                {"role": "assistant", "content": "I've created the campaign."},
            ],
            "session_id": "test-session-123",
        })
        assert resp.status_code == 200

    @patch("app.services.ai_service.AIService.copilot_chat", side_effect=Exception("AI timeout"))
    def test_copilot_handles_ai_error(self, mock_chat, client):
        resp = client.post("/api/copilot", json={
            "message": "Do something",
            "conversation_history": [],
        })
        assert resp.status_code in (200, 500)

    def test_copilot_missing_message(self, client):
        resp = client.post("/api/copilot", json={
            "conversation_history": [],
        })
        assert resp.status_code == 422
