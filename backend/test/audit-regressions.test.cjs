const test = require("node:test");
const assert = require("node:assert/strict");

/*
 * Regression cover for the defects found in the 2026-09 QA audit.
 *
 * Each block names the behaviour that was wrong and pins the corrected one, so
 * a future change that reintroduces the bug fails here rather than in
 * production. Everything is either a pure function or a hand-rolled req/res, so
 * no database is involved.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || "audit-regression-secret";

const { parsePagination } = require("../src/utils/queryOptions");
const { toHttpError } = require("../src/utils/mongooseError");
const {
  signFileUrlToken,
  signFileSessionToken,
  verifyFileToken,
  withFileToken,
  normalizeFilePath,
} = require("../src/utils/fileAccessToken");
const { requireFileAccess } = require("../src/middleware/fileAccess.middleware");

/* ------------------------------------------------------------------ *
 * CRM-BUG-001 - a list request must never be able to return everything
 * ------------------------------------------------------------------ */

test("pagination applies even when the caller asks for no page", () => {
  // Was: no page/limit -> { enabled: false } -> controllers skipped
  // .skip()/.limit() and streamed the whole collection (1,195 leads, 2.7MB).
  const page = parsePagination({}, { defaultLimit: 50, maxLimit: 200 });
  assert.equal(page.enabled, true, "pagination must not be optional");
  assert.equal(page.limit, 50);
  assert.equal(page.skip, 0);
  assert.equal(page.explicit, false, "we can still tell that the caller did not ask");
});

test("pagination caps an oversized limit at maxLimit", () => {
  assert.equal(parsePagination({ limit: "100000" }, { maxLimit: 200 }).limit, 200);
});

test("pagination survives array-valued page and limit parameters", () => {
  // Was: ?limit[]=5&limit[]=9 left query.limit undefined, which took the
  // "no pagination" path and returned every row.
  const bracket = parsePagination({ "limit[]": ["5", "9"] }, { defaultLimit: 50, maxLimit: 200 });
  assert.equal(bracket.limit, 5);

  const repeated = parsePagination({ limit: ["5", "9"], page: ["2"] }, { defaultLimit: 50, maxLimit: 200 });
  assert.equal(repeated.limit, 5);
  assert.equal(repeated.page, 2);
});

test("pagination falls back to defaults for junk values", () => {
  for (const limit of ["abc", "-5", "0", ""]) {
    const page = parsePagination({ limit }, { defaultLimit: 50, maxLimit: 200 });
    assert.equal(page.limit, 50, `limit=${JSON.stringify(limit)} should fall back`);
    assert.ok(page.limit <= 200);
  }
});

/* ------------------------------------------------------------------ *
 * CRM-BUG-009 / 024 - a bad payload is a 400, not a 500
 * ------------------------------------------------------------------ */

test("a Mongoose validation error maps to 400 naming the field", () => {
  const error = Object.assign(new Error("User validation failed"), {
    name: "ValidationError",
    errors: { name: { kind: "required", path: "name" } },
  });
  const mapped = toHttpError(error);
  assert.equal(mapped.status, 400);
  assert.match(mapped.message, /Name is required/);
});

test("a short password reports its minimum length", () => {
  const error = Object.assign(new Error("failed"), {
    name: "ValidationError",
    errors: { password: { kind: "minlength", path: "password", properties: { minlength: 6 } } },
  });
  assert.match(toHttpError(error).message, /at least 6 characters/);
});

test("an unsupported enum value maps to 400, not 500", () => {
  const error = Object.assign(new Error("failed"), {
    name: "ValidationError",
    errors: { status: { kind: "enum", path: "status" } },
  });
  assert.equal(toHttpError(error).status, 400);
});

test("a duplicate key maps to 409 Conflict", () => {
  const error = Object.assign(new Error("dup"), { code: 11000, keyPattern: { email: 1 } });
  const mapped = toHttpError(error);
  assert.equal(mapped.status, 409);
  assert.match(mapped.message, /already in use/);
});

test("a genuine server fault is left alone as a 500", () => {
  assert.equal(toHttpError(new Error("connection reset")), null);
});

/* ------------------------------------------------------------------ *
 * CRM-BUG-002 - uploaded files need a credential
 * ------------------------------------------------------------------ */

