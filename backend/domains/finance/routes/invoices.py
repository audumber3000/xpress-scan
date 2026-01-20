from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime
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
    MarkAsPaidRequest
)
from domains.infrastructure.services.pdf_service import html_template_to_pdf
from domains.infrastructure.services.r2_storage import upload_pdf_to_r2

router = APIRouter()

def enrich_invoice(db: Session, invoice: Invoice):
    """Enrich invoice with related data"""
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
        'visit_id': invoice.visit_id,
        'subtotal': invoice.subtotal,
        'tax': invoice.tax,
        'total': invoice.total,
        'notes': invoice.notes,
        'created_by': invoice.created_by,
        'created_at': invoice.created_at.isoformat() if invoice.created_at else None,
        'updated_at': invoice.updated_at.isoformat() if invoice.updated_at else None,
        'synced_at': getattr(invoice, 'synced_at', None).isoformat() if getattr(invoice, 'synced_at', None) else None,
        'sync_status': getattr(invoice, 'sync_status', 'local'),
        'paid_at': invoice.paid_at.isoformat() if invoice.paid_at else None,
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
    """Recalculate invoice subtotal, tax, and total"""
    subtotal = sum(item.amount for item in invoice.line_items)
    tax = 0.0  # Can add tax calculation logic here (e.g., GST)
    total = subtotal + tax
    
    invoice.subtotal = subtotal
    invoice.tax = tax
    invoice.total = total

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

@router.get("/", response_model=List[InvoiceOut])
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

