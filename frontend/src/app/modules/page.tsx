"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import type { ModuleConfiguration, ModuleResult, Project, Scenario } from "@/types";

const initialForm = {
  name: "",
  total_cells: "12",
  grouping: "1s12p",
  module_current_a: "10",
  mass_overhead_fraction: "0.15",
  volume_overhead_fraction: "0.2",
  cost_overhead_fraction: "0.1",
};

type PreviewMetrics = Omit<ModuleResult, "id" | "module_id">;
type UnitSet = "scaled" | "base";
type PreviewLevel = "module" | "cell";
type MetricCard = { label: string; value: string };

function groupingLabel(cellsInSeries: number, cellsInParallel: number) {
  return `${cellsInSeries}s${cellsInParallel}p`;
}

function inferTotalCells(module: ModuleConfiguration): number {
  return module.cells_in_series * module.cells_in_parallel;
}

function validGroupings(totalCellsValue: string) {
  const totalCells = Number(totalCellsValue);
  if (!Number.isInteger(totalCells) || totalCells <= 0) {
    return [];
  }

  const options: Array<{ label: string; cellsInSeries: number; cellsInParallel: number }> = [];
  for (let cellsInSeries = 1; cellsInSeries <= totalCells; cellsInSeries += 1) {
    if (totalCells % cellsInSeries === 0) {
      const cellsInParallel = totalCells / cellsInSeries;
      options.push({
        label: groupingLabel(cellsInSeries, cellsInParallel),
        cellsInSeries,
        cellsInParallel,
      });
    }
  }
  return options;
}

function toModulePayload(form: typeof initialForm) {
  const grouping = form.grouping.match(/^(\d+)s(\d+)p$/);
  const cellsInSeries = grouping ? Number(grouping[1]) : 1;
  const cellsInParallel = grouping ? Number(grouping[2]) : Number(form.total_cells);

  return {
    name: form.name,
    cells_in_series: cellsInSeries,
    cells_in_parallel: cellsInParallel,
    module_current_a: Number(form.module_current_a),
    mass_overhead_fraction: Number(form.mass_overhead_fraction),
    volume_overhead_fraction: Number(form.volume_overhead_fraction),
    cost_overhead_fraction: Number(form.cost_overhead_fraction),
  };
}

function formatValue(value: number, unitSet: UnitSet, kind: "capacity" | "energy" | "power") {
  if (kind === "capacity") {
    return unitSet === "scaled" ? `${(value / 1000).toFixed(3)} kAh` : `${value.toFixed(2)} Ah`;
  }
  if (kind === "energy") {
    return unitSet === "scaled" ? `${(value / 1000).toFixed(3)} kWh` : `${value.toFixed(2)} Wh`;
  }
  return unitSet === "scaled" ? `${(value / 1000).toFixed(3)} kW` : `${value.toFixed(2)} W`;
}

