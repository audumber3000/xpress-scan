from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.medical.consent_service import ConsentService
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

class ConsentGenerateRequest(BaseModel):
    patientId: int
    patientName: str
    phone: str
    templateId: int
    templateName: str
    content: str
    clinicId: int
    sendWhatsApp: Optional[bool] = False

class SignatureSubmitRequest(BaseModel):
    signature: str

class ConsentLinkResponse(BaseModel):
    token: str
    patientId: int
    patientName: str
    templateName: str
    timeLeft: int
    used: bool

@router.post("/generate")
async def generate_consent_link(request_data: ConsentGenerateRequest):
    """
    Generate a secure token and link for the patient.
    """
    token = ConsentService.generate_token(request_data.dict())
    
    return {
        "success": True,
        "token": token,
        "signUrl": f"/consent/sign/{token}",
        "expires_in": 300
    }

@router.get("/list/{clinic_id}", response_model=List[ConsentLinkResponse])
async def list_consent_links(clinic_id: int):
    """
    List all active consent links for a specific clinic.
    """
    return ConsentService.list_active_tokens(clinic_id)

@router.get("/validate/{token}")
async def validate_consent_token(token: str):
    """
    Verify if the token is still valid.
    """
    data = ConsentService.validate_token(token)
    if not data:
        raise HTTPException(status_code=404, detail="Link expired or invalid.")
    
    return {
        "valid": True,
        "data": data
    }

@router.post("/submit/{token}")
async def submit_consent_signature(
    token: str, 
    payload: SignatureSubmitRequest,
    db: Session = Depends(get_db)
):
    """
    Process the signature submission and generate the final PDF.
    """
    try:
        result = ConsentService.process_signature(db, token, payload.signature)
        return {
            "success": True,
            "message": "Signature processed successfully.",
            **result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
