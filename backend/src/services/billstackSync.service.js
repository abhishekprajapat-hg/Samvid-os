const { randomUUID } = require('node:crypto');
const Job = require('../models/BillstackSyncJob');
const { getBillstackConfig, configuredCompany, isBillstackEnabled } = require('../config/billstack');
const remote = require('./billstack.service');
const { externalId, modelFor, loadEligible, customerPayload, fingerprint } = require('./billstackCustomer.service');
const { createHttpError } = require('../utils/httpError');

const safeError = (error) => [400, 403, 404, 409, 502, 503].includes(error?.statusCode)
  ? String(error.message).slice(0, 300) : 'Customer sync failed; retry shortly';

async function schedule(companyId, entityType, entityId, force = false) {
  getBillstackConfig(companyId);
  const entity = await loadEligible(companyId, entityType, entityId);
  entityId = entity._id;
  const payload = customerPayload(companyId, entityType, entity);
  const id = externalId(companyId, entityType, entityId);
  const hash = fingerprint(payload);
  await Job.updateOne({ _id: id }, { $setOnInsert: { companyId, entityType, entityId, externalId: id, fingerprint: hash } }, { upsert: true });
  await Job.updateOne({ _id: id }, { $set: { desiredFingerprint: hash } });
  // Never disturb a live lease. A concurrent edit is picked up after that run.
  await Job.updateOne({ _id: id, status: { $ne: 'PROCESSING' }, ...(force ? {} : { $or: [{ fingerprint: { $ne: hash } }, { status: 'FAILED', retryable: { $ne: false }, nextRetryAt: { $lte: new Date() } }] }) },
    { $set: { status: 'PENDING', retryable: true, nextRetryAt: new Date(), fingerprint: hash } });
  const job = await Job.findById(id).lean();
  await modelFor(entityType).updateOne({ _id: entityId, companyId }, { $set: { 'billstack.syncStatus': job.status === 'SYNCED' ? 'SYNCED' : job.status === 'FAILED' ? 'FAILED' : 'PENDING', ...(job.status === 'SYNCED' ? { 'billstack.lastSyncError': '' } : {}) } });
  return job;
}

// Called after business persistence. Never allow integration failure to turn
// an already successful closure/booking into an HTTP failure.
async function scheduleSafely(companyId, type, id) {
  if (!isBillstackEnabled(companyId)) return { skipped: true };
  try { return await schedule(companyId, type, id); }
  catch (error) {
    try {
      await modelFor(type).updateOne({ _id: id, companyId }, { $set: { 'billstack.syncStatus': error.statusCode ? 'FAILED' : 'PENDING', 'billstack.lastSyncError': safeError(error) } });
      if (error.statusCode) return { terminal: true };
    } catch { /* reconciliation retries persisted pending markers */ }
    return null;
  }
}

async function processJob(id) {
  const now = new Date();
  const token = randomUUID();
  const job = await Job.findOneAndUpdate({ _id: id, $or: [
    { status: { $in: ['PENDING', 'FAILED'] }, retryable: { $ne: false }, nextRetryAt: { $lte: now } },
    { status: 'PROCESSING', leaseUntil: { $lte: now } },
  ] }, { $set: { status: 'PROCESSING', leaseUntil: new Date(Date.now() + 120000), leaseToken: token }, $inc: { attempts: 1 } }, { new: true });
  if (!job) return false;
  try {
    const entity = await loadEligible(job.companyId, job.entityType, job.entityId);
    const payload = customerPayload(job.companyId, job.entityType, entity);
    const hash = fingerprint(payload);
    const customerId = await remote.upsertCustomer(job.companyId, payload);
    const ownsLease = await Job.exists({ _id: id, leaseToken: token, status: 'PROCESSING' });
    if (!ownsLease) return false;
    const latest = await loadEligible(job.companyId, job.entityType, job.entityId);
    let changed = fingerprint(customerPayload(job.companyId, job.entityType, latest)) !== hash;
    const updated = await modelFor(job.entityType).updateOne({ _id: job.entityId, companyId: job.companyId, ...(latest.updatedAt ? { updatedAt: latest.updatedAt } : {}) }, { $set: {
      'billstack.customerId': customerId, 'billstack.syncStatus': changed ? 'PENDING' : 'SYNCED',
      'billstack.lastSyncedAt': new Date(), 'billstack.lastSyncError': '',
    } });
    if (!updated.matchedCount) changed = true;
    const finished = !changed && await Job.updateOne({ _id: id, leaseToken: token, desiredFingerprint: hash }, { $set: { status: 'SYNCED', fingerprint: hash, leaseUntil: null, lastError: '' } });
    if (!finished?.matchedCount) {
      changed = true;
      await Job.updateOne({ _id: id, leaseToken: token }, { $set: { status: 'PENDING', fingerprint: hash, leaseUntil: null, lastError: '', nextRetryAt: new Date() } });
      await modelFor(job.entityType).updateOne({ _id: job.entityId, companyId: job.companyId }, { $set: { 'billstack.syncStatus': 'PENDING' } });
    }
    return !changed;
  } catch (error) {
    const message = safeError(error);
    const retryable = error.retryable ?? (!error.statusCode || error.statusCode === 502);
    const result = await Job.updateOne({ _id: id, leaseToken: token }, { $set: {
      status: 'FAILED', retryable, leaseUntil: null, lastError: message,
      nextRetryAt: retryable ? new Date(Date.now() + (error.retryAfterMs || Math.min(3600000, 30000 * 2 ** Math.min(job.attempts, 7)))) : null,
    } });
    if (result.matchedCount) await modelFor(job.entityType).updateOne({ _id: job.entityId, companyId: job.companyId }, { $set: { 'billstack.syncStatus': 'FAILED', 'billstack.lastSyncError': message } });
    return false;
  }
}

async function ensureSynced(companyId, type, id) {
  getBillstackConfig(companyId);
  const job = await schedule(companyId, type, id);
  if (job.status !== 'SYNCED') await processJob(job._id);
  const entity = await loadEligible(companyId, type, id);
  const latestJob = await Job.findById(job._id).lean();
  if (latestJob.status !== 'SYNCED' || latestJob.fingerprint !== fingerprint(customerPayload(companyId, type, entity)) || entity.billstack?.syncStatus !== 'SYNCED' || !entity.billstack?.customerId) {
    throw createHttpError(409, entity.billstack?.lastSyncError || 'Customer sync is pending; retry shortly');
  }
  return entity.billstack.customerId;
}

let running = false;
async function scheduleStructuredSafely(kind, row) {
  try {
    const job = await scheduleSafely(row.companyId, 'coworking-client', row.clientId);
    if (job) await require(kind === 'booking' ? '../models/CoworkingBooking' : '../models/CoworkingContract').updateOne({ _id: row._id, companyId: row.companyId }, { $set: { billstackSyncPending: false } });
  } catch { /* the activation marker remains durable */ }
}
async function sweep() {
  const companyId = configuredCompany();
  if (running || !companyId) return;
  running = true;
  try {
    // Only explicit pending markers are reconciled, never a historical import.
    for (const type of ['lead', 'coworking-client']) {
      const rows = await modelFor(type).find({ companyId, 'billstack.syncStatus': 'PENDING' }).limit(100).lean();
      for (const row of rows) await scheduleSafely(row.companyId, type, row._id);
    }
    const { reconcilePendingBoards } = require('./coworkingBoardIdentity.service');
    await reconcilePendingBoards(companyId);
    for (const kind of ['booking', 'contract']) {
      const Model = require(kind === 'booking' ? '../models/CoworkingBooking' : '../models/CoworkingContract');
      const rows = await Model.find({ companyId, billstackSyncPending: true }).limit(100).lean();
      for (const row of rows) await scheduleStructuredSafely(kind, row);
    }
    const now = new Date();
    const jobs = await Job.find({ companyId, $or: [{ status: { $in: ['PENDING', 'FAILED'] }, retryable: { $ne: false }, nextRetryAt: { $lte: now } }, { status: 'PROCESSING', leaseUntil: { $lte: now } }] }).sort({ nextRetryAt: 1, _id: 1 }).limit(20).lean();
    // Bounded concurrency prevents one unavailable provider holding the sweep
    // for many minutes, while each job still has its database lease.
    for (let i = 0; i < jobs.length; i += 4) await Promise.allSettled(jobs.slice(i, i + 4).map(job => processJob(job._id)));
  } finally { running = false; }
}
let workerTimer;
let activeSweep = Promise.resolve();
function startWorker() {
  if (workerTimer) return workerTimer;
  if (!configuredCompany()) return null;
  const run = () => {
    if (!running) activeSweep = sweep().catch(() => require('../config/logger').warn('BillStack worker will retry after an internal failure'));
  };
  workerTimer = setInterval(run, 30000); workerTimer.unref(); run();
  return workerTimer;
}
async function stopWorker() {
  clearInterval(workerTimer); workerTimer = null;
  await activeSweep;
}
module.exports = { schedule, scheduleSafely, processJob, ensureSynced, sweep, startWorker, stopWorker, safeError, scheduleStructuredSafely };
