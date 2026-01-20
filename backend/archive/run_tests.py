#!/usr/bin/env python3
"""
Test runner script for clean architecture backend
"""
import os
import sys
import pytest
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

def run_unit_tests():
    """Run unit tests"""
    print("Running unit tests...")
    result = pytest.main([
        "tests/test_patient_service.py",
        "-v",
        "--tb=short",
        "--cov=services",
        "--cov-report=term-missing"
    ])
    return result

def run_integration_tests():
    """Run integration tests"""
    print("Running integration tests...")
    result = pytest.main([
        "tests/test_patient_integration.py",
        "-v",
        "--tb=short",
        "--cov=routes",
        "--cov-report=term-missing"
    ])
    return result

def run_all_tests():
    """Run all tests"""
    print("Running all tests...")
    result = pytest.main([
        "tests/",
        "-v",
        "--tb=short",
        "--cov=.",
        "--cov-report=html",
        "--cov-report=term-missing",
        "--cov-fail-under=80"
    ])
    return result

if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_type = sys.argv[1].lower()
        if test_type == "unit":
            sys.exit(run_unit_tests())
        elif test_type == "integration":
            sys.exit(run_integration_tests())
        elif test_type == "all":
            sys.exit(run_all_tests())
        else:
            print("Usage: python run_tests.py [unit|integration|all]")
            sys.exit(1)
    else:
        # Run all tests by default
        sys.exit(run_all_tests())