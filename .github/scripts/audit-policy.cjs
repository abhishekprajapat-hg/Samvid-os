const fs = require("fs");
const path = require("path");

const severityRank = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

const workspace = process.argv[2];
const auditPath = process.argv[3];
const policyPath = process.argv[4] || path.resolve(__dirname, "../audit-policy.json");

if (!workspace || !auditPath) {
  console.error("Usage: node .github/scripts/audit-policy.cjs <workspace> <audit-json-path> [policy-path]");
  process.exit(2);
}

const readJson = (filePath) => {
  const buffer = fs.readFileSync(filePath);
  const hasUtf16Nulls = buffer.length > 2 && (buffer[1] === 0 || buffer[0] === 0xff);
  const text = hasUtf16Nulls ? buffer.toString("utf16le") : buffer.toString("utf8");
  return JSON.parse(text.replace(/^\uFEFF/, ""));
};
const audit = readJson(auditPath);
const policy = readJson(policyPath);
const today = new Date();

const rules = new Map();
for (const rule of (policy.rules || []).filter((item) => item.workspace === workspace)) {
  const packages = [rule.package, ...(rule.packages || [])].filter(Boolean);
  for (const packageName of packages) {
    rules.set(packageName, rule);
  }
}

const failures = [];
const accepted = [];
const vulnerabilities = audit.vulnerabilities || {};

for (const [name, finding] of Object.entries(vulnerabilities)) {
  const severity = String(finding.severity || "info").toLowerCase();
  if (severityRank[severity] < severityRank.moderate) {
    continue;
  }

  const rule = rules.get(name);
  const ruleExpired = rule?.expiresOn ? new Date(`${rule.expiresOn}T23:59:59Z`) < today : true;
  const allowedSeverity = rule?.maxSeverity || "";
  const isAllowed =
    rule
    && !ruleExpired
    && severityRank[severity] <= severityRank[allowedSeverity]
    && severity !== "critical"
    && rule.owner
    && rule.evidence
    && rule.control;

  if (isAllowed) {
    accepted.push({
      package: name,
      severity,
      owner: rule.owner,
      expiresOn: rule.expiresOn,
    });
  } else {
    failures.push({
      package: name,
      severity,
      reason: !rule
        ? "no package-specific policy"
        : ruleExpired
          ? "policy expired"
          : severity === "critical"
            ? "critical findings cannot be accepted"
            : "finding exceeds policy",
    });
  }
}

const summary = {
  workspace,
  vulnerabilities: audit.metadata?.vulnerabilities || {},
  accepted,
  failures,
};

console.log(JSON.stringify(summary, null, 2));

if (failures.length > 0) {
  process.exit(1);
}
