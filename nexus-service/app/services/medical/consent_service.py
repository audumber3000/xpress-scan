import redis
import json
import secrets
import tempfile
from datetime import datetime
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import PatientConsent, Patient, ConsentTemplate, Clinic, PatientDocument, TemplateConfiguration
from app.services.infrastructure.pdf_service import PDFService
import os
import httpx

# Connect to Redis (used for short-lived tokens)
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL)

from app.services.infrastructure.storage_service import StorageService

class ConsentService:
    @staticmethod
    def generate_token(data: dict):
        """
        Generate a secure token for the signature link (valid for 5 mins).
        """
        token = secrets.token_urlsafe(32)
        clinic_id = data.get('clinicId')
        
        # Store metadata in redis with 300 second expiration
        redis_client.setex(f"consent_token:{token}", 300, json.dumps(data))
        
        # Index the token by clinic for tracking (SADD)
        if clinic_id:
            redis_client.sadd(f"clinic:{clinic_id}:consent_links", token)
            # Expire the index set eventually (one hour for safety)
            redis_client.expire(f"clinic:{clinic_id}:consent_links", 3600) 
            
        return token

    @staticmethod
    def validate_token(token: str):
        """
        Validate and return data for a token.
        """
        data = redis_client.get(f"consent_token:{token}")
        if data:
            return json.loads(data)
        return None

    @staticmethod
    def list_active_tokens(clinic_id: int):
        """
        List all active, non-expired tokens for a specific clinic.
        """
        set_key = f"clinic:{clinic_id}:consent_links"
        tokens = redis_client.smembers(set_key)
        
        results = []
        for token_bin in tokens:
            token = token_bin.decode('utf-8') if isinstance(token_bin, bytes) else token_bin
            token_key = f"consent_token:{token}"
            data_raw = redis_client.get(token_key)
            
            if not data_raw:
                # Token expired, remove from set
                redis_client.srem(set_key, token)
                continue
                
            data = json.loads(data_raw)
            ttl = redis_client.ttl(token_key)
            
            results.append({
                "token": token,
                "patientId": data.get('patientId'),
                "patientName": data.get('patientName'),
                "templateName": data.get('templateName'),
                "timeLeft": ttl if ttl > 0 else 0,
                "used": False
            })
            
        return sorted(results, key=lambda x: x['timeLeft'], reverse=True)

    @staticmethod
    def process_signature(db: Session, token: str, signature_base64: str):
        """
        Process the signature submission.
        1. Get data from token
        2. Generate PDF
        3. Upload to Cloud (R2)
        4. Save to DB
        """
        data = ConsentService.validate_token(token)
        if not data:
            raise ValueError("Token invalid or expired.")

        patient_id = data.get('patientId')
        template_id = data.get('templateId')
        clinic_id = data.get('clinicId')

        # Fetch entities
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        template = db.query(ConsentTemplate).filter(ConsentTemplate.id == template_id).first()
        clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()

        if not patient or not template or not clinic:
            raise ValueError(f"Incomplete data in DB for Nexus processing: Patient={bool(patient)}, Template={bool(template)}, Clinic={bool(clinic)}")

        # Phase 8: render via the main backend's consent_templates registry
        # so layout / branding lives in one place. Main backend reads the
        # TemplateConfiguration(category='consent') row server-side.
        main_backend_url = os.environ.get("MAIN_BACKEND_URL", "http://localhost:8000")
        internal_key = os.environ.get("INTERNAL_API_KEY", "")
        try:
            with httpx.Client(timeout=20.0) as client:
                resp = client.post(
                    f"{main_backend_url}/api/v1/internal/consent/render",
                    json={
                        "clinic_id": clinic_id,
                        "patient_id": patient_id,
                        "patient_name": patient.name,
                        "template_name": template.name,
                        "content": data.get('content', template.content),
                        "signature_base64": signature_base64,
                        "template_id": data.get('templateVariantId') or 'classic',
                    },
                    headers={"X-Internal-Auth": internal_key},
                )
        except httpx.HTTPError as e:
            raise ValueError(f"Could not reach main backend for consent rendering: {e}")
        if resp.status_code != 200:
            raise ValueError(f"Main backend consent render failed: {resp.status_code} {resp.text[:200]}")

        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            tmp_file.write(resp.content)
            pdf_path = tmp_file.name

        # Upload to R2 Storage via Nexus Storage Service
        filename = f"consent_{patient_id}_{int(datetime.now().timestamp())}.pdf"
        file_size = os.path.getsize(pdf_path) if os.path.exists(pdf_path) else 0
        storage_key = StorageService.upload_consent_pdf(
            file_path=pdf_path,
            filename=filename,
            clinic_id=clinic_id,
            patient_id=patient_id
        )

        if not storage_key:
            print(f"Warning: R2 Upload failed for {filename}, falling back to local path record.")

        pdf_url = storage_key or pdf_path

        # Save record in the main DB (matching the true schema from Postgres)
        consent_record = PatientConsent(
            patient_id=patient_id,
            template_id=template_id,
            signed_content=data.get('content', template.content),
            signed_at=datetime.utcnow(),
            signature_url=pdf_url,
        )
        db.add(consent_record)

        # Also save as PatientDocument so it appears in patient files tab
        doc_record = PatientDocument(
            patient_id=patient_id,
            clinic_id=clinic_id,
            file_name=filename,
            file_path=pdf_url,
            file_size=file_size,
            file_type="pdf",
            created_at=datetime.utcnow(),
        )
        db.add(doc_record)

        db.commit()
        db.refresh(consent_record)

        # Cleanup local temp file
        PDFService.cleanup(pdf_path)
        
        # Cleanup token and index from redis
        redis_client.delete(f"consent_token:{token}")
        if clinic_id:
            redis_client.srem(f"clinic:{clinic_id}:consent_links", token)

        return {
            "id": consent_record.id,
            "patient_id": patient_id,
            "clinic_id": clinic_id,
            "file_name": filename,
            "url": pdf_url
        }
