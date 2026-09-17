const router = require("express").Router();
const BoardState = require("../models/CoworkingBoardState");
const { requirePermission } = require("../middleware/permission.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

// A floor of 65 cabins with their activity log; generous, but a hard ceiling so
// a runaway client cannot grow the document without bound.
const MAX_STATE_BYTES = 4 * 1024 * 1024;
const MAX_ACTIVITY_ENTRIES = 200;

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

router.get("/", requirePermission("cabins.view"), async (req, res) => {
  try {
    const row = await BoardState.findOne({ companyId: req.user.companyId }).lean();
    res.json({
      state: row?.state || { cabins: [], activity: [] },
      version: row?.version || 0,
      updatedAt: row?.updatedAt || null,
      updatedByName: row?.updatedByName || "",
    });
  } catch (error) {
    req.log?.error(error);
    res.status(500).json({ message: "Could not load the booking board" });
  }
});

router.put("/", writeLimiter, requirePermission("cabins.update"), async (req, res) => {
  try {
    const state = req.body?.state;
    if (!isPlainObject(state) || !Array.isArray(state.cabins)) {
      return res.status(400).json({ message: "A board state with a cabins array is required" });
    }
    if (Buffer.byteLength(JSON.stringify(state), "utf8") > MAX_STATE_BYTES) {
      return res.status(413).json({ message: "The board is too large to save" });
    }

    const trimmed = {
      cabins: state.cabins,
      activity: Array.isArray(state.activity) ? state.activity.slice(0, MAX_ACTIVITY_ENTRIES) : [],
    };
    const expected = Number(req.body?.version);
    const existing = await BoardState.findOne({ companyId: req.user.companyId }).select("version").lean();
    const current = existing?.version || 0;

    /*
     * A save has to say which version it was built on. Without that, two people
     * booking different cabins at the same time would each save a whole floor
     * and the slower one would erase the other's work.
     */
    if (!Number.isFinite(expected)) {
      return res.status(400).json({ message: "A version is required to save the board" });
    }
    if (expected !== current) {
      return res.status(409).json({
        message: "The board changed on another device. Reload before saving again.",
        version: current,
      });
    }

    const saved = await BoardState.findOneAndUpdate(
      { companyId: req.user.companyId, ...(existing ? { version: current } : {}) },
      {
        $set: { state: trimmed, updatedBy: req.user._id, updatedByName: req.user.name || "" },
        $inc: { version: 1 },
        $setOnInsert: { companyId: req.user.companyId },
      },
      { upsert: !existing, new: true, runValidators: true },
    );
    if (!saved) {
      return res.status(409).json({ message: "The board changed while saving. Reload and try again." });
    }

    res.json({ version: saved.version, updatedAt: saved.updatedAt, updatedByName: saved.updatedByName });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "The board changed while saving. Reload and try again." });
    }
    req.log?.error(error);
    res.status(500).json({ message: "Could not save the booking board" });
  }
});

module.exports = router;
