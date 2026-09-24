const mongoose = require("mongoose");
const User = require("../models/User");
const {
  CRM_PAGES,
  isValidPageKey,
  isValidPageAction,
} = require("../constants/page.constants");
const { resolveAccessProfile, invalidateAccessCache } = require("../services/access.service");
const { writeAuditLog } = require("../services/auditLog.service");

exports.handle = (update = false) => async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) return res.status(400).json({ message: "Invalid employee" });
    const user = await User.findOne({ _id: req.params.userId, companyId: req.user.companyId });
    if (!user) return res.status(404).json({ message: "Employee not found" });
    if (update) {
      if (user.role === "ADMIN") return res.status(400).json({ message: "Admins always have access to all pages" });
      const hasActionPayload = Object.prototype.hasOwnProperty.call(req.body || {}, "pageAccess");
      const rawAccess = hasActionPayload ? req.body.pageAccess : req.body.pageKeys;
      if (rawAccess !== null && !Array.isArray(rawAccess)) {
        return res.status(400).json({ message: "Choose valid pages or use role defaults" });
      }
      const entries = rawAccess === null ? null : rawAccess.map((entry) => {
        if (!hasActionPayload && typeof entry === "string") return isValidPageKey(entry) ? entry : null;
        const pageKey = String(entry?.pageKey || "").trim();
        const actions = Array.isArray(entry?.actions) ? [...new Set(entry.actions)] : [];
        if (!isValidPageKey(pageKey) || actions.some((action) => !isValidPageAction(pageKey, action))) {
          return null;
        }
        return { pageKey, actions };
      });
      if (entries?.some((entry) => !entry)) {
        return res.status(400).json({ message: "Choose valid pages and actions or use role defaults" });
      }
      const before = user.pageAccessOverride;
      user.pageAccessOverride = entries === null
        ? null
        : (hasActionPayload
          ? [...new Map(entries.map((entry) => [entry.pageKey, entry])).values()]
          : [...new Set(entries)]);
      await user.save();
      invalidateAccessCache();
      await writeAuditLog({ companyId: req.user.companyId, actor: req.user, action: "USER_PAGE_ACCESS_UPDATED", entityType: "User", entityId: user._id, metadata: { before, after: user.pageAccessOverride }, req });
    }
    const access = await resolveAccessProfile(user);
    return res.json({
      pages: CRM_PAGES,
      pageKeys: access.pages.map((page) => page.pageKey),
      pageAccess: access.pages,
      usesRoleDefaults: user.pageAccessOverride === null,
    });
  } catch (error) {
    req.log?.error({ error: error.message }, "Employee page access failed");
    return res.status(500).json({ message: "Unable to update employee page access" });
  }
};
