import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardShellPage } from "./pages/DashboardShellPage";
import { CustomersListPage } from "./pages/customers/CustomersListPage";
import { CustomerFormPage } from "./pages/customers/CustomerFormPage";
import { CustomerDetailPage } from "./pages/customers/CustomerDetailPage";
import { TicketsListPage } from "./pages/tickets/TicketsListPage";
import { TicketFormPage } from "./pages/tickets/TicketFormPage";
import { TicketDetailPage } from "./pages/tickets/TicketDetailPage";
import { KbListPage } from "./pages/kb/KbListPage";
import { KbFormPage } from "./pages/kb/KbFormPage";
import { KbDetailPage } from "./pages/kb/KbDetailPage";
import { ReportsPage } from "./pages/ReportsPage";
import { QuickRepliesPage } from "./pages/QuickRepliesPage";
import { AuditLogPage } from "./pages/AuditLogPage";
import { AdminSlaSettingsPage } from "./pages/AdminSlaSettingsPage";
import { AdminOrgSettingsPage } from "./pages/AdminOrgSettingsPage";
import { BrandingSettingsPage } from "./pages/admin/BrandingSettingsPage";
import { UsersPage } from "./pages/admin/UsersPage";
import { ChatPage } from "./pages/ChatPage";
import { LiveChatQueuePage } from "./pages/LiveChatQueuePage";
import { RequireAuth } from "./auth/RequireAuth";
import { Layout } from "./components/Layout";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardShellPage />} />
          <Route
            path="/customers"
            element={
              <RequireAuth roles={["Admin", "Manager", "Agent"]}>
                <CustomersListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/customers/new"
            element={
              <RequireAuth roles={["Admin", "Agent"]}>
                <CustomerFormPage />
              </RequireAuth>
            }
          />
          <Route
            path="/customers/:id"
            element={
              <RequireAuth roles={["Admin", "Manager", "Agent", "Customer"]}>
                <CustomerDetailPage />
              </RequireAuth>
            }
          />
          <Route path="/tickets" element={<TicketsListPage />} />
          <Route path="/tickets/new" element={<TicketFormPage />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
          <Route path="/kb" element={<KbListPage />} />
          <Route
            path="/kb/new"
            element={
              <RequireAuth roles={["Admin", "Agent"]}>
                <KbFormPage />
              </RequireAuth>
            }
          />
          <Route path="/kb/:id" element={<KbDetailPage />} />
          <Route
            path="/reports"
            element={
              <RequireAuth roles={["Admin", "Manager"]}>
                <ReportsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/quick-replies"
            element={
              <RequireAuth roles={["Admin", "Manager", "Agent"]}>
                <QuickRepliesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/audit-log"
            element={
              <RequireAuth roles={["Admin"]}>
                <AuditLogPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/sla-settings"
            element={
              <RequireAuth roles={["Admin"]}>
                <AdminSlaSettingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/org-settings"
            element={
              <RequireAuth roles={["Admin"]}>
                <AdminOrgSettingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/branding"
            element={
              <RequireAuth roles={["Admin"]}>
                <BrandingSettingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequireAuth roles={["Admin"]}>
                <UsersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/chat"
            element={
              <RequireAuth roles={["Customer"]}>
                <ChatPage />
              </RequireAuth>
            }
          />
          <Route
            path="/live-chat"
            element={
              <RequireAuth roles={["Admin", "Manager", "Agent"]}>
                <LiveChatQueuePage />
              </RequireAuth>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
