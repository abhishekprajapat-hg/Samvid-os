const mongoose = require("mongoose");

/*
 * A report someone built or ran.
 *
 * Two things live here, told apart by `isTemplate`: the history the Reports
 * screen lists under "Recent Reports", and the saved configurations the custom
 * builder offers back. They are the same shape because a template is simply a
 * run whose settings were worth keeping.
 *
 * The numbers are not stored. A report is a question - this range, these
 * sections, these filters - and it is answered from live data every time it is
 * opened, so a report from last week never shows figures that have since been
 * corrected.
 */

const REPORT_TYPES = Object.freeze([
  "BUSINESS_OVERVIEW",
  "SALES_PIPELINE",
  "FINANCE",
  "INVENTORY",
  "TEAM_TASKS",
  "ATTENDANCE",
  "COWORKING",
]);

const REPORT_SECTIONS = Object.freeze([
  "SALES", "FINANCE", "INVENTORY", "TEAM", "ATTENDANCE", "COWORKING",
]);

const VISUALIZATIONS = Object.freeze(["TABLE", "BAR", "LINE", "CARDS"]);
const EXPORT_FORMATS = Object.freeze(["PDF", "EXCEL", "CSV"]);

const reportSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Company", index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    type: { type: String, enum: REPORT_TYPES, default: "BUSINESS_OVERVIEW" },
    from: { type: Date, default: null },
    to: { type: Date, default: null },
    sections: { type: [{ type: String, enum: REPORT_SECTIONS }], default: [] },
    metrics: { type: [{ type: String, trim: true, maxlength: 60 }], default: [] },
    filters: {
      team: { type: String, trim: true, default: "" },
      property: { type: String, trim: true, default: "" },
      leadSource: { type: String, trim: true, default: "" },
      status: { type: String, trim: true, default: "" },
    },
    visualization: { type: String, enum: VISUALIZATIONS, default: "BAR" },
    compareWithPrevious: { type: Boolean, default: false },
    format: { type: String, enum: EXPORT_FORMATS, default: "PDF" },
    /* A saved configuration rather than a run. */
    isTemplate: { type: Boolean, default: false, index: true },
    /* What the run covered, for the "6 invoices" style subtitle. */
    summary: { type: String, trim: true, default: "", maxlength: 200 },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

reportSchema.index({ companyId: 1, isTemplate: 1, generatedAt: -1 });

module.exports = mongoose.model("Report", reportSchema);
module.exports.REPORT_TYPES = REPORT_TYPES;
module.exports.REPORT_SECTIONS = REPORT_SECTIONS;
module.exports.VISUALIZATIONS = VISUALIZATIONS;
module.exports.EXPORT_FORMATS = EXPORT_FORMATS;
