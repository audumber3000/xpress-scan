# 🧪 DDD Testing Guide

This guide explains how to test your Domain-Driven Design (DDD) structured FastAPI application.

## 📁 Test Structure Overview

```
backend/
├── domains/                          # Bounded Contexts
│   ├── auth/
│   │   ├── services/                # Business Logic
│   │   ├── repositories/            # Data Access
│   │   └── routes/                  # HTTP Endpoints
│   └── [other domains...]
│
├── tests/
│   ├── domains/                     # Domain-specific tests
│   │   ├── auth/
│   │   │   ├── test_auth_service.py         # Unit tests
│   │   │   └── test_auth_integration.py     # Integration tests
│   │   ├── patient/
│   │   │   ├── test_patient_service.py      # Unit tests
│   │   │   └── test_patient_integration.py  # Integration tests
│   │   └── [other domain tests...]
│   ├── conftest.py                  # Shared test fixtures
│   └── [other shared test files...]
│
├── run_ddd_tests.py                # Test runner script
└── pytest.ini                      # Pytest configuration
```

## 🎯 Testing Strategy

### **1. Unit Tests (Service Layer)**
- Test business logic in isolation
- Mock external dependencies (repositories, external APIs)
- Fast execution, high coverage target (80%+)

### **2. Integration Tests (API Layer)**
- Test complete HTTP request/response cycles
- Use real database with test fixtures
- Verify API contracts and error handling

### **3. Domain Tests (Bounded Context)**
- Test entire domains as units
- Verify domain boundaries and contracts
- Ensure domain integrity

## 🚀 Quick Start Testing

### **Run All Tests**
```bash
# Run all domain tests with coverage
python run_ddd_tests.py all

# Or use pytest directly
pytest tests/domains/ --cov=domains --cov-report=html
```

### **Run Domain-Specific Tests**
```bash
# Test specific domain
python run_ddd_tests.py domain auth
python run_ddd_tests.py domain patient

# Test with pytest
pytest tests/domains/auth/ -v
pytest tests/domains/patient/ -v
```

### **Run Test Types**
```bash
# Unit tests only
python run_ddd_tests.py unit

# Integration tests only
python run_ddd_tests.py integration

# Smoke tests (verify structure)
python run_ddd_tests.py smoke
```

## 📋 Test Categories & Examples

### **1. Auth Domain Tests**

#### **Unit Tests (`test_auth_service.py`)**
```python
def test_authenticate_user_success(self, auth_service, mock_auth_repo):
    """Test successful authentication"""
    # Arrange
    mock_auth_repo.authenticate_user.return_value = Mock()

    # Act
    result = auth_service.authenticate_user("user@example.com", "password")

    # Assert
    assert result is not None
    mock_auth_repo.authenticate_user.assert_called_once()

def test_create_jwt_token(self, auth_service):
    """Test JWT token generation"""
    token = auth_service.create_jwt_token(123)
    assert isinstance(token, str)

    # Verify token
    payload = jwt.decode(token, auth_service.jwt_secret, algorithms=["HS256"])
    assert payload["user_id"] == 123
```

#### **Integration Tests (`test_auth_integration.py`)**
```python
def test_register_user_success(self, client):
    """Test user registration endpoint"""
    user_data = {
        "email": "new@example.com",
        "password": "secure123",
        "first_name": "John",
        "last_name": "Doe",
        "role": "clinic_owner"
    }

    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 201

    data = response.json()
    assert data["user"]["email"] == user_data["email"]
    assert "token" in data

def test_login_success(self, client, test_user):
    """Test user login"""
    login_data = {
        "email": test_user.email,
        "password": "testpass123"
    }

    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200

    data = response.json()
    assert data["user"]["id"] == test_user.id
    assert "token" in data
```

### **2. Patient Domain Tests**

#### **Unit Tests**
```python
def test_create_patient_success(self, patient_service, mock_patient_repo, mock_clinic_repo):
    """Test patient creation with validations"""
    # Arrange
    mock_clinic_repo.get_by_id.return_value = Mock(status="active")

    patient_data = {
        "name": "John Doe",
        "age": 30,
        "gender": "male",
        "phone": "1234567890"
    }

    # Act
    patient = patient_service.create_patient(patient_data, clinic_id=1)

    # Assert
    assert patient.name == "John Doe"
    mock_patient_repo.create.assert_called_once()

def test_create_patient_duplicate_phone(self, patient_service, mock_patient_repo):
    """Test duplicate phone validation"""
    # Arrange
    mock_patient_repo.get_by_phone.return_value = Mock()  # Existing patient

    # Act & Assert
    with pytest.raises(ValueError, match="already exists"):
        patient_service.create_patient({
            "name": "Jane Doe",
            "phone": "1234567890"  # Duplicate
        }, clinic_id=1)
```

#### **Integration Tests**
```python
def test_create_patient_success(self, client, test_clinic, auth_headers):
    """Test patient creation endpoint"""
    patient_data = {
        "name": "Jane Smith",
        "age": 25,
        "gender": "female",
        "village": "Test Village",
        "phone": "0987654321",
        "referred_by": "Dr. Johnson",
        "treatment_type": "Consultation"
    }

    response = client.post("/api/v1/patients/", json=patient_data, headers=auth_headers)

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Jane Smith"
    assert data["clinic_id"] == test_clinic.id

def test_get_patients_with_pagination(self, client, auth_headers):
    """Test patient listing with pagination"""
    response = client.get("/api/v1/patients/?skip=0&limit=10", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) <= 10
```

