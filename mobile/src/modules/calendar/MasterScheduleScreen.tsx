import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Screen } from "../../components/common/Screen";
import { getAllLeads, updateLeadStatus } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";
import { formatDateTime } from "../../utils/date";
import type { Lead } from "../../types";

const SCHEDULE_FILTERS = ["ALL", "TODAY", "OVERDUE", "NEXT_48H"];

type PickerState = {
  leadId: string;
  date: Date;
  mode: "date" | "time";
} | null;

const toDate = (value?: string) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const MasterScheduleScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [draftMap, setDraftMap] = useState<Record<string, Date>>({});
  const [pickerState, setPickerState] = useState<PickerState>(null);

  const load = async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      const rows = await getAllLeads();
      setLeads(rows || []);

      const nextDraft: Record<string, Date> = {};
      (rows || []).forEach((lead) => {
        nextDraft[lead._id] = toDate(lead.nextFollowUp) || new Date();
      });
      setDraftMap(nextDraft);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load schedule"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 1500);
    return () => clearTimeout(timer);
  }, [success]);

  const scoped = useMemo(() => {
    const now = new Date();
    const plus48 = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const key = query.trim().toLowerCase();

    return leads
      .filter((lead) => ["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"].includes(String(lead.status || "")))
      .filter((lead) => {
        const followUp = toDate(lead.nextFollowUp);

        if (filter === "TODAY") {
          if (!followUp) return false;
          return followUp.toDateString() === now.toDateString();
        }

        if (filter === "OVERDUE") {
          return Boolean(followUp && followUp < now);
        }

        if (filter === "NEXT_48H") {
          return Boolean(followUp && followUp >= now && followUp <= plus48);
        }

        return true;
      })
      .filter((lead) => {
        if (!key) return true;
        return [lead.name, lead.phone, lead.city, lead.projectInterested]
          .map((v) => String(v || "").toLowerCase())
          .some((v) => v.includes(key));
      })
      .sort((a, b) => {
        const da = toDate(a.nextFollowUp)?.getTime() || Number.MAX_SAFE_INTEGER;
        const db = toDate(b.nextFollowUp)?.getTime() || Number.MAX_SAFE_INTEGER;
        return da - db;
      });
  }, [filter, leads, query]);

  const openPicker = (leadId: string, mode: "date" | "time") => {
    const current = draftMap[leadId] || new Date();
    setPickerState({ leadId, date: current, mode });
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    const state = pickerState;
    if (!state) return;

    if (event.type === "dismissed") {
      setPickerState(null);
      return;
    }

    const nextDate = selected || state.date;

    if (state.mode === "date") {
      const withDate = new Date(state.date);
      withDate.setFullYear(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());

      setDraftMap((prev) => ({
        ...prev,
        [state.leadId]: withDate,
      }));

      if (Platform.OS === "android") {
        setPickerState({ leadId: state.leadId, date: withDate, mode: "time" });
      } else {
        setPickerState(null);
      }
      return;
    }

    const withTime = new Date(state.date);
    withTime.setHours(nextDate.getHours(), nextDate.getMinutes(), 0, 0);

    setDraftMap((prev) => ({
      ...prev,
      [state.leadId]: withTime,
    }));
    setPickerState(null);
  };

  const scheduleLead = async (leadId: string) => {
    const selectedDate = draftMap[leadId];
    if (!selectedDate || Number.isNaN(selectedDate.getTime())) {
      setError("Please select a valid follow-up date/time");
      return;
    }

    try {
      setSavingId(leadId);
      setError("");
      const updated = await updateLeadStatus(leadId, {
        nextFollowUp: selectedDate.toISOString(),
      });

      setLeads((prev) => prev.map((lead) => (lead._id === updated._id ? updated : lead)));
      setDraftMap((prev) => ({ ...prev, [leadId]: new Date(updated.nextFollowUp || selectedDate) }));
      setSuccess("Follow-up scheduled");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to schedule follow-up"));
    } finally {
      setSavingId("");
    }
  };

  return (
    <Screen title="Master Schedule" subtitle="Follow-up Calendar" loading={loading} error={error}>
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <TextInput
        style={styles.search}
        placeholder="Search lead name, phone, city"
        value={query}
        onChangeText={setQuery}
      />

      <View style={styles.filtersRow}>
        {SCHEDULE_FILTERS.map((item) => (
          <Pressable
            key={item}
            style={[styles.filterChip, filter === item && styles.filterChipActive]}
            onPress={() => setFilter(item)}
          >
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={scoped}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={<Text style={styles.empty}>No leads in selected schedule bucket</Text>}
        renderItem={({ item }) => {
          const draft = draftMap[item._id] || new Date();

          return (
            <View style={styles.card}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{item.phone} | {item.city || "-"}</Text>
              <Text style={styles.meta}>Status: {item.status || "NEW"}</Text>
              <Text style={styles.meta}>Current Follow-up: {formatDateTime(item.nextFollowUp)}</Text>

              <View style={styles.pickersRow}>
                <Pressable style={styles.pickerBtn} onPress={() => openPicker(item._id, "date")}>
                  <Text style={styles.pickerText}>Date: {draft.toLocaleDateString("en-IN")}</Text>
                </Pressable>
                <Pressable style={styles.pickerBtn} onPress={() => openPicker(item._id, "time")}>
                  <Text style={styles.pickerText}>Time: {draft.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                </Pressable>
              </View>

              <Pressable
                style={styles.saveBtn}
                onPress={() => scheduleLead(item._id)}
                disabled={savingId === item._id}
              >
                {savingId === item._id ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Schedule</Text>}
              </Pressable>
            </View>
          );
        }}
      />

      {pickerState ? (
        <DateTimePicker
          value={pickerState.date}
          mode={pickerState.mode}
          onChange={onPickerChange}
          minimumDate={new Date()}
          is24Hour
        />
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  success: {
    marginBottom: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#86efac",
    borderRadius: 10,
    backgroundColor: "#f0fdf4",
    color: "#166534",
  },
  search: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  filtersRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  filterChipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#0f172a",
  },
  filterText: {
    fontSize: 12,
    color: "#334155",
  },
  filterTextActive: {
    color: "#fff",
  },
  empty: {
    textAlign: "center",
    color: "#64748b",
    marginTop: 18,
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 8,
  },
  name: {
    fontWeight: "700",
    color: "#0f172a",
    fontSize: 16,
  },
  meta: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 12,
  },
  pickersRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  pickerBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 9,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  pickerText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  saveBtn: {
    marginTop: 8,
    height: 38,
    borderRadius: 9,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    color: "#fff",
    fontWeight: "700",
  },
});