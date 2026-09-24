import { memo, useCallback, useMemo, useState } from "react";
import { useChatNotifications } from "../../context/useChatNotifications";
import { usePermissions } from "../../context/usePermissions";
import { cn } from "../ui";
import AppTopCommandBar from "./AppTopCommandBar";
import FloatingMessenger from "./FloatingMessenger";
import { useIsMobileViewport } from "../../hooks/useIsMobileViewport";
import { getAllVisibleMenuGroups } from "./workbenchNavigation";
import PrimarySidebar from "./PrimarySidebar";

const WorkbenchShell = ({
  children,
  userRole,
  user,
  roleLabel,
  theme,
  onToggleTheme,
  onLogout,
  pageHeader,
  isChatPage = false,
  shouldLockDocumentScroll = true,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobileViewport = useIsMobileViewport();
  const { adminRequestUnread, unreadTotal } = useChatNotifications();
  const { permissions, enforcePageAccess, loading: permissionsLoading } = usePermissions();
  const userForNav = useMemo(
    () => ({
      ...(user || {}),
      permissions: permissionsLoading ? null : permissions,
      enforcePageAccess: permissionsLoading ? false : enforcePageAccess,
    }),
    [user, permissions, enforcePageAccess, permissionsLoading],
  );
  const handleOpenMobileMenu = useCallback(() => setMobileMenuOpen(true), []);
  const handleCloseMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  return (
    <div
      className={cn(
        "workspace-shell flex w-full bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-slate-100",
        shouldLockDocumentScroll ? "h-dvh overflow-hidden" : "min-h-screen",
      )}
    >
      <PrimarySidebar
        userRole={userRole}
        user={userForNav}
        roleLabel={roleLabel}
        mobileOpen={mobileMenuOpen}
        onMobileClose={handleCloseMobileMenu}
      />

      <main className="workspace-main app-page-bg relative min-w-0 flex flex-1 flex-col overflow-hidden">
          <AppTopCommandBar
            key={pageHeader?.title || (isChatPage ? "chat" : "workspace")}
            user={userForNav}
            userRole={userRole}
            onLogout={onLogout}
            unreadAlerts={adminRequestUnread}
            unreadChats={unreadTotal}
            pageHeader={isChatPage ? { title: "Team Chat" } : pageHeader}
            theme={theme}
            onToggleTheme={onToggleTheme}
            onMenuOpen={handleOpenMobileMenu}
          />
        <div
          className={cn(
            "workspace-main-content min-h-0 flex-1 overflow-hidden",
            isChatPage ? "workspace-main-content-chat" : "workspace-main-content-mobile-nav",
          )}
        >
          {children}
        </div>
      </main>
      {/*
        Desktop only. On a phone the messenger panel covers most of the screen
        and leaves the page under it unusable, so the header's chat icon goes
        to the full /chat page instead (see AppTopCommandBar).
      */}
      {!isMobileViewport && !isChatPage && getAllVisibleMenuGroups(userRole, userForNav).some(group => group.items.some(item => item.path === "/chat")) && <FloatingMessenger theme={theme} unreadTotal={unreadTotal} />}
    </div>
  );
};

export default memo(WorkbenchShell);
