const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

/*
 * Business rule (29 Sep 2026): a Manager can do everything an Admin can,
 * except delete - every delete by a Manager needs Admin approval. Admins set
 * each Manager's page access; Managers set page access for staff below them
 * but can never hand out delete.
 *
 * Same isolation approach as page-access.test.cjs: real modules, stubbed
 * repositories, no database.
 */

const companyId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const adminId = "bbbbbbbbbbbbbbbbbbbbbbbb";
const managerId = "cccccccccccccccccccccccc";
const otherManagerId = "dddddddddddddddddddddddd";
const executiveId = "eeeeeeeeeeeeeeeeeeeeeeee";
const taskId = "111111111111111111111111";
const requestId = "222222222222222222222222";

const adminUser = { _id: adminId, companyId, role: "ADMIN", name: "Admin" };
const managerUser = { _id: managerId, companyId, role: "MANAGER", name: "Manager" };

const query = (value) => ({
  select() { return this; },
  populate() { return this; },
  sort() { return this; },
  limit() { return this; },
  lean() { return Promise.resolve(value); },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
});

const load = (relative, stubs = {}) => {
  const filename = path.resolve(__dirname, "../src", relative);
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module,
    exports: module.exports,
    require: (name) => (name in stubs ? stubs[name] : localRequire(name)),
    process,
    console,
    Date,
    setTimeout,
    clearTimeout,
    Promise,
  }, { filename });
  return module.exports;
};

const mongooseStub = { Types: { ObjectId: { isValid: (value) => /^[a-f0-9]{24}$/i.test(String(value)) } } };
const auditStub = { writeAuditLog: async () => {} };

/* ---------- a tiny in-memory RecordDeleteRequest ---------- */
const makeRequestStore = () => {
  const rows = [];
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => {
    if (key === "$or") return value.some((part) => matches(row, part));
    if (value && typeof value === "object" && "$lt" in value) return row[key] && row[key] < value.$lt;
    if (value === null) return row[key] === null || row[key] === undefined;
    return String(row[key]) === String(value);
  });
  const withSave = (row) => {
    Object.defineProperty(row, "save", { value: async () => row, enumerable: false, configurable: true });
    return row;
  };
  const Model = {
    rows,
    findOne: (filter) => query(rows.find((row) => matches(row, filter)) || null),
    findById: (id) => query(rows.find((row) => String(row._id) === String(id)) || null),
    find: (filter) => query(rows.filter((row) => matches(row, filter))),
    create: async (doc) => {
      const row = withSave({ _id: rows.length ? `${requestId.slice(0, 23)}${rows.length}` : requestId, processingAt: null, createdAt: new Date(), ...doc });
      rows.push(row);
      return row;
    },
    findOneAndUpdate: async (filter, update) => {
      const row = rows.find((candidate) => matches(candidate, filter));
      if (!row) return null;
      Object.assign(row, update.$set || {});
      return row;
    },
    updateOne: async (filter, update) => {
      const row = rows.find((candidate) => matches(candidate, filter));
      if (row) Object.assign(row, update.$set || {});
    },
  };
  return Model;
};

const loadDeleteApproval = (store) => load("services/deleteApproval.service.js", {
  mongoose: mongooseStub,
  "../models/RecordDeleteRequest": store,
  "./auditLog.service": auditStub,
});

const response = () => ({
  code: 200,
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; },
});

const fakeApp = { get: () => null };

test("a Manager's delete becomes a pending request and nothing is deleted", async () => {
  const store = makeRequestStore();
  const service = loadDeleteApproval(store);
  let deleted = 0;
  const gate = service.requireAdminApprovalForDelete("task-test", {
    label: "Task",
    pageKey: "tasks",
    idParam: "taskId",
    handler: async (req, res) => { deleted += 1; res.json({ message: "Task successfully deleted" }); },
    describe: async ({ id }) => (id === taskId ? "Call the owner" : null),
  });

  const res = response();
  let passed = false;
  await gate({ user: managerUser, params: { taskId }, query: {}, body: { reason: "duplicate" }, originalUrl: `/api/tasks/${taskId}`, app: fakeApp }, res, () => { passed = true; });

  assert.equal(passed, false, "the handler must not run for a Manager");
  assert.equal(deleted, 0);
  assert.equal(res.code, 202);
  assert.equal(res.body.approvalRequired, true);
  assert.equal(store.rows.length, 1);
  assert.equal(store.rows[0].status, "PENDING");
  assert.equal(store.rows[0].entityName, "Call the owner");
  assert.equal(store.rows[0].reason, "duplicate");
  assert.equal(String(store.rows[0].requestedBy), managerId);

  // Asking again returns the same request instead of a second one.
  const again = response();
  await gate({ user: managerUser, params: { taskId }, query: {}, body: {}, originalUrl: `/api/tasks/${taskId}`, app: fakeApp }, again, () => {});
  assert.equal(again.code, 202);
  assert.equal(store.rows.length, 1);

  // A record that does not exist is refused, not queued.
  const missing = response();
  await gate({ user: managerUser, params: { taskId: "333333333333333333333333" }, query: {}, body: {}, app: fakeApp }, missing, () => {});
  assert.equal(missing.code, 404);
  assert.equal(store.rows.length, 1);
});

