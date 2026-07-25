/* eslint-disable react-refresh/only-export-components -- router singleton, not a component module */
import { createBrowserRouter } from "react-router-dom";
import {
  LoginScreen,
  LogoutScreen,
  NotFoundScreen,
  OidcCallback,
  OidcSilentCallback,
  RequireAdmin,
} from "@/auth/routes";
import { AppLayout } from "@/layout/AppLayout";
import { UsersPage } from "@/pages/UsersPage";
import { RolesServicesPage } from "@/pages/RolesServicesPage";

export const router = createBrowserRouter([
  // Public auth surface — everything else sits behind <RequireAdmin>.
  { path: "/login", element: <LoginScreen /> },
  { path: "/auth/callback", element: <OidcCallback /> },
  { path: "/auth/silent", element: <OidcSilentCallback /> },
  { path: "/logout", element: <LogoutScreen /> },

  {
    element: <RequireAdmin />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <UsersPage /> },
          { path: "users", element: <UsersPage /> },
          { path: "reference", element: <RolesServicesPage /> },
          { path: "*", element: <NotFoundScreen /> },
        ],
      },
    ],
  },
]);
