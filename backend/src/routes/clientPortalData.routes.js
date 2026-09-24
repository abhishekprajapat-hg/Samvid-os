const express = require("express");
const router = express.Router();

const portalDataController = require("../controllers/clientPortalData.controller");
const { protectClientPortal } = require("../middleware/clientPortalAuth.middleware");

router.use(protectClientPortal);

router.get("/me/client", portalDataController.getMyClientProfile);
router.get("/invoices", portalDataController.getMyInvoices);
router.get("/invoices/:invoiceId", portalDataController.getMyInvoiceById);
router.get("/bookings", portalDataController.getMyBookings);
router.get("/contracts", portalDataController.getMyContracts);
router.get("/contracts/:contractId", portalDataController.getMyContractById);
router.get("/documents", portalDataController.getMyDocuments);

module.exports = router;
