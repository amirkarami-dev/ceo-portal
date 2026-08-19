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
import { GuesthouseRequestPage } from "@/pages/GuesthouseRequestPage";
import { MyReservationsPage } from "@/pages/MyReservationsPage";
import { PayResultPage } from "@/pages/PayResultPage";
import { GuesthousePayPage } from "@/pages/GuesthousePayPage";
import { GuesthousePayResultPage } from "@/pages/GuesthousePayResultPage";
import { AdminServicesPage } from "@/pages/admin/AdminServicesPage";
import { AdminPoolsPage } from "@/pages/admin/AdminPoolsPage";
import { AdminGuesthousesPage } from "@/pages/admin/AdminGuesthousesPage";
import { AdminGuesthouseRequestsPage } from "@/pages/admin/AdminGuesthouseRequestsPage";
import { GuesthouseReferralPage } from "@/pages/admin/GuesthouseReferralPage";
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
        {
          path: "/dev/guesthouse/:serviceId",
          lazy: async () => ({
            Component: (await import("@/pages/dev/GuesthouseFormHarness")).GuesthouseFormHarness,
          }),
        },
        {
          path: "/dev/guesthouse-requests",
          lazy: async () => ({
            Component: (await import("@/pages/dev/GuesthouseFormHarness"))
              .MyGuesthouseRequestsHarness,
          }),
        },
        {
          path: "/dev/guesthouse-pay/:token",
          lazy: async () => ({
            Component: (await import("@/pages/dev/GuesthouseFormHarness")).GuesthousePayHarness,
          }),
        },
        {
          path: "/dev/admin-guesthouses",
          lazy: async () => ({
            Component: (await import("@/pages/dev/GuesthouseFormHarness"))
              .AdminGuesthousesHarness,
          }),
        },
        {
          path: "/dev/admin-services",
          lazy: async () => ({
            Component: (await import("@/pages/dev/GuesthouseFormHarness")).AdminServicesHarness,
          }),
        },
        {
          path: "/dev/admin-requests",
          lazy: async () => ({
            Component: (await import("@/pages/dev/GuesthouseFormHarness")).AdminRequestsHarness,
          }),
        },
        {
          path: "/dev/referral/:id",
          lazy: async () => ({
            Component: (await import("@/pages/dev/GuesthouseFormHarness"))
              .GuesthouseReferralHarness,
          }),
        },
      ]
    : []),

  // Public auth surface.
  { path: "/login", element: <LoginScreen /> },
  { path: "/auth/callback", element: <OidcCallback /> },
  { path: "/auth/silent", element: <OidcSilentCallback /> },
  { path: "/logout", element: <LogoutScreen /> },

  // Guesthouse payment — PUBLIC, and it must stay that way. The person opening the SMS link may
  // have no account at all; that is the whole point of the feature. Inside RequireAuth they
  // would be sent to a login they can never pass, and the feature would be dead.
  { path: "/pay/guesthouse/result", element: <GuesthousePayResultPage /> },
  { path: "/pay/guesthouse/:token", element: <GuesthousePayPage /> },

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
              { path: "guesthouse/:serviceId", element: <GuesthouseRequestPage /> },
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
              { path: "guesthouses", element: <AdminGuesthousesPage /> },
              { path: "guesthouse-requests", element: <AdminGuesthouseRequestsPage /> },
              {
                path: "guesthouse-requests/:id/referral",
                element: <GuesthouseReferralPage />,
              },
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
