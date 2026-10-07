import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Glyph } from "../ui/Glyph";
import { brand, brandStyles, round, type as t } from "../../theme/brand";
import { searchPlaces, type PlaceSuggestion } from "../../services/placeSearch";

/*
 * The suggestion list under a location box - web's inventory location dropdown
 * and its PlaceAutocompleteInput, drawn for a phone.
 *
 * `multiValue` is web's comma-separated locality box: only the piece after the
 * last comma is looked up, and a pick replaces that piece rather than the whole
 * box, so localities already entered survive.
 */

const tailSegment = (raw: string, multiValue: boolean) => {
  const text = String(raw || "");
  if (!multiValue) return text;
  const cut = text.lastIndexOf(",");
  return cut === -1 ? text : text.slice(cut + 1);
};

export const withPickedPlace = (raw: string, label: string, multiValue: boolean) => {
  const text = String(raw || "");
  const cut = text.lastIndexOf(",");
  const head = multiValue && cut !== -1 ? `${text.slice(0, cut + 1)} ` : "";
  return `${head}${label}`;
};

export const usePlaceSuggestions = (
  value: string,
  { enabled = true, mode = "auto", multiValue = false }: { enabled?: boolean; mode?: "auto" | "google-only"; multiValue?: boolean } = {},
) => {
  const [rows, setRows] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchId = useRef(0);
  /* The text a pick just wrote, so it is not looked up again and reopened. */
  const justChose = useRef<string | null>(null);

  useEffect(() => {
    if (justChose.current !== null && justChose.current === value) {
      justChose.current = null;
      return undefined;
    }
    const query = tailSegment(value, multiValue).trim();
    const id = fetchId.current + 1;
    fetchId.current = id;
    const timer = setTimeout(async () => {
      if (!enabled || query.length < 3) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const next = await searchPlaces(query, mode);
      if (fetchId.current !== id) return;
      setRows(next);
      setLoading(false);
    }, 280);
    return () => clearTimeout(timer);
  }, [value, enabled, mode, multiValue]);

  const markChosen = (text: string) => {
    justChose.current = text;
    fetchId.current += 1;
    setRows([]);
    setLoading(false);
  };

  return { rows, loading, markChosen, clear: () => setRows([]) };
};

export const PlaceSuggestionList = ({
  rows,
  loading,
  onPick,
}: {
  rows: PlaceSuggestion[];
  loading: boolean;
  onPick: (suggestion: PlaceSuggestion) => void;
}) => {
  if (!loading && !rows.length) return null;
  return (
    <View style={styles.list}>
      {loading && !rows.length ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={brand.primary} />
          <Text style={styles.loadingText}>Searching places…</Text>
        </View>
      ) : null}
      {rows.map((row, index) => (
        <Pressable
          key={row.id || row.label}
          style={[styles.row, index > 0 && styles.divided]}
          onPress={() => onPick(row)}
          accessibilityRole="button"
        >
          <Glyph name="location-outline" size={15} color={brand.textMuted} />
          <Text style={styles.label} numberOfLines={2}>
            {row.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    list: {
      marginTop: -4,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: b.fieldBorder,
      borderRadius: round.field,
      backgroundColor: b.surface,
      overflow: "hidden",
    },
    loading: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10 },
    loadingText: { fontSize: t.body, color: b.textMuted },
    row: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 10, paddingVertical: 9 },
    divided: { borderTopWidth: 1, borderTopColor: b.hairline },
    label: { flex: 1, fontSize: t.body, lineHeight: 17, color: b.text },
  }),
);
