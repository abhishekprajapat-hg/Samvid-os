import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Glyph } from "../../../components/ui/Glyph";
import { identifyContact } from "../../../services/crmContactService";
import { brand, brandStyles, type as t } from "../../../theme/brand";

/*
 * Web's BrokerPhoneHint: warns while the number is still being typed, because
 * a broker number is refused on save - finding that out after filling in the
 * rest of the form is the version that wastes someone's afternoon.
 *
 * The result is held against the number it was fetched for, so a slow reply
 * for an earlier number cannot label the current one.
 */
export const BrokerPhoneHint = ({ phone }: { phone: string }) => {
  const [match, setMatch] = useState<{ phone: string; name: string } | null>(null);

  useEffect(() => {
    const current = String(phone || "");
    let active = true;
    const timer = setTimeout(() => {
      if (current.replace(/\D/g, "").length < 7) {
        if (active) setMatch(null);
        return;
      }
      identifyContact(current)
        .then((result) => {
          if (active) setMatch(result.isBroker ? { phone: current, name: result.name || "This number" } : null);
        })
        .catch(() => {
          if (active) setMatch(null);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [phone]);

  if (!match || match.phone !== String(phone || "")) return null;

  return (
    <View style={styles.row} accessibilityRole="alert">
      <Glyph name="shield-outline" size={14} color={brand.warnInk} />
      <Text style={styles.text}>
        {match.name} is in the Broker Database, so this number cannot be saved as a lead.
      </Text>
    </View>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: -8, marginBottom: 12 },
    text: { flex: 1, fontSize: t.label, lineHeight: 15, fontWeight: "600", color: b.warnInk },
  }),
);
