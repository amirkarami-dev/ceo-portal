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
import { DashboardPage } from "@/pages/DashboardPage";
import { NewsPage } from "@/pages/NewsPage";
import { CategoriesPage } from "@/pages/CategoriesPage";
import { SlidesPage } from "@/pages/SlidesPage";
import { QuickLinksPage } from "@/pages/QuickLinksPage";
import { FooterLinksPage } from "@/pages/FooterLinksPage";
import { PeoplePage } from "@/pages/PeoplePage";
import { UnitsPage } from "@/pages/UnitsPage";
import { TabGroupsPage } from "@/pages/TabGroupsPage";
import { OrgPagesPage } from "@/pages/OrgPagesPage";
import { FormsPage } from "@/pages/FormsPage";
import { SubmissionsPage } from "@/pages/SubmissionsPage";
import { MessagesPage } from "@/pages/MessagesPage";
import { SettingsPage } from "@/pages/SettingsPage";

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
          { index: true, element: <DashboardPage /> },
          { path: "news", element: <NewsPage /> },
          { path: "categories", element: <CategoriesPage /> },
          { path: "slides", element: <SlidesPage /> },
          { path: "quick-links", element: <QuickLinksPage /> },
          { path: "footer-links", element: <FooterLinksPage /> },
          { path: "people", element: <PeoplePage /> },
          { path: "units", element: <UnitsPage /> },
          { path: "tab-groups", element: <TabGroupsPage /> },
          { path: "org-pages", element: <OrgPagesPage /> },
          { path: "forms", element: <FormsPage /> },
          { path: "submissions", element: <SubmissionsPage /> },
          { path: "messages", element: <MessagesPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "*", element: <NotFoundScreen /> },
        ],
      },
    ],
  },
]);
