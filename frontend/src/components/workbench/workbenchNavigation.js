import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  CheckSquare,
  ClipboardList,
  Home,
  Map,
  Megaphone,
  MessageSquare,
  PieChart,
  Settings,
  ShieldCheck,
  Target,
  TerminalSquare,
  Trophy,
  UserCheck,
  UserCircle2,
  Users,
} from "lucide-react";

const PLATFORM_ADMIN_ROLES = ["SUPER_ADMIN"];
const ADMIN_ROLES = ["ADMIN"];
const MANAGEMENT_ROLES = [...ADMIN_ROLES, "MANAGER"];
const ADMIN_TOOL_ROLES = [...PLATFORM_ADMIN_ROLES, ...MANAGEMENT_ROLES];
const SALES_ROLES = [...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE"];
const PRODUCTION_ROLES = ["PRODUCTION_EXECUTIVE"];
const PARTNER_ROLES = ["CHANNEL_PARTNER"];

export const ACTIVITY_SECTIONS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Home,
    match: ["/", "/dashboard", "/tasks", "/attendance"],
  },
  {
    id: "leads",
    label: "Pipeline",
    icon: Users,
    match: ["/leads", "/my-leads"],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Building2,
    match: ["/inventory", "/map"],
  },
  {
    id: "finance",
    label: "Finance",
    icon: PieChart,
    match: ["/finance"],
  },
  {
    id: "reports",
    label: "Reports",
    icon: ClipboardList,
    match: ["/reports", "/leaderboard", "/targets"],
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: Calendar,
    match: ["/calendar"],
  },
  {
    id: "chat",
    label: "Chat",
    icon: MessageSquare,
    match: ["/chat"],
  },
  {
    id: "admin",
    label: "Admin",
    icon: ShieldCheck,
    match: ["/admin", "/super-admin"],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    match: ["/settings", "/profile"],
  },
];

export const TOP_NAV_SECTION_IDS = [
  "leads",
  "inventory",
  "finance",
  "reports",
  "calendar",
  "chat",
  "admin",
  "settings",
];

export const WORKBENCH_MENU = {
  dashboard: [
    {
      group: "Workspace",
      items: [
        { label: "Home", path: "/dashboard", icon: Home, roles: [...PLATFORM_ADMIN_ROLES, ...SALES_ROLES, ...PRODUCTION_ROLES, ...PARTNER_ROLES] },
        { label: "Tasks", path: "/tasks", icon: CheckSquare, roles: [...SALES_ROLES, ...PRODUCTION_ROLES] },
        { label: "Attendance", path: "/attendance", icon: UserCheck, roles: [...SALES_ROLES, ...PRODUCTION_ROLES, ...PARTNER_ROLES] },
      ],
    },
  ],
  leads: [
    {
      group: "Pipeline",
      items: [
        { label: "Pipeline", path: "/leads", icon: Users, roles: [...ADMIN_ROLES, "MANAGER", "CHANNEL_PARTNER"] },
        { label: "My Leads", path: "/my-leads", icon: Briefcase, roles: ["INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE"] },
      ],
    },
  ],
  inventory: [
    {
      group: "Assets",
      items: [
        { label: "Inventory", path: "/inventory", icon: Building2, roles: [...SALES_ROLES, ...PARTNER_ROLES], requiresInventoryAccessForPartner: true },
        { label: "Field Ops", path: "/map", icon: Map, roles: [...ADMIN_ROLES, "MANAGER", "FIELD_EXECUTIVE"] },
      ],
    },
  ],
  finance: [
    {
      group: "Money",
      items: [
        { label: "Finance", path: "/finance", icon: PieChart, roles: [...ADMIN_ROLES, "MANAGER", "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE", "CHANNEL_PARTNER"] },
      ],
    },
  ],
  reports: [
    {
      group: "Intelligence",
      items: [
        { label: "Reports", path: "/reports", icon: BarChart3, roles: MANAGEMENT_ROLES },
        { label: "Leaderboard", path: "/leaderboard", icon: Trophy, roles: [...SALES_ROLES, ...PARTNER_ROLES] },
        { label: "Targets", path: "/targets", icon: Target, roles: SALES_ROLES },
        { label: "Performance", path: "/targets", icon: Target, roles: PRODUCTION_ROLES },
      ],
    },
  ],
  calendar: [
    {
      group: "Schedule",
      items: [
        { label: "Calendar", path: "/calendar", icon: Calendar, roles: SALES_ROLES },
      ],
    },
  ],
  chat: [
    {
      group: "Collaboration",
      items: [
        { label: "Team Chat", path: "/chat", icon: MessageSquare, roles: [...SALES_ROLES, ...PRODUCTION_ROLES] },
      ],
    },
  ],
  admin: [
    {
      group: "Admin",
      items: [
        { label: "Tenants", path: "/super-admin", icon: Building2, roles: PLATFORM_ADMIN_ROLES },
        { label: "Alerts", path: "/admin/notifications", icon: Bell, roles: ADMIN_TOOL_ROLES },
        { label: "Access", path: "/admin/users", icon: ShieldCheck, roles: ADMIN_TOOL_ROLES },
        { label: "Console", path: "/admin/console", icon: TerminalSquare, roles: ADMIN_TOOL_ROLES },
        { label: "Meta Ads", path: "/admin/meta-ads", icon: Megaphone, roles: ADMIN_TOOL_ROLES },
      ],
    },
  ],
  settings: [
    {
      group: "Account",
      items: [
        { label: "Settings", path: "/settings", icon: Settings, roles: ADMIN_TOOL_ROLES },
        { label: "Profile", path: "/profile", icon: UserCircle2, roles: [...PLATFORM_ADMIN_ROLES, ...SALES_ROLES, ...PRODUCTION_ROLES, ...PARTNER_ROLES] },
      ],
    },
  ],
};

