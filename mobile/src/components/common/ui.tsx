import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { TextInputProps, ViewProps } from "react-native";
import { clay, colors, radii } from "../../theme/tokens";

export const AppCard = ({ children, style, ...props }: { children: React.ReactNode; style?: object } & ViewProps) => (
  <View style={[styles.card, style]} {...props}>{children}</View>
);

export const AppButton = ({
  title,
  onPress,
  disabled,
  variant = "primary",
  style,
  accessibilityLabel,
  testID,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
  style?: object;
  accessibilityLabel?: string;
  testID?: string;
}) => (
  <Pressable
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel || title}
    testID={testID}
    style={[
      styles.button,
      variant === "primary" ? styles.buttonPrimary : styles.buttonGhost,
      disabled && styles.buttonDisabled,
      style,
    ]}
    onPress={onPress}
  >
    <Text style={[styles.buttonText, variant === "primary" ? styles.buttonTextPrimary : styles.buttonTextGhost]}>
      {title}
    </Text>
  </Pressable>
);

export const AppChip = ({
  label,
  active,
  onPress,
  style,
  accessibilityLabel,
  testID,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  style?: object;
  accessibilityLabel?: string;
  testID?: string;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel || label}
    accessibilityState={{ selected: Boolean(active) }}
    testID={testID}
    style={[styles.chip, active && styles.chipActive, style]}
    onPress={onPress}
  >
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>
);

export const AppInput = ({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  style,
  editable,
  accessibilityLabel,
  testID,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  style?: object;
  editable?: boolean;
} & Pick<TextInputProps, "accessibilityLabel" | "testID">) => (
  <TextInput
    style={[styles.input, style]}
    accessibilityLabel={accessibilityLabel || placeholder}
    testID={testID}
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor={colors.textMuted}
    selectionColor={colors.primary}
    secureTextEntry={secureTextEntry}
    keyboardType={keyboardType}
    autoCapitalize={autoCapitalize}
    editable={editable}
  />
);

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceRaised,
    padding: 12,
    ...clay.shadow,
  },
  button: {
    height: 42,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    ...clay.shadowSmall,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontWeight: "700",
    fontSize: 12,
  },
  buttonTextPrimary: {
    color: colors.primaryText,
  },
  buttonTextGhost: {
    color: colors.text,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    height: 34,
    paddingHorizontal: 10,
    justifyContent: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceRaised,
    shadowColor: colors.highlight,
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.62,
    shadowRadius: 2,
    elevation: 0,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.primary,
  },
  chipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.primaryText,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    color: colors.text,
    height: 42,
    paddingHorizontal: 12,
    marginBottom: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 0,
  },
});
