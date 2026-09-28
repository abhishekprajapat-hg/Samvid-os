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
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";

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
          placeholderTextColor={brand.placeholder}
          selectionColor={brand.primary}
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

const styles = brandStyles((b) => StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  label: {
    fontSize: t.fieldLabel,
    lineHeight: 16,
    fontWeight: "600",
    color: b.text,
    marginBottom: 8,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    height: layout.fieldHeight,
    borderWidth: 1,
    borderColor: b.fieldBorder,
    borderRadius: round.field,
    backgroundColor: b.surface,
    paddingHorizontal: 11,
    gap: 8,
  },
  fieldMultiline: {
    height: undefined,
    minHeight: 84,
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  fieldFocused: {
    borderColor: b.greenBright,
    // RN has no ring utility; a 2px-equivalent glow reads the same at a glance.
    shadowColor: b.greenBright,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 0,
  },
  fieldError: {
    borderColor: b.alert,
  },
  fieldDisabled: {
    backgroundColor: b.fieldMuted,
  },
  input: {
    flex: 1,
    fontSize: t.field,
    color: b.text,
    padding: 0,
  },
  inputMultiline: {
    textAlignVertical: "top",
  },
  inputDisabled: {
    color: b.textMuted,
  },
  affix: {
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    marginTop: 4,
    fontSize: t.label,
    color: b.alertInk,
  },
  helper: {
    marginTop: 4,
    fontSize: t.label,
    color: b.textMuted,
  },
  clear: {
    width: 24,
    height: 24,
    borderRadius: round.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: b.fieldMuted,
  },
  clearGlyph: {
    fontSize: 16,
    lineHeight: 18,
    color: b.textMuted,
  },
}));

export default AppInput;
