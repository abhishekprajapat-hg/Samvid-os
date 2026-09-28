import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Glyph } from "../../components/ui/Glyph";
import { FieldCol, FieldRow, SectionCard, SelectField, TextField, Toggle } from "../../components/ui/form";
import { Banner, BrandButton, BrandPage, Chip, ChipRow } from "../../components/brand/kit";
import { brand, brandStyles, round, type as t } from "../../theme/brand";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionContext";
import {
  createInventoryAsset,
  getInventoryAssetById,
  requestInventoryUpdate,
  updateInventoryAsset,
} from "../../services/inventoryService";
import { toAbsoluteUrl, uploadFile, type UploadCategory } from "../../services/uploadService";
import { geocodeAddress, resolvePlace, usesGooglePlaces, type PlaceSuggestion } from "../../services/placeSearch";
import { PlaceSuggestionList, usePlaceSuggestions } from "../../components/common/PlaceSuggestions";
import { SubtypeFieldsEditor } from "../../components/common/SubtypeFieldsEditor";
import { toErrorMessage } from "../../utils/errorMessage";
import { getAttendanceLocation } from "../../utils/location";
import {
  FURNISHING_OPTIONS,
  getInventorySubtypeConfig,
  getInventorySubtypeOptions,
} from "../../config/propertyRequirementConfig";
import { resolveInventoryAccess } from "./inventoryAccess";
import { withSubtypeField } from "../leads/leadRequirements";
import {
  DEAL_OPTIONS,
  DOCUMENT_CHECKS,
  OFFICE_UNFURNISHED_VISIBLE_FIELD_KEYS,
  OWNERSHIP_OPTIONS,
  UNFURNISHED_LIKE_STATUSES,
  defaultInventoryFormFor,
  getInventorySubtypeValue,
  isInventoryPriceRequired,
  isInventoryRentRequired,
  prepareInventorySave,
  toInventoryForm,
  toNumberOrNull,
  withDealType,
  withDimension,
  withInventoryType,
  withSubtype,
  type InventoryForm,
} from "./inventoryForm";

/*
 * Web's property form, whole - used to edit any property and reachable from
 * the add wizard for the fields its four steps leave out.
 *
 * Same sections, same order, same rules as web's AssetVault dialog (see
 * ./inventoryForm.ts): inventory details, the subtype and its preferences,
 * price, location, documents available, owner, key manager, deal date and
 * media. An edit by someone who may not edit directly is sent for approval, as
 * on web. When the address changes on an edit and the pin has not moved, the
 * new address is looked up before saving, as web does, so the map never shows
 * the old place under a new name.
 */

type Picked = { uri: string; name: string; mimeType: string; size?: number };
type MediaKey = "images" | "floorPlans" | "documents";

const MEDIA: Array<{ key: MediaKey; label: string; category: UploadCategory; images: boolean }> = [
  { key: "images", label: "Property Images", category: "inventory-images", images: true },
  { key: "floorPlans", label: "Floor Plans", category: "inventory-floorplans", images: false },
  { key: "documents", label: "Documents", category: "inventory-documents", images: false },
];

const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);
const fileLabel = (url: string, index: number) => decodeURIComponent(String(url).split("?")[0].split("/").pop() || `File ${index + 1}`);

