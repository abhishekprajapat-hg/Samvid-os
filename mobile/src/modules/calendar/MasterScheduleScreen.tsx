import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Linking, Modal, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { Screen } from "../../components/common/Screen";
import { Icon } from "../../components/ui/Icon";
import { AppSegmentedTabs } from "../../components/ui/Tabs";
import {
  addLeadDiaryEntry, clearLeadFollowUp, getAllLeads, getLeadDiary,
  updateLeadStatus, type LeadDiaryEntry,
} from "../../services/leadService";
import { getTasks, type Task } from "../../services/taskService";
import { themedStyles, themeColor, themePalette } from "../../theme/themedStyles";
import { radii, spacing, typography } from "../../theme/tokens";
import type { Lead } from "../../types";
import { toErrorMessage } from "../../utils/errorMessage";

type CalendarMode = "month" | "week" | "day" | "agenda";
type EventKind = "FOLLOW_UP" | "SITE_VISIT" | "CALL" | "MEETING" | "TASK" | "OTHER";
type DateRange = "ALL" | "TODAY" | "WEEK" | "MONTH";
type CalendarEntry = {
  id: string; date: Date; kind: EventKind; title: string; subtitle: string;
  assignee: string; lead?: Lead; task?: Task;
};

const WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MODES = [
  { key: "month", label: "Month" }, { key: "week", label: "Week" },
  { key: "day", label: "Day" }, { key: "agenda", label: "Agenda" },
];
const EVENT_FILTERS: Array<{ key: EventKind; label: string; icon: string }> = [
  { key: "FOLLOW_UP", label: "Follow-up", icon: "calendar" },
  { key: "SITE_VISIT", label: "Site Visit", icon: "location-outline" },
  { key: "CALL", label: "Call", icon: "call-outline" },
  { key: "MEETING", label: "Meeting", icon: "people-outline" },
  { key: "TASK", label: "Task Deadline", icon: "todo" },
  { key: "OTHER", label: "Other", icon: "ellipsis-horizontal" },
];
const ALL_EVENT_KINDS = EVENT_FILTERS.map((item) => item.key);
const toDate = (value?: string | null) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfWeek = (date: Date) => { const result = startOfDay(date); result.setDate(result.getDate() - result.getDay()); return result; };
const endOfWeek = (date: Date) => { const result = startOfWeek(date); result.setDate(result.getDate() + 7); return result; };
const calendarGrid = (cursor: Date) => {
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  start.setDate(1 - start.getDay());
  return Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; });
};
const EVENT_MINUTES = 60;
const endOf = (date: Date) => new Date(date.getTime() + EVENT_MINUTES * 60000);
const formatTime = (date: Date) => date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
const formatDateTime = (value?: string | null) => {
  const date = toDate(value);
  return date ? date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
};
const formatScheduleInput = (date: Date) => `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()} ${formatTime(date)}`;
const toLocalDateTimeValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
const initials = (name?: string) => String(name || "NA").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const phoneDigits = (value?: string) => String(value || "").replace(/\D/g, "").slice(-10);
const eventKindForLead = (lead: Lead): EventKind => {
  const status = String(lead.status || "").toUpperCase();
  if (status.includes("SITE_VISIT")) return "SITE_VISIT";
  if (status.includes("CALL")) return "CALL";
  if (status.includes("MEETING")) return "MEETING";
  return "FOLLOW_UP";
};
const kindLabel = (kind: EventKind) => EVENT_FILTERS.find((item) => item.key === kind)?.label || "Event";
const kindIcon = (kind: EventKind) => EVENT_FILTERS.find((item) => item.key === kind)?.icon || "calendar";
const toneFor = (kind: EventKind) => {
  switch (kind) {
    case "SITE_VISIT": return { color: themePalette.amber[600], bg: themePalette.amber[50], border: themePalette.amber[200] };
    case "CALL": return { color: themePalette.violet[600], bg: themePalette.violet[50], border: themePalette.violet[200] };
    case "MEETING": return { color: themePalette.blue[600], bg: themePalette.blue[50], border: themePalette.blue[200] };
    case "TASK": return { color: themePalette.rose[600], bg: themePalette.rose[50], border: themePalette.rose[200] };
    case "OTHER": return { color: themePalette.slate[600], bg: themePalette.slate[100], border: themePalette.slate[200] };
    default: return { color: themePalette.emerald[600], bg: themePalette.emerald[50], border: themePalette.emerald[200] };
  }
};

const MetricCard = ({ icon, color, tint, label, value, helper }: { icon: string; color: string; tint: string; label: string; value: number; helper: string }) => (
  <View style={styles.metricCard}>
    <View style={[styles.metricIcon, { backgroundColor: tint }]}><Icon name={icon} size={20} color={color} /></View>
    <View style={styles.metricCopy}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricHelper} numberOfLines={2}>{helper}</Text></View>
  </View>
);
const IconButton = ({ icon, onPress, danger = false, label }: { icon: string; onPress: () => void; danger?: boolean; label: string }) => (
  <Pressable style={[styles.iconButton, danger && styles.iconButtonDanger]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
    <Icon name={icon} size={17} color={danger ? themePalette.rose[600] : themePalette.blue[600]} />
  </Pressable>
);
const Checkbox = ({ checked }: { checked: boolean }) => (
  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <Icon name="checkmark" size={14} color="#ffffff" strokeWidth={3} /> : null}</View>
);

export const MasterScheduleScreen = () => {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(Math.max(width - 32, 0), 760);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mode, setMode] = useState<CalendarMode>("month");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [detailsLead, setDetailsLead] = useState<Lead | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [leadPickerVisible, setLeadPickerVisible] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [scheduleAt, setScheduleAt] = useState(new Date());
  const [scheduleNote, setScheduleNote] = useState("");
  const [nativeMode, setNativeMode] = useState<"date" | "time" | null>(null);
  const [webCalendarPickerVisible, setWebCalendarPickerVisible] = useState(false);
  const [webCalendarValue, setWebCalendarValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [diary, setDiary] = useState<Record<string, LeadDiaryEntry[]>>({});
  const [diaryLoading, setDiaryLoading] = useState<Record<string, boolean>>({});
  const [diaryDraft, setDiaryDraft] = useState("");
  const [diarySaving, setDiarySaving] = useState(false);
  const [eventKinds, setEventKinds] = useState<EventKind[]>(ALL_EVENT_KINDS);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("ALL");
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [speechPermissionGranted, setSpeechPermissionGranted] = useState(Platform.OS === "web");
  const [isListening, setIsListening] = useState(false);
  const webCalendarInputRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);

  const load = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true); else setLoading(true);
      setError("");
      const [leadResult, taskResult] = await Promise.allSettled([getAllLeads(), getTasks()]);
      if (leadResult.status === "fulfilled") setLeads(Array.isArray(leadResult.value) ? leadResult.value : []);
      else throw leadResult.reason;
      if (taskResult.status === "fulfilled") setTasks(Array.isArray(taskResult.value) ? taskResult.value : []);
      else setTasks([]);
    } catch (caught) { setError(toErrorMessage(caught, "Failed to load calendar")); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!success) return; const timeout = setTimeout(() => setSuccess(""), 1800); return () => clearTimeout(timeout); }, [success]);
  useEffect(() => {
    if (!webCalendarPickerVisible || Platform.OS !== "web") return;
    const timeout = setTimeout(() => { const node = webCalendarInputRef.current as any; try { node?.showPicker?.(); } catch { node?.focus?.(); } }, 10);
    return () => clearTimeout(timeout);
  }, [webCalendarPickerVisible]);
  useEffect(() => {
    let active = true;
    const setupNative = async () => {
      try {
        const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
        if (!active) return;
        setIsSpeechSupported(available);
        if (!available) return setSpeechPermissionGranted(false);
        const permission = await ExpoSpeechRecognitionModule.getPermissionsAsync();
        if (active) setSpeechPermissionGranted(Boolean(permission?.granted));
      } catch { if (active) { setIsSpeechSupported(false); setSpeechPermissionGranted(false); } }
    };
    if (Platform.OS !== "web") { void setupNative(); return () => { active = false; try { ExpoSpeechRecognitionModule.abort(); } catch {} }; }
    const browser = globalThis as any;
    const SpeechRecognition = browser?.SpeechRecognition || browser?.webkitSpeechRecognition;
    if (!SpeechRecognition) { setIsSpeechSupported(false); return () => { active = false; }; }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN"; recognition.continuous = false; recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true); recognition.onend = () => setIsListening(false); recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => { const transcript = String(event?.results?.[0]?.[0]?.transcript || "").trim(); if (transcript) setScheduleNote((previous) => `${previous.trim()} ${transcript}`.trim()); };
    recognitionRef.current = recognition; setIsSpeechSupported(true); setSpeechPermissionGranted(true);
    return () => { active = false; try { recognition.stop(); } catch {} };
  }, []);
  useSpeechRecognitionEvent("start", () => { if (Platform.OS !== "web") setIsListening(true); });
  useSpeechRecognitionEvent("end", () => { if (Platform.OS !== "web") setIsListening(false); });
  useSpeechRecognitionEvent("error", () => { if (Platform.OS !== "web") { setIsListening(false); setError("Unable to start voice input."); } });
  useSpeechRecognitionEvent("result", (event) => {
    if (Platform.OS === "web") return;
    const transcript = String((event as any)?.results?.[0]?.transcript || "").trim();
    if (transcript && (event as any)?.isFinal) setScheduleNote((previous) => `${previous.trim()} ${transcript}`.trim());
  });

  const followUps = useMemo(() => leads.filter((lead) => Boolean(toDate(lead.nextFollowUp))), [leads]);
  const allEntries = useMemo<CalendarEntry[]>(() => {
    const leadEntries = followUps.flatMap((lead) => {
      const date = toDate(lead.nextFollowUp); if (!date) return [];
      const kind = eventKindForLead(lead);
      return [{ id: `lead-${lead._id}`, date, kind, title: lead.name || `Lead ${lead.phone || ""}`, subtitle: lead.projectInterested || `${kindLabel(kind)} follow-up`, assignee: lead.assignedTo?.name || "Unassigned", lead } satisfies CalendarEntry];
    });
    const taskEntries = tasks.flatMap((task) => {
      const date = toDate(task.dueDate); if (!date) return [];
      return [{ id: `task-${task._id}`, date, kind: "TASK" as const, title: task.title, subtitle: task.description || "Task deadline", assignee: task.assignedTo?.name || "Unassigned", task } satisfies CalendarEntry];
    });
    return [...leadEntries, ...taskEntries].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [followUps, tasks]);
  const teamMembers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role: string }>();
    leads.forEach((lead) => { const member = lead.assignedTo; if (member?._id && member.name) map.set(member._id, { id: member._id, name: member.name, role: String(member.role || "Team Member").replaceAll("_", " ") }); });
    tasks.forEach((task) => { const member = task.assignedTo; if (member?._id && member.name) map.set(member._id, { id: member._id, name: member.name, role: String(member.role || "Team Member").replaceAll("_", " ") }); });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [leads, tasks]);
  const filteredEntries = useMemo(() => {
    const now = new Date(); const location = locationFilter.trim().toLowerCase();
    return allEntries.filter((entry) => {
      if (!eventKinds.includes(entry.kind)) return false;
      const assignedId = entry.lead?.assignedTo?._id || entry.task?.assignedTo?._id || "";
      if (teamIds.length && !teamIds.includes(assignedId)) return false;
      if (location && ![entry.lead?.city, entry.lead?.projectInterested, entry.subtitle].join(" ").toLowerCase().includes(location)) return false;
      if (dateRange === "TODAY" && !sameDay(entry.date, now)) return false;
      if (dateRange === "WEEK" && (entry.date < startOfWeek(now) || entry.date >= endOfWeek(now))) return false;
      if (dateRange === "MONTH" && (entry.date.getMonth() !== now.getMonth() || entry.date.getFullYear() !== now.getFullYear())) return false;
      return true;
    });
  }, [allEntries, dateRange, eventKinds, locationFilter, teamIds]);
  const entriesByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    filteredEntries.forEach((entry) => map.set(dayKey(entry.date), [...(map.get(dayKey(entry.date)) || []), entry]));
    return map;
  }, [filteredEntries]);
  const selectedEntries = entriesByDay.get(dayKey(selectedDate)) || [];
  const selectedLeadEntries = selectedEntries.filter((entry) => entry.lead);
  const selectedTaskEntries = selectedEntries.filter((entry) => entry.task);
  const todayEntries = entriesByDay.get(dayKey(new Date())) || [];
  const completedTasks = tasks.filter((task) => String(task.status).toUpperCase() === "COMPLETED").length;
  const leadRows = useMemo(() => {
    const query = leadSearch.trim().toLowerCase();
    return [...leads].filter((lead) => !query || [lead.name, lead.phone, lead.city, lead.projectInterested].some((value) => String(value || "").toLowerCase().includes(query))).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [leadSearch, leads]);
  const selectedLead = leads.find((lead) => String(lead._id) === String(selectedLeadId)) || null;

  const loadDiary = useCallback(async (leadId: string, force = false) => {
    if (!leadId || (!force && diary[leadId])) return;
    try { setDiaryLoading((p) => ({ ...p, [leadId]: true })); const rows = await getLeadDiary(leadId); setDiary((p) => ({ ...p, [leadId]: Array.isArray(rows) ? rows : [] })); }
    catch (caught) { setError(toErrorMessage(caught, "Failed to load lead diary")); }
    finally { setDiaryLoading((p) => ({ ...p, [leadId]: false })); }
  }, [diary]);
  const openDetails = (lead: Lead) => { setDiaryDraft(""); setDetailsLead(lead); void loadDiary(lead._id, true); };
  const openSchedule = (lead?: Lead) => {
    const base = lead ? toDate(lead.nextFollowUp) || selectedDate : selectedDate; const next = new Date(base);
    if (!lead) next.setHours(11, 0, 0, 0);
    setSelectedLeadId(lead?._id || ""); setScheduleAt(next); setScheduleNote(""); setDetailsLead(null); setScheduleVisible(true);
  };
  const openDatePicker = () => { if (Platform.OS === "web") { setWebCalendarValue(toLocalDateTimeValue(scheduleAt)); setWebCalendarPickerVisible(true); } else setNativeMode("date"); };
  const onNativeDate = (event: DateTimePickerEvent, picked?: Date) => {
    if (event.type === "dismissed") return setNativeMode(null);
    const value = picked || scheduleAt;
    if (nativeMode === "date") { const next = new Date(scheduleAt); next.setFullYear(value.getFullYear(), value.getMonth(), value.getDate()); setScheduleAt(next); setNativeMode("time"); return; }
    const next = new Date(scheduleAt); next.setHours(value.getHours(), value.getMinutes(), 0, 0); setScheduleAt(next); setNativeMode(null);
  };
  const saveFollowUp = async () => {
    if (!selectedLead) return setError("Please select a lead or client.");
    try {
      setSaving(true); setError("");
      const updated = await updateLeadStatus(selectedLead._id, { status: selectedLead.status || "NEW", nextFollowUp: scheduleAt.toISOString() });
      setLeads((p) => p.map((lead) => lead._id === updated._id ? updated : lead));
      if (scheduleNote.trim()) { const entry = await addLeadDiaryEntry(selectedLead._id, { note: scheduleNote.trim() }); if (entry?._id) setDiary((p) => ({ ...p, [selectedLead._id]: [entry, ...(p[selectedLead._id] || [])] })); }
      setSelectedDate(new Date(scheduleAt)); setMonth(new Date(scheduleAt.getFullYear(), scheduleAt.getMonth(), 1)); setScheduleVisible(false); setSuccess("Follow-up scheduled successfully");
    } catch (caught) { setError(toErrorMessage(caught, "Failed to save follow-up")); }
    finally { setSaving(false); }
  };
  const deleteFollowUp = async (lead: Lead) => {
    try { setDeletingId(lead._id); const updated = await clearLeadFollowUp(lead._id, lead.status || "NEW"); if (!updated || updated.nextFollowUp) throw new Error("Follow-up was not cleared"); setLeads((p) => p.map((item) => item._id === updated._id ? updated : item)); setDetailsLead(null); setSuccess("Follow-up marked complete"); }
    catch (caught) { setError(toErrorMessage(caught, "Failed to complete follow-up")); }
    finally { setDeletingId(""); }
  };
  const saveDiary = async () => {
    if (!detailsLead || !diaryDraft.trim()) return;
    try { setDiarySaving(true); const entry = await addLeadDiaryEntry(detailsLead._id, { note: diaryDraft.trim() }); if (entry?._id) setDiary((p) => ({ ...p, [detailsLead._id]: [entry, ...(p[detailsLead._id] || [])] })); setDiaryDraft(""); setSuccess("Lead diary updated"); }
    catch (caught) { setError(toErrorMessage(caught, "Failed to update lead diary")); }
    finally { setDiarySaving(false); }
  };
  const toggleVoice = async () => {
    if (!isSpeechSupported) return setError("Voice input is not supported on this device.");
    try {
      if (Platform.OS === "web") { if (isListening) recognitionRef.current?.stop(); else recognitionRef.current?.start(); return; }
      if (isListening) return ExpoSpeechRecognitionModule.stop();
      if (!speechPermissionGranted) { const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync(); if (!permission?.granted) return setError("Microphone permission is required for voice input."); setSpeechPermissionGranted(true); }
      ExpoSpeechRecognitionModule.start({ lang: "en-IN", interimResults: true, maxAlternatives: 1, continuous: false });
    } catch { setIsListening(false); setError("Unable to start voice input."); }
  };
  const call = async (phone?: string) => { const number = phoneDigits(phone); if (!number) return setError("Phone number is unavailable."); const url = `tel:${number}`; if (await Linking.canOpenURL(url).catch(() => false)) void Linking.openURL(url); else setError("Dialer unavailable on this device."); };
  const openWhatsApp = async (phone?: string) => {
    const number = phoneDigits(phone); if (!number) return setError("WhatsApp number is unavailable.");
    const appUrl = `whatsapp://send?phone=91${number}`; const webUrl = `https://wa.me/91${number}`;
    if (Platform.OS === "web") return void Linking.openURL(webUrl).catch(() => setError("WhatsApp unavailable."));
    const supported = await Linking.canOpenURL(appUrl).catch(() => false);
    void Linking.openURL(supported ? appUrl : webUrl).catch(() => setError("WhatsApp unavailable."));
  };
  const openEmail = async (email?: string) => {
    const address = String(email || "").trim(); if (!address) return setError("Email address is unavailable.");
    const url = `mailto:${address}`; if (await Linking.canOpenURL(url).catch(() => false)) void Linking.openURL(url); else setError("Mail app unavailable on this device.");
  };
  const openMap = (lead: Lead) => { const query = encodeURIComponent([lead.projectInterested, lead.city].filter(Boolean).join(", ") || lead.name); void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch(() => setError("Map unavailable.")); };
  const moveCursor = (step: number) => {
    if (mode === "month") setMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + step, 1));
    else { const next = new Date(selectedDate); next.setDate(next.getDate() + (mode === "week" ? step * 7 : step)); setSelectedDate(next); setMonth(new Date(next.getFullYear(), next.getMonth(), 1)); }
  };

  const renderEntryRow = (entry: CalendarEntry, compact = false) => {
    const tone = toneFor(entry.kind);
    return (
      <Pressable key={entry.id} style={[styles.entryRow, compact && styles.entryRowCompact]} onPress={() => entry.lead && openDetails(entry.lead)} disabled={!entry.lead}>
        <View style={[styles.entryBar, { backgroundColor: tone.color }]} />
        <View style={styles.entryTime}><Text style={styles.entryTimeStrong}>{formatTime(entry.date).replace(" ", "\n")}</Text></View>
        <View style={[styles.entryBar, { backgroundColor: tone.color }]} />
        <View style={styles.entryCopy}><Text style={styles.entryTitle} numberOfLines={1}>{entry.title}</Text><Text style={styles.entrySubtitle} numberOfLines={1}>{entry.subtitle}</Text><View style={styles.entryMetaRow}><View style={[styles.kindChip, { backgroundColor: tone.bg }]}><Text style={[styles.kindChipText, { color: tone.color }]}>{kindLabel(entry.kind)}</Text></View><Icon name="person-outline" size={13} color={themePalette.slate[500]} /><Text style={styles.entryAssignee} numberOfLines={1}>{entry.assignee}</Text></View></View>
        {entry.lead ? <View style={styles.entryActions}><IconButton icon="call-outline" label={`Call ${entry.title}`} onPress={() => void call(entry.lead?.phone)} /><IconButton icon="location-outline" label={`Map ${entry.title}`} onPress={() => entry.lead && openMap(entry.lead)} /></View> : null}
      </Pressable>
    );
  };

  /*
   * The comp also prints an "Under:" line naming the assignee's manager.
   * Nothing in the data model carries a reporting line - User has no
   * manager/reportsTo field on either side - so that row is left out rather
   * than filled with a guess. See docs/mobile/00_MOBILE_PARITY_SPEC.md.
   */
  const renderFollowUpCard = (entry: CalendarEntry, highlight: boolean) => {
    const lead = entry.lead;
    if (!lead) return null;
    return (
      <Pressable key={entry.id} style={[styles.followCard, highlight && styles.followCardNext]} onPress={() => openDetails(lead)}>
        <View style={styles.followCardBody}>
          <Text style={styles.followCardName} numberOfLines={1}>{entry.title}</Text>
          <View style={styles.followCardRow}><Icon name="time-outline" size={13} color={themePalette.slate[500]} /><Text style={styles.followCardMeta}>{entry.date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, {formatTime(entry.date)}</Text></View>
          {lead.phone ? <View style={styles.followCardRow}><Icon name="call-outline" size={13} color={themePalette.slate[500]} /><Text style={styles.followCardMeta}>{lead.phone}</Text></View> : null}
          <View style={styles.followCardRow}><Icon name="person-outline" size={13} color={themePalette.slate[500]} /><Text style={styles.followCardMeta} numberOfLines={1}>Assigned: {entry.assignee}</Text></View>
          <View style={styles.followCardRow}><Icon name="person-outline" size={13} color={themePalette.slate[500]} /><Text style={styles.followCardMeta}>{String(lead.status || "NEW").replaceAll("_", " ")}</Text></View>
        </View>
        <View style={styles.followCardActions}>
          <IconButton icon="document-text-outline" label={`Notes for ${entry.title}`} onPress={() => openDetails(lead)} />
          <IconButton icon="trash-outline" danger label={`Clear follow-up for ${entry.title}`} onPress={() => void deleteFollowUp(lead)} />
        </View>
      </Pressable>
    );
  };

  /*
   * The comp shows a Tags card. Lead has no tags field on either side, so
   * rather than invent one these are the requirement facts the record already
   * holds - the same three the lead sheet prints.
   */
  const tagsFor = (lead: Lead): string[] => {
    const requirements = lead.requirements || {};
    const pretty = (value?: string | null) =>
      String(value || "").trim().replaceAll("_", " ").toLowerCase().replace(/^./, (ch) => ch.toUpperCase());
    return [pretty(requirements.inventoryType), pretty(requirements.propertySubtype), pretty(requirements.transactionType)]
      .filter(Boolean);
  };

  /* What the Time Range row reads under the buttons. */
  const rangeSummary = useMemo(() => {
    const now = new Date();
    const pretty = (date: Date) => date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    if (dateRange === "TODAY") return { title: now.toLocaleDateString("en-IN", { month: "long", year: "numeric" }), span: pretty(now) };
    if (dateRange === "WEEK") {
      const start = startOfWeek(now); const end = new Date(endOfWeek(now)); end.setDate(end.getDate() - 1);
      return { title: now.toLocaleDateString("en-IN", { month: "long", year: "numeric" }), span: `${pretty(start)} - ${pretty(end)}` };
    }
    if (dateRange === "MONTH") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { title: now.toLocaleDateString("en-IN", { month: "long", year: "numeric" }), span: `${pretty(start)} - ${pretty(end)}` };
    }
    return { title: "All dates", span: "Every scheduled follow-up and deadline" };
  }, [dateRange]);

  const monthView = <>
    <View style={styles.metrics}>
      <MetricCard icon="document-text-outline" color={themePalette.blue[600]} tint={themePalette.blue[50]} label="Total Follow-ups" value={followUps.length} helper={`${leads.length} leads loaded`} />
      <MetricCard icon="checkmark-circle-outline" color={themePalette.emerald[600]} tint={themePalette.emerald[50]} label="Today" value={todayEntries.length} helper={`${todayEntries.filter((entry) => entry.lead).length} follow-ups, ${todayEntries.filter((entry) => entry.task).length} tasks`} />
      <MetricCard icon="time-outline" color={themePalette.amber[600]} tint={themePalette.amber[50]} label="Task Deadlines" value={tasks.length} helper={`${completedTasks} completed`} />
    </View>
    <View style={styles.calendarCard}>
      <View style={styles.calendarHead}><Text style={styles.calendarTitle}>{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</Text><View style={styles.navButtons}><IconButton icon="chevron-back" label="Previous month" onPress={() => moveCursor(-1)} /><IconButton icon="chevron-forward" label="Next month" onPress={() => moveCursor(1)} /></View></View>
      <View style={styles.weekHead}>{WEEK.map((day) => <Text key={day} style={styles.weekLabel}>{day}</Text>)}</View>
      <View style={styles.monthGrid}>{calendarGrid(month).map((date) => {
        const entries = entriesByDay.get(dayKey(date)) || []; const leadCount = entries.filter((entry) => entry.lead).length; const taskCount = entries.filter((entry) => entry.task).length; const selected = sameDay(date, selectedDate); const isToday = sameDay(date, new Date()); const inMonth = date.getMonth() === month.getMonth();
        return <Pressable key={dayKey(date)} style={[styles.dayCell, !inMonth && styles.dayCellMuted, selected && styles.dayCellSelected]} onPress={() => setSelectedDate(date)}><View style={[styles.dayNumberCircle, isToday && !selected && styles.dayNumberCircleToday, selected && styles.dayNumberCircleSelected]}><Text style={[styles.dayNumber, !inMonth && styles.dayNumberMuted, isToday && !selected && styles.dayNumberToday, selected && styles.dayNumberSelected]}>{date.getDate()}</Text></View>{taskCount ? <Text style={styles.monthTaskBadge}>{taskCount} T</Text> : null}{leadCount ? <Text style={styles.monthLeadBadge}>{leadCount} L</Text> : null}</Pressable>;
      })}</View>
    </View>
    <View style={styles.daySummaryCard}>
      <Text style={styles.daySummaryTitle}>{selectedDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</Text>
      <Text style={styles.daySummaryMeta}>{selectedLeadEntries.length} follow-ups, {selectedTaskEntries.length} tasks</Text>
      {selectedLeadEntries.length ? <>
        <View style={styles.daySectionHead}><Text style={styles.daySectionTitle}>LEAD FOLLOW-UPS</Text><Text style={styles.daySectionCount}>{selectedLeadEntries.length}</Text></View>
        {selectedLeadEntries.map((entry, index) => renderFollowUpCard(entry, index === 0))}
      </> : null}
      {selectedTaskEntries.length ? <>
        <View style={styles.daySectionHead}><Text style={styles.daySectionTitle}>TASK DEADLINES</Text><Text style={styles.daySectionCount}>{selectedTaskEntries.length}</Text></View>
        {selectedTaskEntries.map((entry) => renderEntryRow(entry, true))}
      </> : null}
      {selectedEntries.length === 0 ? <Text style={styles.empty}>No calendar items on this date</Text> : null}
    </View>
  </>;
  const weekDates = Array.from({ length: 7 }, (_, index) => { const date = startOfWeek(selectedDate); date.setDate(date.getDate() + index); return date; });
  const weekView = <View style={styles.viewCard}>
    <View style={styles.dateNavigator}><IconButton icon="chevron-back" label="Previous week" onPress={() => moveCursor(-1)} /><View style={styles.dateNavigatorCopy}><Icon name="calendar" size={20} color={themePalette.blue[600]} /><Text style={styles.dateNavigatorTitle}>{weekDates[0].toLocaleDateString("en-IN", { day: "numeric", month: "short" })} - {weekDates[6].toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Text></View><IconButton icon="chevron-forward" label="Next week" onPress={() => moveCursor(1)} /></View>
    <View style={styles.weekStrip}>{weekDates.map((date) => { const active = sameDay(date, selectedDate); return <Pressable key={dayKey(date)} style={[styles.weekDay, active && styles.weekDayActive]} onPress={() => setSelectedDate(date)}><Text style={[styles.weekDayName, active && styles.weekDayTextActive]}>{WEEK[date.getDay()]}</Text><Text style={[styles.weekDayNumber, active && styles.weekDayTextActive]}>{date.getDate()}</Text><View style={[styles.weekDot, (entriesByDay.get(dayKey(date)) || []).length > 0 && styles.weekDotActive]} /></Pressable>; })}</View>
    <Text style={styles.sectionTitle}>{selectedDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</Text>{selectedEntries.length ? selectedEntries.map((entry) => renderEntryRow(entry)) : <Text style={styles.empty}>No events scheduled</Text>}
  </View>;
  const dayView = <View style={styles.viewCard}>
    <View style={styles.dateNavigator}><IconButton icon="chevron-back" label="Previous day" onPress={() => moveCursor(-1)} /><View style={styles.dateNavigatorCopy}><Icon name="calendar" size={20} color={themePalette.blue[600]} /><Text style={styles.dateNavigatorTitle}>{selectedDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</Text></View><IconButton icon="chevron-forward" label="Next day" onPress={() => moveCursor(1)} /></View>
    <View style={styles.timeline}>{Array.from({ length: 11 }, (_, index) => index + 8).map((hour) => <View key={hour} style={styles.timelineRow}><Text style={styles.timelineTime}>{new Date(2020, 0, 1, hour).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</Text><View style={styles.timelineSlot}>{selectedEntries.filter((entry) => entry.date.getHours() === hour).map((entry) => { const tone = toneFor(entry.kind); return <Pressable key={entry.id} style={[styles.timelineEvent, { borderColor: tone.border, backgroundColor: tone.bg }]} onPress={() => entry.lead && openDetails(entry.lead)} disabled={!entry.lead}><View style={[styles.timelineEventBar, { backgroundColor: tone.color }]} /><View style={[styles.timelineEventIcon, { backgroundColor: tone.border }]}><Icon name={kindIcon(entry.kind)} size={20} color={tone.color} /></View><View style={styles.timelineEventCopy}><Text style={styles.timelineEventTitle} numberOfLines={1}>{entry.title}</Text><Text style={styles.timelineEventMeta}>{formatTime(entry.date)} – {formatTime(endOf(entry.date))}</Text><View style={styles.timelineEventWho}><Icon name={entry.kind === "SITE_VISIT" ? "location-outline" : "person-outline"} size={12} color={themePalette.slate[500]} /><Text style={styles.timelineEventMeta} numberOfLines={1}>{entry.kind === "SITE_VISIT" ? entry.subtitle : entry.assignee}</Text></View></View><View style={[styles.kindChip, { backgroundColor: tone.border }]}><Text style={[styles.kindChipText, { color: tone.color }]}>{kindLabel(entry.kind)}</Text></View></Pressable>; })}</View></View>)}</View>
  </View>;
  const agendaGroups = useMemo(() => {
    const now = startOfDay(new Date()); const groups = new Map<string, CalendarEntry[]>();
    filteredEntries.filter((entry) => entry.date >= now).slice(0, 80).forEach((entry) => groups.set(dayKey(entry.date), [...(groups.get(dayKey(entry.date)) || []), entry]));
    return [...groups.entries()].slice(0, 12);
  }, [filteredEntries]);
  const agendaView = <View style={styles.agendaWrap}>{agendaGroups.length ? agendaGroups.map(([key, entries], index) => {
    const date = entries[0].date; const heading = sameDay(date, new Date()) ? "Today" : sameDay(date, new Date(Date.now() + 86400000)) ? "Tomorrow" : date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    return <View key={key} style={styles.agendaGroup}><View style={styles.agendaHead}><View><Text style={styles.agendaTitle}>{heading}</Text><Text style={styles.agendaDate}>{date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</Text></View><View style={styles.agendaCounts}><Text style={styles.agendaCountBlue}>{entries.filter((entry) => entry.lead).length} follow-ups</Text><Text style={styles.agendaCountGray}>{entries.filter((entry) => entry.task).length} tasks</Text></View></View>{entries.map((entry) => renderEntryRow(entry))}</View>;
  }) : <View style={styles.viewCard}><Text style={styles.empty}>No upcoming calendar items</Text></View>}</View>;

  return (
    <Screen title="Calendar" description={mode === "agenda" ? "Upcoming follow-ups, site visits and meetings" : mode === "month" ? "Meetings, reminders and execution timeline visibility" : "Meetings, reminders and execution timeline"} loading={loading} error={error} onRetry={() => void load()} right={<IconButton icon="funnel-outline" label="Calendar filters" onPress={() => setFiltersVisible(true)} />}>
      {success ? <Text style={styles.success}>{success}</Text> : null}
      <AppSegmentedTabs tabs={MODES} activeKey={mode} onChange={(key) => setMode(key as CalendarMode)} style={styles.modeTabs} />
      <ScrollView style={{ width: contentWidth, alignSelf: "center" }} contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />} showsVerticalScrollIndicator={false}>
        {mode === "month" ? monthView : mode === "week" ? weekView : mode === "day" ? dayView : agendaView}
      </ScrollView>
      <Pressable style={styles.fab} onPress={() => openSchedule()} accessibilityRole="button" accessibilityLabel="Schedule follow-up"><Icon name="add" size={29} color="#ffffff" strokeWidth={2} /></Pressable>

      {nativeMode ? <DateTimePicker value={scheduleAt} mode={nativeMode} is24Hour={false} onChange={onNativeDate} /> : null}
      <Modal visible={webCalendarPickerVisible} transparent animationType="fade" onRequestClose={() => setWebCalendarPickerVisible(false)}><View style={styles.modalBackdrop}><View style={styles.pickerCard}><Text style={styles.sheetTitle}>Select date and time</Text><input ref={webCalendarInputRef} type="datetime-local" value={webCalendarValue} onChange={(event: any) => { const value = String(event?.target?.value || ""); setWebCalendarValue(value); const next = new Date(value); if (!Number.isNaN(next.getTime())) setScheduleAt(next); setWebCalendarPickerVisible(false); }} onBlur={() => setWebCalendarPickerVisible(false)} style={styles.webDateInput as any} /></View></View></Modal>
      <Modal visible={leadPickerVisible} transparent animationType="fade" onRequestClose={() => setLeadPickerVisible(false)}><View style={styles.modalBackdrop}><View style={styles.pickerCard}><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Select Lead / Client</Text><IconButton icon="close" label="Close lead picker" onPress={() => setLeadPickerVisible(false)} /></View><View style={styles.searchField}><Icon name="search" size={17} color={themePalette.slate[500]} /><TextInput style={styles.searchInput} value={leadSearch} onChangeText={setLeadSearch} placeholder="Search by name, phone or city" placeholderTextColor={themeColor("#98a3b5")} /></View><ScrollView style={styles.pickerList}>{leadRows.map((lead) => <Pressable key={lead._id} style={[styles.leadPickerRow, selectedLeadId === lead._id && styles.leadPickerRowActive]} onPress={() => { setSelectedLeadId(lead._id); setLeadPickerVisible(false); }}><View style={styles.leadAvatar}><Text style={styles.leadAvatarText}>{initials(lead.name)}</Text></View><View style={styles.entryCopy}><Text style={styles.entryTitle}>{lead.name}</Text><Text style={styles.entrySubtitle}>{lead.phone || "No phone"} · {lead.city || "No city"}</Text></View>{selectedLeadId === lead._id ? <Icon name="checkmark" size={18} color={themePalette.blue[600]} /> : null}</Pressable>)}{leadRows.length === 0 ? <Text style={styles.empty}>No lead found</Text> : null}</ScrollView></View></View></Modal>

      <Modal visible={scheduleVisible} animationType="slide" onRequestClose={() => setScheduleVisible(false)}><View style={styles.fullSheet}>
        <View style={styles.fullSheetHeader}><IconButton icon="arrow-back" label="Close schedule" onPress={() => setScheduleVisible(false)} /><View style={styles.fullSheetHeaderCopy}><Text style={styles.fullSheetTitle}>Schedule Follow-up</Text><Text style={styles.fullSheetSubtitle}>Stay on track with your leads and clients</Text></View></View>
        <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
          <View><Text style={styles.fieldLabel}>Follow-up Type</Text><View style={styles.typeTabs}>{["Follow-up", "Site Visit", "Call", "Meeting"].map((label, index) => <View key={label} style={[styles.typeTab, index === 0 && styles.typeTabActive]}><Text style={[styles.typeTabText, index === 0 && styles.typeTabTextActive]}>{label}</Text></View>)}</View></View>
          <View><Text style={styles.fieldLabel}>Lead / Client <Text style={styles.required}>*</Text></Text><Pressable style={styles.formControl} onPress={() => setLeadPickerVisible(true)}><Text style={[styles.formControlText, !selectedLead && styles.placeholder]}>{selectedLead ? `${selectedLead.name} (${selectedLead.phone || "-"})` : "Select lead or client"}</Text><Icon name="chevron-down" size={18} color={themePalette.slate[500]} /></Pressable></View>
          <View><Text style={styles.fieldLabel}>Date & Time <Text style={styles.required}>*</Text></Text><Pressable style={styles.formControl} onPress={openDatePicker}><Text style={styles.formControlText}>{formatScheduleInput(scheduleAt)}</Text><Icon name="calendar-outline" size={19} color={themePalette.slate[700]} /></Pressable></View>
          <View><Text style={styles.fieldLabel}>Type / Purpose <Text style={styles.required}>*</Text></Text><View style={styles.formControl}><Text style={styles.formControlText}>Follow-up</Text><Icon name="chevron-down" size={18} color={themePalette.slate[500]} /></View></View>
          <View><Text style={styles.fieldLabel}>Notes</Text><View style={styles.notesControl}><TextInput style={styles.notesInput} value={scheduleNote} onChangeText={setScheduleNote} multiline maxLength={500} placeholder="Add notes, discussion points, or next steps..." placeholderTextColor={themeColor("#98a3b5")} /><View style={styles.notesFooter}><Pressable style={styles.voiceAction} onPress={() => void toggleVoice()} disabled={!isSpeechSupported}><Icon name={isListening ? "mic" : "mic-outline"} size={17} color={isListening ? themePalette.blue[600] : themePalette.slate[600]} /><Text style={styles.voiceActionText}>{isListening ? "Listening..." : "Voice note"}</Text></Pressable><Text style={styles.counter}>{scheduleNote.length}/500</Text></View></View></View>
          <View><Text style={styles.fieldLabel}>Assign to</Text><View style={styles.formControl}><Text style={styles.formControlText}>{selectedLead?.assignedTo?.name || "Current lead owner"}</Text><Icon name="person-outline" size={18} color={themePalette.slate[500]} /></View></View>
          <View><Text style={styles.fieldLabel}>Reminder</Text><View style={styles.formControl}><Text style={styles.formControlText}>15 minutes before</Text><Icon name="notifications" size={18} color={themePalette.slate[500]} /></View></View>
        </ScrollView>
        <View style={styles.sheetFooter}><Pressable style={styles.secondaryButton} onPress={() => setScheduleVisible(false)}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable><Pressable style={[styles.primaryButton, saving && styles.disabled]} onPress={() => void saveFollowUp()} disabled={saving}>{saving ? <ActivityIndicator color="#ffffff" /> : <><Icon name="add" size={20} color="#ffffff" /><Text style={styles.primaryButtonText}>Save Follow-up</Text></>}</Pressable></View>
      </View></Modal>

      <Modal visible={Boolean(detailsLead)} animationType="slide" onRequestClose={() => setDetailsLead(null)}><View style={styles.fullSheet}>
        <View style={styles.detailsHeader}><IconButton icon="arrow-back" label="Close details" onPress={() => setDetailsLead(null)} /><Text style={styles.detailsHeaderTitle}>Follow-up Details</Text><IconButton icon="ellipsis-horizontal" label="More options" onPress={() => {}} /></View>
        {detailsLead ? <ScrollView contentContainerStyle={styles.detailsPage} showsVerticalScrollIndicator={false}>
          <View style={styles.profileCard}><View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{initials(detailsLead.name)}</Text></View><View style={styles.entryCopy}><Text style={styles.profileName}>{detailsLead.name}</Text><Text style={styles.profileMeta}>Lead · {detailsLead.phone || "-"}</Text><Text style={styles.profileMeta}>{detailsLead.projectInterested || "Office space requirement"}</Text></View><View style={styles.detailTypeChip}><Text style={styles.detailTypeChipText}>{kindLabel(eventKindForLead(detailsLead))}</Text></View></View>
          <View style={styles.detailCard}><View style={[styles.detailIcon, { backgroundColor: themePalette.blue[50] }]}><Icon name="calendar" size={22} color={themePalette.blue[600]} /></View><View><Text style={styles.detailLabel}>Date & Time</Text><Text style={styles.detailValue}>{formatDateTime(detailsLead.nextFollowUp)}</Text></View></View>
          <View style={styles.detailCard}><View style={[styles.detailIcon, { backgroundColor: themePalette.emerald[50] }]}><Icon name="person-outline" size={22} color={themePalette.emerald[600]} /></View><View style={styles.entryCopy}><Text style={styles.detailLabel}>Assigned Executive</Text><Text style={styles.detailValue}>{detailsLead.assignedTo?.name || "Unassigned"}</Text><Text style={styles.detailSecondary}>Team Member</Text></View></View>
          <View style={styles.detailCard}><View style={[styles.detailIcon, { backgroundColor: themePalette.violet[50] }]}><Icon name="call-outline" size={22} color={themePalette.violet[600]} /></View><View style={styles.entryCopy}><Text style={styles.detailLabel}>Client / Lead Contact</Text><Text style={styles.detailValue}>{detailsLead.phone || "-"}</Text><Text style={styles.detailSecondary}>{detailsLead.name}</Text></View><View style={styles.contactActions}><IconButton icon="call-outline" label="Call lead" onPress={() => void call(detailsLead.phone)} /><IconButton icon="logo-whatsapp" label="WhatsApp lead" onPress={() => void openWhatsApp(detailsLead.phone)} /><IconButton icon="mail-outline" label="Email lead" onPress={() => void openEmail(detailsLead.email)} /></View></View>
          <View style={styles.detailCard}><View style={[styles.detailIcon, { backgroundColor: themePalette.rose[50] }]}><Icon name="location-outline" size={22} color={themePalette.rose[600]} /></View><View style={styles.entryCopy}><Text style={styles.detailLabel}>Location</Text><Text style={styles.detailValue}>{detailsLead.projectInterested || "Office on Rent"}</Text><Text style={styles.detailSecondary}>{detailsLead.city || "Location not added"}</Text></View><Pressable style={styles.mapButton} onPress={() => openMap(detailsLead)}><Icon name="map" size={16} color={themePalette.blue[600]} /><Text style={styles.mapButtonText}>View on Map</Text></Pressable></View>
          <View style={[styles.detailCard, styles.detailCardTop]}><View style={[styles.detailIcon, { backgroundColor: themePalette.blue[50] }]}><Icon name="document-text-outline" size={22} color={themePalette.blue[600]} /></View><View style={styles.entryCopy}><Text style={styles.detailLabel}>Description / Notes</Text>{diaryLoading[detailsLead._id] ? <ActivityIndicator style={{ alignSelf: "flex-start", marginTop: 8 }} color={themePalette.blue[600]} /> : (diary[detailsLead._id] || []).length ? (diary[detailsLead._id] || []).slice(0, 4).map((entry) => <View key={entry._id} style={styles.diaryEntry}><Text style={styles.diaryText}>{entry.note || "-"}</Text><Text style={styles.diaryMeta}>{formatDateTime(entry.createdAt)}{entry.createdBy?.name ? ` · ${entry.createdBy.name}` : ""}</Text></View>) : <Text style={styles.detailSecondary}>No notes added yet.</Text>}<TextInput style={styles.diaryInput} value={diaryDraft} onChangeText={setDiaryDraft} multiline placeholder="Add a diary note..." placeholderTextColor={themeColor("#98a3b5")} /><Pressable style={[styles.addNoteButton, (!diaryDraft.trim() || diarySaving) && styles.disabled]} onPress={() => void saveDiary()} disabled={!diaryDraft.trim() || diarySaving}>{diarySaving ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.addNoteButtonText}>Add Note</Text>}</Pressable></View></View>
          {tagsFor(detailsLead).length ? <View style={styles.detailCard}><View style={[styles.detailIcon, { backgroundColor: themePalette.amber[50] }]}><Icon name="tag" size={22} color={themePalette.amber[600]} /></View><View style={styles.entryCopy}><Text style={styles.detailLabel}>Tags</Text><View style={styles.tagRow}>{tagsFor(detailsLead).map((tag, index) => { const tone = [themePalette.blue, themePalette.emerald, themePalette.amber][index % 3]; return <View key={tag} style={[styles.tagChip, { backgroundColor: tone[50], borderColor: tone[200] }]}><Text style={[styles.tagChipText, { color: tone[700] }]}>{tag}</Text></View>; })}</View></View></View> : null}
          <View style={styles.detailCard}><View style={[styles.detailIcon, { backgroundColor: themePalette.violet[50] }]}><Icon name="notifications" size={22} color={themePalette.violet[600]} /></View><View><Text style={styles.detailLabel}>Reminder</Text><Text style={styles.detailValue}>15 minutes before</Text><Text style={styles.detailSecondary}>{formatDateTime(detailsLead.nextFollowUp)}</Text></View></View>
          <View style={styles.detailCard}><View style={[styles.detailIcon, { backgroundColor: themePalette.slate[100] }]}><Icon name="time-outline" size={22} color={themePalette.slate[600]} /></View><View style={styles.entryCopy}><Text style={styles.detailLabel}>Created On</Text><Text style={styles.detailValue}>{formatDateTime(detailsLead.createdAt)}</Text>{detailsLead.assignedTo?.name ? <Text style={styles.detailSecondary}>By {detailsLead.assignedTo.name}</Text> : null}</View></View>
        </ScrollView> : null}
        <View style={styles.sheetFooter}><Pressable style={styles.editButton} onPress={() => detailsLead && openSchedule(detailsLead)}><Icon name="create-outline" size={19} color={themePalette.blue[600]} /><Text style={styles.editButtonText}>Edit</Text></Pressable><Pressable style={[styles.primaryButton, deletingId !== "" && styles.disabled]} onPress={() => detailsLead && void deleteFollowUp(detailsLead)} disabled={deletingId !== ""}>{deletingId ? <ActivityIndicator color="#ffffff" /> : <><Icon name="checkmark-circle-outline" size={20} color="#ffffff" /><Text style={styles.primaryButtonText}>Mark Complete</Text></>}</Pressable></View>
      </View></Modal>

      <Modal visible={filtersVisible} animationType="slide" onRequestClose={() => setFiltersVisible(false)}><View style={styles.fullSheet}>
        <View style={styles.fullSheetHeader}><IconButton icon="arrow-back" label="Close filters" onPress={() => setFiltersVisible(false)} /><View style={styles.fullSheetHeaderCopy}><Text style={styles.fullSheetTitle}>Filters</Text><Text style={styles.fullSheetSubtitle}>Refine your calendar view</Text></View></View>
        <ScrollView contentContainerStyle={styles.filterPage} showsVerticalScrollIndicator={false}>
          <View style={styles.filterCard}><Text style={styles.filterTitle}>Event Type</Text><Text style={styles.filterSubtitle}>Select the types of events to show</Text><View style={styles.filterGrid}>{EVENT_FILTERS.map((item) => { const checked = eventKinds.includes(item.key); const tone = toneFor(item.key); return <Pressable key={item.key} style={styles.filterOption} onPress={() => setEventKinds((p) => checked ? p.filter((key) => key !== item.key) : [...p, item.key])}><Checkbox checked={checked} /><View style={[styles.filterOptionIcon, { backgroundColor: tone.bg }]}><Icon name={item.icon} size={19} color={tone.color} /></View><Text style={styles.filterOptionText}>{item.label}</Text></Pressable>; })}</View></View>
          <View style={styles.filterCard}><Text style={styles.filterTitle}>Assigned Team Member</Text><Text style={styles.filterSubtitle}>Show events assigned to</Text>{teamMembers.length ? teamMembers.map((member, index) => { const checked = teamIds.length === 0 || teamIds.includes(member.id); return <Pressable key={member.id} style={styles.memberRow} onPress={() => setTeamIds((p) => p.length === 0 ? teamMembers.filter((item) => item.id !== member.id).map((item) => item.id) : checked ? p.filter((id) => id !== member.id) : [...p, member.id])}><Checkbox checked={checked} /><View style={[styles.memberAvatar, { backgroundColor: [themePalette.blue[500], themePalette.violet[500], themePalette.emerald[500], themePalette.rose[400], themePalette.amber[400]][index % 5] }]}><Text style={styles.memberAvatarText}>{initials(member.name)}</Text></View><View><Text style={styles.memberName}>{member.name}</Text><Text style={styles.memberRole}>{member.role}</Text></View></Pressable>; }) : <Text style={styles.emptyLeft}>No assigned team members in loaded calendar data.</Text>}</View>
          <View style={styles.filterCard}><Text style={styles.filterTitle}>Location</Text><Text style={styles.filterSubtitle}>Filter events by location (optional)</Text><View style={styles.searchField}><Icon name="location-outline" size={18} color={themePalette.slate[500]} /><TextInput style={styles.searchInput} value={locationFilter} onChangeText={setLocationFilter} placeholder="Enter location or area..." placeholderTextColor={themeColor("#98a3b5")} /></View></View>
          <View style={styles.filterCard}><Text style={styles.filterTitle}>Time Range</Text><Text style={styles.filterSubtitle}>Select the date range</Text><View style={styles.rangeRow}>{([{ key: "TODAY", label: "Today" }, { key: "WEEK", label: "This Week" }, { key: "MONTH", label: "This Month" }, { key: "ALL", label: "Custom" }] as const).map((item) => <Pressable key={item.key} style={[styles.rangeButton, dateRange === item.key && styles.rangeButtonActive]} onPress={() => setDateRange(item.key)}><Text style={[styles.rangeButtonText, dateRange === item.key && styles.rangeButtonTextActive]}>{item.label}</Text></Pressable>)}</View></View>
          <View style={styles.rangeSummary}>
            <Icon name="calendarDays" size={17} color={themePalette.slate[600]} />
            <View style={styles.entryCopy}>
              <Text style={styles.rangeSummaryTitle}>{rangeSummary.title}</Text>
              <Text style={styles.rangeSummaryMeta}>{rangeSummary.span}</Text>
            </View>
            <Icon name="chevron-down" size={17} color={themePalette.slate[500]} />
          </View>
        </ScrollView>
        <View style={styles.filterFooter}><Pressable style={styles.applyButton} onPress={() => setFiltersVisible(false)}><Icon name="funnel-outline" size={19} color="#ffffff" /><Text style={styles.primaryButtonText}>Apply Filters</Text></Pressable></View>
      </View></Modal>
    </Screen>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  page: { gap: spacing.lg, paddingTop: spacing.lg, paddingBottom: 110 }, success: { marginBottom: spacing.md, borderWidth: 1, borderColor: c.emerald[200], borderRadius: radii.md, backgroundColor: c.emerald[50], color: c.emerald[700], padding: spacing.md, fontSize: typography.label, fontWeight: "700" }, modeTabs: { width: "100%" },
  metrics: { flexDirection: "row", gap: spacing.md }, metricCard: { flex: 1, minHeight: 106, borderWidth: 1, borderColor: c.border, borderRadius: radii.lg, backgroundColor: c.surface, padding: spacing.md, flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, shadowColor: c.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 1 }, metricIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }, metricCopy: { flex: 1, minWidth: 0 }, metricLabel: { color: c.slate[600], fontSize: 10, lineHeight: 13, fontWeight: "700" }, metricValue: { color: c.text, fontSize: 22, lineHeight: 26, fontWeight: "800" }, metricHelper: { marginTop: 2, color: c.textMuted, fontSize: 9.5, lineHeight: 13 },
  calendarCard: { borderWidth: 1, borderColor: c.border, borderRadius: radii.lg, backgroundColor: c.surface, overflow: "hidden" }, calendarHead: { minHeight: 54, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: c.border }, calendarTitle: { color: c.text, fontSize: typography.title, fontWeight: "800" }, navButtons: { flexDirection: "row", gap: spacing.sm }, iconButton: { width: 36, height: 36, borderWidth: 1, borderColor: c.border, borderRadius: radii.md, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" }, iconButtonDanger: { borderColor: c.rose[200], backgroundColor: c.rose[50] }, weekHead: { flexDirection: "row", backgroundColor: c.slate[50], borderBottomWidth: 1, borderBottomColor: c.border }, weekLabel: { width: "14.2857%", paddingVertical: spacing.md, textAlign: "center", color: c.slate[600], fontSize: 10, fontWeight: "700" }, monthGrid: { flexDirection: "row", flexWrap: "wrap" }, dayCell: { width: "14.2857%", minHeight: 62, paddingVertical: 5, alignItems: "center", borderRightWidth: 1, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.surface }, dayCellMuted: { backgroundColor: c.slate[50] }, dayCellSelected: { backgroundColor: c.blue[50] }, dayNumberCircle: { width: 27, height: 27, borderRadius: 14, alignItems: "center", justifyContent: "center" }, dayNumberCircleToday: { borderWidth: 1.5, borderColor: c.blue[500] }, dayNumberToday: { color: c.blue[600], fontWeight: "800" }, dayNumberCircleSelected: { backgroundColor: c.blue[600] }, dayNumber: { color: c.text, fontSize: typography.label, fontWeight: "700" }, dayNumberMuted: { color: c.textTertiary }, dayNumberSelected: { color: "#ffffff" }, monthLeadBadge: { marginTop: 2, borderRadius: 5, backgroundColor: c.amber[50], color: c.amber[700], paddingHorizontal: 5, paddingVertical: 1, fontSize: 9, fontWeight: "800", overflow: "hidden" }, monthTaskBadge: { marginTop: 2, borderRadius: 5, backgroundColor: c.emerald[50], color: c.emerald[700], paddingHorizontal: 5, paddingVertical: 1, fontSize: 9, fontWeight: "800", overflow: "hidden" },
  daySectionHead: { marginTop: spacing.lg, marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  daySectionTitle: { color: c.textMuted, fontSize: typography.caption, fontWeight: "800", letterSpacing: 0.6 },
  daySectionCount: { color: c.textMuted, fontSize: typography.label, fontWeight: "700" },
  followCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, borderWidth: 1, borderColor: c.border, borderRadius: radii.md, backgroundColor: c.surface, padding: spacing.lg, marginTop: spacing.sm },
  followCardNext: { borderColor: c.blue[300], backgroundColor: c.blue[50] },
  followCardBody: { flex: 1, minWidth: 0, gap: 3 },
  followCardName: { color: c.text, fontSize: typography.section, fontWeight: "800" },
  followCardRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  followCardMeta: { color: c.slate[600], fontSize: typography.label, flexShrink: 1 },
  followCardActions: { flexDirection: "row", gap: spacing.sm },
  daySummaryCard: { borderWidth: 1, borderColor: c.border, borderRadius: radii.lg, backgroundColor: c.surface, padding: spacing.lg }, daySummaryTitle: { color: c.text, fontSize: typography.title, fontWeight: "800" }, daySummaryMeta: { marginTop: 2, marginBottom: spacing.sm, color: c.textMuted, fontSize: typography.label }, viewCard: { borderWidth: 1, borderColor: c.border, borderRadius: radii.lg, backgroundColor: c.surface, padding: spacing.lg }, dateNavigator: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.lg }, dateNavigatorCopy: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md }, dateNavigatorTitle: { color: c.text, fontSize: typography.title, fontWeight: "800" },
  weekStrip: { flexDirection: "row", gap: 3, marginBottom: spacing.xl }, weekDay: { flex: 1, minHeight: 64, borderWidth: 1, borderColor: c.border, borderRadius: radii.md, alignItems: "center", justifyContent: "center", backgroundColor: c.surface }, weekDayActive: { borderColor: c.blue[500], backgroundColor: c.blue[600] }, weekDayName: { color: c.textMuted, fontSize: 9, fontWeight: "700" }, weekDayNumber: { marginTop: 2, color: c.text, fontSize: typography.section, fontWeight: "800" }, weekDayTextActive: { color: "#ffffff" }, weekDot: { marginTop: 4, width: 4, height: 4, borderRadius: 2 }, weekDotActive: { backgroundColor: c.emerald[400] }, sectionTitle: { color: c.text, fontSize: typography.title, fontWeight: "800", marginBottom: spacing.sm },
  entryRow: { minHeight: 92, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: c.border, paddingVertical: spacing.md }, entryRowCompact: { borderWidth: 1, borderColor: c.border, borderRadius: radii.md, paddingHorizontal: spacing.sm, marginTop: spacing.sm }, entryBar: { width: 4, alignSelf: "stretch", minHeight: 58, borderRadius: 4 }, entryTime: { width: 50 }, entryTimeStrong: { color: c.text, fontSize: typography.label, lineHeight: 17, fontWeight: "800" }, entryCopy: { flex: 1, minWidth: 0 }, entryTitle: { color: c.text, fontSize: typography.section, fontWeight: "800" }, entrySubtitle: { marginTop: 2, color: c.textMuted, fontSize: typography.label }, entryMetaRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: spacing.sm }, entryAssignee: { flex: 1, color: c.textMuted, fontSize: typography.caption }, entryActions: { flexDirection: "row", gap: spacing.sm }, kindChip: { alignSelf: "flex-start", paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radii.sm }, kindChipText: { fontSize: typography.caption, fontWeight: "700" },
  timelineEventWho: { flexDirection: "row", alignItems: "center", gap: 4 },
  timeline: { borderLeftWidth: 1, borderLeftColor: c.border, marginLeft: 64 }, timelineRow: { minHeight: 88, borderBottomWidth: 1, borderBottomColor: c.border, position: "relative" }, timelineTime: { position: "absolute", left: -66, top: -8, width: 55, color: c.textMuted, fontSize: typography.label, textAlign: "right" }, timelineSlot: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm }, timelineEvent: { minHeight: 76, borderWidth: 1, borderRadius: radii.md, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, overflow: "hidden" }, timelineEventBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5 }, timelineEventIcon: { width: 44, height: 44, borderRadius: radii.md, alignItems: "center", justifyContent: "center" }, timelineEventCopy: { flex: 1, minWidth: 0 }, timelineEventTitle: { color: c.text, fontSize: typography.section, fontWeight: "800" }, timelineEventMeta: { marginTop: 2, color: c.textMuted, fontSize: typography.label },
  agendaWrap: { gap: spacing.lg }, agendaGroup: { borderWidth: 1, borderColor: c.border, borderRadius: radii.lg, backgroundColor: c.surface, paddingHorizontal: spacing.lg, overflow: "hidden" }, agendaHead: { paddingVertical: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: c.border }, agendaTitle: { color: c.text, fontSize: typography.title, fontWeight: "800" }, agendaDate: { marginTop: 2, color: c.textMuted, fontSize: typography.label }, agendaCounts: { flexDirection: "row", gap: spacing.sm }, agendaCountBlue: { backgroundColor: c.blue[50], color: c.blue[600], paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radii.md, overflow: "hidden", fontSize: typography.caption, fontWeight: "700" }, agendaCountGray: { backgroundColor: c.slate[100], color: c.slate[600], paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radii.md, overflow: "hidden", fontSize: typography.caption, fontWeight: "700" }, empty: { paddingVertical: spacing.xxl, color: c.textMuted, fontSize: typography.label, textAlign: "center" }, emptyLeft: { paddingTop: spacing.lg, color: c.textMuted, fontSize: typography.label }, fab: { position: "absolute", right: spacing.xl, bottom: 28, width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: c.blue[600], shadowColor: c.blue[800], shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 7 },
  modalBackdrop: { flex: 1, backgroundColor: c.overlay, padding: spacing.xl, justifyContent: "center" }, pickerCard: { maxHeight: "82%", borderWidth: 1, borderColor: c.border, borderRadius: radii.lg, backgroundColor: c.surface, padding: spacing.lg }, sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }, sheetTitle: { color: c.text, fontSize: typography.title, fontWeight: "800" }, pickerList: { maxHeight: 420, marginTop: spacing.md }, leadPickerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: c.border }, leadPickerRowActive: { backgroundColor: c.blue[50] }, leadAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.blue[100], alignItems: "center", justifyContent: "center" }, leadAvatarText: { color: c.blue[700], fontSize: typography.section, fontWeight: "800" }, webDateInput: { marginTop: spacing.lg, width: "100%", minHeight: 44, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radii.md, paddingHorizontal: spacing.md, color: c.text, backgroundColor: c.surface }, searchField: { minHeight: 48, marginTop: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radii.md, backgroundColor: c.surface }, searchInput: { flex: 1, color: c.text, fontSize: typography.body, paddingVertical: spacing.md },
  fullSheet: { flex: 1, backgroundColor: c.bg }, fullSheetHeader: { paddingTop: Platform.OS === "ios" ? 58 : 24, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.xl, backgroundColor: c.bg }, fullSheetHeaderCopy: { flex: 1 }, fullSheetTitle: { color: c.text, fontSize: 24, fontWeight: "800", letterSpacing: -0.4 }, fullSheetSubtitle: { marginTop: 2, color: c.textMuted, fontSize: typography.section }, form: { gap: spacing.xxl, padding: spacing.xl, paddingBottom: 120 }, fieldLabel: { marginBottom: spacing.md, color: c.text, fontSize: typography.title, fontWeight: "800" }, required: { color: c.rose[500] }, typeTabs: { flexDirection: "row", gap: spacing.sm }, typeTab: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radii.md, alignItems: "center", justifyContent: "center", backgroundColor: c.surface }, typeTabActive: { borderColor: c.blue[500], backgroundColor: c.blue[50] }, typeTabText: { color: c.slate[600], fontSize: typography.label, fontWeight: "700" }, typeTabTextActive: { color: c.blue[600] }, formControl: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radii.md, backgroundColor: c.surface }, formControlText: { flex: 1, color: c.text, fontSize: typography.section, fontWeight: "600" }, placeholder: { color: c.textTertiary, fontWeight: "400" }, notesControl: { minHeight: 138, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radii.md, backgroundColor: c.surface, padding: spacing.lg }, notesInput: { minHeight: 78, color: c.text, fontSize: typography.body, textAlignVertical: "top" }, notesFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, voiceAction: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, voiceActionText: { color: c.slate[600], fontSize: typography.caption, fontWeight: "600" }, counter: { color: c.textMuted, fontSize: typography.caption },
  sheetFooter: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: Platform.OS === "ios" ? 28 : spacing.xl, flexDirection: "row", gap: spacing.md, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface }, secondaryButton: { flex: 1, minHeight: 52, borderRadius: radii.md, backgroundColor: c.slate[100], alignItems: "center", justifyContent: "center" }, secondaryButtonText: { color: c.text, fontSize: typography.section, fontWeight: "800" }, primaryButton: { flex: 1.35, minHeight: 52, borderRadius: radii.md, backgroundColor: c.blue[600], flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md }, primaryButtonText: { color: "#ffffff", fontSize: typography.section, fontWeight: "800" }, disabled: { opacity: 0.55 },
  detailsHeader: { paddingTop: Platform.OS === "ios" ? 58 : 24, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.bg }, detailsHeaderTitle: { color: c.text, fontSize: 21, fontWeight: "800" }, detailsPage: { gap: spacing.md, paddingHorizontal: spacing.xl, paddingBottom: 120 }, profileCard: { minHeight: 112, padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.lg, borderWidth: 1, borderColor: c.border, borderRadius: radii.lg, backgroundColor: c.surface }, profileAvatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: c.blue[100], alignItems: "center", justifyContent: "center" }, profileAvatarText: { color: c.blue[700], fontSize: 22, fontWeight: "800" }, profileName: { color: c.text, fontSize: 20, fontWeight: "800" }, profileMeta: { marginTop: 2, color: c.textMuted, fontSize: typography.label }, detailTypeChip: { alignSelf: "flex-start", backgroundColor: c.blue[50], borderWidth: 1, borderColor: c.blue[200], borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, detailTypeChipText: { color: c.blue[600], fontSize: typography.label, fontWeight: "700" }, detailCard: { minHeight: 92, padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.lg, borderWidth: 1, borderColor: c.border, borderRadius: radii.lg, backgroundColor: c.surface }, detailCardTop: { alignItems: "flex-start" }, detailIcon: { width: 46, height: 46, borderRadius: radii.md, alignItems: "center", justifyContent: "center" }, detailLabel: { color: c.textMuted, fontSize: typography.label }, detailValue: { marginTop: 3, color: c.text, fontSize: typography.section, fontWeight: "800" }, detailSecondary: { marginTop: 3, color: c.textMuted, fontSize: typography.label }, contactActions: { flexDirection: "row", gap: spacing.xs }, mapButton: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: c.blue[50] }, mapButtonText: { color: c.blue[600], fontSize: typography.caption, fontWeight: "700" }, diaryEntry: { marginTop: spacing.md, paddingLeft: spacing.md, borderLeftWidth: 2, borderLeftColor: c.blue[200] }, diaryText: { color: c.slate[700], fontSize: typography.body, lineHeight: 19 }, diaryMeta: { marginTop: 3, color: c.textMuted, fontSize: 10 }, diaryInput: { minHeight: 70, marginTop: spacing.lg, padding: spacing.md, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radii.md, color: c.text, textAlignVertical: "top" }, addNoteButton: { minWidth: 90, minHeight: 34, marginTop: spacing.md, alignSelf: "flex-end", borderRadius: radii.md, backgroundColor: c.blue[600], alignItems: "center", justifyContent: "center" }, addNoteButtonText: { color: "#ffffff", fontSize: typography.label, fontWeight: "700" }, editButton: { flex: 1, minHeight: 52, borderWidth: 1, borderColor: c.blue[500], borderRadius: radii.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md, backgroundColor: c.surface }, editButtonText: { color: c.blue[600], fontSize: typography.section, fontWeight: "800" },
  tagRow: { marginTop: spacing.sm, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, tagChip: { paddingHorizontal: spacing.lg, paddingVertical: 6, borderRadius: radii.md, borderWidth: 1 }, tagChipText: { fontSize: typography.label, fontWeight: "700" },
  rangeSummary: { marginTop: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: c.border, borderRadius: radii.md, backgroundColor: c.surfaceMuted, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }, rangeSummaryTitle: { color: c.text, fontSize: typography.label, fontWeight: "700" }, rangeSummaryMeta: { marginTop: 1, color: c.textMuted, fontSize: typography.caption },
  filterPage: { gap: spacing.lg, padding: spacing.xl, paddingBottom: 120 }, filterCard: { padding: spacing.lg, borderWidth: 1, borderColor: c.border, borderRadius: radii.lg, backgroundColor: c.surface }, filterTitle: { color: c.text, fontSize: typography.title, fontWeight: "800" }, filterSubtitle: { marginTop: 3, marginBottom: spacing.lg, color: c.textMuted, fontSize: typography.label }, filterGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md }, filterOption: { width: "48%", minHeight: 62, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: c.border, borderRadius: radii.md, backgroundColor: c.surface }, checkbox: { width: 24, height: 24, borderWidth: 1.5, borderColor: c.slate[400], borderRadius: 5, alignItems: "center", justifyContent: "center", backgroundColor: c.surface }, checkboxChecked: { borderColor: c.blue[600], backgroundColor: c.blue[600] }, filterOptionIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }, filterOptionText: { flex: 1, color: c.text, fontSize: typography.label, fontWeight: "700" }, memberRow: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: spacing.lg }, memberAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" }, memberAvatarText: { color: "#ffffff", fontSize: typography.section, fontWeight: "700" }, memberName: { color: c.text, fontSize: typography.section, fontWeight: "700" }, memberRole: { marginTop: 2, color: c.textMuted, fontSize: typography.label }, rangeRow: { flexDirection: "row", gap: spacing.sm }, rangeButton: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: c.border, borderRadius: radii.md, alignItems: "center", justifyContent: "center", backgroundColor: c.surface }, rangeButtonActive: { borderColor: c.blue[500], backgroundColor: c.blue[50] }, rangeButtonText: { color: c.slate[600], fontSize: typography.caption, fontWeight: "700" }, rangeButtonTextActive: { color: c.blue[600] }, filterFooter: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: Platform.OS === "ios" ? 28 : spacing.xl, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface }, applyButton: { minHeight: 52, borderRadius: radii.md, backgroundColor: c.blue[600], flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md },
}));

export default MasterScheduleScreen;
