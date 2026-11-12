"""Load the README's illustrative dataset into an empty Battery TEA database."""

import argparse
import json
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", default="http://127.0.0.1:8000")
    args = parser.parse_args()

    def request(path, payload=None):
        body = None if payload is None else json.dumps(payload).encode()
        req = Request(args.api.rstrip("/") + path, body, {"Content-Type": "application/json"})
        with urlopen(req, timeout=10) as response:
            return json.load(response)

    collections = (
        "/raw-materials", "/components", "/projects", "/scenarios", "/modules", "/study-models",
    )
    if any(request(path) for path in collections):
        parser.exit(1, "Use an empty database. The demo loader does not change existing records.\n")

    component_masses = {}
    for name, category, density, price, mass in [
        ("LFP cathode laminate", "cathode", 2.4, 13, 0.079),
        ("Graphite anode laminate", "anode", 1.6, 11, 0.054),
        ("Electrolyte", "electrolyte", 1.2, 12, 0.024),
        ("Polyolefin separator", "separator", 0.9, 24, 0.009),
        ("Pouch and tabs", "casing", 2, 17, 0.022),
    ]:
        component = request("/components", dict(
            name=name, category=category, density=density, cost_per_kg=price,
        ))["id"]
        component_masses[name] = (component, mass)

    cathode, _ = component_masses["LFP cathode laminate"]

    for name, price, fraction in [
        ("LFP active material", 13, 0.85),
        ("Conductive carbon", 9, 0.03),
        ("Binder", 18, 0.02),
        ("Aluminium foil", 7.5, 0.10),
    ]:
        raw = request("/raw-materials", dict(name=name, cost_per_kg=price))["id"]
        request("/component-raw-materials", dict(
            component_id=cathode, raw_material_id=raw, mass_fraction=fraction,
        ))
    request(f"/components/{cathode}/use-calculated-cost", {})

    for capacity, scale, area, layouts in [
        (20, 1.85, 0.032, [(8, 1)]),
        (10, 1, 0.018, [(4, 4), (8, 2)]),
    ]:
        cell = request("/projects", dict(
            name=f"LFP pouch | {capacity} Ah", cell_active_area_m2=area, cell_thickness_mm=9,
        ))["id"]
        for component, mass in component_masses.values():
            request("/project-components", dict(project_id=cell, component_id=component, mass=mass * scale))
        scenario = request("/scenarios", dict(
            project_id=cell, avg_discharge_voltage=3.2, avg_charge_voltage=3.45,
            discharge_capacity=capacity * 1000, cycle_life=2400,
            end_of_life_fraction=0.8, electricity_price_eur_per_kwh=0.15,
        ))["id"]
        for series, parallel in layouts:
            request("/modules", dict(
                scenario_id=scenario, name=f"LFP {capacity} Ah | {series}S{parallel}P",
                cells_in_series=series, cells_in_parallel=parallel, module_current_a=16,
                mass_overhead_fraction=0.15, volume_overhead_fraction=0.20,
                cost_overhead_fraction=0.10,
            ))

    request("/study-models", dict(
        name="Cathode loading vs. capacity", kind="performance",
        input_variable=f"component_mass:{cathode}", output_metric="discharge_capacity",
        correlation_type="lookup",
        parameters=dict(variation_mode="additive", baseline_input_value=0.079, baseline_output_value=10000),
        points=[dict(x=x, y=y) for x, y in [
            (-0.010, -950), (-0.005, -460), (0, 0), (0.005, 380), (0.010, 640),
        ]],
    ))
    print("Loaded two illustrative cells, three module layouts, and a capacity sensitivity model.")


if __name__ == "__main__":
    main()
