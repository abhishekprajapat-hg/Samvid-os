import React from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { colors, elevation, palette, radii, spacing, typography } from "../../theme/tokens";
import { themedStyles, themePalette } from "../../theme/themedStyles";

/*
 * Mirrors frontend/src/components/ui/Card.jsx, including the sub-components.
 *
 * The sub-components matter more here than they do on web. The existing mobile
 * screens each hand-build their own card header, which is why no two of them
 * line up; exporting the same five pieces web has is what makes that stop.
 *
 * Web anatomy: rounded-xl, 1px slate-200 border, white surface, shadow-crm-card.
 * Header and footer carry a divider and p-4; content is p-4.
 */

export const AppCard = ({
  children,
  interactive,
  style,
}: {
  children: React.ReactNode;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}) => <View style={[styles.card, interactive && styles.interactive, style]}>{children}</View>;

export const AppCardHeader = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => <View style={[styles.header, style]}>{children}</View>;

export const AppCardTitle = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) => <Text style={[styles.title, style]}>{children}</Text>;

export const AppCardDescription = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) => <Text style={[styles.description, style]}>{children}</Text>;

export const AppCardContent = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => <View style={[styles.content, style]}>{children}</View>;

export const AppCardFooter = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => <View style={[styles.footer, style]}>{children}</View>;

const styles = themedStyles((c) => StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    ...elevation.card,
  },
  // Web deliberately has no hover translate - it jitters rows in dense lists.
  interactive: {
    borderColor: colors.borderStrong,
  },
  header: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
    marginBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.cardTitle,
    fontWeight: "600",
    color: themePalette.slate[900],
  },
  description: {
    fontSize: typography.label,
    lineHeight: 18,
    color: themePalette.slate[500],
  },
  content: {
    gap: spacing.lg,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.xl,
    marginTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
}));

export default AppCard;
