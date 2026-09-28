import { memo, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, CalendarDays, LogOut, Menu, MessageCircle, Moon, Search, Sun, User } from "lucide-react";
import { PROFILE_ITEM, getAllVisibleMenuGroups, roleCanSeeItem } from "./workbenchNavigation";
import "./AppTopCommandBar.css";

const AppTopCommandBar = ({ pageHeader, theme, onToggleTheme, onMenuOpen, onLogout, actions, user, userRole, unreadAlerts = 0, unreadChats = 0 }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const isInventory = location.pathname === "/inventory";
  const role = userRole || user?.role;
  const isFieldHome = role === "FIELD_EXECUTIVE" && ["/", "/dashboard"].includes(location.pathname);
  const menuItems = getAllVisibleMenuGroups(role, user).flatMap((group) => group.items);
  const items = [...new Map(menuItems.map((item) => [item.path, item])).values()];
  const canNotify = items.some((item) => item.path === "/admin/notifications");
  const canChat = items.some((item) => item.path === "/chat");
  const canProfile = roleCanSeeItem(PROFILE_ITEM, role, user);
  const currentItem = items.filter((item) => location.pathname === item.path || location.pathname.startsWith(item.path + "/")).sort((a, b) => b.path.length - a.path.length)[0];
  const firstName = String(user?.name || user?.fullName || "there").trim().split(/\s+/)[0];
  const title = isFieldHome
    ? `Welcome back, ${firstName} 👋`
    : currentItem?.label || String(pageHeader?.title || "Workspace").replace(/\s+Command\s+Center$/i, "").replace(/\s+Dashboard$/i, "") || "Home";
  const initials = String(user?.name || user?.fullName || "User").trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date());
  const results = items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  /*
   * Two ways into chat, deliberately doing different things.
   *
   * This icon opens the full page, where the conversation list and the thread
   * sit side by side - the view for actually working through messages. The
   * floating button at the bottom right opens the panel over the current page,
   * for answering something without leaving what you were doing.
   */
  const openChat = () => navigate("/chat");

  useEffect(() => {
    const key = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key === "Escape") setSearchOpen(false);
    };
    const sync = (event) => setQuery(String(event.detail || ""));
    window.addEventListener("keydown", key);
    if (isInventory) window.addEventListener("inventory:search-sync", sync);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("inventory:search-sync", sync); };
  }, [isInventory]);

  const search = (value) => {
    setQuery(value);
    if (isInventory) window.dispatchEvent(new CustomEvent("inventory:search", { detail: value }));
    else setSearchOpen(true);
  };

  return (
    <header className="app-context-header">
      <button type="button" className="app-header-menu app-header-icon" aria-label="Open navigation" onClick={onMenuOpen}><Menu size={20} /></button>
      <div className="app-header-heading"><h1>{title}</h1><p>{isFieldHome ? "Here's what's happening with your pipeline today." : pageHeader?.subtitle || "Manage your workspace and daily activities."}</p></div>
      <div className="app-header-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false); }}>
        <Search size={18} />
        <input ref={searchRef} aria-label={isInventory ? "Search inventory" : "Search pages"} placeholder={isInventory ? "Search properties, projects, locations..." : "Search pages..."} value={query} onChange={(event) => search(event.target.value)} onFocus={() => setSearchOpen(true)} />
        <kbd>Ctrl K</kbd>
        {!isInventory && searchOpen && <div className="app-header-search-results">
          {results.length ? results.map((item) => <button type="button" key={item.path} onClick={() => { navigate(item.path); setQuery(""); setSearchOpen(false); }}>{item.label}</button>) : <p>No matching pages</p>}
        </div>}
      </div>
      <div className="app-header-controls">
        {actions}
        {canNotify && <button type="button" className="app-header-icon" aria-label="Open notifications" title="Notifications" onClick={() => navigate("/admin/notifications")}><Bell size={21} />{unreadAlerts > 0 && <span className="app-header-unread">{unreadAlerts > 99 ? "99+" : unreadAlerts}</span>}</button>}
        {canChat && <button type="button" className="app-header-icon" aria-label="Open team chat" title="Chat" onClick={openChat}><MessageCircle size={21} />{unreadChats > 0 && <span className="app-header-unread">{unreadChats > 99 ? "99+" : unreadChats}</span>}</button>}
        <div className="app-header-date"><CalendarDays size={17} />{today}</div>
        {canProfile && <button type="button" className="app-header-avatar" aria-label="Open profile" title={user?.name || "Profile"} onClick={() => navigate("/profile")}>{initials || <User size={18} />}</button>}
        <button type="button" className="app-header-icon" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={onToggleTheme}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
        <button type="button" className="app-header-logout" onClick={onLogout} aria-label="Logout" title="Logout"><LogOut size={18} /><span>Logout</span></button>
      </div>
    </header>
  );
};

export default memo(AppTopCommandBar);
