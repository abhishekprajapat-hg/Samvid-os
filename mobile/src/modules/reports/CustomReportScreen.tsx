import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as MailComposer from "expo-mail-composer";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import {
  FieldCol,
  FieldLabel,
  FieldRow,
  SectionCard,
  SelectField,
  TextField,
  Toggle,
} from "../../components/ui/form";
import { AppSheet } from "../../components/ui/Overlay";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import { toErrorMessage } from "../../utils/errorMessage";
import { saveReport, type ReportSection, type SavedReport } from "../../services/reportService";
import { getUsers } from "../../services/userService";
import { getInventoryAssets } from "../../services/inventoryService";
import { LEAD_SOURCE_CHANNELS } from "../../config/propertyRequirementConfig";
import { MONTHS_SHORT } from "./reportData";

/*
 * The custom report builder, drawn to the comp.
 *
 * Generating saves the question - range, sections, metrics, filters - and takes
 * you to the report it describes. The numbers are never stored, so reopening a
 * saved report answers it from today's data rather than showing a stale copy.
 */

const REPORT_TYPES = [
  { value: "BUSINESS_OVERVIEW", label: "Business Overview" },
  { value: "SALES_PIPELINE", label: "Sales & Pipeline" },
  { value: "FINANCE", label: "Finance" },
  { value: "INVENTORY", label: "Inventory" },
  { value: "TEAM_TASKS", label: "Team & Tasks" },
  { value: "ATTENDANCE", label: "Attendance" },
  { value: "COWORKING", label: "Coworking" },
];

const SECTIONS: Array<{ key: ReportSection; label: string }> = [
  { key: "SALES", label: "Sales & Pipeline" },
  { key: "FINANCE", label: "Finance" },
  { key: "INVENTORY", label: "Inventory" },
  { key: "TEAM", label: "Team & Tasks" },
  { key: "ATTENDANCE", label: "Attendance" },
  { key: "COWORKING", label: "Coworking" },
];

/* Every metric the app can actually count; see modules/reports/reportData.ts. */
const METRICS = [
  "Total Revenue", "Net Profit", "Expenses", "Receivables", "Collection Rate", "Overdue",
  "New Leads", "Qualified", "Site Visits", "Closed Deals", "Conversion", "Avg Response",
  "Properties", "Occupancy", "Tasks Completed", "Attendance Rate",
];

const VISUALS: Array<{ key: string; label: string; icon: GlyphName }> = [
  { key: "TABLE", label: "Table", icon: "grid-outline" },
  { key: "BAR", label: "Bar Chart", icon: "stats-chart" },
  { key: "LINE", label: "Line Chart", icon: "trending-up" },
  { key: "CARDS", label: "Summary Cards", icon: "apps-outline" },
];

const FORMATS = ["PDF", "EXCEL", "CSV"];

const STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "INTERESTED", label: "Interested" },
  { value: "SITE_VISIT", label: "Site Visit" },
  { value: "REQUESTED", label: "Requested" },
  { value: "CLOSED", label: "Closed" },
  { value: "LOST", label: "Lost" },
];

const dateOptions = (backDays: number, forwardDays: number) =>
  Array.from({ length: backDays + forwardDays + 1 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - backDays + index);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return {
      value,
      label: `${String(date.getDate()).padStart(2, "0")} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`,
    };
  });

const toDateValue = (value?: string | null, fallback = new Date()) => {
  const date = value ? new Date(value) : fallback;
  const safe = Number.isNaN(date.getTime()) ? fallback : date;
  return `${safe.getFullYear()}-${String(safe.getMonth() + 1).padStart(2, "0")}-${String(safe.getDate()).padStart(2, "0")}`;
};

