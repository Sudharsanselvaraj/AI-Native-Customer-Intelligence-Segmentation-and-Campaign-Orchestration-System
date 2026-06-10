"""Tests for campaign lifecycle: create → generate → launch."""
import pytest
from unittest.mock import patch, MagicMock


MOCK_SEGMENT_SQL = {
    "sql": "1=1",
    "description": "All customers",
}

MOCK_CAMPAIGN_GENERATION = {
    "name": "Re-engagement Campaign",
    "description": "Win back dormant customers",
    "message_template": "Hi {customer_name}, we miss you! Come back for 20% off.",
    "channel": "whatsapp",
    "channel_confidence": 0.87,
    "channel_reasoning": "WhatsApp has highest open rates for dormant users",
    "expected_engagement": 0.32,
    "expected_conversion": 0.09,
    "target_segment_suggestion": None,
}


@pytest.fixture
def segment_id(client):
    with patch("app.services.ai_service.AIService.generate_segment_sql", return_value=MOCK_SEGMENT_SQL):
        resp = client.post("/api/segments/from-nl", json={
            "natural_language": "all customers",
            "name": "All Customers Test",
        })
    return resp.json()["segment_id"]


class TestCampaignAPI:
    def test_list_campaigns_empty(self, client):
        resp = client.get("/api/campaigns")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data

    def test_create_campaign(self, client, segment_id):
        resp = client.post("/api/campaigns", json={
            "name": "Test Campaign",
            "description": "A test",
            "channel": "email",
            "segment_id": segment_id,
            "message_template": "Hello {customer_name}!",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Test Campaign"
        assert data["status"] == "draft"

    def test_create_campaign_invalid_segment(self, client):
        resp = client.post("/api/campaigns", json={
            "name": "Bad Campaign",
            "channel": "sms",
            "segment_id": "nonexistent-segment",
            "message_template": "Hello!",
        })
        assert resp.status_code == 404

    @patch("app.services.ai_service.AIService.generate_campaign", return_value=MOCK_CAMPAIGN_GENERATION)
    def test_generate_campaign(self, mock_gen, client, segment_id):
        resp = client.post("/api/campaigns/generate", json={
            "prompt": "Re-engage lapsed users with a discount",
            "segment_id": segment_id,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["channel"] == "whatsapp"
        assert data["channel_confidence"] == 0.87
        mock_gen.assert_called_once()

    @patch("app.workers.campaign_worker.dispatch_campaign.delay")
    def test_launch_campaign(self, mock_delay, client, segment_id):
        create_resp = client.post("/api/campaigns", json={
            "name": "Launch Test",
            "channel": "sms",
            "segment_id": segment_id,
            "message_template": "Hi {customer_name}!",
        })
        cid = create_resp.json()["id"]
        resp = client.post(f"/api/campaigns/{cid}/launch")
        assert resp.status_code == 200
        assert resp.json()["status"] == "running"

    @patch("app.workers.campaign_worker.dispatch_campaign.delay")
    def test_launch_already_running_fails(self, mock_delay, client, segment_id):
        create_resp = client.post("/api/campaigns", json={
            "name": "Double Launch Test",
            "channel": "rcs",
            "segment_id": segment_id,
            "message_template": "Hi {customer_name}!",
        })
        cid = create_resp.json()["id"]
        client.post(f"/api/campaigns/{cid}/launch")
        resp = client.post(f"/api/campaigns/{cid}/launch")
        assert resp.status_code == 400

    def test_get_campaign(self, client, segment_id):
        create_resp = client.post("/api/campaigns", json={
            "name": "Get Test Campaign",
            "channel": "email",
            "segment_id": segment_id,
            "message_template": "Hello!",
        })
        cid = create_resp.json()["id"]
        resp = client.get(f"/api/campaigns/{cid}")
        assert resp.status_code == 200
        assert resp.json()["id"] == cid

    def test_get_campaign_not_found(self, client):
        resp = client.get("/api/campaigns/nonexistent")
        assert resp.status_code == 404
