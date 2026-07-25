/* eslint-disable react-refresh/only-export-components -- router singleton, not a hot-reload component module */
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "../layout/AppLayout";
import {
  LoginScreen,
  OidcCallback,
  OidcSilentCallback,
  LogoutScreen,
  ForbiddenScreen,
  RequireAuth,
  RequireRole,
  RequirePermission,
} from "../auth/routes";
import { PagePlaceholder } from "./PagePlaceholder";
import { AskAiBuilder } from "../features/ask-ai";
import { ReportLibrary } from "../features/library";
import { ReportViewer } from "../features/viewer";
import { DashboardList, DashboardBuilder } from "../features/dashboards";
import AIAdminShell from "../admin/ai/AIAdminShell";
import { AIProviderList } from "../admin/ai/providers/AIProviderList";
import { AIRoutingRules } from "../admin/ai/routing/AIRoutingRules";
import { PromptVersions } from "../admin/ai/prompts/PromptVersions";
import { AIUsageCost } from "../admin/ai/usage/AIUsageCost";
import { UserList } from "../admin/users/UserList";
import { RolePermissionMatrix } from "../admin/roles/RolePermissionMatrix";
import { DataSourceList } from "../admin/data-sources/DataSourceList";
import { SemanticModelList } from "../admin/semantic-models/SemanticModelList";
import { AuditLog } from "../admin/audit/AuditLog";
import { TenantSettings } from "../admin/tenant/TenantSettings";
import { TenantList } from "../admin/tenants/TenantList";
import { SystemSettings } from "../admin/system/SystemSettings";

const P = (name: string) => <PagePlaceholder name={name} />;
const ADMIN_SET = ["SuperAdmin", "TenantAdmin", "AIManager"] as const;

export const router = createBrowserRouter([
  // Public / Auth
  { path: "/login", element: <LoginScreen /> },
  { path: "/auth/callback", element: <OidcCallback /> },
  { path: "/auth/silent", element: <OidcSilentCallback /> },
  { path: "/logout", element: <LogoutScreen /> },
  { path: "/403", element: <ForbiddenScreen /> },

  // Authenticated app
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          // Default redirect to /ask
          { index: true, element: <Navigate to="/ask" replace /> },

          // User Area
          { path: "ask", element: <AskAiBuilder /> },
          { path: "ask/:threadId", element: P("AskAIThread") },
          { path: "reports", element: <ReportLibrary /> },
          {
            element: <RequireRole allow={["ReportDesigner", "TenantAdmin", "SuperAdmin"]} />,
            children: [
              { path: "reports/new", element: P("ReportDesigner (new)") },
              { path: "reports/:reportId/edit", element: P("ReportDesigner (edit)") },
            ],
          },
          { path: "reports/:reportId", element: <ReportViewer /> },
          {
            path: "reports/:reportId/run",
            element: (
              <RequirePermission perm="reports:execute">
                {P("ReportRunResult")}
              </RequirePermission>
            ),
          },
          { path: "reports/:reportId/history", element: P("ReportRunHistory") },
          { path: "dashboards", element: <DashboardList /> },
          {
            element: (
              <RequireRole
                allow={["DashboardDesigner", "TenantAdmin", "SuperAdmin"]}
              />
            ),
            children: [
              { path: "dashboards/new", element: <DashboardBuilder /> },
              { path: "dashboards/:dashId/edit", element: <DashboardBuilder /> },
            ],
          },
          { path: "dashboards/:dashId", element: <DashboardList /> },
          {
            element: (
              <RequireRole
                allow={[
                  "PowerUser",
                  "ReportDesigner",
                  "DashboardDesigner",
                  "AIManager",
                  "TenantAdmin",
                  "SuperAdmin",
                ]}
              />
            ),
            children: [
              { path: "data", element: P("DataCatalog") },
              { path: "data/:modelId", element: P("SemanticModelExplorer") },
            ],
          },
          {
            path: "exports",
            element: (
              <RequirePermission perm="data:export">
                {P("ExportCenter")}
              </RequirePermission>
            ),
          },
          { path: "profile", element: P("UserProfile") },
          { path: "settings", element: P("UserPreferences") },
          { path: "favorites", element: P("Favorites") },

          // Admin Area
          {
            path: "admin",
            element: <RequireRole allow={[...ADMIN_SET]} />,
            children: [
              { index: true, element: P("AdminOverview") },
              {
                path: "users",
                element: (
                  <RequirePermission perm="users:manage">
                    <UserList />
                  </RequirePermission>
                ),
              },
              {
                path: "users/:userId",
                element: (
                  <RequirePermission perm="users:manage">
                    {P("UserDetail")}
                  </RequirePermission>
                ),
              },
              {
                path: "roles",
                element: (
                  <RequirePermission perm="users:manage">
                    <RolePermissionMatrix />
                  </RequirePermission>
                ),
              },
              {
                path: "data-sources",
                element: (
                  <RequirePermission perm="datasources:manage">
                    <DataSourceList />
                  </RequirePermission>
                ),
              },
              {
                path: "data-sources/new",
                element: (
                  <RequirePermission perm="datasources:manage">
                    {P("DataSourceWizard")}
                  </RequirePermission>
                ),
              },
              {
                path: "data-sources/:id",
                element: (
                  <RequirePermission perm="datasources:manage">
                    {P("DataSourceDetail")}
                  </RequirePermission>
                ),
              },
              {
                path: "semantic-models",
                element: (
                  <RequirePermission perm="datasources:manage">
                    <SemanticModelList />
                  </RequirePermission>
                ),
              },
              {
                path: "semantic-models/new",
                element: (
                  <RequirePermission perm="datasources:manage">
                    {P("SemanticModelEditor (new)")}
                  </RequirePermission>
                ),
              },
              {
                path: "semantic-models/:id",
                element: (
                  <RequirePermission perm="datasources:manage">
                    {P("SemanticModelEditor (edit)")}
                  </RequirePermission>
                ),
              },
              // Task 18: AI admin zone — tabbed shell + 4 deep-linkable routes
              {
                path: "ai",
                element: (
                  <RequirePermission perm="ai:manage">
                    <AIAdminShell />
                  </RequirePermission>
                ),
                children: [
                  { index: true, element: <Navigate to="providers" replace /> },
                  { path: "providers", element: <AIProviderList /> },
                  { path: "routing", element: <AIRoutingRules /> },
                  { path: "prompts", element: <PromptVersions /> },
                  { path: "usage", element: <AIUsageCost /> },
                ],
              },
              {
                path: "tenant",
                element: (
                  <RequirePermission perm="users:manage">
                    <TenantSettings />
                  </RequirePermission>
                ),
              },
              {
                path: "audit",
                element: (
                  <RequirePermission perm="audit:read">
                    <AuditLog />
                  </RequirePermission>
                ),
              },
              {
                path: "audit/:eventId",
                element: (
                  <RequirePermission perm="audit:read">
                    {P("AuditEventDetail")}
                  </RequirePermission>
                ),
              },
              {
                path: "tenants",
                element: <RequireRole allow={["SuperAdmin"]} />,
                children: [
                  { index: true, element: <TenantList /> },
                ],
              },
              {
                path: "system",
                element: <RequireRole allow={["SuperAdmin"]} />,
                children: [{ index: true, element: <SystemSettings /> }],
              },
            ],
          },
        ],
      },
    ],
  },

  // 404
  { path: "*", element: <PagePlaceholder name="NotFoundScreen" /> },
]);