const runFileGuard = async ({ path: filePath = "/chat/x.png", headers = {}, query = {} }) => {
  const req = { path: filePath, headers, query };
  const res = {
    code: null,
    body: null,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let nextCalled = false;
  await requireFileAccess(req, res, () => { nextCalled = true; });
  return { nextCalled, res };
};

test("an uploaded file is not served without a credential", async () => {
  // Was: express.static with no auth in front of it - lead documents and KYC
  // paperwork were readable by anyone holding the URL.
  const result = await runFileGuard({});
  assert.equal(result.nextCalled, false);
  assert.equal(result.res.code, 401);
});

test("the file-access cookie releases the file", async () => {
  const cookie = signFileSessionToken({ _id: "abc", companyId: "xyz" });
  const result = await runFileGuard({ headers: { cookie: `oor_file_access=${cookie}` } });
  assert.equal(result.nextCalled, true, "this is the credential <img> actually sends");
});

test("a forged cookie does not release the file", async () => {
  const result = await runFileGuard({ headers: { cookie: "oor_file_access=not.a.jwt" } });
  assert.equal(result.nextCalled, false);
  assert.equal(result.res.code, 401);
});

test("a per-file token only opens the file it was minted for", async () => {
  const token = signFileUrlToken("chat/wanted.png");
  const allowed = await runFileGuard({ path: "/chat/wanted.png", query: { t: token } });
  assert.equal(allowed.nextCalled, true);

  const replayed = await runFileGuard({ path: "/chat/other.png", query: { t: token } });
  assert.equal(replayed.nextCalled, false, "a share-link token must not unlock the whole folder");
  assert.equal(replayed.res.code, 401);
});

test("a file token is not accepted as a staff session", () => {
  // authMiddleware.protect refuses any scoped token; assert the scope is set.
  const jwt = require("jsonwebtoken");
  const decoded = jwt.verify(signFileUrlToken("chat/x.png"), process.env.JWT_SECRET);
  assert.equal(decoded.scope, "files");
});

test("signing rewrites our own URLs and leaves foreign ones alone", () => {
  assert.match(withFileToken("/api/uploads/files/chat/a.png"), /^\/api\/uploads\/files\/chat\/a\.png\?t=/);
  // A historical absolute URL loses its baked-in host on the way through.
  assert.match(
    withFileToken("http://old-host:5000/api/uploads/files/chat/a.png"),
    /^\/api\/uploads\/files\/chat\/a\.png\?t=/,
  );
  const external = "https://res.cloudinary.com/demo/image/upload/v1/x.jpg";
  assert.equal(withFileToken(external), external, "an external CDN link must not be rewritten");
});

test("file paths normalise to the same key however they arrive", () => {
  const expected = "chat/a.png";
  assert.equal(normalizeFilePath("/api/uploads/files/chat/a.png"), expected);
  assert.equal(normalizeFilePath("http://host:5000/api/uploads/files/chat/a.png?t=zzz"), expected);
  assert.equal(normalizeFilePath("chat/a.png"), expected);
});

test("an expired file token is refused", () => {
  const jwt = require("jsonwebtoken");
  const expired = jwt.sign({ scope: "files", p: "chat/a.png" }, process.env.JWT_SECRET, { expiresIn: "-1h" });
  assert.equal(verifyFileToken(expired, "chat/a.png"), false);
});

/* ------------------------------------------------------------------ *
 * CRM-BUG-003 - the upload allowlist has to mean something
 * ------------------------------------------------------------------ */

test("the upload filter refuses types the allowlist does not name", () => {
  // Was: "application/octet-stream" sat in the allowlist, so an .html or .exe
  // declared as octet-stream was accepted and later served under its own
  // extension.
  const { upload } = require("../src/config/uploadStorage");
  const fileFilter = upload.fileFilter || upload.opts?.fileFilter;
  assert.ok(typeof fileFilter === "function", "multer must have a file filter");

  const check = (originalname, mimetype) =>
    new Promise((resolve) => {
      fileFilter({}, { originalname, mimetype }, (error, accepted) =>
        resolve({ rejected: Boolean(error), accepted: accepted === true }));
    });

  return Promise.all([
    check("photo.jpg", "image/jpeg").then((r) => assert.equal(r.accepted, true, "a real photo is fine")),
    check("doc.pdf", "application/pdf").then((r) => assert.equal(r.accepted, true, "a real pdf is fine")),
    check("payload.html", "application/octet-stream").then((r) => assert.equal(r.rejected, true, "octet-stream is no longer a wildcard")),
    check("tool.exe", "application/octet-stream").then((r) => assert.equal(r.rejected, true)),
    check("payload.svg", "image/svg+xml").then((r) => assert.equal(r.rejected, true, "svg carries script")),
    check("invoice.pdf.html", "application/octet-stream").then((r) => assert.equal(r.rejected, true, "the final extension is what gets served")),
    check("sneaky.html", "image/png").then((r) => assert.equal(r.rejected, true, "a truthful mime with a dangerous extension is still refused")),
  ]);
});

/* ------------------------------------------------------------------ *
 * CRM-BUG-007 - a destructive verb needs the destructive action
 * ------------------------------------------------------------------ */

// The middleware destructures resolveAccessProfile at require time, so the
// profile has to be stubbed as the module loads - the same vm approach
// page-access.test.cjs uses.
const loadPageAccess = (profile) => {
  const fs = require("node:fs");
  const path = require("node:path");
  const vm = require("node:vm");
  const { createRequire } = require("node:module");
  const filename = path.resolve(__dirname, "../src/middleware/pageAccess.middleware.js");
  const localRequire = createRequire(filename);
  const stubs = {
    "../services/access.service": {
      resolveAccessProfile: async () => profile,
      canAccessPage: (p, key) => p.isAdmin || !p.enforcePageAccess || p.permissions.includes(`page.${key}.view`),
    },
    "../config/logger": { warn() {}, info() {}, error() {} },
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module,
    exports: module.exports,
    require: (name) => (name in stubs ? stubs[name] : localRequire(name)),
    process,
    console,
    Date,
    String,
    Object,
    Array,
    JSON,
  });
  return module.exports;
};

