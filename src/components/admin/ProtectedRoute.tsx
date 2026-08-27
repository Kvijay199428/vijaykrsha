import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Skeleton } from "../ui/skeleton";

function AdminFrameSkeleton() {
  const collapsed = (() => {
    const saved = localStorage.getItem("admin-sidebar-collapsed");
    if (saved !== null) return saved === "true";
    return window.innerWidth < 768;
  })();

  return (
    <div className="admin-theme flex h-screen overflow-hidden bg-background text-foreground">
      <aside
        className={`${
          collapsed ? "w-16" : "w-64"
        } neu-flat border-0 flex flex-col shrink-0 m-2 rounded-2xl`}
      >
        {/* Header */}
        <div
          className={`flex items-center border-b border-border/50 min-h-[57px] ${
            collapsed ? "flex-col py-3 px-2 gap-2" : "flex-row gap-2 px-3 py-5"
          }`}
        >
          <Skeleton className={`${collapsed ? "h-8 w-8" : "h-7 w-7"} rounded-xl`} />
          {!collapsed && <Skeleton className="h-4 w-40" />}
          {!collapsed && <Skeleton className="ml-auto h-4 w-4 rounded-lg" />}
        </div>
        {collapsed && <Skeleton className="mx-auto h-4 w-4 rounded-lg" />}

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <Skeleton className="h-5 w-5 rounded-lg shrink-0" />
              {!collapsed && (
                <Skeleton
                  className="h-3.5 flex-1"
                  style={{ maxWidth: 60 + (i % 3) * 25 }}
                />
              )}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border/50 px-2 py-3 space-y-2">
          <div
            className={`flex items-center gap-3 px-3 py-2 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            {!collapsed && <Skeleton className="h-3.5 flex-1 max-w-[90px]" />}
          </div>
          <div
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <Skeleton className="h-4 w-4 rounded-lg shrink-0" />
            {!collapsed && <Skeleton className="h-3.5 flex-1 max-w-[70px]" />}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden p-2">
        <div className="h-full neu-flat rounded-2xl p-6 flex flex-col gap-3">
          <div className="shrink-0 space-y-2">
            <Skeleton className="h-7 w-48 max-w-full" />
            <Skeleton className="h-3.5 w-64 max-w-full" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 shrink-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="neu-convex p-6">
                <div className="flex items-center justify-between mb-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-5" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>

          <div className="neu-flat flex flex-col gap-3 flex-1 min-h-0">
            <div className="flex items-center justify-between p-6 border-b border-border/50 shrink-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3.5 w-20" />
            </div>
            <div className="divide-y divide-border/50 overflow-auto flex-1 min-h-0">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div role="status" aria-label="Checking session">
        <AdminFrameSkeleton />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/vega/admin/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <Outlet />;
}