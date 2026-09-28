import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  addLeadDiaryEntry,
  assignLead,
  getLeadById,
  updateLeadStatus,
} from "../../services/leadService";
import { getUsers } from "../../services/userService";
import { scheduleLocalReminder } from "../../services/pushNotifications";
import type { Lead } from "../../types";
import {
  STEPPER_STAGES,
  TEMPERATURE_CHOICES,
  assigneeOf,
  initialsOf,
  primaryStatusOf,
  stageOf,
  temperatureOf,
  temperatureTone,
  type StageKey,
  type Temperature,
} from "./leadPipeline";

/*
 * Update Lead, drawn to the comp.
 *
 * One save writes to three places, because that is what the comp's four cards
 * mean: the stage and the temperature patch the lead, the interaction and the
 * next action become a diary entry, and the follow-up sets `nextFollowUp` plus
 * a reminder on this phone.
 *
 * Closing is the exception. The comp draws Closed as just another step, but a
 * close needs the deal payment - mode, amount, reference - and, for some roles,
 * an approval. Both live on Lead Details, so picking Closed here sends you
 * there rather than writing a status that would be refused or, worse, recorded
 * without the money.
 */

type Channel = "CALL" | "WHATSAPP" | "EMAIL" | "MEETING";

const CHANNELS: Array<{ key: Channel; label: string; icon: GlyphName }> = [
  { key: "CALL", label: "Call", icon: "call" },
  { key: "WHATSAPP", label: "WhatsApp", icon: "logo-whatsapp" },
  { key: "EMAIL", label: "Email", icon: "mail-outline" },
  { key: "MEETING", label: "Meeting", icon: "calendar-outline" },
];

const OUTCOMES = [
  { value: "CONNECTED", label: "Connected" },
  { value: "NO_ANSWER", label: "No answer" },
  { value: "BUSY", label: "Busy, call back" },
  { value: "SWITCHED_OFF", label: "Switched off" },
  { value: "WRONG_NUMBER", label: "Wrong number" },
  { value: "NOT_INTERESTED", label: "Not interested" },
  { value: "MEETING_DONE", label: "Meeting done" },
];

const PURPOSES = [
  { value: "Discuss shortlisted properties", label: "Discuss shortlisted properties" },
  { value: "Share more options", label: "Share more options" },
  { value: "Confirm site visit", label: "Confirm site visit" },
  { value: "Negotiation", label: "Negotiation" },
  { value: "Documentation", label: "Documentation" },
  { value: "General follow-up", label: "General follow-up" },
];

const NEXT_ACTIONS = [
  { value: "", label: "No next action" },
  { value: "Schedule property visit", label: "Schedule property visit" },
  { value: "Share shortlist", label: "Share shortlist" },
  { value: "Send quotation", label: "Send quotation" },
  { value: "Follow-up call", label: "Follow-up call" },
  { value: "Collect documents", label: "Collect documents" },
  { value: "Close the deal", label: "Close the deal" },
];

const REMINDER_OPTIONS = [
  { value: "0", label: "At the time" },
  { value: "15", label: "15 minutes before" },
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
];

/* The comp writes September as "Sept", and prints the date rather than "Today". */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

const dayOptions = () =>
  Array.from({ length: 21 }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { value, label: `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}` };
  });

