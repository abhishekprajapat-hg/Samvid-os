const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appSource = fs.readFileSync(path.join(__dirname, "..", "App.tsx"), "utf8");

test("the application root provides safe-area context before rendering screens", () => {
  assert.match(
    appSource,
    /import\s*\{\s*SafeAreaProvider\s*\}\s*from\s*["']react-native-safe-area-context["']/,
  );

  const provider = appSource.indexOf("<SafeAreaProvider>");
  const theme = appSource.indexOf("<ThemeProvider>", provider);
  const shell = appSource.indexOf("<Shell />", theme);

  assert.ok(provider >= 0, "SafeAreaProvider must be rendered");
  assert.ok(theme > provider, "SafeAreaProvider must wrap ThemeProvider");
  assert.ok(shell > theme, "SafeAreaProvider must wrap the application shell");
});