function metricCards(
  metrics: PreviewMetrics | ModuleResult | null,
  unitSet: UnitSet,
  previewLevel: PreviewLevel
): MetricCard[] {
  if (!metrics) {
    return [];
  }

  if (previewLevel === "cell") {
    return [
      { label: "Cell voltage", value: `${metrics.cell_voltage_v.toFixed(2)} V` },
      { label: "Cell capacity", value: formatValue(metrics.cell_capacity_ah, unitSet, "capacity") },
      { label: "Cell energy", value: formatValue(metrics.cell_energy_wh, unitSet, "energy") },
      { label: "Cell power", value: formatValue(metrics.cell_power_w, unitSet, "power") },
      { label: "Cell current", value: `${metrics.cell_current_a.toFixed(2)} A` },
      {
        label: "Cell current density",
        value: `${metrics.cell_current_density_ma_per_cm2.toFixed(2)} mA/cm2`,
      },
      { label: "Cell mass", value: `${metrics.cell_mass_kg.toFixed(3)} kg` },
      { label: "Cell volume", value: `${metrics.cell_volume_l.toFixed(3)} L` },
      {
        label: "Energy per mass",
        value: `${metrics.cell_specific_energy_wh_per_kg.toFixed(2)} Wh/kg`,
      },
      {
        label: "Energy per volume",
        value: `${metrics.cell_volumetric_energy_wh_per_l.toFixed(2)} Wh/L`,
      },
      {
        label: "Power per mass",
        value: `${metrics.cell_specific_power_w_per_kg.toFixed(2)} W/kg`,
      },
      {
        label: "Power per volume",
        value: `${metrics.cell_volumetric_power_w_per_l.toFixed(2)} W/L`,
      },
      { label: "Cell cost", value: `EUR ${metrics.cell_cost.toFixed(2)}` },
    ];
  }

  return [
    { label: "Arrangement", value: `${metrics.total_cell_count} cells` },
    { label: "Module voltage", value: `${metrics.module_voltage_v.toFixed(2)} V` },
    { label: "Module capacity", value: formatValue(metrics.module_capacity_ah, unitSet, "capacity") },
    { label: "Module energy", value: formatValue(metrics.module_energy_wh, unitSet, "energy") },
    { label: "Module power", value: formatValue(metrics.module_power_w, unitSet, "power") },
    { label: "Discharge time", value: `${metrics.discharge_time_h.toFixed(2)} h` },
    { label: "Cell current", value: `${metrics.cell_current_a.toFixed(2)} A` },
    {
      label: "Cell current density",
      value: `${metrics.cell_current_density_ma_per_cm2.toFixed(2)} mA/cm2`,
    },
    { label: "Module mass", value: `${metrics.module_mass_kg.toFixed(3)} kg` },
    { label: "Module volume", value: `${metrics.module_volume_l.toFixed(3)} L` },
    {
      label: "Energy per mass",
      value: `${metrics.module_specific_energy_wh_per_kg.toFixed(2)} Wh/kg`,
    },
    {
      label: "Energy per volume",
      value: `${metrics.module_volumetric_energy_wh_per_l.toFixed(2)} Wh/L`,
    },
    {
      label: "Power per mass",
      value: `${metrics.module_specific_power_w_per_kg.toFixed(2)} W/kg`,
    },
    {
      label: "Power per volume",
      value: `${metrics.module_volumetric_power_w_per_l.toFixed(2)} W/L`,
    },
    { label: "Module cost", value: `EUR ${metrics.module_cost.toFixed(2)}` },
    { label: "Cost per kWh", value: `EUR ${metrics.module_cost_per_kwh.toFixed(2)}/kWh` },
    { label: "LCOS", value: `EUR ${(metrics.module_lcos * 1000).toFixed(2)}/MWh` },
  ];
}

