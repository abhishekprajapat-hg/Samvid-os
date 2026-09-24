const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

const companyId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const otherCompanyId = "ffffffffffffffffffffffff";
const adminId = "bbbbbbbbbbbbbbbbbbbbbbbb";
const managerId = "cccccccccccccccccccccccc";
const targetUserId = "111111111111111111111111";

// Same isolation approach as crm-requirements.test.cjs: run the real modules
// with stubbed repositories, never touching a database.
const query = (value) => ({
  select() { return this; },
  populate() { return this; },
  sort() { return this; },
  limit() { return this; },
  lean() { return Promise.resolve(value); },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
});

// assert/strict deepEqual compares prototypes, and anything a vm-loaded module
// returns belongs to that context's realm — so compare structure, not identity.
const sameShape = (actual, expected, message) =>
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);

const load = (relative, stubs = {}, exposed = "") => {
  const filename = path.resolve(__dirname, "../src", relative);
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8") + exposed, {
    module,
    exports: module.exports,
    require: (name) => (name in stubs ? stubs[name] : localRequire(name)),
    process,
    console,
    Date,
    setTimeout,
    clearTimeout,
  }, { filename });
  return module.exports;
};

const mongooseStub = { Types: { ObjectId: { isValid: (value) => Boolean(value) } } };
const auditStub = { writeAuditLog: async () => {}, listAuditLogs: async () => ({ logs: [], pagination: {} }) };

const adminUser = { _id: adminId, companyId, role: "ADMIN" };
const managerUser = { _id: managerId, companyId, role: "MANAGER" };

const loadAccessService = ({ rolePermission = null } = {}) =>
  load("services/access.service.js", {
    mongoose: mongooseStub,
    "../models/RolePermission": { findOne: () => query(rolePermission) },
  });

test("page catalogue and admin navigation contain no Role Types module", async () => {
  const { CRM_PAGES } = require("../src/constants/page.constants");
  assert.equal(CRM_PAGES.some((page) => page.key === "admin_role_types"), false);
  const { pathToFileURL } = require("node:url");
  const { getVisibleSidebarGroups } = await import(pathToFileURL(path.resolve(__dirname, "../../frontend/src/components/workbench/workbenchNavigation.js")).href);
  assert.equal(getVisibleSidebarGroups("ADMIN").flatMap((group) => group.items).some((item) => item.path.includes("role-types")), false);
});

test("retired custom role references do not affect employee page selections", async () => {
  const access = loadAccessService();
  const employee = { ...managerUser, role: "FIELD_EXECUTIVE", pageAccessOverride: ["coworking_booking"] };
  const profile = await access.resolveAccessProfile({ ...employee, roleId: targetUserId, roleTypeId: targetUserId });
  sameShape(profile, await access.resolveAccessProfile(employee));
  assert.equal(profile.dataScope, "ASSIGNED");
  assert.equal(access.canAccessPage(profile, "coworking_booking"), true);
});

const loadUserController = (User) => load("controllers/user.controller.js", {
  "../models/User": User,
  "../models/Lead": { updateMany: async () => {} },
  "../models/Inventory": {},
  "../models/UserDeleteRequest": {},
  "../models/leadActivity.model": {},
  "../models/leadDiary.model": {},
  "../config/logger": { error(details) { throw new Error(details.error); }, warn() {}, info() {} },
  "../services/leadAssignment.service": {},
  "../services/hierarchy.service": { getDescendantUsers: async () => [] },
  "../services/auditLog.service": auditStub,
});
const userResponse = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test("create user accepts a built-in role and business category without a role catalogue", async () => {
  const created = [];
  const controller = loadUserController({
    findOne: (filter) => query(filter.email ? null : { _id: managerId, role: "MANAGER", isActive: true }),
    create: async (doc) => { created.push(doc); return { ...doc, _id: targetUserId }; },
  });
  for (const roleType of ["COMMERCIAL", "RESIDENTIAL", "BOTH"]) {
    const res = userResponse();
    await controller.createUserByRole({ user: adminUser, body: { name: "Employee", email: "employee@example.com", password: "test-password", role: "FIELD_EXECUTIVE", roleType, reportingToId: managerId } }, res);
    assert.equal(res.code, 201, JSON.stringify(res.body));
    assert.equal(created.at(-1).roleType, roleType);
    assert.equal(created.at(-1).role, "FIELD_EXECUTIVE");
    assert.equal(created.at(-1).parentId, managerId);
    assert.equal(created.at(-1).companyId, companyId);
    assert.equal("roleId" in created.at(-1), false);
  }
  const refused = userResponse();
  await controller.createUserByRole({ user: adminUser, body: { role: "ADMIN", email: "admin@example.com" } }, refused);
  assert.equal(refused.code, 400);
  assert.equal(created.length, 3);
});

test("editing role and category preserves individual coworking access", async () => {
  const employee = { _id: targetUserId, companyId, name: "Employee", role: "EXECUTIVE", roleType: "COMMERCIAL", parentId: managerId, pageAccessOverride: ["coworking_booking"], save: async () => {} };
  const controller = loadUserController({ find: () => query([]), findOne: (filter) => query(String(filter._id) === managerId ? { _id: managerId, role: "MANAGER" } : employee) });
  const res = userResponse();
  await controller.updateUserByAdmin({ user: adminUser, params: { userId: targetUserId }, body: { role: "FIELD_EXECUTIVE", roleType: "BOTH", reportingToId: managerId } }, res);
  assert.equal(res.code, 200, JSON.stringify(res.body));
  assert.equal(employee.role, "FIELD_EXECUTIVE");
  assert.equal(employee.roleType, "BOTH");
  sameShape(employee.pageAccessOverride, ["coworking_booking"]);
});

test("reporting guard retains manager team scope and self-promotion protection", async () => {
  const guard = load("services/userAccessGuards.service.js", { "./hierarchy.service": { getDescendantUsers: async () => [] } });
  await assert.rejects(() => guard.assertReportingTargetInActorScope({ actingUser: managerUser, parentId: adminId, companyId }), /inside your own team/);
  await guard.assertReportingTargetInActorScope({ actingUser: managerUser, parentId: managerId, companyId });
  assert.throws(() => guard.assertNotSelfPromotion({ actingUser: managerUser, targetUserId: managerId }), /cannot change your own role/);
});

test("employee page overrides are isolated from colleagues and reset to role defaults", async () => {
  const access = loadAccessService();
  const restricted = await access.resolveAccessProfile({ ...managerUser, pageAccessOverride: [] });
  assert.equal(restricted.enforcePageAccess, true);
  assert.equal(access.canAccessPage(restricted, "leads"), false);
  assert.equal(access.canAccessPage(restricted, "dashboard"), true);
  const granted = await access.resolveAccessProfile({ ...managerUser, pageAccessOverride: ["projects"] });
  assert.equal(access.canAccessPage(granted, "projects"), true);
  assert.equal(access.canAccessPage(granted, "leads"), false);
  const colleague = await access.resolveAccessProfile({ ...managerUser, _id: targetUserId });
  assert.equal(colleague.enforcePageAccess, false);
  const reset = await access.resolveAccessProfile({ ...managerUser, pageAccessOverride: null });
  sameShape(reset, colleague);
});

test("employee revocation removes inherited page permission strings", async () => {
  const access = loadAccessService({ rolePermission: { permissions: ["page.leads.view", "users.view"] } });
  const profile = await access.resolveAccessProfile({ ...managerUser, pageAccessOverride: [] });
  assert.equal(access.canAccessPage(profile, "leads"), false);
  assert.equal(profile.permissions.includes("users.view"), true);
});

