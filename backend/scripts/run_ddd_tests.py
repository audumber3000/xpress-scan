#!/usr/bin/env python3
"""
Test runner script for DDD-structured backend
"""
import os
import sys
import pytest
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Set test environment variables
os.environ["USE_LOCAL_DB"] = "true"
os.environ["LOCAL_DB_HOST"] = "localhost"
os.environ["LOCAL_DB_PORT"] = "5432"
os.environ["LOCAL_DB_NAME"] = "xpress_scan_test"
os.environ["LOCAL_DB_USER"] = "postgres"
os.environ["LOCAL_DB_PASSWORD"] = "postgres"


def run_domain_tests(domain_name: str = None):
    """Run tests for a specific domain or all domains"""
    if domain_name:
        print(f"Running tests for domain: {domain_name}")
        domain_path = f"tests/domains/{domain_name}"
        if not os.path.exists(domain_path):
            print(f"Domain '{domain_name}' not found!")
            return 1

        result = pytest.main([
            domain_path,
            "-v",
            "--tb=short",
            f"--cov=domains.{domain_name}",
            "--cov-report=term-missing"
        ])
    else:
        print("Running all domain tests...")
        result = pytest.main([
            "tests/domains/",
            "-v",
            "--tb=short",
            "--cov=domains",
            "--cov-report=html",
            "--cov-report=term-missing",
            "--cov-fail-under=70"  # Lower threshold for initial DDD structure
        ])
    return result


def run_unit_tests():
    """Run all unit tests (service layer)"""
    print("Running unit tests (services)...")
    result = pytest.main([
        "tests/domains/",
        "-k", "test_ and not integration",
        "-v",
        "--tb=short",
        "--cov=domains",
        "--cov-report=term-missing"
    ])
    return result


def run_integration_tests():
    """Run all integration tests (API endpoints)"""
    print("Running integration tests (routes)...")
    result = pytest.main([
        "tests/domains/",
        "-k", "integration",
        "-v",
        "--tb=short",
        "--cov=domains",
        "--cov-report=term-missing"
    ])
    return result


def run_smoke_tests():
    """Run basic smoke tests to verify structure"""
    print("Running smoke tests...")

    # Test imports
    try:
        from domains.patient.services.patient_service import PatientService
        from domains.auth.services.auth_service import AuthService
        from domains.clinic.services.clinic_service import ClinicService
        from domains.finance.services.payment_service import PaymentService
        print("✅ All domain imports successful")
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return 1

    # Test basic functionality
    try:
        from core.dependencies import get_patient_service, get_auth_service
        print("✅ Dependency injection working")
    except Exception as e:
        print(f"❌ DI error: {e}")
        return 1

    print("✅ Smoke tests passed!")
    return 0


def show_available_domains():
    """Show all available domains for testing"""
    domains_dir = Path("tests/domains")
    if not domains_dir.exists():
        print("No domains directory found!")
        return

    domains = [d.name for d in domains_dir.iterdir() if d.is_dir()]
    print("Available domains for testing:")
    for domain in sorted(domains):
        print(f"  - {domain}")
    print(f"\nTotal domains: {len(domains)}")


def show_test_commands():
    """Show available test commands"""
    print("""
DDD Testing Commands:

# Setup (run first time)
python setup_test_db.py              # Setup test database

# Smoke tests (verify structure)
python run_ddd_tests.py smoke

# Domain-specific tests
python run_ddd_tests.py domain auth
python run_ddd_tests.py domain patient
python run_ddd_tests.py domain clinic
python run_ddd_tests.py domain finance

# Test types
python run_ddd_tests.py unit        # Unit tests only
python run_ddd_tests.py integration # Integration tests only
python run_ddd_tests.py all         # All tests

# Show available domains
python run_ddd_tests.py domains

# Examples with pytest directly
pytest tests/domains/auth/ -v
pytest tests/domains/ -k "test_create" -v
pytest tests/domains/ --cov=domains --cov-report=html

# Troubleshooting
python setup_test_db.py             # If database issues
pytest --version                    # Check pytest installation
""")


def run_setup():
    """Setup test database"""
    import subprocess
    try:
        result = subprocess.run([sys.executable, "setup_test_db.py"], capture_output=True, text=True)
        print(result.stdout)
        if result.stderr:
            print("Errors:", result.stderr)
        return result.returncode
    except Exception as e:
        print(f"Failed to run setup: {e}")
        return 1


if __name__ == "__main__":
    if len(sys.argv) < 2:
        show_test_commands()
        sys.exit(1)

    command = sys.argv[1].lower()

    if command == "setup":
        sys.exit(run_setup())
    elif command == "smoke":
        sys.exit(run_smoke_tests())
    elif command == "unit":
        sys.exit(run_unit_tests())
    elif command == "integration":
        sys.exit(run_integration_tests())
    elif command == "all":
        sys.exit(run_domain_tests())
    elif command == "domain" and len(sys.argv) > 2:
        domain_name = sys.argv[2]
        sys.exit(run_domain_tests(domain_name))
    elif command == "domains":
        show_available_domains()
        sys.exit(0)
    else:
        print(f"Unknown command: {command}")
        show_test_commands()
        sys.exit(1)