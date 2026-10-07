# Mobile Design System Contract

**Purpose:** define "exact same design" as something a developer can implement
and a reviewer can check. Every value here is lifted from
`frontend/tailwind.config.js` and `frontend/src/index.css`. Where mobile must
differ, the reason is stated.

**Rule:** no colour, radius, font size, or shadow may be written as a literal in
a screen file. If it isn't in `mobile/src/theme/tokens.ts`, it doesn't ship.

---

## 1. Colour tokens

### 1.1 Semantic tokens (the ones screens use)

Ported from the `--crm-*` / `--clay-*` custom properties in `index.css`. Mobile
needs both themes because web has both.

| Token | Light | Dark | Web origin |
| --- | --- | --- | --- |
| `bg` | `#f5f7fa` | `#0d1219` | `--crm-bg` |
| `surface` | `#ffffff` | `#141a22` | `--crm-surface` |
| `surfaceMuted` | `#f5f7fa` | `#1b222b` | `--crm-surface-muted` |
| `surfaceStrong` | `#ffffff` | `#1b222b` | `--clay-surface-strong` |
| `border` | `#e0e5ed` | `#2a323d` | `--crm-border` |
| `borderStrong` | `#c8d0dd` | `#3a434f` | `--crm-border-strong` |
| `text` | `#161c24` | `#e8ecf2` | `--crm-text` |
| `textMuted` | `#6c7789` | `#8b96a5` | `--crm-text-muted` |
| `textTertiary` | `#98a3b5` | `#6c7789` | `text.tertiary` |
| `accent` | `#2549d6` | `#6b93ff` | `--crm-accent` |
| `accentStrong` | `#1c37ab` | `#a5c0ff` | `--clay-accent-strong` |
| `success` | `#0d8055` | `#3ecf94` | `--clay-green` |
| `danger` | `#b83232` | `#f07070` | `--clay-rose` |
| `warning` | `#a26f06` | `#e6ae3c` | `--clay-gold` |
| `focusRing` | `rgba(37,73,214,.22)` | `rgba(107,147,255,.28)` | `--crm-focus-ring` |

### 1.2 Palette scales

Web overrides the Tailwind scales wholesale so ~7,000 existing `slate-*`,
`blue-*`, etc. class names resolve to the redesign. Mobile needs the same scales
available for badges and charts. Copy verbatim from `tailwind.config.js`:

```ts
slate: { 50:"#f5f7fa",100:"#edf0f5",200:"#e0e5ed",300:"#c8d0dd",400:"#98a3b5",
         500:"#6c7789",600:"#4e5867",700:"#39424f",800:"#242b35",900:"#161c24",950:"#0d1219" }
blue:  { 50:"#eef3ff",100:"#dde6ff",200:"#bcd0ff",300:"#8fb0ff",400:"#5c87fb",
         500:"#3a63f0",600:"#2549d6",700:"#1c37ab",800:"#1a3088",900:"#182a6d",950:"#101c4a" }
emerald:{50:"#e8f7f0",100:"#cdeee0",200:"#a3e0c9",300:"#6ecdaa",400:"#3ab98a",
         500:"#12a06a",600:"#0d8055",700:"#0a6544",800:"#084f36",900:"#06402c",950:"#032418" }
rose:  { 50:"#fdedec",100:"#fbd9d7",200:"#f6b8b5",300:"#ee908c",400:"#e26965",
         500:"#d64545",600:"#b83232",700:"#942626",800:"#741f1f",900:"#5c1a1a",950:"#300c0c" }
amber: { 50:"#fdf4e3",100:"#fbe9c4",200:"#f6d68c",300:"#eebf51",400:"#dda527",
         500:"#c88a09",600:"#a26f06",700:"#7d5605",800:"#614304",900:"#4c3503",950:"#291c02" }
violet:{ 50:"#f2eefe",100:"#e6ddfd",200:"#cfbdfb",300:"#b199f8",400:"#9376f7",
         500:"#7a5af5",600:"#6440dd",700:"#4f31b0",800:"#3e278a",900:"#32206e",950:"#1c1140" }
cyan:  { 50:"#e9f4fb",100:"#d2e9f7",200:"#a8d3ef",300:"#79b9e3",400:"#4c9dd3",
         500:"#2b7fbf",600:"#1f6499",700:"#184f79",800:"#133e5f",900:"#10334d",950:"#081d2c" }
```

