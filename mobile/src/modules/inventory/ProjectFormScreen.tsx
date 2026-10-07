import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { Glyph } from "../../components/ui/Glyph";
import {
  FieldCol,
  FieldRow,
  SectionCard,
  Segmented,
  SelectField,
  TextField,
  Toggle,
} from "../../components/ui/form";
import { Banner, BrandButton, BrandPage, Chip, ChipRow, StatTile } from "../../components/brand/kit";
import { brand, brandStyles, round, type as t } from "../../theme/brand";
import { createProject, getProjectById, updateProject } from "../../services/projectService";
import { toAbsoluteUrl, uploadFile } from "../../services/uploadService";
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
  DEFAULT_BHK_CONFIG,
  DEFAULT_FORM,
  DEFAULT_OFFICE,
  DEFAULT_SHOP,
  DEFAULT_SHOWROOM,
  OFFICE_FIELDS,
  SHOP_FIELDS,
  SHOWROOM_FIELDS,
  SOLD_LIKE_UNIT_STATUSES,
  applyUnitField,
  buildProjectPayload,
  isBuildingType,
  isCommercialCategory,
  isPlotBasedType,
  makeUnitKey,
  newUnit,
  toFormFromProject,
  validateForm,
  type BhkConfig,
  type ProjectFormData,
  type Unit,
  type UnitField,
} from "./projectForm";

/*
 * Add / edit a project - web's project form modal, as a page.
 *
 * Every section web has, in web's order, and the same rules underneath:
 * projectForm.ts is a port of web's payload builder and validation, so a
 * project saved here is the record the desk would save. Commercial projects
 * carry office, shop and showroom inventory with web's add / duplicate /
 * delete per unit and its length x breadth carpet-area fill.
 */

type UnitGroup = "offices" | "shops" | "showrooms";

const UNIT_GROUPS: Array<{
  key: UnitGroup;
  title: string;
  label: string;
  codeField: string;
  prefix: string;
  defaults: Record<string, string>;
  fields: UnitField[];
}> = [
  { key: "offices", title: "Office Inventory", label: "Office", codeField: "officeCode", prefix: "OFF", defaults: DEFAULT_OFFICE, fields: OFFICE_FIELDS },
  { key: "shops", title: "Shop Inventory", label: "Shop", codeField: "shopCode", prefix: "SHOP", defaults: DEFAULT_SHOP, fields: SHOP_FIELDS },
  { key: "showrooms", title: "Showroom Inventory", label: "Showroom", codeField: "showroomCode", prefix: "SR", defaults: DEFAULT_SHOWROOM, fields: SHOWROOM_FIELDS },
];

const digits = (value: string) => value.replace(/[^\d.]/g, "");

