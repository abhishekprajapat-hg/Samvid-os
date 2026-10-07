const mongoose = require("mongoose");
const { USER_ROLES } = require("../constants/role.constants");

/*
 * A named job title a company defines for itself.
 *
 * Not a new entry in USER_ROLES. Every scoping rule, hierarchy check and
 * permission default in the CRM is written against the built-in roles, so a
 * genuinely new role value would have to be taught to all of them. Instead a
 * custom role is a preset: a base role that decides how the system treats the
 * person, a business category, and the page access they should start with.
 *
 * Assigning one copies those three onto the user. That keeps every existing
 * rule working untouched, and means a custom role can be edited or deleted
 * without stranding the people holding it.
 */
const schema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: "", trim: true, maxlength: 300 },
    businessCategory: {
      type: String,
      enum: ["COMMERCIAL", "RESIDENTIAL", "COWORKING", "BOTH"],
      default: "COMMERCIAL",
    },
    // How the rest of the CRM treats anyone holding this role.
    baseRole: {
      type: String,
      enum: Object.values(USER_ROLES).filter((role) => role !== USER_ROLES.ADMIN),
      required: true,
    },
    /*
     * No page list here on purpose.
     *
     * Page access is decided per user on the access screen, where an admin can
     * see who they are granting it to. A role-level list was never filled by
     * any route, and copying that empty list onto a new user turned it into a
     * deliberate "grant nothing" - which locked everyone hired onto a named
     * role out of all but Dashboard and Profile. A field nothing writes and
     * everything can trip over is worse than no field.
     */
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

// Two roles called "Senior Executive" in one company is a naming mistake, not a
// second role. Case-insensitive so "senior executive" does not slip past it.
schema.index(
  { companyId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

module.exports = mongoose.model("CustomRole", schema);
