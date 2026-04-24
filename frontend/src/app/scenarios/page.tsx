"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import type { Project, Scenario } from "@/types";

const initialForm = {
  project_id: "",
  avg_discharge_voltage: "",
  avg_charge_voltage: "",
  discharge_capacity: "",
  cycle_life: "",
  end_of_life_fraction: "0.8",
  electricity_price_eur_per_kwh: "0.15",
};

export default function ScenariosPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [filterProjectId, setFilterProjectId] = useState<number | "">("");
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingScenarioId, setEditingScenarioId] = useState<number | null>(null);

  function parseSelectNumber(value: string): number | "" {
    return value ? Number(value) : "";
  }

  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects]
  );

  const filteredScenarios = useMemo(() => {
    if (!filterProjectId) {
      return scenarios;
    }
    return scenarios.filter((scenario) => scenario.project_id === filterProjectId);
  }, [filterProjectId, scenarios]);

  async function loadProjects() {
    const data = await api.get<Project[]>("/projects");
    setProjects(data);
    setFilterProjectId((current) => current || data[0]?.id || "");
  }

  async function loadScenarios() {
    setScenarios(await api.get<Scenario[]>("/scenarios"));
  }

  useEffect(() => {
    Promise.all([loadProjects(), loadScenarios()]).catch((error: Error) => setMessage(error.message));
  }, []);

  function openCreateModal() {
    setModalMode("create");
    setEditingScenarioId(null);
    setForm({
      ...initialForm,
      project_id: filterProjectId ? String(filterProjectId) : String(projects[0]?.id ?? ""),
    });
    setIsModalOpen(true);
  }

  function openEditModal(scenario: Scenario) {
    setModalMode("edit");
    setEditingScenarioId(scenario.id);
    setForm({
      project_id: String(scenario.project_id),
      avg_discharge_voltage: String(scenario.avg_discharge_voltage),
      avg_charge_voltage: String(scenario.avg_charge_voltage),
      discharge_capacity: String(scenario.discharge_capacity),
      cycle_life: String(scenario.cycle_life),
      end_of_life_fraction: String(scenario.end_of_life_fraction),
      electricity_price_eur_per_kwh: String(scenario.electricity_price_eur_per_kwh),
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingScenarioId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.project_id) {
      setMessage("Choose a cell definition first.");
      return;
    }

    try {
      const payload = {
        project_id: Number(form.project_id),
        avg_discharge_voltage: Number(form.avg_discharge_voltage),
        avg_charge_voltage: Number(form.avg_charge_voltage),
        discharge_capacity: Number(form.discharge_capacity),
        cycle_life: Number(form.cycle_life),
        end_of_life_fraction: Number(form.end_of_life_fraction),
        electricity_price_eur_per_kwh: Number(form.electricity_price_eur_per_kwh),
      };

      if (modalMode === "create") {
        await api.post<Scenario>("/scenarios", payload);
        setMessage("Scenario saved.");
      } else if (editingScenarioId) {
        await api.put<Scenario>(`/scenarios/${editingScenarioId}`, {
          avg_discharge_voltage: payload.avg_discharge_voltage,
          avg_charge_voltage: payload.avg_charge_voltage,
          discharge_capacity: payload.discharge_capacity,
          cycle_life: payload.cycle_life,
          end_of_life_fraction: payload.end_of_life_fraction,
          electricity_price_eur_per_kwh: payload.electricity_price_eur_per_kwh,
        });
        setMessage("Scenario updated.");
      }

      await loadScenarios();
      setFilterProjectId(Number(form.project_id));
      closeModal();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save scenario");
    }
  }

  async function handleDeleteScenario(scenarioId: number) {
    try {
      await api.delete(`/scenarios/${scenarioId}`);
      await loadScenarios();
      setMessage("Scenario deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete scenario");
    }
  }

  return (
    <div className="stack">
      <div className="page-actions page-actions-floating">
        <button className="button" type="button" onClick={openCreateModal}>
          Add scenario
        </button>
        <div className="message">{message}</div>
      </div>

      <section className="table-wrap">
        <div className="section-header">
          <div>
            <span className="eyebrow">Scenario List</span>
            <h2>Saved scenarios</h2>
          </div>
        </div>
        <div className="scenario-toolbar">
          <div className="field scenario-filter">
            <label htmlFor="scenario-filter-project">Cell definition</label>
            <select
              id="scenario-filter-project"
              value={filterProjectId}
              onChange={(event) => setFilterProjectId(parseSelectNumber(event.target.value))}
            >
              <option value="">All cell definitions</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <p className="muted scenario-note">
            Electricity price defaults to 0.15 EUR/kWh, a reasonable midpoint for non-household charging energy.
          </p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Cell</th>
              <th>ID</th>
              <th>Discharge V</th>
              <th>Charge V</th>
              <th>Capacity (mAh)</th>
              <th>Cycle life</th>
              <th>EoL fraction</th>
              <th>Power price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredScenarios.map((scenario) => (
              <tr key={scenario.id}>
                <td>{projectNameById.get(scenario.project_id) ?? `Cell #${scenario.project_id}`}</td>
                <td>{scenario.id}</td>
                <td>{scenario.avg_discharge_voltage.toFixed(2)}</td>
                <td>{scenario.avg_charge_voltage.toFixed(2)}</td>
                <td>{scenario.discharge_capacity.toFixed(1)}</td>
                <td>{scenario.cycle_life}</td>
                <td>{scenario.end_of_life_fraction.toFixed(2)}</td>
                <td>{scenario.electricity_price_eur_per_kwh.toFixed(2)} EUR/kWh</td>
                <td>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Edit scenario"
                      title="Edit scenario"
                      onClick={() => openEditModal(scenario)}
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
                      aria-label="Delete scenario"
                      title="Delete scenario"
                      onClick={() => handleDeleteScenario(scenario.id)}
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

      {isModalOpen ? (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="section-header">
              <div>
                <span className="eyebrow">
                  {modalMode === "create" ? "New Scenario" : "Edit Scenario"}
                </span>
                <h2>{modalMode === "create" ? "Add scenario" : "Update scenario"}</h2>
              </div>
              <button className="button secondary" type="button" onClick={closeModal}>
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="stack">
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="scenario-project">Cell definition</label>
                  <select
                    id="scenario-project"
                    value={form.project_id}
                    onChange={(event) => setForm({ ...form, project_id: event.target.value })}
                    disabled={modalMode === "edit"}
                    required
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
                  <label htmlFor="avg_discharge_voltage">Avg discharge voltage (V)</label>
                  <input
                    id="avg_discharge_voltage"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.avg_discharge_voltage}
                    onChange={(event) =>
                      setForm({ ...form, avg_discharge_voltage: event.target.value })
                    }
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="avg_charge_voltage">Avg charge voltage (V)</label>
                  <input
                    id="avg_charge_voltage"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.avg_charge_voltage}
                    onChange={(event) => setForm({ ...form, avg_charge_voltage: event.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="discharge_capacity">Discharge capacity (mAh)</label>
                  <input
                    id="discharge_capacity"
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.discharge_capacity}
                    onChange={(event) => setForm({ ...form, discharge_capacity: event.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="cycle_life">Cycle life</label>
                  <input
                    id="cycle_life"
                    type="number"
                    min="1"
                    step="1"
                    value={form.cycle_life}
                    onChange={(event) => setForm({ ...form, cycle_life: event.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="end_of_life_fraction">End-of-life fraction</label>
                  <input
                    id="end_of_life_fraction"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={form.end_of_life_fraction}
                    onChange={(event) =>
                      setForm({ ...form, end_of_life_fraction: event.target.value })
                    }
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="electricity_price_eur_per_kwh">Electricity price (EUR/kWh)</label>
                  <input
                    id="electricity_price_eur_per_kwh"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.electricity_price_eur_per_kwh}
                    onChange={(event) =>
                      setForm({ ...form, electricity_price_eur_per_kwh: event.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="actions">
                <button className="button" type="submit">
                  {modalMode === "create" ? "Save scenario" : "Update scenario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
