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
import { MyBallots } from "../features/vote/MyBallots";
import { BallotPage } from "../features/vote/BallotPage";
import { ElectionsList } from "../features/elections/ElectionsList";
import { ElectionForm } from "../features/elections/ElectionForm";
import { ElectionResults } from "../features/elections/ElectionResults";

/**
 * Two audiences, one SPA.
 *
 * The voter routes sit behind `RequireAuth` only. They must NOT be admin-gated: eligibility for an
 * election is decided per election by the API from the organisation's directory, and putting an
 * `Administrator` check in front of the ballot would disenfranchise every engineer.
 *
 * The admin routes sit behind `RequireAdmin` as well, and the API enforces the same at
 * `/api/ElectionAdmin` — this guard only saves a round trip and shows a readable 403.
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
        element: <AppLayout />,
        children: [
          // ── voter ───────────────────────────────────────────────────────────
          { index: true, element: <MyBallots /> },
          { path: "vote/:id", element: <BallotPage /> },
          // Results are open to any authenticated member: a result nobody can read is not a result.
          { path: "result/:id", element: <ElectionResults /> },

          // ── admin ───────────────────────────────────────────────────────────
          {
            element: <RequireAdmin />,
            children: [
              { path: "admin", element: <ElectionsList /> },
              { path: "admin/new", element: <ElectionForm /> },
              { path: "admin/:id", element: <ElectionForm /> },
              { path: "admin/:id/result", element: <ElectionResults /> },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
