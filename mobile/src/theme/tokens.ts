/*
 * The design contract with the web app.
 *
 * Every value here is lifted from frontend/tailwind.config.js and
 * frontend/src/index.css. When the web redesign moves, this file moves with it
 * and the app follows - that is the whole point of it existing.
 *
 * See docs/mobile/01_MOBILE_DESIGN_SYSTEM.md for the full mapping and the
 * reasoning behind the places mobile deliberately differs.
 */

/* ------------------------------------------------------------- palettes -- */

/*
 * The redesign overrides Tailwind's built-in scales wholesale, so `slate-500`
 * on web is #6c7789 rather than Tailwind's #6c7789. These are those overridden
 * scales, copied verbatim. Families the redesign does not define (gray, red,
 * green, sky...) resolve to the nearest one here, as they do on web.
 */
export const palette = {
  slate: {
    50: "#f5f7fa", 100: "#edf0f5", 200: "#e0e5ed", 300: "#c8d0dd",
    400: "#98a3b5", 500: "#6c7789", 600: "#4e5867", 700: "#39424f",
    800: "#242b35", 900: "#161c24", 950: "#0d1219",
  },
  blue: {
    50: "#eef3ff", 100: "#dde6ff", 200: "#bcd0ff", 300: "#8fb0ff",
    400: "#5c87fb", 500: "#3a63f0", 600: "#2549d6", 700: "#1c37ab",
    800: "#1a3088", 900: "#182a6d", 950: "#101c4a",
  },
  emerald: {
    50: "#e8f7f0", 100: "#cdeee0", 200: "#a3e0c9", 300: "#6ecdaa",
    400: "#3ab98a", 500: "#12a06a", 600: "#0d8055", 700: "#0a6544",
    800: "#084f36", 900: "#06402c", 950: "#032418",
  },
  rose: {
    50: "#fdedec", 100: "#fbd9d7", 200: "#f6b8b5", 300: "#ee908c",
    400: "#e26965", 500: "#d64545", 600: "#b83232", 700: "#942626",
    800: "#741f1f", 900: "#5c1a1a", 950: "#300c0c",
  },
  amber: {
    50: "#fdf4e3", 100: "#fbe9c4", 200: "#f6d68c", 300: "#eebf51",
    400: "#dda527", 500: "#c88a09", 600: "#a26f06", 700: "#7d5605",
    800: "#614304", 900: "#4c3503", 950: "#291c02",
  },
  violet: {
    50: "#f2eefe", 100: "#e6ddfd", 200: "#cfbdfb", 300: "#b199f8",
    400: "#9376f7", 500: "#7a5af5", 600: "#6440dd", 700: "#4f31b0",
    800: "#3e278a", 900: "#32206e", 950: "#1c1140",
  },
  cyan: {
    50: "#e9f4fb", 100: "#d2e9f7", 200: "#a8d3ef", 300: "#79b9e3",
    400: "#4c9dd3", 500: "#2b7fbf", 600: "#1f6499", 700: "#184f79",
    800: "#133e5f", 900: "#10334d", 950: "#081d2c",
  },
} as const;

/* --------------------------------------------------------------- themes -- */

/*
 * Semantic tokens, mapped from the --crm-* / --clay-* custom properties that
 * :root and html.theme-dark define in index.css.
 *
 * The key names are held stable on purpose: ~29k lines of screens already
 * import `colors`, and holding the shape means the redesign reaches all of them
 * without touching a single screen file.
 */
export type ColorScheme = {
  bg: string;
  surface: string;
  surfaceMuted: string;
  surfaceRaised: string;
  surfaceStrong: string;
  text: string;
  textMuted: string;
  textTertiary: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryText: string;
  accent: string;
  accentStrong: string;
  success: string;
  successBg: string;
  successBorder: string;
  warning: string;
  warningBg: string;
  warningBorder: string;
  error: string;
  errorBg: string;
  errorBorder: string;
  info: string;
  infoBg: string;
  infoBorder: string;
  focusRing: string;
  shadow: string;
  highlight: string;
  overlay: string;
};