### 1.3 Theme delivery on mobile

Web switches on the `html.theme-dark` class. Mobile needs the equivalent:

- `ThemeProvider` in `mobile/src/theme/ThemeContext.tsx` exposing
  `{ mode, colors, setMode }` where `mode` is `"light" | "dark" | "system"`.
- Persist the choice in `AsyncStorage` under the **same key the web app uses**,
  so a user's preference reads consistently if both are used.
- `app.json` must change `"userInterfaceStyle": "light"` → `"automatic"`,
  and the splash `backgroundColor` from `#000000` → `#f5f7fa` (light) with a
  dark variant. The current black splash matches neither theme.

## 2. Radii

Web uses `--crm-radius-sm/md/lg` = `7 / 10 / 14`, plus Tailwind `rounded-lg`
(8px) and `rounded-xl` (12px) on cards and buttons.

| Token | Value | Used for |
| --- | ---: | --- |
| `sm` | 7 | Chips, small inputs |
| `md` | 10 | Buttons, inputs, icon buttons |
| `lg` | 14 | Cards, panels, sheets |
| `pill` | 999 | Badges, avatars |

**Change from current mobile:** `12 / 14 / 18 / 24` → `7 / 10 / 14`. Everything
on mobile is currently noticeably rounder than web. This single change does more
for perceived parity than any other.

## 3. Typography

Web body is **14px / 1.5**, Inter, with headings at `font-weight: 650` and
`letter-spacing: -0.018em`.

| Token | Size | Weight | Web origin |
| --- | ---: | ---: | --- |
| `displayLg` | 22 | 650 | `h1` |
| `displayMd` | 18 | 650 | `h2` |
| `title` | 16 | 650 | `h3` |
| `cardTitle` | 13.5 | 600 | `CardTitle` |
| `body` | 14 | 400 | `body` |
| `bodySm` | 13 | 400 | `Input`, `Select` |
| `label` | 12.5 | 600 | `Tabs` trigger |
| `caption` | 12 | 400 | `CardDescription` |
| `badge` | 11.5 | 600 | `Badge` |

