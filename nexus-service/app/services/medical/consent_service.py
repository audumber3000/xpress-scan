import hashlib
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

# How long a signing link stays valid.
#
# This was 5 minutes. A consent link is sent to a patient over WhatsApp and asks
# them to read a legal document and sign it; five minutes means it has usually
# expired before they open the message. A day is long enough to be usable and
# still short enough that a forwarded link does not stay live indefinitely, and
# the link is single-use regardless.
CONSENT_LINK_TTL = 24 * 60 * 60

# The per-clinic index has to outlive the tokens it points at, or a link that is
# still valid vanishes from the clinic's tracking list.
CONSENT_INDEX_TTL = CONSENT_LINK_TTL + (60 * 60)


class ConsentService:
    @staticmethod
    def generate_token(data: dict):
        """Create a single-use signing link, valid for CONSENT_LINK_TTL."""
        token = secrets.token_urlsafe(32)
        clinic_id = data.get('clinicId')

        redis_client.setex(f"consent_token:{token}", CONSENT_LINK_TTL, json.dumps(data))

        if clinic_id:
            redis_client.sadd(f"clinic:{clinic_id}:consent_links", token)
            redis_client.expire(f"clinic:{clinic_id}:consent_links", CONSENT_INDEX_TTL)

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
    def render_pdf(db: Session, token: str, signature_base64: str):
        """Render the signed consent and return (data, patient, template, clinic, pdf_bytes).

        Extracted so the patient's preview and the copy that gets filed come out
        of exactly one code path. The whole point of showing somebody the
        document before they submit it is that it is the document — a preview
        rendered by a second route would eventually drift from the real one, and
        the drift would be invisible until a dispute.

        Stores nothing and burns nothing. `process_signature` does that after
        calling this; the preview endpoint just returns the bytes.
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
        # Use the existing BACKEND_URL env var (already set to http://backend:8000
        # inside docker compose); MAIN_BACKEND_URL kept as an override for unusual
        # deployments. Falls back to localhost so dev without compose still works.
        main_backend_url = (
            os.environ.get("MAIN_BACKEND_URL")
            or os.environ.get("BACKEND_URL")
            or "http://localhost:8000"
        )
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

        return data, patient, template, clinic, resp.content

    @staticmethod
    def preview_signature(db: Session, token: str, signature_base64: str) -> bytes:
        """The document the patient is about to sign off on, rendered not filed.

        Nothing is written, not even the signature: a patient who looks at the
        consent and closes the tab has agreed to nothing, which is what the
        button promises them.
        """
        _, _, _, _, pdf_bytes = ConsentService.render_pdf(db, token, signature_base64)
        return pdf_bytes

    @staticmethod
    def process_signature(db: Session, token: str, signature_base64: str,
                          signed_ip: str = None, signed_user_agent: str = None):
        """
        Process the signature submission.
        1. Render the PDF (same path the preview used)
        2. Upload to Cloud (R2)
        3. Save to DB
        """
        data, patient, template, clinic, pdf_bytes = ConsentService.render_pdf(
            db, token, signature_base64
        )
        patient_id = data.get('patientId')
        template_id = data.get('templateId')
        clinic_id = data.get('clinicId')

        # A fingerprint of the exact bytes the patient approved. Without it a
        # signature image is only a picture; with it the clinic can show the
        # document has not changed since it was signed.
        pdf_sha256 = hashlib.sha256(pdf_bytes).hexdigest()

        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            tmp_file.write(pdf_bytes)
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
            # What makes an electronic signature defensible rather than
            # decorative: where it came from, on what, and a checksum of the
            # exact document. Matches what a signed medical history records.
            signed_ip=signed_ip,
            signed_user_agent=(signed_user_agent or '')[:400] or None,
            pdf_sha256=pdf_sha256,
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
