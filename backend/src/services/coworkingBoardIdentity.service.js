const { createHash } = require('node:crypto');
const Client = require('../models/CoworkingClient');
const Board = require('../models/CoworkingBoardState');
const { validBookedCabin } = require('./billstackCustomer.service');
const { scheduleSafely } = require('./billstackSync.service');
const { createHttpError } = require('../utils/httpError');
const { isBillstackEnabled } = require('../config/billstack');

// Preserve server-owned bindings even when older clients omit response metadata.
function preserveBindings(cabins, previous = [], companyId) {
  return cabins.map(cabin => {
    if (!cabin?.client || typeof cabin.client !== 'object' || Array.isArray(cabin.client)) return cabin;
    const old = previous.find(item => item.code === cabin.code);
    const same = old?.client && (old.client.identityKey
      ? (!cabin.client.identityKey || cabin.client.identityKey === old.client.identityKey) && cabin.client.id === old.client.id
      : (old.client.id && old.client.id === cabin.client.id) || (old.contract?.id === cabin.contract?.id && old.client.name === cabin.client.name));
    const client = { ...cabin.client, billingIdentityVerified: false, billingBindingEstablished: false, billingBindingConflict: false };
    delete client.billingIdentityError;
    if (same) {
      client.identityKey = old.client.identityKey || client.identityKey;
      if (old.client.canonicalClientId && (old.client.billingBindingEstablished === true || old.client.billingIdentityVerified === true)) {
        client.billingBindingConflict = Boolean(client.canonicalClientId && client.canonicalClientId !== old.client.canonicalClientId);
        client.canonicalClientId = old.client.canonicalClientId;
        client.billingBindingEstablished = old.client.billingBindingEstablished === true || old.client.billingIdentityVerified === true;
      }
    }
    if (!client.identityKey) {
      const source = same ? old : cabin;
      client.identityKey = createHash('sha256').update(JSON.stringify([String(companyId), source.contract?.id, source.client?.id, source.client?.name, source.client?.phone, source.client?.email])).digest('hex');
    }
    return { ...cabin, client };
  });
}

function identityData(cabin) {
  const c = cabin.client;
  const name = String(c.name || '').trim();
  const phone = String(c.phone || '').replace(/\D/g, '');
  const email = String(c.email || '').trim().toLowerCase();
  if (!name || (!phone && !email) || (phone && !/^\d{10}$/.test(phone))) throw createHttpError(409, 'Complete the booked customer name and valid phone or email');
  const data = { companyName: name, phone, email, contactPerson: String(c.contactPerson || '').trim(), gstNumber: String(c.gstin || '').trim().toUpperCase() };
  if (Object.prototype.hasOwnProperty.call(c, 'address')) {
    const address = typeof c.address === 'string' ? { line1: c.address } : c.address || {};
    data.address = Object.fromEntries(['line1', 'line2', 'city', 'state', 'pincode', 'country'].map(key => [key, String(address[key] || '').trim()]));
  }
  return data;
}
function compatible(client, data) {
  return client.companyName.trim().toLowerCase() === data.companyName.toLowerCase()
    && ['phone', 'email', 'gstNumber'].every(k => !client[k] || !data[k] || client[k].toLowerCase() === data[k].toLowerCase());
}
async function resolveClient(companyId, cabin, actorId, version = 0) {
  const data = identityData(cabin);
  if (cabin.client.identityKey != null && (typeof cabin.client.identityKey !== 'string' || !/^[a-z\d_-]{1,128}$/i.test(cabin.client.identityKey))) throw createHttpError(409, 'Invalid customer identity key');
  if (cabin.client.billingBindingConflict) throw createHttpError(409, 'Cannot replace an established customer binding');
  if (cabin.client.canonicalClientId) {
    if (!/^[a-f\d]{24}$/i.test(String(cabin.client.canonicalClientId))) throw createHttpError(409, 'Invalid canonical customer reference');
    const found = await Client.findOne({ _id: cabin.client.canonicalClientId, companyId });
    if (!found || (!cabin.client.billingBindingEstablished && !compatible(found, data))) throw createHttpError(409, 'Customer identity conflicts; review the canonical client');
    return updateBoundClient(found, data, companyId, actorId, version, cabin.client.billingBindingEstablished === true);
  }
  // Match by verified-looking GST plus matching details, never by name/phone alone.
  if (data.gstNumber) {
    const found = await Client.findOne({ companyId, gstNumber: data.gstNumber });
    if (found) {
      if (!compatible(found, data)) throw createHttpError(409, 'GST customer details conflict; review before billing');
      return updateBoundClient(found, data, companyId, actorId, version, false);
    }
  }
  // New boards use a random identityKey. Legacy entries are grouped only by
  // agreement AND full contact details, not the old name-derived client.id.
  const key = cabin.client.identityKey || JSON.stringify([cabin.contract.id, data]);
  const id = createHash('sha256').update(`${companyId}:${key}`).digest('hex').slice(0, 24);
  let found = await Client.findOne({ _id: id, companyId });
  if (!found) {
    const contactMatch = await Client.findOne({ companyId, $or: [
      ...(data.phone ? [{ phone: data.phone }] : []),
      ...(data.email ? [{ email: data.email }] : []),
    ] });
    if (contactMatch) throw createHttpError(409, 'An existing customer shares these contact details; link the canonical client explicitly after review');
    try { found = await Client.create({ _id: id, companyId, clientCode: `BOARD-${id}`, ...data, status: 'ACTIVE', createdBy: actorId }); }
    catch (error) { if (error.code !== 11000) throw error; found = await Client.findOne({ _id: id, companyId }); }
  }
  if (!found || !compatible(found, data)) throw createHttpError(409, 'Customer identity conflicts; review before billing');
  return updateBoundClient(found, data, companyId, actorId, version);
}

async function updateBoundClient(found, data, companyId, actorId, version, allowClear = true) {
  const identifiers = ['phone', 'email', 'gstNumber'].filter(key => data[key]).map(key => ({ [key]: data[key] }));
  const conflict = await Client.findOne({ companyId, _id: { $ne: found._id }, $or: identifiers });
  if (conflict) throw createHttpError(409, 'Customer identifiers belong to another canonical customer');
  const sourceHash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  // Do not overwrite a newer board edit or repeatedly overwrite structured
  // client edits when the board's customer fields have not changed.
  if (found.billstack?.boardVersion > version) throw createHttpError(409, 'A newer customer edit is being processed');
  if (found.billstack?.boardSourceHash === sourceHash) {
    await Client.updateOne({ _id: found._id, companyId, 'billstack.boardVersion': { $lte: version } }, { $set: { 'billstack.boardVersion': version } }, { timestamps: false });
    return found;
  }
  const updates = allowClear ? data : Object.fromEntries(Object.entries(data).filter(([, value]) => typeof value === 'object' ? Object.values(value).some(Boolean) : Boolean(value)));
  const result = await Client.updateOne({ _id: found._id, companyId, $or: [
    { 'billstack.boardVersion': { $exists: false } }, { 'billstack.boardVersion': { $lte: version } },
  ] }, { $set: { ...updates, updatedBy: actorId, 'billstack.boardVersion': version, 'billstack.boardSourceHash': sourceHash, 'billstack.syncStatus': 'PENDING' } }, { runValidators: true });
  if (result && !result.matchedCount) throw createHttpError(409, 'A newer customer edit is being processed');
  return found;
}

async function bridgeSavedBoard(row) {
  if (!row?.billingBridgePending || !isBillstackEnabled(row.companyId)) return row;
  const state = JSON.parse(JSON.stringify(row.state));
  const ids = new Set();
  let transientFailure = false;
  const groups = new Map();
  for (const cabin of state.cabins || []) {
    if (!validBookedCabin(cabin)) continue;
    const key = cabin.client.canonicalClientId || cabin.client.identityKey || cabin.contract.id;
    const members = groups.get(key) || [];
    members.push(cabin); groups.set(key, members);
  }
  const conflicts = new Set();
  for (const members of groups.values()) {
    try { if (new Set(members.map(cabin => JSON.stringify(identityData(cabin)))).size > 1) members.forEach(cabin => conflicts.add(cabin)); }
    catch { members.forEach(cabin => conflicts.add(cabin)); }
  }
  for (const cabin of state.cabins || []) {
    if (!validBookedCabin(cabin)) continue;
    try {
      if (conflicts.has(cabin)) throw createHttpError(409, 'Conflicting customer details across cabins');
      const client = await resolveClient(row.companyId, cabin, row.updatedBy, row.version);
      cabin.client.canonicalClientId = String(client._id);
      cabin.client.billingIdentityVerified = true;
      cabin.client.billingBindingEstablished = true;
      delete cabin.client.billingIdentityError;
      ids.add(String(client._id));
    } catch (error) {
      cabin.client.billingIdentityVerified = false;
      const transient = ![400, 409].includes(error.statusCode) && error.name !== 'ValidationError' && error.name !== 'CastError';
      if (transient) transientFailure = true;
      // A bad edit must not erase the customer's established identity.
      cabin.client.billingIdentityError = 'Customer identity needs review or complete contact details before billing';
    }
  }
  // CAS again: never overwrite a board edited while identities were resolved.
  const saved = await Board.findOneAndUpdate({ _id: row._id, version: row.version }, {
    $set: { state, billingBridgePending: true },
  }, { new: true, timestamps: false });
  if (!saved) return row;
  let scheduled = !transientFailure;
  for (const id of ids) {
    try {
      await Client.updateOne({ _id: id, companyId: row.companyId }, { $set: { 'billstack.syncStatus': 'PENDING' } });
      if (!await scheduleSafely(row.companyId, 'coworking-client', id)) scheduled = false;
    } catch { scheduled = false; }
  }
  if (scheduled) {
    try { await Board.updateOne({ _id: saved._id, version: saved.version }, { $set: { billingBridgePending: false } }); }
    catch { /* Keep the marker, but return the version we already persisted. */ }
  }
  return saved;
}
async function bridgeSafely(row) {
  try { return await bridgeSavedBoard(row); } catch { return row; }
}
async function reconcilePendingBoards(companyId) {
  const rows = await Board.find({ companyId, billingBridgePending: true }).limit(20);
  for (const row of rows) await bridgeSafely(row);
}
module.exports = { identityData, compatible, resolveClient, bridgeSavedBoard, bridgeSafely, reconcilePendingBoards, preserveBindings };
