const RESERVED_ROOT_SEGMENTS = new Set([
  "login",
  "dashboard",
  "super-admin",
  "leads",
  "my-leads",
  "inventory",
  "finance",
  "map",
  "reports",
  "leaderboard",
  "calendar",
  "admin",
  "settings",
  "targets",
  "chat",
  "profile",
  "privacy-policy",
  "terms-and-conditions",
  "data-use-notice",
  "service-terms",
  "portal",
  "api",
  "assets",
  "socket.io",
]);

const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const normalizePathname = (pathname) => String(pathname || "").trim();

const normalizeSegment = (segment) =>
  String(segment || "").trim().toLowerCase();

export const resolveTenantSlugFromPath = (pathname) => {
  const normalizedPath = normalizePathname(pathname);
  if (!normalizedPath.startsWith("/")) return "";

  const firstSegment = normalizeSegment(
    normalizedPath
      .slice(1)
      .split("/")[0]
      .split("?")[0]
      .split("#")[0],
  );

  if (!firstSegment) return "";
  if (RESERVED_ROOT_SEGMENTS.has(firstSegment)) return "";
  if (!TENANT_SLUG_PATTERN.test(firstSegment)) return "";
  return firstSegment;
};

export const resolveTenantSlugFromWindow = () => {
  if (typeof window === "undefined") return "";
  return resolveTenantSlugFromPath(window.location?.pathname || "");
};

export const buildTenantAwarePath = (path = "/") => {
  const targetPath = String(path || "/").startsWith("/")
    ? String(path || "/")
    : `/${String(path || "/")}`;
  const tenantSlug = resolveTenantSlugFromWindow();
  if (!tenantSlug) return targetPath;
  return `/${tenantSlug}${targetPath}`;
};

