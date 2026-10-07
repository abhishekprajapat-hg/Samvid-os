const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  // Deterministic primary key supplies uniqueness even when autoIndex is off.
  _id: String,
  companyId: { type: mongoose.Schema.Types.ObjectId, required: true },
  entityType: { type: String, enum: ['lead', 'coworking-client'], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  externalId: { type: String, required: true },
  status: { type: String, enum: ['PENDING', 'PROCESSING', 'SYNCED', 'FAILED'], default: 'PENDING' },
  attempts: { type: Number, default: 0 },
  retryable: { type: Boolean, default: true },
  nextRetryAt: { type: Date, default: Date.now },
  leaseUntil: { type: Date, default: null },
  leaseToken: { type: String, default: '' },
  fingerprint: { type: String, default: '' },
  desiredFingerprint: { type: String, default: '' },
  lastError: { type: String, default: '', maxlength: 300 },
}, { timestamps: true });
schema.index({ status: 1, nextRetryAt: 1, leaseUntil: 1 });
module.exports = mongoose.model('BillstackSyncJob', schema);
