import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import patients, reports
from routes import scan_types
from routes import referring_doctors
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# CORS setup
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "https://xpress-scan.onrender.com",  # Backend URL (optional, for self-calls)
     "https://xpress-scan.vercel.app"  # Vercel frontend (replace with actual)
    # Add more deployed frontend URLs as needed
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

app.include_router(patients.router, prefix="/patients", tags=["patients"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])
app.include_router(scan_types.router, prefix="/scan-types", tags=["scan_types"])
app.include_router(referring_doctors.router, prefix="/referring-doctors", tags=["referring_doctors"])

@app.get("/")
def root():
    return {"message": "Radiology Clinic Backend is running"} 