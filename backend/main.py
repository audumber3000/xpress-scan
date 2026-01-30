import os
import sys
from dotenv import load_dotenv

# Load environment variables from backend/.env explicitly
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from domains.infrastructure.services.cache_service import cache_service
from core.permissions import permission_manager
# Domain imports (using clean architecture routes)
from domains.patient.routes import patients_clean as patients
from domains.patient.routes import treatment_types, referring_doctors, treatment_plans, patient_files, patient_duplicate_check
from domains.auth.routes import auth_clean as auth
from domains.auth.routes import clinic_users, permissions
from domains.clinic.routes import clinics
from domains.finance.routes import payments_clean as payments, invoices
from domains.communication.routes import whatsapp_inbox, whatsapp_groups, whatsapp_profile, whatsapp_contacts, whatsapp_messages_advanced, notifications, message_templates
from domains.scheduling.routes import attendance, attendance_mobile, appointments
from domains.medical.routes import reports, xray
from domains.analytics.routes import dashboard
from domains.infrastructure.routes import devices, sync, templates
from domains.infrastructure.services.template_service import TemplateService
from domains.gmail.routes import gmail_routes

# Get the base path for PyInstaller bundled app
def get_base_path():
    """Get the base path for resources, handling PyInstaller bundling"""
    if getattr(sys, 'frozen', False):
        # Running as compiled executable
        return sys._MEIPASS
    else:
        # Running as script
        return os.path.dirname(os.path.abspath(__file__))

BASE_PATH = get_base_path()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager"""
    # Startup
    await cache_service.init_cache()
    print("Application started with caching enabled")
    
    # Initialize Casbin permission manager
    try:
        permission_manager._initialize_enforcer()
        print("✅ Casbin permission system initialized")
    except Exception as e:
        print(f"⚠️  Warning: Casbin initialization failed: {e}")

    yield

    # Shutdown
    await cache_service.close()
    print("Application shutdown complete")

app = FastAPI(
    title="Clinic Management API",
    version="1.0.0",
    description="Clean architecture API for dental/radiology clinic management",
    lifespan=lifespan
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Mount static files for template assets (handle PyInstaller bundling)
templates_assets_path = os.path.join(BASE_PATH, "templates", "assets")
if os.path.exists(templates_assets_path):
    app.mount("/public/templates/assets", StaticFiles(directory=templates_assets_path), name="template-assets")
else:
    print(f"Warning: templates/assets not found at {templates_assets_path}")

# Register domain routers with clean architecture
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(clinic_users.router, prefix="/api/v1/clinic-users", tags=["clinic_users"])
app.include_router(permissions.router, prefix="/api/v1/permissions", tags=["permissions"])
app.include_router(patients.router, prefix="/api/v1/patients", tags=["patients"])
app.include_router(treatment_plans.router, prefix="/api/v1/patients", tags=["treatment_plans"])
app.include_router(patient_files.router, prefix="/api/v1/patients", tags=["patient_files"])
app.include_router(patient_duplicate_check.router, prefix="/api/v1/patients", tags=["patient_duplicate_check"])
app.include_router(treatment_types.router, prefix="/api/v1/treatment-types", tags=["treatment_types"])
app.include_router(referring_doctors.router, prefix="/api/v1/referring-doctors", tags=["referring_doctors"])
app.include_router(clinics.router, prefix="/api/v1/clinics", tags=["clinics"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["payments"])
app.include_router(invoices.router, prefix="/api/v1/invoices", tags=["invoices"])
app.include_router(whatsapp_inbox.router, prefix="/api/v1/whatsapp/inbox", tags=["whatsapp_inbox"])
app.include_router(whatsapp_groups.router, prefix="/api/v1/whatsapp/groups", tags=["whatsapp_groups"])
app.include_router(whatsapp_profile.router, prefix="/api/v1/whatsapp/profile", tags=["whatsapp_profile"])
app.include_router(whatsapp_contacts.router, prefix="/api/v1/whatsapp/contacts", tags=["whatsapp_contacts"])
app.include_router(whatsapp_messages_advanced.router, prefix="/api/v1/whatsapp/messages", tags=["whatsapp_messages_advanced"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(message_templates.router, prefix="/api/v1/message-templates", tags=["message_templates"])
app.include_router(attendance.router, prefix="/api/v1/attendance", tags=["attendance"])
app.include_router(attendance_mobile.router, prefix="/api/v1/attendance-mobile", tags=["attendance_mobile"])
app.include_router(appointments.router, prefix="/api/v1/appointments", tags=["appointments"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(xray.router, prefix="/api/v1/xray", tags=["xray"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(devices.router, prefix="/api/v1/devices", tags=["devices"])
app.include_router(sync.router, prefix="/api/v1/sync", tags=["sync"])
app.include_router(templates.router, prefix="/api/v1/templates", tags=["templates"])
app.include_router(gmail_routes.router, prefix="/api/v1/gmail", tags=["gmail"])

@app.get("/")
def root():
    return {"message": "Radiology Clinic Backend is running"}

@app.get("/health")
def health_check():
    """Health check endpoint for desktop app server status"""
    return {"status": "healthy", "message": "Backend is running"}

# Public template endpoints - no authentication required
@app.get("/public/templates")
def list_public_templates():
    """List all available report templates - Public endpoint with no authentication"""
    try:
        template_service = TemplateService()
        templates = template_service.list_templates()
        
        return {
            "templates": templates,
            "total": len(templates)
        }
    except Exception as e:
        return {"error": str(e), "templates": [], "total": 0}

@app.get("/public/templates/{template_name}")
def get_public_template(template_name: str):
    """Get a specific template content - Public endpoint with no authentication"""
    try:
        template_service = TemplateService()
        template_content = template_service.load_template(template_name)
        
        return {
            "template_name": template_name,
            "content": template_content
        }
    except FileNotFoundError:
        return {"error": "Template not found", "template_name": template_name}
    except Exception as e:
        return {"error": str(e), "template_name": template_name}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

 
