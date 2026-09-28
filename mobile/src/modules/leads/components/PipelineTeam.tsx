import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Glyph } from "../../../components/ui/Glyph";
import { Avatar, EmptyNote } from "../../../components/brand/kit";
import { brand, brandStyles, round, type as t } from "../../../theme/brand";
import type { Lead } from "../../../types";

/*
 * The pipeline by person - web's PipelineTeam.jsx. Everyone holding at least
 * one of the leads on screen, busiest first, with their three most common
 * statuses. Tapping a person narrows the pipeline to their leads, as web's
 * "Open employee leads" does.
 */

const titleCase = (value?: string) =>
  String(value || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());

type Employee = { id: string; name: string; role?: string; count: number; statuses: Map<string, number> };

export const PipelineTeam = ({
  leads,
  employees,
  onOpenEmployee,
}: {
  leads: Lead[];
  employees: Array<{ _id?: string; name?: string; role?: string }>;
  onOpenEmployee: (employee: { id: string; name: string }) => void;
}) => {
  const team = useMemo(() => {
    const byId = new Map<string, Employee>();
    employees.forEach((employee) => {
      const id = String(employee?._id || "").trim();
      if (id) byId.set(id, { id, name: employee.name || "Unnamed employee", role: employee.role, count: 0, statuses: new Map() });
    });
    leads.forEach((lead: any) => {
      const assigned = lead?.assignedTo;
      const id = String(assigned?._id || assigned?.id || assigned || "").trim();
      if (!id) return;
      const current = byId.get(id) || {
        id,
        name: assigned?.name || "Unnamed employee",
        role: assigned?.role,
        count: 0,
        statuses: new Map<string, number>(),
      };
      current.count += 1;
      const status = String(lead?.status || "NEW").toUpperCase();
      current.statuses.set(status, (current.statuses.get(status) || 0) + 1);
      byId.set(id, current);
    });
    return [...byId.values()]
      .filter((employee) => employee.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [employees, leads]);

  if (!team.length) {
    return (
      <EmptyNote
        icon="people-outline"
        title="No assigned leads yet"
        message="Employees will appear here as soon as leads are assigned to them."
      />
    );
  }

  return (
    <View style={styles.list}>
      {team.map((employee) => {
        const topStatuses = [...employee.statuses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
        return (
          <Pressable
            key={employee.id}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => onOpenEmployee({ id: employee.id, name: employee.name })}
            accessibilityRole="button"
            accessibilityLabel={`Open ${employee.name}'s leads`}
          >
            <View style={styles.head}>
              <Avatar name={employee.name} size={40} />
              <View style={styles.flex}>
                <Text style={styles.name} numberOfLines={1}>{employee.name}</Text>
                <Text style={styles.role} numberOfLines={1}>{titleCase(employee.role) || "Employee"}</Text>
              </View>
              <Glyph name="arrow-forward" size={17} color={brand.textMuted} />
            </View>
            <View style={styles.foot}>
              <View>
                <Text style={styles.count}>{employee.count}</Text>
                <Text style={styles.countLabel}>Assigned leads</Text>
              </View>
              <View style={styles.statuses}>
                {topStatuses.map(([status, count]) => (
                  <Text key={status} style={styles.status}>
                    {titleCase(status)} {count}
                  </Text>
                ))}
              </View>
            </View>
            <Text style={styles.link}>Open employee leads</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    list: { gap: 10 },
    card: {
      padding: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    pressed: { opacity: 0.85 },
    head: { flexDirection: "row", alignItems: "center", gap: 11 },
    name: { fontSize: t.rowTitle, fontWeight: "700", color: b.text },
    role: { fontSize: t.label, color: b.textMuted },
    foot: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
    count: { fontSize: 22, fontWeight: "800", color: b.text },
    countLabel: { fontSize: t.label, color: b.textMuted },
    statuses: { flex: 1, flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 4 },
    status: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: round.pill,
      overflow: "hidden",
      backgroundColor: b.fieldMuted,
      fontSize: 10,
      fontWeight: "700",
      color: b.textSecondary,
    },
    link: { fontSize: t.label, fontWeight: "700", color: b.primary },
  }),
);
