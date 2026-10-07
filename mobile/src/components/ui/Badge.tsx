import React from "react";
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, palette, radii, typography } from "../../theme/tokens";
import { themedStyles, themePalette } from "../../theme/themedStyles";

/*
 * Mirrors frontend/src/components/ui/Badge.jsx - all eight variants. Lead
 * stage, task state and inventory status all read their colour from here, so
 * every one of them has to exist before those modules can match web.
 *
 * Web anatomy: pill radius, 1px border, px-2.5 py-1, 11.5px/600, optional
 * 1.5-unit leading dot in the current text colour.
 */

export type BadgeVariant =
  | "slate"
  | "blue"
  | "cyan"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "outline";

const scaleFor = (variant: Exclude<BadgeVariant, "outline">) => {
  const scales = {
    slate: themePalette.slate,
    blue: themePalette.blue,
    cyan: themePalette.cyan,
    emerald: themePalette.emerald,
    amber: themePalette.amber,
    rose: themePalette.rose,
    violet: themePalette.violet,
  } as const;
  return scales[variant] || themePalette.slate;
};

export const AppBadge = ({
  children,
  variant = "slate",
  dot = false,
  style,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
}) => {
  const outline = variant === "outline";
  const scale = outline ? themePalette.slate : scaleFor(variant);

  // Web's `slate` variant is the one that uses the 100-level fill; the rest sit
  // on the 50-level. Reproduced rather than normalised, so stage colours land
  // on exactly the same tint they do on the web pipeline.
  const background = outline ? "transparent" : variant === "slate" ? scale[100] : scale[50];
  const border = outline ? themePalette.slate[300] : variant === "slate" ? scale[300] : scale[200];
  const text = outline ? themePalette.slate[600] : scale[700];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: background,
          borderColor: border,
          /*
           * Android's dashed border renders unreliably (and not at all on some
           * OEM skins), so the dashed `outline` treatment is iOS-only and
           * Android gets the solid border instead of a missing one.
           */
          borderStyle: outline && Platform.OS === "ios" ? "dashed" : "solid",
        },
        style,
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: text }]} /> : null}
      <Text style={[styles.label, { color: text }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: typography.badge,
    fontWeight: "600",
  },
}));

export default AppBadge;
