from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.calculations import CalculationComponent, CalculationScenario, calculate_metrics
from app.models import ProjectComponent, Result, Scenario


def calculate_for_scenario(db: Session, scenario_id: int) -> Result:
    scenario = (
        db.query(Scenario)
        .options(joinedload(Scenario.project))
        .filter(Scenario.id == scenario_id)
        .first()
    )
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")

    project_components = (
        db.query(ProjectComponent)
        .options(joinedload(ProjectComponent.component))
        .filter(ProjectComponent.project_id == scenario.project_id)
        .all()
    )
    if not project_components:
        raise HTTPException(status_code=400, detail="Project has no components")

    component_inputs = [
        CalculationComponent(mass=item.mass, cost_per_kg=item.component.cost_per_kg)
        for item in project_components
    ]
    scenario_input = CalculationScenario(
        avg_discharge_voltage=scenario.avg_discharge_voltage,
        avg_charge_voltage=scenario.avg_charge_voltage,
        discharge_capacity=scenario.discharge_capacity,
        cycle_life=scenario.cycle_life,
        end_of_life_fraction=scenario.end_of_life_fraction,
        electricity_price_eur_per_kwh=scenario.electricity_price_eur_per_kwh,
    )

    metrics = calculate_metrics(component_inputs, scenario_input)

    result = db.query(Result).filter(Result.scenario_id == scenario_id).first()
    if result is None:
        result = Result(scenario_id=scenario_id, **metrics)
        db.add(result)
    else:
        for field, value in metrics.items():
            setattr(result, field, value)

    db.commit()
    db.refresh(result)
    return result
