import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import { AppSheet } from "../../components/ui/Overlay";
import { getAllLeads } from "../../services/leadService";
import { getUsers } from "../../services/userService";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionContext";
import { toErrorMessage } from "../../utils/errorMessage";
import { shareTextFile } from "../../utils/shareFile";
import { formatDate } from "../../utils/format";
import { buildLeadExportCsv } from "./bulkLeadUpload";
import { LeadBulkUploadSheet } from "./components/LeadBulkUploadSheet";
import { PipelineTeam } from "./components/PipelineTeam";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import type { Lead } from "../../types";
import { LeadFiltersSheet } from "./components/LeadFiltersSheet";
import {
  EMPTY_LEAD_FILTERS,
  countActiveFilters,
  toLeadQueryParams,
  type LeadFilterState,
} from "./leadFilters";
import { isNeedsAction } from "./pipelineViews";
import {
  STAGES,
  assigneeOf,
  avatarTone,
  budgetLabel,
  displayPhone,
  followUpLabel,
  initialsOf,
  isOverdue,
  propertyLine,
  sourceTone,
  stageOf,
  temperatureOf,
  temperatureTone,
  type StageKey,
} from "./leadPipeline";
import { PhotoOverlay } from "../../components/common/PhotoOverlay";

/*
 * The pipeline, drawn to the comp.
 *
 * Board browses one stage at a time - the chip row picks it, the section below
 * shows the first few and "See all" opens the rest; List drops the chips and
 * runs the whole filtered set. The stage chips are a view over the status
 * enum, not a replacement for it: see leadPipeline.ts.
 *
 * Filtering stays on the server, as it is on web. The chips and the search box
 * narrow what has already been fetched; the funnel button opens the sheet that
 * re-queries.
 */

/* The full status list the filter sheet offers, unchanged from web. */
const LEAD_STATUSES = [
  "ALL",
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "SITE_VISIT_SCHEDULED",
  "SITE_VISIT",
  "SITE_VISIT_OVERDUE",
  "MISSING_IN_ACTION",
  "NOT_PICKING_CALLS",
  "INVALID",
  "OWNER",
  "BROKER",
  "REQUESTED",
  "CLOSED",
  "LOST",
];

const EXECUTIVE_ROLES = new Set(["EXECUTIVE", "FIELD_EXECUTIVE"]);
const ADD_LEAD_ROLES = new Set(["ADMIN", "MANAGER", "EXECUTIVE", "FIELD_EXECUTIVE", "CHANNEL_PARTNER"]);
/* Web's canBulkUploadLeads: admin, management and the executives. */
const BULK_UPLOAD_ROLES = new Set(["ADMIN", "MANAGER", "EXECUTIVE", "FIELD_EXECUTIVE"]);

const statusLabel = (status?: string) =>
  String(status || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());

/** How many a stage shows before "See all" takes over. */
const BOARD_PREVIEW = 6;

const toDigits = (value?: string) => String(value || "").replace(/\D/g, "");

const toLocalTenDigitPhone = (value?: string) => {
  const digits = toDigits(value);
  if (digits.length < 10) return "";
  return digits.slice(-10);
};

const toWhatsAppPhone = (value?: string) => {
  const digits = toDigits(value);
  if (digits.length < 10) return "";
  return digits.length === 10 ? `91${digits}` : digits;
};

/* ------------------------------------------------------------- pieces -- */

