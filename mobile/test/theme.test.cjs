const test = require("node:test");
const assert = require("node:assert");

const {
  themedStyles,
  themePalette,
  themeColor,
  setActiveScheme,
  getActiveScheme,
  tokensFor,
} = require("../.test-build/theme/themedStyles.js");

const { lightColors, darkColors, palette } = require("../.test-build/theme/tokens.js");

/*
 * These lock in the thing that was broken: colours have to be read at the
 * moment they are used, not at the moment the module loads.
 *
 * Every failure mode below shipped at least once - a stylesheet written
 * against the static `colors` export, and a module-level table built from
 * themePalette while the scheme was still the default light.
 */

test("theme resolution", async (t) => {
  t.afterEach(() => setActiveScheme("light"));

  await t.test("a themed stylesheet resolves against the active scheme", () => {
    const styles = themedStyles((c) => ({ page: { backgroundColor: c.bg } }));

    setActiveScheme("light");
    assert.equal(styles.page.backgroundColor, lightColors.bg);

    setActiveScheme("dark");
    assert.equal(styles.page.backgroundColor, darkColors.bg);
  });

  await t.test("the same proxy flips back, so the per-scheme cache is not sticky", () => {
    const styles = themedStyles((c) => ({ card: { borderColor: c.border } }));

    setActiveScheme("dark");
    const dark = styles.card.borderColor;
    setActiveScheme("light");
    const light = styles.card.borderColor;

    assert.equal(dark, darkColors.border);
    assert.equal(light, lightColors.border);
    assert.notEqual(dark, light);
  });

  await t.test("themePalette follows the scheme for colours read outside a stylesheet", () => {
    setActiveScheme("light");
    assert.equal(themePalette.slate[900], palette.slate[900]);
    assert.equal(themePalette.surface, lightColors.surface);

    setActiveScheme("dark");
    assert.notEqual(themePalette.slate[900], palette.slate[900]);
    assert.equal(themePalette.surface, darkColors.surface);
  });

  await t.test("themeColor maps a light literal onto the active scheme", () => {
    setActiveScheme("light");
    assert.equal(themeColor("#f5f7fa"), lightColors.bg);

    setActiveScheme("dark");
    assert.equal(themeColor("#f5f7fa"), darkColors.bg);
  });

  await t.test("an unrecognised colour is passed through untouched", () => {
    setActiveScheme("dark");
    assert.equal(themeColor("#ff00ff"), "#ff00ff");
    assert.equal(themeColor(""), "");
  });

  await t.test("the dark scheme actually differs from the light one", () => {
    /*
     * Guards the inversion itself: if tokensFor("dark") ever returned the
     * light table, every test above would still pass by symmetry.
     */
    const light = tokensFor("light");
    const dark = tokensFor("dark");

    assert.notEqual(light.bg, dark.bg);
    assert.notEqual(light.text, dark.text);
    assert.notEqual(light.surface, dark.surface);
    // Structural greys inverts end for end: a page background becomes ink.
    assert.equal(dark.slate[50], light.slate[950]);
    assert.equal(dark.slate[900], light.slate[50]);
  });

  await t.test("setActiveScheme is readable back, which is what render relies on", () => {
    setActiveScheme("dark");
    assert.equal(getActiveScheme(), "dark");
    setActiveScheme("light");
    assert.equal(getActiveScheme(), "light");
  });
});