test("individual coworking grants satisfy navigation and API read gates without granting writes", async () => {
  const { pathToFileURL } = require("node:url");
  const { getVisibleSidebarGroups } = await import(pathToFileURL(path.resolve(__dirname, "../../frontend/src/components/workbench/workbenchNavigation.js")).href);
  const access = loadAccessService();
  const employee = { ...managerUser, role: "FIELD_EXECUTIVE" };
  const profile = await access.resolveAccessProfile({ ...employee, pageAccessOverride: ["coworking_booking", "coworking_clients"] });
  const visiblePages = getVisibleSidebarGroups(employee.role, profile).flatMap((group) => group.items.map((item) => item.page));
  assert.equal(visiblePages.includes("coworking_booking"), true);
  assert.equal(visiblePages.includes("coworking_clients"), true);
  for (const permission of ["page.coworking_booking.view", "page.coworking_clients.view", "cabins.view", "bookings.view", "seats.view", "clients.view"]) {
    assert.equal(profile.permissions.includes(permission), true, permission);
    assert.equal(await access.hasPermission({ ...employee, pageAccessOverride: ["coworking_booking", "coworking_clients"] }, permission), true);
  }
  for (const permission of ["cabins.create", "bookings.create", "clients.update", "clients.delete"]) {
    assert.equal(profile.permissions.includes(permission), false, permission);
  }
  const revoked = await access.resolveAccessProfile({ ...employee, pageAccessOverride: [] });
  const revokedPages = getVisibleSidebarGroups(employee.role, revoked).flatMap((group) => group.items.map((item) => item.page));
  assert.equal(revokedPages.includes("coworking_booking"), false);
  assert.equal(revokedPages.includes("coworking_clients"), false);
  assert.equal(revoked.permissions.includes("cabins.view"), false);
  assert.equal(revoked.permissions.includes("clients.view"), false);
  const colleague = await access.resolveAccessProfile(employee);
  assert.equal(colleague.permissions.includes("cabins.view"), false);
  assert.equal(colleague.permissions.includes("clients.view"), false);
  const clientsOnly = await access.resolveAccessProfile({ ...employee, pageAccessOverride: ["coworking_clients"] });
  assert.equal(clientsOnly.permissions.includes("clients.view"), true);
  assert.equal(clientsOnly.permissions.includes("cabins.view"), false);
});

test("employee page updates validate pages, scope the tenant, and support reset", async () => {
  let saved = 0;
  let filter;
  const user = { ...managerUser, save: async () => { saved += 1; } };
  const controller = load("controllers/userPageAccess.controller.js", {
    mongoose: mongooseStub,
    "../models/User": { findOne: async (value) => { filter = value; return user; } },
    "../services/access.service": { resolveAccessProfile: async () => ({ pages: [] }), invalidateAccessCache() {} },
    "../services/auditLog.service": auditStub,
  });
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  const req = { params: { userId: managerId }, user: adminUser, body: { pageKeys: ["unknown"] } };
  await controller.handle(true)(req, res);
  assert.equal(res.code, 400);
  assert.equal(saved, 0);
  sameShape(filter, { _id: managerId, companyId });
  req.body.pageKeys = ["projects", "projects"];
  await controller.handle(true)(req, res);
  sameShape(user.pageAccessOverride, ["projects"]);
  req.body.pageKeys = null;
  await controller.handle(true)(req, res);
  assert.equal(user.pageAccessOverride, null);
  assert.equal(saved, 2);
  user.role = "ADMIN";
  await controller.handle(true)(req, res);
  assert.equal(res.code, 400);
  assert.equal(saved, 2);
});

/* ------------------------- page access catalogue ------------------------- */

test("page permissions imply view and always keep profile reachable", () => {
  const pages = require("../src/constants/page.constants");
  const granted = pages.toPagePermissions([{ pageKey: "leads", actions: ["edit"] }]);

  assert.ok(granted.includes("page.leads.view"), "editing a page implies viewing it");
  assert.ok(granted.includes("page.leads.edit"));
  assert.ok(granted.includes("page.profile.view"), "profile can never be revoked");
  assert.ok(!granted.includes("page.inventory.view"));

  // Unknown pages and unknown actions are dropped rather than trusted.
  sameShape(
    pages.toPagePermissions([{ pageKey: "not_a_page", actions: ["view"] }]).sort(),
    ["page.dashboard.view", "page.profile.view"],
  );
  assert.ok(!pages.toPagePermissions([{ pageKey: "leads", actions: ["approve"] }])
    .includes("page.leads.approve"));
});

