import React from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { clay, colors, radii, spacing, typography } from "../../theme/tokens";

export const Screen = ({ title, subtitle, loading, error, children }: {
  title: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  children?: React.ReactNode;
}) => {
  const insets = useSafeAreaInsets();
  const androidBottom = Platform.OS === "android" ? 16 : 0;
  return (
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
        <View style={[styles.body, { paddingBottom: 12 + Math.max(insets.bottom, androidBottom) }]}>{children}</View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    marginHorizontal: spacing.md,
    marginTop: 10,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderWidth: 1,
    ...clay.shadow,
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
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    backgroundColor: colors.errorBg,
    color: colors.error,
    ...clay.shadowSmall,
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
