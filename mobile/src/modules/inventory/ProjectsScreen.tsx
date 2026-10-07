import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Glyph } from "../../components/ui/Glyph";
import { TextField } from "../../components/ui/form";
import { Banner, BrandButton, BrandPage, Chip, ChipRow, EmptyNote, Pill } from "../../components/brand/kit";
import { brand, brandStyles, round, type as t } from "../../theme/brand";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionContext";
import { deleteProject, getProjectsWithMeta, type Project } from "../../services/projectService";
import { toAbsoluteUrl } from "../../services/uploadService";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  PROJECT_CATEGORY_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  getProjectOptionLabel,
} from "../../config/projectConfig";
import { PROJECT_DELETE_ROLES, PROJECT_MANAGE_ROLES, formatRate, isCommercialCategory } from "./projectForm";

/*
 * Projects - web's Projects.jsx list.
 *
 * The same card web draws (photo, status, name, location, current rate, the
 * project's code, category and type, land area and plots or offices), the
 * same three server-side filters plus search, web's page size, and web's
 * permission rule for who may add, edit and delete. Creating and editing open
 * the project form; the September note that "creating stays on web" no longer
 * applies.
 */

const PAGE_LIMIT = 25;

export const ProjectsScreen = () => {
  const navigation = useNavigation<any>();
  const { role } = useAuth();
  const { canPageAction, enforcePageAccess } = usePermissions();
  const normalizedRole = String(role || "").toUpperCase();
  const canManage =
    PROJECT_MANAGE_ROLES.has(normalizedRole)
    || (enforcePageAccess && canPageAction("projects", "edit"))
    || (enforcePageAccess && canPageAction("projects", "create"));
  const canDelete = PROJECT_DELETE_ROLES.has(normalizedRole) || (enforcePageAccess && canPageAction("projects", "delete"));

  const [projects, setProjects] = useState<Project[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchPage = useCallback(
    async (nextPage: number) => {
      const params: Record<string, unknown> = { page: nextPage, limit: PAGE_LIMIT };
      if (search.trim()) params.search = search.trim();
      if (category !== "all") params.projectCategory = category;
      if (type !== "all") params.projectType = type;
      if (status !== "all") params.status = status;
      const result = await getProjectsWithMeta(params);
      const pagination = result.pagination || {};
      setTotal(Number(pagination.totalCount || result.projects.length));
      setHasMore(Boolean(pagination.hasNextPage) || nextPage < Number(pagination.totalPages || 0));
      return result.projects;
    },
    [category, search, status, type],
  );

  const load = useCallback(async () => {
    try {
      setError("");
      const rows = await fetchPage(1);
      setProjects(rows);
      setPage(1);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load projects"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const rows = await fetchPage(page + 1);
      setProjects((prev) => [...prev, ...rows]);
      setPage((value) => value + 1);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load projects"));
    } finally {
      setLoadingMore(false);
    }
  };

  const confirmDelete = (project: Project) => {
    Alert.alert("Delete project?", `${project.projectName || "This project"} will be removed. This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteProject(String(project._id));
            setNotice("Project deleted");
            await load();
          } catch (err) {
            setError(toErrorMessage(err, "Failed to delete project"));
          }
        },
      },
    ]);
  };

  return (
    <BrandPage
      title="Projects"
      subtitle="Manage plotting, building, and villa/farmhouse projects"
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      right={
        canManage ? (
          <BrandButton title="Add" icon="add" size="sm" onPress={() => navigation.navigate("ProjectForm")} />
        ) : undefined
      }
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load();
      }}
    >
      {error ? <Banner tone="alert" message={error} /> : null}
      {notice ? <Banner tone="success" message={notice} action="Dismiss" onAction={() => setNotice("")} /> : null}

      <TextField value={search} onChangeText={setSearch} placeholder="Search by project name, ID, or location" icon="search" />
      <ChipRow>
        <Chip label="All categories" active={category === "all"} onPress={() => setCategory("all")} />
        {PROJECT_CATEGORY_OPTIONS.map((option) => (
          <Chip key={option.value} label={option.label} active={category === option.value} onPress={() => setCategory(option.value)} />
        ))}
      </ChipRow>
      <ChipRow>
        <Chip label="All types" active={type === "all"} onPress={() => setType("all")} />
        {PROJECT_TYPE_OPTIONS.map((option) => (
          <Chip key={option.value} label={option.label} active={type === option.value} onPress={() => setType(option.value)} />
        ))}
      </ChipRow>
      <ChipRow>
        <Chip label="All statuses" active={status === "all"} onPress={() => setStatus("all")} />
        {PROJECT_STATUS_OPTIONS.map((option) => (
          <Chip key={option.value} label={option.label} active={status === option.value} onPress={() => setStatus(option.value)} />
        ))}
      </ChipRow>

      {loading ? (
        <ActivityIndicator color={brand.primary} />
      ) : projects.length ? (
        <>
          <Text style={styles.count}>{total} project{total === 1 ? "" : "s"}</Text>
          {projects.map((project) => {
            const image = Array.isArray(project.images) ? project.images[0] : "";
            const imageCount = Array.isArray(project.images) ? project.images.length : 0;
            const commercial = isCommercialCategory(project.projectCategory);
            const open = () => navigation.navigate("ProjectDetails", { projectId: project._id });
            return (
              <View key={String(project._id)} style={styles.card}>
                <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`View ${project.projectName}`}>
                  {image ? (
                    <Image source={{ uri: toAbsoluteUrl(String(image)) }} style={styles.image} resizeMode="contain" />
                  ) : (
                    <View style={[styles.image, styles.noImage]}>
                      <Glyph name="image-outline" size={30} color={brand.placeholder} />
                      <Text style={styles.noImageText}>NO IMAGE</Text>
                    </View>
                  )}
                  <View style={styles.statusPin}>
                    <Pill label={getProjectOptionLabel(PROJECT_STATUS_OPTIONS, project.status) || "-"} tone="success" />
                  </View>
                  {imageCount > 1 ? <Text style={styles.photos}>+{imageCount - 1} photos</Text> : null}
                </Pressable>

                <View style={styles.body}>
                  <View style={styles.topRow}>
                    <View style={styles.flex}>
                      <Text style={styles.name} numberOfLines={1}>{project.projectName || "Untitled project"}</Text>
                      <View style={styles.locRow}>
                        <Glyph name="location-outline" size={13} color={brand.textMuted} />
                        <Text style={styles.loc} numberOfLines={1}>{project.location || "-"}</Text>
                      </View>
                    </View>
                    <View style={styles.rateCol}>
                      <Text style={styles.rate}>{formatRate(project.currentRate)}</Text>
                      <Text style={styles.code}>{project.projectId || ""}</Text>
                    </View>
                  </View>

                  <View style={styles.tags}>
                    <Text style={styles.tag}>{getProjectOptionLabel(PROJECT_CATEGORY_OPTIONS, project.projectCategory)}</Text>
                    {!commercial && project.projectType ? (
                      <Text style={styles.tag}>{getProjectOptionLabel(PROJECT_TYPE_OPTIONS, project.projectType)}</Text>
                    ) : null}
                  </View>

                  <View style={styles.metaRow}>
                    <View style={styles.meta}>
                      <Text style={styles.metaLabel}>LAND AREA</Text>
                      <Text style={styles.metaValue} numberOfLines={1}>{project.totalLandArea || "-"}</Text>
                    </View>
                    <View style={styles.meta}>
                      <Text style={styles.metaLabel}>{commercial ? "TOTAL OFFICES" : "TOTAL PLOTS"}</Text>
                      <Text style={styles.metaValue}>
                        {commercial
                          ? String(project.totalOffices ?? (Array.isArray(project.offices) ? project.offices.length : 0))
                          : String(project.totalPlots ?? "-")}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actions}>
                    <BrandButton title="View" icon="eye-outline" size="sm" variant="secondary" style={styles.flex} onPress={open} />
                    {canManage ? (
                      <BrandButton
                        title="Edit"
                        icon="create-outline"
                        size="sm"
                        variant="secondary"
                        onPress={() => navigation.navigate("ProjectForm", { projectId: project._id })}
                      />
                    ) : null}
                    {canDelete ? (
                      <BrandButton title="" icon="trash-outline" size="sm" variant="dangerSoft" accessibilityLabel="Delete project" onPress={() => confirmDelete(project)} />
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
          {hasMore ? (
            <BrandButton title={loadingMore ? "Loading…" : "Load more"} variant="secondary" loading={loadingMore} onPress={loadMore} />
          ) : null}
        </>
      ) : (
        <EmptyNote
          icon="business-outline"
          title={search || category !== "all" || type !== "all" || status !== "all" ? "No matches" : "No projects yet"}
          message={canManage ? "Add a project to see it here." : "Projects appear here once they are added."}
        />
      )}
    </BrandPage>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    count: { fontSize: t.label, fontWeight: "600", color: b.textMuted },
    card: {
      overflow: "hidden",
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel + 4,
      backgroundColor: b.surface,
    },
    image: { width: "100%", height: 170, backgroundColor: b.fieldMuted },
    noImage: { alignItems: "center", justifyContent: "center", gap: 6 },
    noImageText: { fontSize: 10, fontWeight: "800", letterSpacing: 1.4, color: b.placeholder },
    statusPin: { position: "absolute", top: 10, left: 10 },
    photos: {
      position: "absolute",
      right: 10,
      bottom: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: round.pill,
      overflow: "hidden",
      backgroundColor: "rgba(2,6,23,0.75)",
      color: "#ffffff",
      fontSize: 10,
      fontWeight: "800",
    },
    body: { padding: 12, gap: 10 },
    topRow: { flexDirection: "row", gap: 10 },
    name: { fontSize: t.rowTitle + 1, fontWeight: "800", color: b.text },
    locRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
    loc: { flex: 1, fontSize: t.label, color: b.textMuted },
    rateCol: { alignItems: "flex-end" },
    rate: { fontSize: t.rowTitle, fontWeight: "800", color: b.text },
    code: { marginTop: 2, fontSize: 10, color: b.placeholder },
    tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    tag: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.pill,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.4,
      color: b.textSecondary,
    },
    metaRow: { flexDirection: "row", gap: 8 },
    meta: { flex: 1, padding: 8, borderRadius: round.field, borderWidth: 1, borderColor: b.border, backgroundColor: b.fieldMuted },
    metaLabel: { fontSize: 9.5, fontWeight: "800", letterSpacing: 1, color: b.placeholder },
    metaValue: { marginTop: 3, fontSize: t.body, fontWeight: "700", color: b.text },
    actions: { flexDirection: "row", gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: b.hairline },
  }),
);

export default ProjectsScreen;
