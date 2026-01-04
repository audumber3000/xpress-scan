import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routes import patients, reports
from routes import treatment_types
from routes import referring_doctors
from routes import clinic_users
from routes import clinics
from routes import users
from routes import auth
from routes import payments
# from routes import whatsapp_config  # File doesn't exist, commented out
from routes import whatsapp_inbox
from routes import attendance
from routes import attendance_mobile
from routes import appointments
from routes import invoices
from routes import xray
from routes import message_templates
from routes import devices
from routes import dashboard
from routes import sync
from services.template_service import TemplateService

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

app = FastAPI()

# CORS setup - Explicit origins for production
origins = [
    "http://localhost:3000",  # Docker frontend
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:1420",  # Tauri dev server
    "http://127.0.0.1:3000",  # Docker frontend alternative
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:1420",  # Tauri dev server
    "tauri://localhost",      # Tauri production
    "https://tauri.localhost", # Tauri production alternative
    "https://xpress-scan.vercel.app",  # Vercel frontend
    "https://xpress-scan.onrender.com",  # Backend URL
    "https://xpress-scan-frontend.vercel.app",  # Alternative Vercel URL
    "https://xpress-scan-frontend.onrender.com",  # Alternative Render URL
    "https://www.betterclinic.app",  # New production domain
    "https://betterclinic.app",  # Alternative without www
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Use explicit origins instead of "*"
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Mount static files for template assets (handle PyInstaller bundling)
templates_assets_path = os.path.join(BASE_PATH, "templates", "assets")
if os.path.exists(templates_assets_path):
    app.mount("/public/templates/assets", StaticFiles(directory=templates_assets_path), name="template-assets")
else:
    print(f"Warning: templates/assets not found at {templates_assets_path}")

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(patients.router, prefix="/patients", tags=["patients"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])
app.include_router(treatment_types.router, prefix="/treatment-types", tags=["treatment_types"])
app.include_router(referring_doctors.router, prefix="/referring-doctors", tags=["referring_doctors"])
app.include_router(clinic_users.router, prefix="/clinic-users", tags=["clinic_users"])
app.include_router(clinics.router, prefix="/clinics", tags=["clinics"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(payments.router, prefix="/payments", tags=["payments"])
# app.include_router(whatsapp_config.router, prefix="/whatsapp-config", tags=["whatsapp_config"])  # File doesn't exist, commented out
app.include_router(whatsapp_inbox.router, prefix="/whatsapp/inbox", tags=["whatsapp_inbox"])
app.include_router(attendance.router, prefix="/attendance", tags=["attendance"])
app.include_router(attendance_mobile.router, prefix="/attendance-mobile", tags=["attendance_mobile"])
app.include_router(appointments.router, prefix="/appointments", tags=["appointments"])
app.include_router(invoices.router, prefix="/invoices", tags=["invoices"])
app.include_router(xray.router, prefix="/xray", tags=["xray"])
app.include_router(message_templates.router, prefix="/message-templates", tags=["message_templates"])
app.include_router(devices.router, prefix="/devices", tags=["devices"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(sync.router, prefix="/sync", tags=["sync"])

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

 
