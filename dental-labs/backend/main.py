"""
MolarPlus Dental Labs — Backend Entry Point

FastAPI application for dental laboratory management.
Separate service from MolarPlus clinic — own database, own auth.
"""
import os
import sys
from dotenv import load_dotenv

# Load environment
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

from database import engine
from models import Base

# Domain route imports
from domains.auth.routes import router as auth_router
from domains.lab.routes import router as lab_router
from domains.client.routes import router as client_router
from domains.catalog.routes import router as catalog_router
from domains.case.routes import router as case_router
from domains.billing.routes import router as billing_router
from domains.notification.routes import router as notification_router
from domains.dashboard.routes import router as dashboard_router


# ── Lifespan ────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    # Create tables if they don't exist (dev convenience — use Alembic in prod)
    Base.metadata.create_all(bind=engine)
    print("✅ Dental Labs database tables verified/created")

    # Ensure uploads directory exists
    upload_dir = os.getenv("UPLOAD_DIR", "./uploads")
    os.makedirs(upload_dir, exist_ok=True)

    yield

    print("👋 Dental Labs shutting down")


# ── App ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="MolarPlus Dental Labs API",
    version="1.0.0",
    description="B2B dental laboratory management — cases, billing, clients",
    lifespan=lifespan,
    redirect_slashes=False,
)


# ── CORS ────────────────────────────────────────────────────────────────

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5174,http://127.0.0.1:5174")
origins = [o.strip() for o in cors_origins.split(",")]

# ── Trailing-slash middleware ───────────────────────────────────────────

class TrailingSlashMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        path = request.scope["path"]
        if len(path) > 1 and path.endswith("/"):
            request.scope["path"] = path.rstrip("/")
        return await call_next(request)

app.add_middleware(TrailingSlashMiddleware)


# Add CORS last so it is the outermost application middleware. This preserves
# CORS headers even when an inner route raises an unexpected server error.
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ── Register routers ───────────────────────────────────────────────────

app.include_router(auth_router,         prefix="/api/v1/auth",          tags=["auth"])
app.include_router(lab_router,          prefix="/api/v1/labs",           tags=["labs"])
app.include_router(client_router,       prefix="/api/v1/clients",       tags=["clients"])
app.include_router(catalog_router,      prefix="/api/v1/products",      tags=["catalog"])
app.include_router(case_router,         prefix="/api/v1/cases",         tags=["cases"])
app.include_router(billing_router,      prefix="/api/v1/billing",       tags=["billing"])
app.include_router(notification_router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(dashboard_router,    prefix="/api/v1/dashboard",     tags=["dashboard"])


# ── Root / Health ──────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "MolarPlus Dental Labs API is running"}


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "dental-labs"}


# ── Run ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
