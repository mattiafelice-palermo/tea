"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Project, Result, Scenario } from "@/types";

export default function ResultsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">("");
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | "">("");
  const [result, setResult] = useState<Result | null>(null);
  const [isLoadingResult, setIsLoadingResult] = useState(false);
  const [message, setMessage] = useState("");

  function parseSelectNumber(value: string): number | "" {
    return value ? Number(value) : "";
  }

  async function loadProjects() {
    const data = await api.get<Project[]>("/projects");
    setProjects(data);
    if (!selectedProjectId && data.length > 0) {
      setSelectedProjectId(data[0].id);
    }
  }

  async function loadScenarios(projectId: number) {
    const data = await api.get<Scenario[]>(`/scenarios?project_id=${projectId}`);
    setScenarios(data);
    setSelectedScenarioId(data[0]?.id ?? "");
    setResult(null);
  }

  useEffect(() => {
    loadProjects().catch((error: Error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadScenarios(selectedProjectId).catch((error: Error) => setMessage(error.message));
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedScenarioId) {
      refreshResult(selectedScenarioId).catch((error: Error) => {
        setMessage(error.message);
        setIsLoadingResult(false);
      });
    } else {
      setResult(null);
    }
  }, [selectedScenarioId]);

  async function refreshResult(scenarioId: number) {
    setIsLoadingResult(true);
    setMessage("");
    const data = await api.post<Result>(`/calculate/${scenarioId}`, {});
    setResult(data);
    setIsLoadingResult(false);
    setMessage("Results are up to date.");
  }

  async function handleRefresh() {
    if (!selectedScenarioId) {
      setMessage("Choose a scenario first.");
      return;
    }

    try {
      await refreshResult(selectedScenarioId);
    } catch (error) {
      setIsLoadingResult(false);
      setMessage(error instanceof Error ? error.message : "Calculation failed");
    }
  }

  const cards = result
    ? [
        { label: "Total mass", value: `${result.total_mass.toFixed(3)} kg` },
        { label: "Total cost", value: `EUR ${result.total_cost.toFixed(2)}` },
        { label: "Energy", value: `${result.energy_wh.toFixed(2)} Wh` },
        { label: "Specific energy", value: `${result.specific_energy.toFixed(2)} Wh/kg` },
        { label: "Efficiency", value: `${(result.round_trip_efficiency * 100).toFixed(1)}%` },
        { label: "Lifetime energy", value: `${result.lifetime_energy.toFixed(2)} Wh` },
        { label: "Cost per kWh", value: `EUR ${result.cost_per_kwh.toFixed(2)}/kWh` },
        {
          label: "Cost per kWh-cycle",
          value: `EUR ${result.cost_per_kwh_cycle.toFixed(4)}/(kWh*cycle)`,
        },
        {
          label: "Cost per lifetime kWh",
          value: `EUR ${result.cost_per_lifetime_kwh.toFixed(2)}/kWh`,
        },
        {
          label: "LCOS",
          value: `EUR ${(result.lcos * 1000).toFixed(2)}/MWh`,
        },
      ]
    : [];

  return (
    <div className="stack">
      <section className="panel stack">
        <div>
          <span className="eyebrow">Calculation</span>
          <h2>Run backend metrics</h2>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="project">Project</label>
            <select
              id="project"
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(parseSelectNumber(event.target.value))}
            >
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="scenario">Scenario</label>
            <select
              id="scenario"
              value={selectedScenarioId}
              onChange={(event) => setSelectedScenarioId(parseSelectNumber(event.target.value))}
            >
              <option value="">Select scenario</option>
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  Scenario #{scenario.id}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="actions">
          <button className="button secondary" type="button" onClick={handleRefresh}>
            Refresh
          </button>
        </div>
        <div className="message">{isLoadingResult ? "Updating results..." : message}</div>
      </section>

      <section className="card-grid">
        {cards.map((card) => (
          <article key={card.label} className="card">
            <span className="eyebrow">{card.label}</span>
            <p className="metric">{card.value}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
