import React from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Glyph, type GlyphName } from "../ui/Glyph";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";

/*
 * The pieces every screen built in the comps' green language keeps redrawing:
 * a page with a back arrow and a big title, a solid green button, a filter
 * chip, a tinted banner, a label-value row.
 *
 * The first comp screens each carried their own copy. The screens ported to
 * reach web parity - which have no comp of their own - are drawn from these
 * instead, measured against the comp screens so they sit beside them without a
 * seam: the same 26pt page title, 16pt gutter, 10pt panel radius and 44pt
 * control height.
 */

/* ------------------------------------------------------------------ page -- */

export const BrandPage = ({
  title,
  subtitle,
  onBack,
  right,
  children,
  footer,
  refreshing,
  onRefresh,
  loading,
  scroll = true,
  contentStyle,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Header actions against the right edge, level with the back arrow. */
  right?: React.ReactNode;
  children?: React.ReactNode;
  /** Pinned under the scroll - a sticky primary action or a selection bar. */
  footer?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  loading?: boolean;
  /** Off for a page that brings its own list (a FlatList wants the height). */
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) => {
  const insets = useSafeAreaInsets();

  const header = (
    <View style={styles.header}>
      {onBack || right ? (
        <View style={styles.headerBar}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Glyph name="arrow-back" size={24} color={brand.text} />
            </Pressable>
          ) : (
            <View />
          )}
          {right ? <View style={styles.headerRight}>{right}</View> : null}
        </View>
      ) : null}
      <Text style={styles.pageTitle} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      {loading ? (
        <>
          {header}
          <View style={styles.centred}>
            <ActivityIndicator size="large" color={brand.primary} />
          </View>
        </>
      ) : scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: footer ? layout.sectionGap : layout.sectionGap + insets.bottom },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
                tintColor={brand.primary}
                colors={[brand.primary]}
              />
            ) : undefined
          }
        >
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={styles.scroll}>
          {header}
          <View style={[styles.flexBody, contentStyle]}>{children}</View>
        </View>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>{footer}</View>
      ) : null}
    </SafeAreaView>
  );
};

/* ---------------------------------------------------------------- button -- */

export type BrandButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dangerSoft";

export const BrandButton = ({
  title,
  onPress,
  icon,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  icon?: GlyphName;
  variant?: BrandButtonVariant;
  size?: "md" | "sm";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) => {
  const inert = disabled || loading;
  const ink =
    variant === "primary" || variant === "danger"
      ? brand.onPrimary
      : variant === "dangerSoft"
        ? brand.alertInk
        : variant === "ghost"
          ? brand.textSecondary
          : brand.text;

  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: Boolean(inert), busy: Boolean(loading) }}
      style={({ pressed }) => [
        styles.button,
        size === "sm" && styles.buttonSm,
        styles[`button_${variant}`],
        inert && styles.buttonDisabled,
        pressed && !inert && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={ink} />
      ) : icon ? (
        <Glyph name={icon} size={size === "sm" ? 15 : 17} color={ink} />
      ) : null}
      <Text style={[styles.buttonLabel, size === "sm" && styles.buttonLabelSm, { color: ink }]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
};

/** A round header action - a glyph on a hairline disc. */
export const IconAction = ({
  icon,
  onPress,
  label,
  badge,
  disabled,
}: {
  icon: GlyphName;
  onPress: () => void;
  label: string;
  badge?: boolean;
  disabled?: boolean;
}) => (
  <Pressable
    onPress={disabled ? undefined : onPress}
    style={[styles.iconAction, disabled && styles.buttonDisabled]}
    hitSlop={6}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Glyph name={icon} size={19} color={brand.text} />
    {badge ? <View style={styles.iconBadge} /> : null}
  </Pressable>
);

/* ------------------------------------------------------------------ chip -- */

