/* eslint-disable react-refresh/only-export-components -- router singleton, not a component module */
import { createBrowserRouter } from "react-router-dom";
import {
  LoginScreen,
  LogoutScreen,
  NotFoundScreen,
  OidcCallback,
  OidcSilentCallback,
  RequireAdmin,
  RequireAuth,
} from "@/auth/routes";
import { EngineerGate } from "@/auth/EngineerGate";
import { AppLayout } from "@/layout/AppLayout";
import { ServicesPage } from "@/pages/ServicesPage";
import { BookingPage } from "@/pages/BookingPage";
import { MyReservationsPage } from "@/pages/MyReservationsPage";
import { PayResultPage } from "@/pages/PayResultPage";
import { AdminServicesPage } from "@/pages/admin/AdminServicesPage";
import { AdminPoolsPage } from "@/pages/admin/AdminPoolsPage";
import { AdminReservationsPage } from "@/pages/admin/AdminReservationsPage";
import { AdminPaymentsPage } from "@/pages/admin/AdminPaymentsPage";

export const router = createBrowserRouter([
  // Dev-only picker harness (never bundled in production builds).
  ...(import.meta.env.DEV
    ? [
        {
          path: "/dev/pickers",
          lazy: async () => ({
            Component: (await import("@/pages/dev/PickerHarness")).PickerHarness,
          }),
        },
      ]
    : []),

  // Public auth surface.
  { path: "/login", element: <LoginScreen /> },
  { path: "/auth/callback", element: <OidcCallback /> },
  { path: "/auth/silent", element: <OidcSilentCallback /> },
  { path: "/logout", element: <LogoutScreen /> },

  // Engineer dashboard — any signed-in engineer.
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          // Booking needs an engineer membership record (looked up by کد ملی); a staff
          // account gets a plain explanation here instead of a 400 at reserve time.
          // The payment return page stays outside the gate — the bank must always land.
          {
            element: <EngineerGate />,
            children: [
              { index: true, element: <ServicesPage /> },
              { path: "book/:serviceId", element: <BookingPage /> },
              { path: "reservations", element: <MyReservationsPage /> },
            ],
          },
          { path: "pay/result", element: <PayResultPage /> },

          // Admin section — Administrator role only.
          {
            path: "admin",
            element: <RequireAdmin />,
            children: [
              { index: true, element: <AdminServicesPage /> },
              { path: "pools", element: <AdminPoolsPage /> },
              { path: "reservations", element: <AdminReservationsPage /> },
              { path: "payments", element: <AdminPaymentsPage /> },
            ],
          },

          { path: "*", element: <NotFoundScreen /> },
        ],
      },
    ],
  },
]);
