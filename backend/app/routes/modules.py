from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.calculations import ModuleConfig
from app.database import get_db
from app.models import ModuleConfiguration, Scenario
from app.schemas import (
    ModuleConfigurationCreate,
    ModuleConfigurationRead,
    ModuleMetricsRead,
    ModulePreviewRequest,
    ModuleConfigurationUpdate,
    ModuleResultRead,
)
from app.services.module_calculation_service import calculate_for_module, calculate_module_metrics_for_scenario

router = APIRouter(prefix="/modules", tags=["modules"])


@router.post("", response_model=ModuleConfigurationRead)
def create_module(payload: ModuleConfigurationCreate, db: Session = Depends(get_db)):
    scenario = db.query(Scenario).filter(Scenario.id == payload.scenario_id).first()
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")

    module = ModuleConfiguration(**payload.model_dump())
    db.add(module)
    db.commit()
    db.refresh(module)
    return module


@router.get("", response_model=list[ModuleConfigurationRead])
def list_modules(scenario_id: int | None = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(ModuleConfiguration)
    if scenario_id is not None:
        query = query.filter(ModuleConfiguration.scenario_id == scenario_id)
    return query.order_by(ModuleConfiguration.id.desc()).all()


@router.put("/{module_id}", response_model=ModuleConfigurationRead)
def update_module(
    module_id: int,
    payload: ModuleConfigurationUpdate,
    db: Session = Depends(get_db),
):
    module = db.query(ModuleConfiguration).filter(ModuleConfiguration.id == module_id).first()
    if module is None:
        raise HTTPException(status_code=404, detail="Module not found")

    data = payload.model_dump(exclude_none=True)
    if "scenario_id" in data:
        scenario = db.query(Scenario).filter(Scenario.id == data["scenario_id"]).first()
        if scenario is None:
            raise HTTPException(status_code=404, detail="Scenario not found")

    for field, value in data.items():
        setattr(module, field, value)

    db.commit()
    db.refresh(module)
    return module


@router.delete("/{module_id}")
def delete_module(module_id: int, db: Session = Depends(get_db)):
    module = db.query(ModuleConfiguration).filter(ModuleConfiguration.id == module_id).first()
    if module is None:
        raise HTTPException(status_code=404, detail="Module not found")

    db.delete(module)
    db.commit()
    return {"status": "deleted"}


@router.post("/{module_id}/calculate", response_model=ModuleResultRead)
def calculate_module(module_id: int, db: Session = Depends(get_db)):
    return calculate_for_module(db, module_id)


@router.post("/preview", response_model=ModuleMetricsRead)
def preview_module(payload: ModulePreviewRequest, db: Session = Depends(get_db)):
    module_input = ModuleConfig(
        cells_in_series=payload.cells_in_series,
        cells_in_parallel=payload.cells_in_parallel,
        module_current_a=payload.module_current_a,
        mass_overhead_fraction=payload.mass_overhead_fraction,
        volume_overhead_fraction=payload.volume_overhead_fraction,
        cost_overhead_fraction=payload.cost_overhead_fraction,
    )
    return calculate_module_metrics_for_scenario(db, payload.scenario_id, module_input)
