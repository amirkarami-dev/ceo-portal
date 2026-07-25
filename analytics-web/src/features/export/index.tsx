import type { MenuProps } from "antd";
import type { QueryResult, ReportDefinition } from "@/contracts";
import { toCsv } from "./csv";
import { toJson } from "./json";
import { downloadBlob } from "./download";
import { exportXlsx } from "./xlsx";
import { exportPdf } from "./pdf";

export { toCsv } from "./csv";
export { toJson } from "./json";
export { downloadBlob } from "./download";
export { exportXlsx, resultToAoa } from "./xlsx";
export { exportPdf, chartSnapshot } from "./pdf";

function baseName(def: ReportDefinition): string {
  return (
    def.presentation?.export?.fileName ??
    def.name?.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") ??
    "report"
  );
}

export function exportCsv(def: ReportDefinition, result: QueryResult): void {
  // Prepend UTF-8 BOM so Excel opens Persian text correctly.
  downloadBlob("\uFEFF" + toCsv(result), `${baseName(def)}.csv`, "text/csv");
}

export function exportJson(def: ReportDefinition, result: QueryResult): void {
  downloadBlob(toJson(def, result), `${baseName(def)}.json`, "application/json");
}

/** antd Dropdown items for the export menu — CSV, JSON, Excel, and PDF. */
export function buildExportMenuItems(
  def: ReportDefinition,
  result: QueryResult,
): NonNullable<MenuProps["items"]> {
  return [
    { key: "csv", label: "CSV", onClick: () => exportCsv(def, result) },
    { key: "json", label: "JSON", onClick: () => exportJson(def, result) },
    { type: "divider" },
    {
      key: "excel",
      label: "Excel",
      onClick: () => void exportXlsx(baseName(def), result),
    },
    {
      key: "pdf",
      label: "PDF",
      onClick: () => exportPdf(def.name ?? baseName(def), result),
    },
  ];
}