**Fonts to bundle** (`expo-font`, matching the web's Google Fonts link):
- `Inter` 400 / 500 / 600 / 700
- `JetBrains Mono` 400 / 500 — web uses it for `code`, `.mono`, `.font-mono`,
  and for tabular numbers in `Pagination`.

RN has no `letter-spacing: -0.018em`; use `letterSpacing: -0.25` (px at 14px
base) on heading styles.

### Sizing a redrawn screen off its comp

The comps are far higher in contrast than the table above: a 26–27pt page title
sitting over 9–11pt row text. Reaching for `type.body` (12) or
`type.sectionTitle` (15) for the secondary lines of a list row makes every row
roughly a third taller than the comp and truncates the text the comp fits, so
guessing from the scale does not work. Measure instead:

1. Normalise the comp to the 430pt frame the app renders at — `S = imageWidth /
   430`, whatever the mock's own frame was. Everything below is in points at
   that scale.
2. Find the ink extent of one string, horizontally: the first and last columns
   in its band that carry ink.
3. Fit that width against Inter's real advance widths (the `hmtx` table) across
   sizes and weights. One string usually pins the size to within half a point;
   two agreeing strings settle it.

Cap height is the sanity check, not the measurement — `capHeight / 0.7275` gets
close but a descender or an icon sharing the line throws it, and the width fit
does not care.

Fitting rather than guessing is what the Team batch (comps 37–40) settled on
after a first pass built from the token scale had to be redone.

## 4. Elevation

Web has exactly three levels. Mobile must map each to an RN shadow **and** an
Android `elevation`, because they render differently.

| Token | Web | RN (iOS) | Android |
| --- | --- | --- | ---: |
| `soft` | `0 1px 2px rgba(16,24,40,.05)` | offset `0,1` · radius `2` · opacity `.05` | `1` |
| `card` | `0 1px 2px rgba(16,24,40,.06), 0 8px 20px -12px rgba(16,24,40,.24)` | offset `0,4` · radius `12` · opacity `.10` | `2` |
| `panel` | `0 12px 36px -14px rgba(16,24,40,.28), 0 2px 6px rgba(16,24,40,.06)` | offset `0,10` · radius `24` · opacity `.16` | `6` |

In dark mode web swaps to near-black shadows; mobile does the same
(`shadowColor: "#000"`, higher opacity) — a light shadow on a dark surface is
invisible and the card loses its edge, so dark mode leans on `border` instead.

**Change from current mobile:** existing `clay.shadow` is offset `0,8` radius
`18` opacity `.08` — heavier and softer than web's `card`. Retune to the table.

## 5. Spacing

Web cards use `p-4` (16px), header/footer gaps `gap-1.5` (6px), button gaps
`gap-2` (8px).

`{ xs: 4, sm: 6, md: 8, lg: 12, xl: 16, xxl: 24 }`

**Change from current mobile:** `{4, 8, 12, 16}` has no 6 and no 24; card
padding is 12 where web is 16.

## 6. Component contract

Each web primitive in `frontend/src/components/ui/` gets one RN counterpart in
`mobile/src/components/ui/`. Same name, same props where they translate.

### 6.1 `Button` → `AppButton`

Web variants: `primary` · `secondary` · `ghost` · `danger` · `success`
Current mobile: only `primary` · `ghost`. **Add the missing three.**

| Variant | Border | Background | Text |
| --- | --- | --- | --- |
| `primary` | `blue.600` | `blue.600` | `#fff` |
| `secondary` | `slate.300` | `surface` | `slate.800` |
| `ghost` | transparent | transparent | `slate.600` |
| `danger` | `rose.600` | `rose.600` | `#fff` |
| `success` | `emerald.600` | `emerald.600` | `#fff` |

Sizes — web `h-8 / h-9 / h-10`, radius `lg` (8px → token `md`):

| Size | Height | Padding X | Font |
| --- | ---: | ---: | ---: |
| `sm` | 32 | 12 | 12 |
| `md` | 36 | 14 | 13 |
| `lg` | 40 | 16 | 14 |

> **Touch-target exception.** 32px and 36px are below the 44px iOS / 48dp
> Android minimum. Keep the *visual* height identical to web, and extend the
> tappable area with `hitSlop` to reach 44. This is the one place where
> matching web exactly would produce an app that fails accessibility review.

Props to carry over: `variant`, `size`, `disabled` (opacity `.6`),
`leftIcon`, `rightIcon` (16px), plus RN-only `loading`.

### 6.2 `Card` → `AppCard`

Web: `rounded-xl border border-slate-200 bg-white shadow-crm-card`, sub-parts
`CardHeader` (border-bottom, `p-4`, `gap-1.5`), `CardTitle` (13.5/600),
`CardDescription` (12/`slate.500`), `CardContent` (`p-4`),
`CardFooter` (border-top, `p-4`, `gap-2`).

Mobile must export all five sub-components, not just the container. Current
`AppCard` is a bare `View` — every screen re-implements headers by hand, which
is the main reason mobile cards look inconsistent.

### 6.3 `Badge` → `AppBadge`

Eight variants: `slate` `blue` `cyan` `emerald` `amber` `rose` `violet`
`outline`. Anatomy: `pill` radius, 1px border, `px 10 / py 4`, 11.5/600,
optional 6px leading dot. Light = `{n}.50` bg / `{n}.200` border / `{n}.700`
text; dark = `{n}.500 @10%` bg / `{n}.500 @30%` border / `{n}.200` text.
`outline` is dashed — RN has no dashed border on Android reliably; use
`borderStyle: "dashed"` on iOS and a solid `borderStrong` on Android.

Badges carry lead stage and status colour throughout the app, so all eight must
exist before the leads and inventory phases.

### 6.4 `Input` / `Select` → `AppInput` / `AppSelect`

Web: `h-9` (36), radius `lg`, `border-slate-300`, `bg-white`, 13px text,
placeholder `slate.500`; focus → `border-blue-600` + 2px `blue.600/20` ring;
disabled → `bg-slate-100` + `text-slate-500`.

Mobile additions: `label`, `error`, `helperText` (web renders these in the form
layer; on a phone they belong in the field). `AppSelect` has no HTML `<select>`
equivalent — use a bottom sheet picker styled as `panel` elevation, never the
platform-default wheel, which looks nothing like web.

### 6.5 Remaining primitives

| Web | Mobile | Notes |
| --- | --- | --- |
| `IconButton` | `AppIconButton` | 32/36/40 square, radius `md`, `slate.200` border + hitSlop to 44 |
| `Tabs` | `AppTabs` | 2px bottom border on active (`blue.600`), 12.5/600 labels, horizontally scrollable on phone |
| `EmptyState` | `AppEmptyState` | Dashed border, 42px icon chip, 14.5/600 title + 13px body |
| `Skeleton` | `AppSkeleton` | `slate.100` bg, radius `md`, `Animated` pulse (RN has no `animate-pulse`) |
| `SearchInput` | `AppSearchInput` | Input + 24px round clear button |
| `Pagination` | `AppPagination` | Mostly replaced by infinite scroll on phone — keep for parity where web paginates explicitly |
| `Modal` | `AppModal` | RN `Modal`, `panel` elevation, radius `lg` |
| `ConfirmDialog` | `AppConfirmDialog` | Same copy and button order as web |
| `ToastNotice` | `AppToast` | Anchors above the tab bar, respects safe area |
| `Tooltip` | — | ➖ No hover on touch. Web tooltips become either a visible caption or a long-press popover; decide per use site |
| `ErrorState` | `AppErrorState` | With retry |

## 7. Icons

Web uses **lucide-react**. Mobile already has **lucide-react-native** in
`package.json` — but `RoleTabs.tsx` uses `@expo/vector-icons` Ionicons instead,
so the tab bar icons are a different family from every other icon in the app
*and* from web.

**Action:** standardise on `lucide-react-native` everywhere. The web nav icon
names in `workbenchNavigation.js` (`Home`, `Users`, `Building2`, `PieChart`,
`ClipboardList`, `Calendar`, `MessageSquare`, `Building`, `ShieldCheck`,
`Settings`) port across unchanged — same names, same library family.

## 8. Layout adaptation rules

Recorded once here so each screen doesn't re-decide.

| Web pattern | Mobile pattern |
| --- | --- |
| Data table | Card list; row → card, columns → labelled rows. Primary 3 fields visible, rest on detail |
| Left sidebar (`SIDEBAR_GROUPS`) | Bottom tabs (5 max) + "More" screen holding the rest |
| Top command bar | Native stack header + search icon |
| Hover reveal | Always visible, or long-press |
| Right-side drawer / flyout | Bottom sheet |
| Multi-column form | Single column, grouped by `CardHeader` sections |
| Inline row actions | Swipe actions + overflow menu |
| `FloatingMessenger` | Chat tab (already the case) |

## 9. Acceptance checklist

A screen passes design review when:

- [ ] No literal colour / radius / font size in the screen file
- [ ] Renders correctly in light **and** dark mode
- [ ] Every touch target ≥ 44×44 (visual size may be smaller via `hitSlop`)
- [ ] Uses `lucide-react-native`, not Ionicons
- [ ] Uses `AppCard` sub-components rather than hand-built headers
- [ ] Safe-area correct on a notched device and with the Android nav bar
- [ ] Side-by-side screenshot against the web screen at 390px width attached to the PR
