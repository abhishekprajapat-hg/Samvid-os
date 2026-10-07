import React, { useCallback, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { Banner, BrandButton, BrandPage, KeyValue, Panel, Pill } from "../../components/brand/kit";
import { brandStyles, round, type as t } from "../../theme/brand";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionContext";
import { deleteProject, getProjectById, type Project } from "../../services/projectService";
import { toAbsoluteUrl } from "../../services/uploadService";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  PROJECT_AMENITY_OPTIONS,
  PROJECT_BHK_OPTIONS,
  PROJECT_CATEGORY_OPTIONS,
  PROJECT_COMMERCIAL_AMENITY_OPTIONS,
  PROJECT_HOUSING_CATEGORY_OPTIONS,
  PROJECT_PLOT_SIZE_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  PROJECT_UNIT_STATUS_OPTIONS,
  getProjectOptionLabel,
} from "../../config/projectConfig";
import {
  PROJECT_DELETE_ROLES,
  PROJECT_MANAGE_ROLES,
  formatRate,
  isBuildingType,
  isCommercialCategory,
  isPlotBasedType,
} from "./projectForm";

/*
 * One project - web's ProjectDetails.jsx, section for section: photos, basic
 * information by project type, pricing, housing category, location, owner and
 * broker managers, amenities, BHK configurations and the office, shop and
 * showroom inventory. Edit opens the project form; delete is admin's, as on web.
 */

const UnitCard = ({
  unit,
  codeField,
  rows,
}: {
  unit: any;
  codeField: string;
  rows: Array<[string, unknown]>;
}) => (
  <View style={styles.unit}>
    <View style={styles.unitHead}>
      <Text style={styles.unitCode} numberOfLines={1}>
        {unit[codeField]}
        {unit.officeName ? ` — ${unit.officeName}` : ""}
      </Text>
      <Pill label={getProjectOptionLabel(PROJECT_UNIT_STATUS_OPTIONS, unit.status)} tone="neutral" />
    </View>
    <Text style={styles.unitMeta}>{rows.map(([label, value]) => `${label}: ${value ?? "-"}`).join("  ·  ")}</Text>
    {unit.remarks ? <Text style={styles.unitMeta}>Remarks: {unit.remarks}</Text> : null}
  </View>
);

export const ProjectDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { role } = useAuth();
  const { canPageAction, enforcePageAccess } = usePermissions();
  const normalizedRole = String(role || "").toUpperCase();
  const canManage = PROJECT_MANAGE_ROLES.has(normalizedRole) || (enforcePageAccess && canPageAction("projects", "edit"));
  const canDelete = PROJECT_DELETE_ROLES.has(normalizedRole) || (enforcePageAccess && canPageAction("projects", "delete"));
  const projectId = String(route.params?.projectId || route.params?.project?._id || "");

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /* Photos are served to the app's own session, so they open here rather than
     in a browser that has no way to authenticate for them. */
  const [viewing, setViewing] = useState("");

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setError("");
      getProjectById(projectId)
        .then((data) => {
          if (!cancelled) setProject(data);
        })
        .catch((fetchError) => {
          if (!cancelled) setError(toErrorMessage(fetchError, "Failed to load project"));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [projectId]),
  );

  const confirmDelete = () => {
    Alert.alert("Delete project?", `${project?.projectName || "This project"} will be removed. This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteProject(projectId);
            navigation.goBack();
          } catch (deleteError) {
            setError(toErrorMessage(deleteError, "Failed to delete project"));
          }
        },
      },
    ]);
  };

  if (loading || !project) {
    return (
      <BrandPage title="Project" onBack={() => navigation.goBack()} loading={loading}>
        {error ? <Banner tone="alert" message={error} /> : null}
      </BrandPage>
    );
  }

  const p: any = project;
  const commercial = isCommercialCategory(p.projectCategory);
  const building = isBuildingType(p.projectType);
  const plotBased = isPlotBasedType(p.projectType);
  const amenityOptions = commercial ? PROJECT_COMMERCIAL_AMENITY_OPTIONS : PROJECT_AMENITY_OPTIONS;
  const images: string[] = Array.isArray(p.images) ? p.images : [];

  return (
    <BrandPage
      title={p.projectName || "Project"}
      subtitle={p.projectId || undefined}
      onBack={() => navigation.goBack()}
      right={
        <>
          {canManage ? (
            <BrandButton title="Edit" icon="create-outline" size="sm" variant="secondary" onPress={() => navigation.navigate("ProjectForm", { projectId })} />
          ) : null}
          {canDelete ? (
            <BrandButton title="" icon="trash-outline" size="sm" variant="dangerSoft" accessibilityLabel="Delete project" onPress={confirmDelete} />
          ) : null}
        </>
      }
    >
      {error ? <Banner tone="alert" message={error} /> : null}
      <Pill label={getProjectOptionLabel(PROJECT_STATUS_OPTIONS, p.status) || "-"} tone="success" />

      {images.length ? (
        <Panel title={`Photos (${images.length})`}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
            {images.map((url, index) => (
              <Pressable key={`${url}-${index}`} onPress={() => setViewing(toAbsoluteUrl(url))} accessibilityLabel={`Photo ${index + 1}`}>
                <Image source={{ uri: toAbsoluteUrl(url) }} style={styles.photo} />
              </Pressable>
            ))}
          </ScrollView>
        </Panel>
      ) : null}

      <Panel title="Basic Information">
        <KeyValue label="Category" value={getProjectOptionLabel(PROJECT_CATEGORY_OPTIONS, p.projectCategory)} />
        {!commercial ? <KeyValue label="Type" value={getProjectOptionLabel(PROJECT_TYPE_OPTIONS, p.projectType)} /> : null}
        <KeyValue label="Total Land Area" value={p.totalLandArea} />
        {commercial ? (
          <>
            <KeyValue label="Total Floors" value={p.totalFloors} />
            <KeyValue label="Offices Per Floor" value={p.officesPerFloor} />
            <KeyValue label="Total Offices" value={p.totalOffices ?? p.offices?.length ?? 0} />
            <KeyValue label="Total Shops" value={p.totalShops ?? p.shops?.length ?? 0} />
            <KeyValue label="Total Showrooms" value={p.totalShowrooms ?? p.showrooms?.length ?? 0} />
          </>
        ) : null}
        {building ? (
          <>
            <KeyValue label="Number of Flats" value={p.numberOfFlats} />
            <KeyValue label="Number of Floors" value={p.numberOfFloors} />
            <KeyValue label="Flats Per Floor" value={p.flatsPerFloor} />
          </>
        ) : null}
        {plotBased ? (
          <>
            <KeyValue label="Total Plots" value={p.totalPlots} />
            <KeyValue label="Plots Available" value={p.plotsAvailable ?? 0} />
            <KeyValue
              label="Plot Size"
              value={p.plotSize === "CUSTOM" ? p.customPlotSize : getProjectOptionLabel(PROJECT_PLOT_SIZE_OPTIONS, p.plotSize)}
            />
          </>
        ) : null}
      </Panel>

      <Panel title="Pricing">
        <KeyValue label="PLC" value={p.plc} />
        <KeyValue label="Group" value={p.group} />
        <KeyValue label="Starting Rate" value={formatRate(p.startingRate)} />
        <KeyValue label="Current Rate" value={formatRate(p.currentRate)} />
        <KeyValue label="Other Charges" value={p.otherCharges} />
      </Panel>

      {!commercial ? (
        <Panel title="Housing Category">
          <KeyValue label="Housing Category" value={getProjectOptionLabel(PROJECT_HOUSING_CATEGORY_OPTIONS, p.housingCategory)} />
        </Panel>
      ) : null}

      <Panel title="Location">
        <KeyValue label="Complete Address" value={p.location} />
        {commercial ? (
          <>
            <KeyValue label="Landmark" value={p.landmark} />
            <KeyValue label="City" value={p.city} />
            <KeyValue label="State" value={p.state} />
            <KeyValue label="Pincode" value={p.pincode} />
            {p.siteLocation?.lat || p.siteLocation?.lng ? (
              <KeyValue label="Coordinates" value={`${p.siteLocation?.lat ?? "-"}, ${p.siteLocation?.lng ?? "-"}`} />
            ) : null}
          </>
        ) : null}
      </Panel>

      <Panel title="Owner / Manager">
        <KeyValue label="Name" value={p.ownerManagerName} />
        <KeyValue label="Mobile" value={p.ownerManagerMobile} mono />
      </Panel>
      <Panel title="Broker Manager">
        <KeyValue label="Name" value={p.brokerManagerName} />
        <KeyValue label="Mobile" value={p.brokerManagerMobile} mono />
      </Panel>
      <Panel title="Meta">
        <KeyValue label="Created By" value={p.createdBy?.name} />
      </Panel>

      {Array.isArray(p.amenities) && p.amenities.length ? (
        <Panel title="Amenities">
          <View style={styles.tags}>
            {p.amenities.map((amenity: string) => (
              <Text key={amenity} style={styles.tag}>{getProjectOptionLabel(amenityOptions, amenity)}</Text>
            ))}
          </View>
        </Panel>
      ) : null}

      {Array.isArray(p.bhkConfigurations) && p.bhkConfigurations.length ? (
        <Panel title="BHK Configurations">
          {p.bhkConfigurations.map((config: any) => (
            <View key={config.bhk} style={styles.unit}>
              <Text style={styles.unitCode}>{getProjectOptionLabel(PROJECT_BHK_OPTIONS, config.bhk)}</Text>
              <Text style={styles.unitMeta}>
                {[
                  `Size: ${config.size} sq.ft`,
                  `Beds: ${config.bedrooms}`,
                  `Kitchens: ${config.kitchens}`,
                  `Washrooms: ${config.washrooms}`,
                  `Drawing Rooms: ${config.drawingRooms}`,
                  `Balconies: ${config.balconies}`,
                  `Servant Room: ${config.servantRoom ? "Yes" : "No"}`,
                  `Parking: ${config.reservedParking}`,
                ].join("  ·  ")}
              </Text>
            </View>
          ))}
        </Panel>
      ) : null}

      {Array.isArray(p.offices) && p.offices.length ? (
        <Panel title={`Office Inventory (${p.offices.length})`}>
          {p.offices.map((office: any) => (
            <UnitCard
              key={office._id || office.officeCode}
              unit={office}
              codeField="officeCode"
              rows={[
                ["Floor", office.floorNumber],
                ["Carpet Area", office.carpetArea],
                ["Starting Rate", formatRate(office.startingRate)],
                ["Current Rate", formatRate(office.currentRate)],
              ]}
            />
          ))}
        </Panel>
      ) : null}
      {Array.isArray(p.shops) && p.shops.length ? (
        <Panel title={`Shop Inventory (${p.shops.length})`}>
          {p.shops.map((shop: any) => (
            <UnitCard
              key={shop._id || shop.shopCode}
              unit={shop}
              codeField="shopCode"
              rows={[
                ["Floor", shop.floorNumber],
                ["Carpet Area", shop.carpetArea],
                ["Starting Rate", formatRate(shop.startingRate)],
                ["Current Rate", formatRate(shop.currentRate)],
              ]}
            />
          ))}
        </Panel>
      ) : null}
      {Array.isArray(p.showrooms) && p.showrooms.length ? (
        <Panel title={`Showroom Inventory (${p.showrooms.length})`}>
          {p.showrooms.map((showroom: any) => (
            <UnitCard
              key={showroom._id || showroom.showroomCode}
              unit={showroom}
              codeField="showroomCode"
              rows={[
                ["Floor", showroom.floorNumber],
                ["Carpet Area", showroom.carpetArea],
                ["Starting Rate", formatRate(showroom.startingRate)],
                ["Current Rate", formatRate(showroom.currentRate)],
              ]}
            />
          ))}
        </Panel>
      ) : null}
      <Modal visible={Boolean(viewing)} transparent animationType="fade" onRequestClose={() => setViewing("")}>
        <Pressable style={styles.viewer} onPress={() => setViewing("")} accessibilityLabel="Close photo">
          {viewing ? <Image source={{ uri: viewing }} style={styles.viewerImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </BrandPage>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    photos: { gap: 8 },
    viewer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.92)" },
    viewerImage: { width: "100%", height: "80%" },
    photo: { width: 150, height: 110, borderRadius: round.field, backgroundColor: b.fieldMuted },
    tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    tag: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: round.pill,
      overflow: "hidden",
      backgroundColor: b.tint,
      fontSize: t.label,
      fontWeight: "600",
      color: b.deep,
    },
    unit: {
      gap: 4,
      padding: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
    },
    unitHead: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "space-between" },
    unitCode: { flexShrink: 1, fontSize: t.body, fontWeight: "700", color: b.text },
    unitMeta: { fontSize: t.label, lineHeight: 16, color: b.textSecondary },
  }),
);

export default ProjectDetailsScreen;
