import ast
import json
import math

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.calculations import (
    CalculationComponent,
    CalculationScenario,
    ModuleConfig,
    calculate_metrics,
    calculate_module_metrics,
)
from app.models import ComponentRawMaterial, ModuleConfiguration, Project, ProjectComponent, Scenario, StudyModel


CELL_METRIC_LABELS = {
    "total_mass": "Total mass",
    "total_cost": "Total cost",
    "energy_wh": "Energy",
    "specific_energy": "Specific energy",
    "round_trip_efficiency": "Round-trip efficiency",
    "lifetime_energy": "Lifetime energy",
    "cost_per_kwh": "Cost per kWh",
    "cost_per_kwh_cycle": "Cost per kWh-cycle",
    "cost_per_lifetime_kwh": "Cost per lifetime kWh",
    "lcos": "LCOS",
}

MODULE_METRIC_LABELS = {
    "module_voltage_v": "Module voltage",
    "module_capacity_ah": "Module capacity",
    "module_energy_wh": "Module energy",
    "module_power_w": "Module power",
    "discharge_time_h": "Discharge time",
    "cell_current_a": "Cell current",
    "cell_current_density_ma_per_cm2": "Cell current density",
    "module_mass_kg": "Module mass",
    "module_volume_l": "Module volume",
    "module_cost": "Module cost",
    "module_specific_energy_wh_per_kg": "Module Wh/kg",
    "module_volumetric_energy_wh_per_l": "Module Wh/L",
    "module_specific_power_w_per_kg": "Module W/kg",
    "module_volumetric_power_w_per_l": "Module W/L",
    "module_cost_per_kwh": "Module cost per kWh",
    "module_cost_per_lifetime_kwh": "Module cost per lifetime kWh",
    "module_lcos": "Module LCOS",
}

SCENARIO_OUTPUTS = {
    "avg_discharge_voltage",
    "avg_charge_voltage",
    "discharge_capacity",
    "cycle_life",
    "end_of_life_fraction",
    "electricity_price_eur_per_kwh",
}

MODULE_OUTPUTS = {
    "cells_in_series",
    "cells_in_parallel",
    "module_current_a",
    "mass_overhead_fraction",
    "volume_overhead_fraction",
    "cost_overhead_fraction",
}

DEGRADATION_OUTPUTS = {
    "capacity_retention",
    "discharge_voltage_retention",
    "energy_retention",
}


