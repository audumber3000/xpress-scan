import os
import tempfile
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
import html2text
import base64
from io import BytesIO
from datetime import datetime

class PDFService:
    @staticmethod
    def generate_signed_consent_pdf(clinic_name, patient_name, template_name, content, signature_base64):
        """
        Generate a professional PDF for a signed consent form.
        """
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            pdf_path = tmp_file.name
        
        doc = SimpleDocTemplate(pdf_path, pagesize=A4, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
        story = []
        styles = getSampleStyleSheet()
        
        # Styles
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, spaceAfter=20, alignment=TA_CENTER, textColor=colors.HexColor("#2a276e"))
        header_style = ParagraphStyle('Header', parent=styles['Heading2'], fontSize=12, spaceAfter=10, textColor=colors.HexColor("#2a276e"))
        normal_style = ParagraphStyle('Normal', parent=styles['Normal'], fontSize=10, spaceAfter=10, leading=14)
        label_style = ParagraphStyle('Label', parent=styles['Normal'], fontSize=9, textColor=colors.grey)
        
        # Header: Clinic Name
        story.append(Paragraph(clinic_name.upper(), title_style))
        story.append(Paragraph("DIGITAL PATIENT CONSENT FORM", ParagraphStyle('Sub', parent=title_style, fontSize=10, textColor=colors.grey)))
        story.append(Spacer(1, 20))
        
        # Patient Details Table
        data = [
            [Paragraph("<b>Patient Name:</b>", label_style), Paragraph(patient_name, normal_style)],
            [Paragraph("<b>Document:</b>", label_style), Paragraph(template_name, normal_style)],
            [Paragraph("<b>Date Signed:</b>", label_style), Paragraph(datetime.now().strftime("%B %d, %Y %I:%M %p"), normal_style)]
        ]
        t = Table(data, colWidths=[1.5*inch, 4*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (0,-1), colors.whitesmoke),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.lightgrey),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('TOPPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(t)
        story.append(Spacer(1, 30))
        
        # Content
        story.append(Paragraph("TERMS & CONDITIONS", header_style))
        # Convert simple HTML/Text to PDF paragraphs
        h = html2text.HTML2Text()
        h.ignore_links = True
        text_content = h.handle(content)
        for line in text_content.split('\n'):
            if line.strip():
                story.append(Paragraph(line.strip(), normal_style))
        
        story.append(Spacer(1, 40))
        
        # Signature Section
        story.append(Paragraph("DIGITAL SIGNATURE", header_style))
        if signature_base64:
            try:
                # Remove header if present (data:image/png;base64,...)
                if "," in signature_base64:
                    signature_base64 = signature_base64.split(",")[1]
                
                img_data = base64.b64decode(signature_base64)
                img_buffer = BytesIO(img_data)
                img = Image(img_buffer, width=2*inch, height=1*inch)
                img.hAlign = 'LEFT'
                story.append(img)
            except Exception as e:
                story.append(Paragraph(f"[Signature Error: {str(e)}]", normal_style))
        
        story.append(Spacer(1, 10))
        story.append(Paragraph("This document was electronically signed and timestamped.", label_style))
        
        doc.build(story)
        return pdf_path

    @staticmethod
    def cleanup(file_path):
        if os.path.exists(file_path):
            os.remove(file_path)
