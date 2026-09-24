import { Link, useLocation } from "react-router-dom";
import { Building2, Home, MessageSquare, MoreHorizontal, Users } from "lucide-react";
import { cn } from "../ui";
import { getVisibleSidebarGroups } from "./workbenchNavigation";

/**
 * Four destinations for the phone: what you are doing today, the pipeline, the
 * stock you are selling, and the people you work with. Everything else lives
 * behind More, which opens the navigation drawer.
 *
 * Each target is filtered through the same role rules as the sidebar, so a role
 * never sees a tab it cannot open.
 */
const MOBILE_DESTINATIONS = [
  { label: "Today", paths: ["/dashboard"], icon: Home },
  { label: "Leads", paths: ["/my-leads", "/leads"], icon: Users },
  { label: "Inventory", paths: ["/inventory"], icon: Building2 },
  { label: "Chat", paths: ["/chat"], icon: MessageSquare },
];

const MobileBottomNav = ({ userRole, user, unreadAlerts = 0, unreadChats = 0, onMore }) => {
  const location = useLocation();
  const allowed = new Set(
    getVisibleSidebarGroups(userRole, user).flatMap((group) => group.items.map((item) => item.path)),
  );

  const destinations = MOBILE_DESTINATIONS.map((destination) => {
    const path = destination.paths.find((candidate) => allowed.has(candidate));
    return path ? { ...destination, path } : null;
  }).filter(Boolean);

  const activePath = destinations.find(
    (destination) =>
      location.pathname === destination.path || location.pathname.startsWith(`${destination.path}/`),
  )?.path;

  return (
    <nav
      aria-label="Mobile navigation"
      className="shrink-0 border-t border-slate-200 bg-white px-2 py-1 dark:border-slate-800 dark:bg-slate-900 md:hidden"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-between gap-1">
        {destinations.map((destination) => {
          const Icon = destination.icon;
          const active = destination.path === activePath;
          const badge = destination.path === "/chat" ? unreadChats : 0;

          return (
            <Link
              key={destination.label}
              to={destination.path}
              aria-current={active ? "page" : undefined}
              className={cn(
                // 44x44 minimum tap target.
                "relative flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1",
                "text-[10px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500/40",
                active
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
              )}
            >
              <Icon aria-hidden="true" size={18} />
              <span className="max-w-full truncate">{destination.label}</span>
              {badge > 0 ? (
                <span aria-hidden="true" className="absolute right-2 top-1 h-2 w-2 rounded-full bg-rose-500" />
              ) : null}
            </Link>
          );
        })}

        {/* Not a destination - the drawer holds everything the four tabs omit. */}
        <button
          type="button"
          onClick={onMore}
          aria-label="More navigation"
          className={cn(
            "relative flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1",
            "text-[10px] font-semibold text-slate-500 outline-none transition",
            "hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500/40",
            "dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
          )}
        >
          <MoreHorizontal aria-hidden="true" size={18} />
          <span>More</span>
          {unreadAlerts > 0 ? (
            <span aria-hidden="true" className="absolute right-2 top-1 h-2 w-2 rounded-full bg-rose-500" />
          ) : null}
        </button>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