export const ProjectFormScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const projectId = String(route.params?.projectId || "");
  const editing = Boolean(projectId);

  const [form, setForm] = useState<ProjectFormData>({ ...DEFAULT_FORM });
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const officesLength = useRef(form.offices.length);

  useEffect(() => {
    if (!editing) return;
    getProjectById(projectId)
      .then((project) => {
        if (project) setForm(toFormFromProject(project));
      })
      .catch((error) => setFormError(toErrorMessage(error, "Failed to load project for editing")))
      .finally(() => setLoading(false));
  }, [editing, projectId]);

  // Web keeps Total Offices in step with the office list, still editable after.
  useEffect(() => {
    if (officesLength.current === form.offices.length) return;
    officesLength.current = form.offices.length;
    setForm((prev) => ({ ...prev, totalOffices: String(prev.offices.length) }));
  }, [form.offices.length]);

  const set = <K extends keyof ProjectFormData>(key: K) => (value: ProjectFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const commercial = isCommercialCategory(form.projectCategory);
  const plotBased = !commercial && isPlotBasedType(form.projectType);
  const building = !commercial && isBuildingType(form.projectType);
  const floorOptions = Array.from({ length: Number(form.totalFloors) || 0 }, (_, i) => ({
    label: String(i + 1),
    value: String(i + 1),
  }));
  const allUnits = [...form.offices, ...form.shops, ...form.showrooms];

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  const toggleBhk = (bhk: string) =>
    setForm((prev) => ({
      ...prev,
      bhkConfigurations: prev.bhkConfigurations.some((config) => config.bhk === bhk)
        ? prev.bhkConfigurations.filter((config) => config.bhk !== bhk)
        : [...prev.bhkConfigurations, { ...DEFAULT_BHK_CONFIG, bhk }],
    }));

  const setBhkField = (bhk: string, field: keyof BhkConfig, value: string | boolean) =>
    setForm((prev) => ({
      ...prev,
      bhkConfigurations: prev.bhkConfigurations.map((config) => (config.bhk === bhk ? { ...config, [field]: value } : config)),
    }));

  const addUnit = (group: (typeof UNIT_GROUPS)[number]) =>
    setForm((prev) => ({
      ...prev,
      [group.key]: [...prev[group.key], newUnit(group.defaults, group.prefix, group.codeField, prev[group.key].length + 1)],
    }));

  const duplicateUnit = (groupKey: UnitGroup, unitKey: string) =>
    setForm((prev) => {
      const index = prev[groupKey].findIndex((unit) => unit._key === unitKey);
      if (index < 0) return prev;
      const next = [...prev[groupKey]];
      next.splice(index + 1, 0, { ...prev[groupKey][index], _key: makeUnitKey() });
      return { ...prev, [groupKey]: next };
    });

  const removeUnit = (groupKey: UnitGroup, unitKey: string) =>
    setForm((prev) => ({ ...prev, [groupKey]: prev[groupKey].filter((unit) => unit._key !== unitKey) }));

  const setUnitField = (groupKey: UnitGroup, unitKey: string, field: string, value: string) =>
    setForm((prev) => ({
      ...prev,
      [groupKey]: prev[groupKey].map((unit) => (unit._key === unitKey ? applyUnitField(unit, field, value) : unit)),
    }));

  const toggleCollapse = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const uploadImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFormError("Photo library permission is required to add project images.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 0.8 });
    if (picked.canceled || !picked.assets?.length) return;

    setUploading(true);
    const urls: string[] = [];
    const failed: string[] = [];
    for (const asset of picked.assets) {
      const name = asset.fileName || `project-${Date.now()}.jpg`;
      try {
        const result = await uploadFile(
          { uri: asset.uri, name, mimeType: asset.mimeType || "image/jpeg", size: Number(asset.fileSize || 0) },
          "project-images",
        );
        urls.push(result.url);
      } catch (error) {
        failed.push(`${name}: ${toErrorMessage(error, "unknown error")}`);
      }
    }
    if (urls.length) setForm((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
    if (failed.length) setFormError(`Failed to upload: ${failed.join(", ")}`);
    setUploading(false);
  };

  const submit = async () => {
    const validation = validateForm(form);
    if (validation) {
      setFormError(validation);
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = buildProjectPayload(form);
      if (editing) await updateProject(projectId, payload);
      else await createProject(payload);
      navigation.goBack();
    } catch (error) {
      setFormError(toErrorMessage(error, "Failed to save project"));
    } finally {
      setSaving(false);
    }
  };

  const renderUnit = (group: (typeof UNIT_GROUPS)[number], unit: Unit) => {
    const isCollapsed = collapsed.has(unit._key);
    return (
      <View key={unit._key} style={styles.unit}>
        <View style={styles.unitHead}>
          <Pressable style={styles.unitToggle} onPress={() => toggleCollapse(unit._key)} accessibilityRole="button">
            <Glyph name={isCollapsed ? "chevron-down" : "chevron-up"} size={15} color={brand.textMuted} />
            <Text style={styles.unitCode} numberOfLines={1}>{unit[group.codeField] || group.label}</Text>
            <Text style={styles.unitStatus}>{getProjectOptionLabel(PROJECT_UNIT_STATUS_OPTIONS, unit.status)}</Text>
          </Pressable>
          <Pressable style={styles.unitBtn} onPress={() => duplicateUnit(group.key, unit._key)} accessibilityLabel="Duplicate">
            <Glyph name="copy-outline" size={15} color={brand.textSecondary} />
          </Pressable>
          <Pressable style={[styles.unitBtn, styles.unitBtnDanger]} onPress={() => removeUnit(group.key, unit._key)} accessibilityLabel="Delete">
            <Glyph name="trash-outline" size={15} color={brand.alertInk} />
          </Pressable>
        </View>
        {!isCollapsed ? (
          <View style={styles.unitBody}>
            <TextField
              label={`${group.label} Number / Code`}
              value={unit[group.codeField] || ""}
              onChangeText={(value) => setUnitField(group.key, unit._key, group.codeField, value)}
            />
            {group.fields.map((field) =>
              field.type === "select" ? (
                <SelectField
                  key={field.key}
                  label={field.label}
                  value={unit[field.key] || ""}
                  options={field.options || []}
                  onChange={(value) => setUnitField(group.key, unit._key, field.key, value)}
                />
              ) : field.type === "floor" ? (
                <SelectField
                  key={field.key}
                  label={field.label}
                  value={unit.floorNumber || ""}
                  options={floorOptions}
                  placeholder={floorOptions.length ? "Select floor" : "Set Total Floors first"}
                  onChange={(value) => setUnitField(group.key, unit._key, "floorNumber", value)}
                />
              ) : (
                <TextField
                  key={field.key}
                  label={field.label}
                  value={unit[field.key] || ""}
                  placeholder={field.placeholder}
                  keyboardType={field.type === "number" ? "decimal-pad" : undefined}
                  multiline={field.type === "textarea"}
                  onChangeText={(value) =>
                    setUnitField(group.key, unit._key, field.key, field.type === "number" ? digits(value) : value)}
                />
              ),
            )}
          </View>
        ) : null}
      </View>
    );
  };

  if (loading) {
    return <BrandPage title={editing ? "Edit Project" : "Add Project"} onBack={() => navigation.goBack()} loading />;
  }

  return (
    <BrandPage
      title={editing ? "Edit Project" : "Add Project"}
      subtitle="Plotting, building, villa / farmhouse or commercial"
      onBack={() => navigation.goBack()}
      footer={
        <BrandButton
          title={saving ? "Saving…" : editing ? "Update Project" : "Create Project"}
          icon="checkmark"
          loading={saving}
          disabled={saving || uploading}
          onPress={submit}
        />
      }
    >
      {formError ? <Banner tone="alert" message={formError} action="Dismiss" onAction={() => setFormError("")} /> : null}

      <SectionCard title="Basic Information">
        <Text style={styles.label}>Project Category *</Text>
        <Segmented
          options={PROJECT_CATEGORY_OPTIONS}
          value={form.projectCategory}
          onChange={(value) => setForm((prev) => ({ ...prev, projectCategory: value, projectType: "" }))}
        />
        <View style={styles.gap} />
        {!commercial && form.projectCategory ? (
          <SelectField label="Project Type" required value={form.projectType} options={PROJECT_TYPE_OPTIONS} onChange={set("projectType")} />
        ) : null}
        <TextField label="Project Name" required value={form.projectName} onChangeText={set("projectName")} placeholder="e.g. Sunrise Meadows" />
        <TextField label="Total Land Area" required value={form.totalLandArea} onChangeText={set("totalLandArea")} placeholder="Example: 20 Acres" />

        {commercial ? (
          <>
            <FieldRow>
              <FieldCol>
                <TextField label="Total Floors" required value={form.totalFloors} onChangeText={(v) => set("totalFloors")(digits(v))} keyboardType="number-pad" />
              </FieldCol>
              <FieldCol>
                <TextField label="Offices Per Floor" required value={form.officesPerFloor} onChangeText={(v) => set("officesPerFloor")(digits(v))} keyboardType="number-pad" />
              </FieldCol>
            </FieldRow>
            <TextField
              label="Total Offices"
              value={form.totalOffices}
              onChangeText={(v) => set("totalOffices")(digits(v))}
              keyboardType="number-pad"
              placeholder="Auto-calculated from Office Inventory"
            />
            <FieldRow>
              <FieldCol>
                <TextField label="Total Shops" value={form.totalShops} onChangeText={(v) => set("totalShops")(digits(v))} keyboardType="number-pad" />
              </FieldCol>
              <FieldCol>
                <TextField label="Total Showrooms" value={form.totalShowrooms} onChangeText={(v) => set("totalShowrooms")(digits(v))} keyboardType="number-pad" />
              </FieldCol>
            </FieldRow>
          </>
        ) : null}

        {building ? (
          <>
            <TextField label="Number of Flats" required value={form.numberOfFlats} onChangeText={(v) => set("numberOfFlats")(digits(v))} keyboardType="number-pad" />
            <FieldRow>
              <FieldCol>
                <TextField label="Number of Floors" required value={form.numberOfFloors} onChangeText={(v) => set("numberOfFloors")(digits(v))} keyboardType="number-pad" />
              </FieldCol>
              <FieldCol>
                <TextField label="Flats Per Floor" required value={form.flatsPerFloor} onChangeText={(v) => set("flatsPerFloor")(digits(v))} keyboardType="number-pad" />
              </FieldCol>
            </FieldRow>
          </>
        ) : null}

        {plotBased ? (
          <>
            <TextField label="Number of Plots" required value={form.totalPlots} onChangeText={(v) => set("totalPlots")(digits(v))} keyboardType="number-pad" />
            <SelectField label="Plot Size" value={form.plotSize} options={PROJECT_PLOT_SIZE_OPTIONS} onChange={set("plotSize")} />
            {form.plotSize === "CUSTOM" ? (
              <TextField label="Custom Plot Size" value={form.customPlotSize} onChangeText={set("customPlotSize")} placeholder="1350 Sq.ft" />
            ) : null}
          </>
        ) : null}
      </SectionCard>

      {commercial ? (
        <>
          <SectionCard title="Summary">
            <View style={styles.statGrid}>
              <StatTile label="Total Floors" value={form.totalFloors || 0} />
              <StatTile label="Total Offices" value={form.offices.length} />
              <StatTile label="Total Shops" value={form.shops.length} />
            </View>
            <View style={[styles.statGrid, styles.gapTop]}>
              <StatTile label="Total Showrooms" value={form.showrooms.length} />
              <StatTile label="Available Units" value={allUnits.filter((unit) => unit.status === "AVAILABLE").length} />
              <StatTile label="Sold / Leased" value={allUnits.filter((unit) => SOLD_LIKE_UNIT_STATUSES.has(unit.status)).length} />
            </View>
          </SectionCard>
          {UNIT_GROUPS.map((group) => (
            <SectionCard key={group.key} title={group.title} subtitle={`${form[group.key].length} added`}>
              {form[group.key].map((unit) => renderUnit(group, unit))}
              <BrandButton title={`Add ${group.label}`} icon="add" size="sm" variant="secondary" onPress={() => addUnit(group)} />
            </SectionCard>
          ))}
        </>
      ) : null}

      {building ? (
        <SectionCard title="Flat Configuration">
          <Text style={styles.label}>BHK Configuration *</Text>
          <ChipRow wrap>
            {PROJECT_BHK_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                active={form.bhkConfigurations.some((config) => config.bhk === option.value)}
                onPress={() => toggleBhk(option.value)}
              />
            ))}
          </ChipRow>
          {form.bhkConfigurations.map((config) => (
            <View key={config.bhk} style={styles.unit}>
              <Text style={styles.unitCode}>{getProjectOptionLabel(PROJECT_BHK_OPTIONS, config.bhk)}</Text>
              <View style={styles.unitBody}>
                <TextField label="Flat Size (Sq.ft)" required value={config.size} placeholder="1250" keyboardType="decimal-pad" onChangeText={(v) => setBhkField(config.bhk, "size", digits(v))} />
                <FieldRow>
                  <FieldCol>
                    <TextField label="Bedrooms" value={config.bedrooms} keyboardType="number-pad" onChangeText={(v) => setBhkField(config.bhk, "bedrooms", digits(v))} />
                  </FieldCol>
                  <FieldCol>
                    <TextField label="Kitchens" value={config.kitchens} keyboardType="number-pad" onChangeText={(v) => setBhkField(config.bhk, "kitchens", digits(v))} />
                  </FieldCol>
                </FieldRow>
                <FieldRow>
                  <FieldCol>
                    <TextField label="Washrooms" value={config.washrooms} keyboardType="number-pad" onChangeText={(v) => setBhkField(config.bhk, "washrooms", digits(v))} />
                  </FieldCol>
                  <FieldCol>
                    <TextField label="Drawing / Living Rooms" value={config.drawingRooms} keyboardType="number-pad" onChangeText={(v) => setBhkField(config.bhk, "drawingRooms", digits(v))} />
                  </FieldCol>
                </FieldRow>
                <FieldRow>
                  <FieldCol>
                    <TextField label="Balconies" value={config.balconies} keyboardType="number-pad" onChangeText={(v) => setBhkField(config.bhk, "balconies", digits(v))} />
                  </FieldCol>
                  <FieldCol>
                    <TextField label="Reserved Parking" value={config.reservedParking} placeholder="2" keyboardType="number-pad" onChangeText={(v) => setBhkField(config.bhk, "reservedParking", digits(v))} />
                  </FieldCol>
                </FieldRow>
                <Toggle label="Servant Room" value={config.servantRoom} onValueChange={(value) => setBhkField(config.bhk, "servantRoom", value)} />
              </View>
            </View>
          ))}
        </SectionCard>
      ) : null}

      <SectionCard title="Pricing">
        <TextField label="PLC (Preferential Location Charges)" value={form.plc} onChangeText={set("plc")} placeholder="e.g. 5% or ₹50,000" />
        <TextField label="Group" value={form.group} onChangeText={set("group")} placeholder="e.g. Group A, Premium" />
        <FieldRow>
          <FieldCol>
            <TextField label="Starting Rate Per Sq.ft" required value={form.startingRate} onChangeText={(v) => set("startingRate")(digits(v))} placeholder="₹1500" keyboardType="decimal-pad" />
          </FieldCol>
          <FieldCol>
            <TextField label="Current Rate Per Sq.ft" required value={form.currentRate} onChangeText={(v) => set("currentRate")(digits(v))} placeholder="₹1800" keyboardType="decimal-pad" />
          </FieldCol>
        </FieldRow>
        <TextField
          label="Other Charges"
          value={form.otherCharges}
          onChangeText={set("otherCharges")}
          placeholder="Maintenance, Electricity, Water Connection, Registry, Club Charges"
          multiline
        />
      </SectionCard>

      <SectionCard title="Project Status">
        <ChipRow wrap>
          {PROJECT_STATUS_OPTIONS.map((option) => (
            <Chip key={option.value} label={option.label} active={form.status === option.value} onPress={() => set("status")(option.value)} />
          ))}
        </ChipRow>
      </SectionCard>

      <SectionCard title="Amenities">
        <ChipRow wrap>
          {(commercial ? PROJECT_COMMERCIAL_AMENITY_OPTIONS : PROJECT_AMENITY_OPTIONS).map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              icon={form.amenities.includes(option.value) ? "checkmark" : undefined}
              active={form.amenities.includes(option.value)}
              onPress={() => set("amenities")(toggleIn(form.amenities, option.value))}
            />
          ))}
        </ChipRow>
      </SectionCard>

      {!commercial ? (
        <SectionCard title="Housing Category">
          <SelectField value={form.housingCategory} options={PROJECT_HOUSING_CATEGORY_OPTIONS} onChange={set("housingCategory")} placeholder="Select housing category" />
        </SectionCard>
      ) : null}

      <SectionCard title="Location">
        <TextField label="Complete Address" value={form.location} onChangeText={set("location")} placeholder="Complete address" multiline />
        {commercial ? (
          <>
            <TextField label="Landmark" value={form.landmark} onChangeText={set("landmark")} />
            <FieldRow>
              <FieldCol>
                <TextField label="City" value={form.city} onChangeText={set("city")} />
              </FieldCol>
              <FieldCol>
                <TextField label="State" value={form.state} onChangeText={set("state")} />
              </FieldCol>
            </FieldRow>
            <TextField label="Pincode" value={form.pincode} onChangeText={(v) => set("pincode")(v.replace(/\D/g, ""))} keyboardType="number-pad" />
            <FieldRow>
              <FieldCol>
                <TextField label="Latitude (Optional)" value={form.locationLat} onChangeText={set("locationLat")} keyboardType="numbers-and-punctuation" />
              </FieldCol>
              <FieldCol>
                <TextField label="Longitude (Optional)" value={form.locationLng} onChangeText={set("locationLng")} keyboardType="numbers-and-punctuation" />
              </FieldCol>
            </FieldRow>
          </>
        ) : null}
      </SectionCard>

      <SectionCard title="Owner / Manager">
        <TextField label="Owner / Manager Name" value={form.ownerManagerName} onChangeText={set("ownerManagerName")} />
        <TextField label="Owner / Manager Mobile" value={form.ownerManagerMobile} onChangeText={(v) => set("ownerManagerMobile")(v.replace(/\D/g, ""))} placeholder="e.g. 9876543210" keyboardType="phone-pad" />
      </SectionCard>

      <SectionCard title="Broker Manager">
        <TextField label="Broker Manager Name" value={form.brokerManagerName} onChangeText={set("brokerManagerName")} />
        <TextField label="Broker Manager Mobile" value={form.brokerManagerMobile} onChangeText={(v) => set("brokerManagerMobile")(v.replace(/\D/g, ""))} placeholder="e.g. 9876543210" keyboardType="phone-pad" />
      </SectionCard>

      {plotBased ? (
        <SectionCard title="Inventory">
          <TextField label="Plots Available With Us" value={form.plotsAvailable} onChangeText={(v) => set("plotsAvailable")(digits(v))} keyboardType="number-pad" />
        </SectionCard>
      ) : null}

      <SectionCard title="Project Media" subtitle={`${form.images.length} photo${form.images.length === 1 ? "" : "s"}`}>
        <View style={styles.media}>
          {form.images.map((url) => (
            <View key={url} style={styles.thumbWrap}>
              <Image source={{ uri: toAbsoluteUrl(url) }} style={styles.thumb} />
              <Pressable
                style={styles.thumbRemove}
                onPress={() => set("images")(form.images.filter((item) => item !== url))}
                accessibilityLabel="Remove photo"
              >
                <Glyph name="close" size={13} color={brand.onPrimary} />
              </Pressable>
            </View>
          ))}
          <Pressable style={[styles.thumb, styles.addThumb]} onPress={uploadImages} disabled={uploading} accessibilityRole="button" accessibilityLabel="Upload images">
            {uploading ? <ActivityIndicator color={brand.primary} /> : <Glyph name="cloud-upload-outline" size={22} color={brand.primary} />}
            <Text style={styles.addText}>{uploading ? "Uploading" : "Upload"}</Text>
          </Pressable>
        </View>
      </SectionCard>
    </BrandPage>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    label: { marginBottom: 8, fontSize: t.fieldLabel, fontWeight: "500", color: b.text },
    gap: { height: 14 },
    gapTop: { marginTop: 8 },
    statGrid: { flexDirection: "row", gap: 8 },
    unit: { marginBottom: 10, borderWidth: 1, borderColor: b.border, borderRadius: round.field, backgroundColor: b.surface },
    unitHead: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10 },
    unitToggle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7 },
    unitCode: { flexShrink: 1, fontSize: t.body, fontWeight: "700", color: b.text, padding: 0 },
    unitStatus: {
      paddingHorizontal: 7,
      paddingVertical: 1,
      borderRadius: round.pill,
      borderWidth: 1,
      borderColor: b.border,
      fontSize: 9.5,
      fontWeight: "800",
      letterSpacing: 0.5,
      color: b.textMuted,
    },
    unitBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: b.border },
    unitBtnDanger: { borderColor: b.alertChip },
    unitBody: { paddingHorizontal: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: b.hairline },
    media: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    thumbWrap: { position: "relative" },
    thumb: { width: 92, height: 92, borderRadius: round.field, backgroundColor: b.fieldMuted },
    thumbRemove: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    addThumb: {
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: b.primary,
      backgroundColor: b.uploadTint,
    },
    addText: { fontSize: t.label, fontWeight: "600", color: b.primary },
  }),
);

export default ProjectFormScreen;
