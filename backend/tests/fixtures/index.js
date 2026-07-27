const jwt = require("jsonwebtoken");
const Company = require("../../src/models/Company");
const User = require("../../src/models/User");
const Lead = require("../../src/models/Lead");
const Inventory = require("../../src/models/Inventory");
const LeadStatusRequest = require("../../src/models/LeadStatusRequest");
const LeadDiary = require("../../src/models/leadDiary.model");
const { USER_ROLES } = require("../../src/constants/role.constants");

let sequence = 0;
const nextId = (prefix) => {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
};

const authTokenFor = (user) =>
  jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET || "test-jwt-secret", {
    expiresIn: "1h",
  });

const authHeaderFor = (user) => ({
  Authorization: `Bearer ${authTokenFor(user)}`,
});

const createCompany = async (overrides = {}) =>
  Company.create({
    name: overrides.name || `Test Company ${nextId("company")}`,
    subdomain: overrides.subdomain || nextId("tenant").toLowerCase(),
    status: "ACTIVE",
    ...overrides,
  });

const createUser = async ({
  company,
  role = USER_ROLES.ADMIN,
  parentId = null,
  email,
  password = "password123",
  ...overrides
} = {}) => {
  const companyId =
    role === USER_ROLES.SUPER_ADMIN
      ? (overrides.companyId ?? null)
      : (overrides.companyId || company?._id || (await createCompany())._id);

  return User.create({
    name: overrides.name || `${role} User`,
    email: email || `${nextId(role.toLowerCase())}@example.com`,
    phone: overrides.phone || "9999999999",
    password,
    role,
    companyId,
    parentId,
    isActive: overrides.isActive ?? true,
    canViewInventory: overrides.canViewInventory ?? false,
    brokerageConfig: overrides.brokerageConfig,
  });
};

const createCompanyUsers = async () => {
  const company = await createCompany();
  const admin = await createUser({ company, role: USER_ROLES.ADMIN });
  const manager = await createUser({
    company,
    role: USER_ROLES.MANAGER,
    parentId: admin._id,
  });
  const insideExecutive = await createUser({
    company,
    role: USER_ROLES.INSIDE_EXECUTIVE,
    parentId: manager._id,
  });
  const executive = await createUser({
    company,
    role: USER_ROLES.EXECUTIVE,
    parentId: manager._id,
  });
  const fieldExecutive = await createUser({
    company,
    role: USER_ROLES.FIELD_EXECUTIVE,
    parentId: manager._id,
  });
  const productionExecutive = await createUser({
    company,
    role: USER_ROLES.PRODUCTION_EXECUTIVE,
    parentId: manager._id,
  });
  const channelPartner = await createUser({
    company,
    role: USER_ROLES.CHANNEL_PARTNER,
    parentId: manager._id,
  });

  return {
    company,
    admin,
    manager,
    insideExecutive,
    executive,
    fieldExecutive,
    productionExecutive,
    channelPartner,
  };
};

const createRoleSetForCompany = async (company, { suffix = "", includeInactive = true } = {}) => {
  const admin = await createUser({
    company,
    role: USER_ROLES.ADMIN,
    email: `admin${suffix}@example.com`,
  });
  const manager = await createUser({
    company,
    role: USER_ROLES.MANAGER,
    parentId: admin._id,
    email: `manager${suffix}@example.com`,
  });
  const insideExecutive = await createUser({
    company,
    role: USER_ROLES.INSIDE_EXECUTIVE,
    parentId: manager._id,
    email: `inside${suffix}@example.com`,
  });
  const executive = await createUser({
    company,
    role: USER_ROLES.EXECUTIVE,
    parentId: manager._id,
    email: `executive${suffix}@example.com`,
  });
  const fieldExecutive = await createUser({
    company,
    role: USER_ROLES.FIELD_EXECUTIVE,
    parentId: manager._id,
    email: `field${suffix}@example.com`,
  });
  const productionExecutive = await createUser({
    company,
    role: USER_ROLES.PRODUCTION_EXECUTIVE,
    parentId: manager._id,
    email: `production${suffix}@example.com`,
  });
  const channelPartnerWithInventory = await createUser({
    company,
    role: USER_ROLES.CHANNEL_PARTNER,
    parentId: manager._id,
    email: `partner.inventory${suffix}@example.com`,
    canViewInventory: true,
  });
  const channelPartnerNoInventory = await createUser({
    company,
    role: USER_ROLES.CHANNEL_PARTNER,
    parentId: manager._id,
    email: `partner.noinventory${suffix}@example.com`,
    canViewInventory: false,
  });
  const inactiveExecutive = includeInactive
    ? await createUser({
      company,
      role: USER_ROLES.EXECUTIVE,
      parentId: manager._id,
      email: `inactive${suffix}@example.com`,
      isActive: false,
    })
    : null;

  return {
    admin,
    manager,
    insideExecutive,
    executive,
    fieldExecutive,
    productionExecutive,
    channelPartnerWithInventory,
    channelPartnerNoInventory,
    inactiveExecutive,
  };
};

