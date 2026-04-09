from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, text
from typing import List, Optional
from datetime import datetime
from domains.finance.invoice_pdf_engine import generate_invoice_html
import os
import requests
import re

from database import SessionLocal

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
from models import Invoice, InvoiceLineItem, InvoiceAuditLog, Patient, User, Clinic
from core.auth_utils import get_current_user
from schemas import (
    InvoiceOut, InvoiceLineItemCreate, InvoiceLineItemOut,
    MarkAsPaidRequest, InvoiceCreate
)
from domains.infrastructure.services.pdf_service import html_template_to_pdf
from domains.infrastructure.services.r2_storage import upload_pdf_to_r2

router = APIRouter()

_invoice_columns_ensured = False

def _ensure_invoice_columns(db: Session):
    """Backfill invoice lifecycle columns for older DBs — runs only once per process."""
    global _invoice_columns_ensured
    if _invoice_columns_ensured:
        return
    try:
        db.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP"))
        db.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount DOUBLE PRECISION DEFAULT 0"))
        db.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_amount DOUBLE PRECISION DEFAULT 0"))
        db.commit()
        _invoice_columns_ensured = True
    except Exception:
        db.rollback()

def enrich_invoice(db: Session, invoice: Invoice):
    """Enrich invoice with related data"""
    total_amount = float(invoice.total or 0)
    paid_amount = float(getattr(invoice, 'paid_amount', 0) or 0)
    due_amount = getattr(invoice, 'due_amount', None)
    if due_amount is None:
        due_amount = max(0.0, total_amount - paid_amount)

    invoice_dict = {
        'id': invoice.id,
        'clinic_id': invoice.clinic_id,
        'patient_id': invoice.patient_id,
        'patient_name': invoice.patient.name if invoice.patient else None,
        'patient_phone': invoice.patient.phone if invoice.patient else None,
        'invoice_number': invoice.invoice_number,
        'status': invoice.status,
        'payment_mode': invoice.payment_mode,
        'utr': invoice.utr,
        'appointment_id': invoice.appointment_id,
        'subtotal': invoice.subtotal,
        'tax': invoice.tax,
        'discount': invoice.discount or 0.0,
        'discount_type': invoice.discount_type or 'amount',
        'discount_amount': invoice.discount_amount or 0.0,
        'total': invoice.total,
        'notes': invoice.notes,
        'created_by': invoice.created_by,
        'created_at': invoice.created_at.isoformat() if invoice.created_at else None,
        'updated_at': invoice.updated_at.isoformat() if invoice.updated_at else None,
        'synced_at': getattr(invoice, 'synced_at', None).isoformat() if getattr(invoice, 'synced_at', None) else None,
        'sync_status': getattr(invoice, 'sync_status', 'local'),
        'paid_at': invoice.paid_at.isoformat() if invoice.paid_at else None,
        'finalized_at': getattr(invoice, 'finalized_at', None).isoformat() if getattr(invoice, 'finalized_at', None) else None,
        'paid_amount': paid_amount,
        'due_amount': float(due_amount or 0),
        'line_items': [
            {
                'id': item.id,
                'invoice_id': item.invoice_id,
                'description': item.description,
                'quantity': item.quantity,
                'unit_price': item.unit_price,
                'amount': item.amount,
                'created_at': item.created_at.isoformat() if item.created_at else None,
                'updated_at': getattr(item, 'updated_at', item.created_at).isoformat() if getattr(item, 'updated_at', item.created_at) else None,
                'synced_at': getattr(item, 'synced_at', None).isoformat() if getattr(item, 'synced_at', None) else None,
                'sync_status': getattr(item, 'sync_status', 'local')
            }
            for item in invoice.line_items
        ]
    }
    return invoice_dict

def recalculate_invoice_totals(db: Session, invoice: Invoice):
    """Recalculate invoice subtotal, tax, discount, and total"""
    subtotal = sum(item.amount for item in invoice.line_items)
    
    # Calculate discount
    discount_amount = 0.0
    if hasattr(invoice, 'discount') and invoice.discount and invoice.discount > 0:
        if invoice.discount_type == 'percentage':
            discount_amount = subtotal * (invoice.discount / 100)
        else:
            discount_amount = invoice.discount
            
    # Cap discount
    if discount_amount > subtotal:
        discount_amount = subtotal
        
    tax = 0.0  # Can add tax calculation logic here (e.g., GST)
    total = subtotal - discount_amount + tax
    
    invoice.subtotal = subtotal
    invoice.discount_amount = discount_amount
    invoice.tax = tax
    invoice.total = total

    current_paid = float(getattr(invoice, 'paid_amount', 0) or 0)
    if invoice.status in ['paid_unverified', 'paid_verified']:
        invoice.paid_amount = max(current_paid, total)
        invoice.due_amount = 0.0
    elif invoice.status == 'partially_paid':
        normalized_paid = min(max(current_paid, 0.0), total)
        invoice.paid_amount = normalized_paid
        invoice.due_amount = max(total - normalized_paid, 0.0)
    else:
        invoice.paid_amount = 0.0
        invoice.due_amount = max(total, 0.0)

