import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AppButton, AppInput, AppSheet } from "../../../components/ui";
import { AppChip } from "../../../components/common/ui";
import { palette, spacing, typography } from "../../../theme/tokens";
import {
  EMPTY_LEAD_FILTERS,
  QUICK_FILTERS,
  SOURCE_OPTIONS,
  countActiveFilters,
  type LeadFilterState,
  type QuickFilterKey,
} from "../leadFilters";

/*
 * The mobile counterpart of LeadFiltersFlyout.jsx. Web slides a panel in from
 * the right; on a phone that becomes a bottom sheet, which is the layout
 * adaptation recorded in the design doc.
 *
 * Draft state is local until Apply, so half-built filters never trigger a
 * fetch - the same reason the web flyout keeps a draft.
 */

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const ChipRow = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.chipRow}>{children}</View>
);

export const LeadFiltersSheet = ({
  visible,
  filters,
  statuses,
  assignees,
  onApply,
  onClose,
}: {
  visible: boolean;
  filters: LeadFilterState;
  statuses: string[];
  assignees: Array<{ _id?: string; name: string }>;
  onApply: (next: LeadFilterState) => void;
  onClose: () => void;
}) => {
  const [draft, setDraft] = useState<LeadFilterState>(filters);

  // Re-seed each time it opens, so a cancelled edit is genuinely discarded.
  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const set = (patch: Partial<LeadFilterState>) => setDraft((prev) => ({ ...prev, ...patch }));

  const toggleQuick = (key: QuickFilterKey) =>
    set({ quickFilter: draft.quickFilter === key ? "" : key });

  const activeCount = countActiveFilters(draft);

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title="Filters"
      subtitle={activeCount ? `${activeCount} active` : "Narrow the pipeline"}
      footer={
        <View style={styles.actions}>
          <AppButton
            title="Clear all"
            variant="secondary"
            onPress={() => setDraft(EMPTY_LEAD_FILTERS)}
            style={styles.action}
          />
          <AppButton title="Apply" onPress={() => onApply(draft)} style={styles.action} />
        </View>
      }
    >
      <Section title="Quick filters">
        <ChipRow>
          {QUICK_FILTERS.map((quick) => (
            <AppChip
              key={quick.key}
              label={quick.label}
              active={draft.quickFilter === quick.key}
              onPress={() => toggleQuick(quick.key)}
            />
          ))}
        </ChipRow>
      </Section>

      <Section title="Status">
        <ChipRow>
          <AppChip label="Any" active={!draft.status} onPress={() => set({ status: "" })} />
          {statuses.map((status) => (
            <AppChip
              key={status}
              label={status.replace(/_/g, " ")}
              active={draft.status === status}
              onPress={() => set({ status })}
            />
          ))}
        </ChipRow>
      </Section>

      <Section title="Source">
        <ChipRow>
          {SOURCE_OPTIONS.map((option) => (
            <AppChip
              key={option.value || "ANY"}
              label={option.label}
              active={draft.source === option.value}
              onPress={() => set({ source: option.value })}
            />
          ))}
        </ChipRow>
      </Section>

      <Section title="Assigned to">
        <ScrollView style={styles.assigneeScroll} nestedScrollEnabled>
          <ChipRow>
            <AppChip label="Anyone" active={!draft.assignedTo} onPress={() => set({ assignedTo: "" })} />
            <AppChip
              label="Unassigned"
              active={draft.assignedTo === "UNASSIGNED"}
              onPress={() => set({ assignedTo: "UNASSIGNED" })}
            />
            {assignees.map((person) => (
              <AppChip
                key={person._id || person.name}
                label={person.name}
                active={draft.assignedTo === person._id}
                onPress={() => set({ assignedTo: String(person._id || "") })}
              />
            ))}
          </ChipRow>
        </ScrollView>
      </Section>

      <Section title="Created between">
        <View style={styles.dateRow}>
          <AppInput
            value={draft.dateFrom}
            onChangeText={(value) => set({ dateFrom: value })}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            style={styles.dateField}
          />
          <AppInput
            value={draft.dateTo}
            onChangeText={(value) => set({ dateTo: value })}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            style={styles.dateField}
          />
        </View>
      </Section>

      <Section title="Follow-up between">
        <View style={styles.dateRow}>
          <AppInput
            value={draft.followUpFrom}
            onChangeText={(value) => set({ followUpFrom: value })}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            style={styles.dateField}
          />
          <AppInput
            value={draft.followUpTo}
            onChangeText={(value) => set({ followUpTo: value })}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            style={styles.dateField}
          />
        </View>
      </Section>
    </AppSheet>
  );
};

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: palette.slate[500],
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  assigneeScroll: { maxHeight: 140 },
  dateRow: { flexDirection: "row", gap: spacing.md },
  dateField: { flex: 1 },
  actions: { flexDirection: "row", gap: spacing.md },
  action: { flex: 1 },
});
