// Read-only views for the client portal. Every function here is scoped to
// exactly one client (never the whole company) — the caller always passes
// the clientId taken from the authenticated portal token
// (req.portalUser.clientId), never from client-supplied input, so a portal
// user can never widen their own query to see another client's data.
const clientService = require("./coworkingClient.service");
const { listInvoices, getInvoiceById } = require("./coworkingInvoice.service");
const { listBookings } = require("./coworkingBooking.service");
const { listContracts, getContractById } = require("./coworkingContract.service");
const { createHttpError } = require("../utils/httpError");

const getMyClientProfile = async ({ companyId, clientId }) =>
  clientService.getClientById({ companyId, clientId });

const getMyInvoices = async ({ companyId, clientId, query }) =>
  listInvoices({ companyId, query: { ...query, clientId } });

const getMyInvoiceById = async ({ companyId, clientId, invoiceId }) => {
  const invoice = await getInvoiceById({ companyId, invoiceId });
  if (String(invoice.clientId?._id || invoice.clientId) !== String(clientId)) {
    throw createHttpError(404, "Invoice not found");
  }
  return invoice;
};

const getMyBookings = async ({ companyId, clientId, query }) =>
  listBookings({ companyId, query: { ...query, clientId } });

const getMyContracts = async ({ companyId, clientId, query }) =>
  listContracts({ companyId, query: { ...query, clientId } });

const getMyContractById = async ({ companyId, clientId, contractId }) => {
  const contract = await getContractById({ companyId, contractId });
  if (String(contract.clientId?._id || contract.clientId) !== String(clientId)) {
    throw createHttpError(404, "Contract not found");
  }
  return contract;
};

// Documents live in two places (client-level KYC/agreements, and per-contract
// documents) — the portal presents both as one combined, read-only list
// rather than requiring the client to know which bucket a file is in.
const getMyDocuments = async ({ companyId, clientId }) => {
  const client = await clientService.getClientById({ companyId, clientId });
  const { contracts } = await listContracts({ companyId, query: { clientId, limit: 100 } });

  const clientDocuments = (client.documents || []).map((doc) => ({
    ...doc,
    source: "CLIENT",
    sourceLabel: client.companyName,
  }));

  const contractDocuments = [];
  for (const summary of contracts) {
    // eslint-disable-next-line no-await-in-loop
    const full = await getContractById({ companyId, contractId: summary._id });
    for (const doc of full.documents || []) {
      contractDocuments.push({ ...doc, source: "CONTRACT", sourceLabel: full.contractCode });
    }
  }

  return [...clientDocuments, ...contractDocuments].sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt),
  );
};

module.exports = {
  getMyClientProfile,
  getMyInvoices,
  getMyInvoiceById,
  getMyBookings,
  getMyContracts,
  getMyContractById,
  getMyDocuments,
};