def create_audit_log(
    db: Session,
    invoice_id: int,
    user_id: int,
    action: str,
    old_values: dict = None,
    new_values: dict = None,
    notes: str = None
):
    """Create an audit log entry"""
    audit_log = InvoiceAuditLog(
        invoice_id=invoice_id,
        action=action,
        user_id=user_id,
        old_values=old_values,
        new_values=new_values,
        notes=notes
    )
    db.add(audit_log)

@router.post("", response_model=InvoiceOut)
async def create_invoice(
    invoice_data: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new manual invoice"""
    try:
        _ensure_invoice_columns(db)
        # Check if patient exists in this clinic
        patient = db.query(Patient).filter(
            Patient.id == invoice_data.patient_id,
            Patient.clinic_id == current_user.clinic_id
        ).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
            
        # Generate generic invoice number
        year = datetime.utcnow().year
        last_invoice = db.query(Invoice).filter(
            Invoice.clinic_id == current_user.clinic_id,
            Invoice.invoice_number.like(f"INV-{year}-%")
        ).order_by(desc(Invoice.invoice_number)).first()
        
        if last_invoice:
            try:
                last_num = int(last_invoice.invoice_number.split('-')[-1])
                new_num = last_num + 1
            except (ValueError, IndexError):
                new_num = 1
        else:
            new_num = 1
            
        invoice_number = f"INV-{year}-{new_num:04d}"
        
        invoice = Invoice(
            clinic_id=current_user.clinic_id,
            patient_id=invoice_data.patient_id,
            appointment_id=invoice_data.appointment_id,
            invoice_number=invoice_number,
            status='draft',
            subtotal=0.0,
            tax=0.0,
            total=0.0,
            paid_amount=0.0,
            due_amount=0.0,
            notes=invoice_data.notes
        )
        db.add(invoice)
        db.flush()
        
        create_audit_log(db, invoice.id, current_user.id, 'created')
        
        db.commit()
        db.refresh(invoice)
        return enrich_invoice(db, invoice)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating invoice: {str(e)}")

@router.get("", response_model=List[InvoiceOut])
async def get_invoices(
    skip: int = Query(0),
    limit: int = Query(100),
    status: Optional[str] = None,
    patient_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all invoices for the clinic"""
    try:
        _ensure_invoice_columns(db)
        query = db.query(Invoice).filter(Invoice.clinic_id == current_user.clinic_id)
        
        if status:
            query = query.filter(Invoice.status == status)
        if patient_id:
            query = query.filter(Invoice.patient_id == patient_id)
        
        invoices = query.order_by(desc(Invoice.created_at)).offset(skip).limit(limit).all()
        return [enrich_invoice(db, inv) for inv in invoices]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching invoices: {str(e)}")

@router.get("/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific invoice"""
    _ensure_invoice_columns(db)
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.clinic_id == current_user.clinic_id
    ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return enrich_invoice(db, invoice)

@router.post("/{invoice_id}/line-items", response_model=InvoiceOut)
async def add_line_item(
    invoice_id: int,
    line_item_data: InvoiceLineItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a new line item to invoice"""
    try:
        _ensure_invoice_columns(db)
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        if invoice.status != 'draft':
            raise HTTPException(status_code=400, detail="Can only edit draft invoices")
        
        # Calculate amount if not provided
        amount = line_item_data.amount
        if amount is None:
            amount = line_item_data.quantity * line_item_data.unit_price
        
        line_item = InvoiceLineItem(
            invoice_id=invoice_id,
            description=line_item_data.description,
            quantity=line_item_data.quantity,
            unit_price=line_item_data.unit_price,
            amount=amount
        )
        db.add(line_item)
        db.flush()
        
        # Recalculate totals
        recalculate_invoice_totals(db, invoice)
        
        # Audit log
        create_audit_log(db, invoice_id, current_user.id, 'line_item_added', None, {
            'description': line_item.description,
            'quantity': line_item.quantity,
            'unit_price': line_item.unit_price,
            'amount': line_item.amount
        })
        
        db.commit()
        db.refresh(invoice)
        return enrich_invoice(db, invoice)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error adding line item: {str(e)}")

@router.put("/{invoice_id}/line-items/{line_item_id}", response_model=InvoiceOut)
async def update_line_item(
    invoice_id: int,
    line_item_id: int,
    line_item_data: InvoiceLineItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a line item"""
    try:
        _ensure_invoice_columns(db)
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        if invoice.status != 'draft':
            raise HTTPException(status_code=400, detail="Can only edit draft invoices")
        
        line_item = db.query(InvoiceLineItem).filter(
            InvoiceLineItem.id == line_item_id,
            InvoiceLineItem.invoice_id == invoice_id
        ).first()
        
        if not line_item:
            raise HTTPException(status_code=404, detail="Line item not found")
        
        # Store old values for audit
        old_values = {
            'description': line_item.description,
            'quantity': line_item.quantity,
            'unit_price': line_item.unit_price,
            'amount': line_item.amount
        }
        
        # Update line item
        line_item.description = line_item_data.description
        line_item.quantity = line_item_data.quantity
        line_item.unit_price = line_item_data.unit_price
        
        # Calculate amount
        amount = line_item_data.amount
        if amount is None:
            amount = line_item_data.quantity * line_item_data.unit_price
        line_item.amount = amount
        
        # Recalculate invoice totals
        recalculate_invoice_totals(db, invoice)
        
        # Audit log
        create_audit_log(db, invoice_id, current_user.id, 'line_item_updated', old_values, {
            'description': line_item.description,
            'quantity': line_item.quantity,
            'unit_price': line_item.unit_price,
            'amount': line_item.amount
        })
        
        db.commit()
        db.refresh(invoice)
        return enrich_invoice(db, invoice)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating line item: {str(e)}")

@router.delete("/{invoice_id}/line-items/{line_item_id}", response_model=InvoiceOut)
async def delete_line_item(
    invoice_id: int,
    line_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a line item"""
    try:
        _ensure_invoice_columns(db)
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        if invoice.status != 'draft':
            raise HTTPException(status_code=400, detail="Can only edit draft invoices")
        
        line_item = db.query(InvoiceLineItem).filter(
            InvoiceLineItem.id == line_item_id,
            InvoiceLineItem.invoice_id == invoice_id
        ).first()
        
        if not line_item:
            raise HTTPException(status_code=404, detail="Line item not found")
        
        # Audit log before deletion
        create_audit_log(db, invoice_id, current_user.id, 'line_item_deleted', {
            'description': line_item.description,
            'quantity': line_item.quantity,
            'unit_price': line_item.unit_price,
            'amount': line_item.amount
        }, None)
        
        db.delete(line_item)
        
        # Recalculate totals
        recalculate_invoice_totals(db, invoice)
        
        db.commit()
        db.refresh(invoice)
        return enrich_invoice(db, invoice)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting line item: {str(e)}")

@router.post("/{invoice_id}/finalize", response_model=InvoiceOut)
async def finalize_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Finalize invoice so it becomes non-editable."""
    try:
        _ensure_invoice_columns(db)
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()

        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        if invoice.status != 'draft':
            raise HTTPException(status_code=400, detail="Only draft invoices can be finalized")

        if not invoice.line_items or len(invoice.line_items) == 0:
            raise HTTPException(status_code=400, detail="Add at least one line item before finalizing")

        recalculate_invoice_totals(db, invoice)
        invoice.status = 'finalized'
        invoice.finalized_at = datetime.utcnow()
        invoice.paid_amount = 0.0
        invoice.due_amount = max(float(invoice.total or 0), 0.0)

        create_audit_log(db, invoice_id, current_user.id, 'finalized', {
            'status': 'draft'
        }, {
            'status': invoice.status,
            'finalized_at': invoice.finalized_at.isoformat() if invoice.finalized_at else None
        })

        db.commit()
        db.refresh(invoice)
        return enrich_invoice(db, invoice)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error finalizing invoice: {str(e)}")

@router.post("/{invoice_id}/mark-as-paid", response_model=InvoiceOut)
async def mark_invoice_as_paid(
    invoice_id: int,
    payment_data: MarkAsPaidRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Record payment (full or partial) on finalized invoice."""
    try:
        _ensure_invoice_columns(db)
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        if invoice.status not in ['finalized', 'partially_paid']:
            raise HTTPException(status_code=400, detail="Only finalized invoices can be marked as paid")

        recalculate_invoice_totals(db, invoice)

        remaining_due = max(float(invoice.total or 0) - float(getattr(invoice, 'paid_amount', 0) or 0), 0.0)
        if remaining_due <= 0:
            raise HTTPException(status_code=400, detail="Invoice is already fully paid")

        old_status = invoice.status
        old_paid = float(getattr(invoice, 'paid_amount', 0) or 0)

        is_partial = bool(payment_data.is_partial)
        amount_paid = float(payment_data.amount_paid or 0)
        if is_partial:
            if amount_paid <= 0:
                raise HTTPException(status_code=400, detail="Enter valid partial payment amount")
            if amount_paid >= remaining_due:
                raise HTTPException(status_code=400, detail="Partial amount must be less than due amount")
            payment_amount = amount_paid
        else:
            payment_amount = remaining_due

        invoice.paid_amount = min(float(invoice.total or 0), old_paid + payment_amount)
        invoice.due_amount = max(float(invoice.total or 0) - invoice.paid_amount, 0.0)

        if invoice.due_amount > 0:
            invoice.status = 'partially_paid'
            invoice.paid_at = None
        else:
            invoice.status = 'paid_unverified'
            invoice.paid_at = datetime.utcnow()

        invoice.payment_mode = payment_data.payment_mode
        invoice.utr = payment_data.utr
        
        # Audit log
        create_audit_log(db, invoice_id, current_user.id, 'marked_paid', {
            'status': old_status,
            'paid_amount': old_paid,
            'due_amount': remaining_due
        }, {
            'status': invoice.status,
            'payment_mode': invoice.payment_mode,
            'utr': invoice.utr,
            'paid_amount': invoice.paid_amount,
            'due_amount': invoice.due_amount,
            'payment_amount': payment_amount
        }, notes=f"Payment recorded via {invoice.payment_mode}")
        
        db.commit()
        db.refresh(invoice)
        return enrich_invoice(db, invoice)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error marking invoice as paid: {str(e)}")

@router.put("/{invoice_id}", response_model=InvoiceOut)
async def update_invoice(
    invoice_id: int,
    invoice_update: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update invoice (payment_mode, utr, notes)"""
    try:
        _ensure_invoice_columns(db)
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        if invoice.status != 'draft':
            raise HTTPException(status_code=400, detail="Can only update draft invoices")
        
        old_values = {
            'payment_mode': invoice.payment_mode,
            'utr': invoice.utr,
            'notes': invoice.notes,
            'discount': getattr(invoice, 'discount', 0),
            'discount_type': getattr(invoice, 'discount_type', 'amount')
        }
        
        # Update fields
        if 'payment_mode' in invoice_update:
            invoice.payment_mode = invoice_update['payment_mode']
        if 'utr' in invoice_update:
            invoice.utr = invoice_update.get('utr')
        if 'notes' in invoice_update:
            invoice.notes = invoice_update.get('notes')
        if 'discount' in invoice_update:
            invoice.discount = float(invoice_update['discount'])
        if 'discount_type' in invoice_update:
            invoice.discount_type = invoice_update['discount_type']
            
        recalculate_invoice_totals(db, invoice)
        
        new_values = {
            'payment_mode': invoice.payment_mode,
            'utr': invoice.utr,
            'notes': invoice.notes,
            'discount': invoice.discount,
            'discount_type': invoice.discount_type
        }
        
        # Audit log
        create_audit_log(db, invoice_id, current_user.id, 'updated', old_values, new_values)
        
        db.commit()
        db.refresh(invoice)
        return enrich_invoice(db, invoice)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating invoice: {str(e)}")

@router.delete("/{invoice_id}")
async def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an entire invoice completely"""
    try:
        _ensure_invoice_columns(db)
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        # It's usually safer to only allow deleting drafts or unverified invoices,
        # but the request asks to allow deleting invoices entirely to cancel them out from double entry.
        
        db.delete(invoice)
        db.commit()
        
        return {"success": True, "message": "Invoice deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting invoice: {str(e)}")

@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate and return invoice PDF"""
    try:
        _ensure_invoice_columns(db)
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        # Get clinic info
        clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        
        # Get template configuration
        from models import TemplateConfiguration
        config = db.query(TemplateConfiguration).filter(
            TemplateConfiguration.clinic_id == current_user.clinic_id,
            TemplateConfiguration.category == 'invoice'
        ).first()

        # Generate HTML invoice template
        html_content = generate_invoice_html(invoice, clinic, config)
        
        # Convert to PDF
        pdf_path = html_template_to_pdf(html_content)
        
        # Read PDF file
        with open(pdf_path, 'rb') as pdf_file:
            pdf_content = pdf_file.read()
        
        # Cleanup temp file
        try:
            os.remove(pdf_path)
        except:
            pass
        
        # Return PDF as response
        return Response(
            content=pdf_content,
            media_type='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename="invoice_{invoice.invoice_number}.pdf"'
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")

@router.post("/{invoice_id}/send-whatsapp")
async def send_invoice_via_whatsapp(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send invoice PDF to patient via WhatsApp"""
    try:
        _ensure_invoice_columns(db)
        # Get invoice
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        # Get patient
        patient = db.query(Patient).filter(Patient.id == invoice.patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        if not patient.phone:
            raise HTTPException(status_code=400, detail="Patient phone number is required")
        
        # Get clinic info
        clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        
        # Get template configuration
        from models import TemplateConfiguration
        config = db.query(TemplateConfiguration).filter(
            TemplateConfiguration.clinic_id == current_user.clinic_id,
            TemplateConfiguration.category == 'invoice'
        ).first()

        # Generate HTML invoice template
        html_content = generate_invoice_html(invoice, clinic, config)
        
        # Convert to PDF
        pdf_path = html_template_to_pdf(html_content)
        
        # Read PDF file and convert to base64
        import base64
        with open(pdf_path, 'rb') as pdf_file:
            pdf_content = pdf_file.read()
            pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
        
        # Cleanup temp file
        try:
            os.remove(pdf_path)
        except:
            pass
        
        # Prepare message using template
        from domains.communication.routes.message_templates import get_template_for_scenario, render_template
        
        clinic_name = clinic.name if clinic else "Clinic"
        filename = f"invoice_{invoice.id}.pdf"  # Use invoice ID as filename
        
        # Get invoice template or use default
        default_invoice_message = f"Dear {patient.name},\n\nYour invoice #{invoice.invoice_number} is ready.\n\nTotal Amount: ₹{invoice.total:.2f}\n\nPlease find the invoice PDF attached.\n\nThank you,\n{clinic_name}"
        template_content = get_template_for_scenario(
            db,
            current_user.clinic_id,
            "invoice",
            default_invoice_message
        )
        
        # Render template with variables
        template_vars = {
            "patient_name": patient.name,
            "clinic_name": clinic_name,
            "invoice_number": invoice.invoice_number,
            "invoice_id": invoice.id,
            "total_amount": f"₹{invoice.total:.2f}",
            "subtotal": f"₹{invoice.subtotal:.2f}",
            "tax": f"₹{invoice.tax:.2f}",
            "payment_mode": invoice.payment_mode or "Not specified"
        }
        message = render_template(template_content, template_vars)
        
        # Send via WhatsApp
        # WhatsApp Service URL (MolarPlus Nexus)
        NEXUS_SERVICES_URL = os.getenv("NEXUS_SERVICES_URL", "http://localhost:8001")
        
        # Clean phone number
        clean_phone = re.sub(r'\D', '', str(patient.phone))
        if len(clean_phone) == 10:
            clean_phone = "91" + clean_phone
        
        # Send message with PDF as base64 media
        try:
            response = requests.post(
                f"{NEXUS_SERVICES_URL}/api/send/{current_user.id}",
                json={
                    "phone": clean_phone,
                    "message": message,
                    "media": pdf_base64,
                    "mediaType": "application/pdf",
                    "filename": filename
                },
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    return {
                        "success": True,
                        "message": "Invoice sent successfully via WhatsApp",
                        "phone_number": clean_phone
                    }
                else:
                    raise HTTPException(
                        status_code=500,
                        detail=result.get("error", "Failed to send invoice via WhatsApp")
                    )
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"WhatsApp service returned status {response.status_code}"
                )
        except requests.exceptions.RequestException as e:
            raise HTTPException(
                status_code=503,
                detail=f"Failed to connect to WhatsApp service: {str(e)}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending invoice via WhatsApp: {str(e)}")