const loadPageGuard = (profile) =>
  load("middleware/pageAccess.middleware.js", {
    "../services/access.service": {
      resolveAccessProfile: async () => profile,
      canAccessPage: (accessProfile, pageKey) =>
        accessProfile.isAdmin
        || !accessProfile.enforcePageAccess
        || accessProfile.permissions.includes(`page.${pageKey}.view`),
    },
  });

const runGuard = async (guard, user) => {
  let nextCalled = false;
  const res = {
    code: 200, body: null,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await guard({ user }, res, () => { nextCalled = true; });
  return { nextCalled, res };
};

test("the page guard lets unenforced roles through untouched", async () => {
  const guard = loadPageGuard({ isAdmin: false, enforcePageAccess: false, permissions: [] })
    .requirePageAccess("leads", "my_leads");

  const { nextCalled } = await runGuard(guard, { _id: targetUserId, role: "EXECUTIVE" });
  assert.equal(nextCalled, true, "migrated system roles must not lose API access");
});

test("the page guard blocks a restricted role at the API, not just in the UI", async () => {
  const profile = {
    isAdmin: false,
    enforcePageAccess: true,
    permissions: ["page.leads.view", "page.inventory.view", "page.profile.view"],
  };

  const allowed = await runGuard(
    loadPageGuard(profile).requirePageAccess("leads", "my_leads"),
    { _id: targetUserId, role: "EXECUTIVE" },
  );
  assert.equal(allowed.nextCalled, true);

  const denied = await runGuard(
    loadPageGuard(profile).requirePageAccess("chat"),
    { _id: targetUserId, role: "EXECUTIVE" },
  );
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.res.code, 403);
  sameShape(denied.res.body.pages, ["chat"]);
});

const loadModuleGate = (profile) =>
  load("middleware/pageAccess.middleware.js", {
    "../services/access.service": {
      resolveAccessProfile: async () => profile,
      canAccessPage: (accessProfile, pageKey) =>
        accessProfile.isAdmin
        || !accessProfile.enforcePageAccess
        || accessProfile.permissions.includes(`page.${pageKey}.view`),
    },
  });

test("a configured role reaches a module its built-in role never had", async () => {
  // A Production Executive is not in the projects module's role list, but an
  // Admin has granted the role the Projects page.
  const guard = loadModuleGate({
    isAdmin: false,
    enforcePageAccess: true,
    permissions: ["page.projects.view", "page.tasks.view", "page.profile.view"],
  }).checkRoleOrPageAccess(["ADMIN", "MANAGER", "EXECUTIVE"], "projects");

  const granted = await runGuard(guard, { _id: targetUserId, role: "PRODUCTION_EXECUTIVE" });
  assert.equal(granted.nextCalled, true, "the grant has to reach the API, not just the sidebar");
});

test("an unconfigured role cannot widen into a module", async () => {
  // Same base role, but no explicit page configuration: the built-in role list
  // is still the only answer, so nothing changes for legacy accounts.
  const guard = loadModuleGate({
    isAdmin: false,
    enforcePageAccess: false,
    permissions: ["page.projects.view"],
  }).checkRoleOrPageAccess(["ADMIN", "MANAGER", "EXECUTIVE"], "projects");

  const denied = await runGuard(guard, { _id: targetUserId, role: "PRODUCTION_EXECUTIVE" });
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.res.code, 403);
});

test("a configured role without the grant is still refused, and listed roles always pass", async () => {
  const withoutGrant = loadModuleGate({
    isAdmin: false,
    enforcePageAccess: true,
    permissions: ["page.tasks.view"],
  }).checkRoleOrPageAccess(["ADMIN", "MANAGER"], "projects");

  const denied = await runGuard(withoutGrant, { _id: targetUserId, role: "PRODUCTION_EXECUTIVE" });
  assert.equal(denied.res.code, 403);

  // A role on the built-in list is admitted without consulting the profile at
  // all, so this path cannot regress for existing accounts.
  const exploding = load("middleware/pageAccess.middleware.js", {
    "../services/access.service": {
      resolveAccessProfile: async () => { throw new Error("must not be consulted"); },
      canAccessPage: () => false,
    },
  }).checkRoleOrPageAccess(["ADMIN", "MANAGER"], "projects");

  const allowed = await runGuard(exploding, { _id: managerId, role: "MANAGER" });
  assert.equal(allowed.nextCalled, true);
});

