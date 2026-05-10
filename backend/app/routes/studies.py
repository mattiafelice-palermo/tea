import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import StudyModel, StudyModelPoint
from app.schemas import (
    StudyEvaluateRequest,
    StudyEvaluateResponse,
    StudyModelCreate,
    StudyModelRead,
    StudyModelUpdate,
    StudySweepRequest,
    StudySweepResponse,
)
from app.services.study_service import (
    CELL_METRIC_LABELS,
    MODULE_METRIC_LABELS,
    evaluate_model,
    sweep_model,
)

router = APIRouter(prefix="/study-models", tags=["study-models"])


def model_to_read(model: StudyModel) -> dict:
    try:
        parameters = json.loads(model.parameters_json or "{}")
    except json.JSONDecodeError:
        parameters = {}

    return {
        "id": model.id,
        "name": model.name,
        "kind": model.kind,
        "input_variable": model.input_variable,
        "output_metric": model.output_metric,
        "correlation_type": model.correlation_type,
        "parameters": parameters,
        "points": sorted(model.points, key=lambda point: point.x),
    }


def validate_payload(payload: StudyModelCreate | StudyModelUpdate) -> None:
    if payload.kind not in {"performance", "degradation"}:
        raise HTTPException(status_code=400, detail="Model kind must be performance or degradation")
    if payload.correlation_type not in {"linear", "lookup", "formula"}:
        raise HTTPException(status_code=400, detail="Unsupported correlation type")
    if payload.correlation_type == "lookup" and not payload.points:
        raise HTTPException(status_code=400, detail="Lookup models need at least one point")


@router.get("/metadata")
def get_study_metadata():
    return {
        "performance_inputs": [
            {"value": "raw_material_mass", "label": "Raw material mass"},
            {"value": "component_mass", "label": "Cell component mass"},
        ],
        "performance_outputs": [
            {"value": "avg_discharge_voltage", "label": "Discharge voltage"},
            {"value": "avg_charge_voltage", "label": "Charge voltage"},
            {"value": "discharge_capacity", "label": "Discharge capacity"},
            {"value": "cycle_life", "label": "Cycle life"},
            {"value": "end_of_life_fraction", "label": "EoL fraction"},
            {"value": "mass_overhead_fraction", "label": "Module mass overhead"},
            {"value": "volume_overhead_fraction", "label": "Module volume overhead"},
            {"value": "cost_overhead_fraction", "label": "Module cost overhead"},
        ],
        "degradation_outputs": [
            {"value": "capacity_retention", "label": "Capacity retention"},
            {"value": "discharge_voltage_retention", "label": "Discharge voltage retention"},
            {"value": "energy_retention", "label": "Energy retention"},
        ],
        "cell_metrics": [{"value": key, "label": label} for key, label in CELL_METRIC_LABELS.items()],
        "module_metrics": [
            {"value": key, "label": label} for key, label in MODULE_METRIC_LABELS.items()
        ],
    }


@router.post("", response_model=StudyModelRead)
def create_study_model(payload: StudyModelCreate, db: Session = Depends(get_db)):
    validate_payload(payload)
    model = StudyModel(
        name=payload.name,
        kind=payload.kind,
        input_variable=payload.input_variable,
        output_metric=payload.output_metric,
        correlation_type=payload.correlation_type,
        parameters_json=json.dumps(payload.parameters),
    )
    model.points = [StudyModelPoint(x=point.x, y=point.y) for point in payload.points]
    db.add(model)
    db.commit()
    db.refresh(model)
    model = (
        db.query(StudyModel)
        .options(joinedload(StudyModel.points))
        .filter(StudyModel.id == model.id)
        .first()
    )
    return model_to_read(model)


@router.get("", response_model=list[StudyModelRead])
def list_study_models(kind: str | None = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(StudyModel).options(joinedload(StudyModel.points))
    if kind is not None:
        query = query.filter(StudyModel.kind == kind)
    models = query.order_by(StudyModel.id.desc()).all()
    return [model_to_read(model) for model in models]


@router.put("/{model_id}", response_model=StudyModelRead)
def update_study_model(
    model_id: int,
    payload: StudyModelUpdate,
    db: Session = Depends(get_db),
):
    validate_payload(payload)
    model = (
        db.query(StudyModel)
        .options(joinedload(StudyModel.points))
        .filter(StudyModel.id == model_id)
        .first()
    )
    if model is None:
        raise HTTPException(status_code=404, detail="Study model not found")

    model.name = payload.name
    model.kind = payload.kind
    model.input_variable = payload.input_variable
    model.output_metric = payload.output_metric
    model.correlation_type = payload.correlation_type
    model.parameters_json = json.dumps(payload.parameters)
    model.points = [StudyModelPoint(x=point.x, y=point.y) for point in payload.points]
    db.commit()
    db.refresh(model)
    return model_to_read(model)


@router.delete("/{model_id}")
def delete_study_model(model_id: int, db: Session = Depends(get_db)):
    model = db.query(StudyModel).filter(StudyModel.id == model_id).first()
    if model is None:
        raise HTTPException(status_code=404, detail="Study model not found")

    db.delete(model)
    db.commit()
    return {"status": "deleted"}


@router.post("/{model_id}/evaluate", response_model=StudyEvaluateResponse)
def evaluate_study_model(
    model_id: int,
    payload: StudyEvaluateRequest,
    db: Session = Depends(get_db),
):
    model = (
        db.query(StudyModel)
        .options(joinedload(StudyModel.points))
        .filter(StudyModel.id == model_id)
        .first()
    )
    if model is None:
        raise HTTPException(status_code=404, detail="Study model not found")

    return {"x": payload.x, "y": evaluate_model(model, payload.x)}


@router.post("/sweep", response_model=StudySweepResponse)
def run_study_sweep(payload: StudySweepRequest, db: Session = Depends(get_db)):
    return sweep_model(db, payload)
