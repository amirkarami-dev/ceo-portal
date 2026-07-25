// Auto-generated types from the Mabhas19 API OpenAPI document.
// Re-export raw schema + named aliases consumed by web and mobile.
//
// To refresh after API changes:
//   1. Capture the latest spec: curl http://localhost:5000/openapi/v1.json > packages/api-types/openapi.json
//   2. Regenerate:              npm run generate -w @mabhas19/api-types

export type * from "./schema"
import type { components } from "./schema"

// ---- DTO aliases (OpenAPI schema names → app-facing names) ----

export type Project      = components["schemas"]["ProjectDto"]
export type Assessment   = components["schemas"]["AssessmentDto"]
export type CurrentUser  = components["schemas"]["CurrentUserDto"]
export type Subscription = components["schemas"]["SubscriptionDto"]
export type AdminUser    = components["schemas"]["AdminUserDto"]

// ---- Command / request aliases ----

export type CreateProjectInput           = components["schemas"]["CreateProjectCommand"]
export type UpdateProjectInput           = components["schemas"]["UpdateProjectCommand"]
export type ImportProjectInput           = components["schemas"]["ImportProjectCommand"]
export type SaveAssessmentInput          = components["schemas"]["SaveAssessmentRequest"]
export type CreateUserInput              = components["schemas"]["CreateUserRequest"]
export type UpdateUserSubscriptionInput  = components["schemas"]["UpdateUserSubscriptionRequest"]
export type SetUserRoleInput             = components["schemas"]["SetUserRoleRequest"]

// ---- Result aliases ----

export type GenerateReportResult = components["schemas"]["GenerateReportResult"]

// ---- Derived / narrow types used by consumers ----

/** The three subscription tiers understood by the admin UI. */
export type SubscriptionPlan = "Free" | "Pro" | "Enterprise"