const runVerbGuard = async (guard, method) => {
  const res = {
    code: null,
    status(code) { this.code = code; return this; },
    json() { return this; },
  };
  let nextCalled = false;
  await guard({ user: { _id: "u1" }, method, originalUrl: "/api/contacts/1" }, res, () => { nextCalled = true; });
  return { nextCalled, code: res.code };
};

test("DELETE is not satisfied by an edit grant", async () => {
  // Was: DELETE mapped to ["delete", "edit"], so a grant of
  // { inventory: [view, edit] } could hard-delete owner/broker records.
  const guard = loadPageAccess({
    isAdmin: false,
    enforcePageAccess: true,
    enforcementMode: "on",
    hasExplicitPageOverride: true,
    permissions: ["page.inventory.view", "page.inventory.edit"],
  }).requirePageActionForMethod("inventory");

  const deleted = await runVerbGuard(guard, "DELETE");
  assert.equal(deleted.nextCalled, false, "edit must not authorise a delete");
  assert.equal(deleted.code, 403);
  assert.equal((await runVerbGuard(guard, "PATCH")).nextCalled, true, "edit still authorises an edit");
  assert.equal((await runVerbGuard(guard, "GET")).nextCalled, true, "view still authorises a read");
});

test("DELETE is allowed once the delete action is granted", async () => {
  const guard = loadPageAccess({
    isAdmin: false,
    enforcePageAccess: true,
    enforcementMode: "on",
    hasExplicitPageOverride: true,
    permissions: ["page.inventory.view", "page.inventory.delete"],
  }).requirePageActionForMethod("inventory");

  assert.equal((await runVerbGuard(guard, "DELETE")).nextCalled, true);
});

test("a module gate widens only on an explicit page grant, never on role defaults", () => {
  // Enforcing role defaults must not turn every executive's default Inventory
  // page into permission for the Admin/Manager-only operations that
  // checkRoleOrPageAccess guards.
  const withDefaultsOnly = loadPageAccess({
    isAdmin: false,
    enforcePageAccess: true,
    enforcementMode: "on",
    hasExplicitPageOverride: false,
    permissions: ["page.inventory.view"],
  }).checkRoleOrPageAccess(["ADMIN", "MANAGER"], "inventory");

  return runVerbGuard(withDefaultsOnly, "GET").then((result) => {
    assert.equal(result.nextCalled, false, "role defaults must not widen a module gate");
    assert.equal(result.code, 403);
  });
});

/* ------------------------------------------------------------------ *
 * CRM-BUG-039 - an Admin must not be rate-limited by signing in normally
 * ------------------------------------------------------------------ */

test("the login contract lets an Admin sign in without a portal", async () => {
  /*
   * The shared sign-in page used to send portal:"GENERAL", which the API
   * refuses for an Admin, and the page then retried as "ADMIN". Because
   * authLimiter only skips responses under 400, that first 403 consumed one of
   * the 8-per-15-minutes slots, so eight ordinary sign-ins locked the Admin out
   * with "Too many failed auth attempts" and no wrong password anywhere.
   *
   * The portal rules themselves stay - this pins the two that matter: an
   * omitted portal must not be treated as "GENERAL", and the admin entrance
   * must still refuse a non-admin.
   */
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(
    path.resolve(__dirname, "../src/controllers/auth.controller.js"),
    "utf8",
  );

  // Both gates must compare against an explicit value, never a falsy default.
  assert.match(source, /portal === "ADMIN" && user\.role !== USER_ROLES\.ADMIN/,
    "the admin entrance must still refuse non-admins");
  assert.match(source, /portal === "GENERAL" && user\.role === USER_ROLES\.ADMIN/,
    "the general-portal rule is kept, but only for an explicit GENERAL");

  // And the sign-in page must not send GENERAL, or the 403 leg comes back.
  const loginPage = fs.readFileSync(
    path.resolve(__dirname, "../../frontend/src/components/auth/Login.jsx"),
    "utf8",
  );
  assert.match(
    loginPage,
    /loginPortal && loginPortal !== "GENERAL"/,
    "the shared sign-in page must omit the portal rather than send GENERAL",
  );
  assert.doesNotMatch(
    loginPage,
    /submitLogin\("ADMIN"\)/,
    "the retry-as-admin workaround should be gone, not just bypassed",
  );
});
