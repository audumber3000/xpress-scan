"""
WhatsApp Group Management Routes
Modular routes for group management features
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models import User
import os
import requests
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(tags=["WhatsApp Groups"])

# WhatsApp Service URL (Node.js service)
WHATSAPP_SERVICE_URL = os.getenv("WHATSAPP_SERVICE_URL", "http://localhost:3001")


# Pydantic schemas
class CreateGroupRequest(BaseModel):
    name: str
    participants: List[str]


class InviteUserRequest(BaseModel):
    participant: str


class UpdateGroupSubjectRequest(BaseModel):
    subject: str


class UpdateGroupDescriptionRequest(BaseModel):
    description: str


@router.post("/create")
async def create_group(
    request: CreateGroupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new WhatsApp group"""
    try:
        response = requests.post(
            f"{WHATSAPP_SERVICE_URL}/api/group/create/{current_user.id}",
            json={
                "name": request.name,
                "participants": request.participants
            },
            timeout=60
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            error_data = response.json() if response.text else {}
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_data.get("error", f"Service returned status {response.status_code}")
            )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to WhatsApp service: {str(e)}"
        )


@router.get("/list")
async def get_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all groups for the current user"""
    try:
        response = requests.get(
            f"{WHATSAPP_SERVICE_URL}/api/groups/{current_user.id}",
            timeout=30
        )
        
        # Always return 200 with consistent structure
        if response.status_code == 200:
            data = response.json()
            # Ensure consistent structure
            if "groups" in data:
                return data
            else:
                # If error response but status 200, return empty groups
                return {"groups": [], "total": 0, "error": data.get("error", "Unknown error")}
        elif response.status_code == 400:
            # Session not ready - return empty groups
            error_data = response.json() if response.text else {}
            return {"groups": [], "total": 0, "error": error_data.get("error", "WhatsApp session not ready")}
        else:
            # Return empty groups instead of error
            error_data = response.json() if response.text else {}
            return {"groups": [], "total": 0, "error": error_data.get("error", f"Service returned status {response.status_code}")}
    except requests.exceptions.RequestException as e:
        # Return empty groups instead of raising exception
        return {"groups": [], "total": 0, "error": f"Failed to connect to WhatsApp service: {str(e)}"}
    except Exception as e:
        return {"groups": [], "total": 0, "error": str(e)}


@router.get("/{groupId}")
async def get_group_info(
    groupId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed information about a group"""
    try:
        response = requests.get(
            f"{WHATSAPP_SERVICE_URL}/api/group/{current_user.id}/{groupId}",
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            error_data = response.json() if response.text else {}
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_data.get("error", f"Service returned status {response.status_code}")
            )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to WhatsApp service: {str(e)}"
        )


@router.post("/{groupId}/invite")
async def invite_user_to_group(
    groupId: str,
    request: InviteUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Invite a user to a group"""
    try:
        response = requests.post(
            f"{WHATSAPP_SERVICE_URL}/api/group/invite/{current_user.id}/{groupId}",
            json={"participant": request.participant},
            timeout=60
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            error_data = response.json() if response.text else {}
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_data.get("error", f"Service returned status {response.status_code}")
            )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to WhatsApp service: {str(e)}"
        )


@router.post("/{groupId}/make-admin")
async def make_user_admin(
    groupId: str,
    request: InviteUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Make a user admin in a group"""
    try:
        response = requests.post(
            f"{WHATSAPP_SERVICE_URL}/api/group/make-admin/{current_user.id}/{groupId}",
            json={"participant": request.participant},
            timeout=60
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            error_data = response.json() if response.text else {}
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_data.get("error", f"Service returned status {response.status_code}")
            )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to WhatsApp service: {str(e)}"
        )


@router.post("/{groupId}/demote-admin")
async def demote_admin(
    groupId: str,
    request: InviteUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Demote an admin in a group"""
    try:
        response = requests.post(
            f"{WHATSAPP_SERVICE_URL}/api/group/demote-admin/{current_user.id}/{groupId}",
            json={"participant": request.participant},
            timeout=60
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            error_data = response.json() if response.text else {}
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_data.get("error", f"Service returned status {response.status_code}")
            )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to WhatsApp service: {str(e)}"
        )


@router.post("/{groupId}/leave")
async def leave_group(
    groupId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Leave a group"""
    try:
        response = requests.post(
            f"{WHATSAPP_SERVICE_URL}/api/group/leave/{current_user.id}/{groupId}",
            timeout=60
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            error_data = response.json() if response.text else {}
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_data.get("error", f"Service returned status {response.status_code}")
            )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to WhatsApp service: {str(e)}"
        )


@router.post("/{groupId}/update-subject")
async def update_group_subject(
    groupId: str,
    request: UpdateGroupSubjectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update group subject/name"""
    try:
        response = requests.post(
            f"{WHATSAPP_SERVICE_URL}/api/group/update-subject/{current_user.id}/{groupId}",
            json={"subject": request.subject},
            timeout=60
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            error_data = response.json() if response.text else {}
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_data.get("error", f"Service returned status {response.status_code}")
            )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to WhatsApp service: {str(e)}"
        )


@router.post("/{groupId}/update-description")
async def update_group_description(
    groupId: str,
    request: UpdateGroupDescriptionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update group description"""
    try:
        response = requests.post(
            f"{WHATSAPP_SERVICE_URL}/api/group/update-description/{current_user.id}/{groupId}",
            json={"description": request.description},
            timeout=60
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            error_data = response.json() if response.text else {}
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_data.get("error", f"Service returned status {response.status_code}")
            )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to WhatsApp service: {str(e)}"
        )


@router.get("/{groupId}/invite-code")
async def get_group_invite_code(
    groupId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get group invite code/link"""
    try:
        response = requests.get(
            f"{WHATSAPP_SERVICE_URL}/api/group/invite-code/{current_user.id}/{groupId}",
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            error_data = response.json() if response.text else {}
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_data.get("error", f"Service returned status {response.status_code}")
            )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to WhatsApp service: {str(e)}"
        )

