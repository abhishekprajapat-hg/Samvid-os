import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/common/Screen";
import { AppButton, AppChip } from "../../components/common/ui";
import { getAllLeads } from "../../services/leadService";
import { getInventoryAssets } from "../../services/inventoryService";
import { toErrorMessage } from "../../utils/errorMessage";
import type { Lead } from "../../types";

const RANGE_OPTIONS = ["ALL", "THIS_MONTH", "CUSTOM"] as const;
type RangeKey = (typeof RANGE_OPTIONS)[number];
const STAGES = ["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT", "CLOSED", "LOST"];

const toDate = (value?: string) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const pad2 = (value: number) => String(value).padStart(2, "0");
const toDateInputValue = (value: Date) => `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;

const WebDateInput = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) => {
  if (Platform.OS === "web") {
    return (
      <View style={styles.webInputWrap}>
        <input
          value={value}
          onChange={(event) => onChange((event.target as HTMLInputElement).value)}
          placeholder={placeholder}
          type="date"
          style={styles.webDateInput as any}
        />
      </View>
    );
  }
  return <TextInput style={styles.modalInput} value={value} onChangeText={onChange} placeholder={placeholder} />;
};

export const IntelligenceReportsScreen = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [rangeKey, setRangeKey] = useState<RangeKey>("ALL");
  const [selectedMonthDate, setSelectedMonthDate] = useState(new Date());
  const [customFromDate, setCustomFromDate] = useState<Date | null>(null);
  const [customToDate, setCustomToDate] = useState<Date | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showCustomFromPicker, setShowCustomFromPicker] = useState(false);
  const [showCustomToPicker, setShowCustomToPicker] = useState(false);
  const [webMonthPickerVisible, setWebMonthPickerVisible] = useState(false);
  const [webMonthDateValue, setWebMonthDateValue] = useState(toDateInputValue(new Date()));
  const [webCustomPickerVisible, setWebCustomPickerVisible] = useState(false);
  const [webCustomFromValue, setWebCustomFromValue] = useState("");
  const [webCustomToValue, setWebCustomToValue] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [assets, setAssets] = useState<Array<{ _id: string; status?: string; location?: string; price?: number; createdAt?: string }>>([]);

  const load = async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const [leadRows, inventoryRows] = await Promise.all([getAllLeads(), getInventoryAssets()]);
      setLeads(Array.isArray(leadRows) ? leadRows : []);
      setAssets(Array.isArray(inventoryRows) ? inventoryRows : []);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load reports"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const scoped = useMemo(() => {
    if (rangeKey === "ALL") return { leads, assets };

    if (rangeKey === "THIS_MONTH") {
      return {
        leads: leads.filter((lead) => {
          const createdAt = toDate(lead.createdAt);
          if (!createdAt) return false;
          return (
            createdAt.getFullYear() === selectedMonthDate.getFullYear()
            && createdAt.getMonth() === selectedMonthDate.getMonth()
          );
        }),
        assets: assets.filter((asset) => {
          const createdAt = toDate(asset.createdAt);
          if (!createdAt) return false;
          return (
            createdAt.getFullYear() === selectedMonthDate.getFullYear()
            && createdAt.getMonth() === selectedMonthDate.getMonth()
          );
        }),
      };
    }

    if (!customFromDate || !customToDate) return { leads: [], assets: [] };
    const start = new Date(customFromDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(customToDate);
    end.setHours(23, 59, 59, 999);

    return {
      leads: leads.filter((lead) => {
        const createdAt = toDate(lead.createdAt);
        return createdAt && createdAt >= start && createdAt <= end;
      }),
      assets: assets.filter((asset) => {
        const createdAt = toDate(asset.createdAt);
        return createdAt && createdAt >= start && createdAt <= end;
      }),
    };
  }, [assets, leads, rangeKey, selectedMonthDate, customFromDate, customToDate]);

  const periodLabel = useMemo(() => {
    if (rangeKey === "ALL") return "All data";
    if (rangeKey === "THIS_MONTH") {
      return selectedMonthDate.toLocaleString("en-IN", { month: "long", year: "numeric" });
    }
    if (customFromDate && customToDate) {
      return `${customFromDate.toLocaleDateString("en-IN")} to ${customToDate.toLocaleDateString("en-IN")}`;
    }
    if (customFromDate) return `From ${customFromDate.toLocaleDateString("en-IN")}`;
    return "Custom range";
  }, [rangeKey, selectedMonthDate, customFromDate, customToDate]);

  const metrics = useMemo(() => {
    const total = scoped.leads.length;
    const closed = scoped.leads.filter((lead) => lead.status === "CLOSED").length;
    const active = scoped.leads.filter((lead) => ["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"].includes(String(lead.status))).length;
    const conversion = total ? Math.round((closed / total) * 100) : 0;

    const soldReserved = scoped.assets.filter((asset) => ["Sold", "Reserved", "Blocked"].includes(String(asset.status))).length;
    const utilization = scoped.assets.length ? Math.round((soldReserved / scoped.assets.length) * 100) : 0;

    const inventoryValue = scoped.assets.reduce((sum, asset) => sum + Number(asset.price || 0), 0);

    return [
      { id: "1", label: "Total Leads", value: total, onPress: () => navigation.navigate("Leads", { initialStatus: "ALL" }) },
      {
        id: "2",
        label: "Active Leads",
        value: active,
        onPress: () => navigation.navigate("Leads", { filterPreset: "PIPELINE", initialStatus: "ALL" }),
      },
      { id: "3", label: "Closed Leads", value: closed, onPress: () => navigation.navigate("Leads", { initialStatus: "CLOSED" }) },
      { id: "4", label: "Conversion", value: `${conversion}%`, onPress: () => navigation.navigate("Leads", { initialStatus: "CLOSED" }) },
      { id: "5", label: "Inventory Utilization", value: `${utilization}%`, onPress: () => navigation.navigate("Inventory", { initialSearch: "Sold" }) },
      { id: "6", label: "Inventory Value", value: `Rs ${inventoryValue.toLocaleString("en-IN")}`, onPress: () => navigation.navigate("Inventory") },
    ];
  }, [navigation, scoped.assets, scoped.leads]);

  const stageRows = useMemo(() => {
    const total = scoped.leads.length;
    return STAGES.map((status) => {
      const count = scoped.leads.filter((lead) => String(lead.status || "NEW") === status).length;
      const share = total ? Math.round((count / total) * 100) : 0;
      return { id: status, status, count, share };
    });
  }, [scoped.leads]);

  const topLocations = useMemo(() => {
    const map = new Map<string, { location: string; units: number }>();

    scoped.assets.forEach((asset) => {
      const key = String(asset.location || "Unspecified");
      if (!map.has(key)) {
        map.set(key, { location: key, units: 0 });
      }
      map.get(key)!.units += 1;
    });

    return [...map.values()].sort((a, b) => b.units - a.units).slice(0, 6);
  }, [scoped.assets]);

  const shareReport = async () => {
    const lines: string[] = [];
    lines.push(`Range,${periodLabel}`);
    lines.push("Section,Metric,Value");

    metrics.forEach((row) => {
      lines.push(`Summary,${row.label},${row.value}`);
    });

    stageRows.forEach((row) => {
      lines.push(`Lead Funnel,${row.status},${row.count} (${row.share}%)`);
    });

    topLocations.forEach((row) => {
      lines.push(`Locations,${row.location},${row.units} units`);
    });

    await Share.share({
      title: "Samvid Reports",
      message: lines.join("\n"),
    });
  };

  const openMonthPicker = () => {
    if (Platform.OS === "web") {
      setWebMonthDateValue(toDateInputValue(selectedMonthDate));
      setWebMonthPickerVisible(true);
      return;
    }
    setShowMonthPicker(true);
  };

  const openCustomRangePicker = () => {
    if (Platform.OS === "web") {
      setWebCustomFromValue(customFromDate ? toDateInputValue(customFromDate) : "");
      setWebCustomToValue(customToDate ? toDateInputValue(customToDate) : "");
      setWebCustomPickerVisible(true);
      return;
    }
    setShowCustomFromPicker(true);
  };

  const applyWebMonthPicker = () => {
    if (!webMonthDateValue) {
      setError("Please select date");
      return;
    }
    const parsed = new Date(`${webMonthDateValue}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      setError("Please select valid date");
      return;
    }
    setSelectedMonthDate(parsed);
    setWebMonthPickerVisible(false);
  };

  const applyWebCustomRange = () => {
    if (!webCustomFromValue || !webCustomToValue) {
      setError("Please select from and to date");
      return;
    }
    const parsedFrom = new Date(`${webCustomFromValue}T00:00:00`);
    const parsedTo = new Date(`${webCustomToValue}T00:00:00`);
    if (Number.isNaN(parsedFrom.getTime()) || Number.isNaN(parsedTo.getTime())) {
      setError("Please select valid custom dates");
      return;
    }
    if (parsedTo < parsedFrom) {
      setError("To date cannot be before from date");
      return;
    }
    setCustomFromDate(parsedFrom);
    setCustomToDate(parsedTo);
    setWebCustomPickerVisible(false);
  };

  return (
    <Screen title="Intelligence Reports" subtitle="Funnel + Inventory" loading={loading} error={error}>
      <View style={styles.sectionCard}>
        <View style={styles.filterRow}>
          <AppChip label="All" active={rangeKey === "ALL"} onPress={() => setRangeKey("ALL")} />
          <AppChip label="This Month" active={rangeKey === "THIS_MONTH"} onPress={() => setRangeKey("THIS_MONTH")} />
          <AppChip
            label="Custom"
            active={rangeKey === "CUSTOM"}
            onPress={() => {
              setRangeKey("CUSTOM");
              openCustomRangePicker();
            }}
          />
          <View style={{ flex: 1 }} />
          <Pressable style={styles.calendarIconBtn} onPress={openMonthPicker}>
            <Ionicons name="calendar-outline" size={14} color="#334155" />
          </Pressable>
          <AppButton title={refreshing ? "Refreshing..." : "Refresh"} variant="ghost" onPress={() => load(true)} disabled={refreshing} />
          <Pressable style={styles.exportBtn} onPress={shareReport}>
            <Text style={styles.exportText}>Export</Text>
          </Pressable>
        </View>
        <Text style={styles.periodText}>Showing: {periodLabel}</Text>
        {rangeKey === "CUSTOM" ? (
          <View style={styles.customRangeRow}>
            <Pressable style={styles.customDateBtn} onPress={openCustomRangePicker}>
              <Text style={styles.customDateText}>From: {customFromDate ? customFromDate.toLocaleDateString("en-IN") : "Select"}</Text>
            </Pressable>
            <Pressable style={styles.customDateBtn} onPress={openCustomRangePicker}>
              <Text style={styles.customDateText}>To: {customToDate ? customToDate.toLocaleDateString("en-IN") : "Select"}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {showMonthPicker ? (
        <DateTimePicker
          value={selectedMonthDate}
          mode="date"
          display="default"
          onChange={(_, next) => {
            setShowMonthPicker(false);
            if (next) setSelectedMonthDate(next);
          }}
        />
      ) : null}
      {showCustomFromPicker ? (
        <DateTimePicker
          value={customFromDate || new Date()}
          mode="date"
          display="default"
          onChange={(_, next) => {
            setShowCustomFromPicker(false);
            if (next) {
              setCustomFromDate(next);
              if (!customToDate || customToDate < next) {
                setCustomToDate(next);
              }
              setTimeout(() => setShowCustomToPicker(true), 30);
            }
          }}
        />
      ) : null}
      {showCustomToPicker ? (
        <DateTimePicker
          value={customToDate || customFromDate || new Date()}
          mode="date"
          display="default"
          onChange={(_, next) => {
            setShowCustomToPicker(false);
            if (next) {
              if (customFromDate && next < customFromDate) {
                setCustomToDate(customFromDate);
                return;
              }
              setCustomToDate(next);
            }
          }}
        />
      ) : null}

      <FlatList
        data={metrics}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={item.onPress}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.value}>{item.value}</Text>
          </Pressable>
        )}
        ListFooterComponent={
          <>
            <Text style={styles.section}>Lead Funnel Stages</Text>
            {stageRows.map((row) => (
              <Pressable
                key={row.id}
                style={styles.rowCard}
                onPress={() => navigation.navigate("Leads", { initialStatus: row.status })}
              >
                <View style={styles.rowLine}>
                  <Text style={styles.rowTitle}>{row.status}</Text>
                  <Text style={styles.rowMeta}>{row.count} ({row.share}%)</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.max(row.share, 4)}%` }]} />
                </View>
              </Pressable>
            ))}

            <Text style={styles.section}>Top Inventory Locations</Text>
            {topLocations.length === 0 ? (
              <Text style={styles.empty}>No location data</Text>
            ) : (
              topLocations.map((row) => (
                <Pressable
                  key={row.location}
                  style={styles.rowCard}
                  onPress={() => navigation.navigate("Inventory", { initialSearch: row.location })}
                >
                  <View style={styles.rowLine}>
                    <Text style={styles.rowTitle}>{row.location}</Text>
                    <Text style={styles.rowMeta}>{row.units} units</Text>
                  </View>
                </Pressable>
              ))
            )}
          </>
        }
      />

      <Modal visible={webMonthPickerVisible} transparent animationType="fade" onRequestClose={() => setWebMonthPickerVisible(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Month/Date</Text>
            <WebDateInput value={webMonthDateValue} onChange={setWebMonthDateValue} placeholder="YYYY-MM-DD" />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setWebMonthPickerVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalApplyBtn} onPress={applyWebMonthPicker}>
                <Text style={styles.modalApplyText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={webCustomPickerVisible} transparent animationType="fade" onRequestClose={() => setWebCustomPickerVisible(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Custom Range</Text>
            <WebDateInput value={webCustomFromValue} onChange={setWebCustomFromValue} placeholder="From date" />
            <WebDateInput value={webCustomToValue} onChange={setWebCustomToValue} placeholder="To date" />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setWebCustomPickerVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalApplyBtn} onPress={applyWebCustomRange}>
                <Text style={styles.modalApplyText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  sectionCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  calendarIconBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 9,
    backgroundColor: "#fff",
    height: 36,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  periodText: {
    marginTop: 8,
    color: "#475569",
    fontSize: 11,
    fontWeight: "600",
  },
  customRangeRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  customDateBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
  },
  customDateText: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "600",
  },
  exportBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  exportText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
  },
  modalTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    color: "#0f172a",
    height: 44,
    paddingHorizontal: 12,
    marginBottom: 8,
    fontSize: 13,
  },
  webInputWrap: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    height: 44,
    marginBottom: 8,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  webDateInput: {
    height: 30,
    fontSize: 13,
    color: "#0f172a",
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: 0,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 6,
  },
  modalCancelBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    minWidth: 90,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  modalCancelText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 12,
  },
  modalApplyBtn: {
    borderWidth: 1,
    borderColor: "#0f172a",
    borderRadius: 10,
    minWidth: 90,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "#0f172a",
  },
  modalApplyText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 8,
  },
  label: {
    textTransform: "uppercase",
    fontSize: 12,
    color: "#64748b",
  },
  value: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  section: {
    marginTop: 12,
    marginBottom: 8,
    fontWeight: "700",
    color: "#334155",
  },
  rowCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
    marginBottom: 8,
  },
  rowLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowTitle: {
    color: "#0f172a",
    fontWeight: "600",
  },
  rowMeta: {
    color: "#64748b",
    fontSize: 12,
  },
  barTrack: {
    marginTop: 8,
    height: 8,
    borderRadius: 6,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: "#0f172a",
  },
  empty: {
    textAlign: "center",
    color: "#64748b",
    marginVertical: 10,
  },
});
