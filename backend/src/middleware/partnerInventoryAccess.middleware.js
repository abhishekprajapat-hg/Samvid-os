/*
 * A Channel Partner sees inventory and projects only while an Admin or Manager
 * has switched "inventory access" on for that partner (User.canViewInventory).
 * The switch used to hide menu links only; the API still answered, so a
 * partner with access off could read every property and project. This gate
 * makes the switch real on the server.
 */
const requirePartnerInventoryAccess = (req, res, next) => {
  const role = String(req.user?.role || "").trim().toUpperCase();
  if (role === "CHANNEL_PARTNER" && !req.user?.canViewInventory) {
    return res.status(403).json({
      message: "Inventory access is turned off for your account. Ask your Admin or Manager to turn it on.",
      inventoryAccessDisabled: true,
    });
  }
  return next();
};

module.exports = { requirePartnerInventoryAccess };