export const roleCanSeeItem = (item, userRole, user = {}) => {
  if (!item?.roles?.includes(userRole)) return false;
  if (
    item.requiresInventoryAccessForPartner &&
    userRole === "CHANNEL_PARTNER" &&
    !user?.canViewInventory
  ) {
    return false;
  }
  return true;
};

export const getVisibleSections = (userRole, user = {}) =>
  ACTIVITY_SECTIONS.filter((section) =>
    (WORKBENCH_MENU[section.id] || []).some((group) =>
      group.items.some((item) => roleCanSeeItem(item, userRole, user)),
    ),
  );

export const getVisibleMenuGroups = (sectionId, userRole, user = {}) =>
  (WORKBENCH_MENU[sectionId] || [])
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => roleCanSeeItem(item, userRole, user)),
    }))
    .filter((group) => group.items.length > 0);

export const getSectionTarget = (sectionId, userRole, user = {}) => {
  const groups = getVisibleMenuGroups(sectionId, userRole, user);
  return groups[0]?.items[0]?.path || "/dashboard";
};

export const getAllVisibleMenuGroups = (userRole, user = {}) =>
  getVisibleSections(userRole, user)
    .flatMap((section) =>
      (WORKBENCH_MENU[section.id] || []).map((group) => ({
        ...group,
        group: section.label,
        items: group.items.filter((item) => roleCanSeeItem(item, userRole, user)),
      })),
    )
    .filter((group) => group.items.length > 0);

export const getDrawerMenuGroups = (userRole, user = {}) => {
  const topNavTargets = new Set(
    TOP_NAV_SECTION_IDS.map((sectionId) => getSectionTarget(sectionId, userRole, user)),
  );

  return getVisibleSections(userRole, user)
    .flatMap((section) =>
      (WORKBENCH_MENU[section.id] || []).map((group) => ({
        ...group,
        group: section.label,
        items: group.items
          .filter((item) => roleCanSeeItem(item, userRole, user))
          .filter((item) => !topNavTargets.has(item.path)),
      })),
    )
    .filter((group) => group.items.length > 0);
};

const normalizeWorkspacePath = (pathname = "") => {
  const path = pathname || "/";
  const segments = path.split("/").filter(Boolean);
  const knownFirstSegments = new Set(
    ACTIVITY_SECTIONS.flatMap((section) =>
      section.match.map((matchPath) => matchPath.split("/").filter(Boolean)[0]).filter(Boolean),
    ),
  );

  if (segments.length >= 2 && knownFirstSegments.has(segments[1])) {
    return `/${segments.slice(1).join("/")}`;
  }

  return path;
};

export const isWorkspacePathActive = (pathname, targetPath) => {
  const normalizedPathname = normalizeWorkspacePath(pathname);
  if (targetPath === "/") return normalizedPathname === "/";
  return normalizedPathname === targetPath || normalizedPathname.startsWith(`${targetPath}/`);
};

export const getActiveSectionId = (pathname, userRole, user = {}) => {
  const normalizedPathname = normalizeWorkspacePath(pathname);
  const visibleSections = getVisibleSections(userRole, user);
  const activeSection = visibleSections.find((section) =>
    section.match.some((path) => {
      if (path === "/") return normalizedPathname === "/";
      return normalizedPathname === path || normalizedPathname.startsWith(`${path}/`);
    }),
  );

  return activeSection?.id || visibleSections[0]?.id || "dashboard";
};
