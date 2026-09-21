import React, { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { AppButton } from "./Button";
import { colors, palette, radii, spacing, typography } from "../../theme/tokens";
import { themedStyles, themePalette } from "../../theme/themedStyles";

/*
 * Empty, error and loading states.
 * Mirrors EmptyState.jsx, ErrorState.jsx and Skeleton.jsx.
 */

export const AppEmptyState = ({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) => (
  <View style={[styles.empty, style]}>
    {icon ? <View style={styles.iconChip}>{icon}</View> : null}
    <Text style={styles.emptyTitle}>{title}</Text>
    {description ? <Text style={styles.emptyBody}>{description}</Text> : null}
    {actionLabel && onAction ? (
      <AppButton title={actionLabel} onPress={onAction} variant="secondary" size="sm" style={styles.emptyAction} />
    ) : null}
  </View>
);

export const AppErrorState = ({
  title = "Something went wrong",
  description,
  onRetry,
  style,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}) => (
  <View style={[styles.error, style]}>
    <Text style={styles.errorTitle}>{title}</Text>
    {description ? <Text style={styles.errorBody}>{description}</Text> : null}
    {onRetry ? (
      <AppButton title="Try again" onPress={onRetry} variant="secondary" size="sm" style={styles.emptyAction} />
    ) : null}
  </View>
);

/*
 * Web uses Tailwind's `animate-pulse`. RN has no CSS animation, so the pulse is
 * driven by Animated. useNativeDriver is off on web, where the native driver is
 * unavailable and would warn on every mount.
 */
export const AppSkeleton = ({
  width,
  height = 14,
  radius = radii.md,
  style,
}: {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) => {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        {
          width: (width as number) ?? "100%",
          height,
          borderRadius: radius,
          backgroundColor: themePalette.slate[100],
          opacity: pulse,
        },
        style,
      ]}
    />
  );
};

/** A stack of skeleton lines, for list placeholders. */
export const AppSkeletonList = ({ rows = 4 }: { rows?: number }) => (
  <View style={styles.skeletonList}>
    {Array.from({ length: rows }).map((_, index) => (
      <View key={index} style={styles.skeletonCard}>
        <AppSkeleton height={13} width="55%" />
        <AppSkeleton height={11} width="82%" />
        <AppSkeleton height={11} width="40%" />
      </View>
    ))}
  </View>
);

const styles = themedStyles((c) => StyleSheet.create({
  empty: {
    borderWidth: 1,
    borderStyle: Platform.OS === "ios" ? "dashed" : "solid",
    borderColor: themePalette.slate[300],
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: "center",
  },
  iconChip: {
    width: 42,
    height: 42,
    borderRadius: radii.lg,
    backgroundColor: themePalette.slate[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 14.5,
    fontWeight: "600",
    color: themePalette.slate[900],
    textAlign: "center",
  },
  emptyBody: {
    marginTop: 6,
    fontSize: typography.body,
    lineHeight: 20,
    color: themePalette.slate[600],
    textAlign: "center",
    maxWidth: 320,
  },
  emptyAction: {
    marginTop: spacing.xl,
  },
  error: {
    borderWidth: 1,
    borderColor: themePalette.rose[200],
    borderRadius: radii.lg,
    backgroundColor: themePalette.rose[50],
    padding: 20,
    alignItems: "center",
  },
  errorTitle: {
    fontSize: 14.5,
    fontWeight: "600",
    color: themePalette.rose[700],
    textAlign: "center",
  },
  errorBody: {
    marginTop: 6,
    fontSize: typography.body,
    lineHeight: 20,
    color: themePalette.rose[700],
    textAlign: "center",
  },
  skeletonList: {
    gap: spacing.md,
  },
  skeletonCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.md,
  },
}));
