const { connectTestDb, clearTestDb, disconnectTestDb } = require("./helpers/db");

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX || "1000";
process.env.API_RATE_LIMIT_MAX = process.env.API_RATE_LIMIT_MAX || "10000";
process.env.WRITE_RATE_LIMIT_MAX = process.env.WRITE_RATE_LIMIT_MAX || "10000";
process.env.CHAT_RATE_LIMIT_MAX = process.env.CHAT_RATE_LIMIT_MAX || "10000";
process.env.WEBHOOK_RATE_LIMIT_MAX = process.env.WEBHOOK_RATE_LIMIT_MAX || "10000";

const isUnitOnlyRun =
  process.env.npm_lifecycle_event === "test:unit"
  || process.argv.some((arg) => /tests[\\/]+unit/.test(arg));

beforeAll(async () => {
  if (isUnitOnlyRun) return;
  await connectTestDb();
});

beforeEach(async () => {
  if (isUnitOnlyRun) return;
  await clearTestDb();
});

afterAll(async () => {
  if (isUnitOnlyRun) return;
  await clearTestDb();
  await disconnectTestDb();
});