export const CustomReportScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const preset = route.params?.report as SavedReport | undefined;

  const [name, setName] = useState(preset?.name || "");
  const [type, setType] = useState(preset?.type || "BUSINESS_OVERVIEW");
  const [from, setFrom] = useState(
    toDateValue(preset?.from, new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  const [to, setTo] = useState(toDateValue(preset?.to));

  const [sections, setSections] = useState<ReportSection[]>(
    preset?.sections?.length ? preset.sections : ["SALES", "FINANCE", "INVENTORY"],
  );
  const [metrics, setMetrics] = useState<string[]>(
    preset?.metrics?.length
      ? preset.metrics
      : ["Total Revenue", "Net Profit", "New Leads", "Conversion", "Properties", "Occupancy"],
  );
  const [metricOpen, setMetricOpen] = useState(false);

  const [team, setTeam] = useState(preset?.filters?.team || "");
  const [property, setProperty] = useState(preset?.filters?.property || "");
  const [leadSource, setLeadSource] = useState(preset?.filters?.leadSource || "");
  const [status, setStatus] = useState(preset?.filters?.status || "");

  const [visualization, setVisualization] = useState(preset?.visualization || "BAR");
  const [compare, setCompare] = useState(preset?.compareWithPrevious ?? true);
  const [format, setFormat] = useState(preset?.format || "PDF");
  const [emailAfter, setEmailAfter] = useState(false);
  const [email, setEmail] = useState("");

  const [users, setUsers] = useState<Array<{ _id?: string; name: string }>>([]);
  const [properties, setProperties] = useState<Array<{ _id: string; label: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const payload = await getUsers();
        setUsers(payload?.users || []);
      } catch {
        /* The filters are optional; the report still runs without them. */
      }
      try {
        const assets = await getInventoryAssets();
        setProperties(
          (Array.isArray(assets) ? assets : []).map((asset: any) => ({
            _id: String(asset._id),
            label: String(asset.projectName || asset.title || "Property"),
          })),
        );
      } catch {
        /* Same. */
      }
    })();
  }, []);

  const toggleSection = (key: ReportSection) =>
    setSections((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
    );

  const reset = () => {
    setName("");
    setType("BUSINESS_OVERVIEW");
    setFrom(toDateValue(null, new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
    setTo(toDateValue(null));
    setSections(["SALES", "FINANCE", "INVENTORY"]);
    setMetrics(["Total Revenue", "Net Profit", "New Leads", "Conversion", "Properties", "Occupancy"]);
    setTeam("");
    setProperty("");
    setLeadSource("");
    setStatus("");
    setVisualization("BAR");
    setCompare(true);
    setFormat("PDF");
    setEmailAfter(false);
    setEmail("");
    setError("");
  };

  const payload = () => ({
    name: name.trim() || "Custom report",
    type,
    from: new Date(`${from}T00:00:00`).toISOString(),
    to: new Date(`${to}T23:59:59`).toISOString(),
    sections,
    metrics,
    filters: { team, property, leadSource, status },
    visualization,
    compareWithPrevious: compare,
    format,
    summary: `${sections.length} sections · ${metrics.length} metrics`,
  });

  const persist = async (isTemplate: boolean) => {
    if (!name.trim()) {
      setError("Give the report a name");
      return null;
    }
    if (!sections.length) {
      setError("Pick at least one section to include");
      return null;
    }
    setError("");
    setSaving(true);
    try {
      return await saveReport({ ...payload(), isTemplate });
    } catch (e) {
      setError(toErrorMessage(e, "Could not save the report"));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    const saved = await persist(false);
    if (!saved) return;

    /*
     * The server sends no mail, so the report is announced from this phone.
     * The figures follow from the screen it opens, which is the live answer.
     */
    if (emailAfter && email.trim() && (await MailComposer.isAvailableAsync())) {
      await MailComposer.composeAsync({
        recipients: [email.trim()],
        subject: saved.name,
        body: `${saved.name}\n${from} to ${to}\nSections: ${sections.join(", ")}\nMetrics: ${metrics.join(", ")}`,
      }).catch(() => undefined);
    }

    /* Open the report this configuration describes. */
    if (sections.includes("FINANCE") && !sections.includes("SALES")) {
      navigation.replace("FinanceReport");
      return;
    }
    if (sections.includes("SALES")) {
      navigation.replace("SalesReport");
      return;
    }
    navigation.goBack();
  };

  const saveTemplate = async () => {
    const saved = await persist(true);
    if (saved) Alert.alert("Saved", `"${saved.name}" is available as a template.`);
  };

  const teamOptions = useMemo(
    () => [
      { value: "", label: "All Team Members" },
      ...users.filter((user) => user._id).map((user) => ({ value: String(user._id), label: user.name })),
    ],
    [users],
  );

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Glyph name="arrow-back" size={24} color={brand.text} />
        </Pressable>
        <Text style={styles.barTitle}>Custom Report</Text>
        <Pressable onPress={reset} hitSlop={10} accessibilityRole="button">
          <Text style={styles.barAction}>Reset</Text>
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

          <SectionCard title="Report Details">
            <FieldRow>
              <FieldCol>
                <TextField
                  label="Report name"
                  value={name}
                  onChangeText={setName}
                  placeholder="September Performance"
                  autoCapitalize="words"
                />
              </FieldCol>
              <FieldCol>
                <SelectField
                  label="Report type"
                  icon="stats-chart"
                  value={type}
                  options={REPORT_TYPES}
                  onChange={setType}
                />
              </FieldCol>
            </FieldRow>

            <FieldRow>
              <FieldCol>
                <SelectField
                  label="From"
                  icon="calendar-outline"
                  value={from}
                  options={dateOptions(365, 0)}
                  onChange={setFrom}
                />
              </FieldCol>
              <FieldCol>
                <SelectField
                  label="To"
                  icon="calendar-outline"
                  value={to}
                  options={dateOptions(365, 30)}
                  onChange={setTo}
                />
              </FieldCol>
            </FieldRow>
          </SectionCard>

          <SectionCard title="Include Data">
            <View style={styles.checkGrid}>
              {SECTIONS.map((section) => {
                const on = sections.includes(section.key);
                return (
                  <Pressable
                    key={section.key}
                    style={styles.check}
                    onPress={() => toggleSection(section.key)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    <View style={[styles.checkBox, on && styles.checkBoxOn]}>
                      {on ? <Glyph name="checkmark" size={15} color={brand.onPrimary} /> : null}
                    </View>
                    <Text style={styles.checkLabel} numberOfLines={1}>
                      {section.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>

          <SectionCard title="Metrics">
            <View style={styles.chipWrap}>
              {metrics.map((metric) => (
                <View key={metric} style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {metric}
                  </Text>
                  <Pressable
                    onPress={() => setMetrics((current) => current.filter((entry) => entry !== metric))}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${metric}`}
                  >
                    <Glyph name="close" size={14} color={brand.deep} />
                  </Pressable>
                </View>
              ))}
              <Pressable
                style={styles.addChip}
                onPress={() => setMetricOpen(true)}
                accessibilityRole="button"
              >
                <Glyph name="add" size={15} color={brand.primary} />
                <Text style={styles.addChipText}>Add metric</Text>
              </Pressable>
            </View>
          </SectionCard>

          <SectionCard title="Filters">
            <FieldRow>
              <FieldCol>
                <SelectField
                  label="Team"
                  icon="people-outline"
                  value={team}
                  options={teamOptions}
                  onChange={setTeam}
                />
              </FieldCol>
              <FieldCol>
                <SelectField
                  label="Property"
                  icon="business-outline"
                  value={property}
                  options={[
                    { value: "", label: "All Properties" },
                    ...properties.map((row) => ({ value: row._id, label: row.label })),
                  ]}
                  onChange={setProperty}
                />
              </FieldCol>
            </FieldRow>

            <FieldRow>
              <FieldCol>
                <SelectField
                  label="Lead Source"
                  icon="megaphone-outline"
                  value={leadSource}
                  options={[
                    { value: "", label: "All Sources" },
                    ...LEAD_SOURCE_CHANNELS.filter((option: any) => option.value).map((option: any) => ({
                      value: option.value,
                      label: option.label,
                    })),
                  ]}
                  onChange={setLeadSource}
                />
              </FieldCol>
              <FieldCol>
                <SelectField
                  label="Status"
                  icon="pricetag-outline"
                  value={status}
                  options={STATUSES}
                  onChange={setStatus}
                />
              </FieldCol>
            </FieldRow>
          </SectionCard>

          <SectionCard title="Visualization">
            <View style={styles.visualRow}>
              {VISUALS.map((visual) => {
                const on = visualization === visual.key;
                return (
                  <Pressable
                    key={visual.key}
                    style={[styles.visual, on && styles.visualOn]}
                    onPress={() => setVisualization(visual.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Glyph name={visual.icon} size={20} color={on ? brand.deep : brand.textSecondary} />
                    <Text style={[styles.visualLabel, on && styles.visualLabelOn]} numberOfLines={1}>
                      {visual.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Include comparison with previous period</Text>
              <Toggle value={compare} onValueChange={setCompare} />
            </View>
          </SectionCard>

          <SectionCard title="Export Format">
            <View style={styles.formatRow}>
              {FORMATS.map((entry) => {
                const on = format === entry;
                return (
                  <Pressable
                    key={entry}
                    style={[styles.format, on && styles.formatOn]}
                    onPress={() => setFormat(entry)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.formatLabel, on && styles.formatLabelOn]}>
                      {entry === "EXCEL" ? "Excel" : entry}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Email report after generation</Text>
              <Toggle value={emailAfter} onValueChange={setEmailAfter} />
            </View>

            {emailAfter ? (
              <>
                <TextField
                  label="Email address"
                  icon="mail-outline"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@company.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {/*
                 * No mail transport on the server, so it opens in the phone's
                 * mail app rather than promising a delivery that never happens.
                 */}
                <Text style={styles.note}>Opens in your mail app, ready to send.</Text>
              </>
            ) : null}
          </SectionCard>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Pressable
            style={[styles.submit, saving && styles.submitOff]}
            onPress={generate}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={styles.submitText}>{saving ? "Generating…" : "Generate report"}</Text>
            {!saving ? <Glyph name="arrow-forward" size={18} color={brand.onPrimary} /> : null}
          </Pressable>
          <Pressable style={styles.templateBtn} onPress={saveTemplate} disabled={saving} accessibilityRole="button">
            <Text style={styles.templateText}>Save as template</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <AppSheet visible={metricOpen} onClose={() => setMetricOpen(false)} title="Add metric">
        {METRICS.filter((metric) => !metrics.includes(metric)).map((metric) => (
          <Pressable
            key={metric}
            style={styles.sheetRow}
            onPress={() => {
              setMetrics((current) => [...current, metric]);
              setMetricOpen(false);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.sheetLabel}>{metric}</Text>
            <Glyph name="add" size={17} color={brand.primary} />
          </Pressable>
        ))}
      </AppSheet>
    </SafeAreaView>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: b.bg },
    grow: { flex: 1, minWidth: 0 },

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
    barAction: { fontSize: t.field, fontWeight: "700", color: b.primary },

    body: { paddingHorizontal: layout.gutter, paddingBottom: 24, gap: 12 },
    error: { fontSize: t.body, lineHeight: 17, color: b.alert },
    note: { fontSize: t.body, color: b.textMuted },

    checkGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 14,
    },
    check: {
      width: "33.33%",
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingRight: 6,
    },
    checkBox: {
      width: 24,
      height: 24,
      borderRadius: round.button,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: b.fieldBorder,
      backgroundColor: b.surface,
    },
    checkBoxOn: { borderColor: "#0b7d52", backgroundColor: "#0b7d52" },
    checkLabel: { flex: 1, minWidth: 0, fontSize: t.body, color: b.text },

    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 36,
      paddingHorizontal: 12,
      borderRadius: round.field,
      backgroundColor: b.tint,
    },
    chipText: { fontSize: t.body, fontWeight: "600", color: b.deep },
    addChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 36,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: b.greenBright,
      borderRadius: round.field,
    },
    addChipText: { fontSize: t.body, fontWeight: "600", color: b.primary },

    visualRow: { flexDirection: "row", gap: 7 },
    visual: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      gap: 7,
      paddingVertical: 13,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    visualOn: { borderColor: b.greenBright, backgroundColor: "#dff2e8" },
    visualLabel: { fontSize: t.tagline, color: b.textSecondary },
    visualLabelOn: { fontWeight: "700", color: b.text },

    toggleRow: {
      marginTop: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    toggleLabel: { flex: 1, minWidth: 0, fontSize: t.field, color: b.text },

    formatRow: {
      flexDirection: "row",
      padding: 4,
      borderRadius: round.field,
      backgroundColor: b.fieldMuted,
    },
    format: {
      flex: 1,
      minWidth: 0,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round.button,
    },
    formatOn: { backgroundColor: "#0b7d52" },
    formatLabel: { fontSize: t.field, fontWeight: "600", color: b.textSecondary },
    formatLabelOn: { fontWeight: "700", color: b.onPrimary },

    footer: {
      paddingHorizontal: layout.gutter,
      paddingTop: 10,
      gap: 4,
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
    submitOff: { opacity: 0.6 },
    submitText: { fontSize: t.sectionTitle, fontWeight: "700", color: b.onPrimary },
    templateBtn: { height: 40, alignItems: "center", justifyContent: "center" },
    templateText: { fontSize: t.field, fontWeight: "700", color: b.primary },

    sheetRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: b.hairline,
    },
    sheetLabel: { fontSize: t.field, color: b.text },
  }),
);

export default CustomReportScreen;
