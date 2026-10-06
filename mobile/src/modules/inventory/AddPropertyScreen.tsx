import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import {
  FieldCol,
  FieldLabel,
  FieldRow,
  PrefixField,
  SectionCard,
  Segmented,
  SelectField,
  TextField,
  Toggle,
  UnitField,
} from "../../components/ui/form";
import { createInventoryAsset } from "../../services/inventoryService";
import { saveContact } from "../../services/crmContactService";
import { uploadChatFile } from "../../services/chatService";
import { getAttendanceLocation } from "../../utils/location";
import { PlaceSuggestionList, usePlaceSuggestions } from "../../components/common/PlaceSuggestions";
import { geocodeAddress, resolvePlace, type PlaceSuggestion } from "../../services/placeSearch";
import { toErrorMessage } from "../../utils/errorMessage";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";

/*
 * Add Property - the four-step wizard the comps draw, plus its review and
 * published screens.
 *
 * It replaces the single create modal the vault used to open. The modal is
 * still in AssetVaultScreen because *editing* goes through it, and it carries
 * fields these comps do not draw (amenities, description, status, deal type,
 * key manager, property date). So a property is created here and those are
 * filled in on edit - noted in docs/mobile/00_MOBILE_PARITY_SPEC.md.
 *
 * The payload is the structured Inventory shape rather than the legacy asset
 * one: the backend derives projectName/towerName/unitNumber from `title` when
 * they are missing, and sending them directly is what lets the comps' floor,
 * area, deposit and location fields land in real columns.
 */

const DRAFT_KEY = "inventory.addProperty.draft";

const STEPS = [
  { key: "details", label: "Details" },
  { key: "pricing", label: "Pricing" },
  { key: "contacts", label: "Contacts" },
  { key: "media", label: "Media" },
] as const;

type Picked = { uri: string; name: string; mimeType?: string };

type Draft = {
  inventoryType: string;
  type: string;
  projectName: string;
  category: string;
  furnishingStatus: string;
  buildingName: string;
  floorNumber: string;
  totalFloors: string;
  carpetArea: string;
  builtUpArea: string;

  price: string;
  maintenanceCharges: string;
  depositMonths: string;
  agreementYears: string;
  lockInYears: string;
  gstApplicable: boolean;

  location: string;
  city: string;
  area: string;
  pincode: string;
  lat: number | null;
  lng: number | null;

  ownerName: string;
  ownerNumber: string;
  ownerEmail: string;
  contactKind: string;
  keyManagerName: string;
  keyManagerNumber: string;
};

const EMPTY_DRAFT: Draft = {
  inventoryType: "COMMERCIAL",
  type: "Sale",
  projectName: "",
  category: "Office",
  furnishingStatus: "FULLY_FURNISHED",
  buildingName: "",
  floorNumber: "",
  totalFloors: "",
  carpetArea: "",
  builtUpArea: "",

  price: "",
  maintenanceCharges: "",
  depositMonths: "",
  agreementYears: "",
  lockInYears: "",
  gstApplicable: false,

  location: "",
  city: "",
  area: "",
  pincode: "",
  lat: null,
  lng: null,

  ownerName: "",
  ownerNumber: "",
  ownerEmail: "",
  contactKind: "OWNER",
  keyManagerName: "",
  keyManagerNumber: "",
};

const INVENTORY_TYPES = [
  { label: "Commercial", value: "COMMERCIAL" },
  { label: "Residential", value: "RESIDENTIAL" },
];

const DEAL_TYPES = [
  { label: "For sale", value: "Sale" },
  { label: "For rent", value: "Rent" },
];

/* `category` is free text on the backend; these are the values web offers. */
const COMMERCIAL_CATEGORIES = [
  "Office", "Shop", "Showroom", "Warehouse", "Industrial", "Coworking", "Cafe", "Other",
].map((value) => ({ label: value, value }));

const RESIDENTIAL_CATEGORIES = [
  "Apartment", "Villa", "Independent House", "Builder Floor", "Plot", "Other",
].map((value) => ({ label: value, value }));

const FURNISHING = [
  { label: "Fully furnished", value: "FULLY_FURNISHED" },
  { label: "Semi furnished", value: "SEMI_FURNISHED" },
  { label: "Unfurnished", value: "UNFURNISHED" },
  { label: "Bare shell", value: "BARE_SHELL" },
  { label: "Warm shell", value: "WARM_SHELL" },
  { label: "Managed office", value: "MANAGED_OFFICE" },
  { label: "Coworking", value: "COWORKING" },
];

const CONTACT_KINDS = [
  { label: "Owner", value: "OWNER" },
  { label: "Broker", value: "BROKER" },
];

const labelOf = (options: Array<{ label: string; value: string }>, value: string) =>
  options.find((option) => option.value === value)?.label || value;

