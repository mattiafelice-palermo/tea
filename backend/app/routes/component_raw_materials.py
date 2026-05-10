from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Component, ComponentRawMaterial, RawMaterial
from app.schemas import (
    ComponentFormulationRead,
    ComponentRawMaterialCreate,
    ComponentRawMaterialRead,
    ComponentRawMaterialUpdate,
    ComponentRead,
)

router = APIRouter(tags=["component-raw-materials"])


def get_items(component_id: int, db: Session) -> list[ComponentRawMaterial]:
    return (
        db.query(ComponentRawMaterial)
        .options(joinedload(ComponentRawMaterial.raw_material))
        .filter(ComponentRawMaterial.component_id == component_id)
        .order_by(ComponentRawMaterial.id.asc())
        .all()
    )


def ensure_fraction_total(
    component_id: int,
    db: Session,
    new_fraction: float,
    exclude_item_id: int | None = None,
) -> None:
    total = 0.0
    for item in get_items(component_id, db):
        if item.id != exclude_item_id:
            total += item.mass_fraction

    if total + new_fraction > 1.000001:
        raise HTTPException(
            status_code=400,
            detail="Raw material mass fractions cannot exceed 100%",
        )


def normalize_mass_parts(component_id: int, db: Session) -> None:
    items = get_items(component_id, db)
    total_parts = sum(
        item.mass_part if item.mass_part is not None else item.mass_fraction * 100
        for item in items
    )
    if total_parts <= 0:
        raise HTTPException(status_code=400, detail="Mass parts must sum to more than 0")

    for item in items:
        part = item.mass_part if item.mass_part is not None else item.mass_fraction * 100
        item.mass_fraction = part / total_parts


def build_formulation(component_id: int, db: Session) -> dict:
    items = get_items(component_id, db)
    total_fraction = sum(item.mass_fraction for item in items)
    calculated_cost_per_kg = sum(
        item.mass_fraction * item.raw_material.cost_per_kg for item in items
    )
    return {
        "component_id": component_id,
        "items": items,
        "total_fraction": total_fraction,
        "calculated_cost_per_kg": calculated_cost_per_kg,
    }


@router.get("/components/{component_id}/formulation", response_model=ComponentFormulationRead)
def get_component_formulation(component_id: int, db: Session = Depends(get_db)):
    component = db.query(Component).filter(Component.id == component_id).first()
    if component is None:
        raise HTTPException(status_code=404, detail="Component not found")

    return build_formulation(component_id, db)


@router.post("/component-raw-materials", response_model=ComponentRawMaterialRead)
def create_component_raw_material(
    payload: ComponentRawMaterialCreate,
    db: Session = Depends(get_db),
):
    component = db.query(Component).filter(Component.id == payload.component_id).first()
    if component is None:
        raise HTTPException(status_code=404, detail="Component not found")

    raw_material = db.query(RawMaterial).filter(RawMaterial.id == payload.raw_material_id).first()
    if raw_material is None:
        raise HTTPException(status_code=404, detail="Raw material not found")

    existing = (
        db.query(ComponentRawMaterial)
        .filter(
            ComponentRawMaterial.component_id == payload.component_id,
            ComponentRawMaterial.raw_material_id == payload.raw_material_id,
        )
        .first()
    )
    if existing:
        if payload.mass_part is None:
            ensure_fraction_total(
                payload.component_id,
                db,
                payload.mass_fraction,
                exclude_item_id=existing.id,
            )
        existing.mass_fraction = payload.mass_fraction
        existing.mass_part = payload.mass_part
        if payload.mass_part is not None:
            normalize_mass_parts(payload.component_id, db)
        db.commit()
        return (
            db.query(ComponentRawMaterial)
            .options(joinedload(ComponentRawMaterial.raw_material))
            .filter(ComponentRawMaterial.id == existing.id)
            .first()
        )

    if payload.mass_part is None:
        ensure_fraction_total(payload.component_id, db, payload.mass_fraction)

    item = ComponentRawMaterial(**payload.model_dump())
    db.add(item)
    db.flush()
    if payload.mass_part is not None:
        normalize_mass_parts(payload.component_id, db)
    db.commit()
    return (
        db.query(ComponentRawMaterial)
        .options(joinedload(ComponentRawMaterial.raw_material))
        .filter(ComponentRawMaterial.id == item.id)
        .first()
    )


@router.put("/component-raw-materials/{item_id}", response_model=ComponentRawMaterialRead)
def update_component_raw_material(
    item_id: int,
    payload: ComponentRawMaterialUpdate,
    db: Session = Depends(get_db),
):
    item = db.query(ComponentRawMaterial).filter(ComponentRawMaterial.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Component raw material not found")

    if payload.raw_material_id is not None:
        raw_material = db.query(RawMaterial).filter(RawMaterial.id == payload.raw_material_id).first()
        if raw_material is None:
            raise HTTPException(status_code=404, detail="Raw material not found")

        existing = (
            db.query(ComponentRawMaterial)
            .filter(
                ComponentRawMaterial.component_id == item.component_id,
                ComponentRawMaterial.raw_material_id == payload.raw_material_id,
                ComponentRawMaterial.id != item_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail="This raw material is already present in the component",
            )
        item.raw_material_id = payload.raw_material_id

    if payload.mass_part is None:
        ensure_fraction_total(
            item.component_id,
            db,
            payload.mass_fraction,
            exclude_item_id=item.id,
        )

    item.mass_fraction = payload.mass_fraction
    item.mass_part = payload.mass_part
    if payload.mass_part is not None:
        normalize_mass_parts(item.component_id, db)
    db.commit()
    return (
        db.query(ComponentRawMaterial)
        .options(joinedload(ComponentRawMaterial.raw_material))
        .filter(ComponentRawMaterial.id == item_id)
        .first()
    )


@router.delete("/component-raw-materials/{item_id}")
def delete_component_raw_material(item_id: int, db: Session = Depends(get_db)):
    item = db.query(ComponentRawMaterial).filter(ComponentRawMaterial.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Component raw material not found")

    db.delete(item)
    db.commit()
    return {"status": "deleted"}


@router.post("/components/{component_id}/use-calculated-cost", response_model=ComponentRead)
def use_calculated_component_cost(component_id: int, db: Session = Depends(get_db)):
    component = db.query(Component).filter(Component.id == component_id).first()
    if component is None:
        raise HTTPException(status_code=404, detail="Component not found")

    formulation = build_formulation(component_id, db)
    if not formulation["items"]:
        raise HTTPException(status_code=400, detail="Component has no raw material formulation")

    component.cost_per_kg = formulation["calculated_cost_per_kg"]
    db.commit()
    db.refresh(component)
    return component
