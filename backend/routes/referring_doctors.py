from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import ReferringDoctor
from schemas import ReferringDoctorCreate, ReferringDoctorUpdate, ReferringDoctorOut

router = APIRouter()

@router.get("/", response_model=List[ReferringDoctorOut])
def list_referring_doctors(db: Session = Depends(get_db)):
    return db.query(ReferringDoctor).all()

@router.post("/", response_model=ReferringDoctorOut, status_code=status.HTTP_201_CREATED)
def create_referring_doctor(doctor: ReferringDoctorCreate, db: Session = Depends(get_db)):
    db_doctor = ReferringDoctor(name=doctor.name, hospital=doctor.hospital)
    db.add(db_doctor)
    try:
        db.commit()
        db.refresh(db_doctor)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Referring doctor with this name already exists.")
    return db_doctor

@router.put("/{doctor_id}", response_model=ReferringDoctorOut)
def update_referring_doctor(doctor_id: int, doctor: ReferringDoctorUpdate, db: Session = Depends(get_db)):
    db_doctor = db.query(ReferringDoctor).filter(ReferringDoctor.id == doctor_id).first()
    if not db_doctor:
        raise HTTPException(status_code=404, detail="Referring doctor not found")
    if doctor.name is not None:
        db_doctor.name = doctor.name
    if doctor.hospital is not None:
        db_doctor.hospital = doctor.hospital
    db.commit()
    db.refresh(db_doctor)
    return db_doctor

@router.delete("/{doctor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_referring_doctor(doctor_id: int, db: Session = Depends(get_db)):
    db_doctor = db.query(ReferringDoctor).filter(ReferringDoctor.id == doctor_id).first()
    if not db_doctor:
        raise HTTPException(status_code=404, detail="Referring doctor not found")
    db.delete(db_doctor)
    db.commit()
    return None 