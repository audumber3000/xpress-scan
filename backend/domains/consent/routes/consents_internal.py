"""Internal-only consent rendering endpoint.

Called by the Nexus service when a patient submits their signature, so the PDF
gets rendered by the same engine the rest of the system uses (Phase 8 — single
source of truth for consent layout, parallel to invoice / prescription).

Auth: shared secret in the `X-Internal-Auth` header. The same `INTERNAL_API_KEY`
env var is configured on both services. Not exposed to end users — the route
prefix `/api/v1/internal/...` is convention only; access control is enforced
via the header check.
"""
import io
import os
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from fastapi import Depends

from database import get_db
from models import Clinic, TemplateConfiguration

router = APIRouter()


class ConsentRenderRequest(BaseModel):
    clinic_id: int
    patient_id: Optional[int] = None
    patient_name: str = Field(..., max_length=200)
    template_name: str = Field(..., max_length=200)
    content: str = Field(..., max_length=20000)
    signature_base64: str  # data: URI or raw base64; renderer normalises
    template_id: Optional[str] = "classic"


def _check_internal_auth(x_internal_auth: Optional[str]) -> None:
    """Reject if the shared secret doesn't match. Both services read the same
    env var so deployments must set it identically."""
    expected = os.environ.get("INTERNAL_API_KEY")
    if not expected:
        # Fail closed — never accept calls when no secret is configured.
        raise HTTPException(status_code=503, detail="internal API not configured")
    if not x_internal_auth or x_internal_auth != expected:
        raise HTTPException(status_code=403, detail="invalid internal auth")


@router.post("/consent/render")
def render_consent_pdf(
    body: ConsentRenderRequest,
    x_internal_auth: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    """Render a signed-consent PDF and return the bytes.

    Returns: application/pdf body.
    Caller is responsible for storage (R2 upload + DB record), keeping this
    endpoint pure and stateless.
    """
    _check_internal_auth(x_internal_auth)

    clinic = db.query(Clinic).filter(Clinic.id == body.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="clinic not found")

    config = db.query(TemplateConfiguration).filter(
        TemplateConfiguration.clinic_id == body.clinic_id,
        TemplateConfiguration.category == "consent",
    ).first()

    from domains.consent.consent_templates import resolve_variant
    variant = resolve_variant(body.template_id or "classic")

    html = variant['render'](
        clinic=clinic,
        patient_name=body.patient_name,
        patient_id=body.patient_id,
        template_name=body.template_name,
        content=body.content,
        signature_base64=body.signature_base64,
        config=config,
    )

    try:
        from weasyprint import HTML
    except ImportError:
        raise HTTPException(status_code=500, detail="WeasyPrint not available")

    buf = io.BytesIO()
    HTML(string=html).write_pdf(target=buf, presentational_hints=True)

    return Response(content=buf.getvalue(), media_type="application/pdf")
