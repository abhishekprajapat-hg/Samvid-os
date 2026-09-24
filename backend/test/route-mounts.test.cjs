const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

// Every router has to be reachable at BOTH /api/<name> and /api/client/<name>:
// the web and mobile clients talk to the /api/client namespace (see
// frontend/src/services/api.js, whose axios baseURL is "/api/client"), while
// /api/<name> is the direct mount. Adding a router to only one of them is a
// silent 404 that no unit test would catch, so this drives the real app.
//
// Unauthenticated requests are the probe: a mounted route answers 401 from
// authMiddleware.protect, a missing one falls through to the 404 handler. No
// database is involved either way.

process.env.JWT_SECRET = process.env.JWT_SECRET || "route-mount-test-secret";

const app = require("../src/app");

const listen = () =>
  new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });

const statusOf = (server, path) =>
  new Promise((resolve, reject) => {
    const request = http.request(
      { host: "127.0.0.1", port: server.address().port, path, method: "GET" },
      (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode));
      },
    );
    request.on("error", reject);
    request.end();
  });

// One representative GET per router. Each is behind protect, so an existing
// route answers 401 rather than 404.
const ROUTES = [
  "/access/me",
  "/access/users/111111111111111111111111/pages",
  "/users",
  "/leads",
  "/tasks",
  "/attendance/me",
  "/targets/my",
  "/inventory",
  "/projects",
  "/chat/rooms",
  "/coworking/permissions/me",
];

test("every API router is mounted under both /api and /api/client", async () => {
  const server = await listen();

  try {
    for (const route of ROUTES) {
      // eslint-disable-next-line no-await-in-loop
      const [direct, viaClient] = await Promise.all([
        statusOf(server, `/api${route}`),
        statusOf(server, `/api/client${route}`),
      ]);

      assert.notEqual(direct, 404, `GET /api${route} is not mounted`);
      assert.notEqual(
        viaClient,
        404,
        `GET /api/client${route} is not mounted — the web and mobile clients call this namespace`,
      );
    }
  } finally {
    server.close();
  }
});

test("an unknown route still answers 404 in both namespaces", async () => {
  const server = await listen();

  try {
    assert.equal(await statusOf(server, "/api/definitely-not-a-router"), 404);
    assert.equal(await statusOf(server, "/api/client/definitely-not-a-router"), 404);
  } finally {
    server.close();
  }
});
