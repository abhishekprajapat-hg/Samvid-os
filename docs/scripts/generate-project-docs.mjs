import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const docsDir = path.join(rootDir, "docs");

const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".expo",
  ".next",
  "coverage",
  "android",
  "ios",
]);

const toPosix = (value) => value.split(path.sep).join("/");
const rel = (filePath) => toPosix(path.relative(rootDir, filePath));

const readText = (filePath) => fs.readFileSync(filePath, "utf8");
const ensureDir = (dirPath) => fs.mkdirSync(dirPath, { recursive: true });
const uniq = (rows) => [...new Set(rows.filter(Boolean))];

const walkFiles = (dirPath, allowExts) => {
  if (!fs.existsSync(dirPath)) return [];
  const out = [];

  const walk = (currentPath) => {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        walk(abs);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (allowExts.has(ext)) {
        out.push(abs);
      }
    }
  };

  walk(dirPath);
  return out;
};

const countMatches = (content, regex) => {
  const all = content.match(regex);
  return all ? all.length : 0;
};

const extractNamedImports = (rawNames) => {
  return rawNames
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/\s+as\s+/i, " as "));
};

const extractServiceImports = (content) => {
  const rows = [];
  const importRegex = /import\s+([^;]+?)\s+from\s+["']([^"']*services\/[^"']+)["'];?/g;
  let match;
  while ((match = importRegex.exec(content))) {
    const importClause = String(match[1] || "").trim();
    const modulePath = String(match[2] || "");
    const moduleName = modulePath.split("/").pop() || modulePath;

    if (importClause.startsWith("{")) {
      const names = extractNamedImports(importClause.slice(1, -1));
      rows.push(`${moduleName}: ${names.join(", ")}`);
      continue;
    }

    if (importClause.includes("{")) {
      const [defaultPart, namedPartRaw] = importClause.split("{");
      const defaultName = defaultPart.replace(",", "").trim();
      const namedPart = namedPartRaw.replace("}", "").trim();
      const names = extractNamedImports(namedPart);
      const parts = [defaultName, ...names].filter(Boolean);
      rows.push(`${moduleName}: ${parts.join(", ")}`);
      continue;
    }

    rows.push(`${moduleName}: ${importClause}`);
  }

  const requireRegex = /const\s+([A-Za-z0-9_$\s,{}*]+?)\s*=\s*require\(["']([^"']*services\/[^"']+)["']\);?/g;
  while ((match = requireRegex.exec(content))) {
    const names = String(match[1] || "").replace(/\s+/g, " ").trim();
    const modulePath = String(match[2] || "");
    const moduleName = modulePath.split("/").pop() || modulePath;
    rows.push(`${moduleName}: ${names}`);
  }

  return uniq(rows);
};

const extractLocalDependencies = (content) => {
  const deps = [];
  const importRegex = /import\s+[^;]+?from\s+["']([^"']+)["'];?/g;
  let match;
  while ((match = importRegex.exec(content))) {
    const modulePath = String(match[1] || "").trim();
    if (!modulePath.startsWith(".")) continue;
    if (modulePath.includes("services/")) continue;
    deps.push(modulePath);
  }
  return uniq(deps);
};

const extractExports = (content) => {
  const names = [];

  let match;
  const exportDefaultFunctionRegex = /export\s+default\s+function\s+([A-Za-z0-9_]+)/g;
  while ((match = exportDefaultFunctionRegex.exec(content))) {
    names.push(match[1]);
  }

  const exportNamedConstRegex = /export\s+const\s+([A-Za-z0-9_]+)/g;
  while ((match = exportNamedConstRegex.exec(content))) {
    names.push(match[1]);
  }

  const exportNamedFunctionRegex = /export\s+function\s+([A-Za-z0-9_]+)/g;
  while ((match = exportNamedFunctionRegex.exec(content))) {
    names.push(match[1]);
  }

  const exportDefaultIdentifierRegex = /export\s+default\s+(?!function\b)([A-Za-z_][A-Za-z0-9_]*)\s*;?/g;
  while ((match = exportDefaultIdentifierRegex.exec(content))) {
    names.push(match[1]);
  }

  return uniq(names);
};

const extractTopLevelFunctions = (content) => {
  const names = [];
  let match;

  const constArrowRegex = /\bconst\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
  while ((match = constArrowRegex.exec(content))) {
    names.push(match[1]);
  }

  const functionRegex = /\b(?:async\s+)?function\s+([A-Za-z0-9_]+)/g;
  while ((match = functionRegex.exec(content))) {
    names.push(match[1]);
  }

  return uniq(names);
};

const inferFunctionalHighlights = ({ content, serviceImports, localDeps }) => {
  const highlights = [];

  if (/useState\s*\(/.test(content)) {
    highlights.push("Maintains local component state for UI and interactions.");
  }
  if (/useEffect\s*\(/.test(content)) {
    highlights.push("Runs lifecycle side effects for data load or runtime synchronization.");
  }
  if (/useMemo\s*\(/.test(content)) {
    highlights.push("Uses memoized selectors/derived state for rendering efficiency.");
  }
  if (/useCallback\s*\(/.test(content)) {
    highlights.push("Uses memoized callbacks for stable handler references.");
  }
  if (/useNavigate|navigate\(|navigation\.navigate/.test(content)) {
    highlights.push("Implements route or stack navigation flows.");
  }
  if (/createChatSocket|socket\.on\(|socket\.emit\(/.test(content)) {
    highlights.push("Integrates realtime events through socket connections.");
  }
  if (/Cloudinary|upload_preset|FormData\(|secure_url/.test(content)) {
    highlights.push("Includes media/file upload processing.");
  }
  if (/navigator\.geolocation|locationLat|locationLng|siteLocation|Map/.test(content)) {
    highlights.push("Contains location-aware behavior (coordinates/maps/geolocation).");
  }
  if (/Modal|AnimatePresence|Pressable/.test(content)) {
    highlights.push("Contains modal/overlay or multi-panel interaction patterns.");
  }
  if (/role\s*===|checkRole|allowedRoles|canAccess/.test(content)) {
    highlights.push("Applies role-aware access or action gating.");
  }
  if (/Print|jsPDF|pdf|generateProposal/i.test(content)) {
    highlights.push("Provides document generation or export workflow.");
  }

  if (serviceImports.length > 0) {
    highlights.push(`Calls feature APIs/services: ${serviceImports.slice(0, 5).join(" | ")}.`);
  }
  if (localDeps.length > 0) {
    highlights.push(`Composes local modules/components: ${localDeps.slice(0, 5).join(", ")}.`);
  }

  if (highlights.length === 0) {
    highlights.push("Provides presentational UI and composition logic.");
  }

  return highlights.slice(0, 6);
};

const snippetLanguage = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".tsx") return "tsx";
  if (ext === ".ts") return "ts";
  if (ext === ".jsx") return "jsx";
  if (ext === ".js") return "js";
  return "txt";
};

const extractSnippet = (content, filePath, maxLines = 24) => {
  const lines = content.split(/\r?\n/);
  const baseName = path.basename(filePath, path.extname(filePath));

  const anchors = [
    new RegExp(`^\\s*export\\s+default\\s+function\\s+${baseName}\\b`),
    new RegExp(`^\\s*const\\s+${baseName}\\s*=`),
    new RegExp(`^\\s*function\\s+${baseName}\\b`),
    /^\s*export\s+const\s+[A-Za-z0-9_]+\s*=/,
    /^\s*export\s+default\s+function\s+[A-Za-z0-9_]+\b/,
    /^\s*const\s+[A-Za-z0-9_]+\s*=\s*\(/,
    /^\s*const\s+[A-Za-z0-9_]+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/,
  ];

  let startIndex = -1;
  for (const anchor of anchors) {
    startIndex = lines.findIndex((line) => anchor.test(line));
    if (startIndex >= 0) break;
  }

  if (startIndex < 0) {
    startIndex = lines.findIndex((line) => line.trim().length > 0);
  }
  if (startIndex < 0) startIndex = 0;

  let snippet = lines.slice(startIndex, startIndex + maxLines).join("\n").trimEnd();
  if (!snippet) {
    snippet = lines.slice(0, Math.min(maxLines, lines.length)).join("\n");
  }

  return snippet;
};

const sectionForUiFile = (filePath, typeLabel) => {
  const content = readText(filePath);
  const exports = extractExports(content);
  const topFunctions = extractTopLevelFunctions(content).slice(0, 12);
  const services = extractServiceImports(content);
  const localDeps = extractLocalDependencies(content);
  const stateCount = countMatches(content, /useState\s*\(/g);
  const effectCount = countMatches(content, /useEffect\s*\(/g);
  const memoCount = countMatches(content, /useMemo\s*\(/g);
  const callbackCount = countMatches(content, /useCallback\s*\(/g);
  const snippet = extractSnippet(content, filePath);
  const language = snippetLanguage(filePath);
  const highlights = inferFunctionalHighlights({
    content,
    serviceImports: services,
    localDeps,
  });

  const title = path.basename(filePath, path.extname(filePath));

  return `### ${title}\n- **Path:** \`${rel(filePath)}\`\n- **Type:** ${typeLabel}\n- **Exports:** ${exports.length ? exports.join(", ") : "(implicit/default export pattern)"}\n- **Key functions:** ${topFunctions.length ? topFunctions.join(", ") : "(render-only component)"}\n- **Hook usage:** useState=${stateCount}, useEffect=${effectCount}, useMemo=${memoCount}, useCallback=${callbackCount}\n- **Service dependencies:** ${services.length ? services.join(" | ") : "None"}\n- **Functional highlights:**\n${highlights.map((item) => `  - ${item}`).join("\n")}\n- **Code snippet:**\n\n\`\`\`${language}\n${snippet}\n\`\`\`\n`;
};

const parseWebRoutes = (appFilePath) => {
  const content = readText(appFilePath);
  const lines = content.split(/\r?\n/);
  const routes = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const pathMatch = line.match(/path=\"([^\"]+)\"/);
    if (!pathMatch) continue;

    const routePath = String(pathMatch[1] || "").trim();
    let component = "(dynamic)";

    for (let j = i; j < Math.min(lines.length, i + 40); j += 1) {
      const componentRegex = /<([A-Z][A-Za-z0-9_]*)\b/g;
      let componentMatch;
      while ((componentMatch = componentRegex.exec(lines[j]))) {
        const candidate = componentMatch[1];
        if (candidate === "Route") continue;
        component = candidate;
        break;
      }
      if (component !== "(dynamic)") break;
    }

    routes.push({ routePath, component });
  }

  const uniqueRows = [];
  const seen = new Set();
  for (const row of routes) {
    const key = `${row.routePath}|${row.component}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueRows.push(row);
  }

  return uniqueRows;
};

const parseMobileTabsAndStacks = (roleTabsPath) => {
  const content = readText(roleTabsPath);
  const tabs = [];
  const stacks = [];

  const collectTagBlocks = (tagName) => {
    const lines = content.split(/\r?\n/);
    const blocks = [];

    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].includes(`<${tagName}`)) continue;

      const chunk = [lines[i]];
      let j = i;
      let closed = lines[i].includes("/>") || lines[i].includes(`</${tagName}>`);

      while (!closed && j + 1 < lines.length) {
        j += 1;
        chunk.push(lines[j]);
        if (lines[j].includes("/>") || lines[j].includes(`</${tagName}>`)) {
          closed = true;
        }
      }

      blocks.push(chunk.join("\n"));
      i = j;
    }

    return blocks;
  };

  const tabBlocks = collectTagBlocks("Tab.Screen");
  for (const block of tabBlocks) {
    const nameMatch = block.match(/name=\"([^\"]+)\"/);
    const componentMatch = block.match(/component=\{([A-Za-z0-9_]+)\}/);
    if (!nameMatch || !componentMatch) continue;
    tabs.push({ name: nameMatch[1], component: componentMatch[1] });
  }

  const stackBlocks = collectTagBlocks("Stack.Screen");
  for (const block of stackBlocks) {
    const nameMatch = block.match(/name=\"([^\"]+)\"/);
    if (!nameMatch) continue;
    const componentMatch = block.match(/component=\{([A-Za-z0-9_]+)\}/);
    stacks.push({
      name: nameMatch[1],
      component: componentMatch ? componentMatch[1] : "(render callback)",
    });
  }

  return { tabs, stacks };
};

const parseBackendMounts = (appFilePath) => {
  const content = readText(appFilePath);
  const mounts = [];
  const mountRegex = /app\.use\(\s*["']([^"']+)["']\s*,\s*require\(["']([^"']+)["']\)\s*\);/g;

  let match;
  while ((match = mountRegex.exec(content))) {
    mounts.push({
      mountPath: match[1],
      routeRequirePath: match[2],
    });
  }

  return mounts;
};

const parseExpressEndpoints = (routeFilePath) => {
  const content = readText(routeFilePath);
  const endpoints = [];
  const endpointRegex = /router\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g;
  let match;
  while ((match = endpointRegex.exec(content))) {
    endpoints.push({
      method: String(match[1] || "").toUpperCase(),
      subPath: String(match[2] || ""),
    });
  }

  return endpoints;
};

const parseCommonJsExportNames = (content) => {
  const names = [];
  let match;

  const moduleObjectRegex = /module\.exports\s*=\s*\{([\s\S]*?)\};/g;
  while ((match = moduleObjectRegex.exec(content))) {
    const body = String(match[1] || "");
    const tokens = body
      .split(",")
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) => row.split(":")[0].trim());
    names.push(...tokens);
  }

  const exportsRegex = /exports\.([A-Za-z0-9_]+)\s*=/g;
  while ((match = exportsRegex.exec(content))) {
    names.push(match[1]);
  }

  return uniq(names);
};

const buildFrontendDoc = () => {
  const frontendSrc = path.join(rootDir, "frontend", "src");
  const appFile = path.join(frontendSrc, "App.jsx");
  const allUiFiles = walkFiles(frontendSrc, new Set([".js", ".jsx", ".ts", ".tsx"]))
    .filter((filePath) => !filePath.endsWith(".test.js") && !filePath.endsWith(".test.jsx"));

  const appShellFiles = [];
  const pageFiles = [];
  const componentFiles = [];

  for (const filePath of allUiFiles) {
    const normalized = toPosix(filePath);

    if (normalized.endsWith("/main.jsx") || normalized.endsWith("/App.jsx")) {
      appShellFiles.push(filePath);
      continue;
    }

    if (normalized.includes("/src/modules/")) {
      if (normalized.includes("/components/")) {
        componentFiles.push(filePath);
      } else {
        pageFiles.push(filePath);
      }
      continue;
    }

    if (normalized.includes("/src/components/") || normalized.includes("/src/context/")) {
      componentFiles.push(filePath);
      continue;
    }

    if (normalized.includes("/src/utils/") || normalized.includes("/src/services/")) {
      continue;
    }

    appShellFiles.push(filePath);
  }

  const sortedAppShell = uniq(appShellFiles).sort();
  const sortedPages = uniq(pageFiles).sort();
  const sortedComponents = uniq(componentFiles).sort();

  const routes = fs.existsSync(appFile) ? parseWebRoutes(appFile) : [];

  const header = [
    "# Samvid OS Web Frontend Documentation",
    "",
    "Generated from source files in `frontend/src`.",
    "",
    "## Coverage Summary",
    `- App shell files: ${sortedAppShell.length}`,
    `- Page files: ${sortedPages.length}`,
    `- Component files: ${sortedComponents.length}`,
    `- Route entries parsed from App router: ${routes.length}`,
    "",
    "## Route Map (from `frontend/src/App.jsx`)",
    "| Path | Target component (first match in route element) |",
    "| --- | --- |",
    ...routes.map((row) => `| \`${row.routePath}\` | \`${row.component}\` |`),
    "",
    "## App Shell",
    "",
  ];

  const appShellSections = sortedAppShell.map((filePath) => sectionForUiFile(filePath, "App Shell"));

  const pagesHeader = [
    "",
    "## Pages",
    "",
    "All files under `src/modules` (excluding nested `components` folders) are treated as page-level modules.",
    "",
  ];

  const pageSections = sortedPages.map((filePath) => sectionForUiFile(filePath, "Page"));

  const componentsHeader = [
    "",
    "## Components",
    "",
    "This section includes reusable components in `src/components`, nested module components, and chat notification context components.",
    "",
  ];

  const componentSections = sortedComponents.map((filePath) => sectionForUiFile(filePath, "Component"));

  return [...header, ...appShellSections, ...pagesHeader, ...pageSections, ...componentsHeader, ...componentSections].join("\n");
};

const buildMobileDoc = () => {
  const mobileSrc = path.join(rootDir, "mobile", "src");
  const mobileRootFiles = [
    path.join(rootDir, "mobile", "App.tsx"),
    path.join(rootDir, "mobile", "index.ts"),
  ].filter((filePath) => fs.existsSync(filePath));

  const allMobileSource = walkFiles(mobileSrc, new Set([".ts", ".tsx"]));

  const navigationFiles = [];
  const contextFiles = [];
  const screenFiles = [];
  const componentFiles = [];
  const otherFiles = [];

  for (const filePath of allMobileSource) {
    const normalized = toPosix(filePath);

    if (normalized.includes("/src/navigation/")) {
      navigationFiles.push(filePath);
      continue;
    }

    if (normalized.includes("/src/context/")) {
      contextFiles.push(filePath);
      continue;
    }

    if (normalized.includes("/src/components/")) {
      componentFiles.push(filePath);
      continue;
    }

    if (normalized.includes("/src/modules/") && normalized.endsWith("Screen.tsx")) {
      screenFiles.push(filePath);
      continue;
    }

    if (normalized.includes("/src/services/") || normalized.includes("/src/utils/") || normalized.includes("/src/storage/") || normalized.includes("/src/types/") || normalized.includes("/src/theme/")) {
      continue;
    }

    otherFiles.push(filePath);
  }

  const roleTabsPath = path.join(mobileSrc, "navigation", "RoleTabs.tsx");
  const roleMap = fs.existsSync(roleTabsPath)
    ? parseMobileTabsAndStacks(roleTabsPath)
    : { tabs: [], stacks: [] };

  const sortedRoot = uniq(mobileRootFiles).sort();
  const sortedNav = uniq(navigationFiles).sort();
  const sortedContext = uniq(contextFiles).sort();
  const sortedScreens = uniq(screenFiles).sort();
  const sortedComponents = uniq(componentFiles).sort();
  const sortedOther = uniq(otherFiles).sort();

  const header = [
    "# Samvid OS Mobile App Documentation",
    "",
    "Generated from source files in `mobile/App.tsx` and `mobile/src`.",
    "",
    "## Coverage Summary",
    `- Root entry files: ${sortedRoot.length}`,
    `- Navigation files: ${sortedNav.length}`,
    `- Context files: ${sortedContext.length}`,
    `- Screen files: ${sortedScreens.length}`,
    `- Component files: ${sortedComponents.length}`,
    "",
    "## Role Navigation Map (from `mobile/src/navigation/RoleTabs.tsx`)",
    "",
    "### Bottom Tabs",
    "| Tab Name | Component |",
    "| --- | --- |",
    ...roleMap.tabs.map((row) => `| \`${row.name}\` | \`${row.component}\` |`),
    "",
    "### Stack Screens",
    "| Stack Name | Component |",
    "| --- | --- |",
    ...roleMap.stacks.map((row) => `| \`${row.name}\` | \`${row.component}\` |`),
    "",
    "## Root App and Navigation",
    "",
  ];

  const rootSections = [...sortedRoot, ...sortedNav, ...sortedContext].map((filePath) =>
    sectionForUiFile(filePath, "App / Navigation Component"),
  );

  const screenHeader = [
    "",
    "## Screens",
    "",
    "All `*Screen.tsx` files under `src/modules` are treated as page-level screens.",
    "",
  ];

  const screenSections = sortedScreens.map((filePath) => sectionForUiFile(filePath, "Screen"));

  const componentHeader = [
    "",
    "## Shared Components",
    "",
  ];

  const componentSections = sortedComponents.map((filePath) => sectionForUiFile(filePath, "Component"));

  const otherHeader = sortedOther.length
    ? [
      "",
      "## Other Functional Modules",
      "",
      "Files that are not typed as screen/component but still participate in runtime composition.",
      "",
    ]
    : [];

  const otherSections = sortedOther.map((filePath) => sectionForUiFile(filePath, "Runtime Module"));

  return [
    ...header,
    ...rootSections,
    ...screenHeader,
    ...screenSections,
    ...componentHeader,
    ...componentSections,
    ...otherHeader,
    ...otherSections,
  ].join("\n");
};

const buildBackendDoc = () => {
  const backendSrc = path.join(rootDir, "backend", "src");
  const appFile = path.join(backendSrc, "app.js");
  const routeDir = path.join(backendSrc, "routes");
  const controllerDir = path.join(backendSrc, "controllers");
  const serviceDir = path.join(backendSrc, "services");

  const routeFiles = walkFiles(routeDir, new Set([".js"]))
    .sort((a, b) => a.localeCompare(b));
  const controllerFiles = walkFiles(controllerDir, new Set([".js"]))
    .sort((a, b) => a.localeCompare(b));
  const serviceFiles = walkFiles(serviceDir, new Set([".js"]))
    .sort((a, b) => a.localeCompare(b));

  const mounts = fs.existsSync(appFile) ? parseBackendMounts(appFile) : [];

  const mountByRouteFile = new Map();
  for (const mount of mounts) {
    const routeAbs = path.normalize(path.join(path.dirname(appFile), `${mount.routeRequirePath}.js`));
    mountByRouteFile.set(routeAbs, mount.mountPath);
  }

  const routeSections = routeFiles.map((routeFile) => {
    const mountPath = mountByRouteFile.get(path.normalize(routeFile)) || "(not directly mounted in app.js)";
    const endpoints = parseExpressEndpoints(routeFile);
    const content = readText(routeFile);
    const middlewareHints = [];

    if (/router\.use\(authMiddleware\.protect\)/.test(content) || /authMiddleware\.protect/.test(content)) {
      middlewareHints.push("Authenticated route surface (`authMiddleware.protect`).");
    }
    if (/checkRole\(/.test(content)) {
      middlewareHints.push("Role-gated handlers (`checkRole`).");
    }
    if (/writeLimiter|chatMessageLimiter|apiLimiter/.test(content)) {
      middlewareHints.push("Rate-limited write/message endpoints.");
    }

    const snippet = extractSnippet(content, routeFile, 22);

    return [
      `### ${path.basename(routeFile)}`,
      `- **Path:** \`${rel(routeFile)}\``,
      `- **Mounted under:** \`${mountPath}\``,
      `- **Endpoint count:** ${endpoints.length}`,
      `- **Middleware profile:** ${middlewareHints.length ? middlewareHints.join(" ") : "No global middleware pattern detected in parser pass."}`,
      "- **Endpoints:**",
      ...(
        endpoints.length
          ? endpoints.map((ep) => `  - \`${ep.method} ${mountPath}${ep.subPath}\``)
          : ["  - (No direct `router.<method>(path, ...)` entries detected)"]
      ),
      "- **Code snippet:**",
      "",
      "```js",
      snippet,
      "```",
      "",
    ].join("\n");
  });

  const controllerSections = controllerFiles.map((controllerFile) => {
    const content = readText(controllerFile);
    const exported = parseCommonJsExportNames(content);
    const topFunctions = extractTopLevelFunctions(content).slice(0, 14);
    const snippet = extractSnippet(content, controllerFile, 22);

    return [
      `### ${path.basename(controllerFile)}`,
      `- **Path:** \`${rel(controllerFile)}\``,
      `- **Exported handlers:** ${exported.length ? exported.join(", ") : "(parser did not detect explicit object exports)"}`,
      `- **Top-level functions:** ${topFunctions.length ? topFunctions.join(", ") : "(not detected)"}`,
      "- **Code snippet:**",
      "",
      "```js",
      snippet,
      "```",
      "",
    ].join("\n");
  });

  const serviceSections = serviceFiles.map((serviceFile) => {
    const content = readText(serviceFile);
    const exported = parseCommonJsExportNames(content);
    const topFunctions = extractTopLevelFunctions(content).slice(0, 14);
    const snippet = extractSnippet(content, serviceFile, 22);

    return [
      `### ${path.basename(serviceFile)}`,
      `- **Path:** \`${rel(serviceFile)}\``,
      `- **Exported service methods:** ${exported.length ? exported.join(", ") : "(parser did not detect explicit object exports)"}`,
      `- **Top-level functions:** ${topFunctions.length ? topFunctions.join(", ") : "(not detected)"}`,
      "- **Code snippet:**",
      "",
      "```js",
      snippet,
      "```",
      "",
    ].join("\n");
  });

  const header = [
    "# Samvid OS Backend Functionality Documentation",
    "",
    "Generated from `backend/src` (Express app, routes, controllers, services).",
    "",
    "## Coverage Summary",
    `- Route files: ${routeFiles.length}`,
    `- Controller files: ${controllerFiles.length}`,
    `- Service files: ${serviceFiles.length}`,
    `- App route mounts parsed: ${mounts.length}`,
    "",
    "## Express Route Mounts (from `backend/src/app.js`)",
    "| Mount Path | Route File Require Path |",
    "| --- | --- |",
    ...mounts.map((mount) => `| \`${mount.mountPath}\` | \`${mount.routeRequirePath}\` |`),
    "",
    "## Route Files and Endpoints",
    "",
  ];

  const controllerHeader = [
    "",
    "## Controllers",
    "",
  ];

  const serviceHeader = [
    "",
    "## Services",
    "",
  ];

  return [
    ...header,
    ...routeSections,
    ...controllerHeader,
    ...controllerSections,
    ...serviceHeader,
    ...serviceSections,
  ].join("\n");
};

const buildDocsIndex = ({ frontendDocPath, mobileDocPath, backendDocPath }) => {
  const generatedAt = new Date().toISOString();
  const curatedDocs = [
    {
      label: "Visual System Workflow",
      fileName: "SYSTEM_WORKFLOW_VISUAL.md",
    },
    {
      label: "End-to-End Testing Flow",
      fileName: "TESTING_FLOW.md",
    },
  ];

  return [
    "# Samvid OS Full Project Documentation",
    "",
    `Generated on: ${generatedAt}`,
    "",
    "This documentation set combines generated code-surface docs with curated workflow and testing docs.",
    "",
    "## Documents",
    `- [Web Frontend Pages and Components](./${path.basename(frontendDocPath)})`,
    `- [Mobile Screens and Components](./${path.basename(mobileDocPath)})`,
    `- [Backend Functionality and API Surface](./${path.basename(backendDocPath)})`,
    ...curatedDocs.map((doc) => `- [${doc.label}](./${doc.fileName})`),
    "",
    "## Scope",
    "- Every web page/component under `frontend/src/modules`, `frontend/src/components`, and app shell files.",
    "- Every mobile screen/component under `mobile/src/modules`, `mobile/src/components`, plus root/navigation/context modules.",
    "- Backend route/controller/service coverage with route endpoint extraction.",
    "- Visual workflow coverage for tenant, auth, lead, inventory, chat, reporting, and SaaS flows.",
    "",
    "## Update Workflow",
    "1. Run `node docs/scripts/generate-project-docs.mjs` from repository root.",
    "2. Review changed markdown files in `docs/`, including curated docs linked from this index.",
    "3. Commit docs updates with the corresponding code changes.",
  ].join("\n");
};

const main = () => {
  ensureDir(docsDir);
  ensureDir(path.join(docsDir, "scripts"));

  const frontendDoc = buildFrontendDoc();
  const mobileDoc = buildMobileDoc();
  const backendDoc = buildBackendDoc();

  const frontendDocPath = path.join(docsDir, "FRONTEND_WEB_DOCUMENTATION.md");
  const mobileDocPath = path.join(docsDir, "MOBILE_APP_DOCUMENTATION.md");
  const backendDocPath = path.join(docsDir, "BACKEND_FUNCTIONALITY_DOCUMENTATION.md");
  const docsIndexPath = path.join(docsDir, "README.md");

  fs.writeFileSync(frontendDocPath, `${frontendDoc}\n`, "utf8");
  fs.writeFileSync(mobileDocPath, `${mobileDoc}\n`, "utf8");
  fs.writeFileSync(backendDocPath, `${backendDoc}\n`, "utf8");
  fs.writeFileSync(
    docsIndexPath,
    `${buildDocsIndex({ frontendDocPath, mobileDocPath, backendDocPath })}\n`,
    "utf8",
  );

  const summary = [
    `Wrote ${rel(docsIndexPath)}`,
    `Wrote ${rel(frontendDocPath)}`,
    `Wrote ${rel(mobileDocPath)}`,
    `Wrote ${rel(backendDocPath)}`,
  ];

  console.log(summary.join("\n"));
};

main();
