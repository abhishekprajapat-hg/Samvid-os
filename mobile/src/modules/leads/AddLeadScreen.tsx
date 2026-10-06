import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Glyph } from "../../components/ui/Glyph";
import { AppSheet } from "../../components/ui/Overlay";
import {
  FieldCol,
  FieldLabel,
  FieldRow,
  SectionCard,
  SelectField,
  TextField,
  Toggle,
} from "../../components/ui/form";
import { useAuth } from "../../context/AuthContext";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import { toErrorMessage } from "../../utils/errorMessage";
import { addLeadDiaryEntry, assignLead, createLead, getAllLeads } from "../../services/leadService";
import { getUsers } from "../../services/userService";
import { scheduleLocalReminder } from "../../services/pushNotifications";
import {
  FURNISHING_OPTIONS,
  LEAD_SOURCE_CHANNELS,
  PROPERTY_REQUIREMENT_CONFIG,
} from "../../config/propertyRequirementConfig";
import { BrokerPhoneHint } from "./components/BrokerPhoneHint";
import {
  sanitizeRequirementSubtypeData,
  toCoworkingDraft,
  toCoworkingPayload,
  toPreferredLocationsList,
  validateLeadRequirementDraft,
  withSubtypeField,
  type CoworkingDraft,
} from "./leadRequirements";
import { getPropertySubtypeConfig } from "../../config/propertyRequirementConfig";
import { SubtypeFieldsEditor } from "../../components/common/SubtypeFieldsEditor";
import { CoworkingRequirementEditor } from "../../components/common/CoworkingRequirementEditor";
import { PlaceSuggestionList, usePlaceSuggestions, withPickedPlace } from "../../components/common/PlaceSuggestions";
import { resolvePlace, type PlaceSuggestion } from "../../services/placeSearch";
import { TEMPERATURE_CHOICES, initialsOf, temperatureTone, type Temperature } from "./leadPipeline";
import { PhotoOverlay, profilePhotoOf } from "../../components/common/PhotoOverlay";

/*
 * Add Lead, drawn to the comp.
 *
 * It replaces the five-field modal the pipeline used to open. Everything the
 * comp asks for has a column behind it except the reminder, which is a
 * device-local notification (the backend schedules nothing), and the notes,
 * which become the lead's first diary entry - the Lead model has no notes
 * field, and the diary is where every later note goes anyway.
 */

const DRAFT_KEY = "leads.addLead.draft";

/*
 * The comp's country-code block. For +91 the national number is stored on its
 * own, which is what every existing row holds and what the create endpoint
 * dedupes on; any other code is prefixed, since those numbers are new either
 * way.
 */
const DIAL_CODES = [
  { value: "91", label: "+91" },
  { value: "971", label: "+971" },
  { value: "65", label: "+65" },
  { value: "44", label: "+44" },
  { value: "1", label: "+1" },
];

/*
 * One select for what the comp calls "Property type", over the two columns the
 * model keeps: inventory type and subtype, encoded as "COMMERCIAL:OFFICE".
 */
type PropertyOption = { value: string; label: string };

const PROPERTY_OPTIONS: PropertyOption[] = [
  ...Object.entries(PROPERTY_REQUIREMENT_CONFIG).flatMap(([inventoryType, group]: [string, any]) =>
    Object.entries(group.subtypes || {}).map(([subtype, config]: [string, any]) => ({
      value: `${inventoryType}:${subtype}`,
      label: `${group.label} ${config.label}`,
    })),
  ),
  /* Coworking has no subtypes; its requirement is cabins and terms. */
  { value: "COWORKING:", label: "Coworking" },
];

/*
 * Web's availableLeadInventoryTypes: an admin or an all-categories user files
 * into every pipeline; anyone tied to one category gets that one, because the
 * server refuses the others.
 */
const propertyOptionsFor = (role: string, rawRoleType: string) => {
  const roleType = ["RESIDENTIAL", "BOTH", "COWORKING"].includes(rawRoleType) ? rawRoleType : "COMMERCIAL";
  if (role === "ADMIN" || roleType === "BOTH") return PROPERTY_OPTIONS;
  return PROPERTY_OPTIONS.filter((option) => option.value.split(":")[0] === roleType);
};

