from dataclasses import dataclass


@dataclass
class CalculationComponent:
    mass: float
    cost_per_kg: float


@dataclass
class CalculationScenario:
    avg_discharge_voltage: float
    avg_charge_voltage: float
    discharge_capacity: float
    cycle_life: int
    end_of_life_fraction: float
    electricity_price_eur_per_kwh: float


@dataclass
class ModuleConfig:
    cells_in_series: int
    cells_in_parallel: int
    module_current_a: float
    mass_overhead_fraction: float
    volume_overhead_fraction: float
    cost_overhead_fraction: float


def calculate_metrics(components, scenario):
    total_mass = sum(component.mass for component in components)
    total_cost = sum(component.mass * component.cost_per_kg for component in components)

    capacity_ah = scenario.discharge_capacity / 1000
    energy_wh = capacity_ah * scenario.avg_discharge_voltage
    rte = scenario.avg_discharge_voltage / scenario.avg_charge_voltage
    specific_energy = energy_wh / total_mass if total_mass else 0.0
    avg_retention = (1 + scenario.end_of_life_fraction) / 2
    lifetime_energy = energy_wh * scenario.cycle_life * avg_retention
    cost_per_kwh = total_cost / (energy_wh / 1000) if energy_wh else 0.0
    cost_per_kwh_cycle = (
        total_cost / ((energy_wh / 1000) * scenario.cycle_life)
        if energy_wh and scenario.cycle_life
        else 0.0
    )
    cost_per_lifetime_kwh = total_cost / (lifetime_energy / 1000) if lifetime_energy else 0.0
    lifetime_delivered_kwh = lifetime_energy / 1000 if lifetime_energy else 0.0
    lifetime_charge_input_kwh = lifetime_delivered_kwh / rte if rte else 0.0
    charging_cost = lifetime_charge_input_kwh * scenario.electricity_price_eur_per_kwh
    lcos = (total_cost + charging_cost) / lifetime_delivered_kwh if lifetime_delivered_kwh else 0.0

    return {
        "total_mass": total_mass,
        "total_cost": total_cost,
        "energy_wh": energy_wh,
        "specific_energy": specific_energy,
        "round_trip_efficiency": rte,
        "lifetime_energy": lifetime_energy,
        "cost_per_kwh": cost_per_kwh,
        "cost_per_kwh_cycle": cost_per_kwh_cycle,
        "cost_per_lifetime_kwh": cost_per_lifetime_kwh,
        "lcos": lcos,
    }


