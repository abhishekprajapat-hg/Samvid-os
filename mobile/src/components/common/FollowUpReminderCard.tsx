import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Glyph } from "../ui/Glyph";
import { useAuth } from "../../context/AuthContext";
import { getAllLeads } from "../../services/leadService";
import { cancelScheduledReminder, scheduleCancellableReminder } from "../../services/pushNotifications";
import { navigateFromAnywhere } from "../../navigation/navigationRef";
import { brand, brandStyles, round, type as t } from "../../theme/brand";
import {
  MAX_SEEN_KEYS,
  POLL_INTERVAL_MS,
  REMINDER_LOOKAHEAD_MS,
  REMINDER_LOOKBACK_MS,
  REMINDER_STORAGE_KEY,
  getTimeLeftText,
  pickActiveReminder,
  upcomingNotificationKeys,
  type ReminderLead,
} from "../../modules/leads/followUpReminders";

/*
 * Follow-up reminders - web's FollowUpReminderToast, on a phone.
 *
 * Same query (the caller's leads with a follow-up between a day ago and an hour
 * ahead, polled every minute), same buckets, same dismissal memory under the
 * same storage key. It floats above the tab bar, where web's sits in the
 * bottom-left corner.
 *
 * A phone adds one thing: the app is usually closed when a follow-up falls due,
 * and a toast inside a closed app reminds nobody. So each follow-up in the
 * coming hour is also scheduled as a notification at its own time, and taken
 * back again when the follow-up is moved or the lead leaves the active
 * statuses - that is what the key per lead-and-time is for.
 */

const SCHEDULED_STORAGE_KEY = "followUpReminderScheduled:v1";

const formatFollowUpTime = (value?: string | null) => {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

const readJson = async <T,>(key: string, fallback: T): Promise<T> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const FollowUpReminderCard = () => {
  const { isLoggedIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [leads, setLeads] = useState<ReminderLead[]>([]);
  const [nowMs, setNowMs] = useState(Date.now());
  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);
  const loadingRef = useRef(false);

  useEffect(() => {
    readJson<string[]>(REMINDER_STORAGE_KEY, []).then((keys) =>
      setDismissedKeys(Array.isArray(keys) ? keys.slice(-MAX_SEEN_KEYS) : []),
    );
  }, []);

  /* Keeps one scheduled notification per upcoming follow-up, and no stale ones. */
  const syncScheduled = useCallback(async (rows: ReminderLead[]) => {
    const scheduled = await readJson<Record<string, { id: string; at: number }>>(SCHEDULED_STORAGE_KEY, {});
    const now = Date.now();
    const wanted = upcomingNotificationKeys(rows, now);
    const wantedKeys = new Set(wanted.map((item) => item.key));

    for (const [key, entry] of Object.entries(scheduled)) {
      if (entry.at <= now) {
        delete scheduled[key];
      } else if (!wantedKeys.has(key)) {
        await cancelScheduledReminder(entry.id);
        delete scheduled[key];
      }
    }

    for (const item of wanted) {
      if (scheduled[item.key]) continue;
      const id = await scheduleCancellableReminder(item.at, {
        title: "Follow-up due",
        body: `${item.lead.name || "Lead follow-up"} · ${item.lead.projectInterested || item.lead.city || item.lead.phone || "Follow up scheduled"}`,
        data: { url: `/leads/${item.lead._id}` },
      });
      if (id) scheduled[item.key] = { id, at: item.at.getTime() };
    }

    AsyncStorage.setItem(SCHEDULED_STORAGE_KEY, JSON.stringify(scheduled)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!isLoggedIn || loadingRef.current) return;
    loadingRef.current = true;
    const now = new Date();
    try {
      const rows = await getAllLeads({
        page: 1,
        limit: 200,
        fields: "_id,name,phone,city,projectInterested,status,nextFollowUp,assignedTo",
        followUpFrom: new Date(now.getTime() - REMINDER_LOOKBACK_MS).toISOString(),
        followUpTo: new Date(now.getTime() + REMINDER_LOOKAHEAD_MS).toISOString(),
      });
      const list = Array.isArray(rows) ? (rows as ReminderLead[]) : [];
      setLeads(list);
      void syncScheduled(list);
    } catch {
      setLeads([]);
    } finally {
      loadingRef.current = false;
    }
  }, [isLoggedIn, syncScheduled]);

  useEffect(() => {
    if (!isLoggedIn) {
      setLeads([]);
      return undefined;
    }
    void load();
    const poll = setInterval(() => {
      if (AppState.currentState === "active") void load();
    }, POLL_INTERVAL_MS);
    const tick = setInterval(() => setNowMs(Date.now()), 30000);
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        setNowMs(Date.now());
        void load();
      }
    });
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      sub.remove();
    };
  }, [isLoggedIn, load]);

  const active = useMemo(() => pickActiveReminder(leads, nowMs, dismissedKeys), [dismissedKeys, leads, nowMs]);

  const remember = useCallback((key?: string) => {
    if (!key) return;
    setDismissedKeys((prev) => {
      const next = [...new Set([...prev, key])].slice(-MAX_SEEN_KEYS);
      AsyncStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  if (!isLoggedIn || !active) return null;

  const overdue = active._reminderDiffMs < -60 * 1000;
  const ink = overdue ? brand.alertInk : brand.warnInk;
  const tint = overdue ? brand.alertTint : brand.warnTint;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 72 }]}>
      <View style={styles.card} accessibilityRole="alert">
        <View style={[styles.icon, { backgroundColor: tint }]}>
          <Glyph name="alarm" size={18} color={ink} />
        </View>
        <View style={styles.body}>
          <Text style={[styles.eyebrow, { color: ink }]}>FOLLOW-UP REMINDER</Text>
          <Text style={styles.title} numberOfLines={1}>
            {active.name || "Lead follow-up"} | {getTimeLeftText(active._reminderDiffMs)}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {active.projectInterested || active.city || active.phone || "Follow up scheduled"}
          </Text>
          <Text style={styles.when}>Scheduled: {formatFollowUpTime(active.nextFollowUp)}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            style={styles.action}
            onPress={() => {
              remember(active._reminderKey);
              navigateFromAnywhere("LeadDetails", { leadId: active._id });
            }}
            accessibilityRole="button"
            accessibilityLabel="Open follow-up lead"
            hitSlop={6}
          >
            <Glyph name="open-outline" size={15} color={brand.textSecondary} />
          </Pressable>
          <Pressable
            style={styles.action}
            onPress={() => remember(active._reminderKey)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss follow-up reminder"
            hitSlop={6}
          >
            <Glyph name="close" size={15} color={brand.textSecondary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    wrap: { position: "absolute", left: 10, right: 10, zIndex: 2900 },
    card: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: b.warnChip,
      borderRadius: round.panel + 4,
      backgroundColor: b.surface,
      shadowColor: "#000",
      shadowOpacity: 0.16,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    icon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    body: { flex: 1, minWidth: 0 },
    eyebrow: { fontSize: 9.5, fontWeight: "800", letterSpacing: 1.2 },
    title: { marginTop: 2, fontSize: t.cardTitle, fontWeight: "700", color: b.text },
    meta: { marginTop: 1, fontSize: t.label, color: b.textSecondary },
    when: { marginTop: 3, fontSize: 10.5, color: b.textMuted },
    actions: { flexDirection: "row", gap: 5 },
    action: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: b.border,
    },
  }),
);
