import os
import sys
import asyncio
from dotenv import load_dotenv

# Load environment variables from backend/.env explicitly
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import sentry_sdk

sentry_sdk.init(
    dsn="https://73dc9b005c9ed724147ad1f0e119ba48@o4511180469043200.ingest.de.sentry.io/4511180473630800",
    # Add data like request headers and IP for users,
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from contextlib import asynccontextmanager
from domains.infrastructure.services.cache_service import cache_service
from core.permissions import permission_manager
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, engine
from models import Base, ClinicalAsset
from domains.infrastructure.services.r2_storage import get_presigned_url
from fastapi import Depends
# Domain imports (using clean architecture routes)
from domains.patient.routes import patients_clean as patients
from domains.patient.routes import treatment_types, referring_doctors, treatment_plans, patient_files
from domains.auth.routes import auth_clean as auth
from domains.auth.routes import clinic_users, permissions
from domains.clinic.routes import clinics, subscriptions
from domains.finance.routes import payments_clean as payments, invoices, ledger
from domains.communication.routes import notifications, message_templates
from domains.scheduling.routes import attendance, attendance_mobile, appointments
from domains.medical.routes import reports, xray, medications
from domains.analytics.routes import dashboard, dashboard_reports
from domains.infrastructure.routes import devices, sync, templates, template_configs
from domains.infrastructure.services.template_service import TemplateService
from domains.gmail.routes import gmail_routes
from domains.google_business.routes import google_business_routes, google_places_routes
from domains.vendor.routes import vendors
from domains.inventory.routes import inventory
from domains.consent.routes import consents
from domains.document.routes import documents
from domains.clinical.routes import settings_router, case_papers_router, prescriptions_router, lab_orders_router
from domains.notification.routes import notification_admin
from domains.activity.routes import activity_log
from domains.support.routes import support_tickets

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

async def _daily_places_sync():
    """Background task: sync Google Place reviews for all clinics every 24 hours."""
    from database import SessionLocal
    from domains.google_business.routes.google_places_routes import sync_all_clinics
    while True:
        await asyncio.sleep(24 * 60 * 60)
        db = SessionLocal()
        try:
            sync_all_clinics(db)
            print("[places-sync] daily sync complete")
        except Exception as exc:
            print(f"[places-sync] daily sync error: {exc}")
        finally:
            db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager"""
    # Startup — ensure all ORM tables exist before any migrations run
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables verified/created")

    await cache_service.init_cache()
    print("Application started with caching enabled")

    # Inline migrations — add any missing columns safely
    try:
        with engine.connect() as conn:
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_preferences JSONB"
            ))
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_url TEXT"
            ))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS notification_preferences (
                    id SERIAL PRIMARY KEY,
                    clinic_id INTEGER NOT NULL REFERENCES clinics(id),
                    event_type VARCHAR NOT NULL,
                    channel VARCHAR,
                    is_enabled BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text(
                "ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS channels JSONB DEFAULT '[]'"
            ))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS notification_logs (
                    id SERIAL PRIMARY KEY,
                    clinic_id INTEGER NOT NULL REFERENCES clinics(id),
                    channel VARCHAR NOT NULL,
                    recipient VARCHAR NOT NULL,
                    event_type VARCHAR,
                    template_name VARCHAR,
                    status VARCHAR DEFAULT 'sent',
                    cost FLOAT DEFAULT 0.0,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS notification_wallets (
                    id SERIAL PRIMARY KEY,
                    clinic_id INTEGER NOT NULL UNIQUE REFERENCES clinics(id),
                    balance FLOAT DEFAULT 0.0,
                    last_topup_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS wallet_transactions (
                    id SERIAL PRIMARY KEY,
                    clinic_id INTEGER NOT NULL REFERENCES clinics(id),
                    amount FLOAT NOT NULL,
                    transaction_type VARCHAR NOT NULL,
                    description VARCHAR,
                    order_id VARCHAR,
                    status VARCHAR DEFAULT 'completed',
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS activity_logs (
                    id SERIAL PRIMARY KEY,
                    clinic_id INTEGER NOT NULL REFERENCES clinics(id),
                    event_type VARCHAR NOT NULL,
                    description VARCHAR NOT NULL,
                    link VARCHAR,
                    actor_name VARCHAR,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS google_place_links (
                    id SERIAL PRIMARY KEY,
                    clinic_id INTEGER NOT NULL UNIQUE REFERENCES clinics(id),
                    place_id VARCHAR NOT NULL,
                    place_name VARCHAR,
                    place_address VARCHAR,
                    latitude FLOAT,
                    longitude FLOAT,
                    current_rating FLOAT,
                    total_review_count INTEGER DEFAULT 0,
                    last_synced_at TIMESTAMP,
                    linked_at TIMESTAMP DEFAULT NOW(),
                    linked_by INTEGER REFERENCES users(id)
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS google_reviews (
                    id SERIAL PRIMARY KEY,
                    clinic_id INTEGER NOT NULL REFERENCES clinics(id),
                    place_id VARCHAR NOT NULL,
                    review_hash VARCHAR NOT NULL UNIQUE,
                    author_name VARCHAR,
                    author_url VARCHAR,
                    profile_photo_url VARCHAR,
                    rating INTEGER NOT NULL,
                    text TEXT,
                    review_time TIMESTAMP,
                    synced_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS competitor_snapshots (
                    id SERIAL PRIMARY KEY,
                    clinic_id INTEGER NOT NULL REFERENCES clinics(id),
                    place_id VARCHAR NOT NULL,
                    review_count INTEGER NOT NULL DEFAULT 0,
                    rating FLOAT NOT NULL DEFAULT 0.0,
                    snapshot_date TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS competitor_caches (
                    id SERIAL PRIMARY KEY,
                    clinic_id INTEGER NOT NULL REFERENCES clinics(id),
                    place_id VARCHAR NOT NULL,
                    scope VARCHAR NOT NULL,
                    results JSON NOT NULL,
                    synced_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS support_tickets (
                    id SERIAL PRIMARY KEY,
                    clinic_id INTEGER NOT NULL REFERENCES clinics(id),
                    created_by INTEGER REFERENCES users(id),
                    assigned_to INTEGER REFERENCES users(id),
                    title VARCHAR NOT NULL,
                    description TEXT,
                    category VARCHAR DEFAULT 'other',
                    status VARCHAR DEFAULT 'open',
                    priority VARCHAR DEFAULT 'normal',
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS support_messages (
                    id SERIAL PRIMARY KEY,
                    ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
                    sender_id INTEGER REFERENCES users(id),
                    body TEXT NOT NULL,
                    is_staff BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.commit()
    except Exception as e:
        print(f"⚠️  Column migration skipped: {e}")

    # Start daily Places review sync background task
    places_sync_task = asyncio.create_task(_daily_places_sync())

    # Start persistent APScheduler (hourly platform automation, appointment reminders, daily summaries)
    try:
        from core.scheduler import start_scheduler
        start_scheduler()
        print("✅ APScheduler started")
    except Exception as exc:
        print(f"⚠️  APScheduler failed to start: {exc}")

    # Initialize Casbin permission manager
    try:
        permission_manager._initialize_enforcer()
        print("✅ Casbin permission system initialized")
    except Exception as e:
        print(f"⚠️  Warning: Casbin initialization failed: {e}")

    yield

    # Shutdown
    places_sync_task.cancel()
    try:
        from core.scheduler import shutdown_scheduler
        shutdown_scheduler()
    except Exception as exc:
        print(f"APScheduler shutdown error: {exc}")
    await cache_service.close()
    print("Application shutdown complete")

app = FastAPI(
    title="Clinic Management API",
    version="1.0.0",
    description="Clean architecture API for dental/radiology clinic management",
    lifespan=lifespan,
    redirect_slashes=False
)

from fastapi.responses import JSONResponse
from core.wallet_service import InsufficientWalletBalance

@app.exception_handler(InsufficientWalletBalance)
async def insufficient_wallet_handler(request, exc: InsufficientWalletBalance):
    return JSONResponse(
        status_code=402,
        content={
            "detail": str(exc),
            "code": "INSUFFICIENT_WALLET_BALANCE",
            "needed": exc.needed,
            "available": exc.available,
        },
    )

# CORS setup
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "https://support.molarplus.com",
    "https://app.molarplus.com",
    "https://api.molarplus.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Middleware to strip trailing slashes so both /path and /path/ resolve identically.
# This eliminates the "/" vs "" inconsistency across route files and means
# the frontend never needs to worry about trailing slashes.
class TrailingSlashMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        path = request.scope["path"]
        if len(path) > 1 and path.endswith("/"):
            request.scope["path"] = path.rstrip("/")
        return await call_next(request)

app.add_middleware(TrailingSlashMiddleware)

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
app.include_router(treatment_types.router, prefix="/api/v1/treatment-types", tags=["treatment_types"])
app.include_router(referring_doctors.router, prefix="/api/v1/referring-doctors", tags=["referring_doctors"])
app.include_router(clinics.router, prefix="/api/v1/clinics", tags=["clinics"])
app.include_router(subscriptions.router, prefix="/api/v1/subscriptions", tags=["subscriptions"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["payments"])
app.include_router(invoices.router, prefix="/api/v1/invoices", tags=["invoices"])
app.include_router(ledger.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(message_templates.router, prefix="/api/v1/message-templates", tags=["message_templates"])
app.include_router(attendance.router, prefix="/api/v1/attendance", tags=["attendance"])
app.include_router(attendance_mobile.router, prefix="/api/v1/attendance-mobile", tags=["attendance_mobile"])
app.include_router(appointments.router, prefix="/api/v1/appointments", tags=["appointments"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(xray.router, prefix="/api/v1/xray", tags=["xray"])
app.include_router(medications.router, prefix="/api/v1")
app.include_router(template_configs.router, prefix="/api/v1/template-configs", tags=["template-configs"])

app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(dashboard_reports.router, prefix="/api/v1/dashboard/reports", tags=["dashboard_reports"])
app.include_router(devices.router, prefix="/api/v1/devices", tags=["devices"])
app.include_router(sync.router, prefix="/api/v1/sync", tags=["sync"])
app.include_router(templates.router, prefix="/api/v1/templates", tags=["templates"])
app.include_router(gmail_routes.router, prefix="/api/v1/gmail", tags=["gmail"])
app.include_router(google_business_routes.router, prefix="/api/v1/google-business", tags=["google_business"])
app.include_router(google_places_routes.router, prefix="/api/v1/google-places", tags=["google_places"])
app.include_router(vendors.router, prefix="/api/v1/vendors", tags=["vendors"])
app.include_router(inventory.router, prefix="/api/v1/inventory", tags=["inventory"])
app.include_router(consents.router, prefix="/api/v1/consents", tags=["consents"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"])

# Notification Admin Domain
app.include_router(notification_admin.router, prefix="/api/v1/notification-admin", tags=["notification-admin"])

# Activity Log Domain
app.include_router(activity_log.router, prefix="/api/v1/activity-log", tags=["activity-log"])

# Support Domain (clinic-side ticket endpoints)
app.include_router(support_tickets.router, prefix="/api/v1/support-tickets", tags=["support-tickets"])

# Clinical Domain
app.include_router(settings_router, prefix="/api/v1/clinical", tags=["clinical-settings"])
app.include_router(case_papers_router, prefix="/api/v1/clinical", tags=["case-papers"])
app.include_router(prescriptions_router, prefix="/api/v1/clinical", tags=["prescriptions"])
app.include_router(lab_orders_router, prefix="/api/v1/clinical", tags=["lab-orders"])

@app.get("/")
def root():
    return {"message": "Radiology Clinic Backend is running"}

@app.get("/health")
def health_check():
    """Health check endpoint for desktop app server status"""
    return {"status": "healthy", "message": "Backend is running"}

@app.get("/sentry-debug")
async def trigger_error():
    division_by_zero = 1 / 0

@app.get("/api/v1/clinical-assets")
def get_clinical_assets(category: str = "anatomy", db: Session = Depends(get_db)):
    """Fetch all clinical assets and their secure R2 links"""
    assets = db.query(ClinicalAsset).filter(ClinicalAsset.category == category).all()
    result = {}
    for asset in assets:
        # Generate short-lived URL (7 days)
        url = get_presigned_url(asset.r2_storage_key)
        result[asset.name] = url
    return result

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

 
