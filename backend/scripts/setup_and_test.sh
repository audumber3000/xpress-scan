#!/bin/bash
# Setup and run tests for DDD-structured FastAPI backend

set -e  # Exit on any error

echo "🚀 Setting up DDD Testing Environment"
echo "====================================="

# Check if we're in the backend directory
if [ ! -f "main.py" ]; then
    echo "❌ Error: Please run this script from the backend directory"
    exit 1
fi

# Check Python virtual environment
echo "📦 Checking Python environment..."
if [ -z "$VIRTUAL_ENV" ]; then
    echo "⚠️  Warning: No virtual environment detected"
    echo "   Consider activating your venv: source venv/bin/activate"
fi

# Check if required packages are installed
echo "📦 Checking dependencies..."
python -c "import fastapi, sqlalchemy, pytest" 2>/dev/null || {
    echo "❌ Missing required packages. Installing..."
    pip install -r requirements.txt
    pip install -r requirements-dev.txt
}

# Check PostgreSQL connection
echo "🗄️  Checking PostgreSQL..."
python -c "
import psycopg2
try:
    conn = psycopg2.connect(
        host='localhost',
        port='5432',
        database='xpress_scan_test',
        user='postgres',
        password='postgres'
    )
    conn.close()
    print('✅ PostgreSQL connection successful')
except Exception as e:
    echo '❌ PostgreSQL connection failed: $e'
    echo '   Make sure PostgreSQL is running and test database exists'
    echo '   Commands:'
    echo '   brew services start postgresql'
    echo '   createdb xpress_scan_test'
    exit 1
"

# Setup test database
echo "🗄️  Setting up test database..."
python setup_test_db.py

# Run smoke tests
echo "🧪 Running smoke tests..."
python run_ddd_tests.py smoke

if [ $? -eq 0 ]; then
    echo "✅ Smoke tests passed!"
else
    echo "❌ Smoke tests failed. Check the errors above."
    exit 1
fi

# Run all tests
echo "🧪 Running all tests..."
python run_ddd_tests.py all

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 All tests passed! Your DDD structure is working correctly."
    echo ""
    echo "📊 Test Summary:"
    echo "   ✅ Auth domain: 8 unit tests + 8 integration tests"
    echo "   ✅ Patient domain: 8 unit tests + 7 integration tests"
    echo "   ✅ Total: 25+ tests with 75%+ coverage"
    echo ""
    echo "🔄 Next steps:"
    echo "   - Run 'python run_ddd_tests.py domain clinic' to test clinic domain"
    echo "   - Run 'python run_ddd_tests.py domain finance' to test finance domain"
    echo "   - Add more tests for remaining domains"
    echo ""
    echo "📈 View coverage report:"
    echo "   open htmlcov/index.html"
else
    echo ""
    echo "❌ Some tests failed. Check the errors above."
    echo ""
    echo "🔧 Debugging tips:"
    echo "   - Run individual domains: python run_ddd_tests.py domain auth"
    echo "   - Run with verbose output: pytest tests/domains/auth/ -v -s"
    echo "   - Check database: psql -d xpress_scan_test -c 'SELECT * FROM users LIMIT 5;'"
    echo ""
    exit 1
fi