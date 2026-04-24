"use client";

import { FormEvent, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Component } from "@/types";

const initialForm = {
  name: "",
  category: "anode",
  density: "",
  cost_per_kg: "",
};

const categoryOptions = ["anode", "cathode", "electrolyte", "separator", "casing"];

export default function ComponentsPage() {
  const [components, setComponents] = useState<Component[]>([]);
  const [selectedComponentId, setSelectedComponentId] = useState<number | null>(null);
  const [form, setForm] = useState(initialForm);
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
    loadComponents().catch((error: Error) => setMessage(error.message));
  }, []);

  const selectedComponent =
    components.find((component) => component.id === selectedComponentId) ?? components[0] ?? null;

  function openCreateModal() {
    setModalMode("create");
    setForm(initialForm);
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
    setIsModalOpen(true);
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

      setForm(initialForm);
      await loadComponents(saved.id);
      setIsModalOpen(false);
      setMessage(modalMode === "create" ? "Component saved." : "Component updated.");
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
          <div>
            <span className="eyebrow">Preview</span>
            <h2>Selected component</h2>
          </div>

          {selectedComponent ? (
            <div className="stack">
              <div className="preview-title-block">
                <h3>{selectedComponent.name}</h3>
                <span className="preview-tag">{selectedComponent.category}</span>
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

              <div className="actions">
                <button className="button secondary" type="button" onClick={openEditModal}>
                  Edit
                </button>
                <button className="button danger" type="button" onClick={handleDelete}>
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <p className="muted">Add a component to start building the material library.</p>
          )}
        </aside>
      </div>

      {isModalOpen ? (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
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
                onClick={() => setIsModalOpen(false)}
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
          </div>
        </div>
      ) : null}
    </>
  );
}