/* ---------- granted pages also have to return data, not 403 ---------- */

const leadObjectId = "222222222222222222222222";

const loadLeadScope = (profile) =>
  load(
    "controllers/lead.controller.js",
    {
      "../models/Lead": {},
      "../models/User": {},
      "../models/Inventory": {},
      "../models/leadActivity.model": {},
      "../models/leadDiary.model": {},
      "../models/LeadStatusRequest": {},
      "../config/logger": { error: () => {}, warn: () => {}, info: () => {} },
      "../services/access.service": { resolveAccessProfile: async () => profile },
      "../services/leadAssignment.service": { autoAssignLead: async () => null },
      "../services/hierarchy.service": {
        getAncestorByRoles: async () => null,
        getDescendantExecutiveIds: async () => [],
      },
    },
    "\nmodule.exports.testLeadScope = buildLeadQueryForUser;",
  ).testLeadScope;

const productionUser = {
  _id: leadObjectId,
  companyId,
  role: "PRODUCTION_EXECUTIVE",
  roleType: "BOTH",
};

test("a role never granted the Leads page is still refused", async () => {
  const scope = await loadLeadScope({
    enforcePageAccess: false,
    permissions: ["page.leads.view"],
    dataScope: "ALL",
  })(productionUser);

  assert.equal(scope, null, "an unconfigured role must keep the behaviour it had");
});

test("a role granted the Leads page gets its own records instead of Access denied", async () => {
  const scope = await loadLeadScope({
    enforcePageAccess: true,
    permissions: ["page.leads.view", "page.profile.view"],
    dataScope: "ASSIGNED",
  })(productionUser);

  assert.notEqual(scope, null, "the grant has to produce a query, not a 403");
  assert.equal(String(scope.companyId), companyId);
  assert.equal(scope.$or.length, 2, "assigned to me, or created by me");
  assert.equal(String(scope.$or[0].assignedTo), String(productionUser._id));
  assert.equal(String(scope.$or[1].createdBy), String(productionUser._id));
});

test("an explicit ALL data scope widens the granted role to the whole tenant", async () => {
  const scope = await loadLeadScope({
    enforcePageAccess: true,
    permissions: ["page.my_leads.view"],
    dataScope: "ALL",
  })(productionUser);

  assert.equal(String(scope.companyId), companyId);
  assert.equal(scope.$or, undefined, "ALL is an instruction only an Admin can set");
});

test("built-in lead roles are unaffected by the grant path", async () => {
  // The profile says "no access"; an EXECUTIVE must still get its own scope
  // from the branch above, never from the new fallback.
  const scope = await loadLeadScope({
    enforcePageAccess: false,
    permissions: [],
    dataScope: "SELF",
  })({ _id: leadObjectId, companyId, role: "EXECUTIVE", roleType: "BOTH" });

  assert.equal(String(scope.assignedTo), String(leadObjectId));
});

const loadInventoryScope = (profile) =>
  load(
    "services/inventoryWorkflow.service.js",
    {
      "../models/User": { findOne: () => query(null) },
      "./access.service": { resolveAccessProfile: async () => profile },
    },
    "\nmodule.exports.testInventoryScope = getInventoryScopeQueryForUser;",
  ).testInventoryScope;

test("inventory refuses an ungranted role and scopes a granted one", async () => {
  const ungranted = loadInventoryScope({
    enforcePageAccess: false,
    permissions: ["page.inventory.view"],
  });
  await assert.rejects(() => ungranted(productionUser), /Access denied/);

  const granted = loadInventoryScope({
    enforcePageAccess: true,
    permissions: ["page.inventory.view"],
  });
  const scope = await granted({ ...productionUser, roleType: "COMMERCIAL" });

  assert.equal(String(scope.companyId), companyId);
  assert.equal(
    scope.inventoryType,
    "COMMERCIAL",
    "the account's vertical still narrows what it sees",
  );
});
