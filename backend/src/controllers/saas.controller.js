const axios = require("axios");
const mongoose = require("mongoose");
const logger = require("../config/logger");
const User = require("../models/User");
const Lead = require("../models/Lead");
const Inventory = require("../models/Inventory");
const InventoryRequest = require("../models/InventoryRequest");
const Company = require("../models/Company");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const TenantSubscription = require("../models/TenantSubscription");
const { USER_ROLES } = require("../constants/role.constants");

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const META_GRAPH_VERSION = String(process.env.META_GRAPH_VERSION || "v24.0").trim();
const META_GRAPH_TIMEOUT_MS = toPositiveInt(process.env.META_GRAPH_TIMEOUT_MS, 10_000);
const META_SUBSCRIBED_FIELDS = "leadgen";
const META_INTEGRATION_STATUSES = {
  READY: "READY",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED",
  PENDING: "PENDING",
  NOT_CONFIGURED: "NOT_CONFIGURED",
};

const sanitizeSubdomain = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);

const resolveRootDomain = () =>
  String(process.env.SAAS_ROOT_DOMAIN || "")
    .trim()
    .toLowerCase();

const buildCompanyDashboardPath = (subdomain) => {
  const tenantSlug = sanitizeSubdomain(subdomain);
  return tenantSlug ? `/${tenantSlug}/dashboard` : "";
};

const buildCompanyDashboardUrl = (subdomain) => {
  const dashboardPath = buildCompanyDashboardPath(subdomain);
  if (!dashboardPath) return "";

  const rootDomain = resolveRootDomain();
  if (!rootDomain) return dashboardPath;
  return `${rootDomain}${dashboardPath}`;
};

const ensureUniqueSubdomain = async (baseSubdomain) => {
  const normalizedBase = sanitizeSubdomain(baseSubdomain);
  if (!normalizedBase) return "";

  let attempt = 0;
  while (attempt < 5000) {
    const candidate = attempt === 0 ? normalizedBase : `${normalizedBase}-${attempt}`;
    const exists = await Company.findOne({ subdomain: candidate }).select("_id").lean();
    if (!exists) {
      return candidate;
    }
    attempt += 1;
  }

  throw new Error("Unable to allocate unique company route slug");
};

const toTrimmedString = (value) => String(value || "").trim();

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toMetaObject = (value) => (isPlainObject(value) ? value : {});

const toMetaPageIdList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((row) => toTrimmedString(row))
      .filter(Boolean);
  }

  const raw = toTrimmedString(value);
  if (!raw) return [];

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((row) => toTrimmedString(row))
          .filter(Boolean);
      }
    } catch (_error) {
      // Fall back to comma-separated parsing.
    }
  }

  if (raw.includes(",")) {
    return raw
      .split(",")
      .map((row) => toTrimmedString(row))
      .filter(Boolean);
  }

  return [raw];
};

const META_PAGE_ID_PATTERN = /^[A-Za-z0-9_-]{3,100}$/;
const MAX_META_PAGE_IDS_PER_COMPANY = 50;

const normalizeMetaPageIdsInput = (value) => {
  const source = toMetaPageIdList(value);
  const dedupe = new Set();
  const normalized = [];

  for (const row of source) {
    const pageId = toTrimmedString(row);
    if (!pageId) continue;
    if (!META_PAGE_ID_PATTERN.test(pageId)) {
      return {
        error: `Invalid page id: ${pageId}`,
        pageIds: [],
      };
    }
    if (dedupe.has(pageId)) continue;
    dedupe.add(pageId);
    normalized.push(pageId);
    if (normalized.length > MAX_META_PAGE_IDS_PER_COMPANY) {
      return {
        error: `Maximum ${MAX_META_PAGE_IDS_PER_COMPANY} page ids are allowed`,
        pageIds: [],
      };
    }
  }

  return {
    error: "",
    pageIds: normalized,
  };
};

const resolveCompanyMetaPageIds = (company = null) => {
  const metadata = toMetaObject(company?.metadata);
  const nestedMeta = toMetaObject(metadata.meta);
  const normalized = normalizeMetaPageIdsInput([
    ...toMetaPageIdList(metadata.metaPageIds),
    ...toMetaPageIdList(nestedMeta.pageIds),
    ...toMetaPageIdList(metadata.metaPageId),
    ...toMetaPageIdList(nestedMeta.pageId),
  ]);

  return normalized.pageIds || [];
};

const truncateText = (value, maxLength = 280) => {
  const text = toTrimmedString(value);
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
};

const toMetaSubscriptionRecord = (value = {}) => {
  const pageId = toTrimmedString(value?.pageId);
  if (!pageId) return null;

  const subscribedFields = Array.isArray(value?.subscribedFields)
    ? value.subscribedFields
      .map((row) => toTrimmedString(row))
      .filter(Boolean)
    : [];

  const toSafeInt = (input) => {
    const parsed = Number.parseInt(input, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    pageId,
    success: Boolean(value?.success),
    status: toTrimmedString(value?.status) || (Boolean(value?.success) ? "subscribed" : "failed"),
    verificationStatus: toTrimmedString(value?.verificationStatus) || "",
    checkedAt: toTrimmedString(value?.checkedAt) || "",
    subscribedFields,
    errorCode: toSafeInt(value?.errorCode),
    errorSubcode: toSafeInt(value?.errorSubcode),
    errorType: toTrimmedString(value?.errorType) || "",
    errorMessage: truncateText(value?.errorMessage || ""),
  };
};

const toMetaSubscriptionState = (value = {}) => {
  const records = Array.isArray(value?.records)
    ? value.records
      .map((row) => toMetaSubscriptionRecord(row))
      .filter(Boolean)
    : [];

  return {
    lastCheckedAt: toTrimmedString(value?.lastCheckedAt),
    records,
    syncTriggered: Boolean(value?.syncTriggered),
    syncErrorMessage: truncateText(value?.syncErrorMessage || ""),
    summary: {
      total: toPositiveInt(value?.summary?.total, 0),
      success: toPositiveInt(value?.summary?.success, 0),
      failed: toPositiveInt(value?.summary?.failed, 0),
    },
  };
};

const getMetaSubscriptionState = (company = null) => {
  const metadata = toMetaObject(company?.metadata);
  const nestedMeta = toMetaObject(metadata.meta);

  const source = isPlainObject(metadata.metaSubscriptionStatus)
    ? metadata.metaSubscriptionStatus
    : isPlainObject(nestedMeta.subscriptionStatus)
      ? nestedMeta.subscriptionStatus
      : {};

  return toMetaSubscriptionState(source);
};

const toMetaGraphError = (error) => {
  const graphError = isPlainObject(error?.response?.data?.error)
    ? error.response.data.error
    : {};

  const toSafeInt = (input) => {
    const parsed = Number.parseInt(input, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    code: toSafeInt(graphError.code),
    subcode: toSafeInt(graphError.error_subcode),
    type: toTrimmedString(graphError.type),
    message: truncateText(
      graphError.message
      || graphError.error_user_msg
      || graphError.error_user_title
      || error?.message
      || "Unknown Meta Graph API error",
    ),
  };
};

const isAlreadySubscribedMetaError = (errorInfo = {}) => {
  const message = String(errorInfo?.message || "").toLowerCase();
  return message.includes("already") && message.includes("subscribed");
};

const buildMetaGraphUrl = (path) =>
  `https://graph.facebook.com/${META_GRAPH_VERSION}/${String(path || "").replace(/^\/+/, "")}`;

const fetchPageSubscriptionFields = async ({ pageId, accessToken }) => {
  const response = await axios.get(buildMetaGraphUrl(`${pageId}/subscribed_apps`), {
    params: {
      access_token: accessToken,
    },
    timeout: META_GRAPH_TIMEOUT_MS,
  });

  const appId = toTrimmedString(process.env.META_APP_ID);
  const rows = Array.isArray(response?.data?.data) ? response.data.data : [];
  let matching = null;

  if (appId) {
    matching = rows.find((row) => toTrimmedString(row?.id) === appId) || null;
  }
  if (!matching && rows.length === 1) {
    matching = rows[0];
  }
  if (!matching) {
    matching = rows.find((row) => {
      const fields = Array.isArray(row?.subscribed_fields) ? row.subscribed_fields : [];
      return fields.includes(META_SUBSCRIBED_FIELDS);
    }) || null;
  }

  return Array.isArray(matching?.subscribed_fields)
    ? matching.subscribed_fields.map((row) => toTrimmedString(row)).filter(Boolean)
    : [];
};

const subscribeCompanyPagesToMetaLeadgen = async ({ pageIds, accessToken }) => {
  const checkedAt = new Date().toISOString();
  const records = [];

  for (const pageId of pageIds) {
    let success = false;
    let status = "subscribe_failed";
    let verificationStatus = "not_checked";
    let subscribedFields = [];
    let errorCode = null;
    let errorSubcode = null;
    let errorType = "";
    let errorMessage = "";

    try {
      await axios.post(
        buildMetaGraphUrl(`${pageId}/subscribed_apps`),
        null,
        {
          params: {
            subscribed_fields: META_SUBSCRIBED_FIELDS,
            access_token: accessToken,
          },
          timeout: META_GRAPH_TIMEOUT_MS,
        },
      );
      success = true;
      status = "subscribed";
    } catch (error) {
      const errorInfo = toMetaGraphError(error);
      if (isAlreadySubscribedMetaError(errorInfo)) {
        success = true;
        status = "already_subscribed";
      } else {
        errorCode = errorInfo.code;
        errorSubcode = errorInfo.subcode;
        errorType = errorInfo.type;
        errorMessage = errorInfo.message;
      }
    }

    try {
      subscribedFields = await fetchPageSubscriptionFields({ pageId, accessToken });
      if (subscribedFields.includes(META_SUBSCRIBED_FIELDS)) {
        verificationStatus = "verified";
        success = true;
      } else if (success) {
        success = false;
        status = "verify_failed";
        verificationStatus = "missing_leadgen";
        errorMessage = truncateText(
          errorMessage || "leadgen field is not visible in subscribed_apps response",
        );
      } else {
        verificationStatus = "checked_not_subscribed";
      }
    } catch (verifyError) {
      const verifyErrorInfo = toMetaGraphError(verifyError);
      verificationStatus = "verify_error";
      if (!success) {
        errorCode = errorCode ?? verifyErrorInfo.code;
        errorSubcode = errorSubcode ?? verifyErrorInfo.subcode;
        errorType = errorType || verifyErrorInfo.type;
        errorMessage = errorMessage || verifyErrorInfo.message;
      }
    }

    records.push(
      toMetaSubscriptionRecord({
        pageId,
        success,
        status,
        verificationStatus,
        checkedAt,
        subscribedFields,
        errorCode,
        errorSubcode,
        errorType,
        errorMessage,
      }),
    );
  }

  const successCount = records.reduce((count, row) => count + (row?.success ? 1 : 0), 0);
  const failedCount = Math.max(0, pageIds.length - successCount);
  return {
    lastCheckedAt: checkedAt,
    records,
    syncTriggered: true,
    syncErrorMessage: "",
    summary: {
      total: pageIds.length,
      success: successCount,
      failed: failedCount,
    },
  };
};

const buildMetaSubscriptionStateForUnconfigured = ({ reason = "" } = {}) => ({
  lastCheckedAt: new Date().toISOString(),
  records: [],
  syncTriggered: false,
  syncErrorMessage: truncateText(reason),
  summary: {
    total: 0,
    success: 0,
    failed: 0,
  },
});

const buildMetaSubscriptionStateFromSyncError = ({
  pageIds = [],
  error = null,
} = {}) => {
  const errorInfo = toMetaGraphError(error || {});
  const checkedAt = new Date().toISOString();
  const records = pageIds
    .map((pageId) =>
      toMetaSubscriptionRecord({
        pageId,
        success: false,
        status: "sync_failed",
        verificationStatus: "not_checked",
        checkedAt,
        errorCode: errorInfo.code,
        errorSubcode: errorInfo.subcode,
        errorType: errorInfo.type,
        errorMessage: errorInfo.message,
      }))
    .filter(Boolean);

  return {
    lastCheckedAt: checkedAt,
    records,
    syncTriggered: true,
    syncErrorMessage: errorInfo.message,
    summary: {
      total: pageIds.length,
      success: 0,
      failed: pageIds.length,
    },
  };
};

const deriveMetaReadiness = ({ pageIds = [], accessToken = "", subscriptionState = null }) => {
  const totalPages = pageIds.length;
  const normalizedState = toMetaSubscriptionState(subscriptionState || {});
  const recordByPageId = new Map(
    normalizedState.records.map((row) => [toTrimmedString(row?.pageId), row]),
  );

  const records = pageIds.map((pageId) =>
    recordByPageId.get(pageId)
    || toMetaSubscriptionRecord({
      pageId,
      success: false,
      status: "pending",
      verificationStatus: "not_checked",
      checkedAt: normalizedState.lastCheckedAt || "",
    }));

  if (!accessToken || totalPages === 0) {
    return {
      status: META_INTEGRATION_STATUSES.NOT_CONFIGURED,
      isReady: false,
      message: !accessToken
        ? "Meta access token is missing"
        : "Meta page IDs are missing",
      totalPages,
      readyPages: 0,
      failedPages: 0,
      pendingPages: totalPages,
      lastCheckedAt: normalizedState.lastCheckedAt,
      records,
      syncTriggered: normalizedState.syncTriggered,
      syncErrorMessage: normalizedState.syncErrorMessage,
    };
  }

  const readyPages = records.filter((row) => row?.success).length;
  const failedPages = records.filter((row) =>
    !row?.success && !["pending", "not_checked"].includes(String(row?.status || "").toLowerCase()))
    .length;
  const pendingPages = Math.max(0, totalPages - readyPages - failedPages);

  let status = META_INTEGRATION_STATUSES.PENDING;
  let message = "Meta pages are pending subscription";

  if (readyPages === totalPages && totalPages > 0) {
    status = META_INTEGRATION_STATUSES.READY;
    message = "All Meta pages are connected";
  } else if (readyPages > 0 && failedPages > 0) {
    status = META_INTEGRATION_STATUSES.PARTIAL;
    message = `${readyPages}/${totalPages} Meta pages connected`;
  } else if (failedPages === totalPages) {
    status = META_INTEGRATION_STATUSES.FAILED;
    message = "Meta page subscription failed";
  } else if (readyPages > 0) {
    status = META_INTEGRATION_STATUSES.PARTIAL;
    message = `${readyPages}/${totalPages} Meta pages connected, remaining pending`;
  }

  return {
    status,
    isReady: status === META_INTEGRATION_STATUSES.READY,
    message,
    totalPages,
    readyPages,
    failedPages,
    pendingPages,
    lastCheckedAt: normalizedState.lastCheckedAt,
    records,
    syncTriggered: normalizedState.syncTriggered,
    syncErrorMessage: normalizedState.syncErrorMessage,
  };
};

const maskSecret = (value) => {
  const token = toTrimmedString(value);
  if (!token) return "";
  if (token.length <= 8) return `${token[0]}***${token[token.length - 1] || ""}`;
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
};

const buildMetaWebhookUrls = (company = null) => {
  const rootDomain = resolveRootDomain();
  const callbackPath = "/api/webhook/meta";
  const tenantSlug = sanitizeSubdomain(company?.subdomain);

  const globalCallbackUrl = rootDomain
    ? `https://${rootDomain}${callbackPath}`
    : callbackPath;
  const tenantScopedCallbackUrl = tenantSlug
    ? `${globalCallbackUrl}?tenant=${tenantSlug}`
    : globalCallbackUrl;

  return {
    globalCallbackUrl,
    tenantScopedCallbackUrl,
  };
};

const toCompanyMetaIntegration = (company) => {
  const metadata = toMetaObject(company?.metadata);
  const nestedMeta = toMetaObject(metadata.meta);
  const accessToken = toTrimmedString(
    metadata.metaAccessToken || nestedMeta.accessToken,
  );
  const pageIds = resolveCompanyMetaPageIds(company);
  const webhookUrls = buildMetaWebhookUrls(company);
  const subscriptionState = getMetaSubscriptionState(company);
  const readiness = deriveMetaReadiness({
    pageIds,
    accessToken,
    subscriptionState,
  });

  return {
    companyId: company?._id || null,
    companyName: company?.name || "",
    subdomain: company?.subdomain || "",
    status: company?.status || "",
    pageIds,
    accessTokenConfigured: Boolean(accessToken),
    accessTokenPreview: maskSecret(accessToken),
    webhook: webhookUrls,
    readiness,
  };
};

const loadCompanyForMetaIntegration = async (companyId) =>
  Company.findById(companyId)
    .select("_id name subdomain status metadata")
    .lean();

const applyMetaIntegrationPatch = async ({
  company,
  payload = {},
  requestId = "",
} = {}) => {
  const companyId = String(company?._id || "").trim();
  if (!companyId) {
    const error = new Error("Company not found");
    error.statusCode = 404;
    throw error;
  }

  const metadata = toMetaObject(company.metadata);
  const nestedMeta = toMetaObject(metadata.meta);
  let hasChanges = false;

  const hasPageIdsInput =
    Object.prototype.hasOwnProperty.call(payload || {}, "pageIds")
    || Object.prototype.hasOwnProperty.call(payload || {}, "metaPageIds")
    || Object.prototype.hasOwnProperty.call(payload || {}, "pageId")
    || Object.prototype.hasOwnProperty.call(payload || {}, "metaPageId");
  if (hasPageIdsInput) {
    const rawPageIds =
      payload?.pageIds
      ?? payload?.metaPageIds
      ?? payload?.pageId
      ?? payload?.metaPageId;
    const normalizedPageIds = normalizeMetaPageIdsInput(rawPageIds);
    if (normalizedPageIds.error) {
      const error = new Error(normalizedPageIds.error);
      error.statusCode = 400;
      throw error;
    }

    metadata.metaPageIds = normalizedPageIds.pageIds;
    metadata.metaPageId = normalizedPageIds.pageIds[0] || "";
    nestedMeta.pageIds = normalizedPageIds.pageIds;
    nestedMeta.pageId = normalizedPageIds.pageIds[0] || "";
    hasChanges = true;
  }

  const hasAccessTokenInput =
    Object.prototype.hasOwnProperty.call(payload || {}, "accessToken")
    || Object.prototype.hasOwnProperty.call(payload || {}, "metaAccessToken");
  if (hasAccessTokenInput) {
    const token = toTrimmedString(payload?.accessToken ?? payload?.metaAccessToken);
    if (!token) {
      const error = new Error("accessToken cannot be empty");
      error.statusCode = 400;
      throw error;
    }

    metadata.metaAccessToken = token;
    nestedMeta.accessToken = token;
    hasChanges = true;
  }

  if (Boolean(payload?.clearAccessToken)) {
    metadata.metaAccessToken = "";
    nestedMeta.accessToken = "";
    hasChanges = true;
  }

  if (!hasChanges) {
    const error = new Error("At least one of pageIds, accessToken, clearAccessToken is required");
    error.statusCode = 400;
    throw error;
  }

  metadata.meta = nestedMeta;
  const nextCompany = {
    ...company,
    metadata,
  };
  const nextPageIds = resolveCompanyMetaPageIds(nextCompany);
  const nextAccessToken = toTrimmedString(
    metadata.metaAccessToken || nestedMeta.accessToken,
  );

  let subscriptionState;
  if (!nextAccessToken) {
    subscriptionState = buildMetaSubscriptionStateForUnconfigured({
      reason: "Meta access token is missing",
    });
  } else if (!nextPageIds.length) {
    subscriptionState = buildMetaSubscriptionStateForUnconfigured({
      reason: "Meta page IDs are missing",
    });
  } else {
    try {
      subscriptionState = await subscribeCompanyPagesToMetaLeadgen({
        pageIds: nextPageIds,
        accessToken: nextAccessToken,
      });
    } catch (syncError) {
      subscriptionState = buildMetaSubscriptionStateFromSyncError({
        pageIds: nextPageIds,
        error: syncError,
      });
      logger.error({
        requestId: requestId || null,
        companyId,
        error: syncError.response?.data || syncError.message,
        message: "Meta page subscription sync failed",
      });
    }
  }

  metadata.metaSubscriptionStatus = subscriptionState;
  nestedMeta.subscriptionStatus = subscriptionState;
  metadata.meta = nestedMeta;

  const updated = await Company.findByIdAndUpdate(
    companyId,
    { $set: { metadata } },
    { new: true },
  )
    .select("_id name subdomain status metadata")
    .lean();

  return updated;
};

const toCompanySummary = (company) => ({
  id: company._id,
  name: company.name,
  legalName: company.legalName || "",
  subdomain: company.subdomain,
  routePrefix: company.subdomain ? `/${company.subdomain}` : "",
  dashboardPath: buildCompanyDashboardPath(company.subdomain),
  dashboardUrl: buildCompanyDashboardUrl(company.subdomain),
  customDomain: company.customDomain || "",
  status: company.status,
  ownerUserId: company.ownerUserId || null,
  settings: company.settings || {},
  createdAt: company.createdAt,
  updatedAt: company.updatedAt,
});

const toPlanSummary = (plan) => ({
  id: plan._id,
  code: plan.code,
  name: plan.name,
  description: plan.description || "",
  pricing: plan.pricing || {},
  limits: plan.limits || {},
  features: plan.features || [],
  isActive: Boolean(plan.isActive),
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt,
});

const toSubscriptionSummary = (row) => ({
  id: row._id,
  companyId: row.companyId,
  planId: row.planId?._id || row.planId || null,
  plan: row.planId?._id
    ? {
      id: row.planId._id,
      code: row.planId.code,
      name: row.planId.name,
      pricing: row.planId.pricing || {},
      limits: row.planId.limits || {},
      isActive: Boolean(row.planId.isActive),
    }
    : null,
  status: row.status,
  billingCycle: row.billingCycle,
  seats: row.seats,
  isCurrent: Boolean(row.isCurrent),
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  trialEndsAt: row.trialEndsAt,
  nextBillingAt: row.nextBillingAt,
  autoRenew: Boolean(row.autoRenew),
  metadata: row.metadata || {},
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const fetchCompanyUserIds = async (companyId) => {
  const rows = await User.find({ companyId }).select("_id").lean();
  return rows.map((row) => row._id);
};

const computeCompanyUsage = async (companyId) => {
  const userIds = await fetchCompanyUserIds(companyId);
  const leadQuery = userIds.length
    ? { $or: [{ createdBy: { $in: userIds } }, { assignedTo: { $in: userIds } }] }
    : { _id: null };

  const [
    totalUsers,
    activeUsers,
    totalLeads,
    totalInventory,
    pendingInventoryRequests,
    roleBreakdown,
    currentSubscription,
  ] = await Promise.all([
    User.countDocuments({ companyId }),
    User.countDocuments({ companyId, isActive: true }),
    Lead.countDocuments(leadQuery),
    Inventory.countDocuments({ companyId }),
    InventoryRequest.countDocuments({ companyId, status: "PENDING" }),
    User.aggregate([
      { $match: { companyId } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    TenantSubscription.findOne({ companyId, isCurrent: true })
      .populate("planId", "code name pricing limits isActive")
      .lean(),
  ]);

  return {
    totalUsers,
    activeUsers,
    totalLeads,
    totalInventory,
    pendingInventoryRequests,
    roleBreakdown: roleBreakdown.map((row) => ({
      role: row._id,
      count: row.count,
    })),
    currentSubscription: currentSubscription
      ? toSubscriptionSummary(currentSubscription)
      : null,
  };
};

exports.createCompany = async (req, res) => {
  try {
    const {
      name,
      legalName,
      subdomain,
      customDomain,
      settings,
      adminName,
      adminEmail,
      adminPhone,
      adminPassword,
      planId,
      billingCycle,
      seats,
      trialDays,
    } = req.body || {};

    if (!name || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({
        message: "name, adminName, adminEmail, adminPassword are required",
      });
    }

    const cleanedName = String(name || "").trim();
    const requestedSubdomain = sanitizeSubdomain(subdomain);
    const baseSubdomain = requestedSubdomain || sanitizeSubdomain(cleanedName);
    if (!baseSubdomain) {
      return res.status(400).json({ message: "Valid subdomain is required" });
    }

    const [existingCompanyDomain, existingAdmin] = await Promise.all([
      customDomain
        ? Company.findOne({ customDomain: String(customDomain).trim().toLowerCase() })
          .select("_id")
          .lean()
        : null,
      User.findOne({ email: String(adminEmail).trim().toLowerCase() }).select("_id").lean(),
    ]);

    if (existingCompanyDomain) {
      return res.status(400).json({ message: "Custom domain already exists" });
    }
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin email already exists" });
    }

    const resolvedSubdomain = requestedSubdomain
      ? requestedSubdomain
      : await ensureUniqueSubdomain(baseSubdomain);

    if (requestedSubdomain) {
      const existingCompanySubdomain = await Company.findOne({ subdomain: resolvedSubdomain })
        .select("_id")
        .lean();
      if (existingCompanySubdomain) {
        return res.status(400).json({ message: "Subdomain already exists" });
      }
    }

    const company = await Company.create({
      name: cleanedName,
      legalName: String(legalName || "").trim(),
      subdomain: resolvedSubdomain,
      customDomain: String(customDomain || "").trim().toLowerCase(),
      status: "ACTIVE",
      settings: settings && typeof settings === "object" ? settings : {},
      createdBy: req.user?._id || null,
    });

    const adminUser = await User.create({
      name: String(adminName).trim(),
      email: String(adminEmail).trim().toLowerCase(),
      phone: String(adminPhone || "").trim(),
      password: String(adminPassword),
      role: USER_ROLES.ADMIN,
      companyId: company._id,
      parentId: null,
    });

    company.ownerUserId = adminUser._id;
    await company.save();

    let subscription = null;
    if (planId && mongoose.Types.ObjectId.isValid(planId)) {
      const plan = await SubscriptionPlan.findById(planId).select("_id").lean();
      if (plan) {
        const now = new Date();
        const cycle = String(billingCycle || "MONTHLY").trim().toUpperCase() === "YEARLY"
          ? "YEARLY"
          : "MONTHLY";
        const safeSeats = toPositiveInt(seats, 5);
        const safeTrialDays = Math.max(0, toPositiveInt(trialDays, 14));

        subscription = await TenantSubscription.create({
          companyId: company._id,
          planId: plan._id,
          status: safeTrialDays > 0 ? "TRIAL" : "ACTIVE",
          billingCycle: cycle,
          seats: safeSeats,
          trialEndsAt: safeTrialDays > 0
            ? new Date(now.getTime() + safeTrialDays * 24 * 60 * 60 * 1000)
            : null,
          startsAt: now,
          isCurrent: true,
        });
      }
    }

    return res.status(201).json({
      message: "Company tenant created successfully",
      company: toCompanySummary(company),
      admin: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        companyId: adminUser.companyId,
      },
      subscription: subscription ? toSubscriptionSummary(subscription) : null,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "createCompany failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.listCompanies = async (req, res) => {
  try {
    const page = toPositiveInt(req.query?.page, 1);
    const limit = Math.min(100, toPositiveInt(req.query?.limit, 20));
    const skip = (page - 1) * limit;
    const search = String(req.query?.search || "").trim();
    const status = String(req.query?.status || "").trim().toUpperCase();

    const query = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { legalName: { $regex: search, $options: "i" } },
        { subdomain: { $regex: search, $options: "i" } },
      ];
    }

    const [rows, total] = await Promise.all([
      Company.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Company.countDocuments(query),
    ]);

    const companyIds = rows.map((row) => row._id);
    const subscriptions = companyIds.length
      ? await TenantSubscription.find({
        companyId: { $in: companyIds },
        isCurrent: true,
      })
        .populate("planId", "code name pricing limits isActive")
        .lean()
      : [];
    const byCompanyId = new Map(
      subscriptions.map((row) => [String(row.companyId), toSubscriptionSummary(row)]),
    );

    return res.json({
      page,
      limit,
      total,
      companies: rows.map((row) => ({
        ...toCompanySummary(row),
        subscription: byCompanyId.get(String(row._id)) || null,
      })),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "listCompanies failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ message: "Invalid company id" });
    }

    const patch = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "name")) {
      patch.name = String(req.body.name || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "legalName")) {
      patch.legalName = String(req.body.legalName || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "status")) {
      patch.status = String(req.body.status || "").trim().toUpperCase();
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "subdomain")) {
      const subdomain = sanitizeSubdomain(req.body.subdomain);
      if (!subdomain) return res.status(400).json({ message: "Invalid subdomain" });
      const existing = await Company.findOne({
        _id: { $ne: companyId },
        subdomain,
      })
        .select("_id")
        .lean();
      if (existing) {
        return res.status(400).json({ message: "Subdomain already exists" });
      }
      patch.subdomain = subdomain;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "customDomain")) {
      const customDomain = String(req.body.customDomain || "").trim().toLowerCase();
      if (customDomain) {
        const existing = await Company.findOne({
          _id: { $ne: companyId },
          customDomain,
        })
          .select("_id")
          .lean();
        if (existing) {
          return res.status(400).json({ message: "Custom domain already exists" });
        }
      }
      patch.customDomain = customDomain;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "settings")) {
      if (typeof req.body.settings !== "object" || req.body.settings === null) {
        return res.status(400).json({ message: "settings must be an object" });
      }
      patch.settings = req.body.settings;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "metadata")) {
      patch.metadata =
        typeof req.body.metadata === "object" && req.body.metadata !== null
          ? req.body.metadata
          : {};
    }

    const updated = await Company.findByIdAndUpdate(
      companyId,
      { $set: patch },
      { new: true },
    ).lean();
    if (!updated) {
      return res.status(404).json({ message: "Company not found" });
    }

    return res.json({
      message: "Company updated",
      company: toCompanySummary(updated),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "updateCompany failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getCompanyMetaIntegration = async (req, res) => {
  try {
    const { companyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ message: "Invalid company id" });
    }

    const company = await loadCompanyForMetaIntegration(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    return res.json({
      integration: toCompanyMetaIntegration(company),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getCompanyMetaIntegration failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateCompanyMetaIntegration = async (req, res) => {
  try {
    const { companyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ message: "Invalid company id" });
    }

    const company = await loadCompanyForMetaIntegration(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const updated = await applyMetaIntegrationPatch({
      company,
      payload: req.body || {},
      requestId: req.requestId || null,
    });

    return res.json({
      message: "Company Meta integration updated and subscription sync executed",
      integration: toCompanyMetaIntegration(updated),
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "updateCompanyMetaIntegration failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.createPlan = async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim().toUpperCase();
    const name = String(req.body?.name || "").trim();
    if (!code || !name) {
      return res.status(400).json({ message: "code and name are required" });
    }

    const existing = await SubscriptionPlan.findOne({ code }).select("_id").lean();
    if (existing) {
      return res.status(400).json({ message: "Plan code already exists" });
    }

    const created = await SubscriptionPlan.create({
      code,
      name,
      description: String(req.body?.description || "").trim(),
      pricing:
        typeof req.body?.pricing === "object" && req.body.pricing !== null
          ? req.body.pricing
          : {},
      limits:
        typeof req.body?.limits === "object" && req.body.limits !== null
          ? req.body.limits
          : {},
      features: Array.isArray(req.body?.features) ? req.body.features : [],
      isActive: Object.prototype.hasOwnProperty.call(req.body || {}, "isActive")
        ? Boolean(req.body.isActive)
        : true,
    });

    return res.status(201).json({
      message: "Subscription plan created",
      plan: toPlanSummary(created),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "createPlan failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.listPlans = async (_req, res) => {
  try {
    const plans = await SubscriptionPlan.find({})
      .sort({ isActive: -1, createdAt: -1 })
      .lean();
    return res.json({ plans: plans.map(toPlanSummary) });
  } catch (error) {
    logger.error({
      requestId: _req.requestId || null,
      error: error.message,
      message: "listPlans failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(planId)) {
      return res.status(400).json({ message: "Invalid plan id" });
    }

    const patch = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "name")) {
      patch.name = String(req.body.name || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "description")) {
      patch.description = String(req.body.description || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "pricing")) {
      if (typeof req.body.pricing !== "object" || req.body.pricing === null) {
        return res.status(400).json({ message: "pricing must be an object" });
      }
      patch.pricing = req.body.pricing;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "limits")) {
      if (typeof req.body.limits !== "object" || req.body.limits === null) {
        return res.status(400).json({ message: "limits must be an object" });
      }
      patch.limits = req.body.limits;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "features")) {
      patch.features = Array.isArray(req.body.features) ? req.body.features : [];
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "isActive")) {
      patch.isActive = Boolean(req.body.isActive);
    }

    const updated = await SubscriptionPlan.findByIdAndUpdate(
      planId,
      { $set: patch },
      { new: true },
    ).lean();
    if (!updated) {
      return res.status(404).json({ message: "Plan not found" });
    }

    return res.json({
      message: "Subscription plan updated",
      plan: toPlanSummary(updated),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "updatePlan failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.assignSubscription = async (req, res) => {
  try {
    const {
      companyId,
      planId,
      status,
      billingCycle,
      seats,
      startsAt,
      endsAt,
      trialEndsAt,
      nextBillingAt,
      autoRenew,
      metadata,
    } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(companyId) || !mongoose.Types.ObjectId.isValid(planId)) {
      return res.status(400).json({ message: "Valid companyId and planId are required" });
    }

    const [company, plan] = await Promise.all([
      Company.findById(companyId).select("_id").lean(),
      SubscriptionPlan.findById(planId).select("_id").lean(),
    ]);
    if (!company) return res.status(404).json({ message: "Company not found" });
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    await TenantSubscription.updateMany(
      { companyId, isCurrent: true },
      { $set: { isCurrent: false } },
    );

    const created = await TenantSubscription.create({
      companyId,
      planId,
      status: String(status || "ACTIVE").trim().toUpperCase(),
      billingCycle: String(billingCycle || "MONTHLY").trim().toUpperCase(),
      seats: toPositiveInt(seats, 5),
      startsAt: startsAt ? new Date(startsAt) : new Date(),
      endsAt: endsAt ? new Date(endsAt) : null,
      trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
      nextBillingAt: nextBillingAt ? new Date(nextBillingAt) : null,
      autoRenew: Object.prototype.hasOwnProperty.call(req.body || {}, "autoRenew")
        ? Boolean(autoRenew)
        : true,
      metadata: typeof metadata === "object" && metadata !== null ? metadata : {},
      isCurrent: true,
    });

    const row = await TenantSubscription.findById(created._id)
      .populate("planId", "code name pricing limits isActive")
      .lean();

    return res.status(201).json({
      message: "Subscription assigned",
      subscription: toSubscriptionSummary(row),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "assignSubscription failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getCompanyUsage = async (req, res) => {
  try {
    const companyId = String(req.params?.companyId || req.query?.companyId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ message: "Valid companyId is required" });
    }

    const company = await Company.findById(companyId).lean();
    if (!company) return res.status(404).json({ message: "Company not found" });

    const usage = await computeCompanyUsage(company._id);
    return res.json({
      company: toCompanySummary(company),
      usage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getCompanyUsage failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getGlobalAnalytics = async (req, res) => {
  try {
    const [
      totalCompanies,
      activeCompanies,
      totalUsers,
      activeUsers,
      totalLeads,
      totalInventory,
      currentSubscriptions,
      companies,
      userGroups,
      inventoryGroups,
    ] = await Promise.all([
      Company.countDocuments({}),
      Company.countDocuments({ status: "ACTIVE" }),
      User.countDocuments({ role: { $ne: USER_ROLES.SUPER_ADMIN } }),
      User.countDocuments({ role: { $ne: USER_ROLES.SUPER_ADMIN }, isActive: true }),
      Lead.countDocuments({}),
      Inventory.countDocuments({}),
      TenantSubscription.find({ isCurrent: true, status: { $in: ["TRIAL", "ACTIVE", "PAST_DUE"] } })
        .populate("planId", "pricing")
        .lean(),
      Company.find({}).select("_id name subdomain status").lean(),
      User.aggregate([
        { $match: { companyId: { $ne: null }, role: { $ne: USER_ROLES.SUPER_ADMIN } } },
        { $group: { _id: "$companyId", totalUsers: { $sum: 1 }, activeUsers: { $sum: { $cond: ["$isActive", 1, 0] } } } },
      ]),
      Inventory.aggregate([
        { $group: { _id: "$companyId", totalInventory: { $sum: 1 } } },
      ]),
    ]);

    const usersByCompany = new Map(userGroups.map((row) => [String(row._id), row]));
    const inventoryByCompany = new Map(inventoryGroups.map((row) => [String(row._id), row]));
    const subscriptionsByCompany = new Map(
      currentSubscriptions.map((row) => [String(row.companyId), row]),
    );

    const mrrEstimate = currentSubscriptions.reduce((sum, row) => {
      const monthlyPrice = Number(row.planId?.pricing?.monthly || 0);
      const yearlyPrice = Number(row.planId?.pricing?.yearly || 0);
      if (row.billingCycle === "YEARLY" && yearlyPrice > 0) {
        return sum + yearlyPrice / 12;
      }
      return sum + monthlyPrice;
    }, 0);

    const topCompanies = companies
      .map((company) => {
        const userUsage = usersByCompany.get(String(company._id)) || {
          totalUsers: 0,
          activeUsers: 0,
        };
        const inventoryUsage = inventoryByCompany.get(String(company._id)) || {
          totalInventory: 0,
        };
        const sub = subscriptionsByCompany.get(String(company._id));
        return {
          companyId: company._id,
          name: company.name,
          subdomain: company.subdomain,
          status: company.status,
          totalUsers: userUsage.totalUsers,
          activeUsers: userUsage.activeUsers,
          totalInventory: inventoryUsage.totalInventory,
          subscriptionStatus: sub?.status || "NONE",
        };
      })
      .sort((a, b) => {
        const scoreA = a.activeUsers + a.totalInventory;
        const scoreB = b.activeUsers + b.totalInventory;
        return scoreB - scoreA;
      })
      .slice(0, 10);

    return res.json({
      overview: {
        totalCompanies,
        activeCompanies,
        totalUsers,
        activeUsers,
        totalLeads,
        totalInventory,
        activeSubscriptions: currentSubscriptions.length,
        mrrEstimate: Number(mrrEstimate.toFixed(2)),
      },
      topCompanies,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getGlobalAnalytics failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getMyTenantMetaIntegration = async (req, res) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Only tenant ADMIN can view Meta integration" });
    }
    if (!req.user.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const company = await loadCompanyForMetaIntegration(req.user.companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    return res.json({
      integration: toCompanyMetaIntegration(company),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getMyTenantMetaIntegration failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateMyTenantMetaIntegration = async (req, res) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Only tenant ADMIN can update Meta integration" });
    }
    if (!req.user.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const company = await loadCompanyForMetaIntegration(req.user.companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const updated = await applyMetaIntegrationPatch({
      company,
      payload: req.body || {},
      requestId: req.requestId || null,
    });

    return res.json({
      message: "Tenant Meta integration updated and subscription sync executed",
      integration: toCompanyMetaIntegration(updated),
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "updateMyTenantMetaIntegration failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getMyTenantSettings = async (req, res) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Only tenant ADMIN can view tenant settings" });
    }
    if (!req.user.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const [company, subscription] = await Promise.all([
      Company.findById(req.user.companyId).lean(),
      TenantSubscription.findOne({ companyId: req.user.companyId, isCurrent: true })
        .populate("planId", "code name pricing limits features isActive")
        .lean(),
    ]);
    if (!company) return res.status(404).json({ message: "Company not found" });

    return res.json({
      company: toCompanySummary(company),
      subscription: subscription ? toSubscriptionSummary(subscription) : null,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getMyTenantSettings failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateMyTenantSettings = async (req, res) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Only tenant ADMIN can update tenant settings" });
    }
    if (!req.user.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const patch = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "name")) {
      patch.name = String(req.body.name || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "customDomain")) {
      const customDomain = String(req.body.customDomain || "").trim().toLowerCase();
      if (customDomain) {
        const existing = await Company.findOne({
          _id: { $ne: req.user.companyId },
          customDomain,
        })
          .select("_id")
          .lean();
        if (existing) {
          return res.status(400).json({ message: "Custom domain already in use" });
        }
      }
      patch.customDomain = customDomain;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "settings")) {
      if (typeof req.body.settings !== "object" || req.body.settings === null) {
        return res.status(400).json({ message: "settings must be an object" });
      }
      patch.settings = req.body.settings;
    }

    const updated = await Company.findByIdAndUpdate(
      req.user.companyId,
      { $set: patch },
      { new: true },
    ).lean();
    if (!updated) return res.status(404).json({ message: "Company not found" });

    return res.json({
      message: "Tenant settings updated",
      company: toCompanySummary(updated),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "updateMyTenantSettings failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.resolveTenantByHost = async (req, res) => {
  try {
    return res.json({
      host: req.tenantHost || "",
      subdomain: req.tenantSubdomain || "",
      source: req.tenantSource || "",
      tenant: req.tenant ? toCompanySummary(req.tenant) : null,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "resolveTenantByHost failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};
