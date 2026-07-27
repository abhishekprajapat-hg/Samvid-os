import { memo, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, Moon, Sun, UserCircle2 } from "lucide-react";
import { IconButton, Tooltip, cn } from "../ui";
import BrandLogo from "../common/BrandLogo";
import { getActiveSectionId, getVisibleMenuGroups, getVisibleSections } from "./workbenchNavigation";

const getSectionTarget = (sectionId, userRole, user) => {
  const groups = getVisibleMenuGroups(sectionId, userRole, user);
  return groups[0]?.items[0]?.path || "/dashboard";
};

const ActivityBar = ({
  userRole,
  user,
  theme,
  onToggleTheme,
  onLogout,
  unreadAlerts = 0,
  unreadChats = 0,
  onMobileMenuOpen,
}) => {
  const location = useLocation();
  const sections = useMemo(() => getVisibleSections(userRole, user), [userRole, user]);
  const activeSectionId = useMemo(
    () => getActiveSectionId(location.pathname, userRole, user),
    [location.pathname, userRole, user],
  );

  return (
    <aside
      aria-label="Activity navigation"
      className="hidden h-full w-14 shrink-0 flex-col border-r border-slate-200 bg-slate-950 text-slate-300 shadow-crm-panel md:flex"
    >
      <div className="flex h-14 items-center justify-center border-b border-white/10 p-1.5">
        <div className="brand-logo-frame flex h-10 w-11 items-center justify-center rounded-md border border-slate-200 bg-white p-0.5 shadow-sm">
          <BrandLogo className="h-full w-full" />
        </div>
      </div>

      <nav aria-label="Primary workbench" className="flex flex-1 flex-col items-center gap-1 py-2">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = section.id === activeSectionId;
          const target = getSectionTarget(section.id, userRole, user);
          const showAlert = section.id === "admin" && unreadAlerts > 0;
          const showChatAlert = section.id === "chat" && unreadChats > 0;
          const badgeCount = showAlert ? unreadAlerts : showChatAlert ? unreadChats : 0;

          return (
            <Tooltip key={section.id} label={section.label} side="right">
              <Link
                to={target}
                aria-label={section.label}
                className={cn(
                  "group relative flex h-10 w-10 items-center justify-center rounded-xl outline-none transition",
                  "hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400",
                  isActive ? "bg-blue-500/18 text-white" : "text-slate-400",
                )}
              >
                {isActive ? <span className="absolute -left-2 h-6 w-1 rounded-r-full bg-blue-400" /> : null}
                <Icon aria-hidden="true" size={19} strokeWidth={isActive ? 2.4 : 1.9} />
                {badgeCount > 0 ? (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                ) : null}
              </Link>
            </Tooltip>
          );
        })}
      </nav>

      <div className="flex flex-col items-center gap-1 border-t border-white/10 py-2">
        <Tooltip label="Profile" side="right">
          <Link
            to="/profile"
            aria-label="Profile"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <UserCircle2 aria-hidden="true" size={19} />
          </Link>
        </Tooltip>
        <Tooltip label={theme === "dark" ? "Light mode" : "Dark mode"} side="right">
          <IconButton
            icon={theme === "dark" ? Sun : Moon}
            label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            size="sm"
            onClick={onToggleTheme}
            className="border-transparent bg-transparent text-slate-400 hover:border-transparent hover:bg-white/10 hover:text-white"
          />
        </Tooltip>
        <Tooltip label="Logout" side="right">
          <IconButton
            icon={LogOut}
            label="Logout"
            size="sm"
            onClick={onLogout}
            className="border-transparent bg-transparent text-slate-400 hover:border-transparent hover:bg-rose-500/15 hover:text-rose-200"
          />
        </Tooltip>
      </div>

      <button
        type="button"
        className="sr-only"
        onClick={onMobileMenuOpen}
      >
        Open menu
      </button>
    </aside>
  );
};

export default memo(ActivityBar);
