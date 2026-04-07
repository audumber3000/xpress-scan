from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from typing import List, Optional
from database import get_db
from models import PatientDocument, Patient, User, Report
from core.dtos import PatientDocumentResponseDTO, ExternalDocumentRequestDTO, UnifiedFileResponseDTO
from core.auth_utils import get_current_user
from domains.infrastructure.services.r2_storage import upload_bytes_to_r2, StorageCategory, get_presigned_url

router = APIRouter()

def _ensure_case_paper_column(db: Session):
    """Backfill missing patient_documents.case_paper_id column for older DBs."""
    try:
        db.execute(text("ALTER TABLE patient_documents ADD COLUMN IF NOT EXISTS case_paper_id INTEGER"))
        db.commit()
    except Exception:
        db.rollback()

@router.post("/upload/{patient_id}", response_model=PatientDocumentResponseDTO)
async def upload_document(
    patient_id: int,
    file: UploadFile = File(...),
    case_paper_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _ensure_case_paper_column(db)
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
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
    db: Session = Depends(get_db)
):
    _ensure_case_paper_column(db)
    """Register a document uploaded by an external service (e.g., WhatsApp service)"""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    file_type = req.file_type or (req.file_name.split('.')[-1] if '.' in req.file_name else "pdf")

    document = PatientDocument(
        patient_id=patient_id,
        clinic_id=req.clinic_id,
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
                "clinic_id": req.clinic_id,
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
    db: Session = Depends(get_db)
):
    _ensure_case_paper_column(db)
    """List all files for a patient, optionally filtered by case_paper_id"""
    def doc_get(record, key, default=None):
        if hasattr(record, 'get'):
            return record.get(key, default)
        return getattr(record, key, default)

    # 1. Fetch PatientDocuments
    # Fallback for older DBs that don't yet have patient_documents.case_paper_id.
    try:
        query = db.query(PatientDocument).filter(PatientDocument.patient_id == patient_id)
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
                WHERE patient_id = :patient_id
                ORDER BY created_at DESC
                """
            ),
            {"patient_id": patient_id}
        )
        documents = rows.mappings().all()
    
    # 2. Fetch Reports
    reports = db.query(Report).filter(Report.patient_id == patient_id, Report.pdf_url != None).all()
    
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
            category="document"
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

@router.delete("/{document_id}")
async def delete_document(document_id: int, db: Session = Depends(get_db)):
    document = db.query(PatientDocument).filter(PatientDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # In real implementation, delete from S3 too
    db.delete(document)
    db.commit()
    return {"message": "Document deleted successfully"}
