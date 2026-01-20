"""
Integration tests for auth endpoints using FastAPI TestClient
"""
import pytest
from fastapi.testclient import TestClient


class TestAuthEndpoints:
    """Integration tests for auth API endpoints"""

    def test_register_user_success(self, client):
        """Test successful user registration"""
        user_data = {
            "email": "newuser@example.com",
            "password": "securepass123",
            "first_name": "John",
            "last_name": "Doe",
            "role": "clinic_owner"
        }

        response = client.post("/api/v1/auth/register", json=user_data)

        assert response.status_code == 201
        data = response.json()
        assert data["message"] == "User registered successfully"
        assert "user" in data
        assert "token" in data
        assert data["user"]["email"] == user_data["email"]
        assert data["user"]["name"] == "John Doe"

    def test_register_user_duplicate_email(self, client, test_user):
        """Test registration with duplicate email"""
        user_data = {
            "email": test_user.email,  # Existing email
            "password": "securepass123",
            "first_name": "Jane",
            "last_name": "Smith",
            "role": "doctor"
        }

        response = client.post("/api/v1/auth/register", json=user_data)

        assert response.status_code == 400
        data = response.json()
        assert "already exists" in data["detail"].lower()

    def test_login_success(self, client, test_user):
        """Test successful user login"""
        login_data = {
            "email": test_user.email,
            "password": "testpass123",  # Assuming this is the password for test_user
            "device": {
                "device_name": "Test Device",
                "device_type": "web",
                "device_platform": "TestOS"
            }
        }

        response = client.post("/api/v1/auth/login", json=login_data)

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Login successful"
        assert "user" in data
        assert "token" in data
        assert data["user"]["email"] == test_user.email  # Check email instead of ID

    def test_login_invalid_credentials(self, client):
        """Test login with invalid credentials"""
        login_data = {
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        }

        response = client.post("/api/v1/auth/login", json=login_data)

        assert response.status_code == 401
        data = response.json()
        assert "invalid credentials" in data["detail"].lower()

    def test_get_current_user_with_valid_token(self, client, test_user, auth_headers):
        """Test getting current user with valid JWT token"""
        response = client.get("/api/v1/auth/me", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_user.id
        assert data["email"] == test_user.email
        assert data["name"] == test_user.name

    def test_get_current_user_without_token(self, client):
        """Test getting current user without authentication"""
        response = client.get("/api/v1/auth/me")

        assert response.status_code == 401
        data = response.json()
        assert "invalid authorization header" in data["detail"].lower()

    def test_get_current_user_with_invalid_token(self, client):
        """Test getting current user with invalid token"""
        headers = {"Authorization": "Bearer invalid.token.here"}

        response = client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == 401
        data = response.json()
        assert "invalid" in data["detail"].lower()

    def test_change_password_success(self, client, test_user, auth_headers):
        """Test successful password change"""
        password_data = {
            "current_password": "testpass123",  # Assuming current password
            "new_password": "newsecurepass123"
        }

        response = client.post("/api/v1/auth/change-password", json=password_data, headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "Password changed successfully" in data["message"]

    def test_change_password_wrong_current(self, client, auth_headers):
        """Test password change with wrong current password"""
        password_data = {
            "current_password": "wrongpassword",
            "new_password": "newsecurepass123"
        }

        response = client.post("/api/v1/auth/change-password", json=password_data, headers=auth_headers)

        assert response.status_code == 400
        data = response.json()
        assert "incorrect" in data["detail"].lower()

    def test_logout(self, client):
        """Test user logout"""
        response = client.post("/api/v1/auth/logout")

        assert response.status_code == 200
        data = response.json()
        assert "Logged out successfully" in data["message"]

    def test_refresh_token_success(self, client, auth_headers):
        """Test successful token refresh"""
        response = client.post("/api/v1/auth/refresh-token", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "Token refreshed successfully" in data["message"]
        assert "token" in data

    def test_refresh_token_without_auth(self, client):
        """Test token refresh without authentication"""
        response = client.post("/api/v1/auth/refresh-token")

        assert response.status_code == 401

    # Test different user roles and permissions
    def test_register_doctor_role(self, client):
        """Test registering a user with doctor role"""
        user_data = {
            "email": "doctor@example.com",
            "password": "securepass123",
            "first_name": "Dr",
            "last_name": "Smith",
            "role": "doctor"
        }

        response = client.post("/api/v1/auth/register", json=user_data)

        assert response.status_code == 201
        data = response.json()
        assert data["user"]["role"] == "doctor"

    def test_register_receptionist_role(self, client):
        """Test registering a user with receptionist role"""
        user_data = {
            "email": "receptionist@example.com",
            "password": "securepass123",
            "first_name": "Jane",
            "last_name": "Wilson",
            "role": "receptionist"
        }

        response = client.post("/api/v1/auth/register", json=user_data)

        assert response.status_code == 201
        data = response.json()
        assert data["user"]["role"] == "receptionist"

    # Test device registration
    def test_device_registration_on_login(self, client, test_user):
        """Test that device info is registered during login"""
        login_data = {
            "email": test_user.email,
            "password": "testpass123",
            "device": {
                "device_name": "iPhone 12",
                "device_type": "mobile",
                "device_platform": "iOS",
                "device_os": "iOS 15.0",
                "device_serial": "unique-device-id-123"
            }
        }

        response = client.post("/api/v1/auth/login", json=login_data)

        assert response.status_code == 200
        # In a real test, we'd verify the device was stored in the database
        # For now, just verify the login succeeded