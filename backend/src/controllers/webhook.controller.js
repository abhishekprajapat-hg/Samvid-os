const axios = require("axios");
const Lead = require("../models/Lead");
const Company = require("../models/Company");
const { autoAssignLead } = require("../services/leadAssignment.service");
const logger = require("../config/logger");

const META_GRAPH_VERSION = String(process.env.META_GRAPH_VERSION || "v24.0").trim();
const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const META_GRAPH_TIMEOUT_MS = toPositiveInt(process.env.META_GRAPH_TIMEOUT_MS, 10_000);
const META_GRAPH_LEAD_FIELDS = "id,created_time,field_data,form_id,ad_id,campaign_id";
const META_DEDUPE_BY_PHONE = String(process.env.META_DEDUPE_BY_PHONE || "false")
  .trim()
  .toLowerCase() === "true";
const META_PHONE_PLACEHOLDER_PREFIX = String(process.env.META_PHONE_PLACEHOLDER_PREFIX || "META")
  .trim()
  .replace(/[^A-Za-z0-9_-]/g, "")
  || "META";
const toNormalizedText = (value) => String(value || "").trim();
const toPageIdList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((row) => toNormalizedText(row))
      .filter(Boolean);
  }

  const raw = toNormalizedText(value);
  if (!raw) return [];

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((row) => toNormalizedText(row))
          .filter(Boolean);
      }
    } catch (_error) {
      // Fall back to CSV parsing.
    }
  }

  if (raw.includes(",")) {
    return raw
      .split(",")
      .map((row) => toNormalizedText(row))
      .filter(Boolean);
  }

  return [raw];
};

const getFirstNonEmpty = (...values) => {
  for (const value of values) {
    const normalized = toNormalizedText(value);
    if (normalized) return normalized;
  }
  return "";
};

const resolveMetaAccessToken = (tenant = null, { includeEnv = true } = {}) => {
  const candidates = [
    tenant?.metadata?.metaAccessToken,
    tenant?.metadata?.meta?.accessToken,
  ];
  if (includeEnv) {
    candidates.push(process.env.META_ACCESS_TOKEN);
  }
  return getFirstNonEmpty(...candidates);
};

const resolveAllowedMetaPageIds = (tenant = null, { includeEnv = true } = {}) => {
  const ids = new Set([
    ...toPageIdList(tenant?.metadata?.metaPageIds),
    ...toPageIdList(tenant?.metadata?.meta?.pageIds),
    ...toPageIdList(tenant?.metadata?.metaPageId),
    ...toPageIdList(tenant?.metadata?.meta?.pageId),
    ...(includeEnv ? toPageIdList(process.env.META_PAGE_IDS) : []),
    ...(includeEnv ? toPageIdList(process.env.META_PAGE_ID) : []),
  ]);

  return ids;
};

const buildCompanyPageRouteMap = async () => {
  const companies = await Company.find({ status: "ACTIVE" })
    .select("_id name subdomain metadata updatedAt")
    .lean();

  const pageIdToCompanies = new Map();

  companies.forEach((company) => {
    const companyId = toNormalizedText(company?._id);
    if (!companyId) return;

    const pageIds = [...resolveAllowedMetaPageIds(company, { includeEnv: false })];
    if (!pageIds.length) return;

    const companyRoute = {
      companyId,
      companyName: toNormalizedText(company?.name),
      tenantSlug: toNormalizedText(company?.subdomain),
      accessToken: resolveMetaAccessToken(company, { includeEnv: false }),
      updatedAt: company?.updatedAt ? new Date(company.updatedAt).getTime() : 0,
    };

    pageIds.forEach((pageId) => {
      if (!pageId) return;
      const existingRows = pageIdToCompanies.get(pageId) || [];
      existingRows.push(companyRoute);
      pageIdToCompanies.set(pageId, existingRows);
    });
  });

  return {
    pageIdToCompanies,
  };
};

const routeLeadEventsByCompany = async ({ leadEvents = [], tenant = null } = {}) => {
  const groups = new Map();
  let filteredOutCount = 0;
  let unmatchedPageCount = 0;
  let ambiguousPageCount = 0;
  let ambiguousResolvedCount = 0;
  let noAccessTokenCount = 0;

  const tenantCompanyId = toNormalizedText(tenant?._id);
  if (tenantCompanyId) {
    const allowedPageIds = resolveAllowedMetaPageIds(tenant, { includeEnv: false });
    const scopedLeadEvents = allowedPageIds.size
      ? leadEvents.filter((event) => allowedPageIds.has(event.pageId))
      : leadEvents;
    filteredOutCount = Math.max(0, leadEvents.length - scopedLeadEvents.length);

    const accessToken = resolveMetaAccessToken(tenant, { includeEnv: false });
    if (!accessToken) {
      noAccessTokenCount += scopedLeadEvents.length;
    } else if (scopedLeadEvents.length) {
      groups.set(tenantCompanyId, {
        companyId: tenantCompanyId,
        companyName: toNormalizedText(tenant?.name),
        tenantSlug: toNormalizedText(tenant?.subdomain),
        accessToken,
        events: scopedLeadEvents,
      });
    }

    return {
      groups,
      filteredOutCount,
      unmatchedPageCount,
      ambiguousPageCount,
      ambiguousResolvedCount,
      noAccessTokenCount,
    };
  }

  const { pageIdToCompanies } = await buildCompanyPageRouteMap();

  leadEvents.forEach((event) => {
    const pageId = toNormalizedText(event?.pageId);
    if (!pageId) {
      unmatchedPageCount += 1;
      return;
    }

    const candidates = pageIdToCompanies.get(pageId) || [];
    if (!candidates.length) {
      unmatchedPageCount += 1;
      return;
    }

    const candidatesWithToken = candidates.filter((row) => Boolean(row?.accessToken));
    if (!candidatesWithToken.length) {
      noAccessTokenCount += 1;
      return;
    }

    let companyRoute = candidatesWithToken[0];
    if (candidatesWithToken.length > 1) {
      ambiguousPageCount += 1;
      ambiguousResolvedCount += 1;
      companyRoute = [...candidatesWithToken]
        .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))[0];

      logger.warn({
        pageId,
        selectedCompanyId: companyRoute.companyId,
        selectedTenantSlug: companyRoute.tenantSlug,
        candidateCompanyIds: candidatesWithToken.map((row) => row.companyId),
        message: "Meta page configured in multiple companies; routed to most recently updated company",
      });
    }

    const key = companyRoute.companyId;
    if (!groups.has(key)) {
      groups.set(key, {
        companyId: companyRoute.companyId,
        companyName: companyRoute.companyName,
        tenantSlug: companyRoute.tenantSlug,
        accessToken: companyRoute.accessToken,
        events: [],
      });
    }

    groups.get(key).events.push(event);
  });

  return {
    groups,
    filteredOutCount,
    unmatchedPageCount,
    ambiguousPageCount,
    ambiguousResolvedCount,
    noAccessTokenCount,
  };
};

const normalizeFieldData = (rows = []) => {
  const map = new Map();

  rows.forEach((field) => {
    const key = String(field?.name || "")
      .trim()
      .toLowerCase();
    if (!key) return;

    const rawValue = Array.isArray(field?.values) ? field.values[0] : field?.values;
    const value = String(rawValue || "").trim();
    if (!value) return;

    map.set(key, value);
  });

  const readFirst = (...keys) => {
    for (const key of keys) {
      const value = map.get(key);
      if (value) return value;
    }
    return "";
  };

  const firstName = readFirst("first_name", "firstname");
  const lastName = readFirst("last_name", "lastname");
  const fullName = readFirst("full_name", "name")
    || [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    name: fullName,
    phone: readFirst("phone_number", "phone", "mobile_number", "mobile"),
    email: readFirst("email", "email_address"),
    city: readFirst("city"),
    projectInterested: readFirst("project_interested", "project", "project_name"),
  };
};

const extractLeadEvents = (body = {}) => {
  if (body?.object !== "page") return [];

  const events = [];
  const entries = Array.isArray(body?.entry) ? body.entry : [];

  entries.forEach((entry) => {
    const pageId = String(entry?.id || "").trim();
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    changes.forEach((change) => {
      if (String(change?.field || "").trim().toLowerCase() !== "leadgen") return;

      const leadId = String(change?.value?.leadgen_id || "").trim();
      if (!leadId) return;

      events.push({
        leadId,
        pageId,
        formId: String(change?.value?.form_id || "").trim(),
      });
    });
  });

  return events;
};

const isDuplicateMetaLeadError = (error) => {
  if (!error || error.code !== 11000) return false;
  if (error?.keyPattern?.metaLeadId) return true;
  return String(error?.message || "").toLowerCase().includes("metaleadid");
};

const buildFallbackMetaPhone = (leadId = "") => {
  const normalized = String(leadId || "")
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-18);
  const suffix = normalized || Date.now().toString(36).toUpperCase();
  return `${META_PHONE_PLACEHOLDER_PREFIX}-${suffix}`;
};

const isInvalidMetaLeadError = (error) => {
  const status = Number(error?.response?.status || 0);
  const graphCode = Number(error?.response?.data?.error?.code || 0);
  return status === 400 && (graphCode === 100 || graphCode === 33);
};

const isMetaLeadPermissionError = (error) => {
  const status = Number(error?.response?.status || 0);
  const graphCode = Number(error?.response?.data?.error?.code || 0);
  const message = String(error?.response?.data?.error?.message || "").toLowerCase();

  if (status === 403) return true;
  if (graphCode === 10 || graphCode === 200) return true;
  if (!(status === 400 && graphCode === 100)) return false;

  return (
    message.includes("permission")
    || message.includes("leads_retrieval")
    || message.includes("does not have the capability")
    || message.includes("insufficient")
    || message.includes("not authorized")
  );
};

const ensureLeadAssignmentIfMissing = async (leadDoc, event, requester = null) => {
  if (!leadDoc) return null;

  const hasAssignee = Boolean(
    leadDoc.assignedTo || leadDoc.assignedExecutive || leadDoc.assignedFieldExecutive,
  );
  if (hasAssignee) return null;

  const assignment = await autoAssignLead({ lead: leadDoc, requester });
  logger.info({
    leadId: leadDoc._id,
    metaLeadId: event.leadId,
    assigned: assignment.assigned,
    mode: assignment.mode || null,
    executiveId: assignment.executive?._id || null,
    managerId: assignment.manager?._id || null,
    message: "Meta lead assignment retried for existing lead",
  });

  return assignment;
};

const captureFallbackMetaLead = async ({
  companyId = "",
  event = {},
  requester = null,
  reason = "",
  graphError = null,
} = {}) => {
  const existing = await Lead.findOne({
    metaLeadId: event.leadId,
    companyId,
  });
  if (existing) {
    const recovered = await ensureLeadAssignmentIfMissing(existing, event, requester);
    return {
      created: false,
      duplicate: true,
      assignmentRecovered: Boolean(recovered?.assigned),
      lead: existing,
    };
  }

  const fallbackPhone = buildFallbackMetaPhone(event.leadId);
  const fallbackProject = reason ? `META_${String(reason).toUpperCase()}` : "META_INTAKE";

  const lead = await Lead.create({
    name: "Meta Lead",
    phone: fallbackPhone,
    email: "",
    city: "",
    projectInterested: fallbackProject,
    companyId,
    metaLeadId: event.leadId,
    metaPageId: event.pageId,
    metaFormId: event.formId,
    source: "META",
    status: "NEW",
    assignedTo: null,
    createdBy: null,
  });

  const assignment = await autoAssignLead({
    lead,
    requester,
  });

  logger.warn({
    companyId,
    leadId: lead._id,
    metaLeadId: event.leadId,
    fallbackPhone,
    reason,
    assigned: assignment.assigned,
    mode: assignment.mode || null,
    executiveId: assignment.executive?._id || null,
    managerId: assignment.manager?._id || null,
    error: graphError?.response?.data || graphError?.message || "",
    message: "Meta lead captured via fallback intake",
  });

  return {
    created: true,
    duplicate: false,
    assignmentRecovered: false,
    lead,
  };
};

exports.verifyWebhook = (req, res) => {
  const VERIFY_TOKEN = String(process.env.META_VERIFY_TOKEN || "").trim();

  const mode = req.query["hub.mode"];
  const token = String(req.query["hub.verify_token"] || "").trim();
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    logger.info({ message: "Webhook verified" });
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

exports.handleWebhook = async (req, res) => {
  try {
    const leadEvents = extractLeadEvents(req.body);
    if (!leadEvents.length) {
      return res.status(200).json({ message: "No leadgen event found" });
    }

    const routed = await routeLeadEventsByCompany({
      leadEvents,
      tenant: req.tenant || null,
    });

    if (!routed.groups.size) {
      return res.status(200).json({
        message: "No leadgen event mapped to configured company Meta pages",
        received: leadEvents.length,
        processed: 0,
        routedCompanies: 0,
        filteredOut: routed.filteredOutCount,
        unmatchedPage: routed.unmatchedPageCount,
        ambiguousPage: routed.ambiguousPageCount,
        ambiguousResolved: routed.ambiguousResolvedCount,
        noAccessToken: routed.noAccessTokenCount,
        created: 0,
        duplicate: 0,
        invalid: 0,
        failed: 0,
        missingPhone: 0,
        permissionDenied: 0,
        assignmentRecovered: 0,
      });
    }

    let createdCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    let failedCount = 0;
    let missingPhoneCount = 0;
    let permissionDeniedCount = 0;
    let fallbackCreatedCount = 0;
    let recoveredAssignments = 0;
    const processedLeadKeys = new Set();

    for (const group of routed.groups.values()) {
      const tenantCompanyId = group.companyId;
      const accessToken = group.accessToken;
      const scopedLeadEvents = Array.isArray(group.events) ? group.events : [];
      const assignmentRequester = { companyId: tenantCompanyId };

      for (const event of scopedLeadEvents) {
        const processKey = `${tenantCompanyId}:${event.leadId}`;
        if (processedLeadKeys.has(processKey)) continue;
        processedLeadKeys.add(processKey);

        const existingByMetaLeadId = await Lead.findOne({
          metaLeadId: event.leadId,
          companyId: tenantCompanyId,
        });
        if (existingByMetaLeadId) {
          const recovered = await ensureLeadAssignmentIfMissing(
            existingByMetaLeadId,
            event,
            assignmentRequester,
          );
          if (recovered?.assigned) recoveredAssignments += 1;
          duplicateCount += 1;
          logger.info({
            companyId: tenantCompanyId,
            leadId: existingByMetaLeadId._id,
            metaLeadId: event.leadId,
            message: "Duplicate meta lead skipped by metaLeadId",
          });
          continue;
        }

        try {
          const response = await axios.get(
            `https://graph.facebook.com/${META_GRAPH_VERSION}/${event.leadId}`,
            {
              params: {
                access_token: accessToken,
                fields: META_GRAPH_LEAD_FIELDS,
              },
              timeout: META_GRAPH_TIMEOUT_MS,
            },
          );

          const leadData = response.data || {};
          const normalized = normalizeFieldData(leadData.field_data || []);
          const phone = String(normalized.phone || "").trim();
          const hasRealPhone = Boolean(phone);
          const fallbackPhone = hasRealPhone ? phone : buildFallbackMetaPhone(event.leadId);

          if (!hasRealPhone) {
            missingPhoneCount += 1;
            logger.info({
              companyId: tenantCompanyId,
              pageId: event.pageId,
              leadId: event.leadId,
              generatedPhone: fallbackPhone,
              message: "Meta lead missing phone; generated fallback phone for intake",
            });
          }

          if (META_DEDUPE_BY_PHONE && hasRealPhone) {
            const existingByPhone = await Lead.findOne({ phone, companyId: tenantCompanyId });
            if (existingByPhone) {
              duplicateCount += 1;
              logger.info({
                companyId: tenantCompanyId,
                leadId: existingByPhone._id,
                phone,
                metaLeadId: event.leadId,
                message: "Duplicate meta lead skipped by phone",
              });
              continue;
            }
          }

          const lead = await Lead.create({
            name: normalized.name || "Unknown",
            phone: fallbackPhone,
            email: normalized.email,
            city: normalized.city,
            projectInterested: normalized.projectInterested,
            companyId: tenantCompanyId,
            metaLeadId: event.leadId,
            metaPageId: event.pageId,
            metaFormId: event.formId,
            source: "META",
            status: "NEW",
            assignedTo: null,
            createdBy: null,
          });

          const assignment = await autoAssignLead({
            lead,
            requester: assignmentRequester,
          });
          createdCount += 1;

          logger.info({
            companyId: tenantCompanyId,
            leadId: lead._id,
            assigned: assignment.assigned,
            mode: assignment.mode || null,
            executiveId: assignment.executive?._id || null,
            managerId: assignment.manager?._id || null,
            message: "Meta lead processed",
          });
        } catch (leadError) {
          if (isDuplicateMetaLeadError(leadError)) {
            duplicateCount += 1;
            logger.info({
              companyId: tenantCompanyId,
              metaLeadId: event.leadId,
              message: "Duplicate meta lead skipped due to unique metaLeadId",
            });
            continue;
          }

          if (isMetaLeadPermissionError(leadError)) {
            permissionDeniedCount += 1;
            try {
              const fallback = await captureFallbackMetaLead({
                companyId: tenantCompanyId,
                event,
                requester: assignmentRequester,
                reason: "permission_denied",
                graphError: leadError,
              });
              if (fallback.created) {
                createdCount += 1;
                fallbackCreatedCount += 1;
              } else if (fallback.duplicate) {
                duplicateCount += 1;
                if (fallback.assignmentRecovered) recoveredAssignments += 1;
              }
            } catch (fallbackError) {
              failedCount += 1;
              logger.error({
                companyId: tenantCompanyId,
                leadId: event.leadId,
                error: fallbackError.message,
                rootError: leadError.response?.data || leadError.message,
                message: "Meta fallback lead capture failed after permission error",
              });
            }
            continue;
          }

          if (isInvalidMetaLeadError(leadError)) {
            invalidCount += 1;
            logger.warn({
              companyId: tenantCompanyId,
              leadId: event.leadId,
              error: leadError.response?.data || leadError.message,
              message: "Meta lead skipped due to invalid lead ID in Graph API",
            });
            continue;
          }

          failedCount += 1;
          logger.error({
            companyId: tenantCompanyId,
            leadId: event.leadId,
            error: leadError.response?.data || leadError.message,
            message: "Failed to process meta lead",
          });
        }
      }
    }

    const responsePayload = {
      message: failedCount
        ? "Meta lead webhook partially failed; returning 500 for retry"
        : "Meta lead webhook processed",
      received: leadEvents.length,
      processed: processedLeadKeys.size,
      routedCompanies: routed.groups.size,
      filteredOut: routed.filteredOutCount,
      unmatchedPage: routed.unmatchedPageCount,
      ambiguousPage: routed.ambiguousPageCount,
      ambiguousResolved: routed.ambiguousResolvedCount,
      noAccessToken: routed.noAccessTokenCount,
      created: createdCount,
      duplicate: duplicateCount,
      invalid: invalidCount,
      failed: failedCount,
      missingPhone: missingPhoneCount,
      permissionDenied: permissionDeniedCount,
      fallbackCreated: fallbackCreatedCount,
      assignmentRecovered: recoveredAssignments,
      dedupeByPhoneEnabled: META_DEDUPE_BY_PHONE,
    };

    if (failedCount > 0) {
      return res.status(500).json(responsePayload);
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    logger.error({
      error: error.response?.data || error.message,
      message: "Webhook processing failed",
    });
    return res.sendStatus(500);
  }
};
