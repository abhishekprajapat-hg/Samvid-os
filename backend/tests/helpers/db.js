const mongoose = require("mongoose");

const TEST_DB_NAME_PATTERN = /(^|[_-])(test|vitest|integration|e2e)([_-]|$)/i;
const LOCAL_TEST_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const parseMongoUri = (uri) => {
  if (!uri) {
    throw new Error("MONGO_TEST_URI is required for backend tests");
  }

  const parsed = new URL(uri);
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, "").split("/")[0] || "");
  const hosts = parsed.host
    .split(",")
    .map((host) => host.split(":")[0].replace(/^\[|\]$/g, "").toLowerCase())
    .filter(Boolean);

  return { dbName, hosts };
};

const assertSafeTestMongoUri = (uri) => {
  const { dbName, hosts } = parseMongoUri(uri);

  if (!dbName || !TEST_DB_NAME_PATTERN.test(dbName)) {
    throw new Error(
      `Refusing to run tests against non-test Mongo database "${dbName || "(missing)"}"`,
    );
  }

  const unsafeHosts = hosts.filter((host) => !LOCAL_TEST_HOSTS.has(host));
  if (unsafeHosts.length) {
    throw new Error(
      `Refusing to run tests against non-local Mongo host(s): ${unsafeHosts.join(", ")}`,
    );
  }

  return { dbName, hosts };
};

const connectTestDb = async () => {
  const uri = process.env.MONGO_TEST_URI;
  assertSafeTestMongoUri(uri);

  if (mongoose.connection.readyState === 1) return;

  await mongoose.connect(uri, {
    autoIndex: true,
    serverSelectionTimeoutMS: Number(process.env.MONGO_TEST_SERVER_SELECTION_TIMEOUT_MS || 5000),
  });
};

const clearTestDb = async () => {
  if (mongoose.connection.readyState !== 1) return;

  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
};

const disconnectTestDb = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

module.exports = {
  assertSafeTestMongoUri,
  connectTestDb,
  clearTestDb,
  disconnectTestDb,
};
