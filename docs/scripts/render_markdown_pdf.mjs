import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const rootDir = process.cwd();

const inputArg = process.argv[2] || "docs/SYSTEM_WORKFLOW_VISUAL.md";
const outputArg = process.argv[3] || inputArg.replace(/\.md$/i, ".pdf");

const inputPath = path.resolve(rootDir, inputArg);
const outputPath = path.resolve(rootDir, outputArg);

if (!fs.existsSync(inputPath)) {
  console.error(`Markdown file not found: ${inputPath}`);
  process.exit(1);
}

const markdown = fs.readFileSync(inputPath, "utf8");

const browserCandidates = [
  process.env.PDF_BROWSER_PATH || "",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

const browserPath = browserCandidates.find((candidate) => fs.existsSync(candidate));

if (!browserPath) {
  console.error("No supported browser found. Set PDF_BROWSER_PATH to Edge or Chrome.");
  process.exit(1);
}

const tempHtmlPath = path.join(
  os.tmpdir(),
  `samvid-pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`,
);

const title = path.basename(inputPath, path.extname(inputPath));

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
      @page {
        size: A4;
        margin: 14mm;
      }

      :root {
        color-scheme: light;
        --bg: #f5f7fb;
        --paper: #ffffff;
        --ink: #102033;
        --muted: #5d6b7f;
        --line: #d6deea;
        --accent: #0f766e;
        --accent-soft: #dff7f3;
        --code-bg: #0f172a;
        --code-ink: #e5eefb;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background:
          radial-gradient(circle at top left, rgba(15, 118, 110, 0.12), transparent 28%),
          linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%);
        color: var(--ink);
        font-family: "Segoe UI", Calibri, Arial, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .page {
        max-width: 980px;
        margin: 0 auto;
        padding: 18mm 16mm 20mm;
      }

      .sheet {
        background: var(--paper);
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 20px;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
        overflow: hidden;
      }

      .hero {
        padding: 18mm 16mm 12mm;
        background:
          radial-gradient(circle at right top, rgba(15, 118, 110, 0.18), transparent 35%),
          linear-gradient(135deg, #0f172a 0%, #123247 50%, #0f766e 100%);
        color: #f8fffe;
      }

      .hero h1 {
        margin: 0 0 10px;
        font-size: 28px;
        line-height: 1.15;
        letter-spacing: 0.02em;
      }

      .hero p {
        margin: 0;
        font-size: 12.5px;
        line-height: 1.6;
        max-width: 720px;
        color: rgba(248, 255, 254, 0.9);
      }

      .content {
        padding: 12mm 16mm 16mm;
      }

      .content > *:first-child {
        margin-top: 0;
      }

      h1, h2, h3 {
        color: var(--ink);
        page-break-after: avoid;
      }

      h1 {
        font-size: 24px;
        margin: 0 0 12px;
      }

      h2 {
        margin: 28px 0 12px;
        padding: 0 0 8px;
        border-bottom: 2px solid var(--line);
        font-size: 18px;
      }

      h3 {
        margin: 18px 0 8px;
        font-size: 14px;
      }

      p, li {
        font-size: 11px;
        line-height: 1.7;
      }

      ul, ol {
        margin: 8px 0 14px 20px;
        padding: 0;
      }

      li + li {
        margin-top: 3px;
      }

      strong {
        color: #0b3b5a;
      }

      a {
        color: #0f766e;
        text-decoration: none;
      }

      code {
        font-family: Consolas, "Courier New", monospace;
        font-size: 0.95em;
        background: #eef4fb;
        color: #0f172a;
        padding: 0.12em 0.38em;
        border-radius: 6px;
      }

      pre {
        margin: 12px 0 18px;
        padding: 12px 14px;
        border-radius: 14px;
        background: var(--code-bg);
        color: var(--code-ink);
        overflow-x: auto;
        page-break-inside: avoid;
      }

      pre code {
        background: transparent;
        color: inherit;
        padding: 0;
      }

      blockquote {
        margin: 14px 0;
        padding: 8px 14px;
        border-left: 4px solid var(--accent);
        background: #f8fbfd;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin: 14px 0 18px;
        font-size: 10px;
        page-break-inside: avoid;
      }

      th, td {
        border: 1px solid var(--line);
        padding: 7px 8px;
        vertical-align: top;
        text-align: left;
      }

      th {
        background: #edf7f6;
      }

      hr {
        border: 0;
        border-top: 1px solid var(--line);
        margin: 22px 0;
      }

      .mermaid-wrap {
        margin: 14px 0 22px;
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background:
          radial-gradient(circle at top right, rgba(15, 118, 110, 0.09), transparent 32%),
          linear-gradient(180deg, #fbfeff 0%, #f4f8fc 100%);
        page-break-inside: avoid;
      }

      .mermaid {
        text-align: center;
      }

      .meta {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: #0f5b55;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .ready-flag {
        position: fixed;
        right: 0;
        bottom: 0;
        width: 1px;
        height: 1px;
        opacity: 0;
      }

      @media print {
        body {
          background: white;
        }

        .page {
          max-width: none;
          margin: 0;
          padding: 0;
        }

        .sheet {
          border: 0;
          border-radius: 0;
          box-shadow: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="sheet">
        <section class="hero">
          <div class="meta">Samvid OS Documentation</div>
          <h1>${title.replace(/_/g, " ")}</h1>
          <p>Generated from markdown with browser rendering so workflow diagrams, structure, and formatting are preserved for sharing and presentation.</p>
        </section>
        <main id="content" class="content"></main>
      </div>
    </div>
    <div id="ready" class="ready-flag"></div>
    <script>
      const markdown = ${JSON.stringify(markdown)};

      const render = async () => {
        marked.setOptions({
          gfm: true,
          breaks: false,
          headerIds: false,
          mangle: false,
        });

        const container = document.getElementById("content");
        container.innerHTML = marked.parse(markdown);

        const firstH1 = container.querySelector("h1");
        if (firstH1) {
          firstH1.remove();
        }

        const firstParagraph = container.querySelector("p");
        if (firstParagraph && /Last updated:/i.test(firstParagraph.textContent || "")) {
          const badge = document.createElement("div");
          badge.className = "meta";
          badge.textContent = firstParagraph.textContent.trim();
          firstParagraph.replaceWith(badge);
        }

        const mermaidBlocks = [...container.querySelectorAll("pre code.language-mermaid")];
        mermaidBlocks.forEach((codeNode) => {
          const pre = codeNode.parentElement;
          if (!pre) return;
          const wrapper = document.createElement("div");
          wrapper.className = "mermaid-wrap";
          const mermaidNode = document.createElement("div");
          mermaidNode.className = "mermaid";
          mermaidNode.textContent = codeNode.textContent || "";
          wrapper.appendChild(mermaidNode);
          pre.replaceWith(wrapper);
        });

        if (mermaidBlocks.length && window.mermaid) {
          mermaid.initialize({
            startOnLoad: false,
            theme: "base",
            securityLevel: "loose",
            fontFamily: "Segoe UI, Calibri, Arial, sans-serif",
            themeVariables: {
              primaryColor: "#dff7f3",
              primaryTextColor: "#102033",
              primaryBorderColor: "#0f766e",
              lineColor: "#0f766e",
              secondaryColor: "#edf7f6",
              tertiaryColor: "#f8fbff",
              clusterBkg: "#f4f8fc",
              clusterBorder: "#8cbab5",
            },
            flowchart: {
              curve: "basis",
              useMaxWidth: true,
            },
            sequence: {
              useMaxWidth: true,
            },
          });

          await mermaid.run({
            querySelector: ".mermaid",
          });
        }

        document.getElementById("ready").textContent = "ready";
        document.body.setAttribute("data-rendered", "true");
      };

      window.addEventListener("load", () => {
        render().catch((error) => {
          const container = document.getElementById("content");
          const pre = document.createElement("pre");
          pre.textContent = "Render failed:\\n" + String(error && error.stack ? error.stack : error);
          container.appendChild(pre);
          document.getElementById("ready").textContent = "ready";
          document.body.setAttribute("data-rendered", "true");
        });
      });
    </script>
  </body>
</html>
`;

fs.writeFileSync(tempHtmlPath, html, "utf8");

const args = [
  "--headless=new",
  "--disable-gpu",
  "--allow-file-access-from-files",
  "--run-all-compositor-stages-before-draw",
  "--virtual-time-budget=30000",
  `--print-to-pdf=${outputPath}`,
  pathToFileURL(tempHtmlPath).href,
];

const result = spawnSync(browserPath, args, {
  cwd: rootDir,
  stdio: "pipe",
  encoding: "utf8",
});

try {
  fs.unlinkSync(tempHtmlPath);
} catch {
  // Ignore temp cleanup issues.
}

if (result.status !== 0) {
  console.error(result.stdout || "");
  console.error(result.stderr || "");
  process.exit(result.status || 1);
}

if (!fs.existsSync(outputPath)) {
  console.error(`PDF was not created: ${outputPath}`);
  process.exit(1);
}

const stats = fs.statSync(outputPath);
if (stats.size <= 0) {
  console.error(`PDF is empty: ${outputPath}`);
  process.exit(1);
}

console.log(outputPath);
