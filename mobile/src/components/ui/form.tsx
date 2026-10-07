import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { AppSheet } from "./Overlay";
import { Glyph, type GlyphName } from "./Glyph";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";

/*
 * The form primitives the property comps draw.
 *
 * They are their own set rather than an extension of `Input.tsx`: that one
 * implements the web app's field - a 36pt control with web's border and focus
 * ring - and every screen ported from web still uses it. These implement the
 * comps' field instead: a 44pt box with a 12pt label above it, an optional
 * leading glyph, and the prefix/suffix blocks the pricing step needs.
 *
 * Sizes are measured off the comps. The field is 44 rather than the 32-43 the
 * three form comps disagree on, because 44 is the smallest target iOS will
 * accept and the densest of the three comps already draws 43.
 */

/* ---------------------------------------------------------------- label -- */

export const FieldLabel = ({ label, required }: { label: string; required?: boolean }) => (
  <Text style={styles.label}>
    {label}
    {required ? <Text style={styles.required}> *</Text> : null}
  </Text>
);

/* ---------------------------------------------------------------- shell -- */

/** The bordered box every control below sits in. */
export const FieldShell = ({
  children,
  muted,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
}) => <View style={[styles.shell, muted && styles.shellMuted, style]}>{children}</View>;

/* ------------------------------------------------------------ text field -- */

export const TextField = ({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  required,
  keyboardType,
  editable = true,
  trailing,
  autoCapitalize,
  prefix,
  multiline,
}: {
  label?: string;
  value: string;
  onChangeText?: (next: string) => void;
  placeholder?: string;
  icon?: GlyphName;
  required?: boolean;
  keyboardType?: KeyboardTypeOptions;
  editable?: boolean;
  /** Rendered against the right edge, inside the box - the comps' info glyph. */
  trailing?: React.ReactNode;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  /** A fixed block against the left edge - the comps' dialling code. */
  prefix?: string;
  /** The comps' description box: a taller, top-aligned field. */
  multiline?: boolean;
}) => (
  <View style={styles.group}>
    {label ? <FieldLabel label={label} required={required} /> : null}
    <FieldShell
      muted={!editable}
      style={[prefix ? styles.shellFlush : null, multiline ? styles.shellTall : null]}
    >
      {prefix ? (
        <View style={[styles.affix, styles.affixLeft]}>
          <Text style={styles.affixText}>{prefix}</Text>
        </View>
      ) : null}
      {icon ? <Glyph name={icon} size={18} color={brand.textSecondary} /> : null}
      <TextInput
        style={[styles.input, prefix ? styles.inputInset : null, multiline ? styles.inputTall : null]}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={brand.placeholder}
        keyboardType={keyboardType}
        editable={editable}
        autoCapitalize={autoCapitalize}
      />
      {trailing}
    </FieldShell>
  </View>
);

/* ---------------------------------------------------------- select field -- */

export type SelectOption = { label: string; value: string };

export const SelectField = ({
  label,
  value,
  options,
  onChange,
  icon,
  leading,
  required,
  placeholder = "Select",
}: {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (next: string) => void;
  icon?: GlyphName;
  /** Rendered before the value - the comps' assignee avatar. */
  leading?: React.ReactNode;
  required?: boolean;
  placeholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.group}>
      {label ? <FieldLabel label={label} required={required} /> : null}
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button">
        <FieldShell>
          {leading}
          {icon ? <Glyph name={icon} size={18} color={brand.textSecondary} /> : null}
          <Text style={[styles.value, !selected && styles.valuePlaceholder]} numberOfLines={1}>
            {selected?.label || placeholder}
          </Text>
          <Glyph name="chevron-down" size={18} color={brand.textSecondary} />
        </FieldShell>
      </Pressable>

      <AppSheet visible={open} onClose={() => setOpen(false)} title={label || "Select"}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            style={styles.option}
            onPress={() => {
              onChange(option.value);
              setOpen(false);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.optionLabel}>{option.label}</Text>
            {option.value === value ? (
              <Glyph name="checkmark" size={18} color={brand.primary} />
            ) : null}
          </Pressable>
        ))}
      </AppSheet>
    </View>
  );
};

/* ------------------------------------------------- prefix / suffix fields -- */

/** The pricing step's amount box, with its currency block against the left edge. */
export const PrefixField = ({
  label,
  prefix,
  value,
  onChangeText,
  placeholder,
  required,
}: {
  label?: string;
  prefix: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  required?: boolean;
}) => (
  <View style={styles.group}>
    {label ? <FieldLabel label={label} required={required} /> : null}
    <FieldShell style={styles.shellFlush}>
      <View style={[styles.affix, styles.affixLeft]}>
        <Text style={styles.affixText}>{prefix}</Text>
      </View>
      <TextInput
        style={[styles.input, styles.inputInset]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={brand.placeholder}
        keyboardType="number-pad"
      />
    </FieldShell>
  </View>
);

/** A count with its unit against the right edge - "6 months", "3 years". */
export const UnitField = ({
  label,
  unit,
  value,
  onChangeText,
  placeholder,
}: {
  label?: string;
  unit: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
}) => (
  <View style={styles.group}>
    {label ? <FieldLabel label={label} /> : null}
    <FieldShell style={styles.shellFlush}>
      <TextInput
        style={[styles.input, styles.inputInset]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={brand.placeholder}
        keyboardType="number-pad"
      />
      <View style={[styles.affix, styles.affixRight]}>
        <Text style={styles.affixText}>{unit}</Text>
      </View>
    </FieldShell>
  </View>
);

/* ------------------------------------------------------------------ rows -- */

/** The comps' two-up field row. */
export const FieldRow = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.row}>{children}</View>
);