export const lightColors: ColorScheme = {
  bg: palette.slate[50],
  surface: "#ffffff",
  surfaceMuted: palette.slate[100],
  surfaceRaised: "#ffffff",
  surfaceStrong: "#ffffff",
  text: palette.slate[900],
  textMuted: palette.slate[500],
  textTertiary: palette.slate[400],
  border: palette.slate[200],
  borderStrong: palette.slate[300],
  primary: palette.blue[600],
  primaryText: "#ffffff",
  accent: palette.blue[600],
  accentStrong: palette.blue[700],
  success: palette.emerald[600],
  successBg: palette.emerald[50],
  successBorder: palette.emerald[200],
  warning: palette.amber[600],
  warningBg: palette.amber[50],
  warningBorder: palette.amber[200],
  error: palette.rose[600],
  errorBg: palette.rose[50],
  errorBorder: palette.rose[200],
  info: palette.cyan[600],
  infoBg: palette.cyan[50],
  infoBorder: palette.cyan[200],
  focusRing: "rgba(37, 73, 214, 0.22)",
  shadow: "#101828",
  highlight: "#ffffff",
  overlay: "rgba(13, 18, 25, 0.45)",
};

export const darkColors: ColorScheme = {
  bg: "#0d1219",
  surface: "#141a22",
  surfaceMuted: "#1b222b",
  surfaceRaised: "#1b222b",
  surfaceStrong: "#1b222b",
  text: "#e8ecf2",
  textMuted: "#8b96a5",
  textTertiary: palette.slate[500],
  border: "#2a323d",
  borderStrong: "#3a434f",
  primary: "#6b93ff",
  primaryText: "#0d1219",
  accent: "#6b93ff",
  accentStrong: "#a5c0ff",
  success: "#3ecf94",
  successBg: "rgba(18, 160, 106, 0.12)",
  successBorder: "rgba(18, 160, 106, 0.32)",
  warning: "#e6ae3c",
  warningBg: "rgba(200, 138, 9, 0.12)",
  warningBorder: "rgba(200, 138, 9, 0.32)",
  error: "#f07070",
  errorBg: "rgba(214, 69, 69, 0.12)",
  errorBorder: "rgba(214, 69, 69, 0.32)",
  info: "#79b9e3",
  infoBg: "rgba(43, 127, 191, 0.12)",
  infoBorder: "rgba(43, 127, 191, 0.32)",
  focusRing: "rgba(107, 147, 255, 0.28)",
  shadow: "#000000",
  highlight: "rgba(255, 255, 255, 0.06)",
  overlay: "rgba(0, 0, 0, 0.6)",
};

/*
 * The default export stays light. Screens that read `colors` directly keep
 * working exactly as before; screens migrated to useTheme() follow the active
 * scheme. Both can coexist while the migration runs, which is what lets this
 * land without a 57-file rewrite.
 */
export const colors = lightColors;

/* --------------------------------------------------------------- shapes -- */

// --crm-radius-sm / md / lg. Web is markedly less rounded than mobile was.
export const radii = {
  sm: 7,
  md: 10,
  lg: 14,
  xl: 14,
  pill: 999,
};

// Web card padding is p-4; header/footer gaps are gap-1.5 and gap-2.
export const spacing = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
};

/*
 * Web body type is 14px/1.5 Inter, headings at weight 650 with -0.018em
 * tracking. RN has no em tracking, so headings use letterSpacing in px.
 */
export const typography = {
  displayLg: 22,
  displayMd: 18,
  title: 16,
  section: 14,
  cardTitle: 13.5,
  body: 13,
  label: 12,
  badge: 11.5,
  caption: 11,
};

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const headingTracking = -0.25;

/* ------------------------------------------------------------ elevation -- */

/*
 * Three levels, matching shadow-crm-soft / -card / -panel. Each carries both an
 * iOS shadow and an Android elevation because the two render nothing alike.
 *
 * In dark mode a light shadow on a dark surface is invisible, so the dark
 * variants lean on a heavier black and the border carries the edge instead.
 */
const shadowFor = (scheme: ColorScheme, dark: boolean) => ({
  soft: {
    shadowColor: scheme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: dark ? 0.4 : 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  card: {
    shadowColor: scheme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: dark ? 0.45 : 0.1,
    shadowRadius: 12,
    elevation: 2,
  },
  panel: {
    shadowColor: scheme.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: dark ? 0.6 : 0.16,
    shadowRadius: 24,
    elevation: 6,
  },
});

export const lightElevation = shadowFor(lightColors, false);
export const darkElevation = shadowFor(darkColors, true);
export const elevation = lightElevation;

/*
 * Legacy aliases. The existing screens import `clay.shadow` and
 * `clay.shadowSmall`; keeping them pointed at the new elevation values means
 * those screens pick up the corrected depth without being edited.
 */
export const clay = {
  shadow: elevation.card,
  shadowSmall: elevation.soft,
  shadowPanel: elevation.panel,
};
