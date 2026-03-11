const mongoose = require("mongoose");
const logger = require("../config/logger");
const User = require("../models/User");
const Lead = require("../models/Lead");
const Inventory = require("../models/Inventory");
const InventoryRequest = require("../models/InventoryRequest");
const Company = require("../models/Company");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const TenantSubscription = require("../models/TenantSubscription");
const { USER_ROLES } = require("../constants/role.constants");

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const sanitizeSubdomain = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);

const resolveRootDomain = () =>
  String(process.env.SAAS_ROOT_DOMAIN || "")
    .trim()
    .toLowerCase();

const buildCompanyDashboardPath = (subdomain) => {
  const tenantSlug = sanitizeSubdomain(subdomain);
  return tenantSlug ? `/${tenantSlug}/dashboard` : "";
};

const buildCompanyDashboardUrl = (subdomain) => {
  const dashboardPath = buildCompanyDashboardPath(subdomain);
  if (!dashboardPath) return "";

  const rootDomain = resolveRootDomain();
  if (!rootDomain) return dashboardPath;
  return `${rootDomain}${dashboardPath}`;
};

const ensureUniqueSubdomain = async (baseSubdomain) => {
  const normalizedBase = sanitizeSubdomain(baseSubdomain);
  if (!normalizedBase) return "";

  let attempt = 0;
  while (attempt < 5000) {
    const candidate = attempt === 0 ? normalizedBase : `${normalizedBase}-${attempt}`;
    const exists = await Company.findOne({ subdomain: candidate }).select("_id").lean();
    if (!exists) {
      return candidate;
    }
    attempt += 1;
  }

  throw new Error("Unable to allocate unique company route slug");
};

const toCompanySummary = (company) => ({
  id: company._id,
  name: company.name,
  legalName: company.legalName || "",
  subdomain: company.subdomain,
  routePrefix: company.subdomain ? `/${company.subdomain}` : "",
  dashboardPath: buildCompanyDashboardPath(company.subdomain),
  dashboardUrl: buildCompanyDashboardUrl(company.subdomain),
  customDomain: company.customDomain || "",
  status: company.status,
  ownerUserId: company.ownerUserId || null,
  settings: company.settings || {},
  createdAt: company.createdAt,
  updatedAt: company.updatedAt,
});

const toPlanSummary = (plan) => ({
  id: plan._id,
  code: plan.code,
  name: plan.name,
  description: plan.description || "",
  pricing: plan.pricing || {},
  limits: plan.limits || {},
  features: plan.features || [],
  isActive: Boolean(plan.isActive),
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt,
});

