// @mabhas19/assessment-core — the single source of truth for the Section 19
// (Appendix 5, 5th ed.) building-energy assessment engine. Pure TypeScript,
// no React, consumed by both the web (Next.js) and mobile (Expo) clients.

// Climate + building-group data and helpers
export * from "./data/climate"
export * from "./data/utils"

// Assessment section/tool catalog + shared result types
export * from "./data/sections"

// Reference databases (materials, glazing, mechanical/electrical/monitoring rows)
export * from "./data/envOpaqueDb"
export * from "./data/envTransDb"
export * from "./data/mechDb"
export * from "./data/elecDb"
export * from "./data/monitoringDb"
export * from "./data/integratedDb"

// Pure scoring engine (6 checklists) + dispatcher
export * from "./scoring"

// Report view-model derivation (printable per-section reports)
export * from "./reporting/envReport"
export * from "./reporting/windowsReport"
export * from "./reporting/checklistReport"
