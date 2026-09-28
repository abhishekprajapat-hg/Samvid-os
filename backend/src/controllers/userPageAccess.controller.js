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
    const billingOnly = req.user.role === 'MANAGER';
    if (billingOnly) {
      const team = await require('../services/hierarchy.service').getDescendantUsers({ rootUserId: req.user._id, companyId: req.user.companyId });
      if (['ADMIN', 'MANAGER'].includes(user.role) || !team.some(member => String(member._id) === String(user._id))) return res.status(403).json({ message: 'Managers can grant Billing only to employees in their reporting team' });
    }
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
      const billingPatch = billingOnly || req.body?.scope === 'billing';
      const before = billingPatch ? user.pageActionOverrides?.billing : user.pageAccessOverride;
      if (billingPatch) {
        if (!hasActionPayload || entries === null || entries.some(entry => entry.pageKey !== 'billing')) return res.status(403).json({ message: 'Managers may change Billing access only' });
        const actorAccess = await resolveAccessProfile(req.user);
        if (entries.some(entry => ['view', ...entry.actions].some(action => !actorAccess.permissions.includes(`page.billing.${action}`)))) return res.status(403).json({ message: 'You cannot grant Billing actions you do not hold' });
        const actions = [...new Set(entries.flatMap(entry => ['view', ...entry.actions]))];
        // A field-level update cannot overwrite concurrent unrelated grants or
        // turn inherited role defaults into a frozen full override.
        await User.updateOne({ _id: user._id, companyId: req.user.companyId }, { $set: { 'pageActionOverrides.billing': actions } });
        user.pageActionOverrides = { ...user.pageActionOverrides, billing: actions };
      } else {
        user.pageAccessOverride = entries === null
        ? null
        : (hasActionPayload
          ? [...new Map(entries.map((entry) => [entry.pageKey, entry])).values()]
          : [...new Set(entries)]);
        user.pageActionOverrides = {};
        await user.save();
      }
      invalidateAccessCache();
      await writeAuditLog({ companyId: req.user.companyId, actor: req.user, action: "USER_PAGE_ACCESS_UPDATED", entityType: "User", entityId: user._id, metadata: { before, after: billingPatch ? user.pageActionOverrides.billing : user.pageAccessOverride, scope: billingPatch ? 'billing' : 'all' }, req });
    }
    const access = await resolveAccessProfile(user);
    return res.json({
      pages: billingOnly ? CRM_PAGES.filter(page => page.key === 'billing') : CRM_PAGES,
      pageKeys: access.pages.map((page) => page.pageKey),
      pageAccess: access.pages,
      usesRoleDefaults: user.pageAccessOverride === null,
      billingOnly,
    });
  } catch (error) {
    req.log?.error({ error: error.message }, "Employee page access failed");
    return res.status(500).json({ message: "Unable to update employee page access" });
  }
};
