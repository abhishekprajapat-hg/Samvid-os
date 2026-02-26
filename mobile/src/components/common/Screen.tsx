import React from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../../theme/tokens";

export const Screen = ({ title, subtitle, loading, error, children }: {
  title: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  children?: React.ReactNode;
}) => (
  <SafeAreaView style={styles.root}>
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>

    {error ? <Text style={styles.error}>{error}</Text> : null}

    {loading ? (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    ) : (
      <View style={styles.body}>{children}</View>
    )}
  </SafeAreaView>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  title: {
    fontSize: typography.title,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: typography.label,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontWeight: "700",
  },
  error: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    backgroundColor: colors.errorBg,
    color: colors.error,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