const createPhase2FixtureGraph = async () => {
  const platformSuperAdmin = await createUser({
    role: USER_ROLES.SUPER_ADMIN,
    email: "platform.super@example.com",
    name: "Platform Super Admin",
  });
  const companyA = await createCompany({
    name: "Company A",
    subdomain: "company-a",
    status: "ACTIVE",
    createdBy: platformSuperAdmin._id,
  });
  const companyB = await createCompany({
    name: "Company B",
    subdomain: "company-b",
    status: "ACTIVE",
    createdBy: platformSuperAdmin._id,
  });
  const suspendedCompanyC = await createCompany({
    name: "Company C",
    subdomain: "company-c",
    status: "SUSPENDED",
    createdBy: platformSuperAdmin._id,
  });
  const archivedCompany = await createCompany({
    name: "Company Archived",
    subdomain: "company-archived",
    status: "ARCHIVED",
    createdBy: platformSuperAdmin._id,
  });

  const companyAUsers = await createRoleSetForCompany(companyA, { suffix: ".a" });
  const companyBUsers = await createRoleSetForCompany(companyB, { suffix: ".b" });
  const companyCUsers = await createRoleSetForCompany(suspendedCompanyC, {
    suffix: ".c",
    includeInactive: false,
  });
  const archivedCompanyUsers = await createRoleSetForCompany(archivedCompany, {
    suffix: ".archived",
    includeInactive: false,
  });

  return {
    platformSuperAdmin,
    companyA,
    companyB,
    suspendedCompanyC,
    archivedCompany,
    companyAUsers,
    companyBUsers,
    companyCUsers,
    archivedCompanyUsers,
  };
};

const createLead = async ({
  company,
  createdBy,
  assignedTo = null,
  ...overrides
} = {}) => {
  const leadCompany = company || (createdBy?.companyId ? { _id: createdBy.companyId } : await createCompany());

  return Lead.create({
    name: overrides.name || `Lead ${nextId("lead")}`,
    phone: overrides.phone || `${Math.floor(1000000000 + Math.random() * 8999999999)}`,
    email: overrides.email || "",
    city: overrides.city || "Indore",
    projectInterested: overrides.projectInterested || "Test Project",
    companyId: leadCompany._id,
    source: overrides.source || "MANUAL",
    status: overrides.status || "NEW",
    createdBy: createdBy?._id || null,
    assignedTo: assignedTo?._id || assignedTo || null,
    assignedExecutive: assignedTo?._id || assignedTo || null,
    ...overrides,
  });
};

const createInventory = async ({
  company,
  createdBy,
  ...overrides
} = {}) => {
  const inventoryCompany = company || (createdBy?.companyId ? { _id: createdBy.companyId } : await createCompany());
  const owner = createdBy || await createUser({ company: inventoryCompany });

  return Inventory.create({
    companyId: inventoryCompany._id,
    projectName: overrides.projectName || `Project ${nextId("inventory")}`,
    towerName: overrides.towerName || "Tower A",
    unitNumber: overrides.unitNumber || nextId("unit"),
    price: overrides.price ?? 1000000,
    type: overrides.type || "Sale",
    category: overrides.category || "Office",
    location: overrides.location || "Test Location",
    createdBy: owner._id,
    ...overrides,
  });
};

const createLeadStatusRequest = async ({
  company,
  lead,
  requestedBy,
  ...overrides
} = {}) => {
  const rowCompanyId = company?._id || lead?.companyId || requestedBy?.companyId;
  return LeadStatusRequest.create({
    companyId: rowCompanyId,
    lead: lead._id,
    requestedBy: requestedBy._id,
    proposedStatus: overrides.proposedStatus || "CLOSED",
    requestNote: overrides.requestNote || "Please approve",
    status: overrides.status || "pending",
    ...overrides,
  });
};

const createLeadDiaryEntry = async ({
  lead,
  createdBy,
  note = "Original note",
  ...overrides
}) =>
  LeadDiary.create({
    lead: lead._id || lead,
    createdBy: createdBy?._id || createdBy || null,
    note,
    ...overrides,
  });

module.exports = {
  authHeaderFor,
  authTokenFor,
  createCompany,
  createCompanyUsers,
  createPhase2FixtureGraph,
  createInventory,
  createLead,
  createLeadDiaryEntry,
  createLeadStatusRequest,
  createRoleSetForCompany,
  createUser,
};