export const FieldCol = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.col}>{children}</View>
);

/* ---------------------------------------------------------- section card -- */

export const SectionCard = ({
  title,
  subtitle,
  children,
  style,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => (
  <View style={[styles.card, style]}>
    {title ? (
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{title}</Text>
        {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      </View>
    ) : null}
    {children}
  </View>
);

/* --------------------------------------------------------------- toggle -- */

export const Toggle = ({
  value,
  onValueChange,
  label,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  label?: string;
}) => (
  <Pressable
    style={styles.toggleRow}
    onPress={() => onValueChange(!value)}
    accessibilityRole="switch"
    accessibilityState={{ checked: value }}
  >
    <View style={[styles.track, value && styles.trackOn]}>
      <View style={[styles.knob, value && styles.knobOn]} />
    </View>
    {label ? <Text style={styles.toggleLabel}>{label}</Text> : null}
  </Pressable>
);

/* ---------------------------------------------------- segmented control -- */

export const Segmented = ({
  options,
  value,
  onChange,
}: {
  options: SelectOption[];
  value: string;
  onChange: (next: string) => void;
}) => (
  <View style={styles.segment}>
    {options.map((option) => {
      const active = option.value === value;
      return (
        <Pressable
          key={option.value}
          style={[styles.segmentItem, active && styles.segmentItemActive]}
          onPress={() => onChange(option.value)}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
        >
          <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
            {option.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = brandStyles((b) =>
  StyleSheet.create({
    group: {
      marginBottom: layout.fieldGap,
    },
    label: {
      marginBottom: 8,
      fontSize: t.fieldLabel,
      lineHeight: 16,
      fontWeight: "500",
      color: b.text,
    },
    required: {
      color: b.alert,
      fontWeight: "600",
    },

    shell: {
      height: layout.fieldHeight,
      flexDirection: "row",
      alignItems: "center",
      /* Tight enough that a half-width select still holds "Business Overview"
         and "All Team Members" without an ellipsis. */
      gap: 8,
      paddingHorizontal: 11,
      borderWidth: 1,
      borderColor: b.fieldBorder,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    /* The prefix and unit blocks run to the box's own edge. */
    shellFlush: {
      paddingHorizontal: 0,
      gap: 0,
      overflow: "hidden",
    },
    shellMuted: {
      backgroundColor: b.fieldMuted,
    },
    shellTall: {
      height: undefined,
      minHeight: 96,
      alignItems: "flex-start",
      paddingVertical: 12,
    },
    inputTall: {
      alignSelf: "stretch",
      minHeight: 72,
    },
    input: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 0,
      fontSize: t.field,
      color: b.text,
    },
    inputInset: {
      paddingHorizontal: 14,
    },
    value: {
      flex: 1,
      minWidth: 0,
      fontSize: t.field,
      color: b.text,
    },
    valuePlaceholder: {
      color: b.placeholder,
    },

    affix: {
      alignSelf: "stretch",
      justifyContent: "center",
      paddingHorizontal: 14,
      backgroundColor: b.fieldMuted,
    },
    affixLeft: {
      borderRightWidth: 1,
      borderRightColor: b.fieldBorder,
    },
    affixRight: {
      borderLeftWidth: 1,
      borderLeftColor: b.fieldBorder,
    },
    affixText: {
      fontSize: t.label,
      fontWeight: "500",
      color: b.textSecondary,
    },

    option: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: b.hairline,
    },
    optionLabel: {
      fontSize: t.field,
      color: b.text,
    },

    row: {
      flexDirection: "row",
      /* Bottom-aligned so a label that wraps to two lines lifts its own field
         without dragging the one beside it out of line. */
      alignItems: "flex-end",
      gap: layout.fieldGap,
    },
    col: {
      flex: 1,
      minWidth: 0,
    },

    card: {
      padding: layout.cardPadding,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    cardHead: {
      marginBottom: layout.fieldGap,
    },
    cardTitle: {
      fontSize: t.sectionTitle,
      lineHeight: 20,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: b.text,
    },
    cardSubtitle: {
      marginTop: 3,
      fontSize: t.label,
      lineHeight: 15,
      color: b.textMuted,
    },

    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    track: {
      width: 46,
      height: 28,
      borderRadius: round.pill,
      padding: 3,
      justifyContent: "center",
      backgroundColor: b.hairline,
    },
    trackOn: {
      backgroundColor: b.primary,
    },
    knob: {
      width: 22,
      height: 22,
      borderRadius: round.pill,
      backgroundColor: b.surface,
    },
    knobOn: {
      alignSelf: "flex-end",
    },
    toggleLabel: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: t.body,
      color: b.textSecondary,
    },

    segment: {
      flexDirection: "row",
      borderRadius: round.field,
      overflow: "hidden",
      backgroundColor: b.fieldMuted,
    },
    segmentItem: {
      flex: 1,
      minWidth: 0,
      height: layout.fieldHeight,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentItemActive: {
      backgroundColor: b.primary,
    },
    segmentLabel: {
      fontSize: t.field,
      fontWeight: "600",
      color: b.textSecondary,
    },
    segmentLabelActive: {
      color: b.onPrimary,
    },
  }),
);
