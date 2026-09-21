import React from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { colors, palette, radii } from "../../theme/tokens";

/*
 * Mirrors frontend/src/components/ui/IconButton.jsx - 32/36/40 square, radius
 * lg, slate-200 border on a white surface.
 *
 * Same touch-target treatment as AppButton: the drawn square matches web and
 * hitSlop takes the tappable area to 44.
 */

export type IconButtonSize = "sm" | "md" | "lg";

const SIZES: Record<IconButtonSize, number> = { sm: 32, md: 36, lg: 40 };

export const AppIconButton = ({
  children,
  onPress,
  size = "md",
  disabled,
  accessibilityLabel,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  size?: IconButtonSize;
  disabled?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) => {
  const side = SIZES[size] || SIZES.md;
  const pad = Math.max(0, Math.ceil((44 - side) / 2));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={{ top: pad, bottom: pad, left: pad, right: pad }}
      style={({ pressed }) => [
        styles.base,
        { width: side, height: side },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: palette.slate[50],
  },
  disabled: {
    opacity: 0.6,
  },
});

export default AppIconButton;