const StatTile = ({
  icon,
  tint,
  color,
  valueColor,
  label,
  value,
}: {
  icon: GlyphName;
  tint: string;
  color: string;
  valueColor?: string;
  label: string;
  value: string;
}) => (
  <View style={styles.statTile}>
    <View style={[styles.statIcon, { backgroundColor: tint }]}>
      <Glyph name={icon} size={17} color={color} />
    </View>
    <Text style={styles.statLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={[styles.statValue, { color: valueColor || color }]} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const MetaRow = ({ icon, text, tone }: { icon: GlyphName; text: string; tone?: string }) => (
  <View style={styles.metaRow}>
    <Glyph name={icon} size={14} color={tone || brand.textSecondary} />
    <Text style={[styles.metaText, tone ? { color: tone } : null]} numberOfLines={1}>
      {text}
    </Text>
  </View>
);

/* ------------------------------------------------------------- screen -- */

export const LeadsMatrixScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { role, user } = useAuth();
  const { canPageAction, enforcePageAccess } = usePermissions();
  const normalizedRole = String(role || "").toUpperCase();
  const canAddLead = ADD_LEAD_ROLES.has(normalizedRole);
  /*
   * Web's rules, verbatim: export needs the page's export action; bulk upload
   * needs its create action, and either a role that could always do it or an
   * explicit per-employee grant.
   */
  const canExportLeads = canPageAction("leads", "export");
  const canBulkUpload = canPageAction("leads", "create") && (BULK_UPLOAD_ROLES.has(normalizedRole) || enforcePageAccess);
  const bulkSheetTypes = useMemo(() => {
    const roleType = String((user as any)?.roleType || "").toUpperCase();
    const all = [
      { label: "Commercial", value: "COMMERCIAL" },
      { label: "Residential", value: "RESIDENTIAL" },
    ];
    if (normalizedRole === "ADMIN" || roleType === "BOTH") return all;
    const own = all.filter((option) => option.value === roleType);
    return own.length ? own : [all[0]];
  }, [normalizedRole, user]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"BOARD" | "LIST" | "TEAM">("BOARD");
  /* Web's row checkboxes: a long press starts selecting, a tap then toggles. */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [stage, setStage] = useState<StageKey>("NEW");

  /*
   * Filters are applied by the server, as they are on web - filtering the rows
   * already downloaded would only ever filter a subset.
   */
  const [filters, setFilters] = useState<LeadFilterState>(EMPTY_LEAD_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<Array<{ _id?: string; name: string; role?: string; isActive?: boolean }>>([]);

  /* The comp replaces the row's inline actions with a kebab; this is its sheet. */
  const [actionLead, setActionLead] = useState<Lead | null>(null);

  const load = useCallback(
    async (silent = false) => {
      try {
        if (silent) setRefreshing(true);
        else setLoading(true);

        setError("");
        const [leadRows, userPayload] = await Promise.all([
          getAllLeads(toLeadQueryParams(filters)),
          getUsers(),
        ]);
        setLeads(Array.isArray(leadRows) ? leadRows : []);
        setUsers(userPayload?.users || []);
      } catch (e) {
        setError(toErrorMessage(e, "Failed to load leads"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    load();
  }, [load]);

  /* A lead added or updated on its own page should be here on the way back. */
  useFocusEffect(
    useCallback(() => {
      void load(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  useEffect(() => {
    const params = route.params || {};
    const initialQuery = String(params.initialQuery || "");
    if (initialQuery) setQuery(initialQuery);

    const initialStatus = String(params.initialStatus || "").toUpperCase();
    const preset = String(params.filterPreset || "").toUpperCase();

    if (preset === "DUE_FOLLOWUP") {
      setMode("LIST");
      setFilters((prev) => ({ ...prev, quickFilter: "NEEDS_FOLLOW_UP_TODAY" }));
      return;
    }
    if (preset === "PIPELINE") {
      setMode("LIST");
      return;
    }
    if (initialStatus && LEAD_STATUSES.includes(initialStatus)) {
      const target = STAGES.find((entry) => entry.statuses.includes(initialStatus));
      if (target) {
        setStage(target.key);
        setMode("BOARD");
      }
    }
  }, [route.params]);

  /* ----------------------------------------------------------- derived -- */

  const searched = useMemo(() => {
    const key = query.trim().toLowerCase();
    if (!key) return leads;
    return leads.filter((lead) =>
      [lead.name, lead.phone, lead.email, lead.city, lead.projectInterested, lead.company]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(key)),
    );
  }, [leads, query]);

  const stageCounts = useMemo(() => {
    const counts = new Map<StageKey, number>();
    for (const lead of searched) {
      const key = stageOf(lead);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [searched]);

  const stageLeads = useMemo(
    () => searched.filter((lead) => stageOf(lead) === stage),
    [searched, stage],
  );

  const visible = mode === "BOARD" ? stageLeads.slice(0, BOARD_PREVIEW) : mode === "TEAM" ? [] : searched;
  const selecting = selectedIds.length > 0;

  const toggleSelected = (lead: Lead) =>
    setSelectedIds((current) =>
      current.includes(lead._id) ? current.filter((id) => id !== lead._id) : [...current, lead._id]);

  const exportSelected = async () => {
    const chosen = new Set(selectedIds);
    const rows = searched.filter((lead) => chosen.has(lead._id));
    if (!rows.length) return;
    try {
      await shareTextFile(
        `leads-${new Date().toISOString().slice(0, 10)}.csv`,
        buildLeadExportCsv(rows as any, statusLabel, (value) => formatDate(value)),
      );
    } catch (e) {
      setError(toErrorMessage(e, "Could not export the leads"));
    }
  };

  const stats = useMemo(() => {
    const nowMs = Date.now();
    const total = searched.length;
    const hot = searched.filter((lead) => temperatureOf(lead) === "HOT").length;
    const followUps = searched.filter((lead) => isNeedsAction(lead, nowMs)).length;
    const closed = searched.filter((lead) => String(lead.status || "") === "CLOSED").length;
    const conversion = total ? Math.round((closed / total) * 100) : 0;
    return { total, hot, followUps, conversion };
  }, [searched]);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const executiveUsers = useMemo(
    () => users.filter((u) => u.isActive !== false && EXECUTIVE_ROLES.has(String(u.role || ""))),
    [users],
  );

  /* ----------------------------------------------------------- actions -- */

  const openDialer = async (phone?: string) => {
    const dialNumber = toLocalTenDigitPhone(phone);
    if (!dialNumber) {
      Alert.alert("Invalid number", "Phone number must have at least 10 digits.");
      return;
    }
    const url = `tel:${dialNumber}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Dialer unavailable", "Could not open the phone dialer on this device.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Dial failed", "Unable to open dialer right now.");
    }
  };

  const openWhatsApp = async (phone?: string) => {
    const whatsappPhone = toWhatsAppPhone(phone);
    if (!whatsappPhone) {
      Alert.alert("Invalid number", "WhatsApp needs at least 10 digits.");
      return;
    }
    const appUrl = `whatsapp://send?phone=${whatsappPhone}`;
    const webUrl = `https://wa.me/${whatsappPhone}`;
    try {
      if (Platform.OS === "web") {
        await Linking.openURL(webUrl);
        return;
      }
      if (await Linking.canOpenURL(appUrl)) {
        await Linking.openURL(appUrl);
        return;
      }
      await Linking.openURL(webUrl);
    } catch {
      Alert.alert("WhatsApp unavailable", "Could not open WhatsApp chat for this lead.");
    }
  };

  const openMail = async (email?: string) => {
    const safeEmail = String(email || "").trim();
    if (!safeEmail) {
      Alert.alert("No email", "Email is not available for this lead.");
      return;
    }
    try {
      await Linking.openURL(`mailto:${safeEmail}`);
    } catch {
      Alert.alert("Mail failed", "Unable to open mail app right now.");
    }
  };

  const openMaps = async (lead: Lead) => {
    const place = [String(lead.projectInterested || "").trim(), String(lead.city || "").trim()]
      .filter(Boolean)
      .join(", ");
    if (!place) {
      Alert.alert("Location missing", "Lead location is not available.");
      return;
    }
    await Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(place)}`).catch(() => {
      Alert.alert("Maps unavailable", "Unable to open maps right now.");
    });
  };

  const openLead = (lead: Lead) =>
    navigation.navigate("LeadDetails", { leadId: lead._id, lead });

  /* ------------------------------------------------------------ render -- */

  const renderCard = ({ item }: { item: Lead }) => {
    const temperature = temperatureTone(temperatureOf(item));
    const source = sourceTone(item);
    const owner = assigneeOf(item);
    const property = propertyLine(item);
    const budget = budgetLabel(item);
    const place = [item.city, item.projectInterested].filter(Boolean).join(", ");
    const follow = followUpLabel(item.nextFollowUp);
    const late = isOverdue(item.nextFollowUp);

    return (
      <Pressable
        style={[styles.card, selectedIds.includes(item._id) && styles.cardSelected]}
        onPress={() => (selecting ? toggleSelected(item) : openLead(item))}
        onLongPress={() => toggleSelected(item)}
        delayLongPress={280}
        accessibilityRole="button"
        accessibilityState={{ selected: selectedIds.includes(item._id) }}
      >
        <View style={styles.cardAccent} />
        {selectedIds.includes(item._id) ? (
          <View style={styles.selectedMark}>
            <Glyph name="checkmark" size={13} color={brand.onPrimary} />
          </View>
        ) : null}

        <View style={styles.cardBody}>
          <View style={styles.cardHead}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialsOf(item.name || item.phone)}</Text>
            </View>

            <View style={styles.grow}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name || "Unnamed lead"}
              </Text>
              <View style={[styles.sourcePill, { backgroundColor: source.bg }]}>
                <Glyph name={source.icon as GlyphName} size={12} color={source.fg} />
                <Text style={[styles.sourceText, { color: source.fg }]} numberOfLines={1}>
                  {source.label}
                </Text>
              </View>
            </View>

            <View style={[styles.tempPill, { backgroundColor: temperature.bg }]}>
              <Text style={[styles.tempText, { color: temperature.fg }]}>{temperature.label}</Text>
            </View>

            <Pressable
              hitSlop={8}
              style={styles.kebab}
              onPress={() => setActionLead(item)}
              accessibilityRole="button"
              accessibilityLabel={`Actions for ${item.name || "lead"}`}
            >
              <Glyph name="ellipsis-horizontal" size={17} color={brand.textMuted} />
            </Pressable>
          </View>

          <View style={styles.cardSplit}>
            <View style={styles.grow}>
              <MetaRow icon="call-outline" text={displayPhone(item.phone) || "No phone"} />
              {property ? <MetaRow icon="business-outline" text={property} /> : null}
              {place ? <MetaRow icon="location-outline" text={place} /> : null}
              {budget ? <MetaRow icon="briefcase-outline" text={budget} /> : null}
              <MetaRow
                icon="calendar-outline"
                text={follow || "No follow-up scheduled"}
                tone={follow ? (late ? brand.alert : brand.primary) : brand.placeholder}
              />
            </View>

            <View style={styles.cardSide}>
              <View style={styles.sideButtons}>
                <Pressable
                  style={styles.callBtn}
                  onPress={() => openDialer(item.phone)}
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${item.name || "lead"}`}
                >
                  <Glyph name="call" size={17} color={brand.deep} />
                </Pressable>
                <Pressable
                  style={styles.waBtn}
                  onPress={() => openWhatsApp(item.phone)}
                  accessibilityRole="button"
                  accessibilityLabel={`WhatsApp ${item.name || "lead"}`}
                >
                  <Glyph name="logo-whatsapp" size={19} color={brand.onPrimary} />
                </Pressable>
              </View>

              {owner.name ? (
                <View style={styles.assigned}>
                  <Text style={styles.assignedLabel}>Assigned to</Text>
                  <View style={[styles.ownerAvatar, { backgroundColor: avatarTone(owner.name).bg }]}>
                    <Text style={[styles.ownerAvatarText, { color: avatarTone(owner.name).fg }]}>
                      {initialsOf(owner.name)}
                    </Text>
                    <PhotoOverlay uri={owner.photo} />
                  </View>
                </View>
              ) : (
                <Text style={styles.unassigned}>Unassigned</Text>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  const header = (
    <>
      <View style={styles.searchBox}>
        <Glyph name="search" size={18} color={brand.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search leads, phone or property..."
          placeholderTextColor={brand.placeholder}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <Glyph name="close-circle" size={17} color={brand.placeholder} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.segment}>
        {(["BOARD", "LIST", "TEAM"] as const).map((key) => {
          const active = mode === key;
          return (
            <Pressable
              key={key}
              style={[styles.segmentItem, active && styles.segmentItemOn]}
              onPress={() => setMode(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segmentLabel, active && styles.segmentLabelOn]}>
                {key === "BOARD" ? "Board" : key === "LIST" ? "List" : "Team"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mode === "BOARD" ? (
        <View style={styles.chipRowWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {STAGES.map((entry) => {
              const active = stage === entry.key;
              const count = stageCounts.get(entry.key) || 0;
              return (
                <Pressable
                  key={entry.key}
                  style={[styles.chip, active && styles.chipOn]}
                  onPress={() => setStage(entry.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelOn]}>{entry.label}</Text>
                  <View style={[styles.chipCount, active && styles.chipCountOn]}>
                    <Text style={[styles.chipCountText, active && styles.chipCountTextOn]}>{count}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.statRow}>
        {/* The comp colours three of the four values and leaves the count black. */}
        <StatTile
          icon="people"
          tint={brand.tintSoft}
          color={brand.deep}
          valueColor={brand.text}
          label="Total Leads"
          value={String(stats.total)}
        />
        <StatTile
          icon="flame"
          tint={brand.alertTint}
          color="#e02d2d"
          label="Hot Leads"
          value={String(stats.hot)}
        />
        <StatTile
          icon="time-outline"
          tint={brand.warnTint}
          color="#d67912"
          label="Follow-ups"
          value={String(stats.followUps)}
        />
        <StatTile
          icon="stats-chart"
          tint={brand.tintSoft}
          color={brand.deep}
          label="Conversion"
          value={`${stats.conversion}%`}
        />
      </View>

      {mode === "BOARD" ? (
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>
            {(STAGES.find((entry) => entry.key === stage) || STAGES[0]).label} Leads
          </Text>
          {stageLeads.length > 0 ? (
            <Pressable
              style={styles.seeAll}
              onPress={() => setMode("LIST")}
              accessibilityRole="button"
            >
              <Text style={styles.seeAllText}>See all</Text>
              <Glyph name="chevron-forward" size={15} color={brand.primary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {error ? (
        <Pressable style={styles.banner} onPress={() => load()} accessibilityRole="button">
          <Text style={styles.bannerText}>{error}</Text>
        </Pressable>
      ) : null}
      {notice ? (
        <Pressable style={styles.notice} onPress={() => setNotice("")} accessibilityRole="button">
          <Text style={styles.noticeText}>{notice}</Text>
        </Pressable>
      ) : null}
      {mode === "LIST" && !selecting && searched.length ? (
        <Text style={styles.selectHint}>Long-press a lead to select it{canExportLeads ? " for export" : ""}.</Text>
      ) : null}
    </>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.pageTitle} numberOfLines={1}>
          Pipeline
        </Text>
        <Text style={styles.pageSubtitle}>Manage leads and close deals</Text>

        <View style={styles.headerActions}>
          <Pressable
            style={[styles.iconBtn, activeFilterCount > 0 && styles.iconBtnOn]}
            onPress={() => setFiltersOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={activeFilterCount ? `Filters, ${activeFilterCount} applied` : "Filters"}
          >
            <Glyph
              name="filter"
              size={19}
              color={activeFilterCount ? brand.primary : brand.text}
            />
          </Pressable>

          {canBulkUpload ? (
            <Pressable
              style={styles.iconBtn}
              onPress={() => setBulkOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Bulk upload leads"
            >
              <Glyph name="cloud-upload-outline" size={19} color={brand.text} />
            </Pressable>
          ) : null}

          {canAddLead ? (
            <Pressable
              style={styles.addBtn}
              onPress={() => navigation.navigate("AddLead")}
              accessibilityRole="button"
            >
              <Glyph name="add" size={19} color={brand.onPrimary} />
              <Text style={styles.addBtnText}>Add Lead</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item._id}
        renderItem={renderCard}
        ListHeaderComponent={header}
        ListFooterComponent={
          mode === "TEAM" ? (
            <PipelineTeam
              leads={searched}
              employees={users}
              onOpenEmployee={(employee) => {
                setFilters((previous) => ({ ...previous, assignedTo: employee.id, quickFilter: "" }));
                setMode("LIST");
                setNotice(`Showing ${employee.name}'s leads. Clear the assignee in Filters to see everyone again.`);
              }}
            />
          ) : null
        }
        ListEmptyComponent={
          mode === "TEAM" ? null : (
          <View style={styles.empty}>
            <Glyph name="people-outline" size={30} color={brand.placeholder} />
            <Text style={styles.emptyText}>
              {query ? "No leads match that search" : "No leads in this stage yet"}
            </Text>
          </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={brand.primary} />
        }
        contentContainerStyle={[styles.body, { paddingBottom: (selecting ? 96 : 28) + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      <AppSheet
        visible={!!actionLead}
        onClose={() => setActionLead(null)}
        title={actionLead?.name || "Lead"}
        subtitle={actionLead?.phone || undefined}
      >
        {([
          { id: "open", label: "Open lead details", icon: "chevron-forward" },
          { id: "update", label: "Update lead", icon: "create-outline" },
          { id: "call", label: "Call", icon: "call-outline" },
          { id: "whatsapp", label: "WhatsApp", icon: "logo-whatsapp" },
          { id: "email", label: "Email", icon: "mail-outline" },
          { id: "maps", label: "Open in Maps", icon: "navigate-outline" },
        ] as Array<{ id: string; label: string; icon: GlyphName }>).map((entry) => (
          <Pressable
            key={entry.id}
            style={styles.sheetRow}
            accessibilityRole="button"
            onPress={() => {
              const lead = actionLead;
              setActionLead(null);
              if (!lead) return;
              if (entry.id === "call") openDialer(lead.phone);
              else if (entry.id === "whatsapp") openWhatsApp(lead.phone);
              else if (entry.id === "email") openMail(lead.email);
              else if (entry.id === "maps") openMaps(lead);
              else if (entry.id === "update") navigation.navigate("UpdateLead", { leadId: lead._id, lead });
              else openLead(lead);
            }}
          >
            <View style={styles.sheetLead}>
              <Glyph name={entry.icon} size={18} color={brand.textSecondary} />
              <Text style={styles.sheetLabel}>{entry.label}</Text>
            </View>
          </Pressable>
        ))}
      </AppSheet>

      {selecting ? (
        <View style={[styles.selectionBar, { paddingBottom: 10 + insets.bottom }]}>
          <Text style={styles.selectionCount}>{selectedIds.length} selected</Text>
          <Pressable
            style={styles.selectionBtn}
            onPress={() => setSelectedIds(visible.map((lead) => lead._id))}
            accessibilityRole="button"
          >
            <Text style={styles.selectionBtnText}>Select all</Text>
          </Pressable>
          {canExportLeads ? (
            <Pressable style={[styles.selectionBtn, styles.selectionPrimary]} onPress={exportSelected} accessibilityRole="button">
              <Glyph name="download-outline" size={15} color={brand.onPrimary} />
              <Text style={[styles.selectionBtnText, styles.selectionPrimaryText]}>Export CSV</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.selectionBtn} onPress={() => setSelectedIds([])} accessibilityRole="button">
            <Glyph name="close" size={15} color={brand.textSecondary} />
            <Text style={styles.selectionBtnText}>Clear</Text>
          </Pressable>
        </View>
      ) : null}

      {canBulkUpload ? (
        <LeadBulkUploadSheet
          visible={bulkOpen}
          sheetTypes={bulkSheetTypes}
          onClose={() => setBulkOpen(false)}
          onUploaded={(summary) => {
            setNotice(summary);
            void load(true);
          }}
        />
      ) : null}

      <LeadFiltersSheet
        visible={filtersOpen}
        filters={filters}
        statuses={LEAD_STATUSES}
        assignees={executiveUsers.map((person) => ({ _id: person._id, name: person.name }))}
        onApply={(next) => {
          setFilters(next);
          setFiltersOpen(false);
        }}
        onClose={() => setFiltersOpen(false)}
      />
    </SafeAreaView>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    cardSelected: { borderColor: b.primary, borderWidth: 2 },
    selectedMark: {
      position: "absolute",
      top: 8,
      right: 8,
      zIndex: 2,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.primary,
    },
    notice: { marginBottom: 10, padding: 10, borderRadius: round.field, backgroundColor: b.tint },
    noticeText: { fontSize: t.body, color: b.deep, fontWeight: "600" },
    selectHint: { marginBottom: 8, fontSize: t.label, color: b.textMuted },
    selectionBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
      paddingHorizontal: layout.pageGutter,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: b.border,
      backgroundColor: b.surface,
    },
    selectionCount: { flex: 1, fontSize: t.cardTitle, fontWeight: "700", color: b.text },
    selectionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      height: 34,
      paddingHorizontal: 11,
      borderRadius: round.button,
      borderWidth: 1,
      borderColor: b.fieldBorder,
    },
    selectionBtnText: { fontSize: t.label, fontWeight: "600", color: b.textSecondary },
    selectionPrimary: { backgroundColor: b.primary, borderColor: b.primary },
    selectionPrimaryText: { color: b.onPrimary },
    root: {
      flex: 1,
      backgroundColor: b.bg,
    },
    centred: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    grow: {
      flex: 1,
      minWidth: 0,
    },

    /* ---- page header ---- */
    header: {
      paddingHorizontal: layout.gutter,
      paddingTop: 8,
      paddingBottom: 12,
    },
    pageTitle: {
      width: "56%",
      fontSize: t.pageTitle,
      lineHeight: 31,
      fontWeight: "700",
      letterSpacing: -0.8,
      color: b.text,
    },
    pageSubtitle: {
      marginTop: 1,
      fontSize: t.cardTitle,
      lineHeight: 18,
      color: b.textMuted,
    },
    headerActions: {
      position: "absolute",
      right: layout.gutter,
      top: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    iconBtn: {
      width: 37,
      height: 35,
      borderRadius: round.field,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: b.border,
      backgroundColor: b.surface,
    },
    iconBtnOn: {
      borderColor: b.greenBright,
      backgroundColor: b.tint,
    },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 36,
      paddingHorizontal: 13,
      borderRadius: round.field,
      backgroundColor: "#007848",
    },
    addBtnText: {
      fontSize: t.cardTitle,
      fontWeight: "700",
      color: b.onPrimary,
    },

    body: {
      paddingHorizontal: layout.gutter,
    },

    /* ---- search ---- */
    searchBox: {
      height: 38,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 0,
      fontSize: t.cardTitle,
      color: b.text,
    },

    /* ---- board / list ---- */
    segment: {
      marginTop: 11,
      height: 35,
      flexDirection: "row",
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
      overflow: "hidden",
    },
    segmentItem: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentItemOn: {
      borderWidth: 1,
      borderColor: b.greenBright,
      borderRadius: round.field,
      backgroundColor: "#d7efe3",
    },
    segmentLabel: {
      fontSize: t.rowTitle,
      fontWeight: "500",
      color: b.text,
    },
    segmentLabelOn: {
      fontWeight: "700",
    },

    /* ---- stage chips ---- */
    chipRowWrap: {
      marginTop: 11,
      marginHorizontal: -layout.gutter,
    },
    chipRow: {
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: layout.gutter,
    },
    chip: {
      height: 31,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 11,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    chipOn: {
      borderColor: b.greenBright,
      backgroundColor: "#dff2e8",
    },
    chipLabel: {
      fontSize: t.body,
      fontWeight: "500",
      color: b.text,
    },
    chipLabelOn: {
      fontWeight: "700",
    },
    chipCount: {
      minWidth: 21,
      height: 21,
      paddingHorizontal: 5,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round.pill,
      backgroundColor: b.hairline,
    },
    chipCountOn: {
      backgroundColor: b.primary,
    },
    chipCountText: {
      fontSize: t.tagline,
      fontWeight: "700",
      color: b.textSecondary,
    },
    chipCountTextOn: {
      color: b.onPrimary,
    },

    /* ---- stat tiles ---- */
    statRow: {
      marginTop: 11,
      flexDirection: "row",
      gap: 6,
    },
    statTile: {
      flex: 1,
      minWidth: 0,
      height: 101,
      paddingHorizontal: 9,
      paddingTop: 11,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    statIcon: {
      width: 34,
      height: 34,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    statLabel: {
      marginTop: 9,
      fontSize: t.tagline,
      lineHeight: 14,
      color: b.textSecondary,
    },
    statValue: {
      marginTop: 2,
      fontSize: t.hero,
      lineHeight: 25,
      fontWeight: "700",
      letterSpacing: -0.6,
    },

    /* ---- section head ---- */
    sectionHead: {
      marginTop: 18,
      marginBottom: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    sectionTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: t.barTitle,
      lineHeight: 23,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: b.text,
    },
    seeAll: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    seeAllText: {
      fontSize: t.cardTitle,
      fontWeight: "700",
      color: b.primary,
    },

    banner: {
      marginBottom: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
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

    /* ---- lead card ---- */
    card: {
      marginBottom: 7,
      flexDirection: "row",
      overflow: "hidden",
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    cardAccent: {
      width: 4,
      backgroundColor: "#00af6d",
    },
    cardBody: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 12,
      paddingTop: 11,
      paddingBottom: 12,
    },
    cardHead: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    avatarText: {
      fontSize: t.body,
      fontWeight: "700",
      color: b.text,
    },
    name: {
      fontSize: t.sectionTitle,
      lineHeight: 20,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: b.text,
    },
    sourcePill: {
      marginTop: 3,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      height: 21,
      paddingHorizontal: 8,
      borderRadius: round.pill,
    },
    sourceText: {
      fontSize: t.tagline,
      fontWeight: "700",
    },
    tempPill: {
      height: 22,
      paddingHorizontal: 10,
      justifyContent: "center",
      borderRadius: round.pill,
    },
    tempText: {
      fontSize: t.tagline,
      fontWeight: "700",
    },
    kebab: {
      paddingTop: 3,
    },

    cardSplit: {
      marginTop: 7,
      flexDirection: "row",
      alignItems: "stretch",
      gap: 10,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      height: 19,
    },
    metaText: {
      flex: 1,
      minWidth: 0,
      fontSize: t.body,
      color: b.textSecondary,
    },
    cardSide: {
      width: 96,
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    sideButtons: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    callBtn: {
      width: 34,
      height: 34,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    waBtn: {
      width: 34,
      height: 34,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#0d7a48",
    },
    assigned: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    assignedLabel: {
      fontSize: t.tagline,
      color: b.textMuted,
    },
    ownerAvatar: {
      width: 28,
      height: 28,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    ownerAvatarText: {
      fontSize: t.tagline,
      fontWeight: "700",
    },
    unassigned: {
      fontSize: t.tagline,
      color: b.placeholder,
    },

    empty: {
      alignItems: "center",
      gap: 10,
      paddingVertical: 48,
    },
    emptyText: {
      fontSize: t.field,
      color: b.textMuted,
    },

    sheetRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: b.hairline,
    },
    sheetLead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    sheetLabel: {
      fontSize: t.field,
      color: b.text,
    },
  }),
);

export default LeadsMatrixScreen;