const TIME_OPTIONS = Array.from({ length: 27 }, (_, index) => {
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

/* -------------------------------------------------------------- pieces -- */

const Stepper = ({
  value,
  onChange,
}: {
  value: StageKey;
  onChange: (next: StageKey) => void;
}) => {
  const currentIndex = STEPPER_STAGES.findIndex((stage) => stage.key === value);

  return (
    <View style={styles.stepRow}>
      {STEPPER_STAGES.map((stage, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <React.Fragment key={stage.key}>
            {index > 0 ? <View style={[styles.stepLine, index <= currentIndex && styles.stepLineOn]} /> : null}
            <Pressable
              style={styles.stepItem}
              onPress={() => onChange(stage.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Stage ${index + 1}, ${stage.label}`}
            >
              <View style={[styles.stepDot, (done || active) && styles.stepDotOn]}>
                {done ? (
                  <Glyph name="checkmark" size={15} color={brand.onPrimary} />
                ) : (
                  <Text style={[styles.stepNum, active && styles.stepNumOn]}>{index + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, active && styles.stepLabelOn]} numberOfLines={1}>
                {stage.label}
              </Text>
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
};

/* -------------------------------------------------------------- screen -- */

export const UpdateLeadScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const leadId = String(route.params?.leadId || "");
  const [lead, setLead] = useState<Lead | null>((route.params?.lead as Lead) || null);
  const [loading, setLoading] = useState(!route.params?.lead);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [stage, setStage] = useState<StageKey>("NEW");
  const [channel, setChannel] = useState<Channel>("CALL");
  const [outcome, setOutcome] = useState("CONNECTED");
  const [interactionNote, setInteractionNote] = useState("");
  const [logActivity, setLogActivity] = useState(true);

  const [scheduleFollowUp, setScheduleFollowUp] = useState(true);
  const [date, setDate] = useState(dayOptions()[0].value);
  const [time, setTime] = useState("14:30");
  const [purpose, setPurpose] = useState(PURPOSES[0].value);
  const [reminder, setReminder] = useState("30");
  const [assignedTo, setAssignedTo] = useState("");

  const [temperature, setTemperature] = useState<Temperature>("WARM");
  const [nextAction, setNextAction] = useState("");

  const [users, setUsers] = useState<Array<{ _id?: string; name: string; isActive?: boolean }>>([]);

  const hydrate = useCallback((row: Lead) => {
    setStage(stageOf(row));
    if (row.followUpPurpose) setPurpose(row.followUpPurpose);
    setTemperature(temperatureOf(row) || "WARM");
    setAssignedTo(assigneeOf(row).id);
    if (row.nextFollowUp) {
      const due = new Date(row.nextFollowUp);
      if (!Number.isNaN(due.getTime())) {
        setDate(`${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`);
        const minute = due.getMinutes() >= 30 ? "30" : "00";
        setTime(`${String(due.getHours()).padStart(2, "0")}:${minute}`);
      }
    }
  }, []);

  useEffect(() => {
    if (lead) hydrate(lead);
  }, [lead, hydrate]);

  useEffect(() => {
    void (async () => {
      try {
        const payload = await getUsers();
        setUsers(payload?.users || []);
      } catch {
        /* Reassignment is optional; the rest of the form still works. */
      }
    })();
  }, []);

  useEffect(() => {
    if (lead || !leadId) return;
    void (async () => {
      try {
        setLoading(true);
        const row = await getLeadById(leadId);
        if (row) setLead(row);
        else setError("That lead could not be found");
      } catch (e) {
        setError(toErrorMessage(e, "Failed to load the lead"));
      } finally {
        setLoading(false);
      }
    })();
  }, [lead, leadId]);

  const assignableUsers = useMemo(
    () => users.filter((row) => row.isActive !== false && row._id),
    [users],
  );
  const assignee = assignableUsers.find((row) => row._id === assignedTo);

  const pickStage = (next: StageKey) => {
    if (next === "CLOSED") {
      Alert.alert(
        "Closing needs the deal details",
        "A close records the payment mode, the amount and the reference, and may need an approval. Lead Details has that form.",
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Open lead details",
            onPress: () => navigation.navigate("LeadDetails", { leadId, lead }),
          },
        ],
      );
      return;
    }
    setStage(next);
  };

  const submit = async () => {
    if (!lead?._id) return;

    const followUpAt = scheduleFollowUp ? new Date(`${date}T${time}:00`) : null;
    if (followUpAt && Number.isNaN(followUpAt.getTime())) {
      setError("That follow-up date and time could not be read");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        status: primaryStatusOf(stage),
        temperature: temperature || "WARM",
      };
      if (followUpAt) {
        payload.nextFollowUp = followUpAt.toISOString();
        payload.followUpPurpose = purpose;
      }

      const updated = await updateLeadStatus(lead._id, payload as Partial<Lead>);

      const previousAssignee = assigneeOf(lead).id;
      if (assignedTo && assignedTo !== previousAssignee) {
        await assignLead(lead._id, assignedTo).catch(() => undefined);
      }

      /*
       * The diary is where an interaction is recorded - the Lead model has no
       * channel or outcome column, so both are written into the line rather
       * than dropped, the way the attendance sheet records an effective time.
       */
      if (logActivity && (interactionNote.trim() || nextAction)) {
        const channelLabel = CHANNELS.find((entry) => entry.key === channel)?.label || "Call";
        const outcomeLabel = OUTCOMES.find((entry) => entry.value === outcome)?.label || "";
        const head = [channelLabel, outcomeLabel].filter(Boolean).join(" · ");
        await addLeadDiaryEntry(lead._id, {
          conversation: [head, interactionNote.trim()].filter(Boolean).join(" — "),
          nextStep: nextAction,
        }).catch(() => undefined);
      }

      if (followUpAt) {
        const lead_ = Math.max(0, Number(reminder) || 0);
        await scheduleLocalReminder(new Date(followUpAt.getTime() - lead_ * 60000), {
          title: `Follow up with ${lead.name || "lead"}`,
          body: purpose,
          data: { url: `/leads/${lead._id}` },
        });
      }

      if (updated) setLead(updated);
      navigation.goBack();
    } catch (e) {
      setError(toErrorMessage(e, "Failed to update the lead"));
    } finally {
      setSaving(false);
    }
  };

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
      <View style={styles.bar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Glyph name="arrow-back" size={24} color={brand.text} />
        </Pressable>
        <View style={styles.grow}>
          <Text style={styles.barTitle} numberOfLines={1}>
            Update Lead
          </Text>
          <Text style={styles.barSubtitle} numberOfLines={1}>
            {lead?.name || "Lead"}
          </Text>
        </View>
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

          <SectionCard>
            <Text style={styles.cardTitle}>Pipeline Stage</Text>
            <Text style={styles.cardNote}>Move lead to the next stage when progress is confirmed.</Text>
            <Stepper value={stage} onChange={pickStage} />
          </SectionCard>

          <SectionCard>
            <Text style={styles.cardTitle}>Interaction</Text>
            <View style={styles.channelRow}>
              {CHANNELS.map((entry) => {
                const active = channel === entry.key;
                return (
                  <Pressable
                    key={entry.key}
                    style={[styles.channelItem, active && styles.channelItemOn]}
                    onPress={() => setChannel(entry.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Glyph name={entry.icon} size={15} color={active ? brand.deep : brand.textSecondary} />
                    <Text style={[styles.channelLabel, active && styles.channelLabelOn]} numberOfLines={1}>
                      {entry.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <SelectField label="Outcome" value={outcome} options={OUTCOMES} onChange={setOutcome} />

            <TextField
              label="Interaction notes"
              value={interactionNote}
              onChangeText={setInteractionNote}
              placeholder="What was discussed?"
              multiline
            />

            <View style={styles.toggleRow}>
              <View style={styles.grow}>
                <Text style={styles.toggleTitle}>Log this activity</Text>
                <Text style={styles.toggleNote}>Save this interaction in the lead diary.</Text>
              </View>
              <Toggle value={logActivity} onValueChange={setLogActivity} />
            </View>
          </SectionCard>

          <SectionCard>
            <View style={styles.cardHeadRow}>
              <Text style={[styles.cardTitle, styles.cardTitleFlush]}>Schedule Follow-up</Text>
              <Toggle value={scheduleFollowUp} onValueChange={setScheduleFollowUp} />
            </View>

            {scheduleFollowUp ? (
              <>
                <FieldRow>
                  <FieldCol>
                    <SelectField
                      label="Date"
                      icon="calendar-outline"
                      value={date}
                      options={dayOptions()}
                      onChange={setDate}
                    />
                  </FieldCol>
                  <FieldCol>
                    <SelectField
                      label="Time"
                      icon="time-outline"
                      value={time}
                      options={TIME_OPTIONS}
                      onChange={setTime}
                    />
                  </FieldCol>
                </FieldRow>

                <SelectField
                  label="Purpose"
                  icon="document-text-outline"
                  value={purpose}
                  options={PURPOSES}
                  onChange={setPurpose}
                />

                <SelectField
                  label="Reminder"
                  icon="notifications-outline"
                  value={reminder}
                  options={REMINDER_OPTIONS}
                  onChange={setReminder}
                />

                <SelectField
                  label="Assign to"
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
                      </View>
                    ) : undefined
                  }
                />

                <Text style={styles.cardNote}>Reminder is set on this device.</Text>
              </>
            ) : null}
          </SectionCard>

          <SectionCard>
            <Text style={styles.cardTitle}>Lead Temperature</Text>
            <View style={styles.tempRow}>
              {TEMPERATURE_CHOICES.map((choice) => {
                const active = temperature === choice.key;
                const tone = temperatureTone(choice.key);
                return (
                  <Pressable
                    key={choice.key}
                    style={[styles.tempItem, active && { backgroundColor: tone.bg, borderColor: tone.fg }]}
                    onPress={() => setTemperature(choice.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Glyph
                      name={choice.icon as GlyphName}
                      size={15}
                      color={active ? tone.fg : brand.textSecondary}
                    />
                    <Text style={[styles.tempLabel, active && { color: tone.fg, fontWeight: "700" }]}>
                      {choice.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>

          <SectionCard>
            <Text style={styles.cardTitle}>Next Action</Text>
            <SelectField
              value={nextAction}
              options={NEXT_ACTIONS}
              onChange={setNextAction}
              icon="locate-outline"
              placeholder="No next action"
            />
          </SectionCard>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Pressable
            style={[styles.submit, saving && styles.submitOff]}
            onPress={submit}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={styles.submitText}>{saving ? "Saving…" : "Save update"}</Text>
            {!saving ? <Glyph name="arrow-forward" size={18} color={brand.onPrimary} /> : null}
          </Pressable>
          <Pressable
            style={styles.cancel}
            onPress={() => navigation.goBack()}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>Cancel</Text>
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
    centred: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    grow: {
      flex: 1,
      minWidth: 0,
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
      fontSize: t.hero,
      lineHeight: 25,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: b.text,
    },
    barSubtitle: {
      fontSize: t.body,
      lineHeight: 16,
      color: b.textMuted,
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
    cardHeadRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 14,
    },
    cardTitle: {
      marginBottom: 6,
      fontSize: t.barTitle,
      lineHeight: 22,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },
    cardTitleFlush: {
      flex: 1,
      minWidth: 0,
      marginBottom: 0,
    },
    cardNote: {
      marginBottom: 14,
      fontSize: t.body,
      lineHeight: 17,
      color: b.textMuted,
    },

    /* ---- stepper ---- */
    stepRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    stepItem: {
      alignItems: "center",
      gap: 7,
      width: 52,
    },
    stepDot: {
      width: 30,
      height: 30,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.hairline,
    },
    stepDotOn: {
      backgroundColor: b.primary,
    },
    stepNum: {
      fontSize: t.body,
      fontWeight: "700",
      color: b.textSecondary,
    },
    stepNumOn: {
      color: b.onPrimary,
    },
    stepLabel: {
      fontSize: t.tagline,
      color: b.textSecondary,
    },
    stepLabelOn: {
      fontWeight: "700",
      color: b.primary,
    },
    stepLine: {
      flex: 1,
      minWidth: 0,
      height: 2,
      marginTop: 14,
      backgroundColor: b.hairline,
    },
    stepLineOn: {
      backgroundColor: b.primary,
    },

    /* ---- interaction ---- */
    channelRow: {
      flexDirection: "row",
      gap: 6,
      marginBottom: layout.fieldGap,
    },
    channelItem: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      height: 42,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    channelItemOn: {
      borderColor: b.greenBright,
      backgroundColor: b.tint,
    },
    channelLabel: {
      flexShrink: 1,
      fontSize: t.body,
      fontWeight: "500",
      color: b.textSecondary,
    },
    channelLabelOn: {
      fontWeight: "700",
      color: b.deep,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    toggleTitle: {
      fontSize: t.field,
      fontWeight: "600",
      color: b.text,
    },
    toggleNote: {
      marginTop: 1,
      fontSize: t.body,
      color: b.textMuted,
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

    /* ---- temperature ---- */
    tempRow: {
      flexDirection: "row",
      gap: 7,
    },
    tempItem: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      height: 44,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    tempLabel: {
      fontSize: t.field,
      fontWeight: "500",
      color: b.textSecondary,
    },

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
    submitOff: {
      opacity: 0.6,
    },
    submitText: {
      fontSize: t.sectionTitle,
      fontWeight: "700",
      color: b.onPrimary,
    },
    cancel: {
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelText: {
      fontSize: t.field,
      fontWeight: "700",
      color: b.primary,
    },
  }),
);

export default UpdateLeadScreen;
