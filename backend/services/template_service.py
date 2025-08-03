import os
from typing import Dict, Any
from datetime import datetime

class TemplateService:
    def __init__(self):
        self.templates_dir = "templates"
    
    def load_template(self, template_name: str) -> str:
        """
        Load HTML template from file
        
        Args:
            template_name: Name of the template file (e.g., 'radiology_template.html')
            
        Returns:
            Template content as string
        """
        template_path = os.path.join(self.templates_dir, template_name)
        
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Template not found: {template_path}")
        
        with open(template_path, 'r', encoding='utf-8') as file:
            return file.read()
    
    def fill_template(self, template_content: str, data: Dict[str, Any]) -> str:
        """
        Fill template with data by replacing placeholders
        
        Args:
            template_content: HTML template content
            data: Dictionary with data to fill in
            
        Returns:
            Filled template as string
        """
        filled_content = template_content
        
        # Replace all placeholders with actual data
        for key, value in data.items():
            placeholder = f"{{{{{key}}}}}"
            filled_content = filled_content.replace(placeholder, str(value))
        
        return filled_content
    
    def render_report(self, template_name: str, patient_data: Dict[str, Any], report_content: str) -> str:
        """
        Render a complete report from template
        
        Args:
            template_name: Name of the template to use
            patient_data: Patient information dictionary
            report_content: The report findings/conclusion content
            
        Returns:
            Complete HTML report
        """
        # Load template
        template_content = self.load_template(template_name)
        
        # Prepare data for template
        template_data = {
            'clinic_name': patient_data.get('clinic_name', 'Radiology Clinic'),
            'name': patient_data.get('name', 'N/A'),
            'age': patient_data.get('age', 'N/A'),
            'gender': patient_data.get('gender', 'N/A'),
            'scan_type': patient_data.get('scan_type', 'N/A'),
            'referred_by': patient_data.get('referred_by', 'N/A'),
            'village': patient_data.get('village', 'N/A'),
            'phone': patient_data.get('phone', 'N/A'),
            'todays_date': datetime.now().strftime('%B %d, %Y'),
            'doctor_name': patient_data.get('doctor_name', 'Dr. Radiologist'),
            'patient_id': patient_data.get('id', 'N/A'),
            'transcript': report_content  # Use transcript as the main content
        }
        
        # Fill template
        return self.fill_template(template_content, template_data)
    
    def list_templates(self) -> list:
        """
        List all available templates
        
        Returns:
            List of template names
        """
        if not os.path.exists(self.templates_dir):
            return []
        
        templates = []
        for file in os.listdir(self.templates_dir):
            if file.endswith('.html'):
                templates.append(file)
        
        return templates 