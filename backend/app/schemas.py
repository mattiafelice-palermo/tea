from pydantic import BaseModel, Field


class ComponentBase(BaseModel):
    name: str
    category: str
    density: float = Field(gt=0)
    cost_per_kg: float = Field(ge=0)


class ComponentCreate(ComponentBase):
    pass


class ComponentUpdate(ComponentBase):
    pass


class ComponentRead(ComponentBase):
    id: int

    model_config = {"from_attributes": True}


class ProjectBase(BaseModel):
    name: str
    cell_active_area_m2: float = Field(gt=0, default=0.01)
    cell_thickness_mm: float = Field(gt=0, default=8.0)


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = None
    cell_active_area_m2: float | None = Field(default=None, gt=0)
    cell_thickness_mm: float | None = Field(default=None, gt=0)


class ProjectRead(ProjectBase):
    id: int

    model_config = {"from_attributes": True}


class ProjectSummaryComponentRead(BaseModel):
    id: int
    component_id: int
    name: str
    category: str
    mass: float
    mass_fraction: float
    cost_per_kg: float
    cost: float


class ProjectSummaryRead(BaseModel):
    id: int
    name: str
    cell_active_area_m2: float
    cell_thickness_mm: float
    total_mass_kg: float
    total_cost_eur: float
    cost_per_kg_eur: float
    cell_volume_l: float
    component_count: int
    components: list[ProjectSummaryComponentRead]


class ProjectComponentCreate(BaseModel):
    project_id: int
    component_id: int
    mass: float = Field(gt=0)


class ProjectComponentUpdate(BaseModel):
    component_id: int | None = None
    mass: float = Field(gt=0)


class ProjectComponentRead(BaseModel):
    id: int
    project_id: int
    component_id: int
    mass: float
    component: ComponentRead

    model_config = {"from_attributes": True}


class ScenarioCreate(BaseModel):
    project_id: int
    avg_discharge_voltage: float = Field(gt=0)
    avg_charge_voltage: float = Field(gt=0)
    discharge_capacity: float = Field(gt=0)
    cycle_life: int = Field(gt=0)
    end_of_life_fraction: float = Field(gt=0, le=1)
    electricity_price_eur_per_kwh: float = Field(ge=0, default=0.15)


class ScenarioUpdate(BaseModel):
    avg_discharge_voltage: float = Field(gt=0)
    avg_charge_voltage: float = Field(gt=0)
    discharge_capacity: float = Field(gt=0)
    cycle_life: int = Field(gt=0)
    end_of_life_fraction: float = Field(gt=0, le=1)
    electricity_price_eur_per_kwh: float = Field(ge=0)


class ScenarioRead(ScenarioCreate):
    id: int

    model_config = {"from_attributes": True}


class ModuleConfigurationCreate(BaseModel):
    scenario_id: int
    name: str
    cells_in_series: int = Field(gt=0)
    cells_in_parallel: int = Field(gt=0)
    module_current_a: float = Field(gt=0)
    mass_overhead_fraction: float = Field(ge=0, default=0.15)
    volume_overhead_fraction: float = Field(ge=0, default=0.2)
    cost_overhead_fraction: float = Field(ge=0, default=0.1)


class ModuleConfigurationUpdate(BaseModel):
    scenario_id: int | None = None
    name: str | None = None
    cells_in_series: int | None = Field(default=None, gt=0)
    cells_in_parallel: int | None = Field(default=None, gt=0)
    module_current_a: float | None = Field(default=None, gt=0)
    mass_overhead_fraction: float | None = Field(default=None, ge=0)
    volume_overhead_fraction: float | None = Field(default=None, ge=0)
    cost_overhead_fraction: float | None = Field(default=None, ge=0)


class ModuleConfigurationRead(BaseModel):
    id: int
    scenario_id: int
    name: str
    cells_in_series: int
    cells_in_parallel: int
    module_current_a: float
    mass_overhead_fraction: float
    volume_overhead_fraction: float
    cost_overhead_fraction: float

    model_config = {"from_attributes": True}


class ModuleMetricsRead(BaseModel):
    cell_voltage_v: float
    cell_capacity_ah: float
    cell_energy_wh: float
    cell_power_w: float
    module_voltage_v: float
    module_capacity_ah: float
    module_energy_wh: float
    module_power_w: float
    discharge_time_h: float
    cell_current_a: float
    cell_current_density_ma_per_cm2: float
    total_cell_count: int
    cell_mass_kg: float
    cell_volume_l: float
    cell_cost: float
    module_mass_kg: float
    module_volume_l: float
    module_cost: float
    cell_specific_energy_wh_per_kg: float
    cell_volumetric_energy_wh_per_l: float
    cell_specific_power_w_per_kg: float
    cell_volumetric_power_w_per_l: float
    module_specific_energy_wh_per_kg: float
    module_volumetric_energy_wh_per_l: float
    module_specific_power_w_per_kg: float
    module_volumetric_power_w_per_l: float
    module_lifetime_energy_wh: float
    module_cost_per_kwh: float
    module_cost_per_lifetime_kwh: float
    module_lcos: float

    model_config = {"from_attributes": True}


class ModulePreviewRequest(BaseModel):
    scenario_id: int
    cells_in_series: int = Field(gt=0)
    cells_in_parallel: int = Field(gt=0)
    module_current_a: float = Field(gt=0)
    mass_overhead_fraction: float = Field(ge=0, default=0.15)
    volume_overhead_fraction: float = Field(ge=0, default=0.2)
    cost_overhead_fraction: float = Field(ge=0, default=0.1)


class ModuleResultRead(ModuleMetricsRead):
    id: int
    module_id: int


class ResultRead(BaseModel):
    id: int
    scenario_id: int
    total_mass: float
    total_cost: float
    energy_wh: float
    specific_energy: float
    round_trip_efficiency: float
    lifetime_energy: float
    cost_per_kwh: float
    cost_per_kwh_cycle: float
    cost_per_lifetime_kwh: float
    lcos: float

    model_config = {"from_attributes": True}