export const PropertyFormScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const assetId = String(route.params?.assetId || "");
  const isEdit = Boolean(assetId);
  const { role, user } = useAuth();
  const { canPageAction, enforcePageAccess } = usePermissions();
  const access = useMemo(
    () => resolveInventoryAccess({ role: String(role || "").toUpperCase(), enforcePageAccess, canPageAction }),
    [role, enforcePageAccess, canPageAction],
  );
  const userRoleType = String((user as any)?.roleType || "").toUpperCase();
  const canChooseInventoryRoleType = String(role || "").toUpperCase() === "ADMIN" || userRoleType === "BOTH";

  const [form, setForm] = useState<InventoryForm>(() => defaultInventoryFormFor(userRoleType));
  const [baseline, setBaseline] = useState({ location: "", lat: "", lng: "" });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<MediaKey | "">("");
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const set = useCallback((key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value })), []);

  useEffect(() => {
    if (!isEdit) return;
    let alive = true;
    (async () => {
      try {
        const detail = await getInventoryAssetById(assetId);
        const full = (detail?.asset as any) || detail?.inventory || null;
        if (!full) throw new Error("Property not found");
        const next = toInventoryForm(full);
        if (!alive) return;
        setForm(next);
        setBaseline({ location: next.location, lat: next.locationLat, lng: next.locationLng });
      } catch (e) {
        if (alive) setError(toErrorMessage(e, "Failed to load the property"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [assetId, isEdit]);

  const subtype = getInventorySubtypeValue(form);
  const subtypeOptions = getInventorySubtypeOptions(form.inventoryType);
  const subtypeConfig = getInventorySubtypeConfig(form.inventoryType, subtype);
  const isLandOnly = ["PLOT", "FARM_HOUSE"].includes(subtype);
  const isUnfurnishedOffice = subtype === "OFFICE" && UNFURNISHED_LIKE_STATUSES.includes(String(form.furnishingStatus || "").toUpperCase());
  const furnishingOptions = (subtypeConfig as any)?.showFurnishing === false ? [] : FURNISHING_OPTIONS.filter((option) => option.value);

  const places = usePlaceSuggestions(form.location, { enabled: !loading });

  const pickPlace = async (suggestion: PlaceSuggestion) => {
    places.markChosen(suggestion.label);
    set("location", suggestion.label);
    setResolving(true);
    setError("");
    try {
      const resolved = await resolvePlace(suggestion);
      if (!resolved || resolved.lat === undefined || resolved.lng === undefined) {
        setError("Unable to resolve selected location coordinates");
        return;
      }
      places.markChosen(resolved.label);
      setForm((prev) => ({ ...prev, location: resolved.label, locationLat: String(resolved.lat), locationLng: String(resolved.lng) }));
      setNote("Location selected and coordinates auto-filled");
    } finally {
      setResolving(false);
    }
  };

  const getLatLng = async () => {
    const query = form.location.trim();
    if (!query || resolving) return;
    setResolving(true);
    setError("");
    try {
      const resolved = await geocodeAddress(query);
      if (!resolved) {
        setError("Location not found. Try entering full address");
        return;
      }
      places.clear();
      setForm((prev) => ({ ...prev, location: resolved.query, locationLat: String(resolved.lat), locationLng: String(resolved.lng) }));
      setNote("Coordinates auto-filled from location");
    } catch (e) {
      setError(toErrorMessage(e, "Unable to fetch coordinates"));
    } finally {
      setResolving(false);
    }
  };

  const useMyPosition = async () => {
    setResolving(true);
    try {
      const result = await getAttendanceLocation();
      if (result.ok && result.location) {
        setForm((prev) => ({ ...prev, locationLat: String(result.location!.latitude), locationLng: String(result.location!.longitude) }));
        setNote("Location pinned from your current position");
      } else {
        setError(result.ok ? "Could not read a position" : result.message);
      }
    } finally {
      setResolving(false);
    }
  };

  const addMedia = async (key: MediaKey, category: UploadCategory, imagesOnly: boolean) => {
    try {
      let picked: Picked[] = [];
      if (imagesOnly) {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setError("Media permission is required to upload photos");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: true,
          quality: 0.85,
          selectionLimit: 10,
        });
        if (result.canceled) return;
        picked = (result.assets || []).map((asset, index) => ({
          uri: asset.uri,
          name: asset.fileName || `photo-${Date.now()}-${index + 1}.jpg`,
          mimeType: asset.mimeType || "image/jpeg",
          size: asset.fileSize,
        }));
      } else {
        const result = await DocumentPicker.getDocumentAsync({ multiple: true, type: ["image/*", "application/pdf"], copyToCacheDirectory: true });
        if (result.canceled) return;
        picked = (result.assets || []).map((asset, index) => ({
          uri: asset.uri,
          name: asset.name || `file-${Date.now()}-${index + 1}`,
          mimeType: asset.mimeType || "application/octet-stream",
          size: asset.size,
        }));
      }
      if (!picked.length) return;
      setUploading(key);
      setError("");
      const urls: string[] = [];
      for (const file of picked) {
        const uploaded = await uploadFile(file, category);
        if (uploaded.url) urls.push(uploaded.url);
      }
      setForm((prev) => ({ ...prev, [key]: [...new Set([...(prev[key] as string[]), ...urls])] }));
    } catch (e) {
      setError(toErrorMessage(e, "Upload failed"));
    } finally {
      setUploading("");
    }
  };

  const removeMedia = (key: MediaKey, url: string) =>
    setForm((prev) => ({ ...prev, [key]: (prev[key] as string[]).filter((row) => row !== url) }));

  const save = async () => {
    if (saving) return;
    setError("");
    setNote("");
    let working = form;

    /* Web's edit rule: a moved address with an unmoved pin is looked up. */
    if (isEdit) {
      const locationChanged = form.location.trim() !== baseline.location.trim();
      const lat = toNumberOrNull(form.locationLat);
      const lng = toNumberOrNull(form.locationLng);
      const unchanged = lat === toNumberOrNull(baseline.lat) && lng === toNumberOrNull(baseline.lng);
      if (locationChanged && (lat === null || lng === null || unchanged)) {
        setResolving(true);
        try {
          const resolved = await geocodeAddress(form.location.trim());
          if (!resolved) {
            setError("Location changed but coordinates could not be resolved. Use Get Lat/Lng or enter coordinates manually.");
            return;
          }
          working = { ...form, location: resolved.query, locationLat: String(resolved.lat), locationLng: String(resolved.lng) };
          setForm(working);
        } catch (e) {
          setError(toErrorMessage(e, "Unable to fetch coordinates"));
          return;
        } finally {
          setResolving(false);
        }
      }
    }

    const prepared = prepareInventorySave(working);
    if ("error" in prepared && prepared.error) {
      setError(prepared.error);
      return;
    }
    const payload = (prepared as { payload: Record<string, unknown> }).payload;

    setSaving(true);
    try {
      if (!isEdit) {
        const created = await createInventoryAsset(payload as never);
        const id = String((created as any)?._id || "");
        if (id) navigation.replace("InventoryDetails", { assetId: id });
        else navigation.goBack();
        return;
      }
      if (access.canManage) {
        await updateInventoryAsset(assetId, payload as never);
        navigation.goBack();
      } else {
        await requestInventoryUpdate(assetId, payload, `Inventory edit requested by ${String(role || "USER").replace(/_/g, " ")}`);
        setNote("Edit request submitted for admin approval");
        setTimeout(() => navigation.goBack(), 900);
      }
    } catch (e) {
      setError(toErrorMessage(e, isEdit ? "Failed to update asset" : "Failed to save asset"));
    } finally {
      setSaving(false);
    }
  };

  const allowed = isEdit ? access.canOpenEditModal : access.canCreateInventory;
  if (!allowed) {
    return (
      <BrandPage title={isEdit ? "Edit property" : "Add property"} onBack={() => navigation.goBack()}>
        <Banner tone="warn" title="Not available" message="Your role cannot change inventory." />
      </BrandPage>
    );
  }

  return (
    <BrandPage
      title={isEdit ? "Edit property" : "Add property"}
      subtitle={isEdit ? (access.canManage ? "Changes save straight away" : "Changes go to an admin for approval") : "Full property form"}
      onBack={() => navigation.goBack()}
      loading={loading}
      footer={
        <BrandButton
          title={saving ? "Saving…" : isEdit ? (access.canManage ? "Save changes" : "Send for approval") : "Add property"}
          onPress={save}
          loading={saving || resolving}
          disabled={saving || Boolean(uploading)}
        />
      }
    >
      {error ? <Banner tone="alert" title="Could not save" message={error} style={styles.banner} /> : null}
      {note ? <Banner tone="success" title={note} style={styles.banner} /> : null}

      <SectionCard title="Inventory Details">
        <FieldLabelText text="Inventory type" />
        <ChipRow wrap>
          {[
            { value: "COMMERCIAL", label: "Commercial" },
            { value: "RESIDENTIAL", label: "Residential" },
          ]
            .filter((option) => canChooseInventoryRoleType || option.value === (userRoleType === "RESIDENTIAL" ? "RESIDENTIAL" : "COMMERCIAL") || option.value === form.inventoryType)
            .map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                active={form.inventoryType === option.value}
                onPress={() => (canChooseInventoryRoleType ? setForm((prev) => withInventoryType(prev, option.value)) : undefined)}
              />
            ))}
        </ChipRow>
        <FieldLabelText text="Rent or sale" />
        <ChipRow wrap>
          {DEAL_OPTIONS.map((option) => (
            <Chip key={option.value} label={option.label} active={form.type === option.value} onPress={() => setForm((prev) => withDealType(prev, option.value))} />
          ))}
        </ChipRow>
        <TextField label="Property ID" value={form.propertyId} placeholder="Auto-generated on save" editable={false} />
        <TextField label="Property / Project Name" required value={form.title} onChangeText={(v) => set("title", v)} placeholder="e.g. Sunset Villa 402" />
      </SectionCard>

      <SectionCard title="Inventory Requirement" style={styles.gap}>
        <SelectField
          label={form.inventoryType === "COMMERCIAL" ? "Commercial Property Type" : "Residential Property Type"}
          value={subtype}
          options={[{ value: "", label: "Property Type" }, ...subtypeOptions]}
          onChange={(next) => {
            const nextConfig = getInventorySubtypeConfig(form.inventoryType, next) as any;
            setForm((prev) => withSubtype(prev, next, nextConfig?.showFurnishing !== false));
          }}
        />
        {furnishingOptions.length ? (
          <SelectField
            label="Furnishing"
            value={String(form.furnishingStatus || "")}
            options={[{ value: "", label: "Select furnishing" }, ...furnishingOptions]}
            onChange={(next) => set("furnishingStatus", next)}
          />
        ) : null}
        {subtype === "OFFICE" ? (
          <TextField label="Office Number" value={form.officeNumber} onChangeText={(v) => set("officeNumber", v)} placeholder="e.g. 302-A" />
        ) : null}
        {isLandOnly ? null : (
          <>
            <TextField label="Building Name" value={form.buildingName} onChangeText={(v) => set("buildingName", v)} placeholder="DLF One Horizon" />
            <FieldRow>
              <FieldCol>
                <TextField label="Total Floors" value={form.totalFloors} onChangeText={(v) => set("totalFloors", v)} keyboardType="number-pad" placeholder="20" />
              </FieldCol>
              <FieldCol>
                <TextField label="Floor Number" value={form.floorNumber} onChangeText={(v) => set("floorNumber", v)} keyboardType="number-pad" placeholder="7" />
              </FieldCol>
            </FieldRow>
          </>
        )}
        <FieldRow>
          <FieldCol>
            <TextField label="Length" value={form.length} onChangeText={(v) => setForm((prev) => withDimension(prev, "length", v))} keyboardType="decimal-pad" placeholder="40" />
          </FieldCol>
          <FieldCol>
            <TextField label="Width" value={form.width} onChangeText={(v) => setForm((prev) => withDimension(prev, "width", v))} keyboardType="decimal-pad" placeholder="70" />
          </FieldCol>
          <FieldCol>
            <TextField label="Height" value={form.height} onChangeText={(v) => setForm((prev) => withDimension(prev, "height", v))} keyboardType="decimal-pad" placeholder="10" />
          </FieldCol>
        </FieldRow>
        <TextField label="Carpet Area" value={form.totalArea} onChangeText={(v) => set("totalArea", v)} keyboardType="decimal-pad" placeholder="2800" />
        {isLandOnly ? null : (
          <FieldRow>
            <FieldCol>
              <TextField label="Built-up Area" value={form.builtUpArea} onChangeText={(v) => set("builtUpArea", v)} keyboardType="decimal-pad" placeholder="2500" />
            </FieldCol>
            <FieldCol>
              <TextField label="Super Built-up" value={form.superBuiltUpArea} onChangeText={(v) => set("superBuiltUpArea", v)} keyboardType="decimal-pad" placeholder="2900" />
            </FieldCol>
          </FieldRow>
        )}
        <SubtypeFieldsEditor
          config={subtypeConfig}
          value={form.inventorySubtypeData}
          onChange={(key, value) => setForm((prev) => ({ ...prev, inventorySubtypeData: withSubtypeField(prev.inventorySubtypeData, key, value) }))}
          fieldFilter={(field) => !isUnfurnishedOffice || OFFICE_UNFURNISHED_VISIBLE_FIELD_KEYS.has(field.key)}
        />
      </SectionCard>

      <SectionCard title="Price" style={styles.gap}>
        {isInventoryPriceRequired(form.type) ? (
          <TextField label="Price (Rs)" required value={form.price} onChangeText={(v) => set("price", v)} keyboardType="decimal-pad" placeholder="12500000" />
        ) : null}
        {isInventoryRentRequired(form.type) ? (
          <FieldRow>
            <FieldCol>
              <TextField label="Rent (Rs)" required value={form.rent} onChangeText={(v) => set("rent", v)} keyboardType="decimal-pad" placeholder="85000" />
            </FieldCol>
            <FieldCol>
              <TextField label="Security Deposit (Rs)" value={form.deposit} onChangeText={(v) => set("deposit", v)} keyboardType="decimal-pad" placeholder="250000" />
            </FieldCol>
          </FieldRow>
        ) : null}
        <FieldRow>
          <FieldCol>
            <TextField label="Maintenance" value={form.maintenanceCharges} onChangeText={(v) => set("maintenanceCharges", v)} keyboardType="decimal-pad" placeholder="25000" />
          </FieldCol>
          <FieldCol>
            <TextField label="Deposit (Months)" value={form.depositMonths} onChangeText={(v) => set("depositMonths", v)} keyboardType="number-pad" placeholder="2" />
          </FieldCol>
        </FieldRow>
        <FieldRow>
          <FieldCol>
            <TextField label="Agreement (Years)" value={form.agreementYears} onChangeText={(v) => set("agreementYears", v)} keyboardType="number-pad" placeholder="3" />
          </FieldCol>
          <FieldCol>
            <TextField label="Lock-in (Years)" value={form.lockInYears} onChangeText={(v) => set("lockInYears", v)} keyboardType="number-pad" placeholder="1" />
          </FieldCol>
        </FieldRow>
        <Toggle value={Boolean(form.gstApplicable)} onValueChange={(v) => set("gstApplicable", v)} label="GST applicable" />
      </SectionCard>

      <SectionCard title="Location" style={styles.gap}>
        <TextField label="Location" required value={form.location} onChangeText={(v) => set("location", v)} placeholder="Sector 42" />
        <PlaceSuggestionList rows={places.rows} loading={places.loading} onPick={pickPlace} />
        <Text style={styles.hint}>
          {usesGooglePlaces()
            ? "Type an address for Google suggestions, or use Get Lat/Lng."
            : "Type an address for OpenStreetMap suggestions, or use Get Lat/Lng."}
        </Text>
        <View style={styles.actionRow}>
          <Pressable style={styles.softBtn} onPress={getLatLng} disabled={resolving || !form.location.trim()} accessibilityRole="button">
            {resolving ? <ActivityIndicator size="small" color={brand.deep} /> : <Glyph name="location" size={16} color={brand.deep} />}
            <Text style={styles.softBtnText}>Get Lat/Lng</Text>
          </Pressable>
          <Pressable style={styles.softBtn} onPress={useMyPosition} disabled={resolving} accessibilityRole="button">
            <Glyph name="navigate" size={16} color={brand.deep} />
            <Text style={styles.softBtnText}>My position</Text>
          </Pressable>
        </View>
        <FieldRow>
          <FieldCol>
            <TextField label="Latitude (Optional)" value={form.locationLat} onChangeText={(v) => set("locationLat", v)} keyboardType="numbers-and-punctuation" placeholder="28.4595" />
          </FieldCol>
          <FieldCol>
            <TextField label="Longitude (Optional)" value={form.locationLng} onChangeText={(v) => set("locationLng", v)} keyboardType="numbers-and-punctuation" placeholder="77.0266" />
          </FieldCol>
        </FieldRow>
        <FieldRow>
          <FieldCol>
            <TextField label="City" value={form.city} onChangeText={(v) => set("city", v)} placeholder="Gurugram" />
          </FieldCol>
          <FieldCol>
            <TextField label="Area" value={form.area} onChangeText={(v) => set("area", v)} placeholder="Golf Course Road" />
          </FieldCol>
        </FieldRow>
        <TextField label="Pincode" value={form.pincode} onChangeText={(v) => set("pincode", v)} keyboardType="number-pad" placeholder="122002" />
      </SectionCard>

      <SectionCard title="Documents Available" style={styles.gap}>
        <ChipRow wrap>
          {DOCUMENT_CHECKS.map(([key, label]) => {
            const on = Boolean(form.documentsAvailable?.[key]);
            return (
              <Chip
                key={key}
                label={label}
                active={on}
                icon={on ? "checkmark" : undefined}
                onPress={() => setForm((prev) => ({ ...prev, documentsAvailable: { ...prev.documentsAvailable, [key]: !on } }))}
              />
            );
          })}
        </ChipRow>
      </SectionCard>

      <SectionCard title="Owner Details" style={styles.gap}>
        <TextField label="Owner Name" value={form.ownerName} onChangeText={(v) => set("ownerName", v)} placeholder="Owner name" autoCapitalize="words" />
        <FieldRow>
          <FieldCol>
            <TextField label="Owner Number" value={form.ownerNumber} onChangeText={(v) => set("ownerNumber", v)} keyboardType="phone-pad" placeholder="e.g. 9876543210" />
          </FieldCol>
          <FieldCol>
            <TextField label="WhatsApp Number" value={form.ownerWhatsappNumber} onChangeText={(v) => set("ownerWhatsappNumber", v)} keyboardType="phone-pad" placeholder="e.g. 9876543210" />
          </FieldCol>
        </FieldRow>
        <SelectField
          label="Ownership"
          value={String(form.ownerType || "")}
          options={[{ value: "", label: "Select ownership" }, ...OWNERSHIP_OPTIONS]}
          onChange={(next) => set("ownerType", next)}
        />
      </SectionCard>

      <SectionCard title="Key Manager Details" style={styles.gap}>
        <FieldRow>
          <FieldCol>
            <TextField label="Key Manager Name" value={form.keyManagerName} onChangeText={(v) => set("keyManagerName", v)} placeholder="Key manager name" />
          </FieldCol>
          <FieldCol>
            <TextField label="Key Manager Number" value={form.keyManagerNumber} onChangeText={(v) => set("keyManagerNumber", v)} keyboardType="phone-pad" placeholder="e.g. 9876543210" />
          </FieldCol>
        </FieldRow>
      </SectionCard>

      <SectionCard title="Deal Details" style={styles.gap}>
        <TextField
          label="Property Date"
          value={form.propertyDate}
          onChangeText={(v) => set("propertyDate", v.trim())}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
        />
      </SectionCard>

      <SectionCard title="Inventory Media" style={styles.gap}>
        {MEDIA.map((media) => {
          const urls = (form[media.key] as string[]) || [];
          return (
            <View key={media.key} style={styles.mediaGroup}>
              <Text style={styles.mediaLabel}>{media.label}</Text>
              {urls.length ? (
                <View style={styles.mediaGrid}>
                  {urls.map((url, index) => (
                    <View key={`${url}-${index}`} style={styles.mediaTile}>
                      {isImageUrl(url) ? (
                        <Image source={{ uri: toAbsoluteUrl(url) }} style={styles.mediaThumb} />
                      ) : (
                        <View style={[styles.mediaThumb, styles.mediaDoc]}>
                          <Glyph name="document-text-outline" size={20} color={brand.textSecondary} />
                          <Text style={styles.mediaDocName} numberOfLines={2}>{fileLabel(url, index)}</Text>
                        </View>
                      )}
                      <Pressable style={styles.mediaRemove} onPress={() => removeMedia(media.key, url)} accessibilityRole="button" accessibilityLabel={`Remove ${media.label}`}>
                        <Glyph name="close" size={13} color="#ffffff" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              <Pressable
                style={styles.uploadBtn}
                onPress={() => addMedia(media.key, media.category, media.images)}
                disabled={Boolean(uploading)}
                accessibilityRole="button"
              >
                {uploading === media.key ? <ActivityIndicator size="small" color={brand.deep} /> : <Glyph name="cloud-upload-outline" size={18} color={brand.deep} />}
                <Text style={styles.softBtnText}>{uploading === media.key ? "Uploading…" : `Add ${media.label.toLowerCase()}`}</Text>
              </Pressable>
            </View>
          );
        })}
        {form.videoTours.length ? (
          <Text style={styles.hint}>{form.videoTours.length} video tour link(s) are kept with this property.</Text>
        ) : null}
      </SectionCard>
    </BrandPage>
  );
};

const FieldLabelText = ({ text }: { text: string }) => <Text style={styles.label}>{text}</Text>;

const styles = brandStyles((b) =>
  StyleSheet.create({
    banner: { marginBottom: 10 },
    gap: { marginTop: 12 },
    label: { marginTop: 4, marginBottom: 6, fontSize: t.fieldLabel, fontWeight: "600", color: b.textSecondary },
    hint: { marginTop: -4, marginBottom: 8, fontSize: t.body, color: b.textMuted },
    actionRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
    softBtn: {
      flex: 1,
      height: 42,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: round.field,
      backgroundColor: b.tintSoft,
    },
    softBtnText: { fontSize: t.field, fontWeight: "600", color: b.deep },
    mediaGroup: { marginBottom: 12 },
    mediaLabel: { marginBottom: 6, fontSize: t.fieldLabel, fontWeight: "600", color: b.textSecondary },
    mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
    mediaTile: { width: 84, height: 84 },
    mediaThumb: { width: 84, height: 84, borderRadius: round.field, backgroundColor: b.fieldMuted },
    mediaDoc: { alignItems: "center", justifyContent: "center", padding: 6, gap: 4 },
    mediaDocName: { fontSize: 9, textAlign: "center", color: b.textSecondary },
    mediaRemove: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(15,23,42,0.65)",
    },
    uploadBtn: {
      height: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: round.field,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: b.fieldBorder,
      backgroundColor: b.uploadTint,
    },
  }),
);
