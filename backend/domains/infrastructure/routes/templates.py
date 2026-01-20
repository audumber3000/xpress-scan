from fastapi import APIRouter, HTTPException
from domains.infrastructure.services.template_service import TemplateService
import os

router = APIRouter()

@router.get("/")
def list_templates():
    """List all available report templates - Public endpoint"""
    try:
        template_service = TemplateService()
        templates = template_service.list_templates()
        
        return {
            "templates": templates,
            "total": len(templates)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{template_name}")
def get_template(template_name: str):
    """Get a specific template content - Public endpoint"""
    try:
        template_service = TemplateService()
        template_content = template_service.load_template(template_name)
        
        return {
            "template_name": template_name,
            "content": template_content
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Template not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{template_name}")
def update_template(template_name: str, template_data: dict):
    """Update a template content - Public endpoint"""
    try:
        template_service = TemplateService()
        content = template_data.get("content", "")
        
        if not content:
            raise HTTPException(status_code=400, detail="Template content is required")
        
        # Save template to file
        template_path = os.path.join(template_service.templates_dir, template_name)
        with open(template_path, 'w', encoding='utf-8') as file:
            file.write(content)
        
        return {
            "template_name": template_name,
            "message": "Template updated successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 