"""
Integration tests for patient endpoints using FastAPI TestClient
"""
import pytest
from fastapi.testclient import TestClient


class TestPatientEndpoints:
    """Integration tests for patient API endpoints"""

    def test_create_patient_success(self, client, test_clinic, auth_headers):
        """Test successful patient creation"""
        patient_data = {
            "name": "Jane Smith",
            "age": 25,
            "gender": "female",
            "village": "Test Village",
            "phone": "0987654321",
            "referred_by": "Dr. Johnson",
            "treatment_type": "Consultation"
        }

        response = client.post("/patients/", json=patient_data, headers=auth_headers)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Jane Smith"
        assert data["age"] == 25
        assert data["clinic_id"] == test_clinic.id
        assert "id" in data

    def test_create_patient_duplicate_phone(self, client, test_patient, auth_headers):
        """Test patient creation with duplicate phone number"""
        patient_data = {
            "name": "Duplicate Patient",
            "age": 40,
            "gender": "male",
            "village": "Another Village",
            "phone": "1234567890",  # Same phone as test_patient
            "referred_by": "Dr. Johnson",
            "treatment_type": "X-Ray"
        }

        response = client.post("/patients/", json=patient_data, headers=auth_headers)

        assert response.status_code == 400
        data = response.json()
        assert "phone number" in data["detail"].lower()

    def test_create_patient_invalid_data(self, client, auth_headers):
        """Test patient creation with invalid data"""
        patient_data = {
            "name": "",  # Invalid: empty name
            "age": -5,   # Invalid: negative age
            "gender": "invalid_gender",  # Invalid gender
            "village": "Test Village",
            "phone": "123",  # Invalid: too short
            "referred_by": "Dr. Smith",
            "treatment_type": "X-Ray"
        }

        response = client.post("/patients/", json=patient_data, headers=auth_headers)

        # Should fail validation
        assert response.status_code == 422  # Validation error

    def test_get_patients_success(self, client, test_patient, auth_headers):
        """Test successful patients list retrieval"""
        response = client.get("/patients/", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

        # Check if our test patient is in the list
        patient_ids = [p["id"] for p in data]
        assert test_patient.id in patient_ids

    def test_get_patients_with_search(self, client, test_patient, auth_headers):
        """Test patients search functionality"""
        # Search by name
        response = client.get("/patients/?search=John", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

        # Search by phone
        response = client.get("/patients/?search=1234567890", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_get_patients_empty_search(self, client, auth_headers):
        """Test patients search with empty query"""
        response = client.get("/patients/?search=a", headers=auth_headers)  # Too short

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should return empty or all patients (depending on implementation)

    def test_get_patient_by_id_success(self, client, test_patient, auth_headers):
        """Test successful patient retrieval by ID"""
        response = client.get(f"/patients/{test_patient.id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_patient.id
        assert data["name"] == test_patient.name
        assert data["phone"] == test_patient.phone

    def test_get_patient_by_id_not_found(self, client, auth_headers):
        """Test patient retrieval with non-existent ID"""
        response = client.get("/patients/99999", headers=auth_headers)

        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()

    def test_update_patient_success(self, client, test_patient, auth_headers):
        """Test successful patient update"""
        update_data = {
            "name": "Updated Name",
            "age": 35
        }

        response = client.put(f"/patients/{test_patient.id}", json=update_data, headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_patient.id
        assert data["name"] == "Updated Name"
        assert data["age"] == 35

    def test_update_patient_not_found(self, client, auth_headers):
        """Test patient update with non-existent ID"""
        update_data = {"name": "Updated Name"}

        response = client.put("/patients/99999", json=update_data, headers=auth_headers)

        assert response.status_code == 404

    def test_update_patient_duplicate_phone(self, client, test_patient, auth_headers):
        """Test patient update with duplicate phone number"""
        # First create another patient
        patient_data = {
            "name": "Another Patient",
            "age": 40,
            "gender": "male",
            "village": "Another Village",
            "phone": "1111111111",
            "referred_by": "Dr. Johnson",
            "treatment_type": "X-Ray"
        }

        client.post("/patients/", json=patient_data, headers=auth_headers)

        # Now try to update test_patient with the same phone
        update_data = {"phone": "1111111111"}

        response = client.put(f"/patients/{test_patient.id}", json=update_data, headers=auth_headers)

        assert response.status_code == 400
        data = response.json()
        assert "phone number" in data["detail"].lower()

    def test_delete_patient_success(self, client, test_patient, auth_headers):
        """Test successful patient deletion"""
        response = client.delete(f"/patients/{test_patient.id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "deleted successfully" in data["message"]

        # Verify patient is actually deleted
        response = client.get(f"/patients/{test_patient.id}", headers=auth_headers)
        assert response.status_code == 404

    def test_delete_patient_not_found(self, client, auth_headers):
        """Test patient deletion with non-existent ID"""
        response = client.delete("/patients/99999", headers=auth_headers)

        assert response.status_code == 404

    def test_get_patient_summary(self, client, test_patient, auth_headers):
        """Test patient summary retrieval"""
        response = client.get(f"/patients/{test_patient.id}/summary", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "patient" in data
        assert "total_paid" in data
        assert "outstanding_balance" in data
        assert data["patient"]["id"] == test_patient.id

    def test_get_patients_with_summaries(self, client, test_patient, auth_headers):
        """Test patients with summaries retrieval"""
        response = client.get("/patients/summaries/list", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)

    def test_get_recent_patients(self, client, test_patient, auth_headers):
        """Test recent patients retrieval"""
        response = client.get("/patients/recent/list", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_patient_stats(self, client, test_patient, auth_headers):
        """Test patient statistics retrieval"""
        response = client.get("/patients/stats/overview", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "clinic_id" in data
        assert "statistics" in data
        assert "total_patients" in data["statistics"]

    def test_unauthorized_access(self, client, test_patient):
        """Test access without authentication"""
        response = client.get(f"/patients/{test_patient.id}")

        assert response.status_code == 401

    def test_pagination_parameters(self, client, auth_headers):
        """Test pagination parameters"""
        response = client.get("/patients/?skip=0&limit=10", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 10

    def test_invalid_pagination(self, client, auth_headers):
        """Test invalid pagination parameters"""
        # Negative skip
        response = client.get("/patients/?skip=-1", headers=auth_headers)
        assert response.status_code == 422  # Validation error

        # Too large limit
        response = client.get("/patients/?limit=2000", headers=auth_headers)
        assert response.status_code == 422  # Validation error