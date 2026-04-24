from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Component
from app.schemas import ComponentCreate, ComponentRead, ComponentUpdate

router = APIRouter(prefix="/components", tags=["components"])


@router.post("", response_model=ComponentRead)
def create_component(payload: ComponentCreate, db: Session = Depends(get_db)):
    existing = db.query(Component).filter(Component.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Component name already exists")

    component = Component(**payload.model_dump())
    db.add(component)
    db.commit()
    db.refresh(component)
    return component


@router.get("", response_model=list[ComponentRead])
def list_components(db: Session = Depends(get_db)):
    return db.query(Component).order_by(Component.name.asc()).all()


@router.put("/{component_id}", response_model=ComponentRead)
def update_component(
    component_id: int,
    payload: ComponentUpdate,
    db: Session = Depends(get_db),
):
    component = db.query(Component).filter(Component.id == component_id).first()
    if component is None:
        raise HTTPException(status_code=404, detail="Component not found")

    existing = (
        db.query(Component)
        .filter(Component.name == payload.name, Component.id != component_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Component name already exists")

    for field, value in payload.model_dump().items():
        setattr(component, field, value)

    db.commit()
    db.refresh(component)
    return component


@router.delete("/{component_id}")
def delete_component(component_id: int, db: Session = Depends(get_db)):
    component = db.query(Component).filter(Component.id == component_id).first()
    if component is None:
        raise HTTPException(status_code=404, detail="Component not found")

    db.delete(component)
    db.commit()
    return {"status": "deleted"}