const SITE_VISIT_RADIUS_METERS = 200;

const TRANSACTION_OPTIONS = [
  { value: "RENT", label: "For Rent" },
  { value: "LEASE", label: "For Lease" },
  { value: "SALE", label: "For Sale" },
];

const CUSTOM = "__CUSTOM__";

const AREA_OPTIONS = [
  { value: "0:500", label: "Up to 500 sq ft" },
  { value: "500:1000", label: "500–1,000 sq ft" },
  { value: "1000:1500", label: "1,000–1,500 sq ft" },
  { value: "1500:2500", label: "1,500–2,500 sq ft" },
  { value: "2500:5000", label: "2,500–5,000 sq ft" },
  { value: "5000:0", label: "5,000+ sq ft" },
  { value: CUSTOM, label: "Custom range…" },
];

const RENT_BUDGET_OPTIONS = [
  { value: "0:25000", label: "Up to ₹25K / month" },
  { value: "25000:40000", label: "₹25K–₹40K / month" },
  { value: "40000:60000", label: "₹40K–₹60K / month" },
  { value: "60000:80000", label: "₹60K–₹80K / month" },
  { value: "80000:120000", label: "₹80K–₹1.2L / month" },
  { value: "120000:0", label: "₹1.2L+ / month" },
  { value: CUSTOM, label: "Custom range…" },
];

const SALE_BUDGET_OPTIONS = [
  { value: "0:2500000", label: "Up to ₹25L" },
  { value: "2500000:5000000", label: "₹25L–₹50L" },
  { value: "5000000:10000000", label: "₹50L–₹1Cr" },
  { value: "10000000:20000000", label: "₹1Cr–₹2Cr" },
  { value: "20000000:0", label: "₹2Cr+" },
  { value: CUSTOM, label: "Custom range…" },
];

const REMINDER_OPTIONS = [
  { value: "0", label: "At the time" },
  { value: "15", label: "15 minutes before" },
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
];

/* The comp writes September as "Sept". */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

/** "23 Sept 2026" - the comp prints the date, not "Tomorrow". */
const dayOptions = () =>
  Array.from({ length: 21 }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { value, label: `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}` };
  });

const TIME_OPTIONS = Array.from({ length: 24 }, (_, index) => {
  const hour = 8 + Math.floor(index / 2);
  const minute = index % 2 ? 30 : 0;
  if (hour > 20) return null;
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour;
  return {
    value: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    label: `${display}:${String(minute).padStart(2, "0")} ${suffix}`,
  };
}).filter(Boolean) as Array<{ value: string; label: string }>;

const digitsOnly = (value: string) => value.replace(/\D/g, "");

const parseRange = (value: string): { min: number | null; max: number | null } => {
  const [min, max] = String(value || "").split(":");
  return {
    min: Number(min) > 0 ? Number(min) : null,
    max: Number(max) > 0 ? Number(max) : null,
  };
};

/*
 * The comp draws the country code and the number as one box with a divider,
 * not two fields - at half the gutter width two boxes leave the number about
 * three digits of room.
 */
