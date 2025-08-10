import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routes import patients, reports
from routes import scan_types
from routes import referring_doctors
from routes import clinic_users
from routes import clinics
from routes import users
from routes import auth
from routes import payments
from services.template_service import TemplateService

app = FastAPI()

# CORS setup - Explicit origins for production
origins = [
    "http://localhost:3000",  # Docker frontend
    "http://localhost:5173",
    "http://localhost:5174", 
    "http://127.0.0.1:3000",  # Docker frontend alternative
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
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

# Mount static files for template assets
app.mount("/public/templates/assets", StaticFiles(directory="templates/assets"), name="template-assets")

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(patients.router, prefix="/patients", tags=["patients"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])
app.include_router(scan_types.router, prefix="/scan-types", tags=["scan_types"])
app.include_router(referring_doctors.router, prefix="/referring-doctors", tags=["referring_doctors"])
app.include_router(clinic_users.router, prefix="/clinic-users", tags=["clinic_users"])
app.include_router(clinics.router, prefix="/clinics", tags=["clinics"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(payments.router, prefix="/payments", tags=["payments"])

@app.get("/")
def root():
    return {"message": "Radiology Clinic Backend is running"}

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

 
