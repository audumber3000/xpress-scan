from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import ScanType
from schemas import ScanTypeCreate, ScanTypeUpdate, ScanTypeOut

router = APIRouter()

@router.get("/", response_model=List[ScanTypeOut])
def list_scan_types(db: Session = Depends(get_db)):
    return db.query(ScanType).all()

@router.post("/", response_model=ScanTypeOut, status_code=status.HTTP_201_CREATED)
def create_scan_type(scan_type: ScanTypeCreate, db: Session = Depends(get_db)):
    db_scan_type = ScanType(name=scan_type.name, price=scan_type.price)
    db.add(db_scan_type)
    try:
        db.commit()
        db.refresh(db_scan_type)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Scan type with this name already exists.")
    return db_scan_type

@router.put("/{scan_type_id}", response_model=ScanTypeOut)
def update_scan_type(scan_type_id: int, scan_type: ScanTypeUpdate, db: Session = Depends(get_db)):
    db_scan_type = db.query(ScanType).filter(ScanType.id == scan_type_id).first()
    if not db_scan_type:
        raise HTTPException(status_code=404, detail="Scan type not found")
    if scan_type.name is not None:
        db_scan_type.name = scan_type.name
    if scan_type.price is not None:
        db_scan_type.price = scan_type.price
    db.commit()
    db.refresh(db_scan_type)
    return db_scan_type

@router.delete("/{scan_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scan_type(scan_type_id: int, db: Session = Depends(get_db)):
    db_scan_type = db.query(ScanType).filter(ScanType.id == scan_type_id).first()
    if not db_scan_type:
        raise HTTPException(status_code=404, detail="Scan type not found")
    db.delete(db_scan_type)
    db.commit()
    return None 