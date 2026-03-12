import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { Screen } from "../../components/common/Screen";
import { useAuth } from "../../context/AuthContext";
import { addLeadDiaryEntry, clearLeadFollowUp, getAllLeads, getLeadDiary, updateLeadStatus, type LeadDiaryEntry } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";
import type { Lead } from "../../types";

const WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const toDate = (v?: string | null) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const k = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmt = (v?: string | null) => { const d = toDate(v); return d ? d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"; };
const fmtFollowUpInput = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase()}`;
const grid = (c: Date) => { const s = new Date(c.getFullYear(), c.getMonth(), 1); s.setDate(1 - s.getDay()); return Array.from({ length: 42 }, (_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d; }); };
const roleText = (r?: string | null) => String(r || "USER").replaceAll("_", " ").toUpperCase();
const toIsoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const to24Time = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const toLocalDateTimeValue = (d: Date) => `${toIsoDate(d)}T${to24Time(d)}`;
const toDigits = (value?: string) => String(value || "").replace(/\D/g, "");
const toLocalTenDigitPhone = (value?: string) => {
  const digits = toDigits(value);
  if (!digits) return "";
  if (digits.length >= 10) return digits.slice(-10);
  return "";
};
const toWhatsAppPhone = (value?: string) => {
  const local = toLocalTenDigitPhone(value);
  if (!local) return "";
  return `91${local}`;
};

export const MasterScheduleScreen = () => {
  const { width } = useWindowDimensions();
  const isCompact = width < 980;
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [leadPicker, setLeadPicker] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [scheduleAt, setScheduleAt] = useState(new Date());
  const [nativeMode, setNativeMode] = useState<"date" | "time" | null>(null);
  const [scheduleNote, setScheduleNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [detailsLead, setDetailsLead] = useState<Lead | null>(null);
  const [diary, setDiary] = useState<Record<string, LeadDiaryEntry[]>>({});
  const [diaryLoading, setDiaryLoading] = useState<Record<string, boolean>>({});
  const [diaryDraft, setDiaryDraft] = useState<Record<string, string>>({});
  const [diarySavingLead, setDiarySavingLead] = useState("");
  const [webCalendarPickerVisible, setWebCalendarPickerVisible] = useState(false);
  const [webCalendarValue, setWebCalendarValue] = useState("");
  const [isScheduleMicSupported, setIsScheduleMicSupported] = useState(true);
  const [scheduleSpeechPermissionGranted, setScheduleSpeechPermissionGranted] = useState(Platform.OS === "web");
  const [isScheduleListening, setIsScheduleListening] = useState(false);
  const [scheduleNoteSaving, setScheduleNoteSaving] = useState(false);
  const webCalendarInputRef = useRef<any>(null);
  const scheduleRecognitionRef = useRef<any>(null);
  const lastScheduleTranscriptRef = useRef("");

  const load = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true); else setLoading(true);
      setError("");
      const rows = await getAllLeads();
      setLeads(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load schedule"));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!ok) return; const t = setTimeout(() => setOk(""), 1500); return () => clearTimeout(t); }, [ok]);

  const followUps = useMemo(() => leads.filter((l) => Boolean(toDate(l.nextFollowUp))), [leads]);
  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    followUps.forEach((l) => { const d = toDate(l.nextFollowUp); if (d) m.set(k(d), (m.get(k(d)) || 0) + 1); });
    return m;
  }, [followUps]);
  const dayRows = useMemo(() => followUps.filter((l) => { const d = toDate(l.nextFollowUp); return Boolean(d && sameDay(d, selectedDate)); }), [followUps, selectedDate]);
  const leadRows = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    const rows = [...leads].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    if (!q) return rows;
    return rows.filter((l) => [l.name, l.phone, l.city, l.projectInterested].map((v) => String(v || "").toLowerCase()).some((v) => v.includes(q)));
  }, [leadSearch, leads]);
  const selectedLead = useMemo(() => leads.find((l) => String(l._id) === String(selectedLeadId)) || null, [leads, selectedLeadId]);

  const loadDiary = useCallback(async (leadId: string, force = false) => {
    if (!leadId) return;
    if (!force && diary[leadId]) return;
    try {
      setDiaryLoading((p) => ({ ...p, [leadId]: true }));
      const rows = await getLeadDiary(leadId);
      setDiary((p) => ({ ...p, [leadId]: Array.isArray(rows) ? rows : [] }));
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load lead diary"));
    } finally {
      setDiaryLoading((p) => ({ ...p, [leadId]: false }));
    }
  }, [diary]);

  useEffect(() => { dayRows.forEach((r) => { loadDiary(r._id); }); }, [dayRows, loadDiary]);

  useEffect(() => {
    if (!webCalendarPickerVisible || Platform.OS !== "web") return;
    const timer = setTimeout(() => {
      const node = webCalendarInputRef.current as any;
      try {
        if (node?.showPicker) node.showPicker();
        else node?.focus?.();
      } catch {
        node?.focus?.();
      }
    }, 10);
    return () => clearTimeout(timer);
  }, [webCalendarPickerVisible]);

  useEffect(() => {
    let active = true;

    const setupNativeSpeech = async () => {
      try {
        const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
        if (!active) return;
        if (!available) {
          setIsScheduleMicSupported(false);
          setScheduleSpeechPermissionGranted(false);
          return;
        }
        const permission = await ExpoSpeechRecognitionModule.getPermissionsAsync();
        if (!active) return;
        setScheduleSpeechPermissionGranted(Boolean(permission?.granted));
        setIsScheduleMicSupported(true);
      } catch {
        if (!active) return;
        setIsScheduleMicSupported(false);
        setScheduleSpeechPermissionGranted(false);
      }
    };

    if (Platform.OS !== "web") {
      scheduleRecognitionRef.current = null;
      void setupNativeSpeech();
      return () => {
        active = false;
        try {
          ExpoSpeechRecognitionModule.abort();
        } catch {}
      };
    }

    const win = globalThis as any;
    const SpeechRecognition = win?.SpeechRecognition || win?.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsScheduleMicSupported(false);
      setScheduleSpeechPermissionGranted(false);
      scheduleRecognitionRef.current = null;
      return () => {
        active = false;
      };
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        lastScheduleTranscriptRef.current = "";
        setIsScheduleListening(true);
      };
      recognition.onend = () => {
        setIsScheduleListening(false);
      };
      recognition.onerror = () => {
        setIsScheduleListening(false);
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

        setScheduleNote((prev) => {
          const normalizedPrev = String(prev || "").trimEnd();
          if (!normalizedPrev) {
            lastScheduleTranscriptRef.current = incomingText;
            return incomingText;
          }

          const lastIncoming = lastScheduleTranscriptRef.current;
          if (incomingText === lastIncoming || normalizedPrev.endsWith(incomingText)) {
            return normalizedPrev;
          }

          lastScheduleTranscriptRef.current = incomingText;
          return `${normalizedPrev} ${incomingText}`;
        });
      };

      scheduleRecognitionRef.current = recognition;
      setIsScheduleMicSupported(true);
      setScheduleSpeechPermissionGranted(true);
    } catch {
      setIsScheduleMicSupported(false);
      setScheduleSpeechPermissionGranted(false);
      scheduleRecognitionRef.current = null;
    }

    return () => {
      active = false;
      if (!scheduleRecognitionRef.current) return;
      try {
        scheduleRecognitionRef.current.stop();
      } catch {}
    };
  }, []);

  useSpeechRecognitionEvent("start", () => {
    if (Platform.OS === "web") return;
    lastScheduleTranscriptRef.current = "";
    setIsScheduleListening(true);
  });

  useSpeechRecognitionEvent("end", () => {
    if (Platform.OS === "web") return;
    setIsScheduleListening(false);
    lastScheduleTranscriptRef.current = "";
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (Platform.OS === "web") return;
    setIsScheduleListening(false);
    const message = String((event as any)?.message || "").trim() || "Unable to start voice input. Try again.";
    setError(message);
  });

  useSpeechRecognitionEvent("result", (event) => {
    if (Platform.OS === "web") return;
    const results = Array.isArray((event as any)?.results) ? (event as any).results : [];
    const first = results[0] || null;
    const transcript = String(first?.transcript || "").replace(/\s+/g, " ").trim();
    if (!transcript) return;
    if (!(event as any)?.isFinal && transcript === lastScheduleTranscriptRef.current) return;
    lastScheduleTranscriptRef.current = transcript;
    if (!(event as any)?.isFinal) return;
    setScheduleNote((prev) => `${String(prev || "").trim()} ${transcript}`.trim());
  });

  const openDatePicker = () => {
    if (Platform.OS === "web") {
      setWebCalendarValue(toLocalDateTimeValue(scheduleAt || new Date()));
      setWebCalendarPickerVisible(true);
      return;
    }
    setNativeMode("date");
  };

  const onNative = (event: DateTimePickerEvent, picked?: Date) => {
    if (event.type === "dismissed") { setNativeMode(null); return; }
    const d = picked || scheduleAt;
    if (nativeMode === "date") { const n = new Date(scheduleAt); n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); setScheduleAt(n); setNativeMode("time"); return; }
    const n = new Date(scheduleAt); n.setHours(d.getHours(), d.getMinutes(), 0, 0); setScheduleAt(n); setNativeMode(null);
  };

  const saveFollowUp = async () => {
    if (!selectedLeadId) { setError("Please select lead for follow-up"); return; }
    const lead = leads.find((l) => String(l._id) === String(selectedLeadId));
    if (!lead) { setError("Lead not found"); return; }
    try {
      setSaving(true); setError("");
      const updated = await updateLeadStatus(lead._id, { status: String(lead.status || "NEW"), nextFollowUp: scheduleAt.toISOString() });
      setLeads((p) => p.map((r) => (String(r._id) === String(updated._id) ? updated : r)));
      const note = scheduleNote.trim();
      if (note) {
        const e = await addLeadDiaryEntry(lead._id, { note });
        if (e?._id) setDiary((p) => ({ ...p, [lead._id]: [e, ...(p[lead._id] || [])] }));
      }
      setScheduleNote(""); setSelectedDate(new Date(scheduleAt)); setMonth(new Date(scheduleAt)); setOk("Follow-up saved");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to save follow-up"));
    } finally { setSaving(false); }
  };

  const deleteFollowUp = async (lead: Lead) => {
    try {
      setDeletingId(lead._id); setError("");
      const updated = await clearLeadFollowUp(lead._id, String(lead.status || "NEW"));
      if (!updated || updated.nextFollowUp) {
        throw new Error("Follow-up not cleared");
      }
      setLeads((p) => p.map((r) => (String(r._id) === String(updated._id) ? updated : r)));
      setOk("Follow-up deleted");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to delete follow-up"));
    } finally { setDeletingId(""); }
  };

  const saveDiary = async (lead: Lead) => {
    const note = String(diaryDraft[lead._id] || "").trim();
    if (!note) {
      setError("Diary note cannot be empty");
      return;
    }
    try {
      setDiarySavingLead(lead._id);
      const entry = await addLeadDiaryEntry(lead._id, { note });
      if (entry?._id) setDiary((p) => ({ ...p, [lead._id]: [entry, ...(p[lead._id] || [])] }));
      setDiaryDraft((p) => ({ ...p, [lead._id]: "" }));
      setOk("Lead diary updated");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to save lead diary"));
    } finally { setDiarySavingLead(""); }
  };

  const doCall = async (phone?: string) => {
    const dialNumber = toLocalTenDigitPhone(phone);
    if (!dialNumber) return setError("Phone number must have at least 10 digits.");
    const url = `tel:${dialNumber}`;
    const supported = await Linking.canOpenURL(url).catch(() => false);
    if (!supported) return setError("Dialer unavailable on this device.");
    Linking.openURL(url).catch(() => setError("Call failed"));
  };

  const saveScheduleDiaryNote = async () => {
    if (!selectedLeadId) {
      setError("Please select lead first");
      return;
    }
    const note = String(scheduleNote || "").trim();
    if (!note) {
      setError("Diary note cannot be empty");
      return;
    }

    try {
      setScheduleNoteSaving(true);
      setError("");
      const entry = await addLeadDiaryEntry(selectedLeadId, { note });
      if (entry?._id) {
        setDiary((p) => ({ ...p, [selectedLeadId]: [entry, ...(p[selectedLeadId] || [])] }));
      }
      setScheduleNote("");
      setOk("Lead diary updated");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to save lead diary"));
    } finally {
      setScheduleNoteSaving(false);
    }
  };

  const handleScheduleVoiceToggle = async () => {
    if (!isScheduleMicSupported) {
      setError("Voice input is not supported on this device.");
      return;
    }
    try {
      if (Platform.OS !== "web") {
        if (isScheduleListening) {
          ExpoSpeechRecognitionModule.stop();
          return;
        }
        if (!scheduleSpeechPermissionGranted) {
          const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
          if (!permission?.granted) {
            setError("Microphone permission is required for voice input.");
            return;
          }
          setScheduleSpeechPermissionGranted(true);
        }
        ExpoSpeechRecognitionModule.start({
          lang: "en-IN",
          interimResults: true,
          maxAlternatives: 1,
          continuous: false,
        });
        return;
      }

      if (!scheduleRecognitionRef.current) {
        setError("Voice input is not supported in this browser.");
        return;
      }
      if (isScheduleListening) {
        scheduleRecognitionRef.current.stop();
        return;
      }
      scheduleRecognitionRef.current.start();
    } catch {
      setError("Unable to start voice input. Try again.");
      setIsScheduleListening(false);
    }
  };
  const doWhatsApp = async (phone?: string) => {
    const whatsappPhone = toWhatsAppPhone(phone);
    if (!whatsappPhone) return setError("WhatsApp needs at least 10 digits.");
    const appUrl = `whatsapp://send?phone=${whatsappPhone}`;
    const webUrl = `https://wa.me/${whatsappPhone}`;
    if (Platform.OS === "web") {
      Linking.openURL(webUrl).catch(() => setError("WhatsApp failed"));
      return;
    }
    const appSupported = await Linking.canOpenURL(appUrl).catch(() => false);
    Linking.openURL(appSupported ? appUrl : webUrl).catch(() => setError("WhatsApp failed"));
  };
  const doEmail = async (email?: string) => {
    const safeEmail = String(email || "").trim();
    if (!safeEmail) return setError("Email not available");
    const url = `mailto:${safeEmail}`;
    const supported = await Linking.canOpenURL(url).catch(() => false);
    if (!supported) return setError("Mail app unavailable on this device.");
    Linking.openURL(url).catch(() => setError("Email failed"));
  };
  const doMap = async (lead: Lead) => {
    const q = encodeURIComponent(`${lead.projectInterested || ""} ${lead.city || ""}`.trim() || lead.name || "location");
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => setError("Map failed"));
  };

  return (
    <Screen title="Master Schedule" subtitle="Follow-up Calendar" loading={loading} error={error}>
      {ok ? <Text style={styles.ok}>{ok}</Text> : null}
      <ScrollView contentContainerStyle={styles.wrap} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Text style={styles.topTitle}>Schedule Command Center</Text>
          <Text style={styles.topMeta}>ROLE: {roleText(role)}</Text>
        </View>

        <View style={[styles.row, isCompact && styles.rowCompact]}>
          <View style={[styles.left, isCompact && styles.colCompact]}>
            <View style={styles.card}>
              <View style={styles.monthHead}>
                <Text style={styles.h1}>{month.toLocaleString("en-IN", { month: "long", year: "numeric" })}</Text>
                <View style={styles.navRow}>
                  <Pressable style={styles.navBtn} onPress={() => setMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}><Ionicons name="chevron-back" size={15} color="#334155" /></Pressable>
                  <Pressable style={styles.navBtn} onPress={() => setMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}><Ionicons name="chevron-forward" size={15} color="#334155" /></Pressable>
                </View>
              </View>
              <View style={styles.week}>{WEEK.map((d) => <Text key={d} style={styles.weekText}>{d}</Text>)}</View>
              <View style={styles.grid}>
                {grid(month).map((d) => {
                  const inMonth = d.getMonth() === month.getMonth();
                  const sel = sameDay(d, selectedDate);
                  const count = byDay.get(k(d)) || 0;
                  return (
                    <Pressable key={k(d)} style={[styles.day, !inMonth && styles.dayMuted, sel && styles.daySel]} onPress={() => setSelectedDate(d)}>
                      <Text style={[styles.dayText, !inMonth && styles.dayTextMuted]}>{d.getDate()}</Text>
                      {count > 0 ? <Text style={styles.badge}>{count}</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={[styles.right, isCompact && styles.colCompact]}>
            <View style={styles.card}>
              <View style={styles.headRow}>
                <Text style={styles.h2}>Schedule Follow-up</Text>
                <View style={styles.tools}>
                  <Pressable style={styles.tool} onPress={() => load(true)}><Text style={styles.toolText}>Refresh</Text></Pressable>
                  <Pressable style={styles.tool} onPress={() => { const n = new Date(); setSelectedDate(n); setMonth(new Date(n.getFullYear(), n.getMonth(), 1)); }}><Text style={styles.toolText}>Today</Text></Pressable>
                </View>
              </View>
              <Pressable style={styles.inputBtn} onPress={() => setLeadPicker(true)}>
                <Text style={styles.inputBtnText}>{selectedLead ? `${selectedLead.name} (${selectedLead.phone || "-"})` : "Select lead for follow-up"}</Text>
                <Ionicons name="chevron-down" size={14} color="#334155" />
              </Pressable>
              <Pressable style={styles.inputBtn} onPress={openDatePicker}>
                <Text style={styles.inputBtnText}>{fmtFollowUpInput(scheduleAt)}</Text>
                <Ionicons name="calendar-outline" size={14} color="#334155" />
              </Pressable>
              <TextInput style={styles.textarea} placeholder="Lead diary note while scheduling (optional)" placeholderTextColor="#94a3b8" value={scheduleNote} onChangeText={setScheduleNote} multiline />
              <View style={styles.scheduleDiaryActionRow}>
                <Pressable
                  style={[styles.voiceBtn, (!isScheduleMicSupported || (!scheduleSpeechPermissionGranted && Platform.OS !== "web")) && styles.disabled]}
                  onPress={() => { void handleScheduleVoiceToggle(); }}
                  disabled={!isScheduleMicSupported}
                >
                  <Ionicons name={isScheduleListening ? "mic" : "mic-outline"} size={14} color={isScheduleListening ? "#2563eb" : "#334155"} />
                  <Text style={styles.voiceBtnText}>{isScheduleListening ? "Listening..." : "Voice"}</Text>
                </Pressable>
                <Pressable style={[styles.addDiary, scheduleNoteSaving && styles.disabled]} onPress={() => { void saveScheduleDiaryNote(); }} disabled={scheduleNoteSaving}>
                  {scheduleNoteSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.addDiaryText}>Add Note</Text>}
                </Pressable>
              </View>
              <Pressable style={[styles.save, saving && styles.disabled]} onPress={saveFollowUp} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Save Follow-up</Text>}
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.h2}>{selectedDate.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long" })}</Text>
              <Text style={styles.meta}>{dayRows.length} items</Text>
              {dayRows.length === 0 ? <Text style={styles.empty}>No follow-ups on selected date</Text> : dayRows.map((lead) => (
                <View key={lead._id} style={styles.fu}>
                  <View style={styles.fuHead}>
                    <Text style={styles.fuName}>{lead.name}</Text>
                    <View style={styles.act}>
                      <Pressable style={styles.icon} onPress={() => { setDetailsLead(lead); loadDiary(lead._id, true); }}><Ionicons name="document-text-outline" size={12} color="#334155" /></Pressable>
                      <Pressable style={styles.icon} onPress={() => deleteFollowUp(lead)} disabled={deletingId === lead._id}>{deletingId === lead._id ? <ActivityIndicator size="small" color="#dc2626" /> : <Ionicons name="trash-outline" size={12} color="#dc2626" />}</Pressable>
                    </View>
                  </View>
                  <Text style={styles.meta}>• {fmt(lead.nextFollowUp)}</Text>
                  <Text style={styles.meta}>• {lead.phone || "-"}</Text>
                  <Text style={styles.meta}>• Assigned: {lead.assignedTo?.name || "-"}</Text>
                  <Text style={styles.meta}>• {lead.status || "NEW"}</Text>
                  <View style={styles.diaryBox}>
                    <Text style={styles.diaryTitle}>Lead Diary</Text>
                    <TextInput style={styles.diaryInput} placeholder={`Add diary note for ${lead.name}`} placeholderTextColor="#94a3b8" value={diaryDraft[lead._id] || ""} onChangeText={(v) => setDiaryDraft((p) => ({ ...p, [lead._id]: v }))} multiline />
                    <Pressable style={[styles.addDiary, diarySavingLead === lead._id && styles.disabled]} onPress={() => saveDiary(lead)} disabled={diarySavingLead === lead._id}>
                      {diarySavingLead === lead._id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.addDiaryText}>Add Note</Text>}
                    </Pressable>
                    {diaryLoading[lead._id] ? <ActivityIndicator size="small" color="#334155" /> : (diary[lead._id] || []).length === 0 ? <Text style={styles.emptyInline}>No diary notes yet</Text> : (
                      <View style={styles.diaryList}>{(diary[lead._id] || []).map((e) => <View key={e._id} style={styles.diaryItem}><Text style={styles.diaryItemText}>{String(e.note || "-")}</Text><Text style={styles.diaryItemMeta}>{fmt(e.createdAt)} {e.createdBy?.name ? `| ${e.createdBy.name}` : ""}</Text></View>)}</View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {nativeMode ? <DateTimePicker value={scheduleAt} mode={nativeMode} is24Hour onChange={onNative} /> : null}
      <Modal visible={webCalendarPickerVisible} transparent animationType="fade" onRequestClose={() => setWebCalendarPickerVisible(false)}>
        <View style={styles.modal}>
          <View style={styles.modalCard}>
            <View style={styles.headRow}>
              <Text style={styles.h2}>Select Follow-up</Text>
              <Pressable style={styles.icon} onPress={() => setWebCalendarPickerVisible(false)}>
                <Ionicons name="close" size={14} color="#334155" />
              </Pressable>
            </View>
            <input
              ref={webCalendarInputRef}
              type="datetime-local"
              value={webCalendarValue}
              onChange={(event: any) => {
                const value = String(event?.target?.value || "");
                setWebCalendarValue(value);
                const next = new Date(value);
                if (!Number.isNaN(next.getTime())) {
                  setScheduleAt(next);
                }
                setWebCalendarPickerVisible(false);
              }}
              onBlur={() => setWebCalendarPickerVisible(false)}
              style={styles.webNativeDateTimeInput as any}
            />
          </View>
        </View>
      </Modal>
      <Modal visible={leadPicker} transparent animationType="fade" onRequestClose={() => setLeadPicker(false)}>
        <View style={styles.modal}><View style={styles.modalCard}><Text style={styles.h2}>Select Lead</Text><TextInput style={styles.modalInput} value={leadSearch} onChangeText={setLeadSearch} placeholder="Search lead" placeholderTextColor="#94a3b8" /><ScrollView style={{ maxHeight: 340, marginTop: 8 }}>{leadRows.map((lead) => <Pressable key={lead._id} style={[styles.leadRow, String(selectedLeadId) === String(lead._id) && styles.leadRowA]} onPress={() => { setSelectedLeadId(lead._id); setLeadPicker(false); }}><Text style={styles.leadName}>{lead.name}</Text><Text style={styles.leadMeta}>{lead.phone || "-"} | {lead.city || "-"}</Text></Pressable>)}{leadRows.length === 0 ? <Text style={styles.empty}>No lead found</Text> : null}</ScrollView><Pressable style={styles.modalBtn} onPress={() => setLeadPicker(false)}><Text style={styles.modalBtnText}>Close</Text></Pressable></View></View>
      </Modal>
      <Modal visible={Boolean(detailsLead)} transparent animationType="slide" onRequestClose={() => setDetailsLead(null)}>
        <View style={styles.modal}><View style={styles.modalCard}><View style={styles.headRow}><Text style={styles.h2}>Follow-up Details</Text><Pressable style={styles.icon} onPress={() => setDetailsLead(null)}><Ionicons name="close" size={14} color="#334155" /></Pressable></View>
          <ScrollView style={styles.detailsScroll} contentContainerStyle={styles.detailsContent} showsVerticalScrollIndicator={false}>
          {detailsLead ? <>
            <Pressable style={styles.del} onPress={() => deleteFollowUp(detailsLead)}><Text style={styles.delText}>Delete Follow-up</Text></Pressable>
            <View style={styles.block}><Text style={styles.blockTitle}>Schedule</Text><Text style={styles.blockText}>Follow-up: {fmt(detailsLead.nextFollowUp)}</Text><Text style={styles.blockText}>Status: {detailsLead.status || "NEW"}</Text><Text style={styles.blockText}>Assigned: {detailsLead.assignedTo?.name || "-"}</Text></View>
            <View style={styles.block}><Text style={styles.blockTitle}>Lead Info</Text><Text style={styles.blockText}>Phone: {detailsLead.phone || "-"}</Text><Text style={styles.blockText}>Email: {(detailsLead as any)?.email || "-"}</Text><Text style={styles.blockText}>City: {detailsLead.city || "-"}</Text><Text style={styles.blockText}>Project: {detailsLead.projectInterested || "-"}</Text></View>
            <View style={styles.block}><Text style={styles.blockTitle}>Contact Actions</Text><View style={styles.contact}><Pressable style={styles.contactActionItem} onPress={() => doCall(detailsLead.phone)}><View style={styles.contactIconBtn}><Ionicons name="call-outline" size={18} color="#334155" /></View><Text style={styles.contactActionLabel}>Call</Text></Pressable><Pressable style={styles.contactActionItem} onPress={() => doWhatsApp(detailsLead.phone)}><View style={styles.contactIconBtn}><Ionicons name="logo-whatsapp" size={18} color="#16a34a" /></View><Text style={styles.contactActionLabel}>WhatsApp</Text></Pressable><Pressable style={styles.contactActionItem} onPress={() => doEmail((detailsLead as any)?.email)}><View style={styles.contactIconBtn}><Ionicons name="mail-outline" size={18} color="#334155" /></View><Text style={styles.contactActionLabel}>Email</Text></Pressable><Pressable style={styles.contactActionItem} onPress={() => doMap(detailsLead)}><View style={styles.contactIconBtn}><Ionicons name="location-outline" size={18} color="#334155" /></View><Text style={styles.contactActionLabel}>Maps</Text></Pressable></View></View>
            <View style={styles.block}><Text style={styles.blockTitle}>Lead Diary Activity</Text>{diaryLoading[detailsLead._id] ? <ActivityIndicator size="small" color="#334155" /> : (diary[detailsLead._id] || []).length === 0 ? <Text style={styles.emptyInline}>No diary notes yet</Text> : <ScrollView style={{ maxHeight: 170 }}>{(diary[detailsLead._id] || []).map((e) => <View key={e._id} style={styles.diaryItem}><Text style={styles.diaryItemText}>{String(e.note || "-")}</Text><Text style={styles.diaryItemMeta}>{fmt(e.createdAt)} {e.createdBy?.name ? `| ${e.createdBy.name}` : ""}</Text></View>)}</ScrollView>}</View>
          </> : null}
          </ScrollView>
        </View></View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 8, paddingBottom: 12 }, ok: { marginBottom: 8, borderWidth: 1, borderColor: "#86efac", borderRadius: 10, backgroundColor: "#f0fdf4", color: "#166534", padding: 8, fontSize: 12, fontWeight: "700" },
  top: { borderWidth: 1, borderColor: "#0f3c5a", borderRadius: 12, backgroundColor: "#144766", padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" },
  topTitle: { color: "#fff", fontSize: 20, fontWeight: "800" }, topMeta: { color: "#d8f1ff", fontSize: 11, fontWeight: "700" },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" }, rowCompact: { flexDirection: "column", gap: 8 }, left: { flex: 1.2, minWidth: 0 }, right: { flex: 0.8, minWidth: 0, gap: 10 }, colCompact: { width: "100%", flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
  card: { borderWidth: 1, borderColor: "#d6e3ef", borderRadius: 12, backgroundColor: "#fff", padding: 10 },
  monthHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, h1: { fontSize: 20, fontWeight: "800", color: "#0f172a" }, h2: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  navRow: { flexDirection: "row", gap: 6 }, navBtn: { width: 30, height: 30, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  week: { marginTop: 8, flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#e2e8f0", paddingVertical: 6 }, weekText: { flex: 1, textAlign: "center", color: "#64748b", fontSize: 10, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap" }, day: { width: "14.285%", minHeight: 68, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#e2e8f0", padding: 6, backgroundColor: "#fff" }, dayMuted: { backgroundColor: "#f8fafc" }, daySel: { backgroundColor: "#e0f2fe" }, dayText: { color: "#0f172a", fontSize: 12, fontWeight: "700" }, dayTextMuted: { color: "#94a3b8" }, badge: { marginTop: 4, alignSelf: "flex-end", color: "#0284c7", fontSize: 11, fontWeight: "800" },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, tools: { flexDirection: "row", gap: 8 }, tool: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 10, minHeight: 30, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }, toolText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  inputBtn: { marginTop: 8, minHeight: 38, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, inputBtnText: { color: "#0f172a", fontSize: 13, fontWeight: "600", flex: 1 },
  textarea: { marginTop: 8, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 8, minHeight: 62, textAlignVertical: "top", color: "#0f172a" },
  scheduleDiaryActionRow: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  voiceBtn: { minWidth: 96, height: 32, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, paddingHorizontal: 10 },
  voiceBtnText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  save: { marginTop: 8, minHeight: 38, borderRadius: 10, backgroundColor: "#0284c7", alignItems: "center", justifyContent: "center" }, saveText: { color: "#fff", fontSize: 13, fontWeight: "800" }, disabled: { opacity: 0.6 },
  meta: { marginTop: 3, color: "#64748b", fontSize: 12 }, empty: { textAlign: "center", color: "#64748b", marginTop: 10, fontSize: 12 },
  fu: { marginTop: 8, borderWidth: 1, borderColor: "#7dd3fc", borderRadius: 10, backgroundColor: "#f0f9ff", padding: 8 }, fuHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, fuName: { flex: 1, color: "#0f172a", fontSize: 15, fontWeight: "700" }, act: { flexDirection: "row", gap: 6 }, icon: { width: 26, height: 26, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  diaryBox: { marginTop: 8, borderWidth: 1, borderColor: "#bfdbfe", borderRadius: 10, backgroundColor: "#fff", padding: 8 }, diaryTitle: { color: "#0f172a", fontSize: 13, fontWeight: "700" }, diaryInput: { marginTop: 6, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, minHeight: 52, paddingHorizontal: 8, paddingVertical: 6, textAlignVertical: "top", color: "#0f172a" },
  addDiary: { marginTop: 6, alignSelf: "flex-end", minWidth: 90, height: 30, borderRadius: 8, backgroundColor: "#38bdf8", alignItems: "center", justifyContent: "center" }, addDiaryText: { color: "#fff", fontSize: 12, fontWeight: "700" }, emptyInline: { color: "#64748b", fontSize: 12, marginTop: 8 },
  diaryList: { marginTop: 8, gap: 6 }, diaryItem: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, backgroundColor: "#f8fafc", padding: 8 }, diaryItemText: { color: "#334155", fontSize: 12 }, diaryItemMeta: { marginTop: 3, color: "#64748b", fontSize: 10 },
  modal: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 12 }, modalCard: { borderWidth: 1, borderColor: "#dbe3ee", borderRadius: 12, backgroundColor: "#fff", padding: 12, maxHeight: "88%" }, modalInput: { marginTop: 8, minHeight: 38, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 9, paddingHorizontal: 10, backgroundColor: "#fff", color: "#0f172a" }, detailsScroll: { marginTop: 8, maxHeight: "88%" }, detailsContent: { paddingBottom: 6 },
  webNativeDateTimeInput: { marginTop: 10, width: "100%", minHeight: 40, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 9, paddingVertical: 8, paddingHorizontal: 10, fontSize: 14, color: "#0f172a", backgroundColor: "#fff" },
  modalRow: { marginTop: 10, flexDirection: "row", justifyContent: "flex-end", gap: 8 }, modalBtn: { minWidth: 88, height: 34, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }, modalBtnText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  leadRow: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, backgroundColor: "#fff", padding: 10, marginBottom: 6 }, leadRowA: { borderColor: "#38bdf8", backgroundColor: "#f0f9ff" }, leadName: { color: "#0f172a", fontSize: 14, fontWeight: "700" }, leadMeta: { marginTop: 3, color: "#64748b", fontSize: 11 },
  del: { marginTop: 8, alignSelf: "flex-end", minWidth: 120, height: 34, borderWidth: 1, borderColor: "#fca5a5", borderRadius: 9, backgroundColor: "#fff1f2", alignItems: "center", justifyContent: "center" }, delText: { color: "#dc2626", fontSize: 12, fontWeight: "700" },
  block: { marginTop: 10, borderWidth: 1, borderColor: "#dbe3ee", borderRadius: 10, backgroundColor: "#f8fafc", padding: 10 }, blockTitle: { color: "#0f172a", fontSize: 13, fontWeight: "800", marginBottom: 6 }, blockText: { color: "#334155", fontSize: 12, marginTop: 2 },
  contact: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, contactActionItem: { alignItems: "center", minWidth: 68, gap: 4 }, contactIconBtn: { width: 44, height: 44, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }, contactActionLabel: { color: "#334155", fontSize: 11, fontWeight: "700" }, contactBtn: { flexGrow: 1, minWidth: 110, height: 36, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }, contactText: { color: "#334155", fontSize: 12, fontWeight: "700" },
});
