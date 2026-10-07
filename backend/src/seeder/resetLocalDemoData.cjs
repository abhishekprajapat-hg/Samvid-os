/**
 * Wipes every document from the LOCAL database so the demo seeder can start
 * from a clean slate. Collections and indexes are kept (deleteMany, not drop),
 * so the running API keeps its unique indexes.
 *
 * Before deleting, each collection is exported to
 * backend/.local-db-backups/<timestamp>/<collection>.json (Extended JSON).
 *
 * Refuses to run against anything that is not a loopback Mongo on a normal
 * port (never the VPS or the 27018 SSH tunnel). There is no override.
 *
 * Usage: npm run reset:local-demo   (wipe + seed)
 *        node src/seeder/resetLocalDemoData.cjs   (wipe only)
 */
require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const parseMongoTarget = (mongoUri) => {
  try {
    const parsed = new URL(String(mongoUri || "").replace(/^mongodb(\+srv)?:\/\//i, "http://"));
    return {
      protocolSrv: /^mongodb\+srv:/i.test(String(mongoUri || "")),
      host: parsed.hostname,
      port: parsed.port || "27017",
      dbName: decodeURIComponent(String(parsed.pathname || "").replace(/^\/+/, "").split("/")[0]),
    };
  } catch {
    return { protocolSrv: false, host: "", port: "", dbName: "" };
  }
};

const assertLocalTarget = () => {
  const target = parseMongoTarget(process.env.MONGO_URI);
  const isLoopback = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(String(target.host || "").toLowerCase());
  if (!process.env.MONGO_URI || target.protocolSrv || !isLoopback || target.port === "27018" || !target.dbName) {
    throw new Error(
      `Refusing to wipe: MONGO_URI must be a local Mongo (127.0.0.1/localhost, not port 27018) with a database name. Target: ${target.host || "unknown"}:${target.port || "unknown"}/${target.dbName || "unknown"}.`,
    );
  }
  return target;
};

const main = async () => {
  const target = assertLocalTarget();
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;
  console.log(`Connected to local database "${db.databaseName}" at ${target.host}:${target.port}.`);

  const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((name) => !name.startsWith("system."))
    .sort();

  // 1) Backup
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(__dirname, "..", "..", ".local-db-backups", stamp);
  fs.mkdirSync(backupDir, { recursive: true });
  const { EJSON } = mongoose.mongo.BSON;
  for (const name of collections) {
    const docs = await db.collection(name).find({}).toArray();
    fs.writeFileSync(path.join(backupDir, `${name}.json`), EJSON.stringify(docs, { relaxed: false }));
  }
  console.log(`Backup of ${collections.length} collections written to ${backupDir}`);

  // 2) Wipe
  const deleted = {};
  let total = 0;
  for (const name of collections) {
    const { deletedCount } = await db.collection(name).deleteMany({});
    if (deletedCount) deleted[name] = deletedCount;
    total += deletedCount;
  }
  console.log(`Deleted ${total} documents from ${collections.length} collections:`);
  console.log(JSON.stringify(deleted, null, 2));

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(`resetLocalDemoData failed: ${error.message}`);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
