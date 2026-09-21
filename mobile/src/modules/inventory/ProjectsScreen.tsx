import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/common/Screen";
import {
  AppBadge,
  AppCard,
  AppEmptyState,
  AppSearchInput,
  AppSkeletonList,
} from "../../components/ui";
import { palette, spacing, typography } from "../../theme/tokens";
import { toErrorMessage } from "../../utils/errorMessage";
import { getProjectsWithMeta, type Project } from "../../services/projectService";
import { themedStyles, themePalette } from "../../theme/themedStyles";

/*
 * Mirrors modules/inventory/Projects.jsx.
 *
 * Web lays projects out as a filterable grid with a create/edit form alongside.
 * On a phone it is a searchable card list; a project opens into its own screen
 * rather than a side panel. Creating and editing projects stays on web for now
 * - it is a long form that is almost always done at a desk. Noted in
 * docs/mobile/PROGRESS.md rather than silently dropped.
 */

const statusVariant = (status?: string) => {
  const value = String(status || "").toUpperCase();
  if (value.includes("COMPLETE") || value.includes("READY")) return "emerald" as const;
  if (value.includes("HOLD") || value.includes("STALL")) return "rose" as const;
  if (value.includes("PROGRESS") || value.includes("ONGOING")) return "amber" as const;
  return "slate" as const;
};

export const ProjectsScreen = () => {
  const navigation = useNavigation<any>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      // Search is a server parameter, as it is for leads - filtering locally
      // would only ever search the page already fetched.
      const data = await getProjectsWithMeta(search ? { search } : {});
      setProjects(data.projects);
      setError("");
    } catch (err) {
      setError(toErrorMessage(err, "Could not load projects"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <Screen title="Projects" subtitle={projects.length ? `${projects.length} on file` : "Developments"} error={error} onRetry={load}>
      <AppSearchInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search projects"
        style={styles.search}
      />

      {loading ? (
        <AppSkeletonList rows={4} />
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item, index) => String(item._id || index)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          ListEmptyComponent={
            <AppEmptyState
              title={search ? "No matches" : "No projects yet"}
              description={
                search ? "Try a different name or location." : "Projects added on the web app appear here."
              }
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate("ProjectDetails", { projectId: item._id, project: item })
              }
            >
              <AppCard style={styles.card} interactive>
                <View style={styles.head}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name || "Untitled project"}
                  </Text>
                  {item.status ? (
                    <AppBadge variant={statusVariant(item.status)}>
                      {String(item.status).replace(/_/g, " ")}
                    </AppBadge>
                  ) : null}
                </View>

                {item.location ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.location}
                  </Text>
                ) : null}
                {item.developer ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.developer}
                  </Text>
                ) : null}
                {Number(item.unitCount || 0) > 0 ? (
                  <Text style={styles.units}>{item.unitCount} units</Text>
                ) : null}
              </AppCard>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  search: { marginBottom: spacing.md },
  list: { paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.md },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  name: { flex: 1, fontSize: typography.body, fontWeight: "600", color: themePalette.slate[900] },
  meta: { marginTop: 3, fontSize: typography.label, color: themePalette.slate[500] },
  units: { marginTop: spacing.md, fontSize: typography.label, fontWeight: "600", color: themePalette.blue[600] },
}));
