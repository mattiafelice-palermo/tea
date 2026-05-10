from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ComponentRawMaterial, RawMaterial
from app.schemas import RawMaterialCreate, RawMaterialRead, RawMaterialUpdate

router = APIRouter(prefix="/raw-materials", tags=["raw-materials"])


@router.post("", response_model=RawMaterialRead)
def create_raw_material(payload: RawMaterialCreate, db: Session = Depends(get_db)):
    existing = db.query(RawMaterial).filter(RawMaterial.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Raw material name already exists")

    raw_material = RawMaterial(**payload.model_dump())
    db.add(raw_material)
    db.commit()
    db.refresh(raw_material)
    return raw_material


@router.get("", response_model=list[RawMaterialRead])
def list_raw_materials(db: Session = Depends(get_db)):
    return db.query(RawMaterial).order_by(RawMaterial.name.asc()).all()


@router.put("/{raw_material_id}", response_model=RawMaterialRead)
def update_raw_material(
    raw_material_id: int,
    payload: RawMaterialUpdate,
    db: Session = Depends(get_db),
):
    raw_material = db.query(RawMaterial).filter(RawMaterial.id == raw_material_id).first()
    if raw_material is None:
        raise HTTPException(status_code=404, detail="Raw material not found")

    existing = (
        db.query(RawMaterial)
        .filter(RawMaterial.name == payload.name, RawMaterial.id != raw_material_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Raw material name already exists")

    raw_material.name = payload.name
    raw_material.cost_per_kg = payload.cost_per_kg
    db.commit()
    db.refresh(raw_material)
    return raw_material


@router.delete("/{raw_material_id}")
def delete_raw_material(raw_material_id: int, db: Session = Depends(get_db)):
    raw_material = db.query(RawMaterial).filter(RawMaterial.id == raw_material_id).first()
    if raw_material is None:
        raise HTTPException(status_code=404, detail="Raw material not found")

    used = (
        db.query(ComponentRawMaterial)
        .filter(ComponentRawMaterial.raw_material_id == raw_material_id)
        .first()
    )
    if used:
        raise HTTPException(
            status_code=400,
            detail="Raw material is used in a component formulation",
        )

    db.delete(raw_material)
    db.commit()
    return {"status": "deleted"}
