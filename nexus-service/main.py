from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.endpoints import consent, notifications, reports
from app.api.v1.endpoints.report_modules import financial, operational, clinical
import uvicorn
import os
from dotenv import load_dotenv
import sentry_sdk

sentry_sdk.init(
    dsn="https://73dc9b005c9ed724147ad1f0e119ba48@o4511180469043200.ingest.de.sentry.io/4511180473630800",
    # Add data like request headers and IP for users,
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
)

load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

app = FastAPI(
    title="MolarPlus Nexus",
    description="High-performance task engine for MolarPlus platform (PDFs, Notifications, Analytics)",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(consent.router, prefix="/api/v1/consent", tags=["Consent"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reports (Legacy)"])
app.include_router(financial.router, prefix="/api/v1/reports/financial", tags=["Reports (Financial)"])
app.include_router(operational.router, prefix="/api/v1/reports/operational", tags=["Reports (Operational)"])
app.include_router(clinical.router, prefix="/api/v1/reports/clinical", tags=["Reports (Clinical)"])

@app.get("/sentry-debug")
async def trigger_error():
    division_by_zero = 1 / 0

@app.get("/health")
async def health_check():
    """
    Check system health.
    """
    return {
        "status": "healthy",
        "service": "MolarPlus Nexus",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    # Run Nexus on port 8001 by default
    port = int(os.environ.get("NEXUS_PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
