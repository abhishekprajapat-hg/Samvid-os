import { memo, useCallback, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronRight, X } from "lucide-react";
import { IconButton, cn } from "../ui";
import BrandLogo from "../common/BrandLogo";
import { getVisibleSidebarGroups } from "./workbenchNavigation";

const pathMatchesItem = (pathname, itemPath) => {
  if (itemPath === "/dashboard") return pathname === "/" || pathname === "/dashboard";
  if (itemPath === "/coworking/booking-board") return pathname === "/coworking" || pathname === "/coworking/booking-board";
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
};


const PrimarySidebar = ({
  userRole,
  user,
  roleLabel,
  mobileOpen,
  onMobileClose,
}) => {
  const location = useLocation();
  const groups = useMemo(() => getVisibleSidebarGroups(userRole, user).map((group) => ({ ...group, items: group.items.filter((item) => !["/admin/notifications", "/profile", "/chat"].includes(item.path)) })).filter((group) => group.items.length), [userRole, user]);

  // A parent entry like /inventory must not stay lit while a child page such as
  // /inventory/owners is open, or two rows read as active at once. Derived from
  // the nav itself so a future sub-page needs no change here.
  const exactMatchPaths = useMemo(() => {
    const paths = groups.flatMap((group) => group.items.map((item) => item.path));
    return new Set(paths.filter((path) => paths.some((other) => other !== path && other.startsWith(`${path}/`))));
  }, [groups]);
  const activeGroupName = useMemo(() => {
    const activeGroup = groups.find((group) =>
      group.items.some((item) => pathMatchesItem(location.pathname, item.path)),
    );
    return activeGroup?.group || "SALES";
  }, [groups, location.pathname]);

  // Default active group to open
  const [expandedGroupNames, setExpandedGroupNames] = useState(["SALES", "WORK"]);

  const [previousGroup, setPreviousGroup] = useState(null);
  if (previousGroup !== activeGroupName) {
    setPreviousGroup(activeGroupName);
    if (activeGroupName && !expandedGroupNames.includes(activeGroupName)) {
      setExpandedGroupNames([...expandedGroupNames, activeGroupName]);
    }
  }

  const renderNav = useCallback(
    () => (
      <nav aria-label="Workbench navigation" className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {groups.map((group) => {
          const isExpanded = expandedGroupNames.includes(group.group);
          const hasActiveChild = group.items.some((item) => pathMatchesItem(location.pathname, item.path));

          return (
            <div key={group.group} className="mb-1.5 last:mb-0">
              <button
                type="button"
                onClick={() => {
                  setExpandedGroupNames((current) =>
                    current.includes(group.group)
                      ? current.filter((name) => name !== group.group)
                      : [...current, group.group],
                  );
                }}
                className={cn(
                  "relative flex w-full items-center justify-between rounded-lg px-2.5 py-1.5",
                  "text-left text-[11.5px] font-bold tracking-[0.04em] outline-none transition",
                  "focus-visible:ring-2 focus-visible:ring-blue-500/40",
                  hasActiveChild
                    ? "text-slate-900 dark:text-slate-100"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200",
                )}
                aria-expanded={isExpanded}
                title={group.group}
              >
                <span className="truncate">{group.group}</span>
                <ChevronRight
                  aria-hidden="true"
                  className={cn(
                    "ml-auto shrink-0 text-slate-400 transition-transform duration-200",
                    isExpanded && "rotate-90 text-slate-600 dark:text-slate-300",
                  )}
                  size={14}
                  strokeWidth={2}
                />
              </button>

              {isExpanded ? (
                <div className="mt-0.5 space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={`${group.group}-${item.path}`}
                        to={item.path}
                        end={item.path === "/dashboard" || exactMatchPaths.has(item.path)}
                        onClick={onMobileClose}
                        className={({ isActive }) =>
                          cn(
                            "relative flex items-center gap-2.5 rounded-lg px-3 py-1.5 pl-3",
                            "text-[13px] font-medium outline-none transition-all duration-150",
                            "focus-visible:ring-2 focus-visible:ring-blue-500/40",
                            isActive
                              ? "bg-blue-50/80 font-semibold text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100",
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {/* Accent bar on the left edge of the active item */}
                            {isActive ? (
                              <span
                                aria-hidden="true"
                                className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-blue-600 dark:bg-blue-400"
                              />
                            ) : null}
                            <Icon
                              aria-hidden="true"
                              className={cn(
                                "shrink-0 transition-colors",
                                isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500",
                              )}
                              size={16}
                              strokeWidth={isActive ? 2.2 : 1.8}
                            />
                            <span className="truncate">{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    ),
    [expandedGroupNames, exactMatchPaths, groups, location.pathname, onMobileClose],
  );

  const sidebar = useCallback(
    ({ mobile = false } = {}) => {
      return (
        <aside
          className={cn(
            "flex h-full shrink-0 flex-col border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900",
            "transition-all duration-200",
            mobile ? "w-64" : "w-[218px]",
          )}
        >
          {/* Top Brand Header */}
          <div className="flex h-14 items-center gap-2.5 border-b border-slate-100 px-3.5 dark:border-slate-800/80">
            <div className="brand-logo-frame flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700">
              <BrandLogo className="h-full w-full" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-bold leading-tight text-slate-900 dark:text-slate-50">
                Samvid OS
              </p>
              <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {roleLabel || "Admin"}
              </p>
            </div>
            {mobile ? (
              <IconButton icon={X} label="Close navigation" size="sm" onClick={onMobileClose} />
            ) : null}
          </div>

          {/* Navigation Links */}
          {groups.length > 0 ? (
            renderNav()
          ) : (
            <div className="flex flex-1 items-center px-4 text-[12.8px] font-semibold text-rose-600 dark:text-rose-400">
              No accessible routes for this role.
            </div>
          )}

        </aside>
      );
    },
    [groups.length, onMobileClose, renderNav, roleLabel],
  );

  return (
    <>
      <div className="hidden md:block">{sidebar()}</div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-[80] md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
            onClick={onMobileClose}
          />
          <div className="relative h-full">{sidebar({ mobile: true })}</div>
        </div>
      ) : null}
    </>
  );
};

export default memo(PrimarySidebar);
