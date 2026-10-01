const axios = require('axios');
const { getBillstackConfig } = require('../config/billstack');
const { createHttpError } = require('../utils/httpError');

// The supplied contract does not specify the customer response envelope.
// Keep compatibility handling here; never infer an ID from an arbitrary field.
function parseCustomerResponse(body) {
  const data = body?.data || body;
  const id = data?.customerId || data?.customer?.id || data?.customer?._id;
  if (typeof id !== 'string' || !id.trim() || id.length > 200) {
    throw Object.assign(createHttpError(502, 'BillStack returned an invalid customer response'), { retryable: false });
  }
  return id.trim();
}
async function post(companyId, path, payload) {
  const config = getBillstackConfig(companyId);
  try {
    const response = await axios.post(`${config.baseUrl}${path}`, payload, {
      headers: { 'X-Billstack-Api-Key': config.apiKey }, timeout: 15000,
      maxRedirects: 0, maxContentLength: 1024 * 1024,
    });
    return response.data;
  } catch (error) {
    // Do not propagate Axios errors: they include headers and remote bodies.
    const status = Number(error?.response?.status);
    const retryable = !status || status === 408 || status === 429 || status >= 500;
    const message = status === 401 || status === 403 ? 'BillStack rejected integration authentication'
      : status === 409 ? 'BillStack customer identity conflicts; review customer details'
        : status === 400 || status === 422 ? 'BillStack rejected customer data; correct the details before retrying'
          : retryable ? 'BillStack is unavailable; retry shortly' : 'BillStack rejected the request; review integration configuration';
    const failure = createHttpError(retryable ? 502 : 409, message);
    failure.retryable = retryable;
    const retryAfter = error?.response?.headers?.['retry-after'];
    const delay = /^\d+$/.test(String(retryAfter)) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now();
    if (status === 429 && Number.isFinite(delay)) failure.retryAfterMs = Math.min(86400000, Math.max(30000, delay));
    throw failure;
  }
}
async function upsertCustomer(companyId, payload) {
  return parseCustomerResponse(await post(companyId, '/api/integrations/customers/upsert', payload));
}
async function createInvoiceHandoff(companyId, customerId, billingContext = null) {
  const payload = { customerId };
  if (billingContext) payload.billingContext = billingContext;
  const body = await post(companyId, '/api/integrations/handoffs/invoice', payload);
  const handoffUrl = (body?.data || body)?.handoffUrl;
  let url;
  try { url = new URL(handoffUrl); } catch { throw createHttpError(502, 'BillStack returned an invalid handoff'); }
  if (url.origin !== getBillstackConfig(companyId).frontendOrigin || url.username || url.password) {
    throw createHttpError(502, 'BillStack returned an invalid handoff');
  }
  return url.href;
}
module.exports = { upsertCustomer, createInvoiceHandoff, parseCustomerResponse };
