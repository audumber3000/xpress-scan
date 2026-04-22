import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, "..", ".env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, metrics, clinics, owners, tickets, financials, subscriptions, activity, notifications_data, growth, marketing

app = FastAPI(title="MolarPlus Support Dashboard API", version="1.0.0")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5174")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5174", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(metrics.router, prefix="/api/v1/metrics", tags=["Metrics"])
app.include_router(clinics.router, prefix="/api/v1/clinics", tags=["Clinics"])
app.include_router(owners.router, prefix="/api/v1/owners", tags=["Owners"])
app.include_router(tickets.router, prefix="/api/v1/tickets", tags=["Tickets"])
app.include_router(financials.router, prefix="/api/v1/financials", tags=["Financials"])
app.include_router(subscriptions.router, prefix="/api/v1/subscriptions", tags=["Subscriptions"])
app.include_router(activity.router, prefix="/api/v1/activity", tags=["Activity"])
app.include_router(notifications_data.router, prefix="/api/v1/notifications-data", tags=["Notifications"])
app.include_router(growth.router, prefix="/api/v1/growth", tags=["Growth"])
app.include_router(marketing.router, prefix="/api/v1/marketing", tags=["Marketing"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "support-backend"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("SUPPORT_PORT", 8002))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
