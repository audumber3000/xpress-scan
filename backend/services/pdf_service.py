import os
import tempfile
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
import html2text
import re
from datetime import datetime

def html_template_to_pdf(html_content: str, patient_info=None):
    """
    Convert HTML template to PDF using proper HTML rendering
    
    Args:
        html_content: Complete HTML content with styling
        patient_info: Optional patient info for filename
        
    Returns:
        Path to generated PDF file
    """
    try:
        # Use proper HTML-to-PDF conversion
        return html_to_pdf_proper(html_content, patient_info)
        
    except Exception as e:
        print(f"Error generating PDF from HTML template: {e}")
        # Fallback to basic PDF generation
        return html_to_pdf_fallback(html_content, patient_info)

def html_to_pdf_proper(html_content, patient_info=None):
    """
    Convert HTML content to PDF using playwright for exact HTML rendering
    """
    try:
        from playwright.sync_api import sync_playwright
        
        # Create a temporary file for the PDF
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            pdf_path = tmp_file.name
        
        # Use playwright to render HTML exactly as it appears in a browser
        with sync_playwright() as p:
            # Launch browser
            browser = p.chromium.launch()
            page = browser.new_page()
            
            # Set content and wait for it to load
            page.set_content(html_content)
            
            # Generate PDF with proper settings
            page.pdf(
                path=pdf_path,
                format='A4',
                margin={
                    'top': '0.75in',
                    'right': '0.75in',
                    'bottom': '0.75in',
                    'left': '0.75in'
                },
                print_background=True
            )
            
            browser.close()
        
        return pdf_path
        
    except ImportError:
        print("playwright not available, falling back to basic PDF generation")
        return html_to_pdf_fallback(html_content, patient_info)
    except Exception as e:
        print(f"Error with playwright: {e}")
        return html_to_pdf_fallback(html_content, patient_info)

def html_to_pdf_fallback(html_content, patient_info=None):
    """
    Fallback PDF generation using basic formatting
    """
    # Create a temporary file for the PDF
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
        pdf_path = tmp_file.name
    
    # Create the PDF document
    doc = SimpleDocTemplate(pdf_path, pagesize=A4)
    story = []
    styles = getSampleStyleSheet()
    
    # Create custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        spaceAfter=20,
        alignment=TA_CENTER,
        textColor=colors.darkblue
    )
    
    header_style = ParagraphStyle(
        'Header',
        parent=styles['Heading2'],
        fontSize=12,
        spaceAfter=10,
        textColor=colors.darkblue
    )
    
    normal_style = ParagraphStyle(
        'Normal',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6,
        alignment=TA_LEFT
    )
    
    # Add patient information header if provided
    if patient_info:
        # Title
        story.append(Paragraph("RADIOLOGY REPORT", title_style))
        story.append(Spacer(1, 20))
        
        # Patient information table
        patient_data = [
            ['Patient Name:', patient_info.get('name', 'N/A')],
            ['Age:', f"{patient_info.get('age', 'N/A')} years"],
            ['Gender:', patient_info.get('gender', 'N/A')],
            ['Scan Type:', patient_info.get('scan_type', 'N/A')],
            ['Referred By:', patient_info.get('referred_by', 'N/A')],
            ['Village:', patient_info.get('village', 'N/A')],
            ['Phone:', patient_info.get('phone', 'N/A')],
            ['Date:', datetime.now().strftime('%B %d, %Y')]
        ]
        
        patient_table = Table(patient_data, colWidths=[2*inch, 4*inch])
        patient_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(patient_table)
        story.append(Spacer(1, 20))
        
        # Report content header
        story.append(Paragraph("REPORT FINDINGS", header_style))
        story.append(Spacer(1, 10))
    
    # Convert HTML to plain text and format for PDF
    h = html2text.HTML2Text()
    h.ignore_links = True
    h.ignore_images = True
    h.body_width = 0  # No line wrapping
    
    # Convert HTML to text
    text_content = h.handle(html_content)
    
    # Clean up the text and split into paragraphs
    paragraphs = text_content.split('\n\n')
    
    for para in paragraphs:
        para = para.strip()
        if para:
            # Handle different types of content
            if para.startswith('#'):
                # Headers
                level = len(para) - len(para.lstrip('#'))
                if level == 1:
                    story.append(Paragraph(para.lstrip('#').strip(), header_style))
                else:
                    story.append(Paragraph(para.lstrip('#').strip(), normal_style))
            elif para.startswith('*') or para.startswith('-'):
                # Bullet points
                story.append(Paragraph(f"• {para.lstrip('*').lstrip('-').strip()}", normal_style))
            else:
                # Regular paragraph
                story.append(Paragraph(para, normal_style))
            story.append(Spacer(1, 6))
    
    # Build the PDF
    doc.build(story)
    
    return pdf_path

def cleanup_temp_file(file_path):
    """
    Clean up temporary file
    """
    try:
        if os.path.exists(file_path):
            os.unlink(file_path)
    except Exception as e:
        print(f"Error cleaning up temp file {file_path}: {e}")

def generate_pdf_filename(patient_name, scan_type):
    """
    Generate a clean filename for the PDF
    """
    # Clean the patient name and scan type for filename
    clean_name = re.sub(r'[^\w\s-]', '', patient_name).strip()
    clean_scan = re.sub(r'[^\w\s-]', '', scan_type).strip()
    
    # Replace spaces with underscores to avoid URL encoding
    clean_name = clean_name.replace(' ', '_')
    clean_scan = clean_scan.replace(' ', '_')
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    return f"{clean_name}_{clean_scan}_{timestamp}.pdf" 