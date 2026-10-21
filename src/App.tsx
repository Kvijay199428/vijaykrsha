import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import About from "@/pages/About";
import Freelance from "@/pages/Freelance";
import Portfolio from "@/pages/Portfolio";
import Apps from "@/pages/Apps";
import Contact from "@/pages/Contact";
import NotFound from "@/pages/NotFound";
import ProtectedRoute from "@/components/admin/ProtectedRoute";
import { AuthProvider } from "@/contexts/AuthContext";

// Admin-only screens are code-split so their JavaScript never lands in the chunk
// a public visitor downloads. The public routes above stay eager so first paint
// on the marketing pages is not deferred behind a lazy boundary.
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));
const Setup = lazy(() => import("@/pages/admin/Setup"));
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const Dashboard = lazy(() => import("@/pages/admin/Dashboard"));
const Inbox = lazy(() => import("@/pages/admin/Inbox"));
const Settings = lazy(() => import("@/pages/admin/Settings"));
const UsersPage = lazy(() => import("@/pages/admin/Users"));
const RolesPage = lazy(() => import("@/pages/admin/Roles"));
const AuditLogs = lazy(() => import("@/pages/admin/AuditLogs"));
const Trash = lazy(() => import("@/pages/admin/Trash"));

// Minimal fallback: deliberately does not import the animated BrandLoader, which
// would pull that component back into the eager entry chunk.
function AdminFallback() {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<AdminFallback />}>
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
    </Suspense>
  );
}
