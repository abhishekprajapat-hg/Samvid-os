import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, palette, radii, spacing, typography } from "../../theme/tokens";
import { themedStyles, themePalette } from "../../theme/themedStyles";

/*
 * Mirrors frontend/src/components/ui/Tabs.jsx: a 2px bottom border on the
 * active trigger, 12.5px/600 labels, and a hairline rule under the row.
 *
 * Web lets the row wrap. A phone has no width to wrap into, so the row scrolls
 * horizontally instead - the one layout change, recorded in the design doc.
 */

export type TabItem = { key: string; label: string; badge?: number };

export const AppTabs = ({
  tabs,
  activeKey,
  onChange,
  style,
}: {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
}) => (
  <View style={[styles.row, style]}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.trigger, active && styles.triggerActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
            {tab.badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tab.badge > 99 ? "99+" : tab.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  </View>
);

const styles = themedStyles((c) => StyleSheet.create({
  row: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scroll: {
    gap: spacing.xl,
    paddingRight: spacing.xl,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    // Pulls the 2px indicator down onto the row's own hairline, as -mb-px does.
    marginBottom: -1,
  },
  triggerActive: {
    borderBottomColor: themePalette.blue[600],
  },
  label: {
    fontSize: 12.5,
    fontWeight: "600",
    color: themePalette.slate[500],
  },
  labelActive: {
    color: themePalette.slate[900],
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: radii.pill,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themePalette.slate[100],
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: themePalette.slate[600],
  },
}));

export default AppTabs;
