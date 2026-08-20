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
import { MyMeetings } from "../features/meetings/MyMeetings";
import { JoinPage } from "../features/join/JoinPage";
import { MeetingPage } from "../features/meeting/MeetingPage";
import { RoomsList } from "../features/rooms/RoomsList";
import { RoomForm } from "../features/rooms/RoomForm";

/**
 * Two audiences, one SPA — the same shape as election-web.
 *
 * The attendee route sits behind `RequireAuth` only. It must NOT be admin-gated: who may attend a
 * meeting is decided per meeting by the API from the invite list and the presenter, and an
 * `Administrator` check in front of «جلسات من» would hide every meeting from everybody invited to one.
 *
 * The admin routes sit behind `RequireAdmin` as well, and the API enforces the same at
 * `/api/RoomAdmin` — this guard only saves a round trip and shows a readable 403.
 *
 * `/j/:joinToken` sits outside BOTH — outside `RequireAuth` and outside `AppLayout`. Whoever opens it
 * may have no account at all, which is the entire feature; and even a signed-in visitor should not see
 * a sidebar and an app menu on a page they arrived at from a chat message.
 *
 * `/room/:id` is the member's door into the same meeting screen a guest reaches from `/j/:joinToken`.
 * It sits inside `RequireAuth` but OUTSIDE `AppLayout`: a meeting wants the whole viewport, and a
 * sidebar next to a video grid is pixels taken from the thing people came to look at.
 */
export const router = createBrowserRouter([
  // Dev-only probe for the Excalidraw language (never bundled in production builds).
  ...(import.meta.env.DEV
    ? [
        {
          path: "/dev/excalidraw-lang",
          lazy: async () => ({
            Component: (await import("@/features/whiteboard/dev/ExcalidrawLangProbe"))
              .ExcalidrawLangProbe,
          }),
        },
      ]
    : []),

  { path: "/j/:joinToken", element: <JoinPage /> },
  { path: "/login", element: <LoginScreen /> },
  { path: "/auth/callback", element: <OidcCallback /> },
  { path: "/auth/silent", element: <OidcSilentCallback /> },
  { path: "/logout", element: <LogoutScreen /> },
  { path: "/403", element: <ForbiddenScreen /> },
  {
    element: <RequireAuth />,
    children: [
      // Full-viewport, no app chrome — see the note above.
      { path: "room/:id", element: <MeetingPage /> },
      {
        element: <AppLayout />,
        children: [
          // ── attendee ────────────────────────────────────────────────────────
          { index: true, element: <MyMeetings /> },

          // ── admin ───────────────────────────────────────────────────────────
          {
            element: <RequireAdmin />,
            children: [
              { path: "admin", element: <RoomsList /> },
              { path: "admin/new", element: <RoomForm /> },
              { path: "admin/:id", element: <RoomForm /> },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