const money = (value: string) => {
  const amount = Number(String(value).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return "";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
};

const sqft = (value: string) => {
  const amount = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount.toLocaleString("en-IN") + " sq ft" : "";
};

const num = (value: string) => {
  const parsed = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const resolveFileUrl = (url?: string) => {
  const safe = String(url || "").trim();
  if (!safe) return "";
  if (/^https?:\/\//i.test(safe)) return safe;
  const base = process.env.EXPO_PUBLIC_API_ORIGIN || process.env.EXPO_PUBLIC_SOCKET_URL || "";
  const cleanBase = String(base).replace(/\/$/, "");
  return cleanBase ? `${cleanBase}${safe.startsWith("/") ? "" : "/"}${safe}` : safe;
};

/* ------------------------------------------------------------- stepper -- */

const StepRail = ({ step }: { step: number }) => (
  <View style={styles.rail}>
    {STEPS.map((item, index) => {
      const done = index < step;
      const current = index === step;
      return (
        <View key={item.key} style={styles.railItem}>
          <View style={styles.railRow}>
            {/* The rail runs between the bubbles, so the outer halves of the
                first and last steps carry no line at all. */}
            <View
              style={[
                styles.railLine,
                index === 0 ? styles.railLineHidden : done || current ? styles.railLineDone : null,
              ]}
            />
            <View style={[styles.bubble, (done || current) && styles.bubbleOn]}>
              {done ? (
                <Glyph name="checkmark" size={17} color={brand.onPrimary} />
              ) : (
                <Text style={[styles.bubbleText, current && styles.bubbleTextOn]}>{index + 1}</Text>
              )}
            </View>
            <View
              style={[
                styles.railLine,
                index === STEPS.length - 1 ? styles.railLineHidden : done ? styles.railLineDone : null,
              ]}
            />
          </View>
          <Text style={[styles.railLabel, (done || current) && styles.railLabelOn]} numberOfLines={1}>
            {item.label}
          </Text>
          <Text style={styles.railHint} numberOfLines={1}>
            {done ? "Completed" : current ? "Current step" : index === step + 1 ? "Next" : "Upcoming"}
          </Text>
        </View>
      );
    })}
  </View>
);

/* ---------------------------------------------------------- review rows -- */

const ReviewCard = ({
  title,
  subtitle,
  onEdit,
  rows,
}: {
  title: string;
  subtitle: string;
  onEdit: () => void;
  rows: Array<[string, string]>;
}) => (
  <View style={styles.reviewCard}>
    <View style={styles.reviewHead}>
      <View style={styles.reviewHeadText}>
        <Text style={styles.reviewTitle}>{title}</Text>
        <Text style={styles.reviewSubtitle}>{subtitle}</Text>
      </View>
      <Pressable style={styles.editBtn} onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Edit ${title}`}>
        <Glyph name="pencil" size={16} color={brand.deep} />
      </Pressable>
    </View>
    {rows.map(([label, value]) => (
      <View key={label} style={styles.reviewRow}>
        <Text style={styles.reviewLabel}>{label}</Text>
        <Text style={styles.reviewValue} numberOfLines={2}>
          {value || "-"}
        </Text>
      </View>
    ))}
  </View>
);

/* ---------------------------------------------------------------- screen -- */

export const AddPropertyScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"form" | "review" | "done">("form");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [plans, setPlans] = useState<Picked[]>([]);
  const [brochures, setBrochures] = useState<Picked[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [resolvingPlace, setResolvingPlace] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [created, setCreated] = useState<{ id: string; propertyId: string } | null>(null);

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  /* A draft is local: the backend has no draft state, so it lives on the
     device and is cleared once the property publishes. */
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (raw) setDraft({ ...EMPTY_DRAFT, ...JSON.parse(raw) });
      } catch {
        // A restorable draft is a nicety, not worth failing the screen over.
      }
    })();
  }, []);

  const saveDraft = useCallback(async () => {
    try {
      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setNote("Draft saved on this device");
    } catch {
      setError("Could not save the draft");
    }
  }, [draft]);

  const isRent = draft.type === "Rent";

  const stepError = useMemo(() => {
    if (step === 0 && !draft.projectName.trim()) return "Property or project name is required";
    if (step === 1 && !num(draft.price)) return isRent ? "Rent is required" : "Price is required";
    if (step === 1 && !draft.location.trim()) return "Address is required";
    if (step === 2 && !draft.ownerName.trim()) return "Owner name is required";
    if (step === 2 && !draft.ownerNumber.trim()) return "Mobile number is required";
    return "";
  }, [step, draft, isRent]);

  const goNext = () => {
    if (stepError) {
      setError(stepError);
      return;
    }
    setError("");
    if (step < STEPS.length - 1) setStep(step + 1);
    else setPhase("review");
  };

  const goBack = () => {
    setError("");
    if (phase === "review") {
      setPhase("form");
      return;
    }
    if (step > 0) setStep(step - 1);
    else navigation.goBack();
  };

  /* ---- pickers ---- */

  const pickPhotos = async () => {
    try {
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
      const rows = (result.assets || []).map((asset, index) => ({
        uri: asset.uri,
        name: asset.fileName || `photo-${Date.now()}-${index + 1}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      }));
      setPhotos((prev) => [...prev, ...rows].slice(0, 10));
    } catch {
      setError("Failed to pick photos");
    }
  };

  const pickDoc = async (into: (rows: Picked[]) => void) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (result.canceled) return;
      into(
        (result.assets || []).map((asset, index) => ({
          uri: asset.uri,
          name: asset.name || `file-${Date.now()}-${index + 1}`,
          mimeType: asset.mimeType || "application/octet-stream",
        })),
      );
    } catch {
      setError("Failed to pick the file");
    }
  };

  /* Web's address suggestions: OpenStreetMap unless Google is configured. */
  const places = usePlaceSuggestions(draft.location, { enabled: phase === "form" && step === 1 });

  const pickPlace = async (suggestion: PlaceSuggestion) => {
    places.markChosen(suggestion.label);
    set("location", suggestion.label);
    setResolvingPlace(true);
    setError("");
    try {
      const resolved = await resolvePlace(suggestion);
      if (!resolved || resolved.lat === undefined || resolved.lng === undefined) {
        setError("Unable to resolve selected location coordinates");
        return;
      }
      places.markChosen(resolved.label);
      set("location", resolved.label);
      set("lat", resolved.lat);
      set("lng", resolved.lng);
      setNote("Location selected and coordinates auto-filled");
    } finally {
      setResolvingPlace(false);
    }
  };

  /* Web's pin button: look the typed address up and pin what comes back. */
  const findAddressOnMap = async () => {
    const query = draft.location.trim();
    if (!query || resolvingPlace) return;
    setResolvingPlace(true);
    setError("");
    try {
      const resolved = await geocodeAddress(query);
      if (!resolved) {
        setError("Location not found. Try entering full address");
        return;
      }
      places.clear();
      set("lat", resolved.lat);
      set("lng", resolved.lng);
      setNote("Coordinates auto-filled from location");
    } catch (e) {
      setError(toErrorMessage(e, "Unable to fetch coordinates"));
    } finally {
      setResolvingPlace(false);
    }
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const result = await getAttendanceLocation();
      if (result.ok && result.location) {
        set("lat", result.location.latitude);
        set("lng", result.location.longitude);
        setNote("Location pinned from your current position");
      } else {
        setError(result.ok ? "Could not read a position" : result.message);
      }
    } catch (e) {
      setError(toErrorMessage(e, "Could not read your location"));
    } finally {
      setLocating(false);
    }
  };

  /* ---- publish ---- */

  const publish = async () => {
    if (!confirmed) {
      setError("Confirm the information is accurate before publishing");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const [photoRows, planRows, docRows] = await Promise.all([
        Promise.all(photos.map((row) => uploadChatFile(row))),
        Promise.all(plans.map((row) => uploadChatFile(row))),
        Promise.all(brochures.map((row) => uploadChatFile(row))),
      ]);

      const amount = num(draft.price) || 0;
      const payload: Record<string, unknown> = {
        projectName: draft.projectName.trim(),
        towerName: draft.buildingName.trim() || draft.projectName.trim(),
        inventoryType: draft.inventoryType,
        type: draft.type,
        category: draft.category,
        furnishingStatus: draft.furnishingStatus,
        buildingName: draft.buildingName.trim(),
        floorNumber: num(draft.floorNumber),
        totalFloors: num(draft.totalFloors),
        carpetArea: num(draft.carpetArea),
        builtUpArea: num(draft.builtUpArea),
        areaUnit: "SQ_FT",
        status: "Available",

        // `price` is what the schema requires for a sale; a rental carries the
        // monthly figure in `rent` and the schema stops requiring `price`.
        price: amount,
        ...(isRent ? { rent: amount } : {}),
        maintenanceCharges: num(draft.maintenanceCharges),
        depositMonths: num(draft.depositMonths),
        agreementYears: num(draft.agreementYears),
        lockInYears: num(draft.lockInYears),
        gstApplicable: draft.gstApplicable,

        location: draft.location.trim(),
        city: draft.city.trim(),
        area: draft.area.trim(),
        pincode: draft.pincode.trim(),
        ...(draft.lat !== null && draft.lng !== null
          ? { siteLocation: { lat: draft.lat, lng: draft.lng } }
          : {}),

        ownerName: draft.ownerName.trim(),
        ownerNumber: draft.ownerNumber.trim(),
        keyManagerName: draft.keyManagerName.trim(),
        keyManagerNumber: draft.keyManagerNumber.trim(),

        images: photoRows.map((row) => resolveFileUrl(row?.fileUrl)).filter(Boolean),
        floorPlans: planRows.map((row) => resolveFileUrl(row?.fileUrl)).filter(Boolean),
        documents: docRows.map((row) => resolveFileUrl(row?.fileUrl)).filter(Boolean),
      };

      const asset = await createInventoryAsset(payload as never);

      /*
       * The comp asks for an email against the contact, and Inventory has no
       * column for one - the owner/broker directory does. So the contact is
       * written there too, which is also what makes the Owner/Broker choice
       * mean something.
       */
      if (draft.ownerName.trim() && draft.ownerNumber.trim()) {
        try {
          await saveContact(
            {
              name: draft.ownerName.trim(),
              phone: draft.ownerNumber.trim(),
              email: draft.ownerEmail.trim(),
              city: draft.city.trim(),
            },
            draft.contactKind as never,
          );
        } catch {
          // The property is published; a directory write that fails should not
          // read as a failed publish.
        }
      }

      await AsyncStorage.removeItem(DRAFT_KEY);
      setCreated({
        id: String((asset as never as { _id?: string })?._id || ""),
        propertyId: String((asset as never as { propertyId?: string })?.propertyId || ""),
      });
      setPhase("done");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to publish the property"));
    } finally {
      setSaving(false);
    }
  };

  const categories = draft.inventoryType === "RESIDENTIAL" ? RESIDENTIAL_CATEGORIES : COMMERCIAL_CATEGORIES;
  const priceLabel = isRent ? "Price (per month)" : "Price";
  const bottomPad = 16 + Math.max(insets.bottom, Platform.OS === "android" ? 16 : 0);

  /* ------------------------------------------------------------- done -- */

  if (phase === "done") {
    return (
      <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
        <View style={styles.doneBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Glyph name="close" size={26} color={brand.text} />
          </Pressable>
          <Text style={styles.doneBarTitle}>Property Published</Text>
          <View style={styles.doneBarSpacer} />
        </View>

        <ScrollView contentContainerStyle={[styles.doneBody, { paddingBottom: bottomPad }]}>
          <View style={styles.tickHalo}>
            <View style={styles.tick}>
              <Glyph name="checkmark" size={46} color={brand.onPrimary} />
            </View>
          </View>

          <Text style={styles.doneTitle}>Property added successfully!</Text>
          <Text style={styles.doneNote}>
            {draft.projectName.trim() || "The property"} is now live in your inventory.
          </Text>

          <View style={styles.doneCard}>
            {photos[0] ? (
              <Image source={{ uri: photos[0].uri }} style={styles.doneThumb} resizeMode="contain" />
            ) : (
              <View style={[styles.doneThumb, styles.doneThumbEmpty]}>
                <Glyph name="business" size={30} color={brand.textMuted} />
              </View>
            )}
            <View style={styles.doneCardText}>
              <Text style={styles.doneCardTitle} numberOfLines={1}>
                {draft.projectName.trim() || "Property"}
              </Text>
              <View style={styles.doneCardRow}>
                <Glyph name="location-outline" size={14} color={brand.textMuted} />
                <Text style={styles.doneCardMeta} numberOfLines={1}>
                  {[draft.area.trim(), draft.city.trim()].filter(Boolean).join(", ") || "-"}
                </Text>
              </View>
              <Text style={styles.doneCardPrice}>{money(draft.price) || "-"}</Text>
              <View style={styles.donePill}>
                <Text style={styles.donePillText}>Available</Text>
              </View>
              {created?.propertyId ? (
                <Text style={styles.doneCardId}>Property ID · {created.propertyId}</Text>
              ) : null}
            </View>
          </View>

          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              if (created?.id) navigation.replace("InventoryDetails", { assetId: created.id });
              else navigation.goBack();
            }}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>View property</Text>
            <Glyph name="arrow-forward" size={18} color={brand.onPrimary} />
          </Pressable>

          {created?.id ? (
            <Pressable
              style={styles.outlineBtn}
              onPress={() => navigation.replace("PropertyForm", { assetId: created.id })}
              accessibilityRole="button"
            >
              <Text style={styles.outlineBtnText}>Add more details</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={styles.outlineBtn}
            onPress={() => {
              setDraft(EMPTY_DRAFT);
              setPhotos([]);
              setPlans([]);
              setBrochures([]);
              setConfirmed(false);
              setCreated(null);
              setStep(0);
              setPhase("form");
            }}
            accessibilityRole="button"
          >
            <Text style={styles.outlineBtnText}>Add another property</Text>
          </Pressable>

          <Pressable style={styles.textBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
            <Text style={styles.textBtnLabel}>Back to inventory</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ----------------------------------------------------------- chrome -- */

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.bar}>
        <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <Glyph name="arrow-back" size={24} color={brand.text} />
        </Pressable>
        <View style={styles.barText}>
          <Text style={styles.barTitle}>{phase === "review" ? "Review Property" : "Add Property"}</Text>
          <Text style={styles.barSubtitle}>
            {phase === "review" ? "Check everything before publishing" : "List a new space on Office on Rent"}
          </Text>
        </View>
        {phase === "form" ? (
          <Pressable onPress={saveDraft} hitSlop={10} accessibilityRole="button">
            <Text style={styles.barAction}>Save draft</Text>
          </Pressable>
        ) : (
          <View style={styles.barSpacer} />
        )}
      </View>

      {phase === "form" ? <StepRail step={step} /> : null}

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {phase === "form" && step === 0 ? (
          /* The wizard is the comps' four steps; web's full form holds the rest
             - preferences, dimensions, documents, ownership. */
          <Pressable style={styles.fullFormLink} onPress={() => navigation.replace("PropertyForm")} accessibilityRole="link">
            <Glyph name="list-outline" size={16} color={brand.deep} />
            <Text style={styles.fullFormText}>Need every field? Open the full property form</Text>
          </Pressable>
        ) : null}
        {error ? (
          <Pressable style={styles.banner} onPress={() => setError("")} accessibilityRole="button">
            <Text style={styles.bannerText}>{error}</Text>
          </Pressable>
        ) : null}
        {note ? (
          <Pressable style={[styles.banner, styles.bannerOk]} onPress={() => setNote("")} accessibilityRole="button">
            <Text style={[styles.bannerText, styles.bannerOkText]}>{note}</Text>
          </Pressable>
        ) : null}

        {phase === "form" && step === 0 ? (
          <SectionCard>
            <FieldRow>
              <FieldCol>
                <SelectField
                  label="Inventory type"
                  icon="business-outline"
                  value={draft.inventoryType}
                  options={INVENTORY_TYPES}
                  onChange={(next) => {
                    set("inventoryType", next);
                    set("category", next === "RESIDENTIAL" ? "Apartment" : "Office");
                  }}
                />
              </FieldCol>
              <FieldCol>
                <SelectField
                  label="Rent or Sale"
                  icon="pricetag-outline"
                  value={draft.type}
                  options={DEAL_TYPES}
                  onChange={(next) => set("type", next)}
                />
              </FieldCol>
            </FieldRow>

            <TextField
              label="Property ID"
              value=""
              placeholder="Auto-generated on save"
              editable={false}
              trailing={<Glyph name="information-circle-outline" size={18} color={brand.textMuted} />}
            />

            <TextField
              label="Property / Project name"
              required
              value={draft.projectName}
              onChangeText={(next) => set("projectName", next)}
              placeholder="Enter property or project name"
            />

            <SelectField
              label="Property type"
              icon="business-outline"
              value={draft.category}
              options={categories}
              onChange={(next) => set("category", next)}
            />

            <SelectField
              label="Furnishing"
              icon="bed-outline"
              value={draft.furnishingStatus}
              options={FURNISHING}
              onChange={(next) => set("furnishingStatus", next)}
            />

            <TextField
              label="Building name"
              icon="business-outline"
              value={draft.buildingName}
              onChangeText={(next) => set("buildingName", next)}
              placeholder="Enter building name"
            />

            <FieldRow>
              <FieldCol>
                <TextField
                  label="Floor number"
                  icon="layers-outline"
                  value={draft.floorNumber}
                  onChangeText={(next) => set("floorNumber", next)}
                  placeholder="e.g. 5"
                  keyboardType="number-pad"
                />
              </FieldCol>
              <FieldCol>
                <TextField
                  label="Total floors"
                  icon="layers-outline"
                  value={draft.totalFloors}
                  onChangeText={(next) => set("totalFloors", next)}
                  placeholder="e.g. 12"
                  keyboardType="number-pad"
                />
              </FieldCol>
            </FieldRow>

            <FieldRow>
              <FieldCol>
                <TextField
                  label="Carpet area (sq. ft.)"
                  icon="resize-outline"
                  value={draft.carpetArea}
                  onChangeText={(next) => set("carpetArea", next)}
                  placeholder="e.g. 1,000"
                  keyboardType="number-pad"
                />
              </FieldCol>
              <FieldCol>
                <TextField
                  label="Built-up area (sq. ft.)"
                  icon="resize-outline"
                  value={draft.builtUpArea}
                  onChangeText={(next) => set("builtUpArea", next)}
                  placeholder="e.g. 1,200"
                  keyboardType="number-pad"
                />
              </FieldCol>
            </FieldRow>
          </SectionCard>
        ) : null}

        {phase === "form" && step === 1 ? (
          <>
            <SectionCard title="Pricing Details" subtitle="Set the commercial terms for this property">
              <FieldRow>
                <FieldCol>
                  <PrefixField
                    label={priceLabel}
                    required
                    prefix={"₹"}
                    value={draft.price}
                    onChangeText={(next) => set("price", next)}
                    placeholder="75,000"
                  />
                </FieldCol>
                <FieldCol>
                  <PrefixField
                    label="Maintenance charges (per month)"
                    prefix={"₹"}
                    value={draft.maintenanceCharges}
                    onChangeText={(next) => set("maintenanceCharges", next)}
                    placeholder="7,500"
                  />
                </FieldCol>
              </FieldRow>

              <FieldRow>
                <FieldCol>
                  <UnitField
                    label="Security deposit"
                    unit="months"
                    value={draft.depositMonths}
                    onChangeText={(next) => set("depositMonths", next)}
                    placeholder="6"
                  />
                </FieldCol>
                <FieldCol>
                  <UnitField
                    label="Agreement period"
                    unit="years"
                    value={draft.agreementYears}
                    onChangeText={(next) => set("agreementYears", next)}
                    placeholder="3"
                  />
                </FieldCol>
              </FieldRow>

              <FieldRow>
                <FieldCol>
                  <UnitField
                    label="Lock-in period"
                    unit="years"
                    value={draft.lockInYears}
                    onChangeText={(next) => set("lockInYears", next)}
                    placeholder="1"
                  />
                </FieldCol>
                <FieldCol>
                  <View>
                    <FieldLabel label="GST applicable" />
                    <View style={styles.toggleBox}>
                      <Toggle
                        value={draft.gstApplicable}
                        onValueChange={(next) => set("gstApplicable", next)}
                        label={draft.gstApplicable ? "Yes, GST is applicable" : "Not applicable"}
                      />
                    </View>
                  </View>
                </FieldCol>
              </FieldRow>
            </SectionCard>

            <SectionCard
              title="Location Details"
              subtitle="Add the property address and set its location"
              style={styles.cardGap}
            >
              <TextField
                label="Address"
                required
                value={draft.location}
                onChangeText={(next) => set("location", next)}
                placeholder="Building, street, locality"
              />
              <PlaceSuggestionList rows={places.rows} loading={places.loading} onPick={pickPlace} />

              <FieldRow>
                <FieldCol>
                  <TextField
                    label="City"
                    value={draft.city}
                    onChangeText={(next) => set("city", next)}
                    placeholder="Indore"
                  />
                </FieldCol>
                <FieldCol>
                  <TextField
                    label="Area / Locality"
                    value={draft.area}
                    onChangeText={(next) => set("area", next)}
                    placeholder="Vijay Nagar"
                  />
                </FieldCol>
              </FieldRow>

              <TextField
                label="Pincode"
                value={draft.pincode}
                onChangeText={(next) => set("pincode", next)}
                placeholder="452010"
                keyboardType="number-pad"
              />

              <View style={styles.mapBox}>
                <Glyph name="location" size={30} color={brand.primary} />
                <Text style={styles.mapLabel} numberOfLines={2}>
                  {draft.lat !== null && draft.lng !== null
                    ? `${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`
                    : draft.location.trim() || "No location pinned yet"}
                </Text>
              </View>

              <Pressable
                style={styles.softBtn}
                onPress={useCurrentLocation}
                disabled={locating}
                accessibilityRole="button"
              >
                {locating ? (
                  <ActivityIndicator size="small" color={brand.deep} />
                ) : (
                  <Glyph name="location" size={18} color={brand.deep} />
                )}
                <Text style={styles.softBtnText}>Set location</Text>
              </Pressable>
              <Pressable
                style={[styles.softBtn, !draft.location.trim() && styles.softBtnOff]}
                onPress={findAddressOnMap}
                disabled={resolvingPlace || !draft.location.trim()}
                accessibilityRole="button"
              >
                {resolvingPlace ? (
                  <ActivityIndicator size="small" color={brand.deep} />
                ) : (
                  <Glyph name="search" size={17} color={brand.deep} />
                )}
                <Text style={styles.softBtnText}>Find address on map</Text>
              </Pressable>
            </SectionCard>
          </>
        ) : null}

        {phase === "form" && step === 2 ? (
          <>
            <SectionCard title="Owner & Contact Details" subtitle="Add the primary contact for this property">
              <TextField
                label="Owner name"
                required
                value={draft.ownerName}
                onChangeText={(next) => set("ownerName", next)}
                placeholder="Enter owner name"
              />
              <TextField
                label="Mobile number"
                required
                prefix="+91"
                value={draft.ownerNumber}
                onChangeText={(next) => set("ownerNumber", next)}
                placeholder="98765 43210"
                keyboardType="phone-pad"
              />
              <TextField
                label="Email address"
                icon="mail-outline"
                value={draft.ownerEmail}
                onChangeText={(next) => set("ownerEmail", next)}
                placeholder="name@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <View>
                <FieldLabel label="Contact type" required />
                <Segmented
                  options={CONTACT_KINDS}
                  value={draft.contactKind}
                  onChange={(next) => set("contactKind", next)}
                />
              </View>
            </SectionCard>

            <SectionCard title="Additional Contact" subtitle="Optional point of contact" style={styles.cardGap}>
              <TextField
                label="Contact person"
                value={draft.keyManagerName}
                onChangeText={(next) => set("keyManagerName", next)}
                placeholder="Enter contact name"
              />
              <TextField
                label="Mobile number"
                prefix="+91"
                value={draft.keyManagerNumber}
                onChangeText={(next) => set("keyManagerNumber", next)}
                placeholder="Enter mobile number"
                keyboardType="phone-pad"
              />
            </SectionCard>
          </>
        ) : null}

        {phase === "form" && step === 3 ? (
          <>
            <SectionCard title="Property Photos" subtitle="Add clear photos to showcase the space">
              <Pressable style={styles.dropZone} onPress={pickPhotos} accessibilityRole="button">
                <Glyph name="image-outline" size={34} color={brand.primary} />
                <Text style={styles.dropTitle}>Upload property photos</Text>
                <Text style={styles.dropNote}>JPG or PNG · Up to 10 photos</Text>
                <View style={styles.dropBtn}>
                  <Text style={styles.dropBtnText}>Choose photos</Text>
                </View>
              </Pressable>

              {photos.length ? (
                <View style={styles.grid}>
                  {photos.map((photo, index) => (
                    <View key={photo.uri} style={styles.gridCell}>
                      <Image source={{ uri: photo.uri }} style={styles.gridImage} resizeMode="contain" />
                      {index === 0 ? (
                        <View style={styles.coverBadge}>
                          <Text style={styles.coverBadgeText}>Cover</Text>
                        </View>
                      ) : null}
                      <Pressable
                        style={styles.removeBtn}
                        onPress={() => setPhotos((prev) => prev.filter((row) => row.uri !== photo.uri))}
                        accessibilityRole="button"
                        accessibilityLabel="Remove photo"
                      >
                        <Glyph name="close" size={16} color={brand.text} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
            </SectionCard>

            <SectionCard title="Floor Plan & Documents" subtitle="Optional" style={styles.cardGap}>
              <Pressable style={styles.fileRow} onPress={() => pickDoc((rows) => setPlans((prev) => [...prev, ...rows]))} accessibilityRole="button">
                <Glyph name="document-outline" size={20} color={brand.textSecondary} />
                <View style={styles.fileRowText}>
                  <Text style={styles.fileRowTitle}>Upload floor plan</Text>
                  <Text style={styles.fileRowNote}>
                    {plans.length ? `${plans.length} selected` : "PDF, JPG or PNG"}
                  </Text>
                </View>
                <Glyph name="chevron-forward" size={18} color={brand.textMuted} />
              </Pressable>

              <Pressable style={styles.fileRow} onPress={() => pickDoc((rows) => setBrochures((prev) => [...prev, ...rows]))} accessibilityRole="button">
                <Glyph name="document-outline" size={20} color={brand.textSecondary} />
                <View style={styles.fileRowText}>
                  <Text style={styles.fileRowTitle}>Upload brochure</Text>
                  <Text style={styles.fileRowNote}>
                    {brochures.length ? `${brochures.length} selected` : "PDF up to 10 MB"}
                  </Text>
                </View>
                <Glyph name="chevron-forward" size={18} color={brand.textMuted} />
              </Pressable>

              <View style={styles.infoRow}>
                <Glyph name="information-circle-outline" size={16} color={brand.textMuted} />
                <Text style={styles.infoText}>The first photo is used as the cover.</Text>
              </View>
            </SectionCard>
          </>
        ) : null}

        {phase === "review" ? (
          <>
            <View style={styles.summary}>
              <View style={styles.summaryThumbWrap}>
                {photos[0] ? (
                  <Image source={{ uri: photos[0].uri }} style={styles.summaryThumb} resizeMode="contain" />
                ) : (
                  <View style={[styles.summaryThumb, styles.doneThumbEmpty]}>
                    <Glyph name="business" size={28} color={brand.textMuted} />
                  </View>
                )}
                <View style={styles.summaryBadge}>
                  <Text style={styles.summaryBadgeText}>{labelOf(DEAL_TYPES, draft.type)}</Text>
                </View>
              </View>
              <View style={styles.summaryText}>
                <Text style={styles.summaryTitle} numberOfLines={1}>
                  {draft.projectName.trim() || "Property"}
                </Text>
                <View style={styles.doneCardRow}>
                  <Glyph name="location-outline" size={14} color={brand.textMuted} />
                  <Text style={styles.doneCardMeta} numberOfLines={1}>
                    {[draft.area.trim(), draft.city.trim()].filter(Boolean).join(", ") || "-"}
                  </Text>
                </View>
                <Text style={styles.doneCardPrice}>{money(draft.price) || "-"}</Text>
                <Text style={styles.summaryMeta} numberOfLines={1}>
                  {[sqft(draft.carpetArea), labelOf(FURNISHING, draft.furnishingStatus)]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            </View>

            <ReviewCard
              title="Property Details"
              subtitle="Basic information about the property"
              onEdit={() => { setPhase("form"); setStep(0); }}
              rows={[
                ["Type", `${labelOf(INVENTORY_TYPES, draft.inventoryType)} ${draft.category}`],
                ["Building", draft.buildingName],
                ["Floor", draft.floorNumber && draft.totalFloors ? `${draft.floorNumber} of ${draft.totalFloors}` : draft.floorNumber],
                ["Carpet area", sqft(draft.carpetArea)],
              ]}
            />

            <ReviewCard
              title="Pricing & Location"
              subtitle="Commercial terms and address details"
              onEdit={() => { setPhase("form"); setStep(1); }}
              rows={[
                [isRent ? "Rent" : "Price", money(draft.price)],
                ["Maintenance", draft.maintenanceCharges ? `${money(draft.maintenanceCharges)} / month` : ""],
                ["Address", [draft.location.trim(), draft.area.trim(), draft.city.trim()].filter(Boolean).join(", ")],
                ["Agreement", draft.agreementYears ? `${draft.agreementYears} years` : ""],
              ]}
            />

            <ReviewCard
              title="Owner Contact"
              subtitle="Owner's contact information"
              onEdit={() => { setPhase("form"); setStep(2); }}
              rows={[
                ["Name", draft.ownerName],
                ["Mobile", draft.ownerNumber],
                ["Email", draft.ownerEmail],
                ["Type", labelOf(CONTACT_KINDS, draft.contactKind)],
              ]}
            />

            <View style={styles.reviewCard}>
              <View style={styles.reviewHead}>
                <View style={styles.reviewHeadText}>
                  <Text style={styles.reviewTitle}>Media</Text>
                  <Text style={styles.reviewSubtitle}>Property photos and floor plans</Text>
                </View>
                <Pressable style={styles.editBtn} onPress={() => { setPhase("form"); setStep(3); }} accessibilityRole="button" accessibilityLabel="Edit media">
                  <Glyph name="pencil" size={16} color={brand.deep} />
                </Pressable>
              </View>
              {photos.length ? (
                <View style={styles.strip}>
                  {photos.slice(0, 4).map((photo) => (
                    <Image key={photo.uri} source={{ uri: photo.uri }} style={styles.stripImage} resizeMode="contain" />
                  ))}
                </View>
              ) : null}
              <Text style={styles.stripNote}>
                {photos.length} photo{photos.length === 1 ? "" : "s"} · {plans.length} floor plan
                {plans.length === 1 ? "" : "s"}
              </Text>
            </View>

            <Pressable
              style={[styles.confirm, confirmed && styles.confirmOn]}
              onPress={() => setConfirmed(!confirmed)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: confirmed }}
            >
              <View style={[styles.checkbox, confirmed && styles.checkboxOn]}>
                {confirmed ? <Glyph name="checkmark" size={15} color={brand.onPrimary} /> : null}
              </View>
              <Text style={styles.confirmText}>I confirm that the property information is accurate.</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomPad }]}>
        {phase === "review" ? (
          <>
            <Pressable
              style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
              onPress={publish}
              disabled={saving}
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator size="small" color={brand.onPrimary} />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Publish property</Text>
                  <Glyph name="arrow-forward" size={18} color={brand.onPrimary} />
                </>
              )}
            </Pressable>
            <Pressable style={styles.textBtn} onPress={saveDraft} accessibilityRole="button">
              <Text style={styles.textBtnLabel}>Save as draft</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.primaryBtn} onPress={goNext} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>
              {step === STEPS.length - 1 ? "Review property" : "Continue"}
            </Text>
            <Glyph name="arrow-forward" size={18} color={brand.onPrimary} />
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: b.bg,
    },

    /* ---- top bar ---- */
    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: layout.pageGutter,
      paddingTop: 6,
      paddingBottom: 14,
    },
    barText: {
      flex: 1,
      minWidth: 0,
    },
    fullFormLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: round.field,
      backgroundColor: b.tintSoft,
    },
    fullFormText: { flex: 1, fontSize: t.body, fontWeight: "600", color: b.deep },
    barTitle: {
      fontSize: t.barTitle,
      lineHeight: 23,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: b.text,
    },
    barSubtitle: {
      marginTop: 1,
      fontSize: t.label,
      lineHeight: 15,
      color: b.textMuted,
    },
    barAction: {
      fontSize: t.field,
      fontWeight: "600",
      color: b.primary,
    },
    barSpacer: {
      width: 24,
    },

    /* ---- stepper ---- */
    rail: {
      flexDirection: "row",
      paddingHorizontal: layout.pageGutter,
      paddingBottom: 18,
    },
    railItem: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
    },
    railRow: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "stretch",
    },
    railLine: {
      flex: 1,
      height: 2,
      backgroundColor: b.connector,
    },
    railLineHidden: {
      backgroundColor: "transparent",
    },
    railLineDone: {
      backgroundColor: b.primary,
    },
    bubble: {
      width: 32,
      height: 32,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.neutralBadge,
    },
    bubbleOn: {
      backgroundColor: b.primary,
    },
    bubbleText: {
      fontSize: t.field,
      fontWeight: "600",
      color: b.textSecondary,
    },
    bubbleTextOn: {
      color: b.onPrimary,
    },
    railLabel: {
      marginTop: 8,
      fontSize: t.body,
      fontWeight: "600",
      color: b.textSecondary,
    },
    railLabelOn: {
      color: b.text,
    },
    railHint: {
      marginTop: 1,
      fontSize: t.tagline,
      color: b.textMuted,
    },

    /* ---- body ---- */
    body: {
      paddingHorizontal: layout.pageGutter,
    },
    cardGap: {
      marginTop: 16,
    },
    banner: {
      marginBottom: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: b.alert,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    bannerText: {
      fontSize: t.body,
      lineHeight: 17,
      color: b.alert,
    },
    bannerOk: {
      borderColor: b.primary,
    },
    bannerOkText: {
      color: b.deep,
    },

    toggleBox: {
      height: layout.fieldHeight,
      justifyContent: "center",
    },

    /* ---- location ---- */
    mapBox: {
      height: 126,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: round.field,
      backgroundColor: b.fieldMuted,
    },
    mapLabel: {
      paddingHorizontal: 20,
      fontSize: t.body,
      textAlign: "center",
      color: b.textSecondary,
    },
    softBtn: {
      marginTop: 12,
      height: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: round.field,
      backgroundColor: b.tintSoft,
    },
    softBtnText: {
      fontSize: t.field,
      fontWeight: "600",
      color: b.deep,
    },
    softBtnOff: { opacity: 0.55 },

    /* ---- media ---- */
    dropZone: {
      alignItems: "center",
      paddingVertical: 22,
      gap: 6,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: b.primary,
      borderRadius: round.field,
      backgroundColor: b.uploadTint,
    },
    dropTitle: {
      marginTop: 4,
      fontSize: t.sectionTitle,
      fontWeight: "700",
      color: b.text,
    },
    dropNote: {
      fontSize: t.body,
      color: b.textMuted,
    },
    dropBtn: {
      marginTop: 8,
      paddingHorizontal: 20,
      height: 40,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: b.primary,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    dropBtnText: {
      fontSize: t.field,
      fontWeight: "700",
      color: b.deep,
    },
    grid: {
      marginTop: 14,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    gridCell: {
      width: "48%",
      aspectRatio: 1.5,
      borderRadius: round.field,
      overflow: "hidden",
      backgroundColor: b.fieldMuted,
    },
    gridImage: {
      backgroundColor: "#eef1f5",
      width: "100%",
      height: "100%",
    },
    coverBadge: {
      position: "absolute",
      top: 8,
      left: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: round.button,
      backgroundColor: b.primary,
    },
    coverBadgeText: {
      fontSize: t.label,
      fontWeight: "600",
      color: b.onPrimary,
    },
    removeBtn: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.surface,
    },
    fileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      height: 60,
      paddingHorizontal: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: b.fieldBorder,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    fileRowText: {
      flex: 1,
      minWidth: 0,
    },
    fileRowTitle: {
      fontSize: t.field,
      fontWeight: "600",
      color: b.text,
    },
    fileRowNote: {
      marginTop: 1,
      fontSize: t.label,
      color: b.textMuted,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: round.field,
      backgroundColor: b.fieldMuted,
    },
    infoText: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: t.body,
      color: b.textMuted,
    },

    /* ---- review ---- */
    summary: {
      flexDirection: "row",
      gap: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    summaryThumbWrap: {
      width: 132,
      height: 104,
    },
    summaryBadge: {
      position: "absolute",
      top: 7,
      left: 7,
      paddingHorizontal: 11,
      paddingVertical: 4,
      borderRadius: round.button,
      backgroundColor: b.primary,
    },
    summaryBadgeText: {
      fontSize: t.body,
      fontWeight: "600",
      color: b.onPrimary,
    },
    summaryThumb: {
      width: 132,
      height: 104,
      borderRadius: round.field,
      alignItems: "center",
      justifyContent: "center",
    },
    summaryText: {
      flex: 1,
      minWidth: 0,
      justifyContent: "center",
    },
    summaryTitle: {
      fontSize: t.sectionTitle,
      lineHeight: 20,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: b.text,
    },
    summaryMeta: {
      marginTop: 2,
      fontSize: t.body,
      color: b.textSecondary,
    },
    reviewCard: {
      marginTop: 12,
      padding: layout.cardPadding,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    reviewHead: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 12,
    },
    reviewHeadText: {
      flex: 1,
      minWidth: 0,
    },
    reviewTitle: {
      fontSize: t.sectionTitle,
      lineHeight: 20,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: b.text,
    },
    reviewSubtitle: {
      marginTop: 2,
      fontSize: t.label,
      color: b.textMuted,
    },
    editBtn: {
      width: 34,
      height: 34,
      borderRadius: round.field,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tintSoft,
    },
    reviewRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 16,
      paddingVertical: 6,
    },
    reviewLabel: {
      fontSize: t.field,
      color: b.textMuted,
    },
    reviewValue: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: t.field,
      fontWeight: "500",
      textAlign: "right",
      color: b.text,
    },
    strip: {
      flexDirection: "row",
      gap: 8,
    },
    stripImage: {
      flex: 1,
      minWidth: 0,
      height: 64,
      borderRadius: round.button,
      backgroundColor: b.fieldMuted,
    },
    stripNote: {
      marginTop: 10,
      fontSize: t.label,
      color: b.textMuted,
    },
    confirm: {
      marginTop: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: round.field,
      backgroundColor: b.surface,
      borderWidth: 1,
      borderColor: b.border,
    },
    confirmOn: {
      backgroundColor: b.tintSoft,
      borderColor: b.tintSoft,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: round.button,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: b.fieldBorder,
      backgroundColor: b.surface,
    },
    checkboxOn: {
      borderColor: b.primary,
      backgroundColor: b.primary,
    },
    confirmText: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: t.body,
      color: b.text,
    },

    /* ---- footer ---- */
    footer: {
      paddingHorizontal: layout.pageGutter,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: b.hairline,
      backgroundColor: b.bg,
    },
    primaryBtn: {
      height: 52,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: round.field,
      backgroundColor: b.primary,
    },
    primaryBtnDisabled: {
      opacity: 0.7,
    },
    primaryBtnText: {
      fontSize: t.rowTitle,
      fontWeight: "700",
      color: b.onPrimary,
    },
    outlineBtn: {
      marginTop: 12,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round.field,
      borderWidth: 1,
      borderColor: b.primary,
      backgroundColor: b.surface,
    },
    outlineBtnText: {
      fontSize: t.rowTitle,
      fontWeight: "700",
      color: b.deep,
    },
    textBtn: {
      marginTop: 14,
      alignItems: "center",
    },
    textBtnLabel: {
      fontSize: t.field,
      fontWeight: "700",
      color: b.deep,
    },

    /* ---- published ---- */
    doneBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: layout.pageGutter,
      paddingTop: 6,
      paddingBottom: 14,
    },
    doneBarTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: t.barTitle,
      fontWeight: "700",
      color: b.text,
    },
    doneBarSpacer: {
      width: 26,
    },
    doneBody: {
      paddingHorizontal: layout.pageGutter,
      alignItems: "stretch",
    },
    tickHalo: {
      alignSelf: "center",
      marginTop: 40,
      width: 170,
      height: 170,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tintSoft,
    },
    tick: {
      width: 96,
      height: 96,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.primary,
    },
    doneTitle: {
      marginTop: 34,
      textAlign: "center",
      fontSize: t.hero,
      lineHeight: 26,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },
    doneNote: {
      marginTop: 8,
      textAlign: "center",
      fontSize: t.field,
      color: b.textMuted,
    },
    doneCard: {
      marginTop: 26,
      flexDirection: "row",
      gap: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    doneThumb: {
      width: 132,
      height: 132,
      borderRadius: round.field,
      alignItems: "center",
      justifyContent: "center",
    },
    doneThumbEmpty: {
      backgroundColor: b.fieldMuted,
    },
    doneCardText: {
      flex: 1,
      minWidth: 0,
      justifyContent: "center",
    },
    doneCardTitle: {
      fontSize: t.sectionTitle,
      lineHeight: 20,
      fontWeight: "700",
      color: b.text,
    },
    doneCardRow: {
      marginTop: 3,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    doneCardMeta: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: t.body,
      color: b.textMuted,
    },
    doneCardPrice: {
      marginTop: 5,
      fontSize: t.price,
      lineHeight: 24,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.primary,
    },
    donePill: {
      marginTop: 7,
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: round.button,
      backgroundColor: b.tintSoft,
    },
    donePillText: {
      fontSize: t.body,
      fontWeight: "600",
      color: b.deep,
    },
    doneCardId: {
      marginTop: 8,
      fontSize: t.label,
      color: b.textMuted,
    },
  }),
);

export default AddPropertyScreen;
