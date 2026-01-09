from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models import User
from services.sync_service import sync_all_tables, sync_table, get_last_sync_time
from typing import Dict, Any, Optional
from datetime import datetime

router = APIRouter()

@router.post("/full")
async def full_sync(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Perform full sync of all tables for the current user's clinic
    Called on app startup
    """
    if not current_user.clinic_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be associated with a clinic to sync"
        )
    
    try:
        results = sync_all_tables(current_user.id, current_user.clinic_id)
        return {
            "success": True,
            "message": "Full sync completed",
            "results": results
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {str(e)}"
        )

@router.post("/incremental")
async def incremental_sync(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Perform incremental sync (only changed records since last sync)
    Called periodically in background
    """
    if not current_user.clinic_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be associated with a clinic to sync"
        )
    
    try:
        results = sync_all_tables(current_user.id, current_user.clinic_id)
        return {
            "success": True,
            "message": "Incremental sync completed",
            "results": results
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {str(e)}"
        )

@router.get("/status")
async def get_sync_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get sync status and last sync times for all tables
    """
    if not current_user.clinic_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be associated with a clinic"
        )
    
    from services.sync_service import SYNC_TABLES
    
    status_data = {
        "clinic_id": current_user.clinic_id,
        "tables": {}
    }
    
    for table in SYNC_TABLES:
        try:
            last_sync = get_last_sync_time(table, current_user.id, current_user.clinic_id, db)
            status_data["tables"][table] = {
                "last_synced_at": last_sync.isoformat() if last_sync else None,
                "synced": last_sync is not None
            }
        except Exception as e:
            status_data["tables"][table] = {
                "error": str(e)
            }
    
    return status_data

@router.post("/table/{table_name}")
async def sync_specific_table(
    table_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sync a specific table
    """
    if not current_user.clinic_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be associated with a clinic to sync"
        )
    
    from services.sync_service import SYNC_TABLES
    
    if table_name not in SYNC_TABLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Table {table_name} is not syncable"
        )
    
    try:
        stats = sync_table(table_name, current_user.id, current_user.clinic_id)
        return {
            "success": True,
            "message": f"Synced {table_name}",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {str(e)}"
        )