## 🛠️ Test Fixtures & Setup

### **Shared Fixtures (`conftest.py`)**

```python
@pytest.fixture(scope="session")
def test_db():
    """Create test database"""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture
def client(db_session):
    """Test client with database session"""
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as client:
        yield client

@pytest.fixture
def test_clinic(db_session):
    """Create test clinic"""
    clinic = Clinic(name="Test Clinic", status="active")
    db_session.add(clinic)
    db_session.commit()
    return clinic

@pytest.fixture
def test_user(db_session, test_clinic):
    """Create test user"""
    user = User(
        clinic_id=test_clinic.id,
        email="test@example.com",
        name="Test User",
        role="clinic_owner"
    )
    db_session.add(user)
    db_session.commit()
    return user

@pytest.fixture
def auth_headers(test_user):
    """Generate auth headers"""
    from domains.auth.services.auth_service import AuthService
    service = AuthService(None, None, None)  # Minimal instance
    token = service.create_jwt_token(test_user.id)
    return {"Authorization": f"Bearer {token}"}
```

## 📊 Coverage Goals

| **Domain** | **Unit Test Coverage** | **Integration Coverage** |
|------------|------------------------|--------------------------|
| Auth | 85%+ | 90%+ |
| Patient | 85%+ | 90%+ |
| Clinic | 80%+ | 85%+ |
| Finance | 80%+ | 85%+ |
| Communication | 75%+ | 80%+ |
| Overall | 80%+ | 85%+ |

## 🔍 Test Patterns

### **Happy Path Tests**
```python
def test_create_patient_success(self, client, auth_headers):
    # Test successful creation
    pass

def test_get_patient_success(self, client, test_patient, auth_headers):
    # Test successful retrieval
    pass
```

### **Error Handling Tests**
```python
def test_create_patient_invalid_data(self, client, auth_headers):
    # Test validation errors
    pass

def test_get_patient_not_found(self, client, auth_headers):
    # Test 404 errors
    pass
```

### **Authorization Tests**
```python
def test_access_without_auth(self, client):
    # Test unauthenticated access
    pass

def test_access_wrong_clinic(self, client, auth_headers):
    # Test cross-clinic access
    pass
```

### **Edge Case Tests**
```python
def test_create_patient_boundary_age(self, client, auth_headers):
    # Test age limits
    pass

def test_search_empty_results(self, client, auth_headers):
    # Test empty search results
    pass
```

## 🚦 CI/CD Integration

### **GitHub Actions Example**
```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Run smoke tests
        run: python run_ddd_tests.py smoke

      - name: Run unit tests
        run: python run_ddd_tests.py unit

      - name: Run integration tests
        run: python run_ddd_tests.py integration

      - name: Upload coverage
        uses: codecov/codecov-action@v2
        with:
          file: ./coverage.xml
          flags: backend
```

## 🐛 Debugging Failed Tests

### **Common Issues & Solutions**

#### **Import Errors**
```bash
# Check Python path
python -c "import sys; print(sys.path)"

# Test imports manually
python -c "from domains.patient.services.patient_service import PatientService"
```

#### **Database Connection Issues**
```bash
# Check test database
psql -h localhost -U postgres -d xpress_scan_test

# Reset test database
pytest --create-db
```

#### **Mocking Issues**
```python
# Use proper mock return values
mock_repo.get_by_id.return_value = Mock(id=1, name="Test")

# Verify mock calls
mock_repo.create.assert_called_once_with(expected_patient)
```

## 📈 Test Metrics & Reporting

### **Coverage Report**
```bash
# Generate HTML coverage report
pytest tests/ --cov=domains --cov-report=html

# Open in browser
open htmlcov/index.html
```

### **Performance Testing**
```bash
# Time individual tests
pytest tests/domains/auth/ -v --durations=10

# Profile slow tests
pytest tests/ --profile-svg
```

## 🎯 Best Practices

### **1. Test Naming**
```python
# Good
def test_create_patient_with_valid_data()
def test_get_patient_returns_correct_data()
def test_update_patient_fails_with_invalid_id()

# Bad
def test_create()
def test_get()
def test_update()
```

### **2. Test Isolation**
```python
# Each test is independent
def test_create_patient(self, client, auth_headers):
    # Clean state for each test
    pass

# Use fixtures for setup
@pytest.fixture
def test_patient(self, client, auth_headers):
    # Create and return test patient
    pass
```

### **3. Test Data Management**
```python
# Use realistic test data
patient_data = {
    "name": "John Doe",
    "age": 30,  # Valid age
    "gender": "male",
    "phone": "+1234567890"  # Valid format
}

# Test boundaries
@pytest.mark.parametrize("age", [0, 17, 151])
def test_create_patient_invalid_age(self, client, auth_headers, age):
    # Test edge cases
    pass
```

### **4. Domain Testing Focus**
- **Auth Domain**: Authentication, authorization, user management
- **Patient Domain**: Patient CRUD, validations, relationships
- **Clinic Domain**: Clinic management, subscriptions
- **Finance Domain**: Payments, invoices, financial logic

This comprehensive testing strategy ensures your DDD-structured application is thoroughly tested at all layers! 🧪✨