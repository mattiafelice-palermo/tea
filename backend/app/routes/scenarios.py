from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, Scenario
from app.schemas import ScenarioCreate, ScenarioRead, ScenarioUpdate

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.post("", response_model=ScenarioRead)
def create_scenario(payload: ScenarioCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == payload.project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    scenario = Scenario(**payload.model_dump())
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario


@router.get("", response_model=list[ScenarioRead])
def list_scenarios(project_id: int | None = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(Scenario)
    if project_id is not None:
        query = query.filter(Scenario.project_id == project_id)
    return query.order_by(Scenario.id.desc()).all()


@router.put("/{scenario_id}", response_model=ScenarioRead)
def update_scenario(
    scenario_id: int,
    payload: ScenarioUpdate,
    db: Session = Depends(get_db),
):
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")

    for field, value in payload.model_dump().items():
        setattr(scenario, field, value)

    db.commit()
    db.refresh(scenario)
    return scenario


@router.delete("/{scenario_id}")
def delete_scenario(scenario_id: int, db: Session = Depends(get_db)):
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")

    db.delete(scenario)
    db.commit()
    return {"status": "deleted"}
