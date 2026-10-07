import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { themedStyles, themePalette } from "../../theme/themedStyles";
import {
  COWORKING_CABIN_COUNTS,
  COWORKING_CABIN_SEAT_OPTIONS,
  COWORKING_TERM_MONTHS,
} from "../../config/propertyRequirementConfig";
import type { CoworkingDraft } from "../../modules/leads/leadRequirements";

/*
 * What a coworking client is asking for - web's CoworkingRequirementFields.
 *
 * Cabins are a list, one entry per cabin, because one enquiry is commonly a
 * four-seater and a six-seater together: choosing "3 cabins" grows the list to
 * three seat pickers. Workstations is suggested from the seats across those
 * cabins and left editable. The term fields offer the usual months and a
 * Custom box; Custom is a mode the person chose, so typing "12" is not cut
 * short when its first digit happens to be a preset.
 */

type Value = CoworkingDraft;

const Chip = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
  <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}>
    <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
  </Pressable>
);

const numberOrNull = (text: string) => {
  const cleaned = text.replace(/[^\d.]/g, "");
  return cleaned === "" ? null : Number(cleaned);
};

const MonthsField = ({
  label,
  field,
  value,
  onChange,
}: {
  label: string;
  field: "depositMonths" | "noticePeriodMonths" | "lockInMonths";
  value: Value;
  onChange: (patch: Partial<Value>) => void;
}) => {
  const current = value[field];
  const holdsCustom = current !== null && current !== undefined && current !== "" && !COWORKING_TERM_MONTHS.includes(Number(current));
  const [customMode, setCustomMode] = useState(holdsCustom);
  const showCustom = customMode || holdsCustom;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        <Chip
          label="Not set"
          on={!showCustom && (current === null || current === undefined || current === "")}
          onPress={() => {
            setCustomMode(false);
            onChange({ [field]: null } as Partial<Value>);
          }}
        />
        {COWORKING_TERM_MONTHS.map((months) => (
          <Chip
            key={months}
            label={`${months} month${months === 1 ? "" : "s"}`}
            on={!showCustom && Number(current) === months}
            onPress={() => {
              setCustomMode(false);
              onChange({ [field]: months } as Partial<Value>);
            }}
          />
        ))}
        <Chip label="Custom" on={showCustom} onPress={() => setCustomMode(true)} />
      </View>
      {showCustom ? (
        <TextInput
          style={[styles.input, styles.below]}
          value={current === null || current === undefined ? "" : String(current)}
          onChangeText={(text) => onChange({ [field]: numberOrNull(text) } as Partial<Value>)}
          placeholder="Months"
          placeholderTextColor={themePalette.slate[400]}
          keyboardType="number-pad"
        />
      ) : null}
    </View>
  );
};

export const CoworkingRequirementEditor = ({ value, onChange }: { value: Value; onChange: (next: Value) => void }) => {
  const cabins = Array.isArray(value?.cabins) ? value.cabins : [];
  const seatTotal = cabins.reduce((total, cabin) => total + (Number(cabin?.seats) || 0), 0);
  const holdsCustomCount = cabins.length > 0 && !COWORKING_CABIN_COUNTS.includes(cabins.length);
  const [customCount, setCustomCount] = useState(holdsCustomCount);
  const showCustomCount = customCount || holdsCustomCount;

  const set = (patch: Partial<Value>) => onChange({ ...value, ...patch });
  const setCabinCount = (count: number) =>
    set({ cabins: Array.from({ length: count }, (_, index) => cabins[index] || { seats: COWORKING_CABIN_SEAT_OPTIONS[0] }) });
  const setCabinSeats = (index: number, seats: number) =>
    set({ cabins: cabins.map((cabin, position) => (position === index ? { seats } : cabin)) });

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Coworking Requirement</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Cabins</Text>
        <View style={styles.chips}>
          <Chip label="No cabins" on={!showCustomCount && cabins.length === 0} onPress={() => { setCustomCount(false); setCabinCount(0); }} />
          {COWORKING_CABIN_COUNTS.map((count) => (
            <Chip
              key={count}
              label={`${count} cabin${count === 1 ? "" : "s"}`}
              on={!showCustomCount && cabins.length === count}
              onPress={() => { setCustomCount(false); setCabinCount(count); }}
            />
          ))}
          <Chip label="Custom" on={showCustomCount} onPress={() => setCustomCount(true)} />
        </View>
        {showCustomCount ? (
          <TextInput
            style={[styles.input, styles.below]}
            value={cabins.length ? String(cabins.length) : ""}
            onChangeText={(text) => setCabinCount(Math.max(0, Math.min(50, Number(text.replace(/[^\d]/g, "")) || 0)))}
            placeholder="Number of cabins (up to 50)"
            placeholderTextColor={themePalette.slate[400]}
            keyboardType="number-pad"
          />
        ) : null}
      </View>

      {cabins.map((cabin, index) => {
        const seats = Number(cabin.seats);
        const options = COWORKING_CABIN_SEAT_OPTIONS.includes(seats)
          ? COWORKING_CABIN_SEAT_OPTIONS
          : [...COWORKING_CABIN_SEAT_OPTIONS, seats].filter((n) => n > 0).sort((a, b) => a - b);
        return (
          <View key={index} style={styles.field}>
            <Text style={styles.label}>Cabin {index + 1} · seats per cabin</Text>
            <View style={styles.chips}>
              {options.map((option) => (
                <Chip key={option} label={`${option} seater`} on={seats === option} onPress={() => setCabinSeats(index, option)} />
              ))}
            </View>
          </View>
        );
      })}
      {seatTotal ? (
        <Text style={styles.note}>
          {seatTotal} seat{seatTotal === 1 ? "" : "s"} across {cabins.length} cabin{cabins.length === 1 ? "" : "s"}.
        </Text>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>Workstations</Text>
        <TextInput
          style={styles.input}
          value={value?.workstations === null || value?.workstations === undefined ? "" : String(value.workstations)}
          onChangeText={(text) => set({ workstations: numberOrNull(text) })}
          placeholder={seatTotal ? `${seatTotal} across the cabins` : "How many desks"}
          placeholderTextColor={themePalette.slate[400]}
          keyboardType="number-pad"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Agreed rent (monthly)</Text>
        <TextInput
          style={styles.input}
          value={value?.agreedRent === null || value?.agreedRent === undefined ? "" : String(value.agreedRent)}
          onChangeText={(text) => set({ agreedRent: numberOrNull(text) })}
          placeholder="What was agreed"
          placeholderTextColor={themePalette.slate[400]}
          keyboardType="decimal-pad"
        />
      </View>

      <MonthsField label="Deposit" field="depositMonths" value={value} onChange={set} />
      <MonthsField label="Notice period" field="noticePeriodMonths" value={value} onChange={set} />
      <MonthsField label="Lock-in period" field="lockInMonths" value={value} onChange={set} />
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
    below: { marginTop: 6 },
    note: { marginTop: 6, fontSize: 12, color: c.slate[500] },
  }),
);
