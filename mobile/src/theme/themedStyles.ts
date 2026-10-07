import { darkColors, lightColors, palette, type ColorScheme } from "./tokens";

/*
 * Themed styles without touching a single component.
 *
 * The problem: StyleSheet.create runs once, at import, so a stylesheet written
 * at module scope is fixed to whatever colours it read then. Fifty-seven files
 * and 2,720 style references were written that way, and rewriting each of them
 * to take colours from a hook would mean editing every component in every file
 * - including twenty-five files that define more than one.
 *
 * What this does instead: a stylesheet is declared as a function of the colour
 * scheme, and `themedStyles` hands back a proxy. Property access happens during
 * render, so `styles.card` resolves against whichever scheme is current at that
 * moment. Each scheme's stylesheet is built once and cached.
 *
 * The proxy alone cannot repaint the app, because a component that never reads
 * the theme context has nothing to re-render it. ThemeProvider therefore
 * remounts its subtree when the scheme changes - see the note there.
 */

type Scale = Record<number, string>;

/** The colour surface a stylesheet is written against. */
export type ThemedTokens = ColorScheme & {
  slate: Scale;
  blue: Scale;
  emerald: Scale;
  rose: Scale;
  amber: Scale;
  violet: Scale;
  cyan: Scale;
};

/*
 * Structural greys inverted end for end. A 50 that was a page background
 * becomes a 950; a 900 that was body text becomes a 50. That is what makes a
 * stylesheet written for light read correctly on dark without knowing it.
 */
const invertSlate = (scale: Scale): Scale => ({
  50: scale[950],
  100: scale[900],
  200: scale[800],
  300: scale[700],
  400: scale[500],
  500: scale[400],
  600: scale[300],
  700: scale[200],
  800: scale[100],
  900: scale[50],
  950: scale[50],
});

const withAlpha = (hex: string, alpha: number) => {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/*
 * Accent hues follow the web app's own dark treatment rather than a plain
 * inversion: a 50/100 tint becomes the mid hue at low opacity, a 200 border
 * becomes it at a third, and the dark text steps lighten. That is exactly what
 * `dark:bg-emerald-500/10 dark:text-emerald-200` does on web.
 */
const darkenAccent = (scale: Scale): Scale => ({
  50: withAlpha(scale[500], 0.12),
  100: withAlpha(scale[500], 0.18),
  200: withAlpha(scale[500], 0.32),
  300: scale[300],
  400: scale[400],
  500: scale[400],
  600: scale[300],
  700: scale[200],
  800: scale[200],
  900: scale[100],
  950: scale[100],
});

const LIGHT_TOKENS: ThemedTokens = {
  ...lightColors,
  slate: palette.slate,
  blue: palette.blue,
  emerald: palette.emerald,
  rose: palette.rose,
  amber: palette.amber,
  violet: palette.violet,
  cyan: palette.cyan,
};

const DARK_TOKENS: ThemedTokens = {
  ...darkColors,
  slate: invertSlate(palette.slate),
  blue: darkenAccent(palette.blue),
  emerald: darkenAccent(palette.emerald),
  rose: darkenAccent(palette.rose),
  amber: darkenAccent(palette.amber),
  violet: darkenAccent(palette.violet),
  cyan: darkenAccent(palette.cyan),
};

export const tokensFor = (scheme: "light" | "dark") =>
  scheme === "dark" ? DARK_TOKENS : LIGHT_TOKENS;

/*
 * Module-level, not context: the proxy is read during render by components that
 * may never consume the theme context, so the current scheme has to be legible
 * without one. ThemeProvider keeps it in step.
 */
let activeScheme: "light" | "dark" = "light";

export const setActiveScheme = (scheme: "light" | "dark") => {
  activeScheme = scheme;
};

export const getActiveScheme = () => activeScheme;

/**
 * Declares a stylesheet as a function of the colour scheme.
 *
 * Returns something that behaves like the stylesheet it replaces - including
 * under spread and array composition - but resolves per scheme at access time.
 */
export const themedStyles = <T extends Record<string, unknown>>(
  make: (c: ThemedTokens) => T,
): T => {
  const cache = new Map<string, T>();

  const resolve = (): T => {
    const key = activeScheme;
    let built = cache.get(key);
    if (!built) {
      built = make(tokensFor(key));
      cache.set(key, built);
    }
    return built;
  };

  return new Proxy({} as T, {
    get: (_target, prop) => resolve()[prop as keyof T],
    has: (_target, prop) => prop in resolve(),
    ownKeys: () => Reflect.ownKeys(resolve()),
    getOwnPropertyDescriptor: (_target, prop) =>
      Reflect.getOwnPropertyDescriptor(resolve(), prop),
  });
};

/* --------------------------------------------- colours outside a stylesheet -- */

/*
 * Not every colour lives in a StyleSheet. Icon tints, ActivityIndicator, a
 * one-off backgroundColor in JSX - those are read straight from the render, so
 * the proxy above never sees them and they would have stayed light.
 *
 * These two resolve at call time instead, which is during render, so they pick
 * up the active scheme for the same reason the proxy does.
 */

/** Every light-scheme value, by the token that produces it. */
const LIGHT_INDEX: Array<[string, (c: ThemedTokens) => string]> = (() => {
  const entries: Array<[string, (c: ThemedTokens) => string]> = [];
  const families = ["slate", "blue", "emerald", "rose", "amber", "violet", "cyan"] as const;

  for (const family of families) {
    for (const step of Object.keys(palette[family])) {
      const hex = (palette[family] as Scale)[Number(step)];
      entries.push([hex.toLowerCase(), (c) => (c[family] as Scale)[Number(step)]]);
    }
  }
  /*
   * Semantic tokens are appended, not prepended: `new Map(entries)` lets the
   * LAST entry for a key win, so this is what makes `#161c24` resolve as `text`
   * rather than as `slate[900]`.
   */
  const semantic: Array<[keyof ColorScheme, string]> = [
    ["bg", lightColors.bg],
    ["surface", lightColors.surface],
    ["surfaceMuted", lightColors.surfaceMuted],
    ["text", lightColors.text],
    ["textMuted", lightColors.textMuted],
    ["textTertiary", lightColors.textTertiary],
    ["border", lightColors.border],
    ["borderStrong", lightColors.borderStrong],
    ["primary", lightColors.primary],
  ];
  for (const [key, hex] of semantic) {
    entries.push([hex.toLowerCase(), (c) => c[key] as string]);
  }
  return entries;
})();

const RESOLVERS = new Map(LIGHT_INDEX);

/**
 * Takes a light-scheme colour and returns its counterpart in the active one.
 * An unrecognised value is returned untouched, which is what keeps bespoke
 * colours - the call screen's gradient - looking like themselves.
 */
export const themeColor = (hex: string): string => {
  const resolve = RESOLVERS.get(String(hex || "").toLowerCase());
  return resolve ? resolve(tokensFor(activeScheme)) : hex;
};

/**
 * A scheme-aware stand-in for the static `palette` export, so
 * `themePalette.slate[500]` in JSX follows the theme the way a stylesheet does.
 */
export const themePalette = new Proxy({} as ThemedTokens, {
  get: (_target, prop) => tokensFor(activeScheme)[prop as keyof ThemedTokens],
});
