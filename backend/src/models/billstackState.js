const mongoose = require('mongoose');
module.exports = new mongoose.Schema({
  customerId: { type: String, default: '', maxlength: 200 },
  boardVersion: Number,
  boardSourceHash: String,
  syncStatus: { type: String, enum: ['NOT_SYNCED', 'PENDING', 'SYNCED', 'FAILED'], default: 'NOT_SYNCED' },
  lastSyncedAt: { type: Date, default: null },
  lastSyncError: { type: String, default: '', maxlength: 300 },
}, { _id: false });