@router.post("/{invoice_id}/mark-as-paid", response_model=InvoiceOut)
async def mark_invoice_as_paid(
    invoice_id: int,
    payment_data: MarkAsPaidRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark invoice as paid (unverified)"""
    try:
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        if invoice.status != 'draft':
            raise HTTPException(status_code=400, detail="Only draft invoices can be marked as paid")
        
        old_status = invoice.status
        invoice.status = 'paid_unverified'
        invoice.payment_mode = payment_data.payment_mode
        invoice.utr = payment_data.utr
        invoice.paid_at = datetime.utcnow()
        
        # Audit log
        create_audit_log(db, invoice_id, current_user.id, 'marked_paid', {
            'status': old_status
        }, {
            'status': invoice.status,
            'payment_mode': invoice.payment_mode,
            'utr': invoice.utr
        }, notes=f"Marked as paid via {invoice.payment_mode}")
        
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
            'notes': invoice.notes
        }
        
        # Update fields
        if 'payment_mode' in invoice_update:
            invoice.payment_mode = invoice_update['payment_mode']
        if 'utr' in invoice_update:
            invoice.utr = invoice_update.get('utr')
        if 'notes' in invoice_update:
            invoice.notes = invoice_update.get('notes')
        
        new_values = {
            'payment_mode': invoice.payment_mode,
            'utr': invoice.utr,
            'notes': invoice.notes
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

@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate and return invoice PDF"""
    try:
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        # Get clinic info
        clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        
        # Generate HTML invoice template
        html_content = generate_invoice_html(invoice, clinic)
        
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
        
        # Generate HTML invoice template
        html_content = generate_invoice_html(invoice, clinic)
        
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
        from routes.message_templates import get_template_for_scenario, render_template
        
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
        WHATSAPP_SERVICE_URL = os.getenv("WHATSAPP_SERVICE_URL", "http://localhost:3001")
        
        # Clean phone number
        clean_phone = re.sub(r'\D', '', str(patient.phone))
        if len(clean_phone) == 10:
            clean_phone = "91" + clean_phone
        
        # Send message with PDF as base64 media
        try:
            response = requests.post(
                f"{WHATSAPP_SERVICE_URL}/api/send/{current_user.id}",
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

def generate_invoice_html(invoice: Invoice, clinic: Clinic) -> str:
    """Generate HTML content for invoice PDF"""
    payment_status_label = "UPI – Unverified" if invoice.status == 'paid_unverified' and invoice.payment_mode == 'UPI' else invoice.status.replace('_', ' ').title()
    
    line_items_html = ""
    for item in invoice.line_items:
        line_items_html += f"""
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">{item.description}</td>
            <td style="padding: 8px; text-align: center; border-bottom: 1px solid #ddd;">{item.quantity}</td>
            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">₹{item.unit_price:.2f}</td>
            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">₹{item.amount:.2f}</td>
        </tr>
        """
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{
                font-family: Arial, sans-serif;
                margin: 40px;
                color: #333;
            }}
            .header {{
                border-bottom: 3px solid #10B981;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }}
            .clinic-name {{
                font-size: 24px;
                font-weight: bold;
                color: #10B981;
                margin-bottom: 10px;
            }}
            .invoice-info {{
                display: flex;
                justify-content: space-between;
                margin-bottom: 30px;
            }}
            .patient-info, .invoice-details {{
                width: 48%;
            }}
            .section-title {{
                font-weight: bold;
                margin-bottom: 10px;
                color: #555;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }}
            th {{
                background-color: #f3f4f6;
                padding: 12px;
                text-align: left;
                border-bottom: 2px solid #ddd;
                font-weight: bold;
            }}
            .total-section {{
                margin-top: 20px;
                text-align: right;
            }}
            .total-row {{
                padding: 8px;
                font-size: 16px;
            }}
            .grand-total {{
                font-size: 20px;
                font-weight: bold;
                border-top: 2px solid #10B981;
                padding-top: 10px;
            }}
            .payment-info {{
                margin-top: 30px;
                padding: 15px;
                background-color: #f9fafb;
                border-left: 4px solid #10B981;
            }}
            .footer {{
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
                text-align: center;
                color: #666;
                font-size: 12px;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="clinic-name">{clinic.name if clinic else 'Clinic'}</div>
            <div style="color: #666;">
                {clinic.address if clinic and clinic.address else ''}
                {f'<br>Phone: {clinic.phone}' if clinic and clinic.phone else ''}
                {f'<br>Email: {clinic.email}' if clinic and clinic.email else ''}
            </div>
        </div>
        
        <div class="invoice-info">
            <div class="patient-info">
                <div class="section-title">Bill To:</div>
                <div>{invoice.patient.name if invoice.patient else ''}</div>
                {f'<div>Phone: {invoice.patient.phone}</div>' if invoice.patient and invoice.patient.phone else ''}
            </div>
            <div class="invoice-details">
                <div class="section-title">Invoice Details:</div>
                <div>Invoice #: {invoice.invoice_number}</div>
                <div>Date: {invoice.created_at.strftime('%d %B %Y') if invoice.created_at else ''}</div>
                <div>Status: {payment_status_label}</div>
            </div>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th style="text-align: center;">Quantity</th>
                    <th style="text-align: right;">Unit Price</th>
                    <th style="text-align: right;">Amount</th>
                </tr>
            </thead>
            <tbody>
                {line_items_html}
            </tbody>
        </table>
        
        <div class="total-section">
            <div class="total-row">Subtotal: ₹{invoice.subtotal:.2f}</div>
            {f'<div class="total-row">Tax: ₹{invoice.tax:.2f}</div>' if invoice.tax > 0 else ''}
            <div class="total-row grand-total">Total: ₹{invoice.total:.2f}</div>
        </div>
        
        {f'''
        <div class="payment-info">
            <div><strong>Payment Mode:</strong> {invoice.payment_mode}</div>
            {f'<div><strong>UTR:</strong> {invoice.utr}</div>' if invoice.utr else ''}
            <div><strong>Status:</strong> {payment_status_label}</div>
        </div>
        ''' if invoice.payment_mode else ''}
        
        {f'<div style="margin-top: 20px;"><strong>Notes:</strong> {invoice.notes}</div>' if invoice.notes else ''}
        
        <div class="footer">
            <div>Thank you for your business!</div>
            <div style="margin-top: 10px;">This is a computer-generated invoice.</div>
        </div>
    </body>
    </html>
    """
    return html

