import React from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, palette, radii, spacing, typography } from "../../theme/tokens";

/*
 * The page shell. Plays the part of the web app's page header inside
 * WorkbenchShell: a title, an optional eyebrow, and the body beneath.
 *
 * The header used to be a floating translucent card with a 24px radius, which
 * was the old mobile look and nothing like web. Web's page header is flat - it
 * sits on the page background with no border, no fill and no shadow - so this
 * one is too.
 */

export const Screen = ({
  title,
  subtitle,
  loading,
  error,
  onRetry,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) => {
  const insets = useSafeAreaInsets();
  // Android's gesture bar is not in the inset on every OEM skin; 16 is the floor.
  const androidBottom = Platform.OS === "android" ? 16 : 0;

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          {subtitle ? <Text style={styles.eyebrow}>{subtitle}</Text> : null}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {right ? <View style={styles.headerRight}>{right}</View> : null}
      </View>

      {loading ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={palette.blue[600]} />
        </View>
      ) : (
        <View
          style={[styles.body, { paddingBottom: spacing.lg + Math.max(insets.bottom, androidBottom) }]}
        >
          {/*
           * The banner sits above the body rather than replacing it. Several
           * screens pass a transient failure here - a message that would not
           * send, a refresh that failed - while the content behind it is still
           * valid and still worth showing.
           */}
          {error ? (
            <Pressable
              onPress={onRetry}
              disabled={!onRetry}
              style={styles.errorBanner}
              accessibilityRole={onRetry ? "button" : "alert"}
            >
              <Text style={styles.errorText}>{error}</Text>
              {onRetry ? <Text style={styles.errorRetry}>Tap to retry</Text> : null}
            </Pressable>
          ) : null}

          {children}
        </View>
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
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerText: {
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  eyebrow: {
    fontSize: typography.caption,
    fontWeight: "600",
    color: palette.slate[500],
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  title: {
    fontSize: typography.displayMd,
    fontWeight: "600",
    color: palette.slate[900],
    letterSpacing: -0.25,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  centred: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBanner: {
    borderWidth: 1,
    borderColor: palette.rose[200],
    borderRadius: radii.md,
    backgroundColor: palette.rose[50],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: typography.label,
    lineHeight: 18,
    color: palette.rose[700],
  },
  errorRetry: {
    marginTop: 2,
    fontSize: typography.caption,
    fontWeight: "600",
    color: palette.rose[700],
  },
});
