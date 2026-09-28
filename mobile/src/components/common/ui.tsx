import React from "react";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { brandStyles, round, type as t } from "../../theme/brand";

/*
 * Compatibility shim.
 *
 * The screens written before Phase 1 import AppCard / AppButton / AppChip /
 * AppInput from here. The real implementations now live in components/ui,
 * built to the web component contract; this file re-exports them so those
 * screens pick up the corrected design without being edited.
 *
 * New code should import from "../../components/ui" directly. This file goes
 * away once the last screen has been migrated.
 */

export { AppCard } from "../ui/Card";
export { AppButton } from "../ui/Button";
export { AppInput } from "../ui/Input";

/*
 * AppChip has no direct web counterpart - web uses Badge for status and a
 * button group for filters, and mobile collapsed both into one control. It is
 * kept here, restyled onto the new tokens, until the screens using it as a
 * filter move to AppTabs and the ones using it as a label move to AppBadge.
 */
export const AppChip = ({
  label,
  active,
  onPress,
  style,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected: Boolean(active) }}
    hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}
    style={[styles.chip, active && styles.chipActive, style]}
  >
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>
);

const styles = brandStyles((b) => StyleSheet.create({
  chip: {
    minHeight: 34,
    justifyContent: "center",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: b.fieldBorder,
    borderRadius: round.pill,
    backgroundColor: b.surface,
    paddingHorizontal: 12,
  },
  chipActive: {
    borderColor: b.primary,
    backgroundColor: b.primary,
  },
  chipText: {
    fontSize: t.label,
    fontWeight: "700",
    color: b.textSecondary,
  },
  chipTextActive: {
    color: b.onPrimary,
  },
}));