export default function ModulesPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [modules, setModules] = useState<ModuleConfiguration[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [selectedResult, setSelectedResult] = useState<ModuleResult | null>(null);
  const [modalPreview, setModalPreview] = useState<PreviewMetrics | null>(null);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
  const [modalProjectId, setModalProjectId] = useState<number | "">("");
  const [modalScenarioId, setModalScenarioId] = useState<number | "">("");
  const [unitSet, setUnitSet] = useState<UnitSet>("scaled");
  const [previewLevel, setPreviewLevel] = useState<PreviewLevel>("module");

  function parseSelectNumber(value: string): number | "" {
    return value ? Number(value) : "";
  }

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === modalProjectId) ?? null,
    [projects, modalProjectId]
  );

  const selectedModule = useMemo(
    () => modules.find((module) => module.id === selectedModuleId) ?? null,
    [modules, selectedModuleId]
  );

  async function loadProjects() {
    const data = await api.get<Project[]>("/projects");
    setProjects(data);
  }

  async function loadScenarios(projectId: number) {
    const data = await api.get<Scenario[]>(`/scenarios?project_id=${projectId}`);
    setScenarios(data);
    setModalScenarioId((current) => {
      if (current && data.some((scenario) => scenario.id === current)) {
        return current;
      }
      return data[0]?.id ?? "";
    });
  }

  async function findProjectIdForScenario(scenarioId: number) {
    for (const project of projects) {
      const data = await api.get<Scenario[]>(`/scenarios?project_id=${project.id}`);
      const match = data.find((scenario) => scenario.id === scenarioId);
      if (match) {
        setScenarios(data);
        return project.id;
      }
    }
    return "";
  }

  async function loadModules(preferredId?: number | null) {
    const data = await api.get<ModuleConfiguration[]>("/modules");
    setModules(data);
    setSelectedModuleId((current) => {
      if (preferredId && data.some((module) => module.id === preferredId)) {
        return preferredId;
      }
      if (current && data.some((module) => module.id === current)) {
        return current;
      }
      return data[0]?.id ?? null;
    });
    setSelectedResult(null);
  }

  useEffect(() => {
    loadProjects().catch((error: Error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    loadModules().catch((error: Error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (modalProjectId) {
      loadScenarios(modalProjectId).catch((error: Error) => setMessage(error.message));
    } else {
      setScenarios([]);
      setModalScenarioId("");
    }
  }, [modalProjectId]);

  useEffect(() => {
    const options = validGroupings(form.total_cells);
    if (options.length === 0) {
      return;
    }
    if (!options.some((option) => option.label === form.grouping)) {
      setForm((current) => ({
        ...current,
        grouping: options[0].label,
      }));
    }
  }, [form.total_cells, form.grouping]);

  useEffect(() => {
    if (!selectedModuleId) {
      setSelectedResult(null);
      return;
    }

    api
      .post<ModuleResult>(`/modules/${selectedModuleId}/calculate`, {})
      .then((data) => setSelectedResult(data))
      .catch((error: Error) => setMessage(error.message));
  }, [selectedModuleId]);

  useEffect(() => {
    if (!isModalOpen || !modalScenarioId) {
      setModalPreview(null);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const payload = toModulePayload(form);
        const data = await api.post<PreviewMetrics>("/modules/preview", {
          scenario_id: modalScenarioId,
          ...payload,
        });
        setModalPreview(data);
      } catch {
        setModalPreview(null);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [form, isModalOpen, modalScenarioId]);

  function openCreateModal() {
    setForm(initialForm);
    setModalPreview(null);
    setEditingModuleId(null);
    const defaultProjectId = projects[0]?.id ?? "";
    setModalProjectId(defaultProjectId);
    setModalScenarioId("");
    setIsModalOpen(true);
  }

  function closeCreateModal() {
    setIsModalOpen(false);
    setEditingModuleId(null);
  }

  async function openEditModal(module: ModuleConfiguration) {
    const totalCells = inferTotalCells(module);
    setForm({
      name: module.name,
      total_cells: String(totalCells),
      grouping: groupingLabel(module.cells_in_series, module.cells_in_parallel),
      module_current_a: String(module.module_current_a),
      mass_overhead_fraction: String(module.mass_overhead_fraction),
      volume_overhead_fraction: String(module.volume_overhead_fraction),
      cost_overhead_fraction: String(module.cost_overhead_fraction),
    });
    setModalPreview(null);
    setEditingModuleId(module.id);
    const projectId = await findProjectIdForScenario(module.scenario_id);
    setModalProjectId(projectId);
    setModalScenarioId(module.scenario_id);
    setIsModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modalScenarioId) {
      setMessage("Choose a scenario first.");
      return;
    }

    try {
      const payload = toModulePayload(form);
      const saved = editingModuleId
        ? await api.put<ModuleConfiguration>(`/modules/${editingModuleId}`, {
            scenario_id: modalScenarioId,
            ...payload,
          })
        : await api.post<ModuleConfiguration>("/modules", {
            scenario_id: modalScenarioId,
            ...payload,
          });
      await loadModules(saved.id);
      setMessage(editingModuleId ? "Module configuration updated." : "Module configuration saved.");
      closeCreateModal();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : editingModuleId
            ? "Failed to update module"
            : "Failed to save module"
      );
    }
  }

  async function handleDeleteModule(moduleId: number) {
    try {
      await api.delete(`/modules/${moduleId}`);
      if (selectedModuleId === moduleId) {
        setSelectedModuleId(null);
        setSelectedResult(null);
      }
      await loadModules();
      setMessage("Module configuration deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete module");
    }
  }

  const selectedCards = metricCards(selectedResult, unitSet, previewLevel);
  const previewCards = metricCards(modalPreview, unitSet, previewLevel);
  const selectedArrangement = selectedModule
    ? groupingLabel(selectedModule.cells_in_series, selectedModule.cells_in_parallel)
    : null;
  const selectedTotalCells = selectedModule ? inferTotalCells(selectedModule) : null;
  const suspiciousArea =
    selectedProject && selectedProject.cell_active_area_m2 > 0.1
      ? "Selected cell definition has an unusually large active area. If it was created before the cm2 switch, re-save it in Cell Builder."
      : "";
  const cellGeometryCards =
    previewLevel === "cell" && selectedProject
      ? [
          {
            label: "Cell active area",
            value: `${(selectedProject.cell_active_area_m2 * 10000).toFixed(1)} cm2`,
          },
          {
            label: "Cell thickness",
            value: `${selectedProject.cell_thickness_mm.toFixed(1)} mm`,
          },
        ]
      : [];

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="section-header">
          <div>
            <span className="eyebrow">Modules</span>
            <h2>Build module configurations</h2>
            <p className="muted">
              Compare saved modules in a table-view layout and create new ones in a guided modal.
            </p>
          </div>
          <button className="button" type="button" onClick={openCreateModal}>
            New module
          </button>
        </div>
      </section>

      <div className="modules-layout">
        <section className="table-wrap modules-table-panel">
          <div>
            <span className="eyebrow">Saved Modules</span>
            <h2>Module configurations</h2>
          </div>
          <table className="selectable-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Arrangement</th>
                <th>Total cells</th>
                <th>Current (A)</th>
                <th>Mass overhead</th>
                <th>Volume overhead</th>
                <th>Cost overhead</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((module) => (
                <tr
                  key={module.id}
                  className={module.id === selectedModuleId ? "selected-row" : ""}
                  onClick={() => setSelectedModuleId(module.id)}
                >
                  <td>{module.name}</td>
                  <td>{groupingLabel(module.cells_in_series, module.cells_in_parallel)}</td>
                  <td>{inferTotalCells(module)}</td>
                  <td>{module.module_current_a.toFixed(2)}</td>
                  <td>{module.mass_overhead_fraction.toFixed(2)}</td>
                  <td>{module.volume_overhead_fraction.toFixed(2)}</td>
                  <td>{module.cost_overhead_fraction.toFixed(2)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        type="button"
                        title="Edit module"
                        aria-label="Edit module"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditModal(module).catch((error: Error) => setMessage(error.message));
                        }}
                      >
                        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                          <path
                            d="M14.7 2.3a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4l-9.9 9.9-3.8.8.8-3.8 9.9-9.9Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        className="icon-button danger"
                        type="button"
                        title="Delete module"
                        aria-label="Delete module"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteModule(module.id);
                        }}
                      >
                        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                          <path
                            d="M4.5 5.5h11m-9.5 0v10m4-10v10m4-10v10M7 3.5h6l.5 2H6.5l.5-2Zm-1 2h8l-.5 11a1 1 0 0 1-1 .9H7.5a1 1 0 0 1-1-.9L6 5.5Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <aside className="panel stack preview-panel">
          <div className="preview-title-block">
            <div className="preview-heading">
              <span className="eyebrow">Preview</span>
              <h2>Selected module</h2>
            </div>
            <div className="preview-controls">
              <div className="field preview-unit-field">
                <label htmlFor="preview-unit-set">Units</label>
                <select
                  id="preview-unit-set"
                  value={unitSet}
                  onChange={(event) => setUnitSet(event.target.value as UnitSet)}
                >
                  <option value="scaled">kAh / kWh / kW</option>
                  <option value="base">Ah / Wh / W</option>
                </select>
              </div>
              <div className="field preview-unit-field">
                <label htmlFor="preview-level">Level</label>
                <select
                  id="preview-level"
                  value={previewLevel}
                  onChange={(event) => setPreviewLevel(event.target.value as PreviewLevel)}
                >
                  <option value="module">Module</option>
                  <option value="cell">Cell</option>
                </select>
              </div>
            </div>
          </div>
          {selectedModule ? (
            <>
              <div className="detail-list">
                <div className="detail-item">
                  <span className="detail-label">Name</span>
                  <strong>{selectedModule.name}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Arrangement</span>
                  <strong>
                    {selectedArrangement} using {selectedTotalCells} cells
                  </strong>
                </div>
              </div>
              {selectedCards.length > 0 ? (
                <div className="card-grid metric-card-grid">
                  {selectedCards.map((card) => (
                    <article key={card.label} className="card metric-card">
                      <span className="eyebrow">{card.label}</span>
                      <p className="metric">{card.value}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">Calculating selected module...</p>
              )}
            </>
          ) : (
            <p className="muted">Choose a saved module from the table to inspect its performance on the right.</p>
          )}
        </aside>
      </div>

      <div className="message">{message}</div>

      {isModalOpen ? (
        <div className="modal-backdrop" onClick={closeCreateModal}>
          <div className="modal-panel modal-wide" onClick={(event) => event.stopPropagation()}>
            <div className="section-header">
              <div>
                <span className="eyebrow">{editingModuleId ? "Edit Module" : "New Module"}</span>
                <h2>{editingModuleId ? "Edit module configuration" : "Create module configuration"}</h2>
              </div>
              <button className="button secondary" type="button" onClick={closeCreateModal}>
                Close
              </button>
            </div>

            <div className="modal-split">
              <form onSubmit={handleSubmit} className="stack">
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="module-project">Cell definition</label>
                    <select
                      id="module-project"
                      value={modalProjectId}
                      onChange={(event) => setModalProjectId(parseSelectNumber(event.target.value))}
                    >
                      <option value="">Select cell definition</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="module-scenario">Scenario</label>
                    <select
                      id="module-scenario"
                      value={modalScenarioId}
                      onChange={(event) => setModalScenarioId(parseSelectNumber(event.target.value))}
                    >
                      <option value="">Select scenario</option>
                      {scenarios.map((scenario) => (
                        <option key={scenario.id} value={scenario.id}>
                          Scenario #{scenario.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="module-name">Module name</label>
                    <input
                      id="module-name"
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="module-total-cells">Total cells</label>
                    <input
                      id="module-total-cells"
                      type="number"
                      min="1"
                      step="1"
                      value={form.total_cells}
                      onChange={(event) => setForm({ ...form, total_cells: event.target.value })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="module-grouping">Grouping</label>
                    <select
                      id="module-grouping"
                      value={form.grouping}
                      onChange={(event) => setForm({ ...form, grouping: event.target.value })}
                    >
                      {validGroupings(form.total_cells).map((option) => (
                        <option key={option.label} value={option.label}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="module-current">Module current (A)</label>
                    <input
                      id="module-current"
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.module_current_a}
                      onChange={(event) =>
                        setForm({ ...form, module_current_a: event.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="mass-overhead">Mass overhead fraction</label>
                    <input
                      id="mass-overhead"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.mass_overhead_fraction}
                      onChange={(event) =>
                        setForm({ ...form, mass_overhead_fraction: event.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="volume-overhead">Volume overhead fraction</label>
                    <input
                      id="volume-overhead"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.volume_overhead_fraction}
                      onChange={(event) =>
                        setForm({ ...form, volume_overhead_fraction: event.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="cost-overhead">Cost overhead fraction</label>
                    <input
                      id="cost-overhead"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.cost_overhead_fraction}
                      onChange={(event) =>
                        setForm({ ...form, cost_overhead_fraction: event.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="actions">
                  <button className="button" type="submit">
                    {editingModuleId ? "Update module" : "Save module"}
                  </button>
                  <button className="button secondary" type="button" onClick={closeCreateModal}>
                    Cancel
                  </button>
                </div>
              </form>

              <aside className="panel stack modal-preview-panel">
                <div className="preview-title-block">
                  <div>
                    <span className="eyebrow">Preview</span>
                    <h2>Live module snapshot</h2>
                  </div>
                  <div className="field preview-unit-field">
                    <label htmlFor="modal-preview-unit-set">Units</label>
                    <select
                      id="modal-preview-unit-set"
                      value={unitSet}
                      onChange={(event) => setUnitSet(event.target.value as UnitSet)}
                    >
                      <option value="scaled">kAh / kWh / kW</option>
                      <option value="base">Ah / Wh / W</option>
                    </select>
                  </div>
                  <div className="field preview-unit-field">
                    <label htmlFor="modal-preview-level">Level</label>
                    <select
                      id="modal-preview-level"
                      value={previewLevel}
                      onChange={(event) => setPreviewLevel(event.target.value as PreviewLevel)}
                    >
                      <option value="module">Module</option>
                      <option value="cell">Cell</option>
                    </select>
                  </div>
                </div>
                {suspiciousArea ? <p className="message">{suspiciousArea}</p> : null}
                {previewCards.length > 0 ? (
                  <div className="card-grid metric-card-grid">
                    {[...previewCards, ...cellGeometryCards].map((card) => (
                      <article key={card.label} className="card metric-card">
                        <span className="eyebrow">{card.label}</span>
                        <p className="metric">{card.value}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    Pick a valid cell count and current to see how the module evolves while you
                    define it.
                  </p>
                )}
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