def calculate_module_metrics(cell_metrics, scenario, module_config, cell_active_area_m2, cell_thickness_mm):
    total_cell_count = module_config.cells_in_series * module_config.cells_in_parallel
    cell_voltage_v = scenario.avg_discharge_voltage
    cell_capacity_ah = scenario.discharge_capacity / 1000
    cell_energy_wh = cell_capacity_ah * scenario.avg_discharge_voltage
    module_voltage_v = module_config.cells_in_series * scenario.avg_discharge_voltage
    module_capacity_ah = module_config.cells_in_parallel * cell_capacity_ah
    module_energy_wh = total_cell_count * cell_energy_wh
    module_power_w = module_voltage_v * module_config.module_current_a
    discharge_time_h = module_capacity_ah / module_config.module_current_a if module_config.module_current_a else 0.0
    cell_current_a = module_config.module_current_a / module_config.cells_in_parallel
    cell_current_density_ma_per_cm2 = (
        (cell_current_a / cell_active_area_m2) * 0.1 if cell_active_area_m2 else 0.0
    )

    cell_volume_l = cell_active_area_m2 * (cell_thickness_mm / 1000) * 1000
    cell_mass_kg = cell_metrics["total_mass"]
    cell_cost = cell_metrics["total_cost"]
    cell_power_w = cell_voltage_v * cell_current_a
    cell_specific_energy_wh_per_kg = cell_metrics["specific_energy"]
    cell_volumetric_energy_wh_per_l = cell_energy_wh / cell_volume_l if cell_volume_l else 0.0
    cell_specific_power_w_per_kg = cell_power_w / cell_mass_kg if cell_mass_kg else 0.0
    cell_volumetric_power_w_per_l = cell_power_w / cell_volume_l if cell_volume_l else 0.0
    module_volume_l = cell_volume_l * total_cell_count * (1 + module_config.volume_overhead_fraction)
    module_mass_kg = cell_metrics["total_mass"] * total_cell_count * (1 + module_config.mass_overhead_fraction)
    module_cost = cell_metrics["total_cost"] * total_cell_count * (1 + module_config.cost_overhead_fraction)
    module_specific_energy_wh_per_kg = module_energy_wh / module_mass_kg if module_mass_kg else 0.0
    module_volumetric_energy_wh_per_l = module_energy_wh / module_volume_l if module_volume_l else 0.0
    module_specific_power_w_per_kg = module_power_w / module_mass_kg if module_mass_kg else 0.0
    module_volumetric_power_w_per_l = module_power_w / module_volume_l if module_volume_l else 0.0
    module_lifetime_energy_wh = cell_metrics["lifetime_energy"] * total_cell_count
    module_cost_per_kwh = module_cost / (module_energy_wh / 1000) if module_energy_wh else 0.0
    module_cost_per_lifetime_kwh = (
        module_cost / (module_lifetime_energy_wh / 1000) if module_lifetime_energy_wh else 0.0
    )

    rte = scenario.avg_discharge_voltage / scenario.avg_charge_voltage if scenario.avg_charge_voltage else 0.0
    lifetime_delivered_kwh = module_lifetime_energy_wh / 1000 if module_lifetime_energy_wh else 0.0
    lifetime_charge_input_kwh = lifetime_delivered_kwh / rte if rte else 0.0
    charging_cost = lifetime_charge_input_kwh * scenario.electricity_price_eur_per_kwh
    module_lcos = (module_cost + charging_cost) / lifetime_delivered_kwh if lifetime_delivered_kwh else 0.0

    return {
        "cell_voltage_v": cell_voltage_v,
        "cell_capacity_ah": cell_capacity_ah,
        "cell_energy_wh": cell_energy_wh,
        "cell_power_w": cell_power_w,
        "module_voltage_v": module_voltage_v,
        "module_capacity_ah": module_capacity_ah,
        "module_energy_wh": module_energy_wh,
        "module_power_w": module_power_w,
        "discharge_time_h": discharge_time_h,
        "cell_current_a": cell_current_a,
        "cell_current_density_ma_per_cm2": cell_current_density_ma_per_cm2,
        "total_cell_count": total_cell_count,
        "cell_mass_kg": cell_mass_kg,
        "cell_volume_l": cell_volume_l,
        "cell_cost": cell_cost,
        "module_mass_kg": module_mass_kg,
        "module_volume_l": module_volume_l,
        "module_cost": module_cost,
        "cell_specific_energy_wh_per_kg": cell_specific_energy_wh_per_kg,
        "cell_volumetric_energy_wh_per_l": cell_volumetric_energy_wh_per_l,
        "cell_specific_power_w_per_kg": cell_specific_power_w_per_kg,
        "cell_volumetric_power_w_per_l": cell_volumetric_power_w_per_l,
        "module_specific_energy_wh_per_kg": module_specific_energy_wh_per_kg,
        "module_volumetric_energy_wh_per_l": module_volumetric_energy_wh_per_l,
        "module_specific_power_w_per_kg": module_specific_power_w_per_kg,
        "module_volumetric_power_w_per_l": module_volumetric_power_w_per_l,
        "module_lifetime_energy_wh": module_lifetime_energy_wh,
        "module_cost_per_kwh": module_cost_per_kwh,
        "module_cost_per_lifetime_kwh": module_cost_per_lifetime_kwh,
        "module_lcos": module_lcos,
    }
