const mongoose = require("mongoose");

/*
 * A delete a Manager asked for and an Admin has to approve.
 *
 * Business rule (29 Sep 2026): a Manager can do everything an Admin can,
 * except delete. Every delete route that a Manager can reach runs
 * requireAdminApprovalForDelete (services/deleteApproval.service.js), which
 * stores the call here instead of running it. When an Admin approves, the
 * same route handler runs with the Admin as the actor.
 *
 * Staff accounts and inventory keep their own, older request flows
 * (UserDeleteRequest and InventoryRequest type "delete").
 */
const DELETE_REQUEST_STATUSES = Object.freeze([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  // Approved, but the record was already gone.
  "FAILED",
]);

const recordDeleteRequestSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    // Registry key of the delete route, e.g. "task", "project", "crm_contact".
    actionType: { type: String, required: true, trim: true, maxlength: 60 },
    // What the record is, for people: "Task", "Owner / broker contact".
    entityLabel: { type: String, default: "", maxlength: 120 },
    entityId: { type: String, required: true, trim: true, maxlength: 60 },
    // The record's own name at request time, e.g. the task title.
    entityName: { type: String, default: "", maxlength: 300 },
    pageKey: { type: String, default: "", maxlength: 60 },
    // Enough of the original call to run it again on approval.
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    query: { type: mongoose.Schema.Types.Mixed, default: {} },
    body: { type: mongoose.Schema.Types.Mixed, default: {} },
    path: { type: String, default: "", maxlength: 500 },
    reason: { type: String, default: "", maxlength: 500 },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: DELETE_REQUEST_STATUSES,
      default: "PENDING",
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "", maxlength: 500 },
    // Set while an Admin's approve call is running the delete, so two clicks
    // cannot run it twice. Cleared again if the delete is refused.
    processingAt: { type: Date, default: null },
    // What the delete returned when it ran.
    result: {
      statusCode: { type: Number, default: null },
      message: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

// One open request per record: asking twice returns the first request.
recordDeleteRequestSchema.index(
  { companyId: 1, actionType: 1, entityId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "PENDING" },
  },
);
recordDeleteRequestSchema.index({ companyId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("RecordDeleteRequest", recordDeleteRequestSchema);
module.exports.DELETE_REQUEST_STATUSES = DELETE_REQUEST_STATUSES;
