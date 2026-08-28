from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Response, Header
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from typing import List, Optional
from database import get_db
from models import PatientDocument, Patient, User, Report
from core.dtos import PatientDocumentResponseDTO, ExternalDocumentRequestDTO, UnifiedFileResponseDTO
from core.auth_utils import get_current_user
from domains.infrastructure.services.r2_storage import (
    upload_bytes_to_r2, StorageCategory, get_presigned_url, download_bytes_from_r2,
    put_bytes_to_key, delete_file_from_r2,
)
import hashlib
import hmac
import io
import os
from core.app_secret import get_jwt_secret

router = APIRouter()


# ─── Tenant scoping ───────────────────────────────────────────────────────────
# Patient documents are the most sensitive records in the app (radiographs,
# reports, scans). Every route below resolves through one of these two helpers
# so a document can only ever be reached by someone in the clinic that owns it.
# Previously several of these routes took a bare integer id with no auth and no
# clinic filter, which let any caller read any clinic's files by counting up.

def _scoped_patient(db: Session, patient_id: int, current_user: User) -> Patient:
    """The patient, or 404 if they belong to another clinic.

    404 rather than 403 on purpose: 403 would confirm the id exists, which is
    itself a leak across tenants."""
    patient = (
        db.query(Patient)
        .filter(Patient.id == patient_id, Patient.clinic_id == current_user.clinic_id)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


def _scoped_document(db: Session, document_id: int, current_user: User) -> PatientDocument:
    """The document, or 404 if it belongs to another clinic."""
    document = (
        db.query(PatientDocument)
        .filter(
            PatientDocument.id == document_id,
            PatientDocument.clinic_id == current_user.clinic_id,
        )
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


def _check_internal_auth(x_internal_auth: Optional[str]) -> None:
    """Shared-secret gate for service-to-service calls, same contract as
    domains/consent/routes/consents_internal.py. Fails closed when unset."""
    expected = os.environ.get("INTERNAL_API_KEY")
    if not expected:
        raise HTTPException(status_code=503, detail="internal API not configured")
    if not x_internal_auth or not hmac.compare_digest(x_internal_auth, expected):
        raise HTTPException(status_code=403, detail="invalid internal auth")


def thumbnail_token(document_id: int) -> str:
    """Unguessable per-document token for the thumbnail URL.

    The thumbnail endpoint has to stay header-less because it is consumed as an
    <img src>, which cannot carry an Authorization header. Sequential integer
    ids therefore made it an enumeration oracle over every clinic's imaging.
    This binds the URL to the document with a secret only the server holds, and
    is handed out by the authenticated list endpoint.

    Deliberately no expiry: browsers cache thumbnails for a day and a rotating
    query string would defeat that. Deleting the document revokes access."""
    secret = get_jwt_secret().encode()
    return hmac.new(secret, f"thumb:{document_id}".encode(), hashlib.sha256).hexdigest()[:32]

def _ensure_case_paper_column(db: Session):
    """No-op. Previously ran ALTER TABLE on every upload, which acquires an
    ACCESS EXCLUSIVE lock on `patient_documents` from inside a request
    handler — same class of bug that took prod down on 2026-05-02 in
    invoices.py. The `case_paper_id` column now exists permanently and is
    declared in models.py; future schema changes go through deploy.sh."""
    return

@router.post("/upload/{patient_id}", response_model=PatientDocumentResponseDTO)
async def upload_document(
    patient_id: int,
    file: UploadFile = File(...),
    case_paper_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _ensure_case_paper_column(db)
    # Scoped: clinic_id below is taken from the patient, so an unscoped lookup
    # let a user in clinic A file a document into clinic B and have it look
    # entirely legitimate afterwards.
    patient = _scoped_patient(db, patient_id, current_user)

    # Read file content
    content = await file.read()
    file_size = len(content)
    
    # Upload to R2 (returns relative key)
    storage_path = upload_bytes_to_r2(
        data=content,
        filename=file.filename,
        content_type=file.content_type,
        clinic_id=patient.clinic_id,
        patient_id=patient_id,
        category=StorageCategory.DOCUMENTS
    )
    
    file_type = file.filename.split('.')[-1] if '.' in file.filename else "unknown"

    document = PatientDocument(
        patient_id=patient_id,
        clinic_id=patient.clinic_id,
        case_paper_id=case_paper_id,
        file_name=file.filename,
        file_path=storage_path, # Storage key
        file_size=file_size,
        file_type=file_type,
        uploaded_by=current_user.id
    )
    db.add(document)
    try:
        db.commit()
        db.refresh(document)
        return PatientDocumentResponseDTO.from_orm(document)
    except ProgrammingError as e:
        if "case_paper_id" not in str(e):
            raise
        db.rollback()
        inserted = db.execute(
            text(
                """
                INSERT INTO patient_documents
                    (patient_id, clinic_id, file_name, file_path, file_size, file_type, uploaded_by, created_at, updated_at)
                VALUES
                    (:patient_id, :clinic_id, :file_name, :file_path, :file_size, :file_type, :uploaded_by, NOW(), NOW())
                RETURNING id, patient_id, clinic_id, file_name, file_path, file_size, file_type, uploaded_by, created_at
                """
            ),
            {
                "patient_id": patient_id,
                "clinic_id": patient.clinic_id,
                "file_name": file.filename,
                "file_path": storage_path,
                "file_size": file_size,
                "file_type": file_type,
                "uploaded_by": current_user.id,
            }
        ).mappings().first()
        db.commit()
        return PatientDocumentResponseDTO(
            id=inserted["id"],
            patient_id=inserted["patient_id"],
            clinic_id=inserted["clinic_id"],
            case_paper_id=None,
            file_name=inserted["file_name"],
            file_path=inserted["file_path"],
            file_size=inserted["file_size"] or 0,
            file_type=inserted["file_type"] or "unknown",
            uploader_name=None,
            created_at=inserted["created_at"],
        )

@router.post("/external/{patient_id}", response_model=PatientDocumentResponseDTO)
async def register_external_document(
    patient_id: int,
    req: ExternalDocumentRequestDTO,
    db: Session = Depends(get_db),
    x_internal_auth: Optional[str] = Header(None),
):
    """Register a document uploaded by an external service (e.g. the WhatsApp
    service), which has already put the bytes in R2 and passes us the key.

    Service-to-service only. This took an arbitrary `clinic_id` AND an arbitrary
    `file_path` (any R2 key) with no authentication at all — and the document
    list presigns whatever key it finds, so the pair was an unauthenticated
    read primitive over the whole bucket."""
    _check_internal_auth(x_internal_auth)
    _ensure_case_paper_column(db)
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # The caller does not get to choose the tenant: it is whoever owns the
    # patient. req.clinic_id is ignored.
    if req.clinic_id and req.clinic_id != patient.clinic_id:
        raise HTTPException(status_code=400, detail="clinic_id does not match the patient")

    file_type = req.file_type or (req.file_name.split('.')[-1] if '.' in req.file_name else "pdf")

    document = PatientDocument(
        patient_id=patient_id,
        clinic_id=patient.clinic_id,  # from the patient, never from the request
        file_name=req.file_name,
        file_path=req.file_path, # Should be the key
        file_size=req.file_size,
        file_type=file_type,
        uploaded_by=None # System uploaded
    )
    db.add(document)
    try:
        db.commit()
        db.refresh(document)
        return PatientDocumentResponseDTO.from_orm(document)
    except ProgrammingError as e:
        if "case_paper_id" not in str(e):
            raise
        db.rollback()
        inserted = db.execute(
            text(
                """
                INSERT INTO patient_documents
                    (patient_id, clinic_id, file_name, file_path, file_size, file_type, uploaded_by, created_at, updated_at)
                VALUES
                    (:patient_id, :clinic_id, :file_name, :file_path, :file_size, :file_type, NULL, NOW(), NOW())
                RETURNING id, patient_id, clinic_id, file_name, file_path, file_size, file_type, created_at
                """
            ),
            {
                "patient_id": patient_id,
                "clinic_id": patient.clinic_id,
                "file_name": req.file_name,
                "file_path": req.file_path,
                "file_size": req.file_size,
                "file_type": file_type,
            }
        ).mappings().first()
        db.commit()
        return PatientDocumentResponseDTO(
            id=inserted["id"],
            patient_id=inserted["patient_id"],
            clinic_id=inserted["clinic_id"],
            case_paper_id=None,
            file_name=inserted["file_name"],
            file_path=inserted["file_path"],
            file_size=inserted["file_size"] or 0,
            file_type=inserted["file_type"] or "pdf",
            uploader_name=None,
            created_at=inserted["created_at"],
        )

@router.get("/patient/{patient_id}", response_model=List[UnifiedFileResponseDTO])
async def list_documents(
    patient_id: int,
    case_paper_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all files for a patient, optionally filtered by case_paper_id"""
    _ensure_case_paper_column(db)
    # Was unauthenticated: any caller could list — and get presigned R2 URLs
    # for — any patient's documents by walking the id.
    _scoped_patient(db, patient_id, current_user)
    def doc_get(record, key, default=None):
        if hasattr(record, 'get'):
            return record.get(key, default)
        return getattr(record, key, default)

    # 1. Fetch PatientDocuments
    # Fallback for older DBs that don't yet have patient_documents.case_paper_id.
    try:
        query = db.query(PatientDocument).filter(
            PatientDocument.patient_id == patient_id,
            PatientDocument.clinic_id == current_user.clinic_id,
        )
        if case_paper_id is not None:
            query = query.filter(PatientDocument.case_paper_id == case_paper_id)
        documents = query.all()
    except ProgrammingError as e:
        if "patient_documents.case_paper_id" not in str(e):
            raise
        db.rollback()
        rows = db.execute(
            text(
                """
                SELECT id, patient_id, clinic_id, file_name, file_path, file_size, file_type, uploaded_by, created_at
                FROM patient_documents
                WHERE patient_id = :patient_id AND clinic_id = :clinic_id
                ORDER BY created_at DESC
                """
            ),
            {"patient_id": patient_id, "clinic_id": current_user.clinic_id}
        )
        documents = rows.mappings().all()

    # 2. Fetch Reports
    reports = (
        db.query(Report)
        .filter(
            Report.patient_id == patient_id,
            Report.clinic_id == current_user.clinic_id,
            Report.pdf_url != None,
        )
        .all()
    )
    
    # Enrich with uploader name and category
    result = []
    
    # Process general documents
    for doc in documents:
        uploader_name = "System"
        uploaded_by = doc_get(doc, 'uploaded_by')
        if uploaded_by:
            uploader = db.query(User).filter(User.id == uploaded_by).first()
            uploader_name = f"{uploader.first_name} {uploader.last_name}" if uploader else "Unknown"
            
        # Generate presigned URL for the key stored in file_path
        doc_file_path = doc_get(doc, 'file_path')
        file_url = get_presigned_url(doc_file_path)
            
        result.append(UnifiedFileResponseDTO(
            id=doc_get(doc, 'id'),
            patient_id=doc_get(doc, 'patient_id'),
            clinic_id=doc_get(doc, 'clinic_id'),
            case_paper_id=doc_get(doc, 'case_paper_id'),
            file_name=doc_get(doc, 'file_name'),
            file_path=file_url or doc_file_path,
            file_size=doc_get(doc, 'file_size') or 0,
            file_type=doc_get(doc, 'file_type') or "unknown",
            uploader_name=uploader_name,
            created_at=doc_get(doc, 'created_at'),
            category="document",
            thumbnail_token=thumbnail_token(doc_get(doc, 'id')),
        ))
        
    # Process reports
    for report in reports:
        # Generate presigned URL for the PDF
        file_url = get_presigned_url(report.pdf_url)
        
        result.append(UnifiedFileResponseDTO(
            id=report.id,
            patient_id=report.patient_id,
            clinic_id=report.clinic_id or 0,
            case_paper_id=None,
            file_name=f"Medical Report ({report.status or 'Scan'})",
            file_path=file_url or report.pdf_url,
            file_size=0,
            file_type="pdf",
            uploader_name="Medical Service",
            created_at=report.created_at,
            category="report"
        ))
        
    # Sort by created_at descending (newest first)
    result.sort(key=lambda x: x.created_at, reverse=True)
    return result

@router.get("/{document_id}/raw")
async def get_document_raw(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream a document's bytes from R2 through our own (CORS-enabled) origin.

    Needed for clients that fetch via XHR — e.g. the in-app DICOM viewer — which
    a direct R2 presigned URL blocks with CORS.

    This is the endpoint the DICOM viewer streams through, and it had auth but
    no clinic filter — so any signed-in user of any clinic could pull any
    radiograph in the system by id."""
    document = _scoped_document(db, document_id, current_user)

    data = download_bytes_from_r2(document.file_path)
    if data is None:
        raise HTTPException(status_code=404, detail="File not found in storage")

    ext = (document.file_type or "").lower()
    media_type = "application/dicom" if ext in ("dcm", "dicom") else "application/octet-stream"
    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{document.file_name}"'},
    )

def _dicom_to_png(raw: bytes) -> Optional[bytes]:
    """Render a DICOM's first frame to a downscaled greyscale PNG.

    Applies Modality LUT (rescale) and inverts MONOCHROME1. Without the
    inversion, MONOCHROME1 studies — which some intraoral sensors produce —
    render as photographic negatives: bone dark, air bright. On a radiograph
    that is not a cosmetic difference, it is the opposite of the image the
    dentist is meant to read."""
    try:
        import pydicom
        import numpy as np
        from PIL import Image
        from pydicom.pixel_data_handlers.util import apply_modality_lut

        ds = pydicom.dcmread(io.BytesIO(raw))
        arr = ds.pixel_array
        # Multi-frame -> first frame; leave RGB(A) frames as-is.
        if arr.ndim == 3 and arr.shape[-1] not in (3, 4):
            arr = arr[0]

        # Rescale slope/intercept, where present.
        try:
            arr = apply_modality_lut(arr, ds)
        except Exception:
            pass  # not all files carry a modality LUT; raw values are fine

        arr = arr.astype(np.float32)
        lo, hi = float(arr.min()), float(arr.max())
        if hi > lo:
            arr = (arr - lo) / (hi - lo)
        # MONOCHROME1 means "0 is white". Normalising above always maps low to
        # black, so this class of file has to be flipped back.
        if str(getattr(ds, "PhotometricInterpretation", "")).strip() == "MONOCHROME1":
            arr = 1.0 - arr
        arr = (arr * 255).astype(np.uint8)
        img = Image.fromarray(arr)
        if img.mode not in ("L", "RGB"):
            img = img.convert("L")
        img.thumbnail((480, 480))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except Exception as e:
        print(f"DICOM thumbnail failed: {e}")
        return None


def _pdf_to_png(raw: bytes) -> Optional[bytes]:
    """Render a PDF's first page to a PNG (pypdfium2, same as template thumbnails)."""
    try:
        import pypdfium2 as pdfium

        pdf = pdfium.PdfDocument(raw)
        if len(pdf) == 0:
            return None
        pil_image = pdf[0].render(scale=1.4).to_pil()
        buf = io.BytesIO()
        pil_image.save(buf, format="PNG")
        return buf.getvalue()
    except Exception as e:
        print(f"PDF thumbnail failed: {e}")
        return None


@router.get("/{document_id}/thumbnail")
async def get_document_thumbnail(document_id: int, t: str = "", db: Session = Depends(get_db)):
    """Return a small PNG preview for a DICOM or PDF document.

    Generated on first request and cached in R2 next to the source so repeat
    loads are cheap.

    Stays header-less because it is used directly as an <img> src, which cannot
    send an Authorization header. Access is instead gated on `t`, the per-
    document HMAC handed out by the authenticated list endpoint. Without it,
    sequential integer ids made this an enumeration oracle over every clinic's
    radiographs — and one that burned 100-300ms of CPU per hit."""
    if not hmac.compare_digest(t or "", thumbnail_token(document_id)):
        # 404, not 403: a distinguishable error would confirm the id exists.
        raise HTTPException(status_code=404, detail="Document not found")

    document = db.query(PatientDocument).filter(PatientDocument.id == document_id).first()
    if not document or not document.file_path:
        raise HTTPException(status_code=404, detail="Document not found")

    ext = (document.file_type or "").lower()
    if ext not in ("dcm", "dicom", "pdf"):
        raise HTTPException(status_code=415, detail="No thumbnail for this file type")

    # private, not public: this is patient imaging and must not sit in a shared
    # or CDN cache keyed only by URL.
    png_headers = {"Cache-Control": "private, max-age=86400"}
    thumb_key = f"{document.file_path}.thumb.png"

    cached = download_bytes_from_r2(thumb_key)
    if cached:
        return Response(content=cached, media_type="image/png", headers=png_headers)

    raw = download_bytes_from_r2(document.file_path)
    if raw is None:
        raise HTTPException(status_code=404, detail="File not found in storage")

    # Rendering is CPU-bound (pydicom/numpy/PIL, or pypdfium2). Run it off the
    # event loop or one slow DICOM stalls every other request in the worker.
    renderer = _dicom_to_png if ext in ("dcm", "dicom") else _pdf_to_png
    png = await run_in_threadpool(renderer, raw)
    if png is None:
        raise HTTPException(status_code=422, detail="Could not generate thumbnail")

    put_bytes_to_key(thumb_key, png, "image/png")  # cache for next time
    return Response(content=png, media_type="image/png", headers=png_headers)


@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a document and the objects behind it.

    Was unauthenticated, so anyone could destroy any clinic's records by id."""
    document = _scoped_document(db, document_id, current_user)

    # Drop the bytes too. Previously only the row went, so a "deleted"
    # radiograph stayed in R2 indefinitely — a retention and consent problem,
    # not just wasted storage. Best-effort: a storage hiccup must not leave the
    # user unable to remove the record.
    file_path = document.file_path
    db.delete(document)
    db.commit()

    if file_path:
        try:
            delete_file_from_r2(file_path)
            delete_file_from_r2(f"{file_path}.thumb.png")
        except Exception as exc:
            print(f"R2 cleanup failed for document {document_id}: {exc}")

    return {"message": "Document deleted successfully"}
