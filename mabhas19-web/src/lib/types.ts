// API DTO types — sourced from the generated @mabhas19/api-types package.
// All existing "@/lib/types" imports in this project continue to work unchanged.

// NOTE: Admin user-management DTOs (AdminUser, CreateUserInput,
// UpdateUserSubscriptionInput, SetUserRoleInput) and the SubscriptionPlan helper were
// dropped — user management moved to the separate admin app (admin.myceo.ir) and the
// API's /api/Admin/* endpoints (and their generated schema types) were removed.
export type {
  Project,
  Assessment,
  CurrentUser,
  Subscription,
  CreateProjectInput,
  UpdateProjectInput,
  ImportProjectInput,
  SaveAssessmentInput,
  GenerateReportResult,
} from "@mabhas19/api-types"

import type { CurrentUser } from "@mabhas19/api-types"

// Kept for backward-compat — UserInfo now carries role/identity info too.
// Not in the OpenAPI contract; kept as a local alias.
export interface UserInfo extends CurrentUser {
  isEmailConfirmed?: boolean
}
