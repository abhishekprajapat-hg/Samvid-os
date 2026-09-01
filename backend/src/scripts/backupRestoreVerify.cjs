require("dotenv").config({ quiet: true });

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SAFE_DB_MARKERS = ["test", "staging", "stage", "qa", "sandbox", "perf", "isolated"];
const DANGEROUS_URI_MARKERS = ["prod", "production", "vps"];

const fail = (message) => {
  throw new Error(message);
};

const parseMongoDbName = (mongoUri) => {
  try {
    const parsed = new URL(String(mongoUri || "").replace(/^mongodb(\+srv)?:\/\//i, "http://"));
    return decodeURIComponent(String(parsed.pathname || "").replace(/^\/+/, "").split("/")[0] || "");
  } catch {
    return "";
  }
};

const assertSafeMongoUri = (name, mongoUri) => {
  if (!mongoUri) fail(`${name} is required.`);
  if (process.env.NODE_ENV === "production") {
    fail("Refusing to run with NODE_ENV=production.");
  }
  if (String(process.env.CONFIRM_ISOLATED_STAGING || "").toLowerCase() !== "true") {
    fail("CONFIRM_ISOLATED_STAGING=true is required.");
  }

  const dbName = parseMongoDbName(mongoUri);
  if (!dbName) fail(`${name} must include an explicit database name.`);

  const normalizedUri = mongoUri.toLowerCase();
  const normalizedDb = dbName.toLowerCase();
  if (!SAFE_DB_MARKERS.some((marker) => normalizedDb.includes(marker))) {
    fail(`${name} database "${dbName}" must include one of: ${SAFE_DB_MARKERS.join(", ")}.`);
  }
  if (DANGEROUS_URI_MARKERS.some((marker) => normalizedUri.includes(marker))) {
    fail(`${name} contains a production/VPS marker; use isolated staging only.`);
  }
  return dbName;
};

const runCommand = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  if (result.error) fail(`${command} failed to start: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} exited with ${result.status}`);
};

const commandExists = (command) => {
  const checker = process.platform === "win32" ? "where" : "command";
  const args = process.platform === "win32" ? [command] : ["-v", command];
  const result = spawnSync(checker, args, {
    stdio: "ignore",
    shell: process.platform !== "win32",
  });
  return result.status === 0;
};

const run = () => {
  const sourceUri = process.env.STAGING_MONGO_URI;
  const restoreUri = process.env.RESTORE_MONGO_URI;
  const sourceDb = assertSafeMongoUri("STAGING_MONGO_URI", sourceUri);
  const restoreDb = assertSafeMongoUri("RESTORE_MONGO_URI", restoreUri);

  if (sourceUri === restoreUri || sourceDb === restoreDb) {
    fail("Restore target must be a completely separate empty database.");
  }
  if (String(process.env.CONFIRM_RESTORE_TARGET_EMPTY || "").toLowerCase() !== "true") {
    fail("CONFIRM_RESTORE_TARGET_EMPTY=true is required before restore.");
  }

  for (const command of ["mongodump", "mongorestore"]) {
    if (!commandExists(command)) {
      fail(`${command} is required on PATH.`);
    }
  }

  const backupRoot = process.env.BACKUP_DIR
    ? path.resolve(process.env.BACKUP_DIR)
    : path.join(os.tmpdir(), "samvid-os-backups");
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpDir = path.join(backupRoot, `${sourceDb}-${runId}`);
  fs.mkdirSync(dumpDir, { recursive: true });

  const startedAt = Date.now();
  runCommand("mongodump", ["--uri", sourceUri, "--out", dumpDir]);
  const backupFinishedAt = Date.now();
  runCommand("mongorestore", ["--uri", restoreUri, "--drop", path.join(dumpDir, sourceDb)]);
  const restoreFinishedAt = Date.now();

  const summary = {
    ok: true,
    sourceDb,
    restoreDb,
    dumpDir,
    backupSeconds: Number(((backupFinishedAt - startedAt) / 1000).toFixed(3)),
    restoreSeconds: Number(((restoreFinishedAt - backupFinishedAt) / 1000).toFixed(3)),
    recoveryPoint: new Date(backupFinishedAt).toISOString(),
    recoveryTimeSeconds: Number(((restoreFinishedAt - startedAt) / 1000).toFixed(3)),
    nextStep:
      "Run stagingDataIntegrityAudit.cjs against RESTORE_MONGO_URI by assigning it to STAGING_MONGO_URI.",
  };

  console.log(JSON.stringify(summary, null, 2));
};

try {
  run();
} catch (error) {
  console.error(`Backup/restore verification failed: ${error.message}`);
  process.exitCode = 1;
}
