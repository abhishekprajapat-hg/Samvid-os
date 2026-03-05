import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Screen } from "../../components/common/Screen";
import {
  addLeadDiaryEntry,
  getAllLeads,
  getLeadDiary,
  updateLeadDiaryEntry,
  updateLeadStatus,
  type LeadDiaryEntry,
} from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";
import { formatDateTime } from "../../utils/date";
import type { Lead } from "../../types";

const SCHEDULE_FILTERS = ["ALL", "TODAY", "OVERDUE", "NEXT_48H"];

type PickerState = {
  leadId: string;
  date: Date;
  mode: "date" | "time";
} | null;

const pad2 = (value: number) => String(value).padStart(2, "0");
const toDateInputValue = (value: Date) => `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
const toTimeInputValue = (value: Date) => `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;

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
  const [webPickerVisible, setWebPickerVisible] = useState(false);
  const [webPickerLeadId, setWebPickerLeadId] = useState("");
  const [webPickerDate, setWebPickerDate] = useState("");
  const [webPickerTime, setWebPickerTime] = useState("");
  const [diaryModalLead, setDiaryModalLead] = useState<Lead | null>(null);
  const [diaryEntries, setDiaryEntries] = useState<LeadDiaryEntry[]>([]);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diaryDraft, setDiaryDraft] = useState("");
  const [showAllDiaryEntries, setShowAllDiaryEntries] = useState(false);
  const [editingDiaryEntryId, setEditingDiaryEntryId] = useState("");
  const [diaryEditDraft, setDiaryEditDraft] = useState("");
  const [updatingDiaryEntry, setUpdatingDiaryEntry] = useState(false);
  const [isDiaryListening, setIsDiaryListening] = useState(false);
  const [isDiaryMicSupported, setIsDiaryMicSupported] = useState(false);
  const diaryRecognitionRef = useRef<any>(null);
  const lastDiaryTranscriptRef = useRef("");

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

  useEffect(() => {
    const win = globalThis as any;
    const SpeechRecognition = win?.SpeechRecognition || win?.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsDiaryMicSupported(false);
      diaryRecognitionRef.current = null;
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        lastDiaryTranscriptRef.current = "";
        setIsDiaryListening(true);
      };
      recognition.onend = () => {
        setIsDiaryListening(false);
      };
      recognition.onerror = () => {
        setIsDiaryListening(false);
      };
      recognition.onresult = (event: any) => {
        const chunks = [];
        for (let index = event?.resultIndex || 0; index < (event?.results?.length || 0); index += 1) {
          if (!event.results[index]?.isFinal) continue;
          const transcript = String(event.results[index]?.[0]?.transcript || "").trim();
          if (transcript) chunks.push(transcript);
        }
        const incomingText = chunks.join(" ").replace(/\s+/g, " ").trim();
        if (!incomingText) return;

        setDiaryDraft((prev) => {
          const normalizedPrev = String(prev || "").trimEnd();
          if (!normalizedPrev) {
            lastDiaryTranscriptRef.current = incomingText;
            return incomingText;
          }
          const lastIncoming = lastDiaryTranscriptRef.current;
          if (incomingText === lastIncoming || normalizedPrev.endsWith(incomingText)) {
            return normalizedPrev;
          }
          lastDiaryTranscriptRef.current = incomingText;
          return `${normalizedPrev} ${incomingText}`;
        });
      };

      diaryRecognitionRef.current = recognition;
      setIsDiaryMicSupported(true);
    } catch {
      setIsDiaryMicSupported(false);
      diaryRecognitionRef.current = null;
    }

    return () => {
      if (!diaryRecognitionRef.current) return;
      try {
        diaryRecognitionRef.current.stop();
      } catch {}
    };
  }, []);

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
    if (Platform.OS === "web") {
      setWebPickerLeadId(leadId);
      setWebPickerDate(toDateInputValue(current));
      setWebPickerTime(toTimeInputValue(current));
      setWebPickerVisible(true);
      return;
    }
    setPickerState({ leadId, date: current, mode });
  };

  const applyWebPicker = () => {
    if (!webPickerLeadId || !webPickerDate || !webPickerTime) {
      setError("Please select both date and time");
      return;
    }
    const parsed = new Date(`${webPickerDate}T${webPickerTime}:00`);
    if (Number.isNaN(parsed.getTime())) {
      setError("Please select a valid date/time");
      return;
    }
    setDraftMap((prev) => ({
      ...prev,
      [webPickerLeadId]: parsed,
    }));
    setWebPickerVisible(false);
    setWebPickerLeadId("");
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

      setPickerState({ leadId: state.leadId, date: withDate, mode: "time" });
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

  const scheduleLead = async (lead: Lead) => {
    const leadId = String(lead?._id || "");
    if (!leadId) return;
    const selectedDate = draftMap[leadId];
    if (!selectedDate || Number.isNaN(selectedDate.getTime())) {
      setError("Please select a valid follow-up date/time");
      return;
    }

    try {
      setSavingId(leadId);
      setError("");
      const updated = await updateLeadStatus(leadId, {
        status: String(lead.status || "NEW"),
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

  const openLeadDiary = async (lead: Lead) => {
    setDiaryModalLead(lead);
    setDiaryEntries([]);
    setDiaryDraft("");
    setEditingDiaryEntryId("");
    setDiaryEditDraft("");
    setShowAllDiaryEntries(false);
    try {
      setDiaryLoading(true);
      const entries = await getLeadDiary(lead._id);
      setDiaryEntries(Array.isArray(entries) ? entries : []);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load lead diary"));
    } finally {
      setDiaryLoading(false);
    }
  };

  const closeLeadDiary = () => {
    setDiaryModalLead(null);
    setDiaryEntries([]);
    setDiaryDraft("");
    setEditingDiaryEntryId("");
    setDiaryEditDraft("");
    setShowAllDiaryEntries(false);
    if (diaryRecognitionRef.current && isDiaryListening) {
      try {
        diaryRecognitionRef.current.stop();
      } catch {}
    }
  };

  const handleDiaryVoiceToggle = () => {
    if (!isDiaryMicSupported || !diaryRecognitionRef.current) {
      setError("Voice input not supported on this device/browser");
      return;
    }
    try {
      if (isDiaryListening) {
        diaryRecognitionRef.current.stop();
      } else {
        diaryRecognitionRef.current.start();
      }
    } catch {
      setError("Unable to start voice input");
    }
  };

  const saveLeadDiary = async () => {
    if (!diaryModalLead?._id) return;
    const note = diaryDraft.trim();
    if (!note) {
      setError("Diary note cannot be empty");
      return;
    }
    try {
      setSavingId(diaryModalLead._id);
      const entry = await addLeadDiaryEntry(diaryModalLead._id, { note });
      if (entry?._id) {
        setDiaryEntries((prev) => [entry, ...prev]);
      }
      setDiaryDraft("");
      setSuccess("Diary note added");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to save diary note"));
    } finally {
      setSavingId("");
    }
  };

  const startEditDiary = (entry: LeadDiaryEntry) => {
    setEditingDiaryEntryId(String(entry._id || ""));
    setDiaryEditDraft(String(entry.note || entry.conversation || entry.visitDetails || entry.nextStep || entry.conversionDetails || ""));
  };

  const cancelEditDiary = () => {
    setEditingDiaryEntryId("");
    setDiaryEditDraft("");
  };

  const updateDiary = async () => {
    if (!diaryModalLead?._id || !editingDiaryEntryId) return;
    const note = diaryEditDraft.trim();
    if (!note) {
      setError("Diary note cannot be empty");
      return;
    }
    try {
      setUpdatingDiaryEntry(true);
      const updated = await updateLeadDiaryEntry(diaryModalLead._id, editingDiaryEntryId, { note });
      if (updated?._id) {
        setDiaryEntries((prev) => prev.map((entry) => (String(entry._id) === String(updated._id) ? updated : entry)));
      }
      setSuccess("Diary note updated");
      cancelEditDiary();
    } catch (e) {
      setError(toErrorMessage(e, "Failed to update diary note"));
    } finally {
      setUpdatingDiaryEntry(false);
    }
  };

  const visibleDiaryEntries = showAllDiaryEntries ? diaryEntries : diaryEntries.slice(0, 4);

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
                onPress={() => scheduleLead(item)}
                disabled={savingId === item._id}
              >
                {savingId === item._id ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Schedule</Text>}
              </Pressable>

              <Pressable
                style={styles.diaryBtn}
                onPress={() => openLeadDiary(item)}
              >
                <Text style={styles.diaryBtnText}>Lead Diary</Text>
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
          is24Hour
        />
      ) : null}

      <Modal visible={webPickerVisible} transparent animationType="fade" onRequestClose={() => setWebPickerVisible(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Follow-up Date & Time</Text>
            {/* web-only input type fallback for reliable browser selection */}
            {/* @ts-ignore */}
            <TextInput style={styles.search} value={webPickerDate} onChangeText={setWebPickerDate} placeholder="YYYY-MM-DD" type="date" />
            {/* @ts-ignore */}
            <TextInput style={styles.search} value={webPickerTime} onChangeText={setWebPickerTime} placeholder="HH:mm" type="time" />
            <View style={styles.editActions}>
              <Pressable style={styles.secondaryBtn} onPress={() => setWebPickerVisible(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.addBtn} onPress={applyWebPicker}>
                <Text style={styles.addBtnText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(diaryModalLead)}
        transparent
        animationType="slide"
        onRequestClose={closeLeadDiary}
      >
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Lead Diary</Text>
            <Text style={styles.modalMeta}>{diaryModalLead?.name || "-"}</Text>
            <TextInput
              style={styles.diaryInput}
              placeholder="Add conversation notes, visit details, objections, next step..."
              value={diaryDraft}
              onChangeText={setDiaryDraft}
              multiline
              maxLength={2000}
            />
            <View style={styles.diaryActions}>
              <Pressable style={styles.voiceBtn} onPress={handleDiaryVoiceToggle} disabled={!isDiaryMicSupported || Boolean(savingId)}>
                <Text style={styles.voiceBtnText}>{isDiaryListening ? "Stop Voice" : "Voice"}</Text>
              </Pressable>
              <Pressable style={[styles.addBtn, (!diaryDraft.trim() || Boolean(savingId)) && styles.addBtnDisabled]} onPress={saveLeadDiary} disabled={!diaryDraft.trim() || Boolean(savingId)}>
                {Boolean(savingId) ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.addBtnText}>Add Note</Text>}
              </Pressable>
            </View>
            <Text style={styles.counterText}>{diaryDraft.length}/2000</Text>

            {diaryLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color="#0f172a" />
              </View>
            ) : (
              <ScrollView style={styles.diaryList}>
                {diaryEntries.length > 4 ? (
                  <Pressable onPress={() => setShowAllDiaryEntries((prev) => !prev)} style={styles.moreBtn}>
                    <Text style={styles.moreBtnText}>{showAllDiaryEntries ? "Show less" : "See more"}</Text>
                  </Pressable>
                ) : null}
                {visibleDiaryEntries.length === 0 ? (
                  <Text style={styles.empty}>No diary notes yet</Text>
                ) : (
                  visibleDiaryEntries.map((entry) => (
                    <View key={entry._id} style={styles.diaryCard}>
                      {String(editingDiaryEntryId) === String(entry._id) ? (
                        <>
                          <TextInput
                            style={[styles.diaryInput, styles.editInput]}
                            value={diaryEditDraft}
                            onChangeText={setDiaryEditDraft}
                            multiline
                            maxLength={2000}
                          />
                          <View style={styles.editActions}>
                            <Pressable style={styles.secondaryBtn} onPress={cancelEditDiary} disabled={updatingDiaryEntry}>
                              <Text style={styles.secondaryBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={[styles.addBtn, (!diaryEditDraft.trim() || updatingDiaryEntry) && styles.addBtnDisabled]} onPress={updateDiary} disabled={!diaryEditDraft.trim() || updatingDiaryEntry}>
                              <Text style={styles.addBtnText}>{updatingDiaryEntry ? "Saving..." : "Save"}</Text>
                            </Pressable>
                          </View>
                        </>
                      ) : (
                        <>
                          <Text style={styles.diaryText}>{String(entry.note || "-")}</Text>
                          <View style={styles.diaryMetaRow}>
                            <Text style={styles.modalMeta}>
                              {formatDateTime(entry.createdAt)} {entry.createdBy?.name ? `| ${entry.createdBy.name}` : ""}
                              {entry.isEdited ? " | Edited" : ""}
                            </Text>
                            <Pressable style={styles.secondaryBtn} onPress={() => startEditDiary(entry)}>
                              <Text style={styles.secondaryBtnText}>Edit</Text>
                            </Pressable>
                          </View>
                        </>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            <Pressable style={styles.closeBtn} onPress={closeLeadDiary}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  diaryBtn: {
    marginTop: 8,
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  diaryBtnText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
  },
  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
    padding: 12,
  },
  modalCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#fff",
    padding: 12,
    maxHeight: "88%",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  diaryInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 84,
    textAlignVertical: "top",
  },
  diaryActions: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  voiceBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceBtnText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  addBtn: {
    borderRadius: 8,
    backgroundColor: "#0f172a",
    paddingHorizontal: 12,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 90,
  },
  addBtnDisabled: {
    opacity: 0.6,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  counterText: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 11,
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  diaryList: {
    marginTop: 8,
  },
  moreBtn: {
    alignSelf: "flex-end",
    marginBottom: 6,
  },
  moreBtnText: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "600",
  },
  diaryCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    padding: 10,
    marginBottom: 8,
  },
  diaryText: {
    color: "#334155",
    fontSize: 12,
  },
  diaryMetaRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  editInput: {
    marginTop: 0,
    minHeight: 72,
  },
  editActions: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "700",
  },
  closeBtn: {
    marginTop: 6,
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  closeBtnText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
  },
});
