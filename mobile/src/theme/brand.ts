import { getActiveScheme } from "./themedStyles";

/*
 * The design language of the mobile comps.
 *
 * Every value below was measured off the supplied screens rather than derived
 * from the web app: the comps are green where web is blue, and their type and
 * spacing scale is the phone's own. `tokens.ts` stays the contract with
 * frontend/tailwind.config.js and keeps serving every screen that has not been
 * redrawn yet - see docs/mobile/01_MOBILE_DESIGN_SYSTEM.md.
 *
 * The comps are rendered on a 430pt frame at 2x, so a pixel in the PNG is half
 * a point. Sizes here are the measured pixel values halved; widths flex,
 * because the same screen has to hold at 320pt.
 */

export type BrandTokens = {
  /* surfaces */
  bg: string;
  surface: string;
  border: string;
  hairline: string;

  /* type */
  text: string;
  textSecondary: string;
  textMuted: string;

  /* brand greens */
  ink: string;
  deep: string;
  green: string;
  greenBright: string;
  /* The solid green the inventory comps fill buttons, badges and the
     wizard's active step with. */
  primary: string;
  onPrimary: string;

  /* fills */
  track: string;
  tint: string;
  tintAvatar: string;
  tintBadge: string;
  tintSoft: string;
  tintBar: string;
  neutralBadge: string;

  /* form surfaces */
  fieldBorder: string;
  fieldMuted: string;
  placeholder: string;
  uploadTint: string;
  connector: string;
  chipActiveBg: string;
  chipActiveCount: string;
  warning: string;

  alert: string;
  /*
   * The amber and rose states, the two non-green counterparts of
   * `tint` / `tintBar` / `deep`: a wash to sit on, a heavier chip for a count
   * inside it, and the ink both are read against.
   */
  warnTint: string;
  warnChip: string;
  warnInk: string;
  alertTint: string;
  alertChip: string;
  alertInk: string;
  /* The blue triplet, for a state that is neither good nor bad - an invitation
     waiting to be accepted is the first thing that needed one. */
  infoTint: string;
  infoChip: string;
  infoInk: string;
};

const light: BrandTokens = {
  bg: "#f6f8fa",
  surface: "#ffffff",
  border: "#e8ecf2",
  hairline: "#edeff3",

  text: "#0b1220",
  textSecondary: "#5a6270",
  textMuted: "#6e7686",

  ink: "#064e3b",
  deep: "#065f46",
  green: "#0c8663",
  greenBright: "#0f946e",
  primary: "#067e5b",
  onPrimary: "#ffffff",

  track: "#a7dece",
  tint: "#ddf2ec",
  tintAvatar: "#d2eae3",
  tintBadge: "#dfefea",
  tintSoft: "#e7f5f1",
  tintBar: "#cfede4",
  neutralBadge: "#e3ebf0",

  fieldBorder: "#d9dee5",
  fieldMuted: "#f1f4f6",
  placeholder: "#858b9b",
  uploadTint: "#f2fbf9",
  connector: "#d5d9e0",
  chipActiveBg: "#d0ece3",
  chipActiveCount: "#5ab798",
  warning: "#c88a09",

  alert: "#ef3333",
  warnTint: "#fdf3e2",
  warnChip: "#f7e0b4",
  warnInk: "#b4791a",
  alertTint: "#fdeaea",
  alertChip: "#f8cdcd",
  alertInk: "#c53438",
  infoTint: "#e3eefc",
  infoChip: "#cfe0f8",
  infoInk: "#1f5fae",
};

/*
 * There is no dark comp yet, so this is a derivation rather than a spec: the
 * surfaces come from the app's existing dark scheme in tokens.ts, and the
 * greens keep their hue but swap roles - a mint that was a background tint
 * becomes the same green at low opacity, exactly as `dark:bg-emerald-500/10`
 * behaves on web. It exists so the screen does not turn unreadable when the
 * theme switch is flipped; replace it when a dark comp lands.
 */
