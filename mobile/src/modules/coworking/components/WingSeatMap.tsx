import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Glyph } from "../../../components/ui/Glyph";
import { brand, brandStyles, round, type as t } from "../../../theme/brand";
import { WINGS } from "../cabinData";
import type { Cabin } from "../boardReducer";
import { CabinTile } from "./CabinTile";

/*
 * The 65 cabins straightened out into wings - web's WingSeatMap.jsx.
 *
 * Each wing header states its own vacancy, and wings collapse, because on a
 * floor this size you are usually only working one of them. Counts are of
 * cabins, not seats: cabins let whole, so "11 vacant" is the number a manager
 * can actually offer.
 */

const numberOf = (code: string) => Number(code.slice(1));
const COLUMNS = 3;

type MapProps = {
  cabins: Cabin[];
  selectedCode: string;
  cart: string[];
  matches: (cabin: Cabin) => boolean;
  onSelect: (cabin: Cabin) => void;
};

const WingSection = ({
  wing,
  cabins,
  selectedCode,
  cart,
  matches,
  onSelect,
}: MapProps & { wing: (typeof WINGS)[number] }) => {
  const [open, setOpen] = useState(true);
  const vacant = cabins.filter((cabin) => cabin.status === "VACANT");
  const capacity = cabins.reduce((total, cabin) => total + cabin.seats, 0);
  const vacantCapacity = vacant.reduce((total, cabin) => total + cabin.seats, 0);

  // Pad the last row so tiles keep one width instead of stretching.
  const rows: Array<Array<Cabin | null>> = [];
  for (let i = 0; i < cabins.length; i += COLUMNS) {
    const row: Array<Cabin | null> = cabins.slice(i, i + COLUMNS);
    while (row.length < COLUMNS) row.push(null);
    rows.push(row);
  }

  return (
    <View style={styles.wing}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        style={styles.wingHead}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={styles.wingTitleRow}>
          <Text style={styles.wingTitle}>{wing.label}</Text>
          <Text style={styles.wingHint}>{wing.hint}</Text>
          <Glyph name={open ? "chevron-up" : "chevron-down"} size={16} color={brand.textMuted} />
        </View>
        <Text style={styles.wingStats}>
          <Text style={[styles.wingVacant, !vacant.length && styles.wingVacantNone]}>
            {vacant.length} vacant
          </Text>
          {` · ${cabins.length} cabins · ${vacantCapacity} of ${capacity} seats free`}
        </Text>
      </Pressable>

      {open ? (
        <View style={styles.grid}>
          {rows.map((row, index) => (
            <View key={index} style={styles.row}>
              {row.map((cabin, cell) =>
                cabin ? (
                  <View key={cabin.code} style={styles.cell}>
                    <CabinTile
                      cabin={cabin}
                      selected={selectedCode === cabin.code}
                      inCart={cart.includes(cabin.code)}
                      dimmed={!matches(cabin)}
                      onSelect={onSelect}
                    />
                  </View>
                ) : (
                  <View key={`pad-${cell}`} style={styles.cell} />
                ),
              )}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

export const WingSeatMap = (props: MapProps) => (
  <View style={styles.root}>
    {WINGS.map((wing) => {
      const wingCabins = props.cabins
        .filter((cabin) => cabin.wing === wing.id)
        .sort((a, b) => numberOf(a.code) - numberOf(b.code));
      if (!wingCabins.length) return null;
      return <WingSection key={wing.id} wing={wing} {...props} cabins={wingCabins} />;
    })}
  </View>
);

const styles = brandStyles((b) =>
  StyleSheet.create({
    root: { gap: 10 },
    wing: {
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
      overflow: "hidden",
    },
    wingHead: { paddingHorizontal: 12, paddingVertical: 11, gap: 3 },
    wingTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    wingTitle: { fontSize: t.rowTitle, fontWeight: "700", color: b.text },
    wingHint: { flex: 1, fontSize: t.label, color: b.textMuted },
    wingStats: { fontSize: t.label, color: b.textMuted },
    wingVacant: { fontWeight: "700", color: "#b83232" },
    wingVacantNone: { color: b.placeholder },
    grid: { paddingHorizontal: 10, paddingBottom: 10, gap: 7 },
    row: { flexDirection: "row", gap: 7 },
    cell: { flex: 1, minWidth: 0 },
  }),
);
