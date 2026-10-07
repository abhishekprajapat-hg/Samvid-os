const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

/*
 * A guard on how screens read colour, not on what the theme returns.
 *
 * themedStyles and themePalette were always correct; dark mode was broken at
 * the call sites instead, in two ways that both look completely reasonable in
 * review:
 *
 *   1. `backgroundColor: colors.bg` - the static export from tokens.ts, fixed
 *      to light because StyleSheet.create runs once at import. This was in
 *      Screen.tsx, so it was the background of every page in the app.
 *
 *   2. `const TONES = { ok: themePalette.emerald[600] }` at module scope - the
 *      proxy is right, but a module constant reads it once, while the module
 *      loads, which is always before the stored preference resolves. So it
 *      froze to light too.
 *
 * Both are invisible until someone switches to dark, which is why they are
 * checked here rather than left to review.
 */

const SRC = path.join(__dirname, "..", "src");

/** tokens.ts and themedStyles.ts are where the static tables are meant to live. */
const EXEMPT_DIRS = [path.join(SRC, "theme")];

const sourceFiles = () => {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!EXEMPT_DIRS.some((skip) => full.startsWith(skip))) walk(full);
      } else if (/\.tsx?$/.test(entry.name)) {
        out.push(full);
      }
    }
  };
  walk(SRC);
  return out;
};

const rel = (file) => path.relative(path.join(__dirname, ".."), file).replace(/\\/g, "/");

// `colors.x` / `palette.x`, but not `themePalette.x` or `c.colors.x`.
const STATIC_READ = /(?<![A-Za-z0-9_.])(colors|palette)\./g;

test("colour is read at render time, not at import time", async (t) => {
  const files = sourceFiles();

  await t.test("no screen reads the static colours export", () => {
    const offenders = [];
    for (const file of files) {
      const body = fs.readFileSync(file, "utf8");
      const found = body.match(STATIC_READ);
      if (found) offenders.push(`${rel(file)} (${found.length})`);
    }
    assert.deepEqual(
      offenders,
      [],
      "These read `colors.` or `palette.` from theme/tokens, which is frozen to " +
        "the light scheme. Inside a themedStyles callback use its `c` parameter; " +
        "anywhere else use themePalette:\n  " + offenders.join("\n  "),
    );
  });

  await t.test("no module-scope constant freezes a themed colour", () => {
    const offenders = [];

    for (const file of files) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i += 1) {
        const declaration = /^(export )?const (\w+)\s*(:[^=]*)?=\s*(.*)$/.exec(lines[i]);
        if (!declaration) continue;

        // Collect the declaration through to its closing line at column 0.
        const block = [lines[i]];
        if (!lines[i].trimEnd().endsWith(";")) {
          for (let j = i + 1; j < lines.length; j += 1) {
            block.push(lines[j]);
            if (/^[}\])];?\s*$/.test(lines[j]) || lines[j].startsWith("} as const;")) break;
          }
        }
        const text = block.join("\n");
        if (!/themePalette|themeColor\(/.test(text)) continue;

        // An arrow function or a component re-reads on every call, so it is fine.
        const isLazy = text.includes("=>") || text.trimStart().startsWith("function");
        const isComponent = text.includes("<") && text.includes("/>");
        if (isLazy || isComponent) continue;

        offenders.push(`${rel(file)}:${i + 1} const ${declaration[2]}`);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      "These build a colour table at module scope, which pins it to whichever " +
        "scheme was active at import - always light. Make it a function so it " +
        "resolves per call:\n  " + offenders.join("\n  "),
    );
  });
});