test("Admins and other roles are not intercepted", async () => {
  const service = loadDeleteApproval(makeRequestStore());
  const gate = service.requireAdminApprovalForDelete("task-pass", { handler: async () => {}, idParam: "taskId" });
  for (const user of [adminUser, { _id: executiveId, companyId, role: "EXECUTIVE" }]) {
    let passed = false;
    // eslint-disable-next-line no-await-in-loop
    await gate({ user, params: { taskId }, app: fakeApp }, response(), () => { passed = true; });
    assert.equal(passed, true, `${user.role} should reach the route handler`);
  }
});

test("an Admin's approval runs the delete as the Admin; a Manager cannot approve", async () => {
  const store = makeRequestStore();
  const service = loadDeleteApproval(store);
  const calls = [];
  const gate = service.requireAdminApprovalForDelete("task-approve", {
    label: "Task",
    idParam: "taskId",
    handler: async (req, res) => {
      calls.push({ role: req.user.role, taskId: req.params.taskId, method: req.method });
      res.status(200).json({ message: "Task successfully deleted" });
    },
    describe: async () => "Call the owner",
  });
  await gate({ user: managerUser, params: { taskId }, query: {}, body: {}, app: fakeApp }, response(), () => {});
  const pendingId = store.rows[0]._id;

  await assert.rejects(
    () => service.approveDeleteRequest({ req: { user: managerUser, app: fakeApp }, requestId: pendingId }),
    /Only an Admin/,
  );
  assert.equal(calls.length, 0);

  const approved = await service.approveDeleteRequest({ req: { user: adminUser, app: fakeApp, params: {} }, requestId: pendingId });
  assert.equal(approved.status, "APPROVED");
  assert.deepEqual(calls, [{ role: "ADMIN", taskId, method: "DELETE" }]);
  assert.equal(String(store.rows[0].reviewedBy), adminId);

  // Approving twice does not delete twice.
  await assert.rejects(
    () => service.approveDeleteRequest({ req: { user: adminUser, app: fakeApp }, requestId: pendingId }),
    /already approved/,
  );
  assert.equal(calls.length, 1);
});

test("a refused delete stays pending with the reason; reject and cancel close it", async () => {
  const store = makeRequestStore();
  const service = loadDeleteApproval(store);
  const gate = service.requireAdminApprovalForDelete("role-refused", {
    label: "Custom role",
    idParam: "roleId",
    handler: async (req, res) => res.status(409).json({ message: "2 user(s) are on this role. Move them to another role first." }),
    describe: async () => "Senior Sales",
  });
  await gate({ user: managerUser, params: { roleId: taskId }, query: {}, body: {}, app: fakeApp }, response(), () => {});
  const pendingId = store.rows[0]._id;

  await assert.rejects(
    () => service.approveDeleteRequest({ req: { user: adminUser, app: fakeApp }, requestId: pendingId }),
    (error) => error.statusCode === 409 && /Move them/.test(error.message),
  );
  assert.equal(store.rows[0].status, "PENDING");
  assert.equal(store.rows[0].processingAt, null);

  await assert.rejects(
    () => service.cancelDeleteRequest({ req: { user: { ...managerUser, _id: otherManagerId }, app: fakeApp }, requestId: pendingId }),
    /Only the person who asked/,
  );
  const rejected = await service.rejectDeleteRequest({ req: { user: adminUser, app: fakeApp }, requestId: pendingId, note: "Keep it" });
  assert.equal(rejected.status, "REJECTED");
  assert.equal(rejected.reviewNote, "Keep it");
});

test("a Manager sees only their own requests; an Admin sees the company's", async () => {
  const store = makeRequestStore();
  const service = loadDeleteApproval(store);
  store.rows.push(
    { _id: "1", companyId, requestedBy: managerId, status: "PENDING", actionType: "task", entityId: taskId },
    { _id: "2", companyId, requestedBy: otherManagerId, status: "PENDING", actionType: "task", entityId: requestId },
  );
  assert.equal((await service.listDeleteRequests({ user: adminUser })).length, 2);
  const own = await service.listDeleteRequests({ user: managerUser });
  assert.equal(own.length, 1);
  assert.equal(String(own[0]._id), "1");
});

/* ---------- Manager = Admin access, minus delete ---------- */

