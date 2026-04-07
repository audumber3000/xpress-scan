import os
import json
import io
import openai
import matplotlib.pyplot as plt
import matplotlib
import numpy as np
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from app.services.infrastructure.storage_service import StorageService
from app.database import get_db

# Use non-interactive backend for Matplotlib
matplotlib.use('Agg')

class BaseReportJob:
    def __init__(self, report_data: dict):
        self.report_data = report_data
        self.db = next(get_db())
        self.styles = getSampleStyleSheet()
        self.colors = {
            'navy': '#2a276e',
            'green': '#10b981',
            'gray': '#6b7280',
            'light_gray': '#f3f4f6',
            'white': '#ffffff'
        }
        self.rl_colors = {
            'navy': colors.HexColor(self.colors['navy']),
            'green': colors.HexColor(self.colors['green']),
            'gray': colors.HexColor(self.colors['gray']),
            'light_gray': colors.HexColor(self.colors['light_gray']),
            'white': colors.white
        }
        self._setup_custom_styles()

    def _setup_custom_styles(self):
        self.styles.add(ParagraphStyle(
            name='ReportTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=self.rl_colors['navy'],
            spaceAfter=12,
            fontName='Helvetica-Bold'
        ))
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=self.rl_colors['navy'],
            spaceBefore=15,
            spaceAfter=10,
            fontName='Helvetica-Bold'
        ))
        self.styles.add(ParagraphStyle(
            name='InsightItem',
            parent=self.styles['Normal'],
            fontSize=11,
            leading=16,
            leftIndent=20,
            firstLineIndent=-10,
            spaceBefore=5
        ))
        self.styles.add(ParagraphStyle(
            name='SummaryText',
            parent=self.styles['Normal'],
            fontSize=12,
            leading=18,
            textColor=colors.black,
            spaceAfter=15
        ))

    def draw_molarplus_header(self, canvas, doc):
        """Draw a premium branded header on each page"""
        canvas.saveState()
        canvas.setFillColor(self.rl_colors['navy'])
        canvas.rect(0, 780, 600, 70, fill=1)
        
        # Branding
        canvas.setStrokeColor(colors.white)
        canvas.setLineWidth(2)
        p = canvas.beginPath()
        p.moveTo(40, 820)
        p.lineTo(50, 800)
        p.lineTo(60, 820)
        p.lineTo(70, 800)
        p.lineTo(80, 820)
        canvas.drawPath(p)
        
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 20)
        canvas.drawString(95, 805, "MolarPlus")
        
        canvas.setFont("Helvetica", 10)
        canvas.drawString(95, 792, "Advanced Dental Ecosystem · AI Reports")
        
        canvas.setFont("Helvetica-Bold", 12)
        canvas.drawRightString(555, 805, self.report_data.get('title', 'Clinic Report'))
        canvas.restoreState()

    def get_ai_analysis(self, raw_data: dict, prompt_focus: str):
        """Invoke OpenAI to analyze clinical/financial data"""
        openai_key = os.getenv("OPENAI_API_KEY")
        client = openai.OpenAI(api_key=openai_key)
        
        prompt = f"""
        Role: Senior Dental Clinic Strategist
        Task: Analyze {self.report_data.get('report_category')} data for {self.report_data.get('clinic_name')}.
        Focus: {prompt_focus}
        
        Data to Analyze:
        {json.dumps(raw_data)}
        
        Requirements:
        1. Professional, data-driven tone.
        2. Format output as a JSON object with:
           "summary": A high-level overview (2-3 sentences).
           "insights": 4 specific, actionable data insights.
           "recommendations": 3 clear next steps to improve performance (e.g. increase staffing, audit billing).
           "sentiment": "positive", "neutral", or "needs_attention".
        """
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "system", "content": "You are a professional dental clinic consultant."},
                      {"role": "user", "content": prompt}],
            response_format={ "type": "json_object" }
        )
        return json.loads(response.choices[0].message.content)

    def generate_modern_bar_chart(self, data, labels, title="Comparison"):
        """High-fidelity bar chart with data labels"""
        plt.figure(figsize=(7, 4))
        bars = plt.bar(labels, data, color=self.colors['navy'], alpha=0.9, width=0.6)
        
        plt.title(title, fontsize=14, pad=15, color=self.colors['navy'], fontweight='bold')
        plt.gca().spines['top'].set_visible(False)
        plt.gca().spines['right'].set_visible(False)
        plt.grid(axis='y', linestyle='--', alpha=0.7)
        
        # Add data labels
        for bar in bars:
            yval = bar.get_height()
            plt.text(bar.get_x() + bar.get_width()/2, yval + (yval*0.02), f'{int(yval):,}', 
                     ha='center', va='bottom', fontsize=10, fontweight='bold', color=self.colors['navy'])

        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=200, bbox_inches='tight', transparent=True)
        plt.close()
        img_buffer.seek(0)
        return Image(img_buffer, width=4*inch, height=2.3*inch)

    def generate_modern_donut_chart(self, data, labels, title="Distribution"):
        """High-fidelity donut chart with labels"""
        plt.figure(figsize=(6, 6))
        colors_list = [self.colors['navy'], self.colors['green'], self.colors['gray'], '#c7d2fe']
        
        wedges, texts, autotexts = plt.pie(
            data, labels=labels, autopct='%1.1f%%', startangle=140, 
            colors=colors_list[:len(data)], pctdistance=0.85,
            textprops={'fontsize': 10, 'fontweight': 'bold'}
        )
        
        # Draw center circle for donut
        centre_circle = plt.Circle((0,0), 0.70, fc='white')
        plt.gca().add_artist(centre_circle)
        
        plt.title(title, fontsize=14, pad=15, color=self.colors['navy'], fontweight='bold')
        plt.axis('equal')  

        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=200, bbox_inches='tight', transparent=True)
        plt.close()
        img_buffer.seek(0)
        return Image(img_buffer, width=3.5*inch, height=3.5*inch)

    def generate_modern_line_chart(self, data, labels, title="Trends"):
        """High-fidelity line chart for trends"""
        plt.figure(figsize=(7, 4))
        plt.plot(labels, data, marker='o', linewidth=3, color=self.colors['green'], markerfacecolor=self.colors['navy'])
        
        plt.fill_between(labels, data, color=self.colors['green'], alpha=0.1)
        plt.title(title, fontsize=14, pad=15, color=self.colors['navy'], fontweight='bold')
        plt.gca().spines['top'].set_visible(False)
        plt.gca().spines['right'].set_visible(False)
        plt.grid(linestyle='--', alpha=0.5)
        
        # Labels
        for i, txt in enumerate(data):
            plt.annotate(f'{int(txt)}', (labels[i], data[i]), textcoords="offset points", xytext=(0,10), ha='center', fontsize=9, fontweight='bold')

        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=200, bbox_inches='tight', transparent=True)
        plt.close()
        img_buffer.seek(0)
        return Image(img_buffer, width=4*inch, height=2.3*inch)

    def create_pdf(self, elements, filename):
        """Build the final PDF and upload to R2"""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=100, bottomMargin=50)
        doc.build(elements, onFirstPage=self.draw_molarplus_header, onLaterPages=self.draw_molarplus_header)
        
        temp_path = f"/tmp/{filename}"
        with open(temp_path, "wb") as f:
            f.write(buffer.getvalue())
            
        storage_key = StorageService.upload_report_pdf(temp_path, filename, self.report_data['clinic_id'])
        file_url = f"{os.getenv('R2_PUBLIC_URL', 'https://pub-8d19e4189ab25d9511db91eb129362b5.r2.dev')}/{storage_key}"
        
        os.remove(temp_path)
        return file_url
