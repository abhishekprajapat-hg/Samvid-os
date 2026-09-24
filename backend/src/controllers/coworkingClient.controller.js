const clientService = require("../services/coworkingClient.service");
const clientPortalAuthService = require("../services/clientPortalAuth.service");
const logger = require("../config/logger");
const { handleControllerError: handleError } = require("../utils/httpError");

const handleControllerError = (res, error, message) => handleError(res, error, logger, message);

exports.listClients = async (req, res) => {
  try {
    const { clients, pagination } = await clientService.listClients({
      companyId: req.user.companyId,
      query: req.query,
    });
    return res.json({ clients, pagination });
  } catch (error) {
    return handleControllerError(res, error, "listClients failed");
  }
};

exports.getClient = async (req, res) => {
  try {
    const client = await clientService.getClientById({
      companyId: req.user.companyId,
      clientId: req.params.clientId,
    });
    return res.json({ client });
  } catch (error) {
    return handleControllerError(res, error, "getClient failed");
  }
};

exports.createClient = async (req, res) => {
  try {
    const client = await clientService.createClient({
      companyId: req.user.companyId,
      actingUser: req.user,
      payload: req.body,
    });
    return res.status(201).json({ client });
  } catch (error) {
    return handleControllerError(res, error, "createClient failed");
  }
};

exports.updateClient = async (req, res) => {
  try {
    const client = await clientService.updateClient({
      companyId: req.user.companyId,
      clientId: req.params.clientId,
      payload: req.body,
      actingUser: req.user,
    });
    return res.json({ client });
  } catch (error) {
    return handleControllerError(res, error, "updateClient failed");
  }
};

exports.deleteClient = async (req, res) => {
  try {
    await clientService.deleteClient({
      companyId: req.user.companyId,
      clientId: req.params.clientId,
      actingUser: req.user,
    });
    return res.json({ message: "Client deleted" });
  } catch (error) {
    return handleControllerError(res, error, "deleteClient failed");
  }
};

exports.addContact = async (req, res) => {
  try {
    const client = await clientService.addContact({
      companyId: req.user.companyId,
      clientId: req.params.clientId,
      payload: req.body,
      actingUser: req.user,
    });
    return res.status(201).json({ client });
  } catch (error) {
    return handleControllerError(res, error, "addContact failed");
  }
};

exports.removeContact = async (req, res) => {
  try {
    const client = await clientService.removeContact({
      companyId: req.user.companyId,
      clientId: req.params.clientId,
      contactId: req.params.contactId,
      actingUser: req.user,
    });
    return res.json({ client });
  } catch (error) {
    return handleControllerError(res, error, "removeContact failed");
  }
};

exports.addDocument = async (req, res) => {
  try {
    const client = await clientService.addDocument({
      companyId: req.user.companyId,
      clientId: req.params.clientId,
      payload: req.body,
      actingUser: req.user,
    });
    return res.status(201).json({ client });
  } catch (error) {
    return handleControllerError(res, error, "addDocument failed");
  }
};

exports.removeDocument = async (req, res) => {
  try {
    const client = await clientService.removeDocument({
      companyId: req.user.companyId,
      clientId: req.params.clientId,
      documentId: req.params.documentId,
      actingUser: req.user,
    });
    return res.json({ client });
  } catch (error) {
    return handleControllerError(res, error, "removeDocument failed");
  }
};

exports.getAssignments = async (req, res) => {
  try {
    const assignments = await clientService.getClientAssignments({
      companyId: req.user.companyId,
      clientId: req.params.clientId,
    });
    return res.json({ assignments });
  } catch (error) {
    return handleControllerError(res, error, "getAssignments failed");
  }
};

exports.getActivity = async (req, res) => {
  try {
    const { logs, pagination } = await clientService.getClientActivity({
      companyId: req.user.companyId,
      clientId: req.params.clientId,
      query: req.query,
    });
    return res.json({ logs, pagination });
  } catch (error) {
    return handleControllerError(res, error, "getActivity failed");
  }
};

// ============================================================================
// Client portal login management — staff issue/revoke portal credentials for
// a client's contacts. The credentials themselves live in ClientPortalUser,
// a fully separate collection/auth system (see clientPortalAuth.*).
// ============================================================================
exports.listPortalUsers = async (req, res) => {
  try {
    const portalUsers = await clientPortalAuthService.listPortalUsers({
      companyId: req.user.companyId,
      clientId: req.params.clientId,
    });
    return res.json({ portalUsers });
  } catch (error) {
    return handleControllerError(res, error, "listPortalUsers failed");
  }
};

exports.createPortalUser = async (req, res) => {
  try {
    const portalUser = await clientPortalAuthService.createPortalUser({
      companyId: req.user.companyId,
      clientId: req.params.clientId,
      payload: req.body,
      actingUser: req.user,
    });
    return res.status(201).json({ portalUser });
  } catch (error) {
    return handleControllerError(res, error, "createPortalUser failed");
  }
};

exports.setPortalUserActive = async (req, res) => {
  try {
    const portalUser = await clientPortalAuthService.setPortalUserActive({
      companyId: req.user.companyId,
      clientId: req.params.clientId,
      portalUserId: req.params.portalUserId,
      isActive: req.body?.isActive,
      actingUser: req.user,
    });
    return res.json({ portalUser });
  } catch (error) {
    return handleControllerError(res, error, "setPortalUserActive failed");
  }
};

exports.resetPortalUserPassword = async (req, res) => {
  try {
    const result = await clientPortalAuthService.resetPortalUserPassword({
      companyId: req.user.companyId,
      clientId: req.params.clientId,
      portalUserId: req.params.portalUserId,
      newPassword: req.body?.newPassword,
      actingUser: req.user,
    });
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error, "resetPortalUserPassword failed");
  }
};
