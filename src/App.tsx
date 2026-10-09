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
import { AuthProvider } from "@/contexts/AuthContext";
import Dashboard from "@/pages/admin/Dashboard";
import Inbox from "@/pages/admin/Inbox";
import Settings from "@/pages/admin/Settings";
import UsersPage from "@/pages/admin/Users";
import RolesPage from "@/pages/admin/Roles";
import AuditLogs from "@/pages/admin/AuditLogs";
import Trash from "@/pages/admin/Trash";

export default function App() {
  return (
    <Routes>
      {/* Public admin routes — AuthProvider is scoped to the admin area so the
          public site (/, /about, /contact, …) never mounts it and never probes
          the session endpoint. AdminLogin still needs the context for
          login/exchange, but no bootstrap probe fires here — that lives in
          ProtectedRoute only. */}
      <Route
        path="/vega/admin/login"
        element={
          <AuthProvider>
            <AdminLogin />
          </AuthProvider>
        }
      />
      <Route path="/vega/admin/setup" element={<Setup />} />

      {/* Protected admin routes — AuthProvider is scoped here so the public
          site (/, /about, /contact, …) never mounts it and never probes the
          admin session endpoint. */}
      <Route
        path="/vega/admin"
        element={
          <AuthProvider>
            <ProtectedRoute />
          </AuthProvider>
        }
      >
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="trash" element={<Trash />} />
          <Route
            path="messages/:id"
            element={<Navigate to="/vega/admin/inbox" replace />}
          />
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
