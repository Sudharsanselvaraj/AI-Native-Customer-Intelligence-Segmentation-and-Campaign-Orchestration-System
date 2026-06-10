"""Unit and API tests for the customers module."""
import pytest
from unittest.mock import patch


CUSTOMER_PAYLOAD = {
    "name": "Priya Sharma",
    "email": "priya.sharma@example.com",
    "phone": "+919876543210",
    "city": "Mumbai",
    "gender": "female",
    "age": 28,
}


class TestCustomerAPI:
    def test_create_customer(self, client):
        resp = client.post("/api/customers", json=CUSTOMER_PAYLOAD)
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == CUSTOMER_PAYLOAD["email"]
        assert "id" in data

    def test_create_customer_duplicate_email(self, client):
        payload = {**CUSTOMER_PAYLOAD, "email": "dup@example.com"}
        client.post("/api/customers", json=payload)
        resp = client.post("/api/customers", json=payload)
        assert resp.status_code == 409

    def test_list_customers(self, client):
        resp = client.get("/api/customers")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert "pages" in data

    def test_list_customers_pagination(self, client):
        resp = client.get("/api/customers?page=1&size=5")
        assert resp.status_code == 200
        data = resp.json()
        assert data["size"] == 5

    def test_list_customers_search(self, client):
        client.post("/api/customers", json={**CUSTOMER_PAYLOAD, "email": "search_test@example.com", "name": "UniqueSearchName"})
        resp = client.get("/api/customers?search=UniqueSearchName")
        assert resp.status_code == 200
        data = resp.json()
        assert any("UniqueSearchName" in c["name"] for c in data["items"])

    def test_get_customer_by_id(self, client):
        create_resp = client.post("/api/customers", json={**CUSTOMER_PAYLOAD, "email": "get_by_id@example.com"})
        cid = create_resp.json()["id"]
        resp = client.get(f"/api/customers/{cid}")
        assert resp.status_code == 200
        assert resp.json()["id"] == cid

    def test_get_customer_not_found(self, client):
        resp = client.get("/api/customers/nonexistent-id-xyz")
        assert resp.status_code == 404

    def test_update_customer(self, client):
        create_resp = client.post("/api/customers", json={**CUSTOMER_PAYLOAD, "email": "update_me@example.com"})
        cid = create_resp.json()["id"]
        resp = client.patch(f"/api/customers/{cid}", json={"city": "Delhi"})
        assert resp.status_code == 200
        assert resp.json()["city"] == "Delhi"

    def test_list_cities(self, client):
        resp = client.get("/api/customers/cities")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
