const axios = require("axios");
const Lead = require("../models/Lead");
const { autoAssignLead } = require("../services/leadAssignment.service");

const META_GRAPH_VERSION = String(process.env.META_GRAPH_VERSION || "v24.0").trim();

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

exports.verifyWebhook = (req, res) => {
  const VERIFY_TOKEN = String(process.env.META_VERIFY_TOKEN || "").trim();

  const mode = req.query["hub.mode"];
  const token = String(req.query["hub.verify_token"] || "").trim();
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

exports.handleWebhook = async (req, res) => {
  try {
    const accessToken = String(process.env.META_ACCESS_TOKEN || "").trim();
    if (!accessToken) {
      console.error("META_ACCESS_TOKEN is missing");
      return res.status(500).json({ message: "Server not configured for meta leads" });
    }

    const leadEvents = extractLeadEvents(req.body);
    if (!leadEvents.length) {
      return res.status(200).json({ message: "No leadgen event found" });
    }

    let createdCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    let failedCount = 0;
    const processedLeadIds = new Set();

    for (const event of leadEvents) {
      if (processedLeadIds.has(event.leadId)) continue;
      processedLeadIds.add(event.leadId);

      try {
        const response = await axios.get(`https://graph.facebook.com/${META_GRAPH_VERSION}/${event.leadId}`, {
          params: {
            access_token: accessToken,
          },
        });

        const leadData = response.data || {};
        const normalized = normalizeFieldData(leadData.field_data || []);
        const phone = String(normalized.phone || "").trim();

        if (!phone) {
          invalidCount += 1;
          console.log(`Meta lead skipped (missing phone) leadId=${event.leadId}`);
          continue;
        }

        const existing = await Lead.findOne({ phone });
        if (existing) {
          duplicateCount += 1;
          console.log(`Duplicate lead skipped (phone: ${phone})`);
          continue;
        }

        const lead = await Lead.create({
          name: normalized.name || "Unknown",
          phone,
          email: normalized.email,
          city: normalized.city,
          projectInterested: normalized.projectInterested,
          source: "META",
          status: "NEW",
          assignedTo: null,
          createdBy: null,
        });

        const assignment = await autoAssignLead({ lead, requester: null });
        createdCount += 1;

        console.log(
          assignment.assigned
            ? assignment.manager
              ? `Lead auto assigned to ${assignment.executive.name} under manager ${assignment.manager.name}`
              : `Lead auto assigned to ${assignment.executive.name} (${assignment.mode})`
            : "No active executive available, lead left unassigned",
        );
      } catch (leadError) {
        failedCount += 1;
        console.error(
          `Failed to process meta lead ${event.leadId}:`,
          leadError.response?.data || leadError.message,
        );
      }
    }

    return res.status(200).json({
      message: "Meta lead webhook processed",
      processed: processedLeadIds.size,
      created: createdCount,
      duplicate: duplicateCount,
      invalid: invalidCount,
      failed: failedCount,
    });
  } catch (error) {
    console.error("Webhook error:", error.response?.data || error.message);
    return res.sendStatus(500);
  }
};