const toSubscriptionSummary = (row) => ({
  id: row._id,
  companyId: row.companyId,
  planId: row.planId?._id || row.planId || null,
  plan: row.planId?._id
    ? {
      id: row.planId._id,
      code: row.planId.code,
      name: row.planId.name,
      pricing: row.planId.pricing || {},
      limits: row.planId.limits || {},
      isActive: Boolean(row.planId.isActive),
    }
    : null,
  status: row.status,
  billingCycle: row.billingCycle,
  seats: row.seats,
  isCurrent: Boolean(row.isCurrent),
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  trialEndsAt: row.trialEndsAt,
  nextBillingAt: row.nextBillingAt,
  autoRenew: Boolean(row.autoRenew),
  metadata: row.metadata || {},
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const fetchCompanyUserIds = async (companyId) => {
  const rows = await User.find({ companyId }).select("_id").lean();
  return rows.map((row) => row._id);
};

const computeCompanyUsage = async (companyId) => {
  const userIds = await fetchCompanyUserIds(companyId);
  const leadQuery = userIds.length
    ? { $or: [{ createdBy: { $in: userIds } }, { assignedTo: { $in: userIds } }] }
    : { _id: null };

  const [
    totalUsers,
    activeUsers,
    totalLeads,
    totalInventory,
    pendingInventoryRequests,
    roleBreakdown,
    currentSubscription,
  ] = await Promise.all([
    User.countDocuments({ companyId }),
    User.countDocuments({ companyId, isActive: true }),
    Lead.countDocuments(leadQuery),
    Inventory.countDocuments({ companyId }),
    InventoryRequest.countDocuments({ companyId, status: "PENDING" }),
    User.aggregate([
      { $match: { companyId } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    TenantSubscription.findOne({ companyId, isCurrent: true })
      .populate("planId", "code name pricing limits isActive")
      .lean(),
  ]);

  return {
    totalUsers,
    activeUsers,
    totalLeads,
    totalInventory,
    pendingInventoryRequests,
    roleBreakdown: roleBreakdown.map((row) => ({
      role: row._id,
      count: row.count,
    })),
    currentSubscription: currentSubscription
      ? toSubscriptionSummary(currentSubscription)
      : null,
  };
};

exports.createCompany = async (req, res) => {
  try {
    const {
      name,
      legalName,
      subdomain,
      customDomain,
      settings,
      adminName,
      adminEmail,
      adminPhone,
      adminPassword,
      planId,
      billingCycle,
      seats,
      trialDays,
    } = req.body || {};

    if (!name || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({
        message: "name, adminName, adminEmail, adminPassword are required",
      });
    }

    const cleanedName = String(name || "").trim();
    const requestedSubdomain = sanitizeSubdomain(subdomain);
    const baseSubdomain = requestedSubdomain || sanitizeSubdomain(cleanedName);
    if (!baseSubdomain) {
      return res.status(400).json({ message: "Valid subdomain is required" });
    }

    const [existingCompanyDomain, existingAdmin] = await Promise.all([
      customDomain
        ? Company.findOne({ customDomain: String(customDomain).trim().toLowerCase() })
          .select("_id")
          .lean()
        : null,
      User.findOne({ email: String(adminEmail).trim().toLowerCase() }).select("_id").lean(),
    ]);

    if (existingCompanyDomain) {
      return res.status(400).json({ message: "Custom domain already exists" });
    }
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin email already exists" });
    }

    const resolvedSubdomain = requestedSubdomain
      ? requestedSubdomain
      : await ensureUniqueSubdomain(baseSubdomain);

    if (requestedSubdomain) {
      const existingCompanySubdomain = await Company.findOne({ subdomain: resolvedSubdomain })
        .select("_id")
        .lean();
      if (existingCompanySubdomain) {
        return res.status(400).json({ message: "Subdomain already exists" });
      }
    }

    const company = await Company.create({
      name: cleanedName,
      legalName: String(legalName || "").trim(),
      subdomain: resolvedSubdomain,
      customDomain: String(customDomain || "").trim().toLowerCase(),
      status: "ACTIVE",
      settings: settings && typeof settings === "object" ? settings : {},
      createdBy: req.user?._id || null,
    });

    const adminUser = await User.create({
      name: String(adminName).trim(),
      email: String(adminEmail).trim().toLowerCase(),
      phone: String(adminPhone || "").trim(),
      password: String(adminPassword),
      role: USER_ROLES.ADMIN,
      companyId: company._id,
      parentId: null,
    });

    company.ownerUserId = adminUser._id;
    await company.save();

    let subscription = null;
    if (planId && mongoose.Types.ObjectId.isValid(planId)) {
      const plan = await SubscriptionPlan.findById(planId).select("_id").lean();
      if (plan) {
        const now = new Date();
        const cycle = String(billingCycle || "MONTHLY").trim().toUpperCase() === "YEARLY"
          ? "YEARLY"
          : "MONTHLY";
        const safeSeats = toPositiveInt(seats, 5);
        const safeTrialDays = Math.max(0, toPositiveInt(trialDays, 14));

        subscription = await TenantSubscription.create({
          companyId: company._id,
          planId: plan._id,
          status: safeTrialDays > 0 ? "TRIAL" : "ACTIVE",
          billingCycle: cycle,
          seats: safeSeats,
          trialEndsAt: safeTrialDays > 0
            ? new Date(now.getTime() + safeTrialDays * 24 * 60 * 60 * 1000)
            : null,
          startsAt: now,
          isCurrent: true,
        });
      }
    }

    return res.status(201).json({
      message: "Company tenant created successfully",
      company: toCompanySummary(company),
      admin: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        companyId: adminUser.companyId,
      },
      subscription: subscription ? toSubscriptionSummary(subscription) : null,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "createCompany failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.listCompanies = async (req, res) => {
  try {
    const page = toPositiveInt(req.query?.page, 1);
    const limit = Math.min(100, toPositiveInt(req.query?.limit, 20));
    const skip = (page - 1) * limit;
    const search = String(req.query?.search || "").trim();
    const status = String(req.query?.status || "").trim().toUpperCase();

    const query = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { legalName: { $regex: search, $options: "i" } },
        { subdomain: { $regex: search, $options: "i" } },
      ];
    }

    const [rows, total] = await Promise.all([
      Company.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Company.countDocuments(query),
    ]);

    const companyIds = rows.map((row) => row._id);
    const subscriptions = companyIds.length
      ? await TenantSubscription.find({
        companyId: { $in: companyIds },
        isCurrent: true,
      })
        .populate("planId", "code name pricing limits isActive")
        .lean()
      : [];
    const byCompanyId = new Map(
      subscriptions.map((row) => [String(row.companyId), toSubscriptionSummary(row)]),
    );

    return res.json({
      page,
      limit,
      total,
      companies: rows.map((row) => ({
        ...toCompanySummary(row),
        subscription: byCompanyId.get(String(row._id)) || null,
      })),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "listCompanies failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ message: "Invalid company id" });
    }

    const patch = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "name")) {
      patch.name = String(req.body.name || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "legalName")) {
      patch.legalName = String(req.body.legalName || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "status")) {
      patch.status = String(req.body.status || "").trim().toUpperCase();
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "subdomain")) {
      const subdomain = sanitizeSubdomain(req.body.subdomain);
      if (!subdomain) return res.status(400).json({ message: "Invalid subdomain" });
      const existing = await Company.findOne({
        _id: { $ne: companyId },
        subdomain,
      })
        .select("_id")
        .lean();
      if (existing) {
        return res.status(400).json({ message: "Subdomain already exists" });
      }
      patch.subdomain = subdomain;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "customDomain")) {
      const customDomain = String(req.body.customDomain || "").trim().toLowerCase();
      if (customDomain) {
        const existing = await Company.findOne({
          _id: { $ne: companyId },
          customDomain,
        })
          .select("_id")
          .lean();
        if (existing) {
          return res.status(400).json({ message: "Custom domain already exists" });
        }
      }
      patch.customDomain = customDomain;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "settings")) {
      if (typeof req.body.settings !== "object" || req.body.settings === null) {
        return res.status(400).json({ message: "settings must be an object" });
      }
      patch.settings = req.body.settings;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "metadata")) {
      patch.metadata =
        typeof req.body.metadata === "object" && req.body.metadata !== null
          ? req.body.metadata
          : {};
    }

    const updated = await Company.findByIdAndUpdate(
      companyId,
      { $set: patch },
      { new: true },
    ).lean();
    if (!updated) {
      return res.status(404).json({ message: "Company not found" });
    }

    return res.json({
      message: "Company updated",
      company: toCompanySummary(updated),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "updateCompany failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.createPlan = async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim().toUpperCase();
    const name = String(req.body?.name || "").trim();
    if (!code || !name) {
      return res.status(400).json({ message: "code and name are required" });
    }

    const existing = await SubscriptionPlan.findOne({ code }).select("_id").lean();
    if (existing) {
      return res.status(400).json({ message: "Plan code already exists" });
    }

    const created = await SubscriptionPlan.create({
      code,
      name,
      description: String(req.body?.description || "").trim(),
      pricing:
        typeof req.body?.pricing === "object" && req.body.pricing !== null
          ? req.body.pricing
          : {},
      limits:
        typeof req.body?.limits === "object" && req.body.limits !== null
          ? req.body.limits
          : {},
      features: Array.isArray(req.body?.features) ? req.body.features : [],
      isActive: Object.prototype.hasOwnProperty.call(req.body || {}, "isActive")
        ? Boolean(req.body.isActive)
        : true,
    });

    return res.status(201).json({
      message: "Subscription plan created",
      plan: toPlanSummary(created),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "createPlan failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.listPlans = async (_req, res) => {
  try {
    const plans = await SubscriptionPlan.find({})
      .sort({ isActive: -1, createdAt: -1 })
      .lean();
    return res.json({ plans: plans.map(toPlanSummary) });
  } catch (error) {
    logger.error({
      requestId: _req.requestId || null,
      error: error.message,
      message: "listPlans failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(planId)) {
      return res.status(400).json({ message: "Invalid plan id" });
    }

    const patch = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "name")) {
      patch.name = String(req.body.name || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "description")) {
      patch.description = String(req.body.description || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "pricing")) {
      if (typeof req.body.pricing !== "object" || req.body.pricing === null) {
        return res.status(400).json({ message: "pricing must be an object" });
      }
      patch.pricing = req.body.pricing;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "limits")) {
      if (typeof req.body.limits !== "object" || req.body.limits === null) {
        return res.status(400).json({ message: "limits must be an object" });
      }
      patch.limits = req.body.limits;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "features")) {
      patch.features = Array.isArray(req.body.features) ? req.body.features : [];
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "isActive")) {
      patch.isActive = Boolean(req.body.isActive);
    }

    const updated = await SubscriptionPlan.findByIdAndUpdate(
      planId,
      { $set: patch },
      { new: true },
    ).lean();
    if (!updated) {
      return res.status(404).json({ message: "Plan not found" });
    }

    return res.json({
      message: "Subscription plan updated",
      plan: toPlanSummary(updated),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "updatePlan failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.assignSubscription = async (req, res) => {
  try {
    const {
      companyId,
      planId,
      status,
      billingCycle,
      seats,
      startsAt,
      endsAt,
      trialEndsAt,
      nextBillingAt,
      autoRenew,
      metadata,
    } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(companyId) || !mongoose.Types.ObjectId.isValid(planId)) {
      return res.status(400).json({ message: "Valid companyId and planId are required" });
    }

    const [company, plan] = await Promise.all([
      Company.findById(companyId).select("_id").lean(),
      SubscriptionPlan.findById(planId).select("_id").lean(),
    ]);
    if (!company) return res.status(404).json({ message: "Company not found" });
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    await TenantSubscription.updateMany(
      { companyId, isCurrent: true },
      { $set: { isCurrent: false } },
    );

    const created = await TenantSubscription.create({
      companyId,
      planId,
      status: String(status || "ACTIVE").trim().toUpperCase(),
      billingCycle: String(billingCycle || "MONTHLY").trim().toUpperCase(),
      seats: toPositiveInt(seats, 5),
      startsAt: startsAt ? new Date(startsAt) : new Date(),
      endsAt: endsAt ? new Date(endsAt) : null,
      trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
      nextBillingAt: nextBillingAt ? new Date(nextBillingAt) : null,
      autoRenew: Object.prototype.hasOwnProperty.call(req.body || {}, "autoRenew")
        ? Boolean(autoRenew)
        : true,
      metadata: typeof metadata === "object" && metadata !== null ? metadata : {},
      isCurrent: true,
    });

    const row = await TenantSubscription.findById(created._id)
      .populate("planId", "code name pricing limits isActive")
      .lean();

    return res.status(201).json({
      message: "Subscription assigned",
      subscription: toSubscriptionSummary(row),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "assignSubscription failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getCompanyUsage = async (req, res) => {
  try {
    const companyId = String(req.params?.companyId || req.query?.companyId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ message: "Valid companyId is required" });
    }

    const company = await Company.findById(companyId).lean();
    if (!company) return res.status(404).json({ message: "Company not found" });

    const usage = await computeCompanyUsage(company._id);
    return res.json({
      company: toCompanySummary(company),
      usage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getCompanyUsage failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getGlobalAnalytics = async (req, res) => {
  try {
    const [
      totalCompanies,
      activeCompanies,
      totalUsers,
      activeUsers,
      totalLeads,
      totalInventory,
      currentSubscriptions,
      companies,
      userGroups,
      inventoryGroups,
    ] = await Promise.all([
      Company.countDocuments({}),
      Company.countDocuments({ status: "ACTIVE" }),
      User.countDocuments({ role: { $ne: USER_ROLES.SUPER_ADMIN } }),
      User.countDocuments({ role: { $ne: USER_ROLES.SUPER_ADMIN }, isActive: true }),
      Lead.countDocuments({}),
      Inventory.countDocuments({}),
      TenantSubscription.find({ isCurrent: true, status: { $in: ["TRIAL", "ACTIVE", "PAST_DUE"] } })
        .populate("planId", "pricing")
        .lean(),
      Company.find({}).select("_id name subdomain status").lean(),
      User.aggregate([
        { $match: { companyId: { $ne: null }, role: { $ne: USER_ROLES.SUPER_ADMIN } } },
        { $group: { _id: "$companyId", totalUsers: { $sum: 1 }, activeUsers: { $sum: { $cond: ["$isActive", 1, 0] } } } },
      ]),
      Inventory.aggregate([
        { $group: { _id: "$companyId", totalInventory: { $sum: 1 } } },
      ]),
    ]);

    const usersByCompany = new Map(userGroups.map((row) => [String(row._id), row]));
    const inventoryByCompany = new Map(inventoryGroups.map((row) => [String(row._id), row]));
    const subscriptionsByCompany = new Map(
      currentSubscriptions.map((row) => [String(row.companyId), row]),
    );

    const mrrEstimate = currentSubscriptions.reduce((sum, row) => {
      const monthlyPrice = Number(row.planId?.pricing?.monthly || 0);
      const yearlyPrice = Number(row.planId?.pricing?.yearly || 0);
      if (row.billingCycle === "YEARLY" && yearlyPrice > 0) {
        return sum + yearlyPrice / 12;
      }
      return sum + monthlyPrice;
    }, 0);

    const topCompanies = companies
      .map((company) => {
        const userUsage = usersByCompany.get(String(company._id)) || {
          totalUsers: 0,
          activeUsers: 0,
        };
        const inventoryUsage = inventoryByCompany.get(String(company._id)) || {
          totalInventory: 0,
        };
        const sub = subscriptionsByCompany.get(String(company._id));
        return {
          companyId: company._id,
          name: company.name,
          subdomain: company.subdomain,
          status: company.status,
          totalUsers: userUsage.totalUsers,
          activeUsers: userUsage.activeUsers,
          totalInventory: inventoryUsage.totalInventory,
          subscriptionStatus: sub?.status || "NONE",
        };
      })
      .sort((a, b) => {
        const scoreA = a.activeUsers + a.totalInventory;
        const scoreB = b.activeUsers + b.totalInventory;
        return scoreB - scoreA;
      })
      .slice(0, 10);

    return res.json({
      overview: {
        totalCompanies,
        activeCompanies,
        totalUsers,
        activeUsers,
        totalLeads,
        totalInventory,
        activeSubscriptions: currentSubscriptions.length,
        mrrEstimate: Number(mrrEstimate.toFixed(2)),
      },
      topCompanies,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getGlobalAnalytics failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getMyTenantSettings = async (req, res) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Only tenant ADMIN can view tenant settings" });
    }
    if (!req.user.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const [company, subscription] = await Promise.all([
      Company.findById(req.user.companyId).lean(),
      TenantSubscription.findOne({ companyId: req.user.companyId, isCurrent: true })
        .populate("planId", "code name pricing limits features isActive")
        .lean(),
    ]);
    if (!company) return res.status(404).json({ message: "Company not found" });

    return res.json({
      company: toCompanySummary(company),
      subscription: subscription ? toSubscriptionSummary(subscription) : null,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getMyTenantSettings failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateMyTenantSettings = async (req, res) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Only tenant ADMIN can update tenant settings" });
    }
    if (!req.user.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const patch = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "name")) {
      patch.name = String(req.body.name || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "customDomain")) {
      const customDomain = String(req.body.customDomain || "").trim().toLowerCase();
      if (customDomain) {
        const existing = await Company.findOne({
          _id: { $ne: req.user.companyId },
          customDomain,
        })
          .select("_id")
          .lean();
        if (existing) {
          return res.status(400).json({ message: "Custom domain already in use" });
        }
      }
      patch.customDomain = customDomain;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "settings")) {
      if (typeof req.body.settings !== "object" || req.body.settings === null) {
        return res.status(400).json({ message: "settings must be an object" });
      }
      patch.settings = req.body.settings;
    }

    const updated = await Company.findByIdAndUpdate(
      req.user.companyId,
      { $set: patch },
      { new: true },
    ).lean();
    if (!updated) return res.status(404).json({ message: "Company not found" });

    return res.json({
      message: "Tenant settings updated",
      company: toCompanySummary(updated),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "updateMyTenantSettings failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.resolveTenantByHost = async (req, res) => {
  try {
    return res.json({
      host: req.tenantHost || "",
      subdomain: req.tenantSubdomain || "",
      source: req.tenantSource || "",
      tenant: req.tenant ? toCompanySummary(req.tenant) : null,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "resolveTenantByHost failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};