const PhoneField = ({
  code,
  onCodeChange,
  value,
  onChangeText,
}: {
  code: string;
  onCodeChange: (next: string) => void;
  value: string;
  onChangeText: (next: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const selected = DIAL_CODES.find((entry) => entry.value === code) || DIAL_CODES[0];

  return (
    <View style={styles.group}>
      <FieldLabel label="Mobile number" required />
      <View style={styles.phoneShell}>
        <Pressable
          style={styles.dialBlock}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Country code"
        >
          <Text style={styles.dialText}>{selected.label}</Text>
          <Glyph name="chevron-down" size={15} color={brand.textSecondary} />
        </Pressable>
        <View style={styles.dialDivider} />
        <Glyph name="call-outline" size={17} color={brand.textSecondary} />
        <TextInput
          style={styles.phoneInput}
          value={value}
          onChangeText={onChangeText}
          placeholder="98765 43210"
          placeholderTextColor={brand.placeholder}
          keyboardType="phone-pad"
        />
      </View>

      <AppSheet visible={open} onClose={() => setOpen(false)} title="Country code">
        {DIAL_CODES.map((entry) => (
          <Pressable
            key={entry.value}
            style={styles.dialOption}
            onPress={() => {
              onCodeChange(entry.value);
              setOpen(false);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.dialOptionText}>{entry.label}</Text>
            {entry.value === code ? <Glyph name="checkmark" size={18} color={brand.primary} /> : null}
          </Pressable>
        ))}
      </AppSheet>
    </View>
  );
};

/* --------------------------------------------------------- temperature -- */

/*
 * The comp calls the coldest step "Low" here and "Cold" on Update Lead. Same
 * column either way, so the label is per-screen.
 */
const PRIORITY_LABELS: Record<string, string> = { COLD: "Low", WARM: "Warm", HOT: "Hot" };

/** The comp's Priority control: three segments, each in its own state colour. */
const TemperatureField = ({
  value,
  onChange,
}: {
  value: Temperature;
  onChange: (next: Temperature) => void;
}) => (
  <View style={styles.group}>
    <FieldLabel label="Priority" required />
    <View style={styles.tempRow}>
      {TEMPERATURE_CHOICES.map((choice) => {
        const active = value === choice.key;
        const tone = temperatureTone(choice.key);
        return (
          <Pressable
            key={choice.key}
            style={[
              styles.tempItem,
              active && { backgroundColor: tone.bg, borderColor: tone.fg },
            ]}
            onPress={() => onChange(choice.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.tempLabel, active && { color: tone.fg, fontWeight: "700" }]}>
              {PRIORITY_LABELS[choice.key] || choice.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  </View>
);

/* -------------------------------------------------------------- screen -- */

export const AddLeadScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, role } = useAuth();
  const propertyOptions = useMemo(
    () => propertyOptionsFor(String(role || "").toUpperCase(), String((user as any)?.roleType || "").toUpperCase()),
    [role, user],
  );

  const [name, setName] = useState("");
  const [dialCode, setDialCode] = useState("91");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [workProfile, setWorkProfile] = useState("");

  const [property, setProperty] = useState("");
  const [transaction, setTransaction] = useState("RENT");
  const [location, setLocation] = useState("");
  const [area, setArea] = useState("");
  const [areaMin, setAreaMin] = useState("");
  const [areaMax, setAreaMax] = useState("");
  const [budget, setBudget] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [furnishing, setFurnishing] = useState("");
  /* Web's subtype preferences and coworking terms. */
  const [subtypeData, setSubtypeData] = useState<Record<string, unknown>>({});
  const [coworking, setCoworking] = useState<CoworkingDraft>(() => toCoworkingDraft({}));
  /* Web's "Location" box on a new lead: localities, comma separated. */
  const [preferredLocations, setPreferredLocations] = useState("");
  const [siteLat, setSiteLat] = useState("");
  const [siteLng, setSiteLng] = useState("");
  /* Suggestions only when Google is configured, as on web; otherwise typing. */
  const localityPlaces = usePlaceSuggestions(preferredLocations, { mode: "google-only", multiValue: true });
  const pickLocality = async (suggestion: PlaceSuggestion) => {
    const next = withPickedPlace(preferredLocations, suggestion.label, true);
    localityPlaces.markChosen(next);
    setPreferredLocations(next);
    const resolved = await resolvePlace(suggestion);
    /* Coordinates only exist for a picked place; a typed one leaves them alone. */
    if (resolved?.lat !== undefined && resolved?.lng !== undefined) {
      setSiteLat(String(resolved.lat));
      setSiteLng(String(resolved.lng));
    }
  };

  const [sourceChannel, setSourceChannel] = useState("");
  const [temperature, setTemperature] = useState<Temperature>("WARM");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");

  const [scheduleFollowUp, setScheduleFollowUp] = useState(true);
  const [date, setDate] = useState(dayOptions()[1].value);
  const [time, setTime] = useState("11:00");
  const [reminder, setReminder] = useState("30");

  const [users, setUsers] = useState<Array<{ _id?: string; name: string; role?: string; isActive?: boolean }>>([]);
  /* The places this company already has leads in, for the comp's location select. */
  const [knownLocations, setKnownLocations] = useState<string[]>([]);
  const [locationCustom, setLocationCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const payload = await getUsers();
        setUsers(payload?.users || []);
      } catch {
        /* The assignee list is a convenience; the lead can be created without it. */
      }

      try {
        const rows = await getAllLeads({ limit: 200 });
        const cities = Array.from(
          new Set(
            (Array.isArray(rows) ? rows : [])
              .map((row) => String(row.city || "").trim())
              .filter(Boolean),
          ),
        ).sort((a, b) => a.localeCompare(b));
        setKnownLocations(cities);
        if (!cities.length) setLocationCustom(true);
      } catch {
        /* No list means typing it, which is what the field falls back to. */
        setLocationCustom(true);
      }
    })();
  }, []);

  /* ------------------------------------------------------------- draft -- */

  const snapshot = useMemo(
    () => ({
      name, dialCode, phone, email, company,
      property, transaction, location,
      area, areaMin, areaMax, budget, budgetMin, budgetMax, furnishing,
      sourceChannel, temperature, assignedTo, notes,
      scheduleFollowUp, date, time, reminder,
      subtypeData, coworking, preferredLocations, siteLat, siteLng,
    }),
    [name, dialCode, phone, email, company, property, transaction, location, area, areaMin,
      areaMax, budget, budgetMin, budgetMax, furnishing, sourceChannel, temperature, assignedTo,
      notes, scheduleFollowUp, date, time, reminder, subtypeData, coworking, preferredLocations,
      siteLat, siteLng],
  );

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        setName(draft.name || "");
        setDialCode(draft.dialCode || "91");
        setPhone(draft.phone || "");
        setEmail(draft.email || "");
        setCompany(draft.company || "");
        setProperty(draft.property || "");
        setTransaction(draft.transaction || "RENT");
        setLocation(draft.location || "");
        setArea(draft.area || "");
        setAreaMin(draft.areaMin || "");
        setAreaMax(draft.areaMax || "");
        setBudget(draft.budget || "");
        setBudgetMin(draft.budgetMin || "");
        setBudgetMax(draft.budgetMax || "");
        setFurnishing(draft.furnishing || "");
        setSourceChannel(draft.sourceChannel || "");
        setTemperature(draft.temperature || "WARM");
        setAssignedTo(draft.assignedTo || "");
        setNotes(draft.notes || "");
        setScheduleFollowUp(draft.scheduleFollowUp !== false);
        if (draft.date) setDate(draft.date);
        if (draft.time) setTime(draft.time);
        if (draft.reminder) setReminder(draft.reminder);
        if (draft.subtypeData && typeof draft.subtypeData === "object") setSubtypeData(draft.subtypeData);
        if (draft.coworking) setCoworking(toCoworkingDraft(draft.coworking));
        setPreferredLocations(draft.preferredLocations || "");
        setSiteLat(draft.siteLat || "");
        setSiteLng(draft.siteLng || "");
      } catch {
        /* A draft that will not parse is not worth blocking a new lead over. */
      }
    })();
  }, []);

  const saveDraft = useCallback(async () => {
    try {
      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
      Alert.alert("Draft saved", "It will be here when you come back.");
    } catch {
      Alert.alert("Draft", "Could not save the draft on this device.");
    }
  }, [snapshot]);

  /* ------------------------------------------------------------ submit -- */

  const assignableUsers = useMemo(
    () => users.filter((row) => row.isActive !== false && row._id),
    [users],
  );

  const budgetOptions = transaction === "SALE" ? SALE_BUDGET_OPTIONS : RENT_BUDGET_OPTIONS;

  const submit = async () => {
    const safeName = name.trim();
    const safePhone = digitsOnly(phone);

    if (!safeName) {
      setError("Full name is required");
      return;
    }
    if (safePhone.length < 7 || safePhone.length > 15) {
      setError("Mobile number should be 7 to 15 digits");
      return;
    }
    if (!property) {
      setError("Property type is required");
      return;
    }
    if (!location.trim()) {
      setError("Location is required");
      return;
    }

    const [inventoryType, propertySubtype = ""] = property.split(":");
    const requirementError = validateLeadRequirementDraft({
      inventoryType,
      propertySubtype,
      budgetMin: budget === CUSTOM ? budgetMin : "",
      budgetMax: budget === CUSTOM ? budgetMax : "",
      subtypeData,
    });
    if (requirementError) {
      setError(requirementError);
      return;
    }
    const lat = siteLat.trim() === "" ? null : Number(siteLat);
    const lng = siteLng.trim() === "" ? null : Number(siteLng);
    if ((lat !== null && !Number.isFinite(lat)) || (lng !== null && !Number.isFinite(lng))) {
      setError("Site latitude and longitude must be numbers");
      return;
    }
    const areaRange = area === CUSTOM
      ? { min: Number(areaMin) || null, max: Number(areaMax) || null }
      : parseRange(area);
    const budgetRange = budget === CUSTOM
      ? { min: Number(budgetMin) || null, max: Number(budgetMax) || null }
      : parseRange(budget);

    const followUpAt = scheduleFollowUp ? new Date(`${date}T${time}:00`) : null;
    if (followUpAt && Number.isNaN(followUpAt.getTime())) {
      setError("That follow-up date and time could not be read");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const created = await createLead({
        name: safeName,
        phone: dialCode === "91" ? safePhone : `${dialCode}${safePhone}`,
        email: email.trim(),
        city: location.trim(),
        company: company.trim(),
        clientProfession: workProfile.trim(),
        sourceChannel,
        temperature: temperature || "WARM",
        requirements: {
          inventoryType: inventoryType as "COMMERCIAL" | "RESIDENTIAL" | "COWORKING",
          propertySubtype,
          transactionType: transaction as "SALE" | "LEASE" | "RENT",
          furnishingStatus: furnishing,
          areaUnit: "SQ_FT",
          areaMin: areaRange.min,
          areaMax: areaRange.max,
          budgetMin: budgetRange.min,
          budgetMax: budgetRange.max,
          subtypeData: sanitizeRequirementSubtypeData(subtypeData),
          ...(inventoryType === "COWORKING" ? { coworking: toCoworkingPayload(coworking) } : {}),
        },
        preferredLocations: toPreferredLocationsList(preferredLocations),
        ...(lat !== null || lng !== null
          ? { siteLocation: { lat, lng, radiusMeters: SITE_VISIT_RADIUS_METERS } }
          : {}),
        ...(followUpAt ? { nextFollowUp: followUpAt.toISOString() } : {}),
      });

      /*
       * Assignment, the note and the reminder are all follow-on work: the lead
       * exists either way, so none of them is allowed to fail the create.
       */
      if (assignedTo && created?._id) {
        await assignLead(created._id, assignedTo).catch(() => undefined);
      }
      if (notes.trim() && created?._id) {
        await addLeadDiaryEntry(created._id, { note: notes.trim() }).catch(() => undefined);
      }
      if (followUpAt) {
        const lead = Math.max(0, Number(reminder) || 0);
        await scheduleLocalReminder(new Date(followUpAt.getTime() - lead * 60000), {
          title: `Follow up with ${safeName}`,
          body: location.trim() ? `${safeName} · ${location.trim()}` : safeName,
          data: { url: created?._id ? `/leads/${created._id}` : "/leads" },
        });
      }

      await AsyncStorage.removeItem(DRAFT_KEY).catch(() => undefined);
      navigation.goBack();
    } catch (e) {
      setError(toErrorMessage(e, "Failed to create lead"));
    } finally {
      setSaving(false);
    }
  };

  const assignee = assignableUsers.find((row) => row._id === assignedTo);

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Glyph name="arrow-back" size={24} color={brand.text} />
        </Pressable>
        <Text style={styles.barTitle}>Add Lead</Text>
        <Pressable onPress={saveDraft} hitSlop={10} accessibilityRole="button">
          <Text style={styles.barAction}>Save draft</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.grow}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <SectionCard title="Contact Details">
            <FieldRow>
              <FieldCol>
                <TextField
                  label="Full name"
                  required
                  icon="person-outline"
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter full name"
                  autoCapitalize="words"
                />
              </FieldCol>
              <FieldCol>
                <PhoneField
                  code={dialCode}
                  onCodeChange={setDialCode}
                  value={phone}
                  onChangeText={(next) => setPhone(digitsOnly(next))}
                />
              </FieldCol>
            </FieldRow>
            <BrokerPhoneHint phone={phone} />

            <TextField
              label="Email"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="name@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextField
              label="Company"
              icon="business-outline"
              value={company}
              onChangeText={setCompany}
              placeholder="Enter company name"
              autoCapitalize="words"
            />
            <TextField
              label="Work profile"
              icon="briefcase-outline"
              value={workProfile}
              onChangeText={setWorkProfile}
              placeholder="e.g. Marketing, Lawyer, DSA"
              autoCapitalize="words"
            />
          </SectionCard>

          <SectionCard title="Requirement">
            <FieldRow>
              <FieldCol>
                <SelectField
                  label="Property type"
                  required
                  icon="business-outline"
                  value={property}
                  options={propertyOptions}
                  onChange={(next) => {
                    setProperty(next);
                    setSubtypeData({});
                  }}
                  placeholder="Select"
                />
              </FieldCol>
              <FieldCol>
                <SelectField
                  label="Transaction"
                  required
                  icon="pricetag-outline"
                  value={transaction}
                  options={TRANSACTION_OPTIONS}
                  onChange={setTransaction}
                />
              </FieldCol>
            </FieldRow>

            {locationCustom ? (
              <TextField
                label="Location"
                required
                icon="location-outline"
                value={location}
                onChangeText={setLocation}
                placeholder="Area, city"
                autoCapitalize="words"
                trailing={
                  knownLocations.length ? (
                    <Pressable
                      onPress={() => {
                        setLocationCustom(false);
                        setLocation("");
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Pick from the list"
                    >
                      <Glyph name="list-outline" size={18} color={brand.textSecondary} />
                    </Pressable>
                  ) : undefined
                }
              />
            ) : (
              <SelectField
                label="Location"
                required
                icon="location-outline"
                value={location}
                options={[
                  ...knownLocations.map((city) => ({ value: city, label: city })),
                  { value: CUSTOM, label: "Somewhere else\u2026" },
                ]}
                onChange={(next) => {
                  if (next === CUSTOM) {
                    setLocationCustom(true);
                    setLocation("");
                    return;
                  }
                  setLocation(next);
                }}
                placeholder="Select"
              />
            )}

            <FieldRow>
              <FieldCol>
                <SelectField
                  label="Area (sq ft)"
                  required
                  icon="resize-outline"
                  value={area}
                  options={AREA_OPTIONS}
                  onChange={setArea}
                  placeholder="Select"
                />
                {area === CUSTOM ? (
                  <FieldRow>
                    <FieldCol>
                      <TextField
                        value={areaMin}
                        onChangeText={(next) => setAreaMin(digitsOnly(next))}
                        placeholder="Min"
                        keyboardType="number-pad"
                      />
                    </FieldCol>
                    <FieldCol>
                      <TextField
                        value={areaMax}
                        onChangeText={(next) => setAreaMax(digitsOnly(next))}
                        placeholder="Max"
                        keyboardType="number-pad"
                      />
                    </FieldCol>
                  </FieldRow>
                ) : null}
              </FieldCol>
              <FieldCol>
                <SelectField
                  label="Budget"
                  required
                  leading={<Text style={styles.rupee}>{"\u20b9"}</Text>}
                  value={budget}
                  options={budgetOptions}
                  onChange={setBudget}
                  placeholder="Select"
                />
                {budget === CUSTOM ? (
                  <FieldRow>
                    <FieldCol>
                      <TextField
                        value={budgetMin}
                        onChangeText={(next) => setBudgetMin(digitsOnly(next))}
                        placeholder="Min"
                        keyboardType="number-pad"
                      />
                    </FieldCol>
                    <FieldCol>
                      <TextField
                        value={budgetMax}
                        onChangeText={(next) => setBudgetMax(digitsOnly(next))}
                        placeholder="Max"
                        keyboardType="number-pad"
                      />
                    </FieldCol>
                  </FieldRow>
                ) : null}
              </FieldCol>
            </FieldRow>

            {(getPropertySubtypeConfig(property.split(":")[0], property.split(":")[1] || "") as any)?.showFurnishing === false ? null : (
              <SelectField
                label="Furnishing"
                icon="bed-outline"
                value={furnishing}
                options={FURNISHING_OPTIONS}
                onChange={setFurnishing}
              />
            )}

            <SubtypeFieldsEditor
              config={getPropertySubtypeConfig(property.split(":")[0], property.split(":")[1] || "")}
              value={subtypeData}
              onChange={(key, next) => setSubtypeData((prev) => withSubtypeField(prev, key, next))}
            />
            {property.startsWith("COWORKING") ? (
              <CoworkingRequirementEditor value={coworking} onChange={setCoworking} />
            ) : null}

            <TextField
              label="Preferred localities"
              icon="map-outline"
              value={preferredLocations}
              onChangeText={setPreferredLocations}
              placeholder="Search a locality, or type several separated by comma"
              autoCapitalize="words"
            />
            <PlaceSuggestionList rows={localityPlaces.rows} loading={localityPlaces.loading} onPick={pickLocality} />
            <FieldRow>
              <FieldCol>
                <TextField
                  label="Site latitude"
                  value={siteLat}
                  onChangeText={setSiteLat}
                  placeholder="Optional"
                  keyboardType="numbers-and-punctuation"
                />
              </FieldCol>
              <FieldCol>
                <TextField
                  label="Site longitude"
                  value={siteLng}
                  onChangeText={setSiteLng}
                  placeholder="Optional"
                  keyboardType="numbers-and-punctuation"
                />
              </FieldCol>
            </FieldRow>
          </SectionCard>

          <SectionCard title="Lead Details">
            <FieldRow>
              <FieldCol>
                <SelectField
                  label="Source"
                  required
                  icon="megaphone-outline"
                  value={sourceChannel}
                  options={LEAD_SOURCE_CHANNELS}
                  onChange={setSourceChannel}
                />
              </FieldCol>
              <FieldCol>
                <TemperatureField value={temperature} onChange={setTemperature} />
              </FieldCol>
            </FieldRow>

            <FieldRow>
              <FieldCol>
                <SelectField
                  label="Assigned to"
                  required
                  value={assignedTo}
                  options={[
                    { value: "", label: "Unassigned" },
                    ...assignableUsers.map((row) => ({ value: String(row._id), label: row.name })),
                  ]}
                  onChange={setAssignedTo}
                  leading={
                    assignee ? (
                      <View style={styles.assigneeAvatar}>
                        <Text style={styles.assigneeAvatarText}>{initialsOf(assignee.name)}</Text>
                        <PhotoOverlay uri={profilePhotoOf(assignee)} />
                      </View>
                    ) : undefined
                  }
                />
              </FieldCol>
              <FieldCol>
                <TextField
                  label="Notes"
                  icon="document-text-outline"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="What did they ask for?"
                  multiline
                />
              </FieldCol>
            </FieldRow>
          </SectionCard>

          <SectionCard>
            <Text style={styles.cardTitle}>Follow-up</Text>
            <View style={styles.followRow}>
              <Glyph name="calendar-outline" size={19} color={brand.primary} />
              <Text style={styles.followLabel}>Schedule follow-up</Text>
              <Toggle value={scheduleFollowUp} onValueChange={setScheduleFollowUp} />
            </View>

            {scheduleFollowUp ? (
              <FieldRow>
                <FieldCol>
                  <SelectField
                    label="Date"
                    required
                    icon="calendar-outline"
                    value={date}
                    options={dayOptions()}
                    onChange={setDate}
                  />
                </FieldCol>
                <FieldCol>
                  <SelectField
                    label="Time"
                    required
                    icon="time-outline"
                    value={time}
                    options={TIME_OPTIONS}
                    onChange={setTime}
                  />
                </FieldCol>
                <FieldCol>
                  <SelectField
                    label="Reminder"
                    required
                    icon="notifications-outline"
                    value={reminder}
                    options={REMINDER_OPTIONS}
                    onChange={setReminder}
                  />
                </FieldCol>
              </FieldRow>
            ) : null}

            {/*
             * The reminder is scheduled on this phone. The backend has no
             * scheduler, so saying otherwise would promise a notification that
             * never arrives on another device.
             */}
            {scheduleFollowUp ? (
              <Text style={styles.followNote}>Reminder is set on this device.</Text>
            ) : null}
          </SectionCard>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            style={[styles.submit, saving && styles.submitOff]}
            onPress={submit}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={styles.submitText}>{saving ? "Adding…" : "Add lead"}</Text>
            {!saving ? <Glyph name="arrow-forward" size={18} color={brand.onPrimary} /> : null}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: b.bg,
    },
    grow: {
      flex: 1,
      minWidth: 0,
    },
    group: {
      marginBottom: layout.fieldGap,
    },

    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: layout.gutter,
      paddingTop: 6,
      paddingBottom: 12,
    },
    barTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: t.hero,
      lineHeight: 25,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: b.text,
    },
    barAction: {
      fontSize: t.field,
      fontWeight: "700",
      color: b.primary,
    },

    body: {
      paddingHorizontal: layout.gutter,
      paddingBottom: 24,
      gap: 12,
    },
    error: {
      fontSize: t.body,
      lineHeight: 17,
      color: b.alert,
    },
    cardTitle: {
      marginBottom: 12,
      fontSize: t.barTitle,
      lineHeight: 22,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },

    phoneShell: {
      flexDirection: "row",
      alignItems: "center",
      /* Tight on purpose: at half the gutter width the code block, the divider,
         the glyph and ten digits have about 185pt between them. */
      gap: 6,
      height: layout.fieldHeight,
      paddingRight: 10,
      borderWidth: 1,
      borderColor: b.fieldBorder,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    dialBlock: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 8,
    },
    dialText: {
      fontSize: t.body,
      fontWeight: "500",
      color: b.text,
    },
    dialDivider: {
      width: 1,
      height: 22,
      backgroundColor: b.fieldBorder,
    },
    phoneInput: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 0,
      fontSize: t.body,
      color: b.text,
    },
    dialOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: b.hairline,
    },
    dialOptionText: {
      fontSize: t.field,
      color: b.text,
    },

    assigneeAvatar: {
      width: 26,
      height: 26,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    assigneeAvatarText: {
      fontSize: t.tagline,
      fontWeight: "700",
      color: b.deep,
    },

    rupee: {
      width: 18,
      textAlign: "center",
      fontSize: t.sectionTitle,
      color: b.textSecondary,
    },
    tempRow: {
      flexDirection: "row",
      gap: 6,
    },
    tempItem: {
      flex: 1,
      minWidth: 0,
      height: layout.fieldHeight,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.fieldMuted,
    },
    tempLabel: {
      fontSize: t.body,
      fontWeight: "500",
      color: b.textSecondary,
    },

    followRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 14,
    },
    followLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: t.field,
      fontWeight: "600",
      color: b.text,
    },
    followNote: {
      fontSize: t.body,
      color: b.textMuted,
    },

    footer: {
      paddingHorizontal: layout.gutter,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: b.hairline,
      backgroundColor: b.bg,
    },
    submit: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      height: 50,
      borderRadius: round.field,
      backgroundColor: "#0b7d52",
    },
    submitOff: {
      opacity: 0.6,
    },
    submitText: {
      fontSize: t.sectionTitle,
      fontWeight: "700",
      color: b.onPrimary,
    },
  }),
);

export default AddLeadScreen;