const dark: BrandTokens = {
  bg: "#0d1219",
  surface: "#141a22",
  border: "#2a323d",
  hairline: "#232a34",

  text: "#e8ecf2",
  textSecondary: "#a2acba",
  textMuted: "#8b96a5",

  ink: "#7fd3b0",
  deep: "#5cc79f",
  green: "#3ecf94",
  greenBright: "#3ecf94",
  primary: "#12a06a",
  onPrimary: "#ffffff",

  track: "rgba(62, 207, 148, 0.24)",
  tint: "rgba(62, 207, 148, 0.14)",
  tintAvatar: "rgba(62, 207, 148, 0.18)",
  tintBadge: "rgba(62, 207, 148, 0.14)",
  tintSoft: "rgba(62, 207, 148, 0.10)",
  tintBar: "rgba(62, 207, 148, 0.20)",
  neutralBadge: "#1f2731",

  fieldBorder: "#39424f",
  fieldMuted: "#1b222b",
  placeholder: "#6c7789",
  uploadTint: "rgba(62, 207, 148, 0.08)",
  connector: "#39424f",
  chipActiveBg: "rgba(62, 207, 148, 0.16)",
  chipActiveCount: "rgba(62, 207, 148, 0.34)",
  warning: "#e6ae3c",

  alert: "#f07070",
  warnTint: "rgba(230, 174, 60, 0.14)",
  warnChip: "rgba(230, 174, 60, 0.30)",
  warnInk: "#e6ae3c",
  alertTint: "rgba(240, 112, 112, 0.14)",
  alertChip: "rgba(240, 112, 112, 0.30)",
  alertInk: "#f07070",
  infoTint: "rgba(112, 160, 240, 0.16)",
  infoChip: "rgba(112, 160, 240, 0.32)",
  infoInk: "#7fb0f5",
};

export const brandTokensFor = (scheme: "light" | "dark") => (scheme === "dark" ? dark : light);

/*
 * Read at access time, not at import, so a value used straight in JSX - an icon
 * tint, a backgroundColor on a View - follows the active scheme for the same
 * reason `themePalette` does.
 */
export const brand = new Proxy({} as BrandTokens, {
  get: (_target, prop) => brandTokensFor(getActiveScheme())[prop as keyof BrandTokens],
});

/* ------------------------------------------------------------------ scale -- */

/** Type sizes measured off the comps. Weights are named faces via Inter. */
export const type = {
  /* The inventory comps' page heading, e.g. "Inventory". */
  pageTitle: 26,
  hero: 20,
  /* A pushed screen's bar title, e.g. "Add property". */
  barTitle: 17,
  price: 18,
  wordmark: 18,
  metric: 16,
  sectionTitle: 15,
  rowTitle: 14,
  cardTitle: 13,
  /* Form field value and its label. */
  field: 13,
  body: 12,
  fieldLabel: 11,
  label: 11,
  /* The greeting CTA's two lines, sized so "Build tomorrow" holds one line. */
  cta: 10.5,
  tagline: 10,
  /* The attendance comp's stat-tile label and the caption inside its ring. */
  micro: 9,
} as const;

/** Corner radii, measured corner by corner. */
export const round = {
  card: 9,
  banner: 7,
  /* The inventory comps: a slightly softer card, an 8pt field or chip, and a
     6pt solid button. */
  panel: 10,
  field: 8,
  chip: 8,
  button: 6,
  pill: 999,
} as const;

/** The 18pt page gutter and the gaps between the comps' blocks. */
export const layout = {
  /*
   * Home's comp draws an 18pt gutter; the inventory comps draw 15-18 and
   * settle on 16. The two are kept apart rather than averaged so each screen
   * matches the comp it was drawn from - see the note in
   * docs/mobile/01_MOBILE_DESIGN_SYSTEM.md about normalising them.
   */
  gutter: 18,
  pageGutter: 16,
  gridGap: 9,
  sectionGap: 16,
  /* Form metrics: a 44pt field (the iOS minimum target; the comps draw
     32-43), its 12pt label above, and 16pt of card padding. */
  fieldHeight: 44,
  fieldGap: 16,
  cardPadding: 16,
} as const;

/* ----------------------------------------------------------- stylesheets -- */

/*
 * `themedStyles` for brand tokens. Same mechanics and the same reason: a
 * StyleSheet built at import is fixed to whatever scheme was active then, so
 * the sheet is declared as a function of the tokens and resolved on property
 * access, which happens during render.
 */
export const brandStyles = <T extends Record<string, unknown>>(
  make: (b: BrandTokens) => T,
): T => {
  const cache = new Map<string, T>();

  const resolve = (): T => {
    const key = getActiveScheme();
    let built = cache.get(key);
    if (!built) {
      built = make(brandTokensFor(key));
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
