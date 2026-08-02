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
import { CameraWall } from "../features/wall/CameraWall";
import { CamerasList } from "../features/cameras/CamerasList";
import { CameraForm } from "../features/cameras/CameraForm";

/**
 * One audience, unlike election-web and room-web.
 *
 * The design settled that **only administrators may watch**, so there is no second, lighter door
 * here: the wall itself sits behind `RequireAdmin`, not just the management screens. A city is
 * classification and filtering, never a permission — so there is nothing to scope per user either.
 *
 * The API enforces the same on every route under `/api/VmsAdmin` and on `/api/VmsMedia/session`;
 * these guards only save a round trip and show a readable 403 instead of an empty page.
 */
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
              { index: true, element: <CameraWall /> },
              { path: "admin", element: <CamerasList /> },
              { path: "admin/new", element: <CameraForm /> },
              { path: "admin/:id", element: <CameraForm /> },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
