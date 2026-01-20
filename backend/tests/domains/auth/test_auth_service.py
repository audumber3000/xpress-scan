"""
Unit tests for AuthService with mocked repositories
"""
import pytest
from unittest.mock import Mock, MagicMock
from domains.auth.services.auth_service import AuthService
from domains.auth.services.user_service import UserService
from models import User


@pytest.fixture
def mock_auth_repo():
    """Mock auth repository"""
    return Mock()


@pytest.fixture
def mock_clinic_repo():
    """Mock clinic repository"""
    return Mock()


@pytest.fixture
def mock_user_repo():
    """Mock user repository"""
    return Mock()


@pytest.fixture
def auth_service(mock_auth_repo, mock_clinic_repo, mock_user_repo):
    """Auth service with mocked dependencies"""
    return AuthService(mock_auth_repo, mock_clinic_repo, mock_user_repo)


class TestAuthService:
    """Test cases for AuthService"""

    def test_authenticate_user_success(self, auth_service, mock_auth_repo):
        """Test successful user authentication"""
        # Arrange
        email = "test@example.com"
        password = "password123"
        expected_user = Mock()
        expected_user.id = 1
        expected_user.email = email

        mock_auth_repo.authenticate_user.return_value = expected_user

        # Act
        result = auth_service.authenticate_user(email, password)

        # Assert
        assert result == expected_user
        mock_auth_repo.authenticate_user.assert_called_once_with(email, auth_service._hash_password(password))

    def test_authenticate_user_invalid_credentials(self, auth_service, mock_auth_repo):
        """Test authentication with invalid credentials"""
        # Arrange
        mock_auth_repo.authenticate_user.return_value = None

        # Act
        result = auth_service.authenticate_user("invalid@email.com", "wrongpass")

        # Assert
        assert result is None

    def test_create_jwt_token(self, auth_service):
        """Test JWT token creation"""
        # Arrange
        user_id = 123

        # Act
        token = auth_service.create_jwt_token(user_id)

        # Assert
        assert isinstance(token, str)
        assert len(token) > 0

        # Verify token can be decoded
        import jwt
        payload = jwt.decode(token, auth_service.jwt_secret, algorithms=[auth_service.jwt_algorithm])
        assert payload["user_id"] == user_id

    def test_validate_token_success(self, auth_service, mock_auth_repo):
        """Test successful token validation"""
        # Arrange
        user_id = 123
        token = auth_service.create_jwt_token(user_id)

        expected_user = Mock()
        expected_user.id = user_id
        mock_auth_repo.validate_session.return_value = expected_user

        # Act
        result = auth_service.validate_token(token)

        # Assert
        assert result == expected_user
        mock_auth_repo.validate_session.assert_called_once_with(user_id)

    def test_validate_token_expired(self, auth_service):
        """Test validation of expired token"""
        # Arrange
        import jwt
        # Create an expired token
        expired_payload = {
            "user_id": 123,
            "exp": 0  # Expired
        }
        expired_token = jwt.encode(expired_payload, auth_service.jwt_secret, algorithm=auth_service.jwt_algorithm)

        # Act
        result = auth_service.validate_token(expired_token)

        # Assert
        assert result is None

    def test_hash_password_consistent(self, auth_service):
        """Test password hashing is consistent"""
        # Arrange
        password = "testpassword123"

        # Act
        hash1 = auth_service._hash_password(password)
        hash2 = auth_service._hash_password(password)

        # Assert
        assert hash1 == hash2
        assert isinstance(hash1, str)
        assert len(hash1) == 64  # SHA256 hex length

    def test_verify_password_success(self, auth_service):
        """Test successful password verification"""
        # Arrange
        password = "testpassword123"
        hashed = auth_service._hash_password(password)

        # Act
        result = auth_service._verify_password(password, hashed)

        # Assert
        assert result is True

    def test_verify_password_failure(self, auth_service):
        """Test password verification failure"""
        # Arrange
        password = "testpassword123"
        wrong_password = "wrongpassword"
        hashed = auth_service._hash_password(password)

        # Act
        result = auth_service._verify_password(wrong_password, hashed)

        # Assert
        assert result is False