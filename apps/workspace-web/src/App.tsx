import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAdmin } from "./auth/RequireAdmin";
import { RequireAuth } from "./auth/RequireAuth";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import { AcceptInvitePage } from "./pages/AcceptInvitePage";
import { AdminInvitesPage } from "./pages/AdminInvitesPage";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PublishersPage } from "./pages/PublishersPage";
import { MarketsPage } from "./pages/MarketsPage";
import { EventsPage } from "./pages/EventsPage";
import { StrategiesPage } from "./pages/StrategiesPage";
import { ProjectsPage } from "./pages/ProjectsPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route
        element={
          <RequireAuth>
            <WorkspaceLayout />
          </RequireAuth>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="publishers" element={<PublishersPage />} />
        <Route path="markets" element={<MarketsPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="strategies" element={<StrategiesPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route
          path="admin/invites"
          element={
            <RequireAdmin>
              <AdminInvitesPage />
            </RequireAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
