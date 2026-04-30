import io
import time
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from database import get_db
from models import TemplateConfiguration, Clinic
from core.auth_utils import get_current_user
from core.dtos import TemplateConfigResponse, TemplateConfigCreate, TemplateConfigUpdate
from domains.infrastructure.services.r2_storage import (
    StorageCategory,
    get_presigned_url,
    upload_bytes_to_r2,
)
from typing import List

router = APIRouter()

# Logo upload constraints. Phase 1 supports raster only — SVG sanitisation
# (script tags, javascript: hrefs) is intentionally deferred.
_LOGO_MAX_BYTES = 5 * 1024 * 1024  # 5 MB upload cap
_LOGO_MAX_DIMENSION = 2048          # reject anything larger than this either side
_LOGO_TARGET_DIMENSION = 600        # downscale on the server: logos render at ~75px in PDFs
_LOGO_ALLOWED_FORMATS = {"PNG", "JPEG"}
_LOGO_ALLOWED_CATEGORIES = {"invoice", "prescription", "consent"}

@router.get("", response_model=List[TemplateConfigResponse])
def get_template_configs(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return db.query(TemplateConfiguration).filter(
        TemplateConfiguration.clinic_id == current_user.clinic_id
    ).all()

@router.post("", response_model=TemplateConfigResponse)
def upsert_template_config(
    config_in: TemplateConfigCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Check if exists for this category and clinic
    existing = db.query(TemplateConfiguration).filter(
        TemplateConfiguration.clinic_id == current_user.clinic_id,
        TemplateConfiguration.category == config_in.category
    ).first()
    
    if existing:
        existing.template_id = config_in.template_id
        existing.logo_url = config_in.logo_url
        existing.primary_color = config_in.primary_color
        existing.footer_text = config_in.footer_text
        db.commit()
        db.refresh(existing)
        return existing
    
    new_config = TemplateConfiguration(
        clinic_id=current_user.clinic_id,
        **config_in.dict()
    )
    db.add(new_config)
    db.commit()
    db.refresh(new_config)
    return new_config

@router.get("/{category}", response_model=TemplateConfigResponse)
def get_category_config(
    category: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    config = db.query(TemplateConfiguration).filter(
        TemplateConfiguration.clinic_id == current_user.clinic_id,
        TemplateConfiguration.category == category
    ).first()
    
    if not config:
        # Return a default-like response or raise 404
        # For now, let's return a basic one if not found
        return TemplateConfigResponse(
            category=category,
            template_id="default",
            clinic_id=current_user.clinic_id
        )
    return config


@router.get("/variants/{category}")
def list_variants(category: str, current_user = Depends(get_current_user)):
    """Catalog of available template variants for a category.
    Mobile / web pickers call this to populate the thumbnail strip."""
    if category == "invoice":
        from domains.finance.invoice_templates import list_variants as _list_invoice
        return {"variants": _list_invoice()}
    if category == "prescription":
        from domains.medical.prescription_templates import list_variants as _list_rx
        return {"variants": _list_rx()}
    if category == "consent":
        from domains.consent.consent_templates import list_variants as _list_consent
        return {"variants": _list_consent()}
    raise HTTPException(status_code=400, detail="unknown category")


@router.post("/preview")
def preview_template(
    payload: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Render the actual PDF HTML using the user's unsaved template config,
    against deterministic sample data. Returns inline HTML the mobile WebView
    drops straight in — same engine that production uses, so what they see
    is what they'll get on the next real PDF.

    Body: { category, template_id?, primary_color?, footer_text?, logo_url? }
    """
    from domains.infrastructure.services.preview_samples import (
        config_from_payload, sample_clinic, sample_consent, sample_invoice,
        sample_patient, sample_prescription_request,
    )
    from core.dtos import _validate_logo_url  # reuse the save-time validator
    from pydantic import ValidationError

    category = payload.get("category")
    if category not in {"invoice", "prescription", "consent"}:
        raise HTTPException(status_code=400, detail="category must be 'invoice', 'prescription' or 'consent'")

    # Apply the same validation rules the save endpoint uses, so previews
    # can't render content that would be rejected on save.
    primary_color = payload.get("primary_color")
    if primary_color:
        import re
        if not re.match(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", primary_color):
            raise HTTPException(status_code=400, detail="primary_color must be a hex color")
    # Preview is permissive on logo_url — pre-Phase-0 rows may carry http URLs
    # that fail the strict save-time validator. Rather than 400-blocking the
    # whole preview, drop the bad URL so the rest of the page renders. Save
    # endpoint still rejects bad URLs strictly.
    logo_url = payload.get("logo_url")
    if logo_url:
        try:
            _validate_logo_url(logo_url)
        except ValueError:
            payload = {**payload, "logo_url": None}
    footer_text = payload.get("footer_text") or ""
    if len(footer_text) > 1000:
        raise HTTPException(status_code=400, detail="footer_text too long")

    config = config_from_payload(payload)
    clinic = sample_clinic()

    if category == "invoice":
        from domains.finance.invoice_pdf_engine import generate_invoice_html
        html = generate_invoice_html(sample_invoice(), clinic, config)
    elif category == "prescription":
        from domains.medical.services.prescription_service import PrescriptionService
        svc = PrescriptionService(db)
        html = svc.render_prescription_html(
            sample_patient(), clinic, sample_prescription_request(), config_override=config
        )
    else:  # consent
        from domains.consent.consent_templates import resolve_variant
        sample = sample_consent()
        variant = resolve_variant(payload.get("template_id") or "classic")
        html = variant['render'](
            clinic=clinic,
            patient_name=sample["patient_name"],
            patient_id=sample["patient_id"],
            template_name=sample["template_name"],
            content=sample["content"],
            signature_base64=sample["signature_base64"],
            config=config,
        )

    return {"html": html}


@router.post("/logo")
async def upload_logo(
    category: str = Form(...),
    file: UploadFile = File(...),
    current_user = Depends(get_current_user),
):
    """Upload a clinic logo for a template category. Returns the resolved URL
    that should then be saved into the matching TemplateConfiguration row via
    the regular POST /template-configs endpoint.

    Validates server-side using Pillow (don't trust the client Content-Type),
    rejects anything but PNG/JPEG, caps size + dimensions, and downscales to a
    PDF-friendly target before storing — keeps R2 costs and PDF render time
    sane regardless of what the user uploads.
    """
    if category not in _LOGO_ALLOWED_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"category must be one of {sorted(_LOGO_ALLOWED_CATEGORIES)}")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty upload")
    if len(raw) > _LOGO_MAX_BYTES:
        raise HTTPException(status_code=413, detail=f"file too large (max {_LOGO_MAX_BYTES // (1024*1024)} MB)")

    # Validate by re-decoding with Pillow. Catches polyglot files / fake MIME.
    try:
        from PIL import Image, UnidentifiedImageError
    except ImportError:
        raise HTTPException(status_code=500, detail="image processing unavailable on server")

    try:
        img = Image.open(io.BytesIO(raw))
        img.verify()  # cheap structural check; consumes the stream
        img = Image.open(io.BytesIO(raw))  # re-open since verify() invalidates
    except (UnidentifiedImageError, Exception):
        raise HTTPException(status_code=400, detail="not a valid image file")

    if img.format not in _LOGO_ALLOWED_FORMATS:
        raise HTTPException(status_code=400, detail=f"unsupported format {img.format} — use PNG or JPEG")
    if img.width > _LOGO_MAX_DIMENSION or img.height > _LOGO_MAX_DIMENSION:
        raise HTTPException(status_code=400, detail=f"image dimensions exceed {_LOGO_MAX_DIMENSION}px")

    # Downscale to a PDF-appropriate size. Preserves alpha for PNG.
    if max(img.width, img.height) > _LOGO_TARGET_DIMENSION:
        img.thumbnail((_LOGO_TARGET_DIMENSION, _LOGO_TARGET_DIMENSION), Image.LANCZOS)

    out_buf = io.BytesIO()
    if img.format == "PNG":
        ext, content_type = "png", "image/png"
        img.save(out_buf, format="PNG", optimize=True)
    else:
        ext, content_type = "jpg", "image/jpeg"
        # Strip alpha if present — JPEG can't encode it
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGB")
        img.save(out_buf, format="JPEG", quality=88, optimize=True)
    out_bytes = out_buf.getvalue()

    filename = f"{category}_logo_{int(time.time())}.{ext}"
    storage_key = upload_bytes_to_r2(
        data=out_bytes,
        filename=filename,
        content_type=content_type,
        clinic_id=current_user.clinic_id,
        category=StorageCategory.BRANDING,
    )
    if not storage_key:
        raise HTTPException(status_code=502, detail="upload to storage failed")

    public_url = get_presigned_url(storage_key)
    if not public_url:
        raise HTTPException(status_code=502, detail="could not resolve storage URL")

    return {"logo_url": public_url, "storage_key": storage_key}
