import { NavLink, useNavigate } from "react-router-dom";
import { CalendarCheck, FileSignature, FileText, LayoutDashboard, LogOut, Receipt } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { cn } from "./utils";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Invoices", path: "/invoices", icon: Receipt },
  { label: "Bookings", path: "/bookings", icon: CalendarCheck },
  { label: "Contracts", path: "/contracts", icon: FileSignature },
  { label: "Documents", path: "/documents", icon: FileText },
];

const Layout = ({ children }) => {
  const { user, client, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 sm:flex">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-600">Client Portal</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-800">{client?.companyName || "Your workspace"}</p>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
                  isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100",
                )
              }
            >
              <Icon aria-hidden="true" size={16} />
              {item.label}
            </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 pt-3">
          <p className="truncate text-xs font-semibold text-slate-500">{user?.name}</p>
          <p className="truncate text-xs text-slate-400">{user?.email}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
          >
            <LogOut aria-hidden="true" size={14} />
            Logout
          </button>
        </div>
      </aside>

      <main className="min-h-screen flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
    </div>
  );
};

export default Layout;