export const Chip = ({
  label,
  active,
  onPress,
  count,
  dot,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  count?: number;
  dot?: string;
  icon?: GlyphName;
}) => (
  <Pressable
    onPress={onPress}
    style={[styles.chip, active && styles.chipActive]}
    accessibilityRole="button"
    accessibilityState={{ selected: Boolean(active) }}
  >
    {dot ? <View style={[styles.chipDot, { backgroundColor: dot }]} /> : null}
    {icon ? <Glyph name={icon} size={14} color={active ? brand.ink : brand.textSecondary} /> : null}
    <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
      {label}
    </Text>
    {count !== undefined ? (
      <Text style={[styles.chipCount, active && styles.chipCountActive]}>{count}</Text>
    ) : null}
  </Pressable>
);

export const ChipRow = ({ children, wrap }: { children: React.ReactNode; wrap?: boolean }) =>
  wrap ? (
    <View style={styles.chipWrap}>{children}</View>
  ) : (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipScroll}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );

/* ---------------------------------------------------------------- banner -- */

export type Tone = "info" | "warn" | "alert" | "success" | "neutral";

const toneColours = (tone: Tone) => {
  switch (tone) {
    case "warn":
      return { bg: brand.warnTint, ink: brand.warnInk, icon: "warning" as GlyphName };
    case "alert":
      return { bg: brand.alertTint, ink: brand.alertInk, icon: "alert-circle" as GlyphName };
    case "success":
      return { bg: brand.tint, ink: brand.deep, icon: "checkmark-circle" as GlyphName };
    case "neutral":
      return { bg: brand.fieldMuted, ink: brand.textSecondary, icon: "information-circle" as GlyphName };
    default:
      return { bg: brand.infoTint, ink: brand.infoInk, icon: "information-circle" as GlyphName };
  }
};

