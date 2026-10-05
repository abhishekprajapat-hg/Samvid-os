const Board = require('../models/CoworkingBoardState');
const { loadEligible, validBookedCabin } = require('../services/billstackCustomer.service');
const { schedule, processJob, ensureSynced, safeError } = require('../services/billstackSync.service');
const { createInvoiceHandoff } = require('../services/billstack.service');
const { getBillstackConfig } = require('../config/billstack');
const { hasPermission } = require('../services/access.service');
const { createHttpError } = require('../utils/httpError');

async function resolveCustomer(req) {
  const companyId = req.user.companyId;
  let type = req.params.type;
  let id = req.params.id;
  if (type === 'lead') {
    if (!await hasPermission(req.user, 'page.leads.view') && !await hasPermission(req.user, 'page.my_leads.view')) throw createHttpError(403, 'Lead access is required');
    const scope = await require('./lead.controller').findAccessibleLeadById({ leadId: id, user: req.user });
    if (!scope) throw createHttpError(404, 'Customer not found');
  } else if (['board', 'coworking-client'].includes(type)) {
    if (!await hasPermission(req.user, 'page.coworking_clients.view') && !await hasPermission(req.user, 'page.coworking_booking.view')) throw createHttpError(403, 'Coworking access is required');
    if (type === 'board') {
      const board = await Board.findOne({ companyId }).lean();
      const cabin = board?.state?.cabins?.find(c => c.code === id);
      if (!validBookedCabin(cabin)) throw createHttpError(409, 'Only booked customers are eligible');
      if (cabin.client.billingIdentityError) throw createHttpError(409, cabin.client.billingIdentityError);
      id = cabin.client.canonicalClientId;
      if (!id) {
        const Client = require('../models/CoworkingClient');
        const phone = String(cabin.client?.phone || '').replace(/\D/g, '');
        const found = await Client.findOne({ companyId, $or: [
          ...(phone ? [{ phone }] : []),
          ...(cabin.client?.email ? [{ email: cabin.client.email.trim().toLowerCase() }] : []),
        ] });
        if (found) id = String(found._id);
      }
      if (!id) throw createHttpError(409, 'Customer identity is pending; save complete customer details and retry');
      type = 'coworking-client';
    }
  } else throw createHttpError(400, 'Invalid customer type');
  return { companyId, type, id, entity: await loadEligible(companyId, type, id) };
}
const handle = (action) => async (req, res) => {
  try {
    const customer = await resolveCustomer(req);
    const { companyId, type, id } = customer;
    if (action === 'handoff') {
      const customerId = await ensureSynced(companyId, type, id);
      const { buildBillingContext } = require('../services/billstackCustomer.service');
      const billingContext = await buildBillingContext(companyId, type, customer.entity);
      return res.json({ handoffUrl: await createInvoiceHandoff(companyId, customerId, billingContext) });
    }
    if (action === 'sync') {
      getBillstackConfig(companyId);
      const job = await schedule(companyId, type, id, true);
      await processJob(job._id);
    }
    const entity = action === 'sync' ? await loadEligible(companyId, type, id) : customer.entity;
    const state = entity.billstack || {};
    return res.status(action === 'sync' && state.syncStatus !== 'SYNCED' ? 202 : 200).json({
      entityType: type, entityId: String(id),
      syncStatus: state.syncStatus || 'NOT_SYNCED', lastSyncedAt: state.lastSyncedAt || null,
      lastSyncError: state.lastSyncError || '',
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: safeError(error) });
  }
};
module.exports = { resolveCustomer, status: handle('status'), sync: handle('sync'), handoff: handle('handoff') };
