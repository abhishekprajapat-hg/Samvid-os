import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import { Screen } from "../../components/common/Screen";
import { AppBadge, AppCard, AppEmptyState, AppSkeletonList } from "../../components/ui";
import { palette, spacing, typography } from "../../theme/tokens";
import { toErrorMessage } from "../../utils/errorMessage";
import { getProjectById, type Project } from "../../services/projectService";

/*
 * Mirrors modules/inventory/ProjectDetails.jsx.
 *
 * The project record carries a wide, largely optional field set (unit mix,
 * areas, facing, parking...). Rather than hardcode a layout for fields that may
 * be empty, anything present and scalar is rendered as a labelled row - which
 * also means a field added on the backend shows up here without a mobile
 * release.
 */

// Rendered in their own right above the generic rows.
const HEADLINE_KEYS = new Set([
  "_id", "name", "location", "developer", "status", "description",
  "images", "createdAt", "updatedAt", "companyId", "__v",
]);

const humanise = (key: string) =>
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();

const renderable = (value: unknown) =>
  (typeof value === "string" && value.trim())
  || typeof value === "number"
  || typeof value === "boolean";

const display = (value: unknown) => {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

export const ProjectDetailsScreen = () => {
  const route = useRoute<any>();
  const projectId = String(route.params?.projectId || route.params?.project?._id || "");

  // The list screen passes the row it already has, so the header can render
  // before the fetch resolves.
  const [project, setProject] = useState<Project | null>(route.params?.project || null);
  const [loading, setLoading] = useState(!route.params?.project);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!projectId) {
      setError("Project not found");
      setLoading(false);
      return;
    }
    try {
      const fetched = await getProjectById(projectId);
      if (fetched) setProject(fetched);
      else if (!project) setError("Project not found");
      setError("");
    } catch (err) {
      setError(toErrorMessage(err, "Could not load this project"));
    } finally {
      setLoading(false);
    }
  }, [projectId, project]);

  useEffect(() => {
    void load();
    // Intentionally on id only: re-running when `project` changes would loop.
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <Screen title="Project" subtitle="Loading">
        <AppSkeletonList rows={4} />
      </Screen>
    );
  }

  if (!project) {
    return (
      <Screen title="Project" subtitle="Not found" error={error} onRetry={load}>
        <AppEmptyState title="Project not found" description="It may have been removed." />
      </Screen>
    );
  }

  const extras = Object.entries(project).filter(
    ([key, value]) => !HEADLINE_KEYS.has(key) && renderable(value),
  );

  return (
    <Screen title={project.name || "Project"} subtitle={project.location || "Details"} error={error}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <AppCard style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>{project.name || "Untitled project"}</Text>
            {project.status ? (
              <AppBadge variant="slate">{String(project.status).replace(/_/g, " ")}</AppBadge>
            ) : null}
          </View>
          {project.developer ? <Text style={styles.meta}>{project.developer}</Text> : null}
          {project.location ? <Text style={styles.meta}>{project.location}</Text> : null}
          {project.description ? <Text style={styles.description}>{project.description}</Text> : null}
        </AppCard>

        {extras.length > 0 ? (
          <AppCard style={styles.card}>
            <Text style={styles.sectionTitle}>Specification</Text>
            {extras.map(([key, value]) => (
              <View key={key} style={styles.row}>
                <Text style={styles.rowLabel}>{humanise(key)}</Text>
                <Text style={styles.rowValue}>{display(value)}</Text>
              </View>
            ))}
          </AppCard>
        ) : null}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  body: { paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.md },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: { flex: 1, fontSize: typography.title, fontWeight: "600", color: palette.slate[900] },
  meta: { marginTop: 3, fontSize: typography.label, color: palette.slate[500] },
  description: {
    marginTop: spacing.lg,
    fontSize: typography.body,
    lineHeight: 20,
    color: palette.slate[600],
  },
  sectionTitle: {
    fontSize: typography.cardTitle,
    fontWeight: "600",
    color: palette.slate[900],
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.slate[200],
  },
  rowLabel: { flex: 1, fontSize: typography.label, color: palette.slate[500] },
  rowValue: {
    flex: 1,
    fontSize: typography.label,
    fontWeight: "600",
    color: palette.slate[800],
    textAlign: "right",
  },
});
