import { memo, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, CalendarDays, LogOut, Menu, MessageCircle, Moon, Search, Sun, User } from "lucide-react";
import { PROFILE_ITEM, getAllVisibleMenuGroups, roleCanSeeItem } from "./workbenchNavigation";
import { useIsMobileViewport } from "../../hooks/useIsMobileViewport";
import "./AppTopCommandBar.css";

const AppTopCommandBar = ({ pageHeader, theme, onToggleTheme, onMenuOpen, onLogout, actions, user, userRole, unreadAlerts = 0, unreadChats = 0 }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobileViewport = useIsMobileViewport();
  const searchRef = useRef(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const isInventory = location.pathname === "/inventory";
  const role = userRole || user?.role;
  const menuItems = getAllVisibleMenuGroups(role, user).flatMap((group) => group.items);
  const items = [...new Map(menuItems.map((item) => [item.path, item])).values()];
  const canNotify = items.some((item) => item.path === "/admin/notifications");
  const canChat = items.some((item) => item.path === "/chat");
  const canProfile = roleCanSeeItem(PROFILE_ITEM, role, user);
  const currentItem = items.filter((item) => location.pathname === item.path || location.pathname.startsWith(item.path + "/")).sort((a, b) => b.path.length - a.path.length)[0];
  const title = currentItem?.label || String(pageHeader?.title || "Workspace").replace(/\s+Command\s+Center$/i, "").replace(/\s+Dashboard$/i, "") || "Home";
  const initials = String(user?.name || user?.fullName || "User").trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date());
  const results = items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  /*
   * On a phone the floating messenger is not rendered at all - a draggable
   * panel over a 360px screen covers the very thing it is meant to sit beside -
   * so the icon opens the full chat page. On a desktop it still opens the
   * messenger over whatever you were doing, which is the point of it.
   */
  const openChat = () => {
    if (isMobileViewport) {
      navigate("/chat");
      return;
    }
    window.dispatchEvent(new Event("crm:open-messenger"));
  };

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
      <div className="app-header-heading"><h1>{title}</h1><p>{pageHeader?.subtitle || "Manage your workspace and daily activities."}</p></div>
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
