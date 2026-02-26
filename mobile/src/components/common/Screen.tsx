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
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.title,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: typography.body,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  error: {
    margin: 12,
    padding: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    backgroundColor: colors.errorBg,
    color: colors.error,
  },
  body: {
    flex: 1,
    padding: 12,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
