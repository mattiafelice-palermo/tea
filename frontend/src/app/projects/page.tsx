"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import type { Component, Project, ProjectComponent, ProjectSummary, ProjectSummaryComponent } from "@/types";

const initialProjectForm = {
  name: "",
  cell_active_area_cm2: "100",
  cell_thickness_mm: "8",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectSummaries, setProjectSummaries] = useState<ProjectSummary[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectForm, setProjectForm] = useState(initialProjectForm);
  const [selectedComponentId, setSelectedComponentId] = useState<number | "">("");
  const [mass, setMass] = useState("");
  const [editingProjectComponentId, setEditingProjectComponentId] = useState<number | null>(null);
  const [editingComponentId, setEditingComponentId] = useState<number | "">("");
  const [editingMass, setEditingMass] = useState("");
  const [message, setMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);

  function parseSelectNumber(value: string): number | "" {
    return value ? Number(value) : "";
  }

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const selectedSummary = useMemo(
    () => projectSummaries.find((project) => project.id === selectedProjectId) ?? null,
    [projectSummaries, selectedProjectId]
  );

  const modalSummary = useMemo(
    () => projectSummaries.find((project) => project.id === editingProjectId) ?? null,
    [projectSummaries, editingProjectId]
  );

  async function loadProjects(preferredId?: number | null) {
    const [projectData, summaryData] = await Promise.all([
      api.get<Project[]>("/projects"),
      api.get<ProjectSummary[]>("/projects/summaries"),
    ]);
    setProjects(projectData);
    setProjectSummaries(summaryData);
    setSelectedProjectId((current) => {
      if (preferredId && projectData.some((project) => project.id === preferredId)) {
        return preferredId;
      }
      if (current && projectData.some((project) => project.id === current)) {
        return current;
      }
      return projectData[0]?.id ?? null;
    });
  }

  async function loadComponents() {
    setComponents(await api.get<Component[]>("/components"));
  }

  useEffect(() => {
    Promise.all([loadProjects(), loadComponents()]).catch((error: Error) => setMessage(error.message));
  }, []);

  function openCreateModal() {
    setEditingProjectId(null);
    setProjectForm(initialProjectForm);
    setSelectedComponentId("");
    setMass("");
    setEditingProjectComponentId(null);
    setEditingComponentId("");
    setEditingMass("");
    setIsModalOpen(true);
  }

  function openEditModal(project: Project) {
    setEditingProjectId(project.id);
    setProjectForm({
      name: project.name,
      cell_active_area_cm2: String(project.cell_active_area_m2 * 10000),
      cell_thickness_mm: String(project.cell_thickness_mm),
    });
    setSelectedComponentId("");
    setMass("");
    setEditingProjectComponentId(null);
    setEditingComponentId("");
    setEditingMass("");
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingProjectId(null);
    setSelectedComponentId("");
    setMass("");
    setEditingProjectComponentId(null);
    setEditingComponentId("");
    setEditingMass("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const payload = {
        name: projectForm.name,
        cell_active_area_m2: Number(projectForm.cell_active_area_cm2) / 10000,
        cell_thickness_mm: Number(projectForm.cell_thickness_mm),
      };

      const saved = editingProjectId
        ? await api.put<Project>(`/projects/${editingProjectId}`, payload)
        : await api.post<Project>("/projects", payload);

      await loadProjects(saved.id);
      setEditingProjectId(saved.id);
      setMessage(editingProjectId ? "Cell definition updated." : "Cell definition created. You can now manage the bill of materials below.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : editingProjectId
            ? "Failed to update cell definition"
            : "Failed to create cell definition"
      );
    }
  }

  async function handleDeleteProject(projectId: number) {
    try {
      await api.delete(`/projects/${projectId}`);
      if (selectedProjectId === projectId) {
        setSelectedProjectId(null);
      }
      await loadProjects();
      setMessage("Cell definition deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete cell definition");
    }
  }

  async function handleAddComponent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProjectId || !selectedComponentId) {
      setMessage("Choose a cell definition and component first.");
      return;
    }
    if (Number(mass) <= 0) {
      setMessage("Enter a mass greater than 0.");
      return;
    }

    try {
      await api.post<ProjectComponent>("/project-components", {
        project_id: editingProjectId,
        component_id: selectedComponentId,
        mass: Number(mass),
      });
      setMass("");
      setSelectedComponentId("");
      await loadProjects(editingProjectId);
      setMessage("Component saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save component");
    }
  }

  function startEditing(item: ProjectSummaryComponent) {
    setEditingProjectComponentId(item.id);
    setEditingComponentId(item.component_id);
    setEditingMass(String(item.mass));
  }

  async function handleUpdateProjectComponent(itemId: number) {
    if (!editingProjectId) {
      return;
    }
    if (!editingComponentId || Number(editingMass) <= 0) {
      setMessage("Choose a component and enter a mass greater than 0.");
      return;
    }

    try {
      await api.put<ProjectComponent>(`/project-components/${itemId}`, {
        component_id: editingComponentId || undefined,
        mass: Number(editingMass),
      });
      setEditingProjectComponentId(null);
      setEditingComponentId("");
      setEditingMass("");
      await loadProjects(editingProjectId);
      setMessage("Component updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update component");
    }
  }

  async function handleDeleteProjectComponent(itemId: number) {
    if (!editingProjectId) {
      return;
    }

    try {
      await api.delete(`/project-components/${itemId}`);
      await loadProjects(editingProjectId);
      setMessage("Component deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete component");
    }
  }

  return (
    <div className="stack">
      <div className="page-actions">
        <button className="button" type="button" onClick={openCreateModal}>
          Add cell
        </button>
        <div className="message">{message}</div>
      </div>

      <div className="modules-layout">
        <section className="table-wrap modules-table-panel">
          <div>
            <span className="eyebrow">Cell Builder</span>
            <h2>Saved cells</h2>
          </div>
          <table className="selectable-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Total mass (kg)</th>
                <th>Area (cm2)</th>
                <th>Thickness (mm)</th>
                <th>Total cost (EUR)</th>
                <th>Cost/kg (EUR/kg)</th>
                <th>Volume (L)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projectSummaries.map((project) => (
                <tr
                  key={project.id}
                  className={project.id === selectedProjectId ? "selected-row" : ""}
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <td>{project.name}</td>
                  <td>{project.total_mass_kg.toFixed(3)}</td>
                  <td>{(project.cell_active_area_m2 * 10000).toFixed(1)}</td>
                  <td>{project.cell_thickness_mm.toFixed(1)}</td>
                  <td>{project.total_cost_eur.toFixed(2)}</td>
                  <td>{project.cost_per_kg_eur.toFixed(2)}</td>
                  <td>{project.cell_volume_l.toFixed(3)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        type="button"
                        title="Edit cell"
                        aria-label="Edit cell"
                        onClick={(event) => {
                          event.stopPropagation();
                          const projectRecord = projects.find((item) => item.id === project.id);
                          if (projectRecord) {
                            openEditModal(projectRecord);
                          }
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
                        title="Delete cell"
                        aria-label="Delete cell"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteProject(project.id);
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
          <div>
            <span className="eyebrow">Preview</span>
            <h2>Selected cell</h2>
          </div>
          {selectedSummary && selectedProject ? (
            <>
              <div className="detail-list">
                <div className="detail-item">
                  <span className="detail-label">Name</span>
                  <strong>{selectedSummary.name}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Geometry</span>
                  <strong>
                    {(selectedSummary.cell_active_area_m2 * 10000).toFixed(1)} cm2,{" "}
                    {selectedSummary.cell_thickness_mm.toFixed(1)} mm
                  </strong>
                </div>
              </div>

              <div className="card-grid metric-card-grid">
                <article className="card metric-card">
                  <span className="eyebrow">Total mass</span>
                  <p className="metric">{selectedSummary.total_mass_kg.toFixed(3)} kg</p>
                </article>
                <article className="card metric-card">
                  <span className="eyebrow">Total cost</span>
                  <p className="metric">EUR {selectedSummary.total_cost_eur.toFixed(2)}</p>
                </article>
                <article className="card metric-card">
                  <span className="eyebrow">Cost per kg</span>
                  <p className="metric">EUR {selectedSummary.cost_per_kg_eur.toFixed(2)}</p>
                </article>
                <article className="card metric-card">
                  <span className="eyebrow">Cell volume</span>
                  <p className="metric">{selectedSummary.cell_volume_l.toFixed(3)} L</p>
                </article>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Mass (kg)</th>
                    <th>Share</th>
                    <th>Cost (EUR)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSummary.components.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        <div className="muted">{item.category}</div>
                      </td>
                      <td>{item.mass.toFixed(3)}</td>
                      <td>{(item.mass_fraction * 100).toFixed(1)}%</td>
                      <td>{item.cost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="muted">Choose a cell from the table to inspect its geometry, totals, and bill of materials.</p>
          )}
        </aside>
      </div>

      {isModalOpen ? (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-panel modal-wide" onClick={(event) => event.stopPropagation()}>
            <div className="section-header">
              <div>
                <span className="eyebrow">{editingProjectId ? "Edit Cell" : "New Cell"}</span>
                <h2>{editingProjectId ? "Update cell definition" : "Create cell definition"}</h2>
              </div>
              <div className="actions">
                <button className="button" type="submit" form="cell-definition-form">
                  {editingProjectId ? "Update cell" : "Save cell"}
                </button>
                <button className="button secondary" type="button" onClick={closeModal}>
                  Close
                </button>
              </div>
            </div>

            <div className="message">{message}</div>

            <form id="cell-definition-form" onSubmit={handleSubmit} className="stack">
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="project-name">Cell definition name</label>
                  <input
                    id="project-name"
                    value={projectForm.name}
                    onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="cell-area">Cell active area (cm2)</label>
                  <input
                    id="cell-area"
                    type="number"
                    min="0"
                    step="1"
                    value={projectForm.cell_active_area_cm2}
                    onChange={(event) =>
                      setProjectForm({ ...projectForm, cell_active_area_cm2: event.target.value })
                    }
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="cell-thickness">Cell thickness (mm)</label>
                  <input
                    id="cell-thickness"
                    type="number"
                    min="0"
                    step="0.1"
                    value={projectForm.cell_thickness_mm}
                    onChange={(event) =>
                      setProjectForm({ ...projectForm, cell_thickness_mm: event.target.value })
                    }
                    required
                  />
                </div>
              </div>
            </form>

            <div className="stack">
              <div>
                <span className="eyebrow">Bill Of Materials</span>
                <h3>Cell components</h3>
              </div>
              {modalSummary ? (
                <>
                  <form onSubmit={handleAddComponent} className="stack">
                    <div className="form-grid">
                      <div className="field">
                        <label htmlFor="modal-component">Component name</label>
                        <select
                          id="modal-component"
                          value={selectedComponentId}
                          onChange={(event) => setSelectedComponentId(parseSelectNumber(event.target.value))}
                          required
                        >
                          <option value="">Select component</option>
                          {components.map((component) => (
                            <option key={component.id} value={component.id}>
                              {component.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="modal-mass">Mass (kg)</label>
                        <input
                          id="modal-mass"
                          type="number"
                          min="0"
                          step="0.001"
                          value={mass}
                          onChange={(event) => setMass(event.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="actions">
                      <button className="button" type="submit">
                        Add component
                      </button>
                    </div>
                  </form>

                  <table>
                    <thead>
                      <tr>
                        <th>Component</th>
                        <th>Mass (kg)</th>
                        <th>Share</th>
                        <th>Cost (EUR)</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalSummary.components.map((item) => (
                        <tr key={item.id}>
                          <td>
                            {editingProjectComponentId === item.id ? (
                              <select
                                className="table-input"
                                value={editingComponentId}
                                onChange={(event) => setEditingComponentId(parseSelectNumber(event.target.value))}
                              >
                                <option value="">Select component</option>
                                {components.map((component) => (
                                  <option key={component.id} value={component.id}>
                                    {component.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <>
                                <strong>{item.name}</strong>
                                <div className="muted">{item.category}</div>
                              </>
                            )}
                          </td>
                          <td>
                            {editingProjectComponentId === item.id ? (
                              <input
                                className="table-input"
                                type="number"
                                min="0"
                                step="0.001"
                                value={editingMass}
                                onChange={(event) => setEditingMass(event.target.value)}
                              />
                            ) : (
                              item.mass.toFixed(3)
                            )}
                          </td>
                          <td>{(item.mass_fraction * 100).toFixed(1)}%</td>
                          <td>{item.cost.toFixed(2)}</td>
                          <td>
                            <div className="row-actions">
                              {editingProjectComponentId === item.id ? (
                                <>
                                  <button
                                    className="icon-button"
                                    type="button"
                                    title="Save"
                                    onClick={() => handleUpdateProjectComponent(item.id)}
                                  >
                                    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                                      <path
                                        d="M4.5 10.5 8 14l7.5-8"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </button>
                                  <button
                                    className="icon-button"
                                    type="button"
                                    title="Cancel"
                                    onClick={() => {
                                      setEditingProjectComponentId(null);
                                      setEditingComponentId("");
                                      setEditingMass("");
                                    }}
                                  >
                                    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                                      <path
                                        d="m5 5 10 10M15 5 5 15"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                      />
                                    </svg>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="icon-button"
                                    type="button"
                                    title="Edit component"
                                    onClick={() => startEditing(item)}
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
                                    title="Delete component"
                                    onClick={() => handleDeleteProjectComponent(item.id)}
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
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <p className="muted">Save the cell first, then add and edit materials here.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
