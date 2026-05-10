export type Component = {
  id: number;
  name: string;
  category: string;
  density: number;
  cost_per_kg: number;
};

export type RawMaterial = {
  id: number;
  name: string;
  cost_per_kg: number;
};

export type ComponentRawMaterial = {
  id: number;
  component_id: number;
  raw_material_id: number;
  mass_fraction: number;
  mass_part: number | null;
  raw_material: RawMaterial;
};

export type ComponentFormulation = {
  component_id: number;
  items: ComponentRawMaterial[];
  total_fraction: number;
  calculated_cost_per_kg: number;
};

export type Project = {
  id: number;
  name: string;
  cell_active_area_m2: number;
  cell_thickness_mm: number;
};

export type ProjectSummaryComponent = {
  id: number;
  component_id: number;
  name: string;
  category: string;
  mass: number;
  mass_fraction: number;
  cost_per_kg: number;
  cost: number;
};

export type ProjectSummary = {
  id: number;
  name: string;
  cell_active_area_m2: number;
  cell_thickness_mm: number;
  total_mass_kg: number;
  total_cost_eur: number;
  cost_per_kg_eur: number;
  cell_volume_l: number;
  component_count: number;
  components: ProjectSummaryComponent[];
};

export type ProjectComponent = {
  id: number;
  project_id: number;
  component_id: number;
  mass: number;
  component: Component;
};

export type Scenario = {
  id: number;
  project_id: number;
  avg_discharge_voltage: number;
  avg_charge_voltage: number;
  discharge_capacity: number;
  cycle_life: number;
  end_of_life_fraction: number;
  electricity_price_eur_per_kwh: number;
};

export type Result = {
  id: number;
  scenario_id: number;
  total_mass: number;
  total_cost: number;
  energy_wh: number;
  specific_energy: number;
  round_trip_efficiency: number;
  lifetime_energy: number;
  cost_per_kwh: number;
  cost_per_kwh_cycle: number;
  cost_per_lifetime_kwh: number;
  lcos: number;
};

export type ModuleConfiguration = {
  id: number;
  scenario_id: number;
  name: string;
  cells_in_series: number;
  cells_in_parallel: number;
  module_current_a: number;
  mass_overhead_fraction: number;
  volume_overhead_fraction: number;
  cost_overhead_fraction: number;
};

export type ModuleResult = {
  id: number;
  module_id: number;
  cell_voltage_v: number;
  cell_capacity_ah: number;
  cell_energy_wh: number;
  cell_power_w: number;
  module_voltage_v: number;
  module_capacity_ah: number;
  module_energy_wh: number;
  module_power_w: number;
  discharge_time_h: number;
  cell_current_a: number;
  cell_current_density_ma_per_cm2: number;
  total_cell_count: number;
  cell_mass_kg: number;
  cell_volume_l: number;
  cell_cost: number;
  module_mass_kg: number;
  module_volume_l: number;
  module_cost: number;
  cell_specific_energy_wh_per_kg: number;
  cell_volumetric_energy_wh_per_l: number;
  cell_specific_power_w_per_kg: number;
  cell_volumetric_power_w_per_l: number;
  module_specific_energy_wh_per_kg: number;
  module_volumetric_energy_wh_per_l: number;
  module_specific_power_w_per_kg: number;
  module_volumetric_power_w_per_l: number;
  module_lifetime_energy_wh: number;
  module_cost_per_kwh: number;
  module_cost_per_lifetime_kwh: number;
  module_lcos: number;
};

export type StudyModelPoint = {
  id?: number;
  model_id?: number;
  x: number;
  y: number;
};

export type StudyModel = {
  id: number;
  name: string;
  kind: "performance" | "degradation";
  input_variable: string;
  output_metric: string;
  correlation_type: "linear" | "lookup" | "formula";
  parameters: Record<string, number | string>;
  points: StudyModelPoint[];
};

export type StudyMetadataOption = {
  value: string;
  label: string;
};

export type StudyMetadata = {
  performance_inputs: StudyMetadataOption[];
  performance_outputs: StudyMetadataOption[];
  degradation_outputs: StudyMetadataOption[];
  cell_metrics: StudyMetadataOption[];
  module_metrics: StudyMetadataOption[];
};

export type StudySweepPoint = {
  x: number;
  model_output: number;
  y: number;
  metrics: Record<string, number>;
};

export type StudySweepResponse = {
  model_id: number;
  y_metric: string;
  points: StudySweepPoint[];
};
