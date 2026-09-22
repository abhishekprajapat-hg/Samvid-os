const router = require("express").Router();
const CustomRole = require("../models/CustomRole");
const User = require("../models/User");
const { protect } = require("../middleware/auth.middleware");
const { requireCompanyContext } = require("../middleware/company.middleware");
const checkRole = require("../middleware/role.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");
const { USER_ROLES } = require("../constants/role.constants");

const BUSINESS_CATEGORIES = ["COMMERCIAL", "RESIDENTIAL", "COWORKING", "BOTH"];
const ASSIGNABLE_BASE_ROLES = Object.values(USER_ROLES).filter((role) => role !== USER_ROLES.ADMIN);

/*
 * What a role behaves as when nobody says.
 *
 * Naming a role is the part a company cares about; which built-in role the
 * scoping rules read underneath is plumbing, and the form no longer asks for
 * it. An executive is the right default: it is the narrowest scope of the lot,
 * so a role created without a thought grants the least, and what its holders
 * actually reach is set on the page access screen straight afterwards.
 *
 * Someone who genuinely wants a manager picks Manager from the role list
 * directly - it sits in the same dropdown as the roles a company names itself.
 */
const DEFAULT_BASE_ROLE = USER_ROLES.EXECUTIVE;

// Absent means "the default"; present but unknown is a mistake worth reporting.
const resolveBaseRole = (raw, fallback = DEFAULT_BASE_ROLE) => {
  const requested = String(raw || "").trim().toUpperCase();
  if (!requested) return fallback;
  return ASSIGNABLE_BASE_ROLES.includes(requested) ? requested : null;
};

router.use(protect);
router.use(requireCompanyContext);

/*
 * Roles are created from the Create User form, so whoever may create a user may
 * name a role for them - admins and managers both.
 *
 * That hands out no privilege on its own: a role here is a name plus the
 * built-in role it behaves as, and a manager could already pick that built-in
 * role directly. What the person actually reaches is set afterwards on the page
 * access screen, which stays admin only.
 */
router.use(checkRole([USER_ROLES.ADMIN, USER_ROLES.MANAGER]));

// The base roles a new role may be built on, named for the form's dropdown.
router.get("/catalogue", (req, res) => {
  res.json({ businessCategories: BUSINESS_CATEGORIES, baseRoles: ASSIGNABLE_BASE_ROLES });
});

router.get("/", async (req, res) => {
  try {
    const roles = await CustomRole.find({ companyId: req.user.companyId, isActive: true })
      .select("name baseRole businessCategory description")
      .sort({ name: 1 })
      .lean();
    res.json({ roles });
  } catch (error) {
    req.log?.error(error);
    res.status(500).json({ message: "Could not load roles" });
  }
});

router.post("/", writeLimiter, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const baseRole = resolveBaseRole(req.body?.baseRole);
    const businessCategory = String(req.body?.businessCategory || "COMMERCIAL").trim().toUpperCase();

    if (!name) return res.status(400).json({ message: "A role name is required" });
    if (name.length > 60) return res.status(400).json({ message: "Role name is too long" });
    if (!baseRole) return res.status(400).json({ message: "That is not a role this one can be based on" });
    if (!BUSINESS_CATEGORIES.includes(businessCategory)) {
      return res.status(400).json({ message: "Choose a valid business category" });
    }

    /*
     * No page list here on purpose. The access this role's holders get is set
     * on the page access screen once the first user exists, which is where an
     * admin can see the effect of what they are granting.
     */
    const role = await CustomRole.create({
      name,
      baseRole,
      businessCategory,
      description: String(req.body?.description || "").trim().slice(0, 300),
      companyId: req.user.companyId,
      createdBy: req.user._id,
    });

    res.status(201).json({ role, message: `${role.name} created` });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A role with that name already exists" });
    req.log?.error(error);
    res.status(500).json({ message: "Could not create the role" });
  }
});