export const Banner = ({
  tone = "info",
  title,
  message,
  action,
  onAction,
  icon,
  style,
}: {
  tone?: Tone;
  title?: string;
  message?: string;
  action?: string;
  onAction?: () => void;
  icon?: GlyphName;
  style?: StyleProp<ViewStyle>;
}) => {
  const colours = toneColours(tone);
  return (
    <View style={[styles.banner, { backgroundColor: colours.bg }, style]} accessibilityRole="alert">
      <Glyph name={icon || colours.icon} size={17} color={colours.ink} />
      <View style={styles.bannerText}>
        {title ? <Text style={[styles.bannerTitle, { color: colours.ink }]}>{title}</Text> : null}
        {message ? <Text style={[styles.bannerMessage, { color: colours.ink }]}>{message}</Text> : null}
        {action && onAction ? (
          <Pressable onPress={onAction} accessibilityRole="button" hitSlop={6}>
            <Text style={[styles.bannerAction, { color: colours.ink }]}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

/** A small rounded status pill. */
export const Pill = ({ label, tone = "neutral", icon }: { label: string; tone?: Tone; icon?: GlyphName }) => {
  const colours = toneColours(tone);
  return (
    <View style={[styles.pill, { backgroundColor: colours.bg }]}>
      {icon ? <Glyph name={icon} size={11} color={colours.ink} /> : null}
      <Text style={[styles.pillLabel, { color: colours.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

/* --------------------------------------------------------------- panels -- */

export const Panel = ({
  title,
  subtitle,
  count,
  icon,
  right,
  children,
  style,
}: {
  title?: string;
  subtitle?: string;
  count?: string | number;
  icon?: GlyphName;
  right?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => (
  <View style={[styles.panel, style]}>
    {title ? (
      <View style={styles.panelHead}>
        <View style={styles.panelTitleRow}>
          {icon ? <Glyph name={icon} size={16} color={brand.textSecondary} /> : null}
          <Text style={styles.panelTitle} numberOfLines={1}>
            {title}
          </Text>
          {count !== undefined ? <Text style={styles.panelCount}>{count}</Text> : null}
          {right ? <View style={styles.panelRight}>{right}</View> : null}
        </View>
        {subtitle ? <Text style={styles.panelSubtitle}>{subtitle}</Text> : null}
      </View>
    ) : null}
    {children}
  </View>
);

export const KeyValue = ({
  label,
  value,
  mono,
  icon,
}: {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
  icon?: GlyphName;
}) => (
  <View style={styles.kvRow}>
    <View style={styles.kvLabelWrap}>
      {icon ? <Glyph name={icon} size={13} color={brand.textMuted} /> : null}
      <Text style={styles.kvLabel}>{label}</Text>
    </View>
    {typeof value === "string" || typeof value === "number" || value === undefined || value === null ? (
      <Text style={[styles.kvValue, mono && styles.kvMono, !value && value !== 0 && styles.kvEmpty]} selectable>
        {value || value === 0 ? String(value) : "Not recorded"}
      </Text>
    ) : (
      <View style={styles.kvValueWrap}>{value}</View>
    )}
  </View>
);

export const StatTile = ({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: GlyphName;
  tone?: Tone;
}) => {
  const colours = tone ? toneColours(tone) : null;
  return (
    <View style={styles.stat}>
      {icon ? (
        <View style={[styles.statIcon, colours && { backgroundColor: colours.bg }]}>
          <Glyph name={icon} size={14} color={colours?.ink || brand.deep} />
        </View>
      ) : null}
      <Text style={[styles.statValue, colours && { color: colours.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
};

export const Avatar = ({ name, size = 36, muted }: { name?: string; size?: number; muted?: boolean }) => {
  const letters = String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
        muted && styles.avatarMuted,
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.36) }, muted && styles.avatarTextMuted]}>
        {letters || "?"}
      </Text>
    </View>
  );
};

export const EmptyNote = ({ icon = "file-tray-outline", title, message }: { icon?: GlyphName; title: string; message?: string }) => (
  <View style={styles.empty}>
    <Glyph name={icon} size={26} color={brand.textMuted} />
    <Text style={styles.emptyTitle}>{title}</Text>
    {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
  </View>
);

export const Divider = () => <View style={styles.divider} />;

/* ---------------------------------------------------------------- styles -- */

const styles = brandStyles((b) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: b.bg },
    scroll: { flex: 1 },
    content: { paddingHorizontal: layout.pageGutter, gap: 12 },
    flexBody: { flex: 1, paddingHorizontal: layout.pageGutter },
    centred: { flex: 1, alignItems: "center", justifyContent: "center" },

    header: { paddingTop: 8, paddingBottom: 4 },
    headerBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
      minHeight: 32,
    },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    pageTitle: {
      fontSize: t.pageTitle,
      lineHeight: 31,
      fontWeight: "700",
      letterSpacing: -0.8,
      color: b.text,
    },
    pageSubtitle: { marginTop: 2, fontSize: t.cardTitle, lineHeight: 18, color: b.textMuted },

    footer: {
      paddingHorizontal: layout.pageGutter,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: b.hairline,
      backgroundColor: b.surface,
    },

    button: {
      height: layout.fieldHeight,
      paddingHorizontal: 16,
      borderRadius: round.button,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      borderWidth: 1,
      borderColor: "transparent",
    },
    buttonSm: { height: 34, paddingHorizontal: 11, gap: 5 },
    button_primary: { backgroundColor: b.primary },
    button_secondary: { backgroundColor: b.surface, borderColor: b.fieldBorder },
    button_ghost: { backgroundColor: "transparent" },
    button_danger: { backgroundColor: b.alert },
    button_dangerSoft: { backgroundColor: b.alertTint },
    buttonDisabled: { opacity: 0.45 },
    buttonPressed: { opacity: 0.82 },
    buttonLabel: { fontSize: t.field, fontWeight: "600", flexShrink: 1 },
    buttonLabelSm: { fontSize: t.label },

    iconAction: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: b.border,
      backgroundColor: b.surface,
    },
    iconBadge: {
      position: "absolute",
      top: 7,
      right: 8,
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: b.alert,
    },

    chipScroll: { gap: 7, paddingRight: layout.pageGutter },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 32,
      paddingHorizontal: 11,
      borderRadius: round.chip,
      borderWidth: 1,
      borderColor: b.fieldBorder,
      backgroundColor: b.surface,
    },
    chipActive: { backgroundColor: b.chipActiveBg, borderColor: b.chipActiveBg },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    chipLabel: { fontSize: t.label, fontWeight: "500", color: b.textSecondary },
    chipLabelActive: { color: b.ink, fontWeight: "600" },
    chipCount: { fontSize: t.label, fontWeight: "600", color: b.textMuted },
    chipCountActive: { color: b.ink },

    banner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 9,
      padding: 12,
      borderRadius: round.panel,
    },
    bannerText: { flex: 1, minWidth: 0, gap: 3 },
    bannerTitle: { fontSize: t.cardTitle, fontWeight: "700" },
    bannerMessage: { fontSize: t.body, lineHeight: 17 },
    bannerAction: { marginTop: 4, fontSize: t.body, fontWeight: "700", textDecorationLine: "underline" },

    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: round.pill,
    },
    pillLabel: { fontSize: 10.5, fontWeight: "700" },

    panel: {
      padding: 14,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    panelHead: { marginBottom: 10 },
    panelTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    panelTitle: { flexShrink: 1, fontSize: t.sectionTitle, fontWeight: "700", letterSpacing: -0.3, color: b.text },
    panelCount: {
      paddingHorizontal: 7,
      paddingVertical: 1,
      borderRadius: round.pill,
      overflow: "hidden",
      backgroundColor: b.fieldMuted,
      fontSize: 10.5,
      fontWeight: "700",
      color: b.textSecondary,
    },
    panelRight: { marginLeft: "auto" },
    panelSubtitle: { marginTop: 3, fontSize: t.label, lineHeight: 15, color: b.textMuted },

    kvRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 5 },
    kvLabelWrap: { width: 112, flexDirection: "row", alignItems: "center", gap: 5 },
    kvLabel: { fontSize: t.label, color: b.textMuted },
    kvValue: { flex: 1, minWidth: 0, fontSize: t.body, color: b.text },
    kvValueWrap: { flex: 1, minWidth: 0, alignItems: "flex-start" },
    kvMono: { fontVariant: ["tabular-nums"], letterSpacing: 0.2 },
    kvEmpty: { color: b.placeholder },

    stat: {
      flex: 1,
      minWidth: 0,
      padding: 11,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    statIcon: {
      width: 24,
      height: 24,
      borderRadius: 7,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
      backgroundColor: b.tint,
    },
    statValue: { fontSize: t.metric, fontWeight: "700", color: b.text, fontVariant: ["tabular-nums"] },
    statLabel: { marginTop: 1, fontSize: t.label, color: b.textMuted },
    statHint: { marginTop: 2, fontSize: 10, lineHeight: 13, color: b.placeholder },

    avatar: { alignItems: "center", justifyContent: "center", backgroundColor: b.primary },
    avatarMuted: { backgroundColor: b.neutralBadge },
    avatarText: { color: b.onPrimary, fontWeight: "700" },
    avatarTextMuted: { color: b.textSecondary },

    empty: {
      alignItems: "center",
      paddingVertical: 28,
      paddingHorizontal: 16,
      gap: 6,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: b.fieldBorder,
      borderRadius: round.panel,
    },
    emptyTitle: { fontSize: t.cardTitle, fontWeight: "700", color: b.text, textAlign: "center" },
    emptyMessage: { fontSize: t.body, lineHeight: 17, color: b.textMuted, textAlign: "center" },

    divider: { height: 1, backgroundColor: b.hairline, marginVertical: 8 },
  }),
);