test("a Manager starts with every page and action an Admin has", () => {
  const { buildFullPageAccess } = require("../src/constants/page.constants");
  const { getDefaultPageAccessForRole, getDefaultDataScopeForRole } = require("../src/constants/rolePageAccess.constants");
  // Everything but the executives' own "My Leads" view, which Admins do not use either.
  assert.equal(
    JSON.stringify(getDefaultPageAccessForRole("MANAGER")),
    JSON.stringify(buildFullPageAccess().filter((entry) => entry.pageKey !== "my_leads")),
  );
  assert.equal(
    getDefaultPageAccessForRole("MANAGER").every((entry) => entry.actions.includes("view")),
    true,
  );
  assert.equal(getDefaultDataScopeForRole("MANAGER"), "ALL");
});

const loadAccessService = () => load("services/access.service.js", {
  mongoose: mongooseStub,
  "../models/RolePermission": { findOne: () => query(null) },
});

test("a Manager can pass on access they hold, but never a new delete", async () => {
  const access = loadAccessService();
  await access.assertGrantablePermissions({ actor: managerUser, permissions: ["page.tasks.view", "page.tasks.edit"] });
  await assert.rejects(
    () => access.assertGrantablePermissions({ actor: managerUser, permissions: ["page.tasks.view", "page.tasks.delete"] }),
    /Only an Admin can give delete access/,
  );
  await assert.rejects(
    () => access.assertGrantablePermissions({ actor: managerUser, permissions: ["clients.delete"] }),
    /Only an Admin can give delete access/,
  );
  // Keeping a delete the person already has is not a new grant.
  await access.assertGrantablePermissions({
    actor: managerUser,
    permissions: ["page.tasks.view", "page.tasks.delete"],
    existing: ["page.tasks.view", "page.tasks.delete"],
  });
  // An Admin may grant anything.
  await access.assertGrantablePermissions({ actor: adminUser, permissions: ["page.tasks.delete", "users.delete"] });
});

/* ---------- per-person page access ---------- */

const loadPageAccessController = (users) => {
  const accessService = loadAccessService();
  return load("controllers/userPageAccess.controller.js", {
    mongoose: mongooseStub,
    "../models/User": {
      findOne: async (filter) => {
        const found = users.find((user) => String(user._id) === String(filter._id));
        if (!found) return null;
        const doc = { ...found };
        Object.defineProperty(doc, "save", { value: async () => { Object.assign(found, doc); }, enumerable: false });
        Object.defineProperty(doc, "toObject", { value: () => ({ ...doc }), enumerable: false });
        return doc;
      },
    },
    "../services/access.service": accessService,
    "../services/auditLog.service": auditStub,
  });
};

test("Admin sets a Manager's page access; a Manager sets staff access but not a Manager's or their own", async () => {
  const people = [
    { ...managerUser, pageAccessOverride: null },
    { _id: otherManagerId, companyId, role: "MANAGER", pageAccessOverride: null },
    { _id: executiveId, companyId, role: "EXECUTIVE", pageAccessOverride: null },
  ];
  const controller = loadPageAccessController(people);
  const patch = (actor, userId, pageAccess) => {
    const res = response();
    return controller.handle(true)({ user: actor, params: { userId }, body: { pageAccess } }, res).then(() => res);
  };

  // Admin narrows a Manager: tasks without delete.
  const byAdmin = await patch(adminUser, otherManagerId, [{ pageKey: "tasks", actions: ["view", "edit"] }]);
  assert.equal(byAdmin.code, 200, JSON.stringify(byAdmin.body));
  assert.equal(byAdmin.body.deleteNeedsApproval, true);
  assert.equal(JSON.stringify(people[1].pageAccessOverride), JSON.stringify([{ pageKey: "tasks", actions: ["view", "edit"] }]));

  assert.equal((await patch(managerUser, otherManagerId, [])).code, 403, "a Manager cannot edit another Manager");
  assert.equal((await patch(managerUser, managerId, [])).code, 403, "a Manager cannot edit themselves");

  const staff = await patch(managerUser, executiveId, [{ pageKey: "projects", actions: ["view", "edit"] }]);
  assert.equal(staff.code, 200, JSON.stringify(staff.body));
  assert.equal(staff.body.canGrantDelete, false);

  const withDelete = await patch(managerUser, executiveId, [{ pageKey: "projects", actions: ["view", "delete"] }]);
  assert.equal(withDelete.code, 403);
  assert.match(withDelete.body.message, /Only an Admin can give delete access/);
});

/* ---------- reporting line ---------- */

test("every role except Admin reports to a Manager; a Manager reports to an Admin", () => {
  const {
    USER_ROLES,
    getAllowedParentRoles,
    getAutoParentRoles,
  } = require("../src/constants/role.constants");
  for (const role of Object.values(USER_ROLES)) {
    if (role === USER_ROLES.ADMIN) {
      assert.deepEqual(getAllowedParentRoles(role), []);
      continue;
    }
    const expected = role === USER_ROLES.MANAGER ? [USER_ROLES.ADMIN] : [USER_ROLES.MANAGER];
    assert.deepEqual(getAllowedParentRoles(role), expected, `${role} reports to`);
    assert.deepEqual(getAutoParentRoles(role), expected, `${role} is auto-assigned to`);
  }
});
