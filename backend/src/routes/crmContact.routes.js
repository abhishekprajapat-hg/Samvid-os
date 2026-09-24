const router = require("express").Router();
const Contact = require("../models/CrmContact");
const { normalizePhone, upsertContact, bulkUpsertContacts, MAX_BULK_CONTACT_ROWS } = require("../services/crmContact.service");
const { requirePageAccess, requirePageActionForMethod } = require("../middleware/pageAccess.middleware");
router.use(require("../middleware/auth.middleware").protect);
router.use(require("../middleware/company.middleware").requireCompanyContext);
router.get("/identify", requirePageAccess("leads"), async (req, res) => {
 try { const phone = normalizePhone(req.query.phone); const contact = phone ? await Contact.findOne({ companyId: req.user.companyId, kind: "BROKER", phone }).select("_id name").lean() : null; res.json({ isBroker: Boolean(contact), contactId: contact?._id || null, name: contact?.name || "" }); }
 catch (error) { req.log?.error(error); res.status(500).json({ message: "Could not identify contact" }); }
});
router.use(requirePageAccess("inventory"), requirePageActionForMethod("inventory"));
// The master contact directory is internal; shared inventory access does not expose it.
router.use((req, res, next) => req.user.role === "CHANNEL_PARTNER" ? res.status(403).json({ message: "Internal contacts only" }) : next());

const parseKind = (value) => (String(value || "").toUpperCase() === "BROKER" ? "BROKER" : "OWNER");

router.get("/", async (req, res) => {
 try {
  const filter = { companyId: req.user.companyId, kind: parseKind(req.query.kind) };
  if (req.query.phone) filter.phone = normalizePhone(req.query.phone);
  if (req.query.search) { const value = String(req.query.search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); filter.$or = [{ name: { $regex: value, $options: "i" } }, { phone: { $regex: value } }, { company: { $regex: value, $options: "i" } }]; }
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const [contacts, total] = await Promise.all([
   Contact.find(filter).select("-blockedLeads").sort({ name: 1 }).skip((page - 1) * 50).limit(50).lean(),
   Contact.countDocuments(filter),
  ]);
  res.json({ contacts, total, page });
 } catch (error) { req.log?.error(error); res.status(500).json({ message: "Failed to load contacts" }); }
});

// The leads this broker's number was refused on, newest first.
router.get("/:contactId/blocked-leads", async (req, res) => {
 try {
  if (!/^[a-f0-9]{24}$/i.test(req.params.contactId)) return res.status(400).json({ message: "Invalid contact" });
  const contact = await Contact.findOne({ _id: req.params.contactId, companyId: req.user.companyId }).select("name phone blockedLeads blockedLeadCount").lean();
  if (!contact) return res.status(404).json({ message: "Contact not found" });
  res.json({ ...contact, blockedLeads: [...(contact.blockedLeads || [])].reverse() });
 } catch (error) { req.log?.error(error); res.status(500).json({ message: "Failed to load blocked leads" }); }
});

router.post("/", require("../middleware/rateLimit.middleware").writeLimiter, async (req, res) => {
 try {
  const { kind, name, phone, email, notes, propertyDetails, company, city } = req.body;
  if (!["OWNER", "BROKER"].includes(kind) || !String(name || "").trim() || !normalizePhone(phone)) return res.status(400).json({ message: "Name, valid phone and contact type are required" });
  const contact = await upsertContact({ companyId: req.user.companyId, kind, name, phone, email, notes, propertyDetails, company, city, actor: req.user._id });
  res.json(contact);
 } catch (error) { req.log?.error(error); res.status(500).json({ message: "Failed to save contact" }); }
});

router.post("/bulk", require("../middleware/rateLimit.middleware").writeLimiter, async (req, res) => {
 try {
  const kind = parseKind(req.body?.kind);
  if (!["OWNER", "BROKER"].includes(String(req.body?.kind || "").toUpperCase())) return res.status(400).json({ message: "Contact type must be OWNER or BROKER" });
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ message: "No rows found in the uploaded file" });
  if (rows.length > MAX_BULK_CONTACT_ROWS) return res.status(400).json({ message: `Bulk upload limit exceeded (max ${MAX_BULK_CONTACT_ROWS} rows)` });
  res.json(await bulkUpsertContacts({ companyId: req.user.companyId, kind, rows, actor: req.user._id }));
 } catch (error) { req.log?.error(error); res.status(500).json({ message: "Bulk upload failed" }); }
});

router.delete("/:contactId", require("../middleware/rateLimit.middleware").writeLimiter, async (req, res) => {
 try {
  if (!/^[a-f0-9]{24}$/i.test(req.params.contactId)) return res.status(400).json({ message: "Invalid contact" });
  const deleted = await Contact.findOneAndDelete({ _id: req.params.contactId, companyId: req.user.companyId });
  if (!deleted) return res.status(404).json({ message: "Contact not found" });
  res.json({ message: "Contact removed", contactId: deleted._id });
 } catch (error) { req.log?.error(error); res.status(500).json({ message: "Failed to remove contact" }); }
});

module.exports = router;
