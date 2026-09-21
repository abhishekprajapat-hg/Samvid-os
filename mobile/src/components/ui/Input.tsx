import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors, palette, radii, spacing, typography } from "../../theme/tokens";

/*
 * Mirrors frontend/src/components/ui/Input.jsx and SearchInput.jsx.
 *
 * Web anatomy: h-9 (36), rounded-lg, slate-300 border, white surface, 13px
 * text, slate-500 placeholder. Focus moves the border to blue-600 and adds a
 * 2px blue-600/20 ring; disabled fills slate-100.
 *
 * Label, error and helper text are additions. Web renders those in the form
 * layer, which works when a label can sit beside its field; on a phone the
 * field owns them, or they end up orphaned when the keyboard opens.
 */

export type AppInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  helperText?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  editable?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onSubmitEditing?: () => void;
  returnKeyType?: "done" | "go" | "next" | "search" | "send";
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export const AppInput = ({
  value,
  onChangeText,
  label,
  placeholder,
  error,
  helperText,
  secureTextEntry,
  keyboardType,
  autoCapitalize = "sentences",
  autoCorrect,
  editable = true,
  multiline,
  numberOfLines,
  maxLength,
  leftIcon,
  rightIcon,
  onSubmitEditing,
  returnKeyType,
  style,
  inputStyle,
}: AppInputProps) => {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          focused && styles.fieldFocused,
          Boolean(error) && styles.fieldError,
          !editable && styles.fieldDisabled,
        ]}
      >
        {leftIcon ? <View style={styles.affix}>{leftIcon}</View> : null}

        <TextInput
          style={[styles.input, multiline && styles.inputMultiline, !editable && styles.inputDisabled, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.slate[500]}
          selectionColor={palette.blue[600]}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        {rightIcon ? <View style={styles.affix}>{rightIcon}</View> : null}
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helper}>{helperText}</Text>
      ) : null}
    </View>
  );
};

export const AppSearchInput = ({
  value,
  onChangeText,
  placeholder = "Search",
  style,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
}) => (
  <AppInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    autoCapitalize="none"
    autoCorrect={false}
    returnKeyType="search"
    style={style}
    rightIcon={
      value ? (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={styles.clear}
        >
          <Text style={styles.clearGlyph}>×</Text>
        </Pressable>
      ) : null
    }
  />
);

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  label: {
    fontSize: typography.label,
    fontWeight: "600",
    color: palette.slate[600],
    marginBottom: 6,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    height: 36,
    borderWidth: 1,
    borderColor: palette.slate[300],
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    gap: spacing.md,
  },
  fieldMultiline: {
    height: undefined,
    minHeight: 84,
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  fieldFocused: {
    borderColor: palette.blue[600],
    // RN has no ring utility; a 2px-equivalent glow reads the same at a glance.
    shadowColor: palette.blue[600],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 0,
  },
  fieldError: {
    borderColor: palette.rose[600],
  },
  fieldDisabled: {
    backgroundColor: palette.slate[100],
  },
  input: {
    flex: 1,
    fontSize: typography.body,
    color: palette.slate[900],
    padding: 0,
  },
  inputMultiline: {
    textAlignVertical: "top",
  },
  inputDisabled: {
    color: palette.slate[500],
  },
  affix: {
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    marginTop: 4,
    fontSize: typography.label,
    color: palette.rose[600],
  },
  helper: {
    marginTop: 4,
    fontSize: typography.label,
    color: palette.slate[500],
  },
  clear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.slate[100],
  },
  clearGlyph: {
    fontSize: 16,
    lineHeight: 18,
    color: palette.slate[500],
  },
});

export default AppInput;
