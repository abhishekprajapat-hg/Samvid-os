const { createHttpError } = require('../utils/httpError');

function getBillstackConfig(companyId) {
  const base = String(process.env.BILLSTACK_BASE_URL || '').trim();
  const apiKey = String(process.env.BILLSTACK_API_KEY || '').trim();
  const boundCompany = String(process.env.BILLSTACK_COMPANY_ID || '').trim();
  if (!/^[a-f\d]{24}$/i.test(boundCompany)) throw createHttpError(503, 'BillStack requires an explicit company binding');
  if (!companyId || boundCompany.toLowerCase() !== String(companyId).toLowerCase()) {
    throw createHttpError(403, 'BillStack is not enabled for this company');
  }
  let url;
  try { url = new URL(base); } catch { throw createHttpError(503, 'BillStack is not configured'); }
  if (!apiKey || /[\r\n]/.test(apiKey) || url.username || url.password || url.search || url.hash
    || (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
    throw createHttpError(503, 'BillStack configuration is invalid');
  }
  let frontend;
  try { frontend = new URL(String(process.env.BILLSTACK_FRONTEND_URL || '').trim()); } catch { throw createHttpError(503, 'BillStack frontend URL is required'); }
  if (frontend.username || frontend.password || frontend.search || frontend.hash || frontend.pathname !== '/'
    || (frontend.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && frontend.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(frontend.hostname)))) {
    throw createHttpError(503, 'BillStack frontend configuration is invalid');
  }
  return { baseUrl: url.href.replace(/\/$/, ''), origin: url.origin, frontendOrigin: frontend.origin, apiKey, companyId: boundCompany.toLowerCase() };
}
function configuredCompany() {
  try { return getBillstackConfig(process.env.BILLSTACK_COMPANY_ID).companyId; } catch { return null; }
}
function isBillstackEnabled(companyId) {
  try { getBillstackConfig(companyId); return true; } catch { return false; }
}
module.exports = { getBillstackConfig, configuredCompany, isBillstackEnabled };
