import { useState, useEffect, useRef } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import AnimatedLogo from "../../components/AnimatedLogo";
import SessionExpiryWarning from "../../components/SessionExpiryWarning";
import {
  LayoutDashboard,
  Inbox,
  Trash2,
  Settings,
  Users,
  ShieldCheck,
  ScrollText,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const navItems = [
  { to: "/vega/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: null },
  { to: "/vega/admin/inbox", label: "Inbox", icon: Inbox, roles: null },
  { to: "/vega/admin/trash", label: "Trash", icon: Trash2, roles: null },
  { to: "/vega/admin/settings", label: "Settings", icon: Settings, roles: null },
  { to: "/vega/admin/users", label: "Users", icon: Users, roles: ["owner", "admin", "manager"] },
  { to: "/vega/admin/roles", label: "Roles", icon: ShieldCheck, roles: ["owner", "admin", "manager"] },
  { to: "/vega/admin/audit-logs", label: "Audit Logs", icon: ScrollText, roles: null },
];

const MOBILE_BREAKPOINT = 768;

export default function AdminLayout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("admin-sidebar-collapsed");
    if (saved !== null) return saved === "true";
    return window.innerWidth < MOBILE_BREAKPOINT;
  });
  const [hoverCapsule, setHoverCapsule] = useState<{ label: string; active: boolean } | null>(null);
  const [capsulePos, setCapsulePos] = useState<{ top: number; left: number } | null>(null);
  const hoverElRef = useRef<HTMLElement | null>(null);

  function positionCapsule() {
    const el = hoverElRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCapsulePos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
  }

  useEffect(() => {
    if (!hoverCapsule) return;
    const update = () => positionCapsule();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [hoverCapsule]);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => {
      setCollapsed(e.matches);
      localStorage.setItem("admin-sidebar-collapsed", String(e.matches));
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

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
    <div className="admin-theme flex h-screen overflow-hidden bg-background text-foreground">
      <aside
        className={`${
          collapsed ? "w-16" : "w-64"
        } neu-flat border-0 flex flex-col transition-all duration-200 shrink-0 m-2 rounded-2xl`}
      >
        {/* Header */}
        <div
          className={`flex items-center border-b border-border/50 min-h-[57px] ${
            collapsed
              ? "flex-col py-3 px-2 gap-2"
              : "flex-row gap-2 px-3 py-5"
          }`}
        >
          <AnimatedLogo size={collapsed ? 32 : 28} />
          {!collapsed && (
            <span className="font-semibold text-sm truncate typing-text text-primary uppercase">VIJAYKRSHA.ONLINE</span>
          )}
          {!collapsed && (
            <button
              onClick={toggleSidebar}
              className="ml-auto p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={toggleSidebar}
            className="mx-auto p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => !item.roles || (admin?.role && item.roles.includes(admin.role)))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onMouseEnter={(e) => {
                  if (collapsed) {
                    hoverElRef.current = e.currentTarget;
                    setHoverCapsule({ label: item.label, active: location.pathname === item.to });
                    positionCapsule();
                  }
                }}
                onMouseLeave={() => {
                  hoverElRef.current = null;
                  setHoverCapsule(null);
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                    isActive
                      ? "nav-active"
                      : "text-foreground/75 hover:text-foreground hover:bg-muted/40"
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
        <div className="border-t border-border/50 px-2 py-3 space-y-2">
          {!collapsed && admin && (
            <div className="px-3 py-2 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">
                  {(admin.display_name || admin.username).charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-foreground truncate">{admin.display_name || admin.username}</p>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary shrink-0">
                    {admin.role}
                  </span>
                </div>
              </div>
            </div>
          )}
          {collapsed && admin && (
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">
                  {(admin.display_name || admin.username).charAt(0).toUpperCase()}
                </span>
              </div>
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

      {collapsed && hoverCapsule && capsulePos && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ top: capsulePos.top, left: capsulePos.left }}
          role="tooltip"
        >
          <div
            className={`translate-y-[-50%] neu-flat px-3 py-2.5 rounded-xl text-sm whitespace-nowrap font-medium ${
              hoverCapsule.active ? "nav-active" : "text-foreground/75"
            }`}
          >
            {hoverCapsule.label}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden p-2">
        <div className="h-full neu-flat rounded-2xl p-6 flex flex-col gap-3">
          <SessionExpiryWarning />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
