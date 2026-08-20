import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  LayoutDashboard,
  Inbox,
  Settings,
  Users,
  ScrollText,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
} from "lucide-react";

const navItems = [
  { to: "/vega/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/vega/admin/inbox", label: "Inbox", icon: Inbox },
  { to: "/vega/admin/settings", label: "Settings", icon: Settings },
  { to: "/vega/admin/users", label: "Users", icon: Users },
  { to: "/vega/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
];

export default function AdminLayout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("admin-sidebar-collapsed") === "true";
  });

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("admin-sidebar-collapsed", String(next));
      return next;
    });
  }

  function handleLogout() {
    logout();
    navigate("/vega/admin/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside
        className={`${
          collapsed ? "w-16" : "w-64"
        } neu-flat border-0 flex flex-col transition-all duration-200 shrink-0 m-2 rounded-2xl`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-4 border-b border-border/50 min-h-[57px]">
          <div className="p-1.5 neu-btn rounded-xl">
            <Shield className="w-4 h-4 text-primary shrink-0" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm truncate">Vega Admin</span>
          )}
          <button
            onClick={toggleSidebar}
            className="ml-auto p-1.5 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                  isActive
                    ? "neu-pressed text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                } ${collapsed ? "justify-center" : ""}`
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border/50 px-2 py-3 space-y-1">
          {!collapsed && admin && (
            <div className="px-3 py-1.5 text-xs text-muted-foreground truncate">
              {admin.username} &middot; {admin.role}
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-destructive transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
            title={collapsed ? "Logout" : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-2">
        <div className="h-full neu-flat rounded-2xl p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
