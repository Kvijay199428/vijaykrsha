import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import About from "@/pages/About";
import Freelance from "@/pages/Freelance";
import Portfolio from "@/pages/Portfolio";
import Apps from "@/pages/Apps";
import Contact from "@/pages/Contact";
import NotFound from "@/pages/NotFound";
import AdminLogin from "@/pages/AdminLogin";
import Setup from "@/pages/admin/Setup";
import ProtectedRoute from "@/components/admin/ProtectedRoute";
import AdminLayout from "@/pages/admin/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import Inbox from "@/pages/admin/Inbox";
import MessageDetail from "@/pages/admin/MessageDetail";
import Settings from "@/pages/admin/Settings";
import UsersPage from "@/pages/admin/Users";
import RolesPage from "@/pages/admin/Roles";
import AuditLogs from "@/pages/admin/AuditLogs";

export default function App() {
  return (
    <Routes>
      {/* Public admin routes */}
      <Route path="/vega/admin/login" element={<AdminLogin />} />
      <Route path="/vega/admin/setup" element={<Setup />} />

      {/* Protected admin routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/vega/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="messages/:id" element={<MessageDetail />} />
          <Route path="settings" element={<Settings />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route
            path="admin-users"
            element={<Navigate to="/vega/admin/users" replace />}
          />
          <Route path="audit-logs" element={<AuditLogs />} />
        </Route>
      </Route>

      {/* Public site routes */}
      <Route
        path="*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/freelance" element={<Freelance />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/apps" element={<Apps />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}