router.patch("/:roleId", writeLimiter, async (req, res) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.roleId)) return res.status(400).json({ message: "Invalid role" });

    const name = String(req.body?.name || "").trim();

    if (!name) return res.status(400).json({ message: "A role name is required" });
    if (name.length > 60) return res.status(400).json({ message: "Role name is too long" });

    const existing = await CustomRole.findOne({ _id: req.params.roleId, companyId: req.user.companyId }).lean();
    if (!existing) return res.status(404).json({ message: "Role not found" });

    /*
     * Silence means "leave this alone", for the category exactly as for the
     * base role.
     *
     * Defaulting an absent category to COMMERCIAL made a rename re-categorise
     * the role, and the bulk update below then pushed that onto every person
     * holding it - changing which pipeline they see. The edit form only asks
     * for a name, so its silence has to mean nothing rather than "commercial".
     */
    const hasCategoryField = Object.prototype.hasOwnProperty.call(req.body || {}, "businessCategory");
    const requestedCategory = String(req.body?.businessCategory || "").trim().toUpperCase();
    const businessCategory = hasCategoryField && requestedCategory
      ? requestedCategory
      : existing.businessCategory;
    if (!BUSINESS_CATEGORIES.includes(businessCategory)) {
      return res.status(400).json({ message: "Choose a valid business category" });
    }

    const baseRole = resolveBaseRole(req.body?.baseRole, existing.baseRole);
    if (!baseRole) return res.status(400).json({ message: "That is not a role this one can be based on" });

    /*
     * Changing what a role behaves as rewrites the built-in role of everyone
     * already on it, in one statement and with none of the guards that the
     * user editor applies one at a time. That is an admin's decision, not
     * something a manager does in passing while renaming a job title. The
     * form never sends it either way.
     */
    if (baseRole !== existing.baseRole && req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Only an admin can change what a role is based on" });
    }

    const role = await CustomRole.findOneAndUpdate(
      { _id: req.params.roleId, companyId: req.user.companyId },
      { $set: { name, baseRole, businessCategory, updatedBy: req.user._id } },
      { returnDocument: "after", runValidators: true },
    );
    if (!role) return res.status(404).json({ message: "Role not found" });

    /*
     * Holders are only touched when something that describes them actually
     * changed. A rename changes nothing about the people on the role, so it
     * writes to nobody - which is what the edit form promises.
     */
    const holderPatch = {};
    if (role.baseRole !== existing.baseRole) holderPatch.role = role.baseRole;
    if (role.businessCategory !== existing.businessCategory) holderPatch.roleType = role.businessCategory;

    const applied = Object.keys(holderPatch).length
      ? await User.updateMany(
        { companyId: req.user.companyId, customRoleId: role._id },
        { $set: holderPatch },
      )
      : null;

    res.json({ role, message: `${role.name} updated`, usersUpdated: applied?.modifiedCount || 0 });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A role with that name already exists" });
    req.log?.error(error);
    res.status(500).json({ message: "Could not update the role" });
  }
});

router.delete("/:roleId", writeLimiter, async (req, res) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.roleId)) return res.status(400).json({ message: "Invalid role" });

    // Removing a role somebody holds would leave them pointing at nothing, so
    // it is refused with a count rather than quietly orphaning them.
    const holders = await User.countDocuments({ companyId: req.user.companyId, customRoleId: req.params.roleId });
    if (holders > 0) {
      return res.status(409).json({
        message: `${holders} user(s) are on this role. Move them to another role first.`,
        userCount: holders,
      });
    }

    const deleted = await CustomRole.findOneAndDelete({ _id: req.params.roleId, companyId: req.user.companyId });
    if (!deleted) return res.status(404).json({ message: "Role not found" });
    res.json({ message: `${deleted.name} deleted` });
  } catch (error) {
    req.log?.error(error);
    res.status(500).json({ message: "Could not delete the role" });
  }
});

module.exports = router;
