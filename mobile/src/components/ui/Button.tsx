import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { brand, brandStyles, round, type as t } from "../../theme/brand";

/*
 * Mirrors frontend/src/components/ui/Button.jsx: the same five variants and
 * three sizes, with the same heights and radius.
 *
 * Web's heights are h-8 / h-9 / h-10 (32 / 36 / 40). Those are below the 44pt
 * iOS and 48dp Android minimums, so the *visual* box stays identical to web and
 * hitSlop extends the tappable area to 44. Matching web exactly here would ship
 * a control that fails an accessibility review, which is the one thing the
 * design contract explicitly trades away.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg";

type Tone = { border: string; background: string; text: string };

/*
 * Resolved per render rather than held in a constant: themePalette answers for
 * whichever scheme is active when it is read, and a module constant reads it
 * once, at import, while the scheme is still the default light.
 */
const variantTone = (variant: ButtonVariant): Tone => {
  const table: Record<ButtonVariant, Tone> = {
    primary: { border: brand.primary, background: brand.primary, text: brand.onPrimary },
    secondary: { border: brand.fieldBorder, background: brand.surface, text: brand.text },
    ghost: { border: "transparent", background: "transparent", text: brand.textSecondary },
    danger: { border: brand.alertInk, background: brand.alertInk, text: brand.onPrimary },
    success: { border: brand.primary, background: brand.primary, text: brand.onPrimary },
  };
  return table[variant] || table.primary;
};

const pressedTone = (variant: ButtonVariant): string => {
  const table: Record<ButtonVariant, string> = {
    primary: brand.deep,
    secondary: brand.fieldMuted,
    ghost: brand.tintSoft,
    danger: brand.alert,
    success: brand.deep,
  };
  return table[variant] || table.primary;
};

const SIZES: Record<ButtonSize, { height: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { height: 36, paddingHorizontal: 12, fontSize: t.label },
  md: { height: 44, paddingHorizontal: 16, fontSize: t.field },
  lg: { height: 48, paddingHorizontal: 18, fontSize: t.rowTitle },
};

// Lifts the touch target to 44 without changing the drawn height.
const hitSlopFor = (height: number) => {
  const pad = Math.max(0, Math.ceil((44 - height) / 2));
  return { top: pad, bottom: pad, left: 0, right: 0 };
};

export type AppButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const AppButton = ({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  leftIcon,
  rightIcon,
  fullWidth,
  style,
}: AppButtonProps) => {
  const tone = variantTone(variant);
  const dimensions = SIZES[size] || SIZES.md;
  const inert = Boolean(disabled || loading);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: Boolean(loading) }}
      disabled={inert}
      onPress={onPress}
      hitSlop={hitSlopFor(dimensions.height)}
      style={({ pressed }) => [
        styles.base,
        {
          height: dimensions.height,
          paddingHorizontal: dimensions.paddingHorizontal,
          borderColor: tone.border,
          backgroundColor: pressed && !inert ? pressedTone(variant) : tone.background,
        },
        fullWidth && styles.fullWidth,
        inert && styles.inert,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tone.text} />
      ) : (
        <>
          {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
          <Text
            numberOfLines={1}
            style={[styles.label, { color: tone.text, fontSize: dimensions.fontSize }]}
          >
            {title}
          </Text>
          {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
        </>
      )}
    </Pressable>
  );
};

const styles = brandStyles(() => StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: round.button,
    alignSelf: "flex-start",
  },
  fullWidth: {
    alignSelf: "stretch",
    width: "100%",
  },
  inert: {
    opacity: 0.6,
  },
  label: {
    fontWeight: "600",
    letterSpacing: 0,
  },
  icon: {
    alignItems: "center",
    justifyContent: "center",
  },
}));

export default AppButton;
