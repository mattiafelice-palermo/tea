"use client";

import { FormEvent, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { RawMaterial } from "@/types";

const initialForm = {
  name: "",
  cost_per_kg: "",
};

export default function RawMaterialsPage() {
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [selectedRawMaterialId, setSelectedRawMaterialId] = useState<number | null>(null);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");

  const selectedRawMaterial =
    rawMaterials.find((item) => item.id === selectedRawMaterialId) ?? rawMaterials[0] ?? null;

  async function loadRawMaterials(preferredId?: number | null) {
    const data = await api.get<RawMaterial[]>("/raw-materials");
    setRawMaterials(data);
    setSelectedRawMaterialId((current) => {
      if (preferredId && data.some((item) => item.id === preferredId)) {
        return preferredId;
      }
      if (current && data.some((item) => item.id === current)) {
        return current;
      }
      return data[0]?.id ?? null;
    });
  }

  useEffect(() => {
    loadRawMaterials().catch((error: Error) => setMessage(error.message));
  }, []);

  function openCreateModal() {
    setModalMode("create");
    setForm(initialForm);
    setIsModalOpen(true);
  }

  function openEditModal() {
    if (!selectedRawMaterial) {
      return;
    }

    setModalMode("edit");
    setForm({
      name: selectedRawMaterial.name,
      cost_per_kg: String(selectedRawMaterial.cost_per_kg),
    });
    setIsModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const payload = {
        name: form.name,
        cost_per_kg: Number(form.cost_per_kg),
      };
      const saved =
        modalMode === "create"
          ? await api.post<RawMaterial>("/raw-materials", payload)
          : await api.put<RawMaterial>(`/raw-materials/${selectedRawMaterialId}`, payload);

      setForm(initialForm);
      await loadRawMaterials(saved.id);
      setIsModalOpen(false);
      setMessage(modalMode === "create" ? "Raw material saved." : "Raw material updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save raw material");
    }
  }

  async function handleDelete() {
    if (!selectedRawMaterial) {
      return;
    }

    try {
      await api.delete(`/raw-materials/${selectedRawMaterial.id}`);
      await loadRawMaterials();
      setMessage("Raw material deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete raw material");
    }
  }

  return (
    <>
      <div className="components-layout">
        <section className="table-wrap stack">
          <div className="section-header">
            <div>
              <span className="eyebrow">Raw Materials</span>
              <h2>Material cost inputs</h2>
            </div>
            <button className="button" type="button" onClick={openCreateModal}>
              Add raw material
            </button>
          </div>

          <table className="selectable-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Cost (EUR/kg)</th>
              </tr>
            </thead>
            <tbody>
              {rawMaterials.map((rawMaterial) => (
                <tr
                  key={rawMaterial.id}
                  className={rawMaterial.id === selectedRawMaterial?.id ? "selected-row" : ""}
                  onClick={() => setSelectedRawMaterialId(rawMaterial.id)}
                >
                  <td>{rawMaterial.name}</td>
                  <td>{rawMaterial.cost_per_kg.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="message">{message}</div>
        </section>

        <aside className="panel stack preview-panel">
          <div>
            <span className="eyebrow">Preview</span>
            <h2>Selected raw material</h2>
          </div>

          {selectedRawMaterial ? (
            <div className="stack">
              <div className="preview-title-block">
                <h3>{selectedRawMaterial.name}</h3>
              </div>

              <div className="detail-list">
                <div className="detail-item">
                  <span className="detail-label">Cost basis</span>
                  <strong>{selectedRawMaterial.cost_per_kg.toFixed(2)} EUR/kg</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Raw material ID</span>
                  <strong>#{selectedRawMaterial.id}</strong>
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
            <p className="muted">Add a raw material to start building cost formulations.</p>
          )}
        </aside>
      </div>

      {isModalOpen ? (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="section-header">
              <div>
                <span className="eyebrow">
                  {modalMode === "create" ? "New Raw Material" : "Edit Raw Material"}
                </span>
                <h2>{modalMode === "create" ? "Add raw material" : "Update raw material"}</h2>
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
                  {modalMode === "create" ? "Save raw material" : "Update raw material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
