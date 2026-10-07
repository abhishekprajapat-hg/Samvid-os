import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Glyph } from "../../../components/ui/Glyph";
import { brand, brandStyles, round } from "../../../theme/brand";
import { getActiveScheme } from "../../../theme/themedStyles";
import { STATUS_META, statusTone } from "../cabinData";
import type { Cabin } from "../boardReducer";

/*
 * One cabin, in one of two forms - web's CabinTile.jsx.
 *
 * Cabins let whole, so a tile shows a capacity and a status, never a count of
 * filled seats. "wing" is the roomy form: number, capacity, whoever holds it.
 * "plan" is the floor plate and carries the number alone, because the plan
 * hands each tile its real footprint and anything stacked under the number
 * would clip.
 */

export const CabinTile = React.memo(
  ({
    cabin,
    variant = "wing",
    selected,
    inCart,
    dimmed,
    onSelect,
    fontSize,
  }: {
    cabin: Cabin;
    variant?: "wing" | "plan";
    selected?: boolean;
    inCart?: boolean;
    dimmed?: boolean;
    onSelect?: (cabin: Cabin) => void;
    /** Plan tiles grow their number with the zoom. */
    fontSize?: number;
  }) => {
    const meta = STATUS_META[cabin.status] || STATUS_META.VACANT;
    const tone = statusTone(cabin.status, getActiveScheme());
    const isLet = cabin.status === "BOOKED" || cabin.status === "RESERVED";
    const holder = isLet ? cabin.client?.name || meta.label : meta.label;
    const description = isLet
      ? `${cabin.seats} seater, ${cabin.status === "RESERVED" ? "held for" : "let to"} ${cabin.client?.name}`
      : `${cabin.seats} seater, ${meta.label.toLowerCase()}`;
    const isPlan = variant === "plan";

    return (
      <Pressable
        onPress={() => onSelect?.(cabin)}
        accessibilityRole="button"
        accessibilityLabel={`Cabin ${cabin.label}, ${description}`}
        accessibilityState={{ selected: Boolean(selected) }}
        style={[
          styles.tile,
          isPlan ? styles.tilePlan : styles.tileWing,
          { backgroundColor: tone.bg, borderColor: tone.border },
          dimmed && styles.dimmed,
          (selected || inCart) && { borderColor: brand.primary, borderWidth: selected ? 2 : 1.5 },
        ]}
      >
        {inCart ? (
          <View style={styles.cartMark}>
            <Glyph name="checkmark" size={10} color={brand.onPrimary} />
          </View>
        ) : null}
        <Text
          style={[styles.code, { color: tone.ink }, isPlan && { fontSize: fontSize || 9 }]}
          numberOfLines={1}
        >
          {cabin.label}
        </Text>
        {isPlan ? null : (
          <>
            <View style={styles.seatPill}>
              <Text style={[styles.seatText, { color: tone.ink }]}>{cabin.seats} seater</Text>
            </View>
            <Text style={[styles.holder, { color: tone.ink }]} numberOfLines={1}>
              {holder}
            </Text>
          </>
        )}
      </Pressable>
    );
  },
);

CabinTile.displayName = "CabinTile";

const styles = brandStyles(() =>
  StyleSheet.create({
    tile: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      overflow: "hidden",
    },
    tileWing: { height: 86, gap: 5, paddingHorizontal: 6, borderRadius: round.field },
    tilePlan: { flex: 1, borderRadius: 4, paddingHorizontal: 1 },
    dimmed: { opacity: 0.3 },
    cartMark: {
      position: "absolute",
      top: 0,
      right: 0,
      width: 16,
      height: 16,
      borderBottomLeftRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: brand.primary,
    },
    code: { fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
    seatPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: round.pill,
      backgroundColor: "rgba(0,0,0,0.06)",
    },
    seatText: { fontSize: 10.5, fontWeight: "700" },
    holder: { width: "100%", textAlign: "center", fontSize: 11, fontWeight: "500", opacity: 0.85 },
  }),
);
