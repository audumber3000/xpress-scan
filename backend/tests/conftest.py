"""
Test configuration and fixtures
"""
import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set environment variables for testing (use local database)
os.environ["USE_LOCAL_DB"] = "true"
os.environ["LOCAL_DB_HOST"] = "localhost"
os.environ["LOCAL_DB_PORT"] = "5432"
os.environ["LOCAL_DB_NAME"] = "xpress_scan_test"
os.environ["LOCAL_DB_USER"] = "postgres"
os.environ["LOCAL_DB_PASSWORD"] = "postgres"

# Now import after setting environment variables
from models import Base
from database import get_db
from main import app
from fastapi.testclient import TestClient

# Test database URL (constructed from environment)
TEST_DATABASE_URL = f"postgresql://{os.environ['LOCAL_DB_USER']}:{os.environ['LOCAL_DB_PASSWORD']}@{os.environ['LOCAL_DB_HOST']}:{os.environ['LOCAL_DB_PORT']}/{os.environ['LOCAL_DB_NAME']}"

# Create test engine
test_engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session")
def test_db():
    """Create test database tables"""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def db_session(test_db):
    """Create a test database session"""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_session):
    """Create test client with database session"""
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def test_clinic(db_session):
    """Create a test clinic"""
    from models import Clinic
    clinic = Clinic(
        name="Test Clinic",
        address="123 Test Street",
        phone="1234567890",
        email="test@clinic.com",
        specialization="dental",
        subscription_plan="free"
    )
    db_session.add(clinic)
    db_session.commit()
    db_session.refresh(clinic)
    return clinic


@pytest.fixture
def test_user(db_session, test_clinic):
    """Create a test user"""
    from domains.auth.services.auth_service import AuthService
    from models import User

    # Create auth service for password hashing
    auth_service = AuthService(None, None, None)

    user = User(
        clinic_id=test_clinic.id,
        email="test@example.com",
        first_name="Test",
        last_name="User",
        name="Test User",
        role="clinic_owner",
        is_active=True,
        password_hash=auth_service._hash_password("testpass123"),  # Set test password
        permissions={
            "patients:view": True,
            "patients:edit": True,
            "patients:delete": True
        }
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user):
    """Create authentication headers"""
    from domains.auth.services.auth_service import AuthService
    # Create a minimal auth service instance for testing
    auth_service = AuthService(None, None, None)
    token = auth_service.create_jwt_token(test_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def test_patient(db_session, test_clinic):
    """Create a test patient"""
    from models import Patient
    patient = Patient(
        clinic_id=test_clinic.id,
        name="John Doe",
        age=30,
        gender="male",
        village="Test Village",
        phone="1234567890",
        referred_by="Dr. Smith",
        treatment_type="X-Ray"
    )
    db_session.add(patient)
    db_session.commit()
    db_session.refresh(patient)
    return patient