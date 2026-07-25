import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "../layout/AppLayout";
import {
  LoginScreen,
  OidcCallback,
  OidcSilentCallback,
  LogoutScreen,
  ForbiddenScreen,
  RequireAuth,
  RequireAdmin,
} from "../auth/routes";
import { Dashboard } from "../features/dashboard/Dashboard";
import { LogsPage } from "../features/logs/LogsPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginScreen /> },
  { path: "/auth/callback", element: <OidcCallback /> },
  { path: "/auth/silent", element: <OidcSilentCallback /> },
  { path: "/logout", element: <LogoutScreen /> },
  { path: "/403", element: <ForbiddenScreen /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireAdmin />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <Dashboard /> },
              { path: "logs", element: <LogsPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
