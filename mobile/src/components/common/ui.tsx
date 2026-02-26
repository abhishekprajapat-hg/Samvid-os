import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii } from "../../theme/tokens";

export const AppCard = ({ children, style }: { children: React.ReactNode; style?: object }) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const AppButton = ({
  title,
  onPress,
  disabled,
  variant = "primary",
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
  style?: object;
}) => (
  <Pressable
    disabled={disabled}
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
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  style?: object;
}) => (
  <Pressable style={[styles.chip, active && styles.chipActive, style]} onPress={onPress}>
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
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  style?: object;
}) => (
  <TextInput
    style={[styles.input, style]}
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor={colors.textMuted}
    selectionColor={colors.primary}
    secureTextEntry={secureTextEntry}
    keyboardType={keyboardType}
    autoCapitalize={autoCapitalize}
  />
);

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: 12,
  },
  button: {
    height: 42,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
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
    color: "#334155",
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    height: 34,
    paddingHorizontal: 10,
    justifyContent: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipText: {
    color: "#334155",
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
  },
});
