"use client";

import { FormEvent, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Component, ComponentFormulation, ComponentRawMaterial, RawMaterial } from "@/types";

const initialForm = {
  name: "",
  category: "anode",
  density: "",
  cost_per_kg: "",
};

const categoryOptions = ["anode", "cathode", "electrolyte", "separator", "casing"];

export default function ComponentsPage() {
  const [components, setComponents] = useState<Component[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [formulation, setFormulation] = useState<ComponentFormulation | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<number | null>(null);
  const [form, setForm] = useState(initialForm);
  const [rawMaterialId, setRawMaterialId] = useState<number | "">("");
  const [massFraction, setMassFraction] = useState("");
  const [formulationInputMode, setFormulationInputMode] = useState<"fraction" | "parts">(
    "fraction"
  );
  const [editingFormulationId, setEditingFormulationId] = useState<number | null>(null);
  const [editingRawMaterialId, setEditingRawMaterialId] = useState<number | "">("");
  const [editingMassFraction, setEditingMassFraction] = useState("");
  const [message, setMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");

  async function loadComponents(preferredId?: number | null) {
    const data = await api.get<Component[]>("/components");
    setComponents(data);
    setSelectedComponentId((current) => {
      if (preferredId && data.some((component) => component.id === preferredId)) {
        return preferredId;
      }
      if (current && data.some((component) => component.id === current)) {
        return current;
      }
      return data[0]?.id ?? null;
    });
  }

  useEffect(() => {
    Promise.all([loadComponents(), loadRawMaterials()]).catch((error: Error) =>
      setMessage(error.message)
    );
  }, []);

  useEffect(() => {
    if (selectedComponentId) {
      loadFormulation(selectedComponentId).catch((error: Error) => setMessage(error.message));
    } else {
      setFormulation(null);
    }
  }, [selectedComponentId]);

  const selectedComponent =
    components.find((component) => component.id === selectedComponentId) ?? components[0] ?? null;

  async function loadRawMaterials() {
    setRawMaterials(await api.get<RawMaterial[]>("/raw-materials"));
  }

  async function loadFormulation(componentId: number) {
    setFormulation(await api.get<ComponentFormulation>(`/components/${componentId}/formulation`));
  }

  function openCreateModal() {
    setModalMode("create");
    setForm(initialForm);
    setRawMaterialId("");
    setMassFraction("");
    setFormulationInputMode("fraction");
    setEditingFormulationId(null);
    setEditingRawMaterialId("");
    setEditingMassFraction("");
    setIsModalOpen(true);
  }

  function openEditModal() {
    if (!selectedComponent) {
      return;
    }

    setModalMode("edit");
    setForm({
      name: selectedComponent.name,
      category: selectedComponent.category,
      density: String(selectedComponent.density),
      cost_per_kg: String(selectedComponent.cost_per_kg),
    });
    setRawMaterialId("");
    setMassFraction("");
    setFormulationInputMode("fraction");
    setEditingFormulationId(null);
    setEditingRawMaterialId("");
    setEditingMassFraction("");
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setRawMaterialId("");
    setMassFraction("");
    setFormulationInputMode("fraction");
    setEditingFormulationId(null);
    setEditingRawMaterialId("");
    setEditingMassFraction("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const payload = {
        ...form,
        density: Number(form.density),
        cost_per_kg: Number(form.cost_per_kg),
      };

      const saved =
        modalMode === "create"
          ? await api.post<Component>("/components", payload)
          : await api.put<Component>(`/components/${selectedComponentId}`, payload);

      setForm({
        name: saved.name,
        category: saved.category,
        density: String(saved.density),
        cost_per_kg: String(saved.cost_per_kg),
      });
      await loadComponents(saved.id);
      await loadFormulation(saved.id);
      setModalMode("edit");
      setMessage(
        modalMode === "create"
          ? "Component saved. You can now add raw materials."
          : "Component updated."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save component");
    }
  }

  async function handleDelete() {
    if (!selectedComponent) {
      return;
    }

    try {
      await api.delete(`/components/${selectedComponent.id}`);
      await loadComponents();
      setMessage("Component deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete component");
    }
  }

  function parseSelectNumber(value: string): number | "" {
    return value ? Number(value) : "";
  }

  function fractionTotalExcluding(rawMaterialIdToExclude?: number | "") {
    return (
      formulation?.items
        .filter((item) => item.raw_material_id !== rawMaterialIdToExclude)
        .reduce((total, item) => total + item.mass_fraction, 0) ?? 0
    );
  }

  function itemFractionTotalExcluding(itemId?: number) {
    return (
      formulation?.items
        .filter((item) => item.id !== itemId)
        .reduce((total, item) => total + item.mass_fraction, 0) ?? 0
    );
  }

  async function handleAddRawMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedComponent || !rawMaterialId) {
      setMessage("Choose a component and raw material first.");
      return;
    }
    const entryValue = Number(massFraction);
    if (entryValue <= 0) {
      setMessage(
        formulationInputMode === "fraction"
          ? "Enter a mass fraction greater than 0."
          : "Enter mass parts greater than 0."
      );
      return;
    }

    try {
      const nextFraction =
        formulationInputMode === "fraction" ? entryValue / 100 : 1;
      if (
        formulationInputMode === "fraction" &&
        fractionTotalExcluding(rawMaterialId) + nextFraction > 1.000001
      ) {
        setMessage("Mass fractions cannot exceed 100%.");
        return;
      }

      await api.post<ComponentRawMaterial>("/component-raw-materials", {
        component_id: selectedComponent.id,
        raw_material_id: rawMaterialId,
        mass_fraction: nextFraction,
        mass_part: formulationInputMode === "parts" ? entryValue : null,
      });
      setRawMaterialId("");
      setMassFraction("");
      await loadFormulation(selectedComponent.id);
      setMessage("Raw material added to formulation.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add raw material");
    }
  }

  function startEditingFormulation(item: ComponentRawMaterial) {
    setEditingFormulationId(item.id);
    setEditingRawMaterialId(item.raw_material_id);
    setEditingMassFraction(
      String(
        formulationInputMode === "parts"
          ? item.mass_part ?? item.mass_fraction * 100
          : item.mass_fraction * 100
      )
    );
  }

  async function handleUpdateFormulation(itemId: number) {
    const entryValue = Number(editingMassFraction);
    if (!selectedComponent || !editingRawMaterialId || entryValue <= 0) {
      setMessage(
        formulationInputMode === "fraction"
          ? "Choose a raw material and enter a mass fraction greater than 0."
          : "Choose a raw material and enter mass parts greater than 0."
      );
      return;
    }

    try {
      const nextFraction =
        formulationInputMode === "fraction" ? entryValue / 100 : 1;
      if (
        formulationInputMode === "fraction" &&
        itemFractionTotalExcluding(itemId) + nextFraction > 1.000001
      ) {
        setMessage("Mass fractions cannot exceed 100%.");
        return;
      }

      await api.put<ComponentRawMaterial>(`/component-raw-materials/${itemId}`, {
        raw_material_id: editingRawMaterialId,
        mass_fraction: nextFraction,
        mass_part: formulationInputMode === "parts" ? entryValue : null,
      });
      setEditingFormulationId(null);
      setEditingRawMaterialId("");
      setEditingMassFraction("");
      await loadFormulation(selectedComponent.id);
      setMessage("Formulation row updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update formulation");
    }
  }

  async function handleDeleteFormulation(itemId: number) {
    if (!selectedComponent) {
      return;
    }

    try {
      await api.delete(`/component-raw-materials/${itemId}`);
      await loadFormulation(selectedComponent.id);
      setMessage("Formulation row deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete formulation row");
    }
  }

  async function handleUseCalculatedCost() {
    if (!selectedComponent) {
      return;
    }

    try {
      const updated = await api.post<Component>(
        `/components/${selectedComponent.id}/use-calculated-cost`,
        {}
      );
      await loadComponents(updated.id);
      await loadFormulation(updated.id);
      setMessage("Component cost updated from raw material formulation.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to apply calculated cost");
    }
  }

  return (
    <>
      <div className="components-layout">
        <section className="table-wrap stack">
          <div className="section-header">
            <div>
              <span className="eyebrow">Component Manager</span>
              <h2>Material library</h2>
            </div>
            <button className="button" type="button" onClick={openCreateModal}>
              Add component
            </button>
          </div>

          <table className="selectable-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Density (kg/L)</th>
                <th>Cost (EUR/kg)</th>
              </tr>
            </thead>
            <tbody>
              {components.map((component) => (
                <tr
                  key={component.id}
                  className={component.id === selectedComponent?.id ? "selected-row" : ""}
                  onClick={() => setSelectedComponentId(component.id)}
                >
                  <td>{component.name}</td>
                  <td>{component.category}</td>
                  <td>{component.density.toFixed(2)}</td>
                  <td>{component.cost_per_kg.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="message">{message}</div>
        </section>

        <aside className="panel stack preview-panel">
          {selectedComponent ? (
            <div className="stack">
              <div className="preview-title-block">
                <div>
                  <span className="eyebrow">Preview</span>
                  <h2>{selectedComponent.name}</h2>
                </div>
                <div className="row-actions">
                  <span className="preview-tag">{selectedComponent.category}</span>
                  <button
                    className="icon-button"
                    type="button"
                    title="Edit component"
                    aria-label="Edit component"
                    onClick={openEditModal}
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
                    aria-label="Delete component"
                    onClick={handleDelete}
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
              </div>

              <div className="detail-list">
                <div className="detail-item">
                  <span className="detail-label">Density</span>
                  <strong>{selectedComponent.density.toFixed(2)} kg/L</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Cost basis</span>
                  <strong>{selectedComponent.cost_per_kg.toFixed(2)} EUR/kg</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Component ID</span>
                  <strong>#{selectedComponent.id}</strong>
                </div>
              </div>

              <div className="stack">
                <div className="section-header">
                  <div>
                    <span className="eyebrow">Formulation</span>
                    <h3>Raw materials</h3>
                  </div>
                </div>

                {formulation ? (
                  <div className="card-grid metric-card-grid">
                    <article className="card metric-card">
                      <span className="eyebrow">Calculated cost</span>
                      <p className="metric">
                        {formulation.calculated_cost_per_kg.toFixed(2)} EUR/kg
                      </p>
                    </article>
                    <article className="card metric-card">
                      <span className="eyebrow">Mass fraction total</span>
                      <p className="metric">{(formulation.total_fraction * 100).toFixed(1)}%</p>
                    </article>
                  </div>
                ) : null}

                {formulation?.items.length ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Raw material</th>
                        <th>Fraction</th>
                        <th>Cost (EUR/kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formulation.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.raw_material.name}</strong>
                          </td>
                          <td>{(item.mass_fraction * 100).toFixed(1)}%</td>
                          <td>{item.raw_material.cost_per_kg.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="muted">This component has no raw material formulation yet.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="muted">Add a component to start building the material library.</p>
          )}
        </aside>
      </div>

      {isModalOpen ? (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-panel modal-wide" onClick={(event) => event.stopPropagation()}>
            <div className="section-header">
              <div>
                <span className="eyebrow">
                  {modalMode === "create" ? "New Component" : "Edit Component"}
                </span>
                <h2>{modalMode === "create" ? "Add material" : "Update material"}</h2>
              </div>
              <button
                className="button secondary"
                type="button"
                onClick={closeModal}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="stack">
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="name">Name</label>
                  <input
                    id="name"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="category">Category</label>
                  <select
                    id="category"
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                  >
                    {categoryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="density">Density (kg/L)</label>
                  <input
                    id="density"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.density}
                    onChange={(event) => setForm({ ...form, density: event.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="cost_per_kg">Cost (EUR/kg)</label>
                  <input
                    id="cost_per_kg"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.cost_per_kg}
                    onChange={(event) => setForm({ ...form, cost_per_kg: event.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="actions">
                <button className="button" type="submit">
                  {modalMode === "create" ? "Save component" : "Update component"}
                </button>
              </div>
            </form>

            <div className="stack">
              <div className="section-header">
                <div>
                  <span className="eyebrow">Formulation</span>
                  <h3>Raw materials</h3>
                </div>
                {modalMode === "edit" && selectedComponent ? (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={handleUseCalculatedCost}
                    disabled={!formulation?.items.length}
                  >
                    Use calculated cost
                  </button>
                ) : null}
              </div>

              {modalMode === "edit" && selectedComponent ? (
                <>
                  {formulation ? (
                    <div className="card-grid metric-card-grid">
                      <article className="card metric-card">
                        <span className="eyebrow">Calculated cost</span>
                        <p className="metric">
                          {formulation.calculated_cost_per_kg.toFixed(2)} EUR/kg
                        </p>
                      </article>
                      <article className="card metric-card">
                        <span className="eyebrow">Mass fraction total</span>
                        <p className="metric">{(formulation.total_fraction * 100).toFixed(1)}%</p>
                      </article>
                    </div>
                  ) : null}

                  <div className="formulation-mode-row">
                    <span className="field-label">Input mode</span>
                    <div className="segmented-control" aria-label="Formulation input mode">
                      <button
                        className={formulationInputMode === "fraction" ? "active" : ""}
                        type="button"
                        onClick={() => {
                          setFormulationInputMode("fraction");
                          setMassFraction("");
                          setEditingFormulationId(null);
                        }}
                      >
                        Mass fraction (%)
                      </button>
                      <button
                        className={formulationInputMode === "parts" ? "active" : ""}
                        type="button"
                        onClick={() => {
                          setFormulationInputMode("parts");
                          setMassFraction("");
                          setEditingFormulationId(null);
                        }}
                      >
                        Mass parts
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleAddRawMaterial} className="stack">
                    <div className="form-grid">
                      <div className="field">
                        <label htmlFor="modal-raw-material">Raw material</label>
                        <select
                          id="modal-raw-material"
                          value={rawMaterialId}
                          onChange={(event) =>
                            setRawMaterialId(parseSelectNumber(event.target.value))
                          }
                          required
                        >
                          <option value="">Select raw material</option>
                          {rawMaterials.map((rawMaterial) => (
                            <option key={rawMaterial.id} value={rawMaterial.id}>
                              {rawMaterial.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="modal-mass-fraction">
                          {formulationInputMode === "fraction"
                            ? "Mass fraction (%)"
                            : "Mass parts"}
                        </label>
                        <input
                          id="modal-mass-fraction"
                          type="number"
                          min="0"
                          step="0.1"
                          value={massFraction}
                          onChange={(event) => setMassFraction(event.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="actions">
                      <button className="button secondary" type="submit">
                        Add raw material
                      </button>
                    </div>
                  </form>

                  {formulation?.items.length ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Raw material</th>
                          <th>Fraction</th>
                          <th>Cost (EUR/kg)</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formulation.items.map((item) => (
                          <tr key={item.id}>
                            <td>
                              {editingFormulationId === item.id ? (
                                <select
                                  className="table-input"
                                  value={editingRawMaterialId}
                                  onChange={(event) =>
                                    setEditingRawMaterialId(parseSelectNumber(event.target.value))
                                  }
                                >
                                  <option value="">Select raw material</option>
                                  {rawMaterials.map((rawMaterial) => (
                                    <option key={rawMaterial.id} value={rawMaterial.id}>
                                      {rawMaterial.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <strong>{item.raw_material.name}</strong>
                              )}
                            </td>
                            <td>
                              {editingFormulationId === item.id ? (
                                <input
                                  className="table-input"
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={editingMassFraction}
                                  onChange={(event) => setEditingMassFraction(event.target.value)}
                                />
                              ) : (
                                `${(item.mass_fraction * 100).toFixed(1)}%`
                              )}
                            </td>
                            <td>{item.raw_material.cost_per_kg.toFixed(2)}</td>
                            <td>
                              <div className="row-actions">
                                {editingFormulationId === item.id ? (
                                  <>
                                    <button
                                      className="icon-button"
                                      type="button"
                                      title="Save"
                                      onClick={() => handleUpdateFormulation(item.id)}
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
                                        setEditingFormulationId(null);
                                        setEditingRawMaterialId("");
                                        setEditingMassFraction("");
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
                                      title="Edit raw material row"
                                      onClick={() => startEditingFormulation(item)}
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
                                      title="Delete raw material row"
                                      onClick={() => handleDeleteFormulation(item.id)}
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
                  ) : (
                    <p className="muted">This component has no raw material formulation yet.</p>
                  )}
                </>
              ) : (
                <p className="muted">Save the component first, then add its raw materials.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
