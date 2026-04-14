import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./auth/AuthContext";
import { AdminLayout } from "./components/AdminLayout";
import { AccessPage } from "./pages/AccessPage";
import { CampaignDetailPage } from "./pages/CampaignDetailPage";
import { CampaignsPage } from "./pages/CampaignsPage";
import { ClientDetailPage } from "./pages/ClientDetailPage";
import { ClientsPage } from "./pages/ClientsPage";
import { CreativesQueuePage } from "./pages/CreativesQueuePage";
import { AgencyPage } from "./pages/AgencyPage";
import { LoginPage } from "./pages/LoginPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PublisherDetailPage } from "./pages/PublisherDetailPage";
import { PublisherExplorerPage } from "./pages/PublisherExplorerPage";
import { PublisherNewPage } from "./pages/PublisherNewPage";
import { PublishersPage } from "./pages/PublishersPage";

function RequireAuth({ children }: { children: ReactNode }) {
  const { token, loading } = useAuth();
  const location = useLocation();

  if (loading && token) {
    return (
      <div className="page-center muted" aria-busy="true">
        Loading…
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="agency" element={<AgencyPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:id" element={<ClientDetailPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="campaigns/:id" element={<CampaignDetailPage />} />
        <Route path="publishers" element={<PublishersPage />} />
        <Route path="publishers/new" element={<PublisherNewPage />} />
        <Route path="publishers/explorer" element={<PublisherExplorerPage />} />
        <Route path="publishers/:id" element={<PublisherDetailPage />} />
        <Route path="creatives" element={<CreativesQueuePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="access" element={<AccessPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
