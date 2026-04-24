from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.calculations import (
    CalculationComponent,
    CalculationScenario,
    ModuleConfig,
    calculate_metrics,
    calculate_module_metrics,
)
from app.models import ModuleConfiguration, ModuleResult, Project, ProjectComponent, Scenario


def calculate_module_metrics_for_scenario(db: Session, scenario_id: int, module_input: ModuleConfig):
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")

    project = db.query(Project).filter(Project.id == scenario.project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    project_components = (
        db.query(ProjectComponent)
        .options(joinedload(ProjectComponent.component))
        .filter(ProjectComponent.project_id == project.id)
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

    cell_metrics = calculate_metrics(component_inputs, scenario_input)
    metrics = calculate_module_metrics(
        cell_metrics,
        scenario_input,
        module_input,
        project.cell_active_area_m2,
        project.cell_thickness_mm,
    )
    return metrics


def calculate_for_module(db: Session, module_id: int):
    module = db.query(ModuleConfiguration).filter(ModuleConfiguration.id == module_id).first()
    if module is None:
        raise HTTPException(status_code=404, detail="Module not found")

    module_input = ModuleConfig(
        cells_in_series=module.cells_in_series,
        cells_in_parallel=module.cells_in_parallel,
        module_current_a=module.module_current_a,
        mass_overhead_fraction=module.mass_overhead_fraction,
        volume_overhead_fraction=module.volume_overhead_fraction,
        cost_overhead_fraction=module.cost_overhead_fraction,
    )

    metrics = calculate_module_metrics_for_scenario(db, module.scenario_id, module_input)
    stored_fields = set(ModuleResult.__table__.columns.keys()) - {"id", "module_id"}
    stored_metrics = {key: value for key, value in metrics.items() if key in stored_fields}

    result = db.query(ModuleResult).filter(ModuleResult.module_id == module_id).first()
    if result is None:
        result = ModuleResult(module_id=module_id, **stored_metrics)
        db.add(result)
    else:
        for field, value in stored_metrics.items():
            setattr(result, field, value)

    db.commit()
    db.refresh(result)
    return {"id": result.id, "module_id": result.module_id, **metrics}
