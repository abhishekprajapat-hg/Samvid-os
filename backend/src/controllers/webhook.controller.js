const axios = require("axios");
const Lead = require("../models/Lead");
const { autoAssignLead } = require("../services/leadAssignment.service");
const logger = require("../config/logger");

const META_GRAPH_VERSION = String(process.env.META_GRAPH_VERSION || "v24.0").trim();
const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const META_GRAPH_TIMEOUT_MS = toPositiveInt(process.env.META_GRAPH_TIMEOUT_MS, 10_000);
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

const resolveMetaAccessToken = (tenant = null) =>
  getFirstNonEmpty(
    tenant?.metadata?.metaAccessToken,
    tenant?.metadata?.meta?.accessToken,
    process.env.META_ACCESS_TOKEN,
  );

const resolveAllowedMetaPageIds = (tenant = null) => {
  const ids = new Set([
    ...toPageIdList(tenant?.metadata?.metaPageIds),
    ...toPageIdList(tenant?.metadata?.meta?.pageIds),
    ...toPageIdList(tenant?.metadata?.metaPageId),
    ...toPageIdList(tenant?.metadata?.meta?.pageId),
    ...toPageIdList(process.env.META_PAGE_IDS),
    ...toPageIdList(process.env.META_PAGE_ID),
  ]);

  return ids;
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

const isInvalidMetaLeadError = (error) => {
  const status = Number(error?.response?.status || 0);
  const graphCode = Number(error?.response?.data?.error?.code || 0);
  return status === 400 && (graphCode === 100 || graphCode === 33);
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
    const tenantCompanyId = String(req.tenant?._id || "").trim();
    if (!tenantCompanyId) {
      return res.status(400).json({
        message: "Tenant context is required for webhook processing",
      });
    }

    const accessToken = resolveMetaAccessToken(req.tenant);
    if (!accessToken) {
      logger.error({
        companyId: tenantCompanyId,
        message: "META access token is missing for webhook processing",
      });
      return res.status(500).json({ message: "Server not configured for meta leads" });
    }

    const leadEvents = extractLeadEvents(req.body);
    if (!leadEvents.length) {
      return res.status(200).json({ message: "No leadgen event found" });
    }

    const allowedPageIds = resolveAllowedMetaPageIds(req.tenant);
    const scopedLeadEvents = allowedPageIds.size
      ? leadEvents.filter((event) => allowedPageIds.has(event.pageId))
      : leadEvents;
    const filteredOutCount = Math.max(0, leadEvents.length - scopedLeadEvents.length);

    if (!scopedLeadEvents.length) {
      logger.info({
        companyId: tenantCompanyId,
        receivedEvents: leadEvents.length,
        allowedPageIds: [...allowedPageIds],
        message: "No leadgen events matched tenant page scope",
      });
      return res.status(200).json({
        message: "No leadgen event matched tenant page scope",
        processed: 0,
        received: leadEvents.length,
        filteredOut: filteredOutCount,
      });
    }

    let createdCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    let failedCount = 0;
    let recoveredAssignments = 0;
    const processedLeadIds = new Set();

    for (const event of scopedLeadEvents) {
      if (processedLeadIds.has(event.leadId)) continue;
      processedLeadIds.add(event.leadId);

      try {
        const response = await axios.get(
          `https://graph.facebook.com/${META_GRAPH_VERSION}/${event.leadId}`,
          {
            params: {
              access_token: accessToken,
            },
            timeout: META_GRAPH_TIMEOUT_MS,
          },
        );

        const leadData = response.data || {};
        const normalized = normalizeFieldData(leadData.field_data || []);
        const phone = String(normalized.phone || "").trim();

        if (!phone) {
          invalidCount += 1;
          logger.info({
            leadId: event.leadId,
            message: "Meta lead skipped due to missing phone",
          });
          continue;
        }

        const assignmentRequester = { companyId: tenantCompanyId };

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
            leadId: existingByMetaLeadId._id,
            metaLeadId: event.leadId,
            phone,
            message: "Duplicate meta lead skipped by metaLeadId",
          });
          continue;
        }

        const existingByPhone = await Lead.findOne({ phone, companyId: tenantCompanyId });
        if (existingByPhone) {
          duplicateCount += 1;
          logger.info({
            leadId: existingByPhone._id,
            phone,
            metaLeadId: event.leadId,
            message: "Duplicate meta lead skipped by phone",
          });
          continue;
        }

        const lead = await Lead.create({
          name: normalized.name || "Unknown",
          phone,
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
            metaLeadId: event.leadId,
            message: "Duplicate meta lead skipped due to unique metaLeadId",
          });
          continue;
        }

        if (isInvalidMetaLeadError(leadError)) {
          invalidCount += 1;
          logger.warn({
            leadId: event.leadId,
            error: leadError.response?.data || leadError.message,
            message: "Meta lead skipped due to invalid lead ID in Graph API",
          });
          continue;
        }

        failedCount += 1;
        logger.error({
          leadId: event.leadId,
          error: leadError.response?.data || leadError.message,
          message: "Failed to process meta lead",
        });
      }
    }

    const responsePayload = {
      message: failedCount
        ? "Meta lead webhook partially failed; returning 500 for retry"
        : "Meta lead webhook processed",
      received: leadEvents.length,
      processed: processedLeadIds.size,
      filteredOut: filteredOutCount,
      created: createdCount,
      duplicate: duplicateCount,
      invalid: invalidCount,
      failed: failedCount,
      assignmentRecovered: recoveredAssignments,
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
