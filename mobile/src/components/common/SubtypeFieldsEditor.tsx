import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "../ui/Icon";
import { themedStyles, themePalette } from "../../theme/themedStyles";
import type { RequirementField, RequirementSubtype } from "../../config/propertyRequirementConfig";
import { CUSTOM_NUMBER_OPTION_VALUE } from "../../modules/leads/leadRequirements";

/*
 * A property subtype's preference fields - "Office Preferences", "Plot
 * Preferences" and the rest - drawn from config/propertyRequirementConfig.ts,
 * the same table web's lead and inventory forms render.
 *
 * Web's rules, kept: text fields first and checkboxes after; a select that
 * allows it offers "Custom Number" and then a number box; plot length and width
 * are one "Plot Dimension" row; a field with a unit shows it beside the box.
 * Selects are chips here, the phone's equivalent of web's dropdowns.
 */

type Option = { value: string; label: string };

const toOptions = (options: RequirementField["options"]): Option[] =>
  (Array.isArray(options) ? options : []).map((option: any) =>
    option && typeof option === "object"
      ? { value: String(option.value), label: String(option.label ?? option.value) }
      : { value: String(option), label: String(option) },
  );

export const SubtypeFieldsEditor = ({
  config,
  value,
  onChange,
  fieldFilter,
  title,
}: {
  config: RequirementSubtype | null | undefined;
  value: Record<string, unknown>;
  onChange: (key: string, next: unknown) => void;
  /* Web's property form hides most office fields for an unfurnished office. */
  fieldFilter?: (field: RequirementField) => boolean;
  title?: string;
}) => {
  const [customMode, setCustomMode] = useState<Record<string, boolean>>({});
  if (!config) return null;
  const fields = (config.fields || []).filter((field) => (fieldFilter ? fieldFilter(field) : true));
  if (!fields.length) return null;
  const inputs = fields.filter((field) => field.type !== "checkbox");
  const checks = fields.filter((field) => field.type === "checkbox");

  const renderField = (field: RequirementField) => {
    if (field.key === "plotWidth") return null;
    if (field.key === "plotLength") {
      return (
        <View key="plotDimension" style={styles.field}>
          <Text style={styles.label}>Plot Dimension (L x W, ft)</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.half]}
              value={String(value?.plotLength ?? "")}
              onChangeText={(next) => onChange("plotLength", next)}
              placeholder="Length"
              placeholderTextColor={themePalette.slate[400]}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, styles.half]}
              value={String(value?.plotWidth ?? "")}
              onChangeText={(next) => onChange("plotWidth", next)}
              placeholder="Width"
              placeholderTextColor={themePalette.slate[400]}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
      );
    }

    const current = String(value?.[field.key] ?? "");
    const unit = typeof field.unit === "string" ? field.unit : "";
    const placeholder = typeof field.placeholder === "string" ? field.placeholder : field.label;

    if (field.type === "select") {
      const options = toOptions(field.options);
      const allowsCustom = Boolean(field.allowCustomNumber);
      const holdsCustom = allowsCustom && current !== "" && current !== CUSTOM_NUMBER_OPTION_VALUE && !options.some((option) => option.value === current);
      const custom = Boolean(customMode[field.key]) || holdsCustom;
      return (
        <View key={field.key} style={styles.field}>
          <Text style={styles.label}>{field.label}</Text>
          <View style={styles.chips}>
            {options.map((option) => {
              const on = !custom && current === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => {
                    setCustomMode((prev) => ({ ...prev, [field.key]: false }));
                    onChange(field.key, on ? "" : option.value);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{option.label}</Text>
                </Pressable>
              );
            })}
            {allowsCustom ? (
              <Pressable
                style={[styles.chip, custom && styles.chipOn]}
                onPress={() => {
                  setCustomMode((prev) => ({ ...prev, [field.key]: true }));
                  if (!holdsCustom) onChange(field.key, "");
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: custom }}
              >
                <Text style={[styles.chipText, custom && styles.chipTextOn]}>Custom Number</Text>
              </Pressable>
            ) : null}
          </View>
          {allowsCustom && custom ? (
            <TextInput
              style={[styles.input, styles.customInput]}
              value={current === CUSTOM_NUMBER_OPTION_VALUE ? "" : current}
              onChangeText={(next) => onChange(field.key, next.replace(/[^\d]/g, ""))}
              placeholder="Enter custom number"
              placeholderTextColor={themePalette.slate[400]}
              keyboardType="number-pad"
            />
          ) : null}
        </View>
      );
    }

    return (
      <View key={field.key} style={styles.field}>
        <Text style={styles.label}>{field.label}</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.grow, field.type === "textarea" && styles.area]}
            value={current}
            onChangeText={(next) => onChange(field.key, next)}
            placeholder={field.type === "date" ? "YYYY-MM-DD" : placeholder}
            placeholderTextColor={themePalette.slate[400]}
            keyboardType={field.type === "number" ? "decimal-pad" : field.type === "date" ? "numbers-and-punctuation" : "default"}
            multiline={field.type === "textarea"}
            maxLength={field.type === "date" ? 10 : undefined}
            /* Plot area on a property is computed from length and width. */
            editable={!field.readOnly}
          />
          {unit ? <Text style={styles.unit}>{unit}</Text> : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title || `${config.label} Preferences`}</Text>
      {inputs.map(renderField)}
      {checks.length ? (
        <View style={styles.checks}>
          {checks.map((field) => {
            const checked = Boolean(value?.[field.key]);
            return (
              <Pressable
                key={field.key}
                style={[styles.check, checked && styles.checkOn]}
                onPress={() => onChange(field.key, !checked)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
              >
                <Icon name={checked ? "checkbox" : "square-outline"} size={14} color={checked ? themePalette.emerald[600] : themePalette.slate[500]} />
                <Text style={styles.checkText}>{field.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

const styles = themedStyles((c) =>
  StyleSheet.create({
    box: {
      marginTop: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      backgroundColor: c.surfaceMuted,
    },
    title: { marginBottom: 4, fontSize: 13, fontWeight: "700", color: c.text },
    field: { marginTop: 8 },
    label: { marginBottom: 5, fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", color: c.slate[500] },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    half: { flex: 1 },
    grow: { flex: 1 },
    input: {
      minHeight: 40,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      fontSize: 13,
      color: c.text,
      backgroundColor: c.surface,
    },
    area: { minHeight: 72, paddingTop: 8, textAlignVertical: "top" },
    customInput: { marginTop: 6 },
    unit: { fontSize: 12, fontWeight: "600", color: c.slate[500] },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    chipOn: { borderColor: c.emerald[500], backgroundColor: c.emerald[50] },
    chipText: { fontSize: 12, color: c.slate[700] },
    chipTextOn: { fontWeight: "700", color: c.emerald[800] },
    checks: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 6 },
    check: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    checkOn: { borderColor: c.emerald[400], backgroundColor: c.emerald[50] },
    checkText: { fontSize: 12, color: c.slate[700] },
  }),
);
