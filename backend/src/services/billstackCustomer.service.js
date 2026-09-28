const crypto = require('node:crypto');
const Lead = require('../models/Lead');
const Client = require('../models/CoworkingClient');
const Board = require('../models/CoworkingBoardState');
const Booking = require('../models/CoworkingBooking');
const Contract = require('../models/CoworkingContract');
const { createHttpError } = require('../utils/httpError');
const externalId = (companyId, type, id) => `toor:${String(companyId).toLowerCase()}:${type}:${String(id).toLowerCase()}`;
const modelFor = (type) => type === 'lead' ? Lead : type === 'coworking-client' ? Client : null;
const validBookedCabin = (cabin) => cabin?.status === 'BOOKED'
  && Boolean(String(cabin.client?.name || '').trim())
  && Boolean(String(cabin.contract?.id || '').trim())
  && Number.isFinite(Date.parse(cabin.contract?.startDate))
  && Number.isFinite(Date.parse(cabin.contract?.endDate))
  && Date.parse(cabin.contract.endDate) >= Date.parse(cabin.contract.startDate);
async function loadEligible(companyId, type, id) {
  const Model = modelFor(type);
  if (!Model || !/^[a-f\d]{24}$/i.test(String(id))) throw createHttpError(400, 'Invalid customer');
  const entity = await Model.findOne({ _id: id, companyId }).lean();
  if (!entity) throw createHttpError(404, 'Customer not found');
  id = entity._id;
  if (type === 'lead') {
    if (entity.status !== 'CLOSED') throw createHttpError(409, 'Only closed customers are eligible');
  } else {
    const board = await Board.findOne({ companyId }).lean();
    const booked = board?.state?.cabins?.some(c => validBookedCabin(c) && c.client.billingIdentityVerified === true && !c.client.billingIdentityError && String(c.client.canonicalClientId) === String(id));
    const operational = booked || await Booking.exists({ companyId, clientId: id, status: { $in: ['ACTIVE', 'COMPLETED'] } })
      || await Contract.exists({ companyId, clientId: id, status: { $in: ['ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED'] } });
    if (!operational) throw createHttpError(409, 'Customer has no eligible booking or contract');
  }
  return entity;
}
function customerPayload(companyId, type, entity) {
  const address = entity.address || {};
  const payload = {
    externalId: externalId(companyId, type, entity._id), source: 'THE_OFFICE_ON_RENT_CRM',
    name: String(type === 'lead' ? entity.name || '' : entity.companyName || '').trim(),
    phone: String(entity.phone || '').trim(), email: String(entity.email || '').trim(),
    billingAddress: type === 'lead' ? '' : ['line1', 'line2', 'city', 'state', 'pincode', 'country'].map(k => address[k]).filter(Boolean).join(', '),
    gstNumber: String(entity.gstNumber || '').trim(),
  };
  if (!payload.name || (!payload.phone && !payload.email)) throw createHttpError(409, 'Customer needs a name and phone or email before billing');
  return payload;
}
const fingerprint = (payload) => crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
module.exports = { externalId, modelFor, validBookedCabin, loadEligible, customerPayload, fingerprint };
