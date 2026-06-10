"""Tests for analytics dashboard and insights endpoints."""
import pytest
from unittest.mock import patch


class TestAnalyticsAPI:
    def test_dashboard_stats(self, client):
        resp = client.get("/api/analytics/dashboard")
        assert resp.status_code == 200
        data = resp.json()
        required_keys = [
            "total_customers", "total_revenue", "total_campaigns",
            "total_messages_sent", "avg_delivery_rate", "avg_open_rate",
            "avg_ctr", "avg_conversion_rate", "revenue_trend",
            "campaign_performance", "channel_breakdown",
        ]
        for key in required_keys:
            assert key in data, f"Missing key: {key}"

    def test_dashboard_numeric_types(self, client):
        resp = client.get("/api/analytics/dashboard")
        data = resp.json()
        assert isinstance(data["total_customers"], int)
        assert isinstance(data["total_revenue"], float)
        assert isinstance(data["avg_delivery_rate"], float)
        assert isinstance(data["revenue_trend"], list)

    def test_insights_endpoint(self, client):
        resp = client.get("/api/analytics/insights")
        assert resp.status_code == 200
        data = resp.json()
        assert "insights" in data
        assert isinstance(data["insights"], list)

    def test_health_endpoint(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
