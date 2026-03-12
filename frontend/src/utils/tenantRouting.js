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

const sanitizeTenantSlug = (value) => {
  const normalized = normalizeSegment(value);
  if (!normalized) return "";
  if (!TENANT_SLUG_PATTERN.test(normalized)) return "";
  return normalized;
};

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
  return sanitizeTenantSlug(firstSegment);
};

export const resolveTenantSlugFromWindow = () => {
  if (typeof window === "undefined") return "";
  return resolveTenantSlugFromPath(window.location?.pathname || "");
};

export const resolveTenantSlugFromStorage = () => {
  if (typeof window === "undefined") return "";
  return sanitizeTenantSlug(window.localStorage?.getItem("tenantSlug") || "");
};

export const persistTenantSlug = (tenantSlug = "") => {
  if (typeof window === "undefined") return "";
  const sanitized = sanitizeTenantSlug(tenantSlug);
  if (sanitized) {
    window.localStorage.setItem("tenantSlug", sanitized);
  } else {
    window.localStorage.removeItem("tenantSlug");
  }
  return sanitized;
};

export const resolveTenantSlug = () =>
  resolveTenantSlugFromWindow() || resolveTenantSlugFromStorage();

export const buildTenantAwarePath = (path = "/") => {
  const targetPath = String(path || "/").startsWith("/")
    ? String(path || "/")
    : `/${String(path || "/")}`;
  const tenantSlug = resolveTenantSlug();
  if (!tenantSlug) return targetPath;
  return `/${tenantSlug}${targetPath}`;
};
