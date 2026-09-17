const mongoose = require("mongoose");

/*
 * The booking board, stored for the whole company.
 *
 * The board was built client-side and kept its floor in one browser's
 * localStorage, which meant every machine had a different set of bookings and
 * an admin could not see any of them. This holds that same state on the server
 * so there is one copy of it.
 *
 * The state is stored as the board already shapes it rather than being split
 * across the cabin/contract/invoice models. Those model occupancy per seat and
 * bill off contracts; the board lets a cabin whole and bills nothing. Mapping
 * between the two is a real piece of work, and doing it badly would put wrong
 * numbers into invoicing - which is worse than the board being separate, which
 * it already is today. What this fixes is the part that is losing data: the
 * floor now lives somewhere every device and every admin can read.
 *
 * `version` exists because two people work this board at once. A save carrying
 * a stale version is refused rather than quietly overwriting the other
 * person's booking.
 */
const schema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      unique: true,
      index: true,
    },
    // The board's own payload: { cabins: [...], activity: [...] }.
    state: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ cabins: [], activity: [] }),
    },
    version: { type: Number, default: 1, min: 1 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedByName: { type: String, default: "", maxlength: 200 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("CoworkingBoardState", schema);
