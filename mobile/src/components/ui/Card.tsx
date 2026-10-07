import React from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewProps, type ViewStyle } from "react-native";
import { brandStyles, layout, round, type as t } from "../../theme/brand";

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
  ...props
}: {
  children: React.ReactNode;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
} & Omit<ViewProps, "style" | "children">) => (
  <View style={[styles.card, interactive && styles.interactive, style]} {...props}>{children}</View>
);

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

const styles = brandStyles((b) => StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: b.border,
    borderRadius: round.panel,
    backgroundColor: b.surface,
    padding: layout.cardPadding,
  },
  // Web deliberately has no hover translate - it jitters rows in dense lists.
  interactive: {
    borderColor: b.greenBright,
  },
  header: {
    gap: 4,
    paddingBottom: 12,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: b.hairline,
  },
  title: {
    fontSize: t.sectionTitle,
    lineHeight: 20,
    fontWeight: "700",
    letterSpacing: -0.25,
    color: b.text,
  },
  description: {
    fontSize: t.body,
    lineHeight: 17,
    color: b.textMuted,
  },
  content: {
    gap: 12,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: b.hairline,
  },
}));

export default AppCard;
