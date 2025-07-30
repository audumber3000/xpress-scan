# Radiology Clinical Software

A comprehensive radiology clinic management system with Google OAuth integration and streamlined onboarding.

## Features

### 🔐 Authentication
- **Google OAuth Integration**: Seamless signup/login with Google accounts
- **Role-based Access**: Clinic owners, doctors, and receptionists
- **JWT Authentication**: Secure backend authentication

### 🏥 Clinic Management
- **Streamlined Onboarding**: Complete clinic setup in one flow
- **Multi-tenant Architecture**: Each clinic operates independently
- **Subscription Plans**: Free, Professional, and Enterprise tiers

### 👥 User Management
- **Clinic Owners**: Full access to all features
- **Doctors**: Patient and report management
- **Receptionists**: Basic patient intake and viewing

### 📊 Patient Management
- **Patient Intake**: Comprehensive patient registration
- **Scan Types**: Customizable scan types with pricing
- **Referring Doctors**: Track referring physicians

### 📋 Reports
- **Report Generation**: Create detailed radiology reports
- **Voice Reporting**: Voice-to-text report creation
- **Document Export**: PDF and DOCX export options

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- PostgreSQL database

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python init_db.py
python -m uvicorn main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Onboarding Flow

### For Clinic Owners (Google OAuth)
1. **Sign up with Google**: Click "Continue with Google" on signup page
2. **Automatic Role Assignment**: New users are assigned as clinic owners
3. **Onboarding Redirect**: Users without clinics are redirected to `/onboarding`
4. **Clinic Setup**: Complete clinic information in one form
5. **Dashboard Access**: Ready to use the system

### For Manual Signup
1. **Email Registration**: Traditional email/password signup
2. **Role Selection**: Choose clinic owner, doctor, or receptionist
3. **Onboarding**: Complete clinic setup if needed
4. **Dashboard**: Access to appropriate features

## API Endpoints

### Authentication
- `POST /auth/signup` - User registration
- `POST /auth/login` - User login
- `POST /auth/oauth` - Google OAuth authentication
- `POST /auth/onboarding` - Complete clinic setup
- `GET /auth/me` - Get current user info

### Clinics
- `POST /clinics/` - Create clinic
- `GET /clinics/{id}` - Get clinic details
- `PUT /clinics/{id}` - Update clinic

### Users
- `GET /users/` - Get clinic users
- `POST /users/` - Create user
- `PUT /users/{id}` - Update user

### Patients
- `GET /patients/` - Get patients
- `POST /patients/` - Create patient
- `PUT /patients/{id}` - Update patient

### Reports
- `GET /reports/` - Get reports
- `POST /reports/` - Create report
- `PUT /reports/{id}` - Update report

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost/dbname
JWT_SECRET=your-secret-key
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Frontend (.env)
```
VITE_BACKEND_URL=http://localhost:8000
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Development

### Backend Structure
```
backend/
├── main.py              # FastAPI app
├── models.py            # SQLAlchemy models
├── schemas.py           # Pydantic schemas
├── database.py          # Database connection
├── auth.py              # Authentication utilities
├── routes/              # API routes
│   ├── auth.py         # Authentication routes
│   ├── clinics.py      # Clinic management
│   ├── users.py        # User management
│   ├── patients.py     # Patient management
│   └── reports.py      # Report management
└── services/           # Business logic
    ├── pdf_service.py  # PDF generation
    └── docx_service.py # DOCX generation
```

### Frontend Structure
```
frontend/
├── src/
│   ├── components/     # Reusable components
│   ├── pages/         # Page components
│   ├── contexts/      # React contexts
│   └── App.jsx        # Main app component
├── public/            # Static assets
└── package.json       # Dependencies
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.