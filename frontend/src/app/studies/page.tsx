"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

import { api } from "@/lib/api";
import type {
  ComponentFormulation,
  ModuleConfiguration,
  Project,
  ProjectSummary,
  Scenario,
  StudyMetadata,
  StudyModel,
  StudyModelPoint,
  StudySweepResponse,
} from "@/types";

type Tab = "performance" | "degradation" | "sweep";
type ModelKind = "performance" | "degradation";
type VariationMode = "additive" | "replace_specific" | "rescale_others";

const initialForm = {
  id: "",
  name: "",
  kind: "performance" as ModelKind,
  input_variable: "",
  output_metric: "avg_discharge_voltage",
  correlation_type: "lookup" as "linear" | "lookup" | "formula",
  variation_mode: "additive" as VariationMode,
  replacement_variable: "",
  slope: "1",
  intercept: "0",
  expression: "x",
  pointsText: "0, 0\n1, 0",
};

const PERFORMANCE_FORMULA_PRESETS = [
  { label: "Linear delta", expression: "0.01 * x" },
  { label: "Square-root response", expression: "0.08 * sqrt(x + 1)" },
  { label: "Log response", expression: "0.12 * log(x + 1)" },
  { label: "Saturating response", expression: "0.4 * (1 - exp(-0.03 * x))" },
];

const DEGRADATION_FORMULA_PRESETS = [
  { label: "Mild linear fade", expression: "1 - 0.00008 * x" },
  { label: "Exponential fade", expression: "exp(-0.0002 * x)" },
  { label: "Log fade", expression: "1 - 0.05 * log(x + 1)" },
];

type VariableOption = {
  value: string;
  label: string;
  unit: string;
  baseline: number;
  kind: "component" | "raw_material";
  parentKey: string;
};

type VariableCategory = {
  id: string;
  label: string;
  options: VariableOption[];
};

type LookupDraftPoint = {
  x: string;
  y: string;
};

type PlotPoint = {
  x: number;
  y: number;
};

type SweepMetricSummary = {
  key: string;
  label: string;
  unit: string;
  baseline: number;
  low: number;
  high: number;
  values: number[];
};

type MetricTrendDirection = "higher_is_better" | "lower_is_better" | "neutral";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const studiesTw = [
  "space-y-6 text-slate-800",
  "[&_.stack]:space-y-4",
  "[&_.panel]:rounded-2xl [&_.panel]:border [&_.panel]:border-slate-200 [&_.panel]:bg-white/95 [&_.panel]:p-5 [&_.panel]:shadow-sm",
  "[&_.table-wrap]:rounded-2xl [&_.table-wrap]:border [&_.table-wrap]:border-slate-200 [&_.table-wrap]:bg-white [&_.table-wrap]:p-5 [&_.table-wrap]:shadow-sm",
  "[&_.eyebrow]:text-xs [&_.eyebrow]:font-semibold [&_.eyebrow]:uppercase [&_.eyebrow]:tracking-[0.16em] [&_.eyebrow]:text-slate-500",
  "[&_.muted]:text-sm [&_.muted]:text-slate-500",
  "[&_.message]:text-sm [&_.message]:font-medium [&_.message]:text-slate-600",
  "[&_.form-grid]:grid [&_.form-grid]:gap-4 md:[&_.form-grid]:grid-cols-2 xl:[&_.form-grid]:grid-cols-3",
  "[&_.field]:space-y-2",
  "[&_.field_label]:block [&_.field_label]:text-xs [&_.field_label]:font-semibold [&_.field_label]:uppercase [&_.field_label]:tracking-wide [&_.field_label]:text-slate-500",
  "[&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-300 [&_input]:bg-white [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-sm [&_input]:text-slate-900 [&_input]:outline-none focus:[&_input]:border-slate-500",
  "[&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-slate-300 [&_select]:bg-white [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-sm [&_select]:text-slate-900 [&_select]:outline-none focus:[&_select]:border-slate-500",
  "[&_.actions]:flex [&_.actions]:flex-wrap [&_.actions]:gap-2",
  "[&_.button]:inline-flex [&_.button]:items-center [&_.button]:justify-center [&_.button]:rounded-xl [&_.button]:bg-slate-900 [&_.button]:px-4 [&_.button]:py-2.5 [&_.button]:text-sm [&_.button]:font-semibold [&_.button]:text-white [&_.button]:transition hover:[&_.button]:bg-slate-700 disabled:[&_.button]:cursor-not-allowed disabled:[&_.button]:opacity-60",
  "[&_.button.secondary]:border [&_.button.secondary]:border-slate-300 [&_.button.secondary]:bg-white [&_.button.secondary]:text-slate-700 hover:[&_.button.secondary]:bg-slate-100",
  "[&_.button.muted-disabled]:border [&_.button.muted-disabled]:border-slate-200 [&_.button.muted-disabled]:bg-slate-200 [&_.button.muted-disabled]:text-slate-400 [&_.button.muted-disabled]:opacity-100 [&_.button.muted-disabled]:cursor-default hover:[&_.button.muted-disabled]:bg-slate-200",
  "[&_.icon-button]:inline-flex [&_.icon-button]:h-8 [&_.icon-button]:w-8 [&_.icon-button]:items-center [&_.icon-button]:justify-center [&_.icon-button]:rounded-lg [&_.icon-button]:border [&_.icon-button]:border-slate-200 [&_.icon-button]:text-slate-600 hover:[&_.icon-button]:bg-slate-100",
  "[&_.icon-button.danger]:text-rose-600 [&_.icon-button.danger]:border-rose-200 hover:[&_.icon-button.danger]:bg-rose-50",
  "[&_.row-actions]:flex [&_.row-actions]:items-center [&_.row-actions]:gap-2",
  "[&_.tab-bar]:inline-flex [&_.tab-bar]:gap-2 [&_.tab-bar]:rounded-xl [&_.tab-bar]:border [&_.tab-bar]:border-slate-200 [&_.tab-bar]:bg-slate-100 [&_.tab-bar]:p-1",
  "[&_.tab-bar_button]:rounded-lg [&_.tab-bar_button]:px-3 [&_.tab-bar_button]:py-2 [&_.tab-bar_button]:text-sm [&_.tab-bar_button]:font-semibold [&_.tab-bar_button]:text-slate-600 [&_.tab-bar_button]:transition hover:[&_.tab-bar_button]:text-slate-900",
  "[&_.tab-bar_button:disabled]:cursor-not-allowed [&_.tab-bar_button:disabled]:opacity-40",
  "[&_.tab-bar_.active]:bg-white [&_.tab-bar_.active]:text-slate-900 [&_.tab-bar_.active]:shadow-sm",
  "[&_.detail-list]:grid [&_.detail-list]:gap-3 sm:[&_.detail-list]:grid-cols-3",
  "[&_.detail-item]:rounded-xl [&_.detail-item]:border [&_.detail-item]:border-slate-200 [&_.detail-item]:bg-slate-50 [&_.detail-item]:p-3",
  "[&_.detail-label]:block [&_.detail-label]:text-xs [&_.detail-label]:font-semibold [&_.detail-label]:uppercase [&_.detail-label]:tracking-wide [&_.detail-label]:text-slate-500",
  "[&_.variable-picker]:relative",
  "[&_.variable-menu]:absolute [&_.variable-menu]:z-10 [&_.variable-menu]:mt-2 [&_.variable-menu]:max-h-72 [&_.variable-menu]:w-full [&_.variable-menu]:overflow-auto [&_.variable-menu]:rounded-xl [&_.variable-menu]:border [&_.variable-menu]:border-slate-200 [&_.variable-menu]:bg-white [&_.variable-menu]:p-2 [&_.variable-menu]:shadow-lg",
  "[&_.variable-category]:border-b [&_.variable-category]:border-slate-100 [&_.variable-category:last-child]:border-b-0",
  "[&_.variable-category-button]:flex [&_.variable-category-button]:w-full [&_.variable-category-button]:items-center [&_.variable-category-button]:gap-2 [&_.variable-category-button]:rounded-md [&_.variable-category-button]:px-2 [&_.variable-category-button]:py-1.5 [&_.variable-category-button]:text-left [&_.variable-category-button]:text-xs [&_.variable-category-button]:font-semibold [&_.variable-category-button]:uppercase [&_.variable-category-button]:tracking-wide [&_.variable-category-button]:text-slate-500 hover:[&_.variable-category-button]:bg-slate-100",
  "[&_.variable-options]:space-y-1 [&_.variable-options]:pb-2 [&_.variable-options]:pt-1",
  "[&_.variable-options_button]:w-full [&_.variable-options_button]:rounded-md [&_.variable-options_button]:px-2 [&_.variable-options_button]:py-1.5 [&_.variable-options_button]:text-left [&_.variable-options_button]:text-sm [&_.variable-options_button]:text-slate-700 hover:[&_.variable-options_button]:bg-slate-100",
  "[&_.lookup-editor]:space-y-3",
  "[&_.lookup-table-shell]:overflow-x-auto [&_.lookup-table-shell]:rounded-xl [&_.lookup-table-shell]:border [&_.lookup-table-shell]:border-slate-200",
  "[&_.table-input]:w-full [&_.table-input]:rounded-lg [&_.table-input]:border [&_.table-input]:border-slate-300 [&_.table-input]:px-2.5 [&_.table-input]:py-1.5 [&_.table-input]:text-sm",
  "[&_.plot-wrap]:relative [&_.plot-wrap]:overflow-visible [&_.plot-wrap]:p-0",
  "[&_.plot-wrap_svg]:h-[260px] [&_.plot-wrap_svg]:w-full",
  "[&_.plot-wrap_line]:stroke-slate-300",
  "[&_.plot-wrap_path]:fill-none [&_.plot-wrap_path]:stroke-slate-800 [&_.plot-wrap_path]:stroke-[2.5]",
  "[&_.plot-wrap_circle]:fill-slate-800",
  "[&_.plot-wrap_text]:fill-slate-500 [&_.plot-wrap_text]:text-[11px]",
  "[&_.plot-wrap-placeholder]:absolute [&_.plot-wrap-placeholder]:inset-0 [&_.plot-wrap-placeholder]:grid [&_.plot-wrap-placeholder]:place-items-center",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
  "[&_thead_th]:border-b [&_thead_th]:border-slate-200 [&_thead_th]:px-3 [&_thead_th]:py-2 [&_thead_th]:text-left [&_thead_th]:text-xs [&_thead_th]:font-semibold [&_thead_th]:uppercase [&_thead_th]:tracking-wide [&_thead_th]:text-slate-500",
  "[&_tbody_td]:border-b [&_tbody_td]:border-slate-100 [&_tbody_td]:px-3 [&_tbody_td]:py-2.5 [&_tbody_td]:align-top",
  "[&_.empty-table-cell]:py-6 [&_.empty-table-cell]:text-center [&_.empty-table-cell]:text-slate-500",
  "[&_.page-grid]:grid [&_.page-grid]:gap-5 xl:[&_.page-grid]:grid-cols-2",
  "[&_.section-header-row]:flex [&_.section-header-row]:flex-wrap [&_.section-header-row]:items-start [&_.section-header-row]:justify-between [&_.section-header-row]:gap-4",
  "[&_.modal-title-row]:flex [&_.modal-title-row]:flex-wrap [&_.modal-title-row]:items-start [&_.modal-title-row]:justify-between [&_.modal-title-row]:gap-4",
  "[&_.modal-title-main]:m-0 [&_.modal-title-main]:text-2xl [&_.modal-title-main]:font-bold [&_.modal-title-main]:uppercase [&_.modal-title-main]:tracking-[0.08em] [&_.modal-title-main]:text-slate-900",
  "[&_.modal-header-actions]:flex [&_.modal-header-actions]:items-center [&_.modal-header-actions]:gap-2",
  "[&_.modal-split]:grid [&_.modal-split]:gap-5",
  "[&_.study-modal-split]:xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]",
  "[&_.confirm-backdrop]:fixed [&_.confirm-backdrop]:inset-0 [&_.confirm-backdrop]:z-[60] [&_.confirm-backdrop]:grid [&_.confirm-backdrop]:place-items-center [&_.confirm-backdrop]:bg-slate-950/50 [&_.confirm-backdrop]:p-4",
  "[&_.confirm-panel]:w-[min(460px,92vw)] [&_.confirm-panel]:rounded-2xl [&_.confirm-panel]:border [&_.confirm-panel]:border-slate-200 [&_.confirm-panel]:bg-white [&_.confirm-panel]:p-5 [&_.confirm-panel]:shadow-2xl",
  "[&_.confirm-actions]:mt-4 [&_.confirm-actions]:flex [&_.confirm-actions]:flex-wrap [&_.confirm-actions]:justify-end [&_.confirm-actions]:gap-2",
].join(" ");

function parseSelectNumber(value: string): number | "" {
  return value ? Number(value) : "";
}

function parsePoints(pointsText: string, xScale = 1): StudyModelPoint[] {
  return pointsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [x, y] = line.split(",").map((value) => Number(value.trim()));
      return { x: x * xScale, y };
    })
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function pointsToText(points: StudyModelPoint[], xScale = 1) {
  return points.map((point) => `${point.x * xScale}, ${point.y}`).join("\n");
}

function draftRowsFromText(pointsText: string): LookupDraftPoint[] {
  const rows = pointsText
    .split("\n")
    .map((line) => {
      const [x = "", y = ""] = line.split(",");
      return { x: x.trim(), y: y.trim() };
    })
    .filter((point) => point.x !== "" || point.y !== "");

  return rows.length ? rows : [{ x: "", y: "" }];
}

function draftRowsToText(rows: LookupDraftPoint[]) {
  return rows.map((point) => `${point.x}, ${point.y}`).join("\n");
}

function buildPayload(
  form: typeof initialForm,
  baselineInputValue: number,
  baselineOutputValue: number
) {
  const xScale = form.kind === "performance" && form.variation_mode === "additive" ? 0.001 : 1;
  const correlationParameters =
    form.correlation_type === "linear"
      ? { slope: Number(form.slope) / xScale, intercept: Number(form.intercept) }
      : form.correlation_type === "formula"
        ? { expression: toBackendFormulaExpression(form.expression, form) }
        : {};
  const parameters = {
    ...correlationParameters,
    variation_mode: form.variation_mode,
    replacement_variable: form.replacement_variable,
    baseline_input_value: baselineInputValue,
    baseline_output_value: baselineOutputValue,
  };

  return {
    name: form.name,
    kind: form.kind,
    input_variable: form.input_variable,
    output_metric: form.output_metric,
    correlation_type: form.correlation_type,
    parameters,
    points: form.correlation_type === "lookup" ? parsePoints(form.pointsText, xScale) : [],
  };
}

function lookupRows(pointsText: string): StudyModelPoint[] {
  const rows = parsePoints(pointsText);
  return rows.length ? rows : [{ x: 0, y: 0 }];
}

function outputUnit(value: string) {
  const units: Record<string, string> = {
    avg_discharge_voltage: "V",
    avg_charge_voltage: "V",
    discharge_capacity: "mAh",
    cycle_life: "cycles",
    end_of_life_fraction: "fraction",
    electricity_price_eur_per_kwh: "EUR/kWh",
    module_current_a: "A",
    cells_in_series: "cells",
    cells_in_parallel: "cells",
    mass_overhead_fraction: "fraction",
    volume_overhead_fraction: "fraction",
    cost_overhead_fraction: "fraction",
    capacity_retention: "fraction",
    discharge_voltage_retention: "fraction",
    energy_retention: "fraction",
  };
  return units[value] ?? "";
}

function metricUnit(value: string) {
  const units: Record<string, string> = {
    total_mass: "kg",
    total_cost: "EUR",
    energy_wh: "Wh",
    specific_energy: "Wh/kg",
    round_trip_efficiency: "fraction",
    lifetime_energy: "Wh",
    cost_per_kwh: "EUR/kWh",
    cost_per_kwh_cycle: "EUR/(kWh*cycle)",
    cost_per_lifetime_kwh: "EUR/kWh",
    lcos: "EUR/kWh",
    module_voltage_v: "V",
    module_capacity_ah: "Ah",
    module_energy_wh: "Wh",
    module_power_w: "W",
    discharge_time_h: "h",
    cell_current_a: "A",
    cell_current_density_ma_per_cm2: "mA/cm2",
    module_mass_kg: "kg",
    module_volume_l: "L",
    module_cost: "EUR",
    module_specific_energy_wh_per_kg: "Wh/kg",
    module_volumetric_energy_wh_per_l: "Wh/L",
    module_specific_power_w_per_kg: "W/kg",
    module_volumetric_power_w_per_l: "W/L",
    module_cost_per_kwh: "EUR/kWh",
    module_cost_per_lifetime_kwh: "EUR/kWh",
    module_lcos: "EUR/kWh",
  };
  return units[value] ?? "";
}

function metricTrendDirection(value: string): MetricTrendDirection {
  const directions: Record<string, MetricTrendDirection> = {
    total_mass: "lower_is_better",
    total_cost: "lower_is_better",
    energy_wh: "higher_is_better",
    specific_energy: "higher_is_better",
    round_trip_efficiency: "higher_is_better",
    lifetime_energy: "higher_is_better",
    cost_per_kwh: "lower_is_better",
    cost_per_kwh_cycle: "lower_is_better",
    cost_per_lifetime_kwh: "lower_is_better",
    lcos: "lower_is_better",
    module_voltage_v: "higher_is_better",
    module_capacity_ah: "higher_is_better",
    module_energy_wh: "higher_is_better",
    module_power_w: "higher_is_better",
    discharge_time_h: "higher_is_better",
    cell_current_a: "neutral",
    cell_current_density_ma_per_cm2: "lower_is_better",
    module_mass_kg: "lower_is_better",
    module_volume_l: "lower_is_better",
    module_cost: "lower_is_better",
    module_specific_energy_wh_per_kg: "higher_is_better",
    module_volumetric_energy_wh_per_l: "higher_is_better",
    module_specific_power_w_per_kg: "higher_is_better",
    module_volumetric_power_w_per_l: "higher_is_better",
    module_cost_per_kwh: "lower_is_better",
    module_cost_per_lifetime_kwh: "lower_is_better",
    module_lcos: "lower_is_better",
  };
  return directions[value] ?? "neutral";
}

function metricValuePrecision(value: string) {
  const precision: Record<string, number> = {
    total_mass: 2,
    total_cost: 2,
    energy_wh: 1,
    specific_energy: 1,
    round_trip_efficiency: 3,
    lifetime_energy: 0,
    cost_per_kwh: 2,
    cost_per_kwh_cycle: 3,
    cost_per_lifetime_kwh: 3,
    lcos: 2,
    module_voltage_v: 2,
    module_capacity_ah: 1,
    module_energy_wh: 1,
    module_power_w: 1,
    discharge_time_h: 2,
    cell_current_a: 2,
    cell_current_density_ma_per_cm2: 1,
    module_mass_kg: 2,
    module_volume_l: 2,
    module_cost: 2,
    module_specific_energy_wh_per_kg: 1,
    module_volumetric_energy_wh_per_l: 1,
    module_specific_power_w_per_kg: 1,
    module_volumetric_power_w_per_l: 1,
    module_cost_per_kwh: 2,
    module_cost_per_lifetime_kwh: 3,
    module_lcos: 2,
  };
  return precision[value] ?? 2;
}

function isCostMetricKey(metricKey: string) {
  return [
    "total_cost",
    "module_cost",
    "cost_per_kwh",
    "cost_per_kwh_cycle",
    "cost_per_lifetime_kwh",
    "module_cost_per_kwh",
    "module_cost_per_lifetime_kwh",
    "lcos",
    "module_lcos",
  ].includes(metricKey);
}

function withUnit(label: string, unit: string) {
  return unit ? `${label} (${unit})` : label;
}

function unitText(unit: string) {
  return unit ? `(${unit})` : "";
}

function dashboardMetricTitle(label: string, scope: "cell" | "module") {
  if (scope === "module") {
    return label.replace(/^module\s+/i, "");
  }
  return label;
}

function modelDeltaUnit(model?: StudyModel) {
  if (!model || model.kind !== "performance") {
    return "";
  }
  return model.parameters.variation_mode === "additive" ? "g" : "percentage points";
}

function modelUsesAdditiveMass(model?: StudyModel) {
  return Boolean(model && model.kind === "performance" && model.parameters.variation_mode === "additive");
}

function displayXScale(model?: StudyModel) {
  return modelUsesAdditiveMass(model) ? 1000 : 1;
}

function displayXValue(value: number, model?: StudyModel) {
  return value * displayXScale(model);
}

function backendXValue(value: number, model?: StudyModel) {
  return value / displayXScale(model);
}

function normalizeFormulaExpression(expression: string) {
  return expression.replace(/\^/g, "**");
}

function toBackendFormulaExpression(expression: string, form: typeof initialForm) {
  const normalized = normalizeFormulaExpression(expression);
  if (form.kind === "performance" && form.variation_mode === "additive") {
    return normalized.replace(/\bx\b/g, "(x*1000)");
  }
  return normalized;
}

function createFormulaEvaluator(expression: string) {
  const normalized = normalizeFormulaExpression(expression.trim());
  if (!normalized) {
    return { ok: false as const, error: "Formula cannot be empty." };
  }
  if (!/^[0-9+\-*/().,\s^A-Za-z_]+$/.test(normalized)) {
    return { ok: false as const, error: "Formula contains unsupported characters." };
  }

  const identifiers = normalized.match(/[A-Za-z_]\w*/g) ?? [];
  const allowedNames = new Set(["x", "sqrt", "log", "exp", "pow"]);
  for (const identifier of identifiers) {
    if (!allowedNames.has(identifier)) {
      return { ok: false as const, error: `Formula name '${identifier}' is not allowed.` };
    }
  }

  try {
    const evaluator = new Function(
      "x",
      "sqrt",
      "log",
      "exp",
      "pow",
      `"use strict"; return (${normalized});`
    ) as (x: number, sqrt: typeof Math.sqrt, log: typeof Math.log, exp: typeof Math.exp, pow: typeof Math.pow) => number;

    return {
      ok: true as const,
      evaluate: (x: number) => evaluator(x, Math.sqrt, Math.log, Math.exp, Math.pow),
    };
  } catch {
    return { ok: false as const, error: "Formula syntax is invalid." };
  }
}

function defaultPreviewDeltas(
  form: typeof initialForm,
  baselineInputValue: number,
  baselineInputShare: number | null,
  selectedScenario?: Scenario | null
) {
  if (form.kind === "degradation") {
    const maxCycle = Math.max(100, selectedScenario?.cycle_life ?? 1000);
    return Array.from({ length: 9 }, (_, index) => (maxCycle / 8) * index);
  }

  if (form.variation_mode === "additive") {
    const baselineMassG = Math.max(1, Math.abs(baselineInputValue * 1000));
    const span = Math.max(1, baselineMassG * 0.35);
    return [-span, -span / 2, -span / 4, 0, span / 4, span / 2, span];
  }

  const share = Math.abs(baselineInputShare ?? 0);
  const span = Math.max(20, Math.min(60, share * 0.6 + 20));
  return [-span, -span / 2, -10, 0, 10, span / 2, span];
}

function cloneModelForm(form: typeof initialForm) {
  return { ...form };
}

function formsEqual(left: typeof initialForm, right: typeof initialForm) {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.kind === right.kind &&
    left.input_variable === right.input_variable &&
    left.output_metric === right.output_metric &&
    left.correlation_type === right.correlation_type &&
    left.variation_mode === right.variation_mode &&
    left.replacement_variable === right.replacement_variable &&
    left.slope === right.slope &&
    left.intercept === right.intercept &&
    left.expression === right.expression &&
    left.pointsText === right.pointsText
  );
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return value.toFixed(1);
  }
  if (abs >= 10) {
    return value.toFixed(2);
  }
  return value.toFixed(4);
}

function DataTable<T>({
  columns,
  data,
  className = "",
}: {
  columns: ColumnDef<T>[];
  data: T[];
  className?: string;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <table className={`data-table ${className}`}>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={columns.length} className="empty-table-cell">
              No rows yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function LookupEditor({
  pointsText,
  onChange,
  xHeader,
  yHeader,
}: {
  pointsText: string;
  onChange: (pointsText: string) => void;
  xHeader: string;
  yHeader: string;
}) {
  const [rows, setRows] = useState<LookupDraftPoint[]>(() => draftRowsFromText(pointsText));
  const previousSerializedRef = useRef(draftRowsToText(draftRowsFromText(pointsText)));
  const hasUserInteractedRef = useRef(false);

  useEffect(() => {
    const incomingRows = draftRowsFromText(pointsText);
    const incomingSerialized = draftRowsToText(incomingRows);
    hasUserInteractedRef.current = false;
    previousSerializedRef.current = incomingSerialized;
    setRows((currentRows) => {
      const currentSerialized = draftRowsToText(currentRows);
      return currentSerialized === incomingSerialized ? currentRows : incomingRows;
    });
  }, [pointsText]);

  useEffect(() => {
    const serialized = draftRowsToText(rows);
    if (serialized === previousSerializedRef.current) {
      return;
    }
    previousSerializedRef.current = serialized;
    if (!hasUserInteractedRef.current) {
      return;
    }
    onChange(serialized);
  }, [rows, onChange]);

  const updateRow = useCallback(
    (index: number, key: keyof LookupDraftPoint, value: string) => {
      hasUserInteractedRef.current = true;
      setRows((currentRows) =>
        currentRows.map((row, rowIndex) =>
          rowIndex === index ? { ...row, [key]: value } : row
        )
      );
    },
    []
  );

  const removeRow = useCallback(
    (index: number) => {
      hasUserInteractedRef.current = true;
      setRows((currentRows) => {
        const nextRows = currentRows.filter((_item, rowIndex) => rowIndex !== index);
        return nextRows.length ? nextRows : [{ x: "", y: "" }];
      });
    },
    []
  );

  const addRow = useCallback(() => {
    hasUserInteractedRef.current = true;
    setRows((currentRows) => {
      const lastNumericX = Number(currentRows[currentRows.length - 1]?.x);
      const nextX = Number.isFinite(lastNumericX) ? String(lastNumericX + 1) : "";
      return [...currentRows, { x: nextX, y: "" }];
    });
  }, []);

  const columns = useMemo<ColumnDef<LookupDraftPoint>[]>(
    () => [
      {
        accessorKey: "x",
        header: xHeader,
        cell: ({ row }) => (
          <input
            className="table-input"
            inputMode="decimal"
            value={row.original.x}
            onChange={(event) => updateRow(row.index, "x", event.target.value)}
            placeholder="0"
          />
        ),
      },
      {
        accessorKey: "y",
        header: yHeader,
        cell: ({ row }) => (
          <input
            className="table-input"
            inputMode="decimal"
            value={row.original.y}
            onChange={(event) => updateRow(row.index, "y", event.target.value)}
            placeholder="0"
          />
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <button
            className="icon-button danger"
            type="button"
            title="Remove lookup point"
            onClick={() => removeRow(row.index)}
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
        ),
      },
    ],
    [removeRow, updateRow, xHeader, yHeader]
  );

  return (
    <div className="lookup-editor">
      <div className="lookup-table-shell">
        <DataTable columns={columns} data={rows} className="lookup-data-table" />
      </div>
      <button
        className="button secondary shadcn-button"
        type="button"
        onClick={addRow}
      >
        Add lookup point
      </button>
    </div>
  );
}

function MiniPlot({
  points,
  xLabel,
  yLabel,
}: {
  points: PlotPoint[];
  xLabel: string;
  yLabel: string;
}) {
  const safePoints = points
    .filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
    )
    .sort((left, right) => left.x - right.x);

  const xValues = safePoints.map((point) => point.x);
  const yValues = safePoints.map((point) => point.y);

  const minMaxWithPadding = (values: number[]) => {
    if (!values.length) {
      return undefined;
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min;
    const pad = span === 0 ? Math.max(Math.abs(min) * 0.06, 1) : span * 0.1;
    return [min - pad, max + pad] as [number, number];
  };

  const xRange = minMaxWithPadding(xValues);
  const yRange = minMaxWithPadding(yValues);

  const lineColor = "#2563eb";
  const markerBorder = "#1d4ed8";

  if (!safePoints.length) {
    return <div className="muted">Add at least two valid points to draw the curve.</div>;
  }

  return (
    <Plot
      data={[
        {
          x: safePoints.map((point) => point.x),
          y: safePoints.map((point) => point.y),
          type: "scatter",
          mode: safePoints.length >= 2 ? "lines+markers" : "markers",
          line: { color: lineColor, width: 3 },
          marker: {
            color: "#ffffff",
            size: 11,
            line: { color: markerBorder, width: 2 },
          },
          cliponaxis: false,
          hovertemplate: `<b>${xLabel}</b>: %{x:.4g}<br><b>${yLabel}</b>: %{y:.4g}<extra></extra>`,
        },
      ]}
      layout={{
        autosize: true,
        height: 410,
        margin: { l: 86, r: 36, t: 14, b: 92, pad: 4 },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "#ffffff",
        font: {
          family: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
          color: "#0f172a",
          size: 15,
        },
        hoverlabel: {
          bgcolor: "#0f172a",
          bordercolor: "#0f172a",
          font: { color: "#f8fafc", size: 14 },
        },
        xaxis: {
          title: { text: xLabel, font: { size: 18, color: "#0f172a" }, standoff: 12 },
          range: xRange,
          gridcolor: "#e2e8f0",
          zeroline: false,
          showline: true,
          mirror: true,
          showticklabels: true,
          side: "bottom",
          ticklabelposition: "outside",
          linecolor: "#94a3b8",
          ticks: "outside",
          tickcolor: "#94a3b8",
          ticklen: 7,
          tickfont: { size: 15, color: "#0f172a" },
          automargin: true,
        },
        yaxis: {
          title: { text: yLabel, font: { size: 18, color: "#0f172a" }, standoff: 12 },
          range: yRange,
          gridcolor: "#e2e8f0",
          zeroline: false,
          showline: true,
          mirror: true,
          linecolor: "#94a3b8",
          ticks: "outside",
          tickcolor: "#94a3b8",
          ticklen: 7,
          tickfont: { size: 15, color: "#0f172a" },
          automargin: true,
        },
        showlegend: false,
      }}
      config={{
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: [
          "zoom2d",
          "pan2d",
          "select2d",
          "lasso2d",
          "zoomIn2d",
          "zoomOut2d",
          "autoScale2d",
          "resetScale2d",
          "toImage",
        ],
        responsive: true,
      }}
      useResizeHandler
      style={{ width: "100%", height: "410px" }}
    />
  );
}

function TinySparkline({ values }: { values: number[] }) {
  if (!values.length) {
    return null;
  }

  const width = 120;
  const height = 28;
  const padding = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;

  const points = values
    .map((value, index) => {
      const x = padding + step * index;
      const normalized = (value - min) / span;
      const y = padding + (height - padding * 2) * (1 - normalized);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="sweep-sparkline"
      aria-hidden="true"
      style={{ width: "72px", minWidth: "72px", maxWidth: "72px", height: "20px", display: "block" }}
    >
      <polyline
        points={points}
        fill="none"
        stroke="#60a5fa"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VariablePicker({
  value,
  categories,
  onChange,
}: {
  value: string;
  categories: VariableCategory[];
  onChange: (value: string) => void;
}) {
  const options = categories.flatMap((category) => category.options);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;
  const [query, setQuery] = useState(selectedLabel);
  const [isOpen, setIsOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    raw: true,
    components: true,
  });

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  const isFiltering = query.trim().toLowerCase() !== selectedLabel.toLowerCase();

  return (
    <div className="variable-picker">
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
          }
        }}
        placeholder="Search mass variables"
      />
      {isOpen ? (
        <div className="variable-menu">
          {categories.map((category) => {
            const visibleOptions = isFiltering
              ? category.options.filter((option) =>
                  option.label.toLowerCase().includes(query.toLowerCase())
                )
              : category.options;
            if (!visibleOptions.length && isFiltering) {
              return null;
            }

            return (
              <div key={category.id} className="variable-category">
                <button
                  type="button"
                  className="variable-category-button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    setOpenCategories((current) => ({
                      ...current,
                      [category.id]: !current[category.id],
                    }))
                  }
                >
                  <span>{openCategories[category.id] ? "v" : ">"}</span>
                  {category.label}
                </button>
                {openCategories[category.id] ? (
                  <div className="variable-options">
                    {visibleOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          onChange(option.value);
                          setQuery(option.label);
                          setIsOpen(false);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function StudiesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("performance");
  const [metadata, setMetadata] = useState<StudyMetadata | null>(null);
  const [models, setModels] = useState<StudyModel[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [modules, setModules] = useState<ModuleConfiguration[]>([]);
  const [projectSummary, setProjectSummary] = useState<ProjectSummary | null>(null);
  const [formulations, setFormulations] = useState<Record<number, ComponentFormulation>>({});
  const [form, setForm] = useState(initialForm);
  const [modalInitialForm, setModalInitialForm] = useState(() => cloneModelForm(initialForm));
  const [message, setMessage] = useState("");
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isModelSaving, setIsModelSaving] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [hasUserEditedModel, setHasUserEditedModel] = useState(false);
  const [sweepDashboardScope, setSweepDashboardScope] = useState<"cell" | "module">("cell");

  const [selectedProjectId, setSelectedProjectId] = useState<number | "">("");
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | "">("");
  const [selectedModuleId, setSelectedModuleId] = useState<number | "">("");
  const [selectedPerformanceModelId, setSelectedPerformanceModelId] = useState<number | "">("");
  const [selectedDegradationModelId, setSelectedDegradationModelId] = useState<number | "">("");
  const [xStart, setXStart] = useState("0");
  const [xEnd, setXEnd] = useState("10");
  const [steps, setSteps] = useState("11");
  const [yMetric, setYMetric] = useState("cost_per_kwh");
  const [sweepResult, setSweepResult] = useState<StudySweepResponse | null>(null);
  const [isSweepLoading, setIsSweepLoading] = useState(false);
  const latestSweepRequestRef = useRef(0);

  const performanceModels = models.filter((model) => model.kind === "performance");
  const degradationModels = models.filter((model) => model.kind === "degradation");
  const selectedModule = modules.find((module) => module.id === selectedModuleId) ?? null;
  const selectedScenario =
    scenarios.find((scenario) => scenario.id === selectedModule?.scenario_id) ?? null;
  const selectedProject = projects.find((project) => project.id === selectedScenario?.project_id) ?? null;
  const hasStudyContext = Boolean(selectedModule && selectedScenario && selectedProject);
  const formOutputOptions =
    form.kind === "performance" ? metadata?.performance_outputs ?? [] : metadata?.degradation_outputs ?? [];
  const variableCategories: VariableCategory[] = [
    {
      id: "raw",
      label: "Raw material masses",
      options:
        projectSummary?.components.flatMap((component) =>
          (formulations[component.component_id]?.items ?? []).map((item) => ({
            value: `raw_material_mass:${component.component_id}:${item.raw_material_id}`,
            label: `${item.raw_material.name} mass in ${component.name}`,
            unit: "kg",
            baseline: component.mass * item.mass_fraction,
            kind: "raw_material" as const,
            parentKey: `component:${component.component_id}`,
          }))
        ) ?? [],
    },
    {
      id: "components",
      label: "Cell component masses",
      options: (projectSummary?.components ?? []).map((component) => ({
        value: `component_mass:${component.component_id}`,
        label: `${component.name} mass in cell`,
        unit: "kg",
        baseline: component.mass,
        kind: "component" as const,
        parentKey: "cell",
      })),
    },
  ];
  const variableOptions = variableCategories.flatMap((category) => category.options);
  const selectedVariable = variableOptions.find((option) => option.value === form.input_variable);
  const replacementOptions = variableOptions.filter(
    (option) =>
      selectedVariable &&
      option.value !== selectedVariable.value &&
      option.kind === selectedVariable.kind &&
      option.parentKey === selectedVariable.parentKey
  );
  const xDeltaUnit = form.kind === "performance" && form.variation_mode === "additive" ? "g" : "percentage points";
  const yMetricOptions = selectedModuleId
    ? [...(metadata?.cell_metrics ?? []), ...(metadata?.module_metrics ?? [])]
    : metadata?.cell_metrics ?? [];
  const selectedYLabel =
    yMetricOptions.find((option) => option.value === yMetric)?.label ?? yMetric;
  const selectedYUnit = metricUnit(yMetric);
  const moduleMetricValues = new Set((metadata?.module_metrics ?? []).map((option) => option.value));
  const yMetricLevel = moduleMetricValues.has(yMetric) ? "module" : "cell";
  function variableLabel(value: string) {
    if (value === "cycle") {
      return "Cycle number";
    }
    return variableOptions.find((option) => option.value === value)?.label ?? value;
  }

  function variableUnit(value: string) {
    if (value === "cycle") {
      return "cycles";
    }
    return variableOptions.find((option) => option.value === value)?.unit ?? "";
  }

  function outputLabel(value: string) {
    return (
      [...(metadata?.performance_outputs ?? []), ...(metadata?.degradation_outputs ?? [])].find(
        (option) => option.value === value
      )?.label ?? value
    );
  }

  const selectedXLabel =
    variableLabel(
      performanceModels.find((model) => model.id === selectedPerformanceModelId)?.input_variable ??
        ""
    ) ||
    "Study variable";
  const selectedPerformanceModel =
    performanceModels.find((model) => model.id === selectedPerformanceModelId) ?? undefined;
  const selectedSweepVariable =
    variableOptions.find((option) => option.value === selectedPerformanceModel?.input_variable) ??
    null;
  const sweepXUnit = modelDeltaUnit(selectedPerformanceModel) || "units";
  const sweepXLabel = withUnit(`Delta ${selectedXLabel}`, sweepXUnit);
  const sweepOutputDeltaUnit = outputUnit(selectedPerformanceModel?.output_metric ?? "");
  const sweepOutputDeltaLabel = withUnit("Output delta", sweepOutputDeltaUnit);
  const sweepBaselineInputKg = selectedSweepVariable
    ? selectedSweepVariable.baseline
    : Number(selectedPerformanceModel?.parameters.baseline_input_value ?? 0);
  const sweepBaselineInput = modelUsesAdditiveMass(selectedPerformanceModel)
    ? sweepBaselineInputKg * 1000
    : sweepBaselineInputKg;
  const sweepStaticInputUnit = modelUsesAdditiveMass(selectedPerformanceModel)
    ? "g"
    : selectedSweepVariable?.unit ?? "kg";
  const sweepBaselineOutput = Number(selectedPerformanceModel?.parameters.baseline_output_value ?? 0);
  const sweepDeltaRange = (() => {
    if (!selectedPerformanceModel || selectedPerformanceModel.kind !== "performance") {
      return null;
    }
    const points = selectedPerformanceModel.points;
    if (!points.length) {
      return null;
    }
    const min = Math.min(...points.map((point) => displayXValue(point.x, selectedPerformanceModel)));
    const max = Math.max(...points.map((point) => displayXValue(point.x, selectedPerformanceModel)));
    return { min, max };
  })();
  const baselineInputValue = selectedVariable?.baseline ?? 0;
  const baselineInputShare = (() => {
    if (!selectedVariable || !projectSummary) {
      return null;
    }
    if (selectedVariable.kind === "component") {
      return projectSummary.total_mass_kg ? (selectedVariable.baseline / projectSummary.total_mass_kg) * 100 : null;
    }
    const componentId = Number(selectedVariable.value.split(":")[1]);
    const component = projectSummary.components.find((item) => item.component_id === componentId);
    return component?.mass ? (selectedVariable.baseline / component.mass) * 100 : null;
  })();
  const inputPlotUnit =
    form.kind === "degradation"
      ? "cycles"
      : form.variation_mode === "additive"
        ? "g"
        : "percentage points";
  const inputPlotBaseValue =
    form.kind === "degradation"
      ? 0
      : form.variation_mode === "additive"
        ? baselineInputValue * 1000
        : baselineInputShare ?? 0;
  const baselineOutputValue = (() => {
    if (!selectedScenario) {
      return 0;
    }
    const scenarioValues: Record<string, number> = {
      avg_discharge_voltage: selectedScenario.avg_discharge_voltage,
      avg_charge_voltage: selectedScenario.avg_charge_voltage,
      discharge_capacity: selectedScenario.discharge_capacity,
      cycle_life: selectedScenario.cycle_life,
      end_of_life_fraction: selectedScenario.end_of_life_fraction,
      electricity_price_eur_per_kwh: selectedScenario.electricity_price_eur_per_kwh,
    };
    const moduleValues: Record<string, number> = selectedModule
      ? {
          cells_in_series: selectedModule.cells_in_series,
          cells_in_parallel: selectedModule.cells_in_parallel,
          module_current_a: selectedModule.module_current_a,
          mass_overhead_fraction: selectedModule.mass_overhead_fraction,
          volume_overhead_fraction: selectedModule.volume_overhead_fraction,
          cost_overhead_fraction: selectedModule.cost_overhead_fraction,
        }
      : {};
    return scenarioValues[form.output_metric] ?? moduleValues[form.output_metric] ?? 0;
  })();
  const lookupDeltaPoints = useMemo(
    () =>
      draftRowsFromText(form.pointsText)
        .map((point) => {
          const x = Number(point.x);
          const y = Number(point.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
          }
          return { x, y };
        })
        .filter((point): point is { x: number; y: number } => point !== null),
    [form.pointsText]
  );
  const previewDeltas = useMemo(() => {
    if (form.correlation_type === "lookup" && lookupDeltaPoints.length > 0) {
      return lookupDeltaPoints.map((point) => point.x);
    }
    return defaultPreviewDeltas(form, baselineInputValue, baselineInputShare, selectedScenario);
  }, [
    baselineInputShare,
    baselineInputValue,
    form,
    lookupDeltaPoints,
    selectedScenario,
  ]);
  const formulaValidation = useMemo(() => {
    if (form.correlation_type !== "formula") {
      return { valid: true as const, error: "", evaluate: null as ((x: number) => number) | null };
    }
    const evaluator = createFormulaEvaluator(form.expression);
    if (!evaluator.ok) {
      return { valid: false as const, error: evaluator.error, evaluate: null };
    }
    const finiteSamples = previewDeltas
      .slice(0, 8)
      .every((xValue) => Number.isFinite(evaluator.evaluate(xValue)));
    if (!finiteSamples) {
      return {
        valid: false as const,
        error: "Formula evaluation produced non-finite values on preview samples.",
        evaluate: null,
      };
    }
    return { valid: true as const, error: "", evaluate: evaluator.evaluate };
  }, [form.correlation_type, form.expression, previewDeltas]);
  const modelPreviewPoints = useMemo(() => {
    if (form.correlation_type === "lookup") {
      return lookupDeltaPoints.map((point) => ({
        x: inputPlotBaseValue + point.x,
        y: baselineOutputValue + point.y,
      }));
    }

    return previewDeltas
      .map((xDelta) => {
        let yDelta = 0;
        if (form.correlation_type === "linear") {
          yDelta = Number(form.intercept) + Number(form.slope) * xDelta;
        } else if (form.correlation_type === "formula") {
          if (!formulaValidation.evaluate) {
            return null;
          }
          yDelta = formulaValidation.evaluate(xDelta);
        }
        if (!Number.isFinite(yDelta)) {
          return null;
        }
        return {
          x: inputPlotBaseValue + xDelta,
          y: baselineOutputValue + yDelta,
        };
      })
      .filter((point): point is { x: number; y: number } => point !== null);
  }, [
    baselineOutputValue,
    form.correlation_type,
    form.intercept,
    form.slope,
    formulaValidation,
    inputPlotBaseValue,
    lookupDeltaPoints,
    previewDeltas,
  ]);
  const formulaPresetOptions =
    form.kind === "degradation" ? DEGRADATION_FORMULA_PRESETS : PERFORMANCE_FORMULA_PRESETS;
  const modulePreviewPoints = useMemo(() => {
    const series = selectedModule?.cells_in_series ?? 1;
    const parallel = selectedModule?.cells_in_parallel ?? 1;
    const moduleMassScale =
      series * parallel * (1 + (selectedModule?.mass_overhead_fraction ?? 0));
    const outputMetric = form.output_metric;
    return modelPreviewPoints.map((point) => {
      let x = point.x;
      let y = point.y;
      if (form.variation_mode === "additive") {
        x = point.x * moduleMassScale;
      }
      if (outputMetric === "avg_discharge_voltage" || outputMetric === "avg_charge_voltage") {
        y = point.y * series;
      }
      if (outputMetric === "discharge_capacity") {
        y = point.y * parallel;
      }
      return { x, y };
    });
  }, [form.output_metric, form.variation_mode, modelPreviewPoints, selectedModule]);

  async function loadModels() {
    setModels(await api.get<StudyModel[]>("/study-models"));
  }

  async function loadProjects() {
    const data = await api.get<Project[]>("/projects");
    setProjects(data);
    setSelectedProjectId((current) => current || data[0]?.id || "");
  }

  useEffect(() => {
    Promise.all([
      api.get<StudyMetadata>("/study-models/metadata").then(setMetadata),
      api.get<Scenario[]>("/scenarios").then(setScenarios),
      api.get<ModuleConfiguration[]>("/modules").then(setModules),
      loadModels(),
      loadProjects(),
    ]).catch((error: Error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (!selectedModule) {
      setSelectedScenarioId("");
      setSelectedProjectId("");
      setProjectSummary(null);
      setFormulations({});
      return;
    }

    const scenario = scenarios.find((item) => item.id === selectedModule.scenario_id);
    if (!scenario) {
      return;
    }

    setSelectedScenarioId(scenario.id);
    setSelectedProjectId(scenario.project_id);
    api
      .get<ProjectSummary>(`/projects/${scenario.project_id}/summary`)
      .then(async (summary) => {
        setProjectSummary(summary);
        const entries = await Promise.all(
          summary.components.map(async (component) => [
            component.component_id,
            await api.get<ComponentFormulation>(
              `/components/${component.component_id}/formulation`
            ),
          ] as const)
        );
        setFormulations(Object.fromEntries(entries));
      })
      .catch((error: Error) => setMessage(error.message));
  }, [selectedModule, scenarios]);

  useEffect(() => {
    if (!hasStudyContext || form.kind !== "performance") {
      return;
    }
    if (!variableOptions.some((option) => option.value === form.input_variable)) {
      setForm((current) => ({
        ...current,
        input_variable: variableOptions[0]?.value ?? "",
        replacement_variable: "",
      }));
    }
  }, [hasStudyContext, variableOptions, form.input_variable, form.kind]);

  useEffect(() => {
    if (
      form.variation_mode !== "replace_specific" ||
      !replacementOptions.length ||
      replacementOptions.some((option) => option.value === form.replacement_variable)
    ) {
      return;
    }
    setForm((current) => ({
      ...current,
      replacement_variable: replacementOptions[0]?.value ?? "",
    }));
  }, [form.variation_mode, form.replacement_variable, replacementOptions]);

  useEffect(() => {
    if (performanceModels.length && !selectedPerformanceModelId) {
      setSelectedPerformanceModelId(performanceModels[0].id);
    }
  }, [performanceModels, selectedPerformanceModelId]);

  useEffect(() => {
    if (!yMetricOptions.some((option) => option.value === yMetric)) {
      setYMetric(yMetricOptions[0]?.value ?? "");
    }
  }, [yMetricOptions, yMetric]);

  useEffect(() => {
    if (!isModelModalOpen || hasUserEditedModel) {
      return;
    }
    if (formsEqual(form, modalInitialForm)) {
      return;
    }
    setModalInitialForm(cloneModelForm(form));
  }, [isModelModalOpen, hasUserEditedModel, form, modalInitialForm]);

  useEffect(() => {
    if (!isModelModalOpen) {
      return;
    }
    setHasUserEditedModel(false);
  }, [isModelModalOpen]);

  function defaultFormForKind(kind: ModelKind) {
    const defaultOutput =
      kind === "performance"
        ? metadata?.performance_outputs[0]?.value ?? "avg_discharge_voltage"
        : metadata?.degradation_outputs[0]?.value ?? "capacity_retention";
    return {
      ...initialForm,
      kind,
      output_metric: defaultOutput,
      input_variable: kind === "performance" ? variableOptions[0]?.value ?? "" : "cycle",
      replacement_variable: "",
    };
  }

  function resetForm(kind: ModelKind) {
    setForm(defaultFormForKind(kind));
  }

  function patchForm(patch: Partial<typeof initialForm>) {
    setHasUserEditedModel(true);
    setForm((current) => ({ ...current, ...patch }));
  }

  async function saveModel() {
    setMessage("");
    if (!hasStudyContext) {
      setMessage("Choose a study module first.");
      return false;
    }
    if (form.kind === "performance" && !form.input_variable) {
      setMessage("Choose a mass variable from the selected module.");
      return false;
    }
    if (
      form.kind === "performance" &&
      form.variation_mode === "replace_specific" &&
      !form.replacement_variable
    ) {
      setMessage("Choose which mass should compensate the replacement.");
      return false;
    }
    if (form.correlation_type === "formula" && !formulaValidation.valid) {
      setMessage(formulaValidation.error || "Formula is invalid.");
      return false;
    }

    try {
      setIsModelSaving(true);
      const payload = buildPayload(form, baselineInputValue, baselineOutputValue);
      if (form.id) {
        await api.put<StudyModel>(`/study-models/${form.id}`, payload);
        setMessage("Model updated.");
      } else {
        await api.post<StudyModel>("/study-models", payload);
        setMessage("Model saved.");
      }
      await loadModels();
      resetForm(form.kind);
      setHasUserEditedModel(false);
      setIsCloseConfirmOpen(false);
      setIsModelModalOpen(false);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save model");
      return false;
    } finally {
      setIsModelSaving(false);
    }
  }

  async function handleSaveModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveModel();
  }

  const isEditMode = Boolean(form.id);
  const isModelDirty = useMemo(
    () => !formsEqual(form, modalInitialForm),
    [form, modalInitialForm]
  );
  const isHeaderSaveDisabled =
    isModelSaving ||
    (isEditMode && (!hasUserEditedModel || !isModelDirty)) ||
    (form.correlation_type === "formula" && !formulaValidation.valid);

  async function closeModelModal() {
    if (isModelSaving) {
      return;
    }

    if (isModelDirty) {
      setIsCloseConfirmOpen(true);
      return;
    }

    resetForm(form.kind);
    setHasUserEditedModel(false);
    setIsModelModalOpen(false);
  }

  function editModel(model: StudyModel) {
    setActiveTab(model.kind);
    setIsModelModalOpen(true);
    const modelVariationMode = (model.parameters.variation_mode as VariationMode) ?? "additive";
    const nextForm = {
      ...initialForm,
      id: String(model.id),
      name: model.name,
      kind: model.kind,
      input_variable: model.input_variable,
      output_metric: model.output_metric,
      correlation_type: model.correlation_type,
      variation_mode: modelVariationMode,
      replacement_variable: String(model.parameters.replacement_variable ?? ""),
      slope: String(model.parameters.slope ?? "1"),
      intercept: String(model.parameters.intercept ?? "0"),
      expression: String(model.parameters.expression ?? "x"),
      pointsText: pointsToText(model.points, modelVariationMode === "additive" ? 1000 : 1),
    };
    setForm(nextForm);
    setModalInitialForm(cloneModelForm(nextForm));
    setHasUserEditedModel(false);
    setIsCloseConfirmOpen(false);
  }

  async function deleteModel(modelId: number) {
    try {
      await api.delete(`/study-models/${modelId}`);
      await loadModels();
      setMessage("Model deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete model");
    }
  }

  const runSweepRequest = useCallback(async (silent = true) => {
    if (!selectedPerformanceModelId || !selectedScenarioId || !selectedModuleId || !yMetric) {
      if (!silent) {
        setMessage("Choose a study module, performance model, and y metric first.");
      }
      setSweepResult(null);
      return;
    }

    const numericXStart = Number(xStart);
    const numericXEnd = Number(xEnd);
    const numericSteps = Number(steps);
    if (
      !Number.isFinite(numericXStart) ||
      !Number.isFinite(numericXEnd) ||
      !Number.isFinite(numericSteps) ||
      numericSteps < 2
    ) {
      if (!silent) {
        setMessage("Enter valid numeric sweep inputs.");
      }
      setSweepResult(null);
      return;
    }

    const requestId = latestSweepRequestRef.current + 1;
    latestSweepRequestRef.current = requestId;
    setIsSweepLoading(true);

    try {
      const data = await api.post<StudySweepResponse>("/study-models/sweep", {
        model_id: selectedPerformanceModelId,
        scenario_id: selectedScenarioId,
        module_id: selectedModuleId || null,
        degradation_model_id: selectedDegradationModelId || null,
        x_start: backendXValue(numericXStart, selectedPerformanceModel),
        x_end: backendXValue(numericXEnd, selectedPerformanceModel),
        steps: numericSteps,
        y_metric: yMetric,
      });
      if (latestSweepRequestRef.current !== requestId) {
        return;
      }
      setSweepResult(data);
      if (!silent) {
        setMessage("Sweep complete.");
      }
    } catch (error) {
      if (latestSweepRequestRef.current !== requestId) {
        return;
      }
      setMessage(error instanceof Error ? error.message : "Sweep failed");
      setSweepResult(null);
    } finally {
      if (latestSweepRequestRef.current === requestId) {
        setIsSweepLoading(false);
      }
    }
  }, [
    selectedPerformanceModelId,
    selectedScenarioId,
    selectedModuleId,
    yMetric,
    xStart,
    xEnd,
    steps,
    selectedDegradationModelId,
    selectedPerformanceModel,
  ]);

  const visibleModels = activeTab === "degradation" ? degradationModels : performanceModels;
  const modelColumns = useMemo<ColumnDef<StudyModel>[]>(
    () => [
      { accessorKey: "name", header: "Name" },
      {
        accessorKey: "input_variable",
        header: "Input delta",
        cell: ({ row }) => variableLabel(row.original.input_variable),
      },
      {
        accessorKey: "output_metric",
        header: "Output delta",
        cell: ({ row }) => outputLabel(row.original.output_metric),
      },
      {
        accessorKey: "correlation_type",
        header: "Type",
      },
      {
        id: "variation",
        header: "Variation",
        cell: ({ row }) => {
          const mode = String(row.original.parameters.variation_mode ?? "additive");
          if (row.original.kind === "degradation") {
            return "cycle";
          }
          return mode === "replace_specific"
            ? "replace"
            : mode === "rescale_others"
              ? "rescale"
              : "additive";
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="row-actions">
            <button
              className="icon-button"
              type="button"
              title="Edit model"
              onClick={() => editModel(row.original)}
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
              title="Delete model"
              onClick={() => deleteModel(row.original.id)}
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
        ),
      },
    ],
    [variableOptions, metadata]
  );
  const sweepPreviewPoints = useMemo(() => {
    if (!sweepResult) {
      return [];
    }
    return sweepResult.points.map((point) => ({
      x: displayXValue(point.x, selectedPerformanceModel),
      y: point.y,
    }));
  }, [selectedPerformanceModel, sweepResult]);
  const dashboardMetricOptions = useMemo(
    () =>
      sweepDashboardScope === "module"
        ? metadata?.module_metrics ?? []
        : metadata?.cell_metrics ?? [],
    [metadata, sweepDashboardScope]
  );
  const sweepMetricSummaries = useMemo<SweepMetricSummary[]>(() => {
    if (!sweepResult?.points.length) {
      return [];
    }

    const lowXPoint = sweepResult.points.reduce((lowest, candidate) =>
      candidate.x < lowest.x ? candidate : lowest
    );
    const highXPoint = sweepResult.points.reduce((highest, candidate) =>
      candidate.x > highest.x ? candidate : highest
    );
    const baselinePoint = sweepResult.points.reduce((closest, candidate) =>
      Math.abs(candidate.x) < Math.abs(closest.x) ? candidate : closest
    );

    return dashboardMetricOptions
      .map((option) => {
        const values = sweepResult.points
          .map((point) => Number(point.metrics[option.value]))
          .filter((value) => Number.isFinite(value));
        if (!values.length || values.length !== sweepResult.points.length) {
          return null;
        }

        const baseline = Number(baselinePoint.metrics[option.value]);
        if (!Number.isFinite(baseline)) {
          return null;
        }

        return {
          key: option.value,
          label: option.label,
          unit: metricUnit(option.value),
          baseline,
          low: Number(lowXPoint.metrics[option.value]),
          high: Number(highXPoint.metrics[option.value]),
          values,
        };
      })
      .filter(
        (item): item is SweepMetricSummary =>
          item !== null && Number.isFinite(item.low) && Number.isFinite(item.high)
      );
  }, [dashboardMetricOptions, sweepResult]);
  const groupedSweepMetricSummaries = useMemo(() => {
    const higher: SweepMetricSummary[] = [];
    const lower: SweepMetricSummary[] = [];
    const neutral: SweepMetricSummary[] = [];

    for (const metric of sweepMetricSummaries) {
      const direction = metricTrendDirection(metric.key);
      if (direction === "higher_is_better") {
        higher.push(metric);
      } else if (direction === "lower_is_better") {
        lower.push(metric);
      } else {
        neutral.push(metric);
      }
    }

    return { higher, lower, neutral };
  }, [sweepMetricSummaries]);

  function formatMetricCardValueWithOverride(
    metricKey: string,
    value: number,
    decimalOverride: number | null
  ) {
    if (!Number.isFinite(value)) {
      return "-";
    }
    const absolute = Math.abs(value);
    if (absolute >= 1000) {
      return `${new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value / 1000)} k`;
    }
    let decimals = decimalOverride ?? metricValuePrecision(metricKey);
    if (decimalOverride === null && absolute >= 10) {
      decimals = 0;
    } else if (decimalOverride === null && isCostMetricKey(metricKey) && absolute < 1) {
      decimals = 2;
    }
    const minimumDecimals = decimalOverride ?? 0;
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: minimumDecimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }

  function metricCardDecimalOverride(metric: SweepMetricSummary) {
    if (!Number.isFinite(metric.low) || !Number.isFinite(metric.high)) {
      return null;
    }
    if (metric.low === metric.high) {
      return null;
    }
    if (Math.abs(metric.low) < 10 || Math.abs(metric.high) < 10) {
      return null;
    }
    if (Math.abs(metric.high - metric.low) >= 1) {
      return null;
    }

    const maxDecimals = 5;
    for (let decimals = 1; decimals <= maxDecimals; decimals += 1) {
      if (metric.low.toFixed(decimals) !== metric.high.toFixed(decimals)) {
        return decimals;
      }
    }
    return maxDecimals;
  }

  function metricDeltaClass(metricKey: string, value: number, baseline: number) {
    const direction = metricTrendDirection(metricKey);
    if (direction === "neutral") {
      return "";
    }
    const epsilon = Math.max(1e-9, Math.abs(baseline) * 1e-6);
    if (Math.abs(value - baseline) <= epsilon) {
      return "";
    }
    const improved =
      direction === "higher_is_better" ? value > baseline + epsilon : value < baseline - epsilon;
    return improved ? "sweep-value-good" : "sweep-value-bad";
  }

  useEffect(() => {
    if (!selectedModuleId && sweepDashboardScope === "module") {
      setSweepDashboardScope("cell");
    }
  }, [selectedModuleId, sweepDashboardScope]);

  useEffect(() => {
    if (!selectedPerformanceModel || selectedPerformanceModel.kind !== "performance") {
      return;
    }
    if (selectedPerformanceModel.points.length < 2) {
      return;
    }
    const xs = selectedPerformanceModel.points.map((point) =>
      displayXValue(point.x, selectedPerformanceModel)
    );
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    setXStart(String(min));
    setXEnd(String(max));
  }, [selectedPerformanceModelId, selectedPerformanceModel]);

  useEffect(() => {
    if (activeTab !== "sweep") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void runSweepRequest(true);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [
    activeTab,
    selectedPerformanceModelId,
    selectedDegradationModelId,
    yMetric,
    xStart,
    xEnd,
    steps,
    selectedScenarioId,
    selectedModuleId,
    runSweepRequest,
  ]);

  const modelForm = (
    <form id="model-editor-form" className="stack" onSubmit={handleSaveModel}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="model-name">Name</label>
          <input
            id="model-name"
            value={form.name}
            onChange={(event) => patchForm({ name: event.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="input-variable">Input variable</label>
          {activeTab === "performance" ? (
            <VariablePicker
              value={form.input_variable}
              categories={variableCategories}
              onChange={(value) => patchForm({ input_variable: value, replacement_variable: "" })}
            />
          ) : (
            <input value="Cycle number" disabled />
          )}
        </div>
        <div className="field">
          <label htmlFor="output-metric">Output metric</label>
          <select
            id="output-metric"
            value={form.output_metric}
            onChange={(event) => patchForm({ output_metric: event.target.value })}
          >
            {formOutputOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="correlation-type">Correlation</label>
          <select
            id="correlation-type"
            value={form.correlation_type}
            onChange={(event) =>
              patchForm({
                correlation_type: event.target.value as typeof form.correlation_type,
              })
            }
          >
            <option value="linear">Linear</option>
            <option value="lookup">Lookup table</option>
            <option value="formula">Formula</option>
          </select>
        </div>
        {activeTab === "performance" ? (
          <div className="field">
            <label htmlFor="variation-mode">Input variation mode</label>
            <select
              id="variation-mode"
              value={form.variation_mode}
              onChange={(event) =>
                patchForm({
                  variation_mode: event.target.value as VariationMode,
                  replacement_variable: "",
                })
              }
            >
              <option value="additive">Additive mass delta (g)</option>
              <option value="replace_specific">Replace another mass (percentage points)</option>
              <option value="rescale_others">Rescale all other masses (percentage points)</option>
            </select>
          </div>
        ) : null}
        {activeTab === "performance" && form.variation_mode === "replace_specific" ? (
          <div className="field">
            <label htmlFor="replacement-variable">Replacement variable</label>
            <select
              id="replacement-variable"
              value={form.replacement_variable}
              onChange={(event) => patchForm({ replacement_variable: event.target.value })}
            >
              {replacementOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {form.correlation_type === "linear" ? (
        <div className="form-grid">
          <div className="field">
            <label htmlFor="slope">Slope</label>
            <input
              id="slope"
              type="number"
              step="any"
              value={form.slope}
              onChange={(event) => patchForm({ slope: event.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="intercept">Intercept</label>
            <input
              id="intercept"
              type="number"
              step="any"
              value={form.intercept}
              onChange={(event) => patchForm({ intercept: event.target.value })}
            />
          </div>
        </div>
      ) : null}

      {form.correlation_type === "formula" ? (
        <div className="stack">
          <div className="field">
            <label htmlFor="formula-preset">Formula preset</label>
            <select
              id="formula-preset"
              value=""
              onChange={(event) => {
                if (!event.target.value) {
                  return;
                }
                patchForm({ expression: event.target.value });
              }}
            >
              <option value="">Choose preset</option>
              {formulaPresetOptions.map((preset) => (
                <option key={preset.label} value={preset.expression}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="expression">Formula using x</label>
            <input
              id="expression"
              value={form.expression}
              onChange={(event) => patchForm({ expression: event.target.value })}
              placeholder="0.004 * x"
            />
            <p className={`muted ${formulaValidation.valid ? "" : "text-rose-600"}`}>
              {formulaValidation.valid
                ? "Allowed: x, + - * / ^, parentheses, sqrt(), log(), exp(), pow()."
                : formulaValidation.error}
            </p>
          </div>
        </div>
      ) : null}

      {form.correlation_type === "lookup" ? (
        <LookupEditor
          pointsText={form.pointsText}
          onChange={(pointsText) => patchForm({ pointsText })}
          xHeader={`${activeTab === "performance" ? "X delta" : "X"}: ${
            activeTab === "performance"
              ? variableOptions.find((option) => option.value === form.input_variable)?.label ??
                form.input_variable
              : "Cycle number"
          } ${activeTab === "performance" ? unitText(xDeltaUnit) : unitText("cycles")}`}
          yHeader={`Y delta: ${
            formOutputOptions.find((option) => option.value === form.output_metric)?.label ??
            form.output_metric
          } ${unitText(outputUnit(form.output_metric))}`}
        />
      ) : null}

    </form>
  );

  const modelPreview = (
    <aside className="panel stack modal-preview-panel">
      <div>
        <span className="eyebrow">Live preview</span>
        <h2>Static model + deltas</h2>
      </div>
      <div className="detail-list baseline-details">
        <div className="detail-item">
          <span className="detail-label">Static input</span>
          <strong>
            {selectedVariable
              ? `${formatNumber(baselineInputValue * 1000)} g${
                  baselineInputShare === null ? "" : ` (${formatNumber(baselineInputShare)}%)`
                }`
              : "Select a mass variable"}
          </strong>
        </div>
        <div className="detail-item">
          <span className="detail-label">Static output</span>
          <strong>{`${formatNumber(baselineOutputValue)} ${outputUnit(form.output_metric)}`}</strong>
        </div>
      </div>
      <div className="space-y-2">
        <div className="space-y-1">
          <span className="text-lg font-extrabold uppercase tracking-[0.2em] text-slate-700">Cell level</span>
          <h3 className="m-0 text-lg font-normal text-slate-800">
            {withUnit(outputLabel(form.output_metric), outputUnit(form.output_metric))} vs{" "}
            {withUnit(variableLabel(form.input_variable), inputPlotUnit)}
          </h3>
        </div>
        <MiniPlot
          points={modelPreviewPoints}
          xLabel={withUnit(variableLabel(form.input_variable), inputPlotUnit)}
          yLabel={withUnit(outputLabel(form.output_metric), outputUnit(form.output_metric))}
        />
      </div>
      <div className="space-y-2">
        <div className="space-y-1">
          <span className="text-lg font-extrabold uppercase tracking-[0.2em] text-slate-700">Module level</span>
          <h3 className="m-0 text-lg font-normal text-slate-800">Projected module response</h3>
        </div>
        <MiniPlot
          points={modulePreviewPoints}
          xLabel={withUnit(
            variableLabel(form.input_variable),
            form.variation_mode === "additive" ? "g (module)" : inputPlotUnit
          )}
          yLabel={withUnit(`Module ${outputLabel(form.output_metric)}`, outputUnit(form.output_metric))}
        />
      </div>
    </aside>
  );

  return (
    <div className={`stack ${studiesTw}`}>
      <section className="panel stack">
        <div className="form-grid">
          <div className="field study-module-field">
            <label htmlFor="study-module">Module</label>
            <select
              id="study-module"
              value={selectedModuleId}
              onChange={(event) => {
                setSelectedModuleId(parseSelectNumber(event.target.value));
                setSweepResult(null);
              }}
            >
              <option value="">Select module</option>
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.name}
                </option>
              ))}
            </select>
          </div>
          <div className="detail-list study-context-details">
            <div className="detail-item">
              <span className="detail-label">Cell</span>
              <strong>{selectedProject?.name ?? "Select a module"}</strong>
            </div>
            <div className="detail-item">
              <span className="detail-label">Scenario</span>
              <strong>{selectedScenario ? `Scenario #${selectedScenario.id}` : "-"}</strong>
            </div>
            <div className="detail-item">
              <span className="detail-label">Configuration</span>
              <strong>
                {selectedModule
                  ? `${selectedModule.cells_in_series}s${selectedModule.cells_in_parallel}p`
                  : "-"}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <div className="tab-bar">
        <button
          className={activeTab === "performance" ? "active" : ""}
          type="button"
          disabled={!hasStudyContext}
          onClick={() => {
            setActiveTab("performance");
            resetForm("performance");
          }}
        >
          Performance
        </button>
        <button
          className={activeTab === "degradation" ? "active" : ""}
          type="button"
          disabled={!hasStudyContext}
          onClick={() => {
            setActiveTab("degradation");
            resetForm("degradation");
          }}
        >
          Degradation
        </button>
        <button
          className={activeTab === "sweep" ? "active" : ""}
          type="button"
          disabled={!hasStudyContext}
          onClick={() => setActiveTab("sweep")}
        >
          Sweep Results
        </button>
      </div>

      {!hasStudyContext ? (
        <section className="panel">
          <p className="muted">
            Select a module above to unlock model creation and sweep calculations.
          </p>
        </section>
      ) : activeTab !== "sweep" ? (
        <div className="stack">
          <section className="table-wrap stack">
            <div className="section-header-row">
              <div>
                <span className="eyebrow">Saved models</span>
                <h2>{activeTab === "performance" ? "Performance correlations" : "Degradation curves"}</h2>
              </div>
              <button
                className="button"
                type="button"
                onClick={() => {
                  const nextForm = defaultFormForKind(
                    activeTab === "degradation" ? "degradation" : "performance"
                  );
                  setForm(nextForm);
                  setModalInitialForm(cloneModelForm(nextForm));
                  setHasUserEditedModel(false);
                  setIsCloseConfirmOpen(false);
                  setIsModelModalOpen(true);
                }}
              >
                Add {activeTab === "degradation" ? "degradation" : "performance"} model
              </button>
            </div>
            <DataTable columns={modelColumns} data={visibleModels} />
          </section>
        </div>
      ) : (
        <div className="stack">
          <div className="sweep-top-grid">
            <section className="panel stack">
              <div>
                <span className="eyebrow">Sweep setup</span>
                <h2>Plot calculated metrics against a studied variable</h2>
                <p className="muted">
                  X is{" "}
                  <strong>{sweepXLabel}</strong>. Y is{" "}
                  <strong>{withUnit(selectedYLabel, selectedYUnit)}</strong> at{" "}
                  <strong>{yMetricLevel}</strong> level.
                </p>
              </div>
              <div className="detail-list">
                <div className="detail-item">
                  <span className="detail-label">Static input</span>
                  <strong>{formatNumber(sweepBaselineInput)} {sweepStaticInputUnit}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Static output</span>
                  <strong>{formatNumber(sweepBaselineOutput)} {sweepOutputDeltaUnit}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Lookup range</span>
                  <strong>
                    {sweepDeltaRange
                      ? `${formatNumber(sweepDeltaRange.min)} to ${formatNumber(sweepDeltaRange.max)} ${sweepXUnit}`
                      : "No lookup range (linear/formula model)"}
                  </strong>
                </div>
              </div>
              <form className="stack" onSubmit={(event) => event.preventDefault()}>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="performance-model">Performance model</label>
                    <select
                      id="performance-model"
                      value={selectedPerformanceModelId}
                      onChange={(event) =>
                        setSelectedPerformanceModelId(parseSelectNumber(event.target.value))
                      }
                    >
                      <option value="">Select model</option>
                      {performanceModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="degradation-model">Degradation model (optional)</label>
                    <select
                      id="degradation-model"
                      value={selectedDegradationModelId}
                      onChange={(event) =>
                        setSelectedDegradationModelId(parseSelectNumber(event.target.value))
                      }
                    >
                      <option value="">No degradation model</option>
                      {degradationModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="y-metric">Y metric</label>
                    <select
                      id="y-metric"
                      value={yMetric}
                      onChange={(event) => setYMetric(event.target.value)}
                    >
                      {yMetricOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="x-start">X start ({sweepXUnit})</label>
                    <input
                      id="x-start"
                      type="number"
                      step="any"
                      value={xStart}
                      onChange={(event) => setXStart(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="x-end">X end ({sweepXUnit})</label>
                    <input
                      id="x-end"
                      type="number"
                      step="any"
                      value={xEnd}
                      onChange={(event) => setXEnd(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="steps">Steps</label>
                    <input
                      id="steps"
                      type="number"
                      min="2"
                      max="101"
                      step="1"
                      value={steps}
                      onChange={(event) => setSteps(event.target.value)}
                    />
                  </div>
                </div>
                <p className="muted">
                  {isSweepLoading ? "Updating sweep..." : "Sweep updates automatically when inputs change."}
                </p>
              </form>
            </section>

            <section className="table-wrap stack">
              <div className="section-header-row">
                <span className="eyebrow">Metric dashboard</span>
                <div className="tab-bar">
                  <button
                    className={sweepDashboardScope === "cell" ? "active" : ""}
                    type="button"
                    onClick={() => setSweepDashboardScope("cell")}
                  >
                    Cell
                  </button>
                  <button
                    className={sweepDashboardScope === "module" ? "active" : ""}
                    type="button"
                    disabled={!selectedModuleId}
                    onClick={() => setSweepDashboardScope("module")}
                  >
                    Module
                  </button>
                </div>
              </div>
              {[
                { id: "higher", title: "Higher is better", metrics: groupedSweepMetricSummaries.higher },
                { id: "lower", title: "Lower is better", metrics: groupedSweepMetricSummaries.lower },
                { id: "neutral", title: "Neutral", metrics: groupedSweepMetricSummaries.neutral },
              ]
                .filter((group) => group.metrics.length > 0)
                .map((group) => (
                  <div key={group.id} className="stack">
                    <span className="eyebrow">{group.title}</span>
                    <div className="sweep-dashboard-grid">
                      {group.metrics.map((metric) => {
                        const decimalOverride = metricCardDecimalOverride(metric);
                        return (
                          <article key={metric.key} className="sweep-metric-card">
                            <div className="sweep-metric-title-row">
                              <span className="sweep-metric-title">
                                {withUnit(dashboardMetricTitle(metric.label, sweepDashboardScope), metric.unit)}
                              </span>
                              <TinySparkline values={metric.values} />
                            </div>
                            <div className="sweep-metric-inline-row">
                              <strong className="sweep-k">B:</strong>
                              <span className="sweep-v">
                                {formatMetricCardValueWithOverride(metric.key, metric.baseline, decimalOverride)}
                              </span>
                              <strong className="sweep-k">L:</strong>
                              <span className={`sweep-v ${metricDeltaClass(metric.key, metric.low, metric.baseline)}`}>
                                {formatMetricCardValueWithOverride(metric.key, metric.low, decimalOverride)}
                              </span>
                              <strong className="sweep-k">H:</strong>
                              <span className={`sweep-v ${metricDeltaClass(metric.key, metric.high, metric.baseline)}`}>
                                {formatMetricCardValueWithOverride(metric.key, metric.high, decimalOverride)}
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </section>
          </div>

          <div className="page-grid">
            <section className="panel stack">
              <div>
                <span className="eyebrow">Plot</span>
                <h2>{withUnit(selectedYLabel, selectedYUnit)} vs {sweepXLabel}</h2>
              </div>
              <MiniPlot
                points={sweepPreviewPoints}
                xLabel={sweepXLabel}
                yLabel={withUnit(selectedYLabel, selectedYUnit)}
              />
            </section>

            <section className="table-wrap stack">
              <div>
                <span className="eyebrow">Sweep table</span>
                <h2>Calculated points</h2>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>
                      {sweepXLabel}
                    </th>
                    <th>{sweepOutputDeltaLabel}</th>
                    <th>{withUnit(selectedYLabel, selectedYUnit)}</th>
                  </tr>
                </thead>
                <tbody>
                  {sweepResult?.points.map((point) => (
                    <tr key={`${point.x}-${point.y}`}>
                      <td>{formatNumber(displayXValue(point.x, selectedPerformanceModel))}</td>
                      <td>{formatNumber(point.model_output)}</td>
                      <td>{formatNumber(point.y)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      )}

      {isModelModalOpen && activeTab !== "sweep" ? (
        <div className="modal-backdrop">
          <div className="modal-panel modal-study">
            <div className="modal-title-row modal-sticky-header">
              <div>
                <h2 className="modal-title-main">{activeTab} model</h2>
                <p className="muted">
                  Module: <strong>{selectedModule?.name ?? "No module selected"}</strong>
                </p>
              </div>
              <div className="modal-header-actions">
                <button
                  className={`button ${isHeaderSaveDisabled ? "muted-disabled" : ""}`}
                  type="submit"
                  form="model-editor-form"
                  disabled={isHeaderSaveDisabled}
                >
                  {isEditMode ? "Update model" : "Save model"}
                </button>
                <button className="button secondary" type="button" onClick={() => void closeModelModal()}>
                  Close
                </button>
              </div>
            </div>
            <div className="modal-scroll-area">
              <div className="modal-split study-modal-split">
                <section className="panel stack modal-editor-panel">{modelForm}</section>
                {modelPreview}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isCloseConfirmOpen ? (
        <div className="confirm-backdrop">
          <div className="confirm-panel">
            <span className="eyebrow">Unsaved changes</span>
            <h2>What would you like to do?</h2>
            <p className="muted">Save your changes, keep editing, or close without saving.</p>
            <div className="confirm-actions">
              <button
                className="button"
                type="button"
                onClick={() => {
                  setIsCloseConfirmOpen(false);
                  const modelEditorForm = document.getElementById("model-editor-form");
                  if (modelEditorForm instanceof HTMLFormElement) {
                    modelEditorForm.requestSubmit();
                  } else {
                    void saveModel();
                  }
                }}
              >
                Save
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => setIsCloseConfirmOpen(false)}
              >
                Keep editing
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  setIsCloseConfirmOpen(false);
                  resetForm(form.kind);
                  setHasUserEditedModel(false);
                  setIsModelModalOpen(false);
                }}
              >
                Exit without saving
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="message">{message}</div>
    </div>
  );
}