def parse_parameters(model: StudyModel) -> dict:
    try:
        return json.loads(model.parameters_json or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Model parameters are invalid") from exc


def evaluate_lookup(points, x: float) -> float:
    if not points:
        raise HTTPException(status_code=400, detail="Lookup model needs at least one point")

    ordered = sorted(points, key=lambda point: point.x)
    if x <= ordered[0].x:
        return ordered[0].y
    if x >= ordered[-1].x:
        return ordered[-1].y

    for left, right in zip(ordered, ordered[1:]):
        if left.x <= x <= right.x:
            if right.x == left.x:
                return right.y
            fraction = (x - left.x) / (right.x - left.x)
            return left.y + fraction * (right.y - left.y)

    return ordered[-1].y


def evaluate_formula(expression: str, x: float) -> float:
    allowed_names = {"x": x, "sqrt": math.sqrt, "log": math.log, "exp": math.exp, "pow": pow}
    allowed_nodes = (
        ast.Expression,
        ast.BinOp,
        ast.UnaryOp,
        ast.Call,
        ast.Load,
        ast.Name,
        ast.Constant,
        ast.Add,
        ast.Sub,
        ast.Mult,
        ast.Div,
        ast.Pow,
        ast.USub,
        ast.UAdd,
    )
    tree = ast.parse(expression, mode="eval")
    for node in ast.walk(tree):
        if not isinstance(node, allowed_nodes):
            raise HTTPException(status_code=400, detail="Formula contains unsupported syntax")
        if isinstance(node, ast.Name) and node.id not in allowed_names:
            raise HTTPException(status_code=400, detail=f"Formula name '{node.id}' is not allowed")

    return float(eval(compile(tree, "<study-formula>", "eval"), {"__builtins__": {}}, allowed_names))


def evaluate_model(model: StudyModel, x: float) -> float:
    parameters = parse_parameters(model)
    if model.correlation_type == "linear":
        slope = float(parameters.get("slope", 1.0))
        intercept = float(parameters.get("intercept", 0.0))
        return intercept + slope * x
    if model.correlation_type == "lookup":
        return evaluate_lookup(model.points, x)
    if model.correlation_type == "formula":
        expression = str(parameters.get("expression", "x"))
        return evaluate_formula(expression, x)

    raise HTTPException(status_code=400, detail="Unsupported correlation type")


def build_scenario_input(scenario: Scenario, overrides: dict) -> CalculationScenario:
    values = {
        "avg_discharge_voltage": scenario.avg_discharge_voltage,
        "avg_charge_voltage": scenario.avg_charge_voltage,
        "discharge_capacity": scenario.discharge_capacity,
        "cycle_life": scenario.cycle_life,
        "end_of_life_fraction": scenario.end_of_life_fraction,
        "electricity_price_eur_per_kwh": scenario.electricity_price_eur_per_kwh,
    }
    values.update({key: value for key, value in overrides.items() if key in values})
    values["cycle_life"] = int(round(values["cycle_life"]))
    return CalculationScenario(**values)


def build_module_input(module: ModuleConfiguration, overrides: dict) -> ModuleConfig:
    values = {
        "cells_in_series": module.cells_in_series,
        "cells_in_parallel": module.cells_in_parallel,
        "module_current_a": module.module_current_a,
        "mass_overhead_fraction": module.mass_overhead_fraction,
        "volume_overhead_fraction": module.volume_overhead_fraction,
        "cost_overhead_fraction": module.cost_overhead_fraction,
    }
    values.update({key: value for key, value in overrides.items() if key in values})
    values["cells_in_series"] = max(1, int(round(values["cells_in_series"])))
    values["cells_in_parallel"] = max(1, int(round(values["cells_in_parallel"])))
    return ModuleConfig(**values)


def load_base_inputs(db: Session, scenario_id: int):
    scenario = (
        db.query(Scenario)
        .options(joinedload(Scenario.project))
        .filter(Scenario.id == scenario_id)
        .first()
    )
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")

    project = db.query(Project).filter(Project.id == scenario.project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    project_components = (
        db.query(ProjectComponent)
        .options(joinedload(ProjectComponent.component))
        .filter(ProjectComponent.project_id == scenario.project_id)
        .all()
    )
    if not project_components:
        raise HTTPException(status_code=400, detail="Cell definition has no components")

    return scenario, project, project_components


def component_calculation_inputs(project_components: list[ProjectComponent]) -> list[CalculationComponent]:
    return [
        CalculationComponent(mass=item.mass, cost_per_kg=item.component.cost_per_kg)
        for item in project_components
    ]


def adjusted_calculation_inputs(
    db: Session,
    project_components: list[ProjectComponent],
    model: StudyModel,
    x_delta: float,
) -> list[CalculationComponent]:
    parameters = parse_parameters(model)
    variation_mode = str(parameters.get("variation_mode", "additive"))
    input_variable = model.input_variable

    if model.kind != "performance":
        return component_calculation_inputs(project_components)

    if input_variable.startswith("component_mass:"):
        return adjust_component_mass(project_components, input_variable, variation_mode, parameters, x_delta)

    if input_variable.startswith("raw_material_mass:"):
        return adjust_raw_material_mass(db, project_components, input_variable, variation_mode, parameters, x_delta)

    return component_calculation_inputs(project_components)


def adjust_component_mass(
    project_components: list[ProjectComponent],
    input_variable: str,
    variation_mode: str,
    parameters: dict,
    x_delta: float,
) -> list[CalculationComponent]:
    target_component_id = int(input_variable.split(":")[1])
    total_mass = sum(item.mass for item in project_components)
    masses = {item.component_id: item.mass for item in project_components}
    target_delta = x_delta if variation_mode == "additive" else total_mass * (x_delta / 100)

    if target_component_id not in masses:
        raise HTTPException(status_code=400, detail="Selected component is not in the cell")

    masses[target_component_id] += target_delta
    if variation_mode == "replace_specific":
        replacement = str(parameters.get("replacement_variable", ""))
        if not replacement.startswith("component_mass:"):
            raise HTTPException(status_code=400, detail="Choose a replacement component")
        replacement_component_id = int(replacement.split(":")[1])
        if replacement_component_id not in masses or replacement_component_id == target_component_id:
            raise HTTPException(status_code=400, detail="Replacement component is unavailable")
        masses[replacement_component_id] -= target_delta
    elif variation_mode == "rescale_others":
        other_ids = [item.component_id for item in project_components if item.component_id != target_component_id]
        other_mass = sum(masses[component_id] for component_id in other_ids)
        if other_mass <= 0:
            raise HTTPException(status_code=400, detail="No component mass is available for rescaling")
        for component_id in other_ids:
            masses[component_id] -= target_delta * (masses[component_id] / other_mass)

    if any(mass <= 0 for mass in masses.values()):
        raise HTTPException(status_code=400, detail="Study point creates a non-positive component mass")

    return [
        CalculationComponent(mass=masses[item.component_id], cost_per_kg=item.component.cost_per_kg)
        for item in project_components
    ]


def load_component_formulation(db: Session, component_id: int) -> list[ComponentRawMaterial]:
    return (
        db.query(ComponentRawMaterial)
        .options(joinedload(ComponentRawMaterial.raw_material))
        .filter(ComponentRawMaterial.component_id == component_id)
        .all()
    )


def adjust_raw_material_mass(
    db: Session,
    project_components: list[ProjectComponent],
    input_variable: str,
    variation_mode: str,
    parameters: dict,
    x_delta: float,
) -> list[CalculationComponent]:
    _prefix, component_id_text, raw_material_id_text = input_variable.split(":")
    component_id = int(component_id_text)
    raw_material_id = int(raw_material_id_text)
    target_component = next((item for item in project_components if item.component_id == component_id), None)
    if target_component is None:
        raise HTTPException(status_code=400, detail="Selected component is not in the cell")

    formulation = load_component_formulation(db, component_id)
    if not formulation:
        raise HTTPException(status_code=400, detail="Selected component has no raw material formulation")

    raw_masses = {
        item.raw_material_id: target_component.mass * item.mass_fraction for item in formulation
    }
    if raw_material_id not in raw_masses:
        raise HTTPException(status_code=400, detail="Selected raw material is not in the component")

    component_mass = target_component.mass
    target_delta = x_delta if variation_mode == "additive" else component_mass * (x_delta / 100)
    raw_masses[raw_material_id] += target_delta

    if variation_mode == "replace_specific":
        replacement = str(parameters.get("replacement_variable", ""))
        if not replacement.startswith("raw_material_mass:"):
            raise HTTPException(status_code=400, detail="Choose a replacement raw material")
        _replacement_prefix, replacement_component_id, replacement_raw_id = replacement.split(":")
        if int(replacement_component_id) != component_id:
            raise HTTPException(status_code=400, detail="Raw material replacement must stay within the same component")
        replacement_raw_material_id = int(replacement_raw_id)
        if replacement_raw_material_id not in raw_masses or replacement_raw_material_id == raw_material_id:
            raise HTTPException(status_code=400, detail="Replacement raw material is unavailable")
        raw_masses[replacement_raw_material_id] -= target_delta
    elif variation_mode == "rescale_others":
        other_ids = [item.raw_material_id for item in formulation if item.raw_material_id != raw_material_id]
        other_mass = sum(raw_masses[item_id] for item_id in other_ids)
        if other_mass <= 0:
            raise HTTPException(status_code=400, detail="No raw material mass is available for rescaling")
        for item_id in other_ids:
            raw_masses[item_id] -= target_delta * (raw_masses[item_id] / other_mass)

    if any(mass < 0 for mass in raw_masses.values()):
        raise HTTPException(status_code=400, detail="Study point creates a negative raw material mass")

    adjusted = []
    for item in project_components:
        if item.component_id != component_id:
            adjusted.append(CalculationComponent(mass=item.mass, cost_per_kg=item.component.cost_per_kg))
            continue

        new_mass = item.mass + (target_delta if variation_mode == "additive" else 0)
        if variation_mode == "additive":
            target_raw_material = next(
                formulation_item.raw_material
                for formulation_item in formulation
                if formulation_item.raw_material_id == raw_material_id
            )
            raw_cost = item.mass * item.component.cost_per_kg + target_delta * target_raw_material.cost_per_kg
        else:
            raw_cost = sum(
                raw_masses[formulation_item.raw_material_id] * formulation_item.raw_material.cost_per_kg
                for formulation_item in formulation
            )
        if new_mass <= 0:
            raise HTTPException(status_code=400, detail="Study point creates a non-positive component mass")
        adjusted.append(CalculationComponent(mass=new_mass, cost_per_kg=raw_cost / new_mass))

    return adjusted


def baseline_output_value(scenario: Scenario, module: ModuleConfiguration | None, output_metric: str) -> float:
    if output_metric in SCENARIO_OUTPUTS:
        return float(getattr(scenario, output_metric))
    if output_metric in MODULE_OUTPUTS and module is not None:
        return float(getattr(module, output_metric))
    return 0.0


def apply_degradation(metrics: dict, scenario_input: CalculationScenario, degradation_model: StudyModel) -> dict:
    if degradation_model.output_metric not in DEGRADATION_OUTPUTS:
        raise HTTPException(status_code=400, detail="Selected degradation model has unsupported target")

    eol_factor = max(0.0, evaluate_model(degradation_model, scenario_input.cycle_life))
    avg_factor = (1 + eol_factor) / 2
    lifetime_energy = metrics["energy_wh"] * scenario_input.cycle_life * avg_factor
    metrics["lifetime_energy"] = lifetime_energy
    metrics["cost_per_lifetime_kwh"] = (
        metrics["total_cost"] / (lifetime_energy / 1000) if lifetime_energy else 0.0
    )
    metrics["cost_per_kwh_cycle"] = (
        metrics["total_cost"] / ((metrics["energy_wh"] / 1000) * scenario_input.cycle_life)
        if metrics["energy_wh"] and scenario_input.cycle_life
        else 0.0
    )
    lifetime_delivered_kwh = lifetime_energy / 1000 if lifetime_energy else 0.0
    lifetime_charge_input_kwh = (
        lifetime_delivered_kwh / metrics["round_trip_efficiency"]
        if metrics["round_trip_efficiency"]
        else 0.0
    )
    charging_cost = lifetime_charge_input_kwh * scenario_input.electricity_price_eur_per_kwh
    metrics["lcos"] = (
        (metrics["total_cost"] + charging_cost) / lifetime_delivered_kwh
        if lifetime_delivered_kwh
        else 0.0
    )
    return metrics


def calculate_sweep_point(
    db: Session,
    model: StudyModel,
    scenario_id: int,
    module_id: int | None,
    degradation_model: StudyModel | None,
    x: float,
) -> tuple[float, dict]:
    model_output = evaluate_model(model, x)
    scenario, project, project_components = load_base_inputs(db, scenario_id)

    scenario_overrides = {}
    module_overrides = {}
    module = None
    if module_id is not None:
        module = db.query(ModuleConfiguration).filter(ModuleConfiguration.id == module_id).first()
        if module is None:
            raise HTTPException(status_code=404, detail="Module not found")

    if model.output_metric in SCENARIO_OUTPUTS:
        scenario_overrides[model.output_metric] = (
            baseline_output_value(scenario, module, model.output_metric) + model_output
        )
    elif model.output_metric in MODULE_OUTPUTS and module is not None:
        module_overrides[model.output_metric] = (
            baseline_output_value(scenario, module, model.output_metric) + model_output
        )

    scenario_input = build_scenario_input(scenario, scenario_overrides)
    components = adjusted_calculation_inputs(db, project_components, model, x)
    cell_metrics = calculate_metrics(components, scenario_input)
    if degradation_model is not None:
        cell_metrics = apply_degradation(cell_metrics, scenario_input, degradation_model)

    metrics = dict(cell_metrics)
    if module is not None:
        module_input = build_module_input(module, module_overrides)
        module_metrics = calculate_module_metrics(
            cell_metrics,
            scenario_input,
            module_input,
            project.cell_active_area_m2,
            project.cell_thickness_mm,
        )
        metrics.update(module_metrics)

    return model_output, metrics


def sweep_model(db: Session, request):
    model = (
        db.query(StudyModel)
        .options(joinedload(StudyModel.points))
        .filter(StudyModel.id == request.model_id)
        .first()
    )
    if model is None:
        raise HTTPException(status_code=404, detail="Study model not found")
    if model.kind != "performance":
        raise HTTPException(status_code=400, detail="Sweep Results needs a performance model")

    degradation_model = None
    if request.degradation_model_id is not None:
        degradation_model = (
            db.query(StudyModel)
            .options(joinedload(StudyModel.points))
            .filter(StudyModel.id == request.degradation_model_id)
            .first()
        )
        if degradation_model is None:
            raise HTTPException(status_code=404, detail="Degradation model not found")

    points = []
    step = (request.x_end - request.x_start) / (request.steps - 1)
    for index in range(request.steps):
        x = request.x_start + step * index
        model_output, metrics = calculate_sweep_point(
            db, model, request.scenario_id, request.module_id, degradation_model, x
        )
        if request.y_metric not in metrics:
            raise HTTPException(status_code=400, detail="Selected y metric is unavailable")
        points.append(
            {
                "x": x,
                "model_output": model_output,
                "y": metrics[request.y_metric],
                "metrics": metrics,
            }
        )

    return {"model_id": model.id, "y_metric": request.y_metric, "points": points}
