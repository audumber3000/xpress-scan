import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import patients, reports
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
    "*"  # Allow all origins for development
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

@app.get("/")
def root():
    return {"message": "Radiology Clinic Backend is running"} 