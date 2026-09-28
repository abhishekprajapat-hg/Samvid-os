/* Read-only reporting: raw collections avoid Mongoose hooks/index creation.
 * Run from backend: node scripts/billstack-dry-run.cjs --company <ObjectId>
 */
const mongoose = require('mongoose');
const { customerPayload, externalId, validBookedCabin } = require('../src/services/billstackCustomer.service');
const { identityData } = require('../src/services/coworkingBoardIdentity.service');

function preview(payload) {
  return { ...payload, phone: payload.phone ? `***${payload.phone.slice(-4)}` : '', email: payload.email ? '[redacted]' : '', billingAddress: payload.billingAddress ? '[redacted]' : '', gstNumber: payload.gstNumber ? `***${payload.gstNumber.slice(-4)}` : '' };
}
async function report(db, companyId) {
  const output = { companyId: String(companyId), eligible: [], excluded: [], ambiguous: [], missingRequiredData: [], duplicateIdentities: [], alreadySynced: [], structuredCoworking: [] };
  const seen = new Map();
  const contacts = new Map();
  function record(type, entity, source, reason = '') {
    const id = externalId(companyId, type, entity._id);
    try {
      const payload = customerPayload(companyId, type, entity);
      const row = { source, crmId: String(entity._id), externalId: id, payload: preview(payload) };
      if (seen.has(id)) { output.duplicateIdentities.push({ externalId: id, sources: [seen.get(id), source] }); return; }
      seen.set(id, source);
      for (const field of ['phone', 'email', 'gstNumber']) {
        const value = String(payload[field] || '').trim().toLowerCase();
        if (!value) continue;
        const key = `${field}:${value}`;
        if (contacts.has(key) && contacts.get(key) !== id) {
          reason ||= 'Shared contact or tax identity requires review before importing';
          output.duplicateIdentities.push({ externalIds: [contacts.get(key), id], reason: `Shared ${field}; no automatic merge` });
        } else contacts.set(key, id);
      }
      if (reason) output.ambiguous.push({ ...row, reason }); else output.eligible.push(row);
      if (entity.billstack?.customerId) output.alreadySynced.push({ externalId: id, syncStatus: entity.billstack.syncStatus });
    } catch { output.missingRequiredData.push({ source, crmId: String(entity._id), reason: 'Name and phone or email required' }); }
  }
  for await (const lead of db.collection('leads').find({ companyId, status: 'CLOSED' })) {
    let reason = '';
    if (['PENDING', 'REJECTED'].includes(lead.dealPayment?.approvalStatus) || !lead.brokerageClosedAt || !lead.brokerageClosedBy || lead.brokerageReceived == null) {
      reason = 'Review closure/payment evidence';
    }
    record('lead', lead, 'lead', reason);
  }
  output.excluded.push({ source: 'lead', reason: 'Not CLOSED', count: await db.collection('leads').countDocuments({ companyId, status: { $ne: 'CLOSED' } }) });
  const board = await db.collection('coworkingboardstates').findOne({ companyId });
  const legacy = new Map();
  for (const cabin of board?.state?.cabins || []) {
    if (!validBookedCabin(cabin)) { output.excluded.push({ source: 'board', cabin: cabin.code, reason: 'Not BOOKED or incomplete agreement' }); continue; }
    try { identityData(cabin); } catch { output.missingRequiredData.push({ source: 'board', cabin: cabin.code, reason: 'Complete contact details before resolving identity' }); continue; }
    if (cabin.client.billingIdentityVerified !== true || !cabin.client.canonicalClientId || !mongoose.isValidObjectId(cabin.client.canonicalClientId)) {
      const key = cabin.client.identityKey || JSON.stringify([cabin.contract.id, identityData(cabin)]);
      if (legacy.has(key)) output.duplicateIdentities.push({ source: 'board', cabins: [legacy.get(key), cabin.code], reason: 'Same unresolved customer across cabins' });
      legacy.set(key, cabin.code);
      output.ambiguous.push({ source: 'board', cabin: cabin.code, proposedExternalId: 'toor:<companyId>:coworking-client:<canonical-id-required>', reason: 'Canonical identity requires review; no record created', payload: preview({ name: cabin.client.name, phone: cabin.client.phone || '', email: cabin.client.email || '', gstNumber: cabin.client.gstin || '', billingAddress: '' }) });
      continue;
    }
    const client = await db.collection('coworkingclients').findOne({ _id: new mongoose.Types.ObjectId(cabin.client.canonicalClientId), companyId });
    if (client) record('coworking-client', client, `board:${cabin.code}`);
    else output.ambiguous.push({ source: 'board', cabin: cabin.code, reason: 'Canonical client not found in company' });
  }
  for (const [collection, statuses] of [['coworkingbookings', ['ACTIVE', 'COMPLETED']], ['coworkingcontracts', ['ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED']]]) {
    for await (const row of db.collection(collection).find({ companyId, status: { $in: statuses } })) {
      const client = await db.collection('coworkingclients').findOne({ _id: row.clientId, companyId });
      let payload = null;
      try { if (client) payload = preview(customerPayload(companyId, 'coworking-client', client)); } catch { /* reported separately below */ }
      output.structuredCoworking.push({ source: collection, recordId: String(row._id), clientId: String(row.clientId), proposedExternalId: externalId(companyId, 'coworking-client', row.clientId), overlapsBoard: seen.has(externalId(companyId, 'coworking-client', row.clientId)), missingRequiredData: !payload, alreadySynced: Boolean(client?.billstack?.customerId), payload });
    }
  }
  return output;
}
async function main() {
  require('dotenv').config({ quiet: true });
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--company' || !/^[a-f\d]{24}$/i.test(args[1])) throw new Error('Usage: node scripts/billstack-dry-run.cjs --company <ObjectId>');
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false });
  try { console.log(JSON.stringify(await report(mongoose.connection.db, new mongoose.Types.ObjectId(args[1])), null, 2)); }
  finally { await mongoose.disconnect(); }
}
if (require.main === module) main().catch(() => { console.error('Dry run failed. Check company argument and database configuration.'); process.exitCode = 1; });
module.exports = { report, preview };
