const Report = require("../models/Report");
const logger = require("../config/logger");
const { handleControllerError: handleError } = require("../utils/httpError");

const handleControllerError = (res, error, message) => handleError(res, error, logger, message);

const pickEnum = (value, allowed, fallback) => {
  const safe = String(value || "").trim().toUpperCase();
  return allowed.includes(safe) ? safe : fallback;
};

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

exports.listReports = async (req, res) => {
  try {
    const isTemplate = String(req.query.templates || "") === "true";
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const reports = await Report.find({ companyId: req.user.companyId, isTemplate })
      .populate("generatedBy", "name")
      .sort({ generatedAt: -1 })
      .limit(limit)
      .lean();
    return res.json({ reports });
  } catch (error) {
    return handleControllerError(res, error, "listReports failed");
  }
};

exports.createReport = async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Report name is required" });

    const report = await Report.create({
      companyId: req.user.companyId,
      name: name.slice(0, 160),
      type: pickEnum(body.type, Report.REPORT_TYPES, "BUSINESS_OVERVIEW"),
      from: toDate(body.from),
      to: toDate(body.to),
      sections: Array.isArray(body.sections)
        ? body.sections
          .map((value) => String(value || "").toUpperCase())
          .filter((value) => Report.REPORT_SECTIONS.includes(value))
        : [],
      metrics: Array.isArray(body.metrics)
        ? body.metrics.map((value) => String(value || "").trim().slice(0, 60)).filter(Boolean).slice(0, 30)
        : [],
      filters: {
        team: String(body.filters?.team || "").trim().slice(0, 120),
        property: String(body.filters?.property || "").trim().slice(0, 120),
        leadSource: String(body.filters?.leadSource || "").trim().slice(0, 60),
        status: String(body.filters?.status || "").trim().slice(0, 60),
      },
      visualization: pickEnum(body.visualization, Report.VISUALIZATIONS, "BAR"),
      compareWithPrevious: Boolean(body.compareWithPrevious),
      format: pickEnum(body.format, Report.EXPORT_FORMATS, "PDF"),
      isTemplate: Boolean(body.isTemplate),
      summary: String(body.summary || "").trim().slice(0, 200),
      generatedBy: req.user._id,
      generatedAt: new Date(),
    });

    return res.status(201).json({ report: report.toObject() });
  } catch (error) {
    return handleControllerError(res, error, "createReport failed");
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const deleted = await Report.findOneAndDelete({
      _id: req.params.reportId,
      companyId: req.user.companyId,
    });
    if (!deleted) return res.status(404).json({ message: "Report not found" });
    return res.json({ message: "Report deleted" });
  } catch (error) {
    return handleControllerError(res, error, "deleteReport failed");
  }
};
