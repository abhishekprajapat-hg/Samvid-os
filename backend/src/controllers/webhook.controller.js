const axios = require("axios");
const Lead = require("../models/Lead");
const { autoAssignLead } = require("../services/leadAssignment.service");

exports.verifyWebhook = (req, res) => {
  const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

exports.handleWebhook = async (req, res) => {
  try {
    console.log("Webhook event received");

    const body = req.body;
    if (body.object !== "page") {
      return res.status(200).json({ message: "Ignored" });
    }

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    if (change?.field !== "leadgen") {
      return res.status(200).json({ message: "Not a lead event" });
    }

    const leadId = change?.value?.leadgen_id;
    if (!leadId) {
      return res.status(200).json({ message: "Missing leadgen id" });
    }

    console.log("New lead ID:", leadId);

    const response = await axios.get(`https://graph.facebook.com/v24.0/${leadId}`, {
      params: {
        access_token: process.env.META_ACCESS_TOKEN,
      },
    });

    const leadData = response.data;

    let name = "";
    let phone = "";
    let email = "";

    (leadData.field_data || []).forEach((field) => {
      if (field.name === "full_name") name = field.values[0];
      if (field.name === "phone_number") phone = field.values[0];
      if (field.name === "email") email = field.values[0];
    });

    if (!phone) {
      console.log("Phone missing, lead skipped");
      return res.status(200).json({ message: "Invalid lead" });
    }

    const existing = await Lead.findOne({ phone });
    if (existing) {
      console.log(`Duplicate lead skipped (phone: ${phone})`);
      return res.status(200).json({ message: "Duplicate" });
    }

    const lead = await Lead.create({
      name: name || "Unknown",
      phone,
      email,
      source: "META",
      status: "NEW",
      assignedTo: null,
    });

    const assignment = await autoAssignLead({ lead, requester: null });

    console.log(
      assignment.assigned
        ? assignment.manager
          ? `Lead auto assigned to ${assignment.executive.name} under manager ${assignment.manager.name}`
          : `Lead auto assigned to ${assignment.executive.name} (${assignment.mode})`
        : "No active executive available, lead left unassigned",
    );

    res.status(200).json({ message: "Lead processed successfully" });
  } catch (error) {
    console.error("Webhook error:", error.response?.data || error.message);
    res.sendStatus(500);
  }
};
