const Company = require("../models/Company");
const logger = require("../config/logger");

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const URL_RESERVED_SEGMENTS = new Set(["", "api", "socket.io"]);
const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const isLikelyIpAddress = (value) =>
  /^(\d{1,3}\.){3}\d{1,3}$/.test(value)
  || /^[a-f0-9:]+$/i.test(value);

const toLowerTrim = (value) => String(value || "").trim().toLowerCase();

const resolveHost = (req) => {
  const rawForwarded = String(req.headers["x-forwarded-host"] || "").trim();
  const rawHost = rawForwarded || String(req.headers.host || "").trim();
  const first = rawHost.split(",")[0].trim().toLowerCase();
  if (!first) return "";
  return first.split(":")[0].trim();
};

const normalizeTenantSlug = (value) => {
  const raw = toLowerTrim(value);
  if (!raw) return "";
  if (!TENANT_SLUG_PATTERN.test(raw)) return "";
  return raw;
};

const resolvePathSegment = (req) => {
  const rawPath = String(req.originalUrl || req.url || "").split("?")[0];
  const first = rawPath.startsWith("/")
    ? rawPath.slice(1).split("/")[0]
    : rawPath.split("/")[0];
  const normalized = normalizeTenantSlug(first);
  if (!normalized || URL_RESERVED_SEGMENTS.has(normalized)) return "";
  return normalized;
};

const resolveTenantSlugFromRequest = (req) =>
  normalizeTenantSlug(req.headers["x-tenant-slug"])
  || normalizeTenantSlug(req.query?.tenant)
  || resolvePathSegment(req);

const resolveReservedSubdomains = () =>
  new Set(
    String(process.env.SAAS_RESERVED_SUBDOMAINS || "www,api,app,admin")
      .split(",")
      .map((item) => toLowerTrim(item))
      .filter(Boolean),
  );

const resolveRootDomain = () => toLowerTrim(process.env.SAAS_ROOT_DOMAIN);

const extractSubdomain = (host, rootDomain) => {
  if (!host || !rootDomain) return "";
  if (host === rootDomain) return "";
  const suffix = `.${rootDomain}`;
  if (!host.endsWith(suffix)) return "";
  const subdomain = host.slice(0, host.length - suffix.length).trim();
  if (!subdomain || subdomain.includes(".")) return "";
  return subdomain;
};

exports.resolveTenantContext = async (req, _res, next) => {
  req.tenant = null;
  req.tenantHost = "";
  req.tenantSubdomain = "";
  req.tenantSource = "";

  try {
    const requestedTenantSlug = resolveTenantSlugFromRequest(req);
    if (requestedTenantSlug) {
      req.tenantSubdomain = requestedTenantSlug;
      const byTenantSlug = await Company.findOne({
        subdomain: requestedTenantSlug,
        status: "ACTIVE",
      }).select("_id name subdomain customDomain status settings metadata");

      if (byTenantSlug) {
        req.tenant = byTenantSlug;
        req.tenantSource = "path";
        return next();
      }
    }

    const host = resolveHost(req);
    req.tenantHost = host;
    if (!host || LOCAL_HOSTS.has(host) || isLikelyIpAddress(host)) {
      return next();
    }

    const rootDomain = resolveRootDomain();
    const reserved = resolveReservedSubdomains();
    const subdomain = extractSubdomain(host, rootDomain);
    req.tenantSubdomain = subdomain;

    if (subdomain && !reserved.has(subdomain)) {
      const bySubdomain = await Company.findOne({
        subdomain,
        status: "ACTIVE",
      }).select("_id name subdomain customDomain status settings metadata");
      if (bySubdomain) {
        req.tenant = bySubdomain;
        req.tenantSource = "subdomain";
        return next();
      }
    }

    const byCustomDomain = await Company.findOne({
      customDomain: host,
      status: "ACTIVE",
    }).select("_id name subdomain customDomain status settings metadata");
    if (byCustomDomain) {
      req.tenant = byCustomDomain;
      req.tenantSource = "domain";
    }

    return next();
  } catch (error) {
    logger.warn({
      host: req.tenantHost || "",
      error: error.message,
      message: "Tenant resolution failed",
    });
    return next();
  }
};
