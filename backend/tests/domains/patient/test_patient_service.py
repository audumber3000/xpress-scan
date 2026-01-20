"""
Unit tests for PatientService with mocked repositories
"""
import pytest
from unittest.mock import Mock, MagicMock
from domains.patient.services.patient_service import PatientService
from models import Patient
from core.dtos import PatientCreateDTO


@pytest.fixture
def mock_patient_repo():
    """Mock patient repository"""
    repo = Mock()
    repo.db = Mock()  # Mock database session
    return repo


@pytest.fixture
def mock_clinic_repo():
    """Mock clinic repository"""
    return Mock()


@pytest.fixture
def mock_payment_repo():
    """Mock payment repository"""
    return Mock()


@pytest.fixture
def patient_service(mock_patient_repo, mock_clinic_repo, mock_payment_repo):
    """Patient service with mocked dependencies"""
    return PatientService(mock_patient_repo, mock_clinic_repo, mock_payment_repo)


class TestPatientService:
    """Test cases for PatientService"""

    def test_create_patient_success(self, patient_service, mock_patient_repo, mock_clinic_repo):
        """Test successful patient creation"""
        # Arrange
        clinic_id = 1
        patient_data = {
            "name": "John Doe",
            "age": 30,
            "gender": "male",
            "village": "Test Village",
            "phone": "1234567890",
            "referred_by": "Dr. Smith",
            "treatment_type": "X-Ray"
        }

        mock_clinic = Mock()
        mock_clinic.status = "active"
        mock_clinic_repo.get_by_id.return_value = mock_clinic

        mock_patient_repo.get_by_phone.return_value = None  # No duplicate phone

        expected_patient = Patient(id=1, clinic_id=clinic_id, **patient_data)
        mock_patient_repo.create.return_value = expected_patient

        # Act
        result = patient_service.create_patient(patient_data, clinic_id)

        # Assert
        assert result.id == 1
        assert result.name == "John Doe"
        assert result.clinic_id == clinic_id
        mock_clinic_repo.get_by_id.assert_called_once_with(clinic_id)
        mock_patient_repo.get_by_phone.assert_called_once_with(clinic_id, "1234567890")
        mock_patient_repo.create.assert_called_once()

    def test_create_patient_duplicate_phone(self, patient_service, mock_patient_repo, mock_clinic_repo):
        """Test patient creation with duplicate phone number"""
        # Arrange
        clinic_id = 1
        patient_data = {
            "name": "John Doe",
            "age": 30,
            "gender": "male",
            "village": "Test Village",
            "phone": "1234567890",
            "referred_by": "Dr. Smith",
            "treatment_type": "X-Ray"
        }

        mock_clinic = Mock()
        mock_clinic.status = "active"
        mock_clinic_repo.get_by_id.return_value = mock_clinic

        existing_patient = Mock()
        mock_patient_repo.get_by_phone.return_value = existing_patient

        # Act & Assert
        with pytest.raises(ValueError, match="Patient with phone number 1234567890 already exists"):
            patient_service.create_patient(patient_data, clinic_id)

    def test_create_patient_invalid_clinic(self, patient_service, mock_clinic_repo):
        """Test patient creation with invalid clinic"""
        # Arrange
        clinic_id = 999
        patient_data = {
            "name": "John Doe",
            "age": 30,
            "gender": "male",
            "village": "Test Village",
            "phone": "1234567890",
            "referred_by": "Dr. Smith",
            "treatment_type": "X-Ray"
        }

        mock_clinic_repo.get_by_id.return_value = None

        # Act & Assert
        with pytest.raises(ValueError, match="Invalid or inactive clinic"):
            patient_service.create_patient(patient_data, clinic_id)

    def test_get_patient_success(self, patient_service, mock_patient_repo):
        """Test successful patient retrieval"""
        # Arrange
        patient_id = 1
        clinic_id = 1
        expected_patient = Mock()
        expected_patient.id = patient_id
        expected_patient.clinic_id = clinic_id

        mock_patient_repo.get_by_id.return_value = expected_patient

        # Act
        result = patient_service.get_patient(patient_id, clinic_id)

        # Assert
        assert result == expected_patient
        mock_patient_repo.get_by_id.assert_called_once_with(patient_id)

    def test_get_patient_wrong_clinic(self, patient_service, mock_patient_repo):
        """Test patient retrieval with wrong clinic ID"""
        # Arrange
        patient_id = 1
        clinic_id = 1
        wrong_clinic_id = 2

        patient = Mock()
        patient.id = patient_id
        patient.clinic_id = clinic_id

        mock_patient_repo.get_by_id.return_value = patient

        # Act
        result = patient_service.get_patient(patient_id, wrong_clinic_id)

        # Assert
        assert result is None

    def test_get_patients_success(self, patient_service, mock_patient_repo):
        """Test successful patients list retrieval"""
        # Arrange
        clinic_id = 1
        expected_patients = [Mock(), Mock(), Mock()]
        mock_patient_repo.get_by_clinic_id.return_value = expected_patients

        # Act
        result = patient_service.get_patients(clinic_id)

        # Assert
        assert result == expected_patients
        mock_patient_repo.get_by_clinic_id.assert_called_once_with(clinic_id, 0, 100)

    def test_update_patient_success(self, patient_service, mock_patient_repo):
        """Test successful patient update"""
        # Arrange
        patient_id = 1
        clinic_id = 1
        updates = {"name": "Updated Name", "age": 35}

        existing_patient = Mock()
        existing_patient.id = patient_id
        existing_patient.clinic_id = clinic_id
        existing_patient.phone = "1234567890"

        updated_patient = Mock()
        updated_patient.id = patient_id
        updated_patient.name = "Updated Name"
        updated_patient.age = 35

        mock_patient_repo.get_by_id.return_value = existing_patient
        mock_patient_repo.get_by_phone.return_value = None  # No phone conflict
        mock_patient_repo.update.return_value = updated_patient

        # Act
        result = patient_service.update_patient(patient_id, updates, clinic_id)

        # Assert
        assert result == updated_patient
        mock_patient_repo.update.assert_called_once_with(patient_id, updates)

    def test_update_patient_duplicate_phone(self, patient_service, mock_patient_repo):
        """Test patient update with duplicate phone number"""
        # Arrange
        patient_id = 1
        clinic_id = 1
        updates = {"phone": "0987654321"}

        existing_patient = Mock()
        existing_patient.id = patient_id
        existing_patient.clinic_id = clinic_id
        existing_patient.phone = "1234567890"

        duplicate_patient = Mock()
        duplicate_patient.id = 2

        mock_patient_repo.get_by_id.return_value = existing_patient
        mock_patient_repo.get_by_phone.return_value = duplicate_patient

        # Act & Assert
        with pytest.raises(ValueError, match="Patient with phone number 0987654321 already exists"):
            patient_service.update_patient(patient_id, updates, clinic_id)

    def test_delete_patient_success(self, patient_service, mock_patient_repo, mock_payment_repo):
        """Test successful patient deletion"""
        # Arrange
        patient_id = 1
        clinic_id = 1

        patient = Mock()
        patient.id = patient_id
        patient.clinic_id = clinic_id

        mock_patient_repo.get_by_id.return_value = patient
        mock_payment_repo.get_by_patient_id.return_value = []  # No payments
        mock_patient_repo.delete.return_value = True

        # Act
        result = patient_service.delete_patient(patient_id, clinic_id)

        # Assert
        assert result is True
        mock_patient_repo.delete.assert_called_once_with(patient_id)

    def test_delete_patient_with_payments(self, patient_service, mock_patient_repo, mock_payment_repo):
        """Test patient deletion with existing payments (should fail)"""
        # Arrange
        patient_id = 1
        clinic_id = 1

        patient = Mock()
        patient.id = patient_id
        patient.clinic_id = clinic_id

        payments = [Mock()]  # Has payments

        mock_patient_repo.get_by_id.return_value = patient
        mock_payment_repo.get_by_patient_id.return_value = payments

        # Act & Assert
        with pytest.raises(ValueError, match="Cannot delete patient with existing payments"):
            patient_service.delete_patient(patient_id, clinic_id)

    def test_search_patients_success(self, patient_service, mock_patient_repo):
        """Test successful patient search"""
        # Arrange
        clinic_id = 1
        query = "John"
        expected_results = [Mock(), Mock()]

        mock_patient_repo.search_by_name.return_value = expected_results

        # Act
        result = patient_service.search_patients(clinic_id, query)

        # Assert
        assert result == expected_results
        mock_patient_repo.search_by_name.assert_called_once_with(clinic_id, query, 0, 100)

    def test_search_patients_empty_query(self, patient_service, mock_patient_repo):
        """Test patient search with empty query"""
        # Arrange
        clinic_id = 1
        query = ""

        # Act
        result = patient_service.search_patients(clinic_id, query)

        # Assert
        assert result == []
        mock_patient_repo.search_by_name.assert_not_called()

    def test_get_patient_stats_success(self, patient_service, mock_patient_repo):
        """Test successful patient statistics retrieval"""
        # Arrange
        clinic_id = 1
        expected_stats = {
            "total_patients": 50,
            "gender_distribution": {"male": 25, "female": 25},
            "age_stats": {"average": 35.5, "min": 18, "max": 80}
        }

        mock_patient_repo.get_patient_stats.return_value = expected_stats

        # Act
        result = patient_service.get_patient_stats(clinic_id)

        # Assert
        assert result == expected_stats
        mock_patient_repo.get_patient_stats.assert_called_once_with(clinic_id)