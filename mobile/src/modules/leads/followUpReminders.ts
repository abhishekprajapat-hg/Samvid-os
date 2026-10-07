/*
 * Follow-up reminder rules - a port of the pure half of
 * frontend/src/components/layout/FollowUpReminderToast.jsx.
 *
 * A lead in an active status whose follow-up is due in the next hour, or went
 * past in the last day, raises a reminder in one of five buckets. The bucket is
 * part of the reminder's key, so dismissing "30 min left" still lets "Due now"
 * come back when it arrives. Kept free of React so it can be tested; see
 * test/followUpReminders.test.cjs.
 */

export const ACTIVE_LEAD_STATUSES = new Set(["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"]);
export const POLL_INTERVAL_MS = 60000;
export const REMINDER_LOOKBACK_MS = 24 * 60 * 60 * 1000;
export const REMINDER_LOOKAHEAD_MS = 60 * 60 * 1000;
export const REMINDER_STORAGE_KEY = "followUpReminderSeen:v1";
export const MAX_SEEN_KEYS = 500;

export type ReminderLead = {
  _id?: string;
  name?: string;
  phone?: string;
  city?: string;
  projectInterested?: string;
  status?: string;
  nextFollowUp?: string | null;
};

export type ActiveReminder = ReminderLead & {
  _reminderBucket: string;
  _reminderKey: string;
  _reminderDiffMs: number;
};

const toIdString = (value: unknown) => String(value || "").trim();

export const getReminderBucket = (diffMs: number) => {
  if (diffMs <= -60 * 1000) return "overdue";
  if (diffMs <= 60 * 1000) return "due";
  if (diffMs <= 15 * 60 * 1000) return "15m";
  if (diffMs <= 30 * 60 * 1000) return "30m";
  if (diffMs <= 60 * 60 * 1000) return "60m";
  return "";
};

export const getTimeLeftText = (diffMs: number) => {
  const absMs = Math.abs(diffMs);
  const totalMinutes = Math.max(1, Math.round(absMs / 60000));

  if (diffMs <= -60 * 1000) {
    if (totalMinutes < 60) return `${totalMinutes} min overdue`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes ? `${hours}h ${minutes}m overdue` : `${hours}h overdue`;
  }

  if (diffMs <= 60 * 1000) return "Due now";
  if (totalMinutes < 60) return `${totalMinutes} min left`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m left` : `${hours}h left`;
};

export const buildReminderKey = (lead: ReminderLead, bucket: string) =>
  `${toIdString(lead?._id)}:${new Date(String(lead?.nextFollowUp)).getTime()}:${bucket}`;

export const normalizeReminderLead = (lead: ReminderLead, nowMs: number): ActiveReminder | null => {
  const leadId = toIdString(lead?._id);
  const followUpMs = new Date(String(lead?.nextFollowUp)).getTime();
  const status = String(lead?.status || "").trim().toUpperCase();
  if (!leadId || !lead?.nextFollowUp || !Number.isFinite(followUpMs) || !ACTIVE_LEAD_STATUSES.has(status)) {
    return null;
  }

  const diffMs = followUpMs - nowMs;
  if (diffMs < -REMINDER_LOOKBACK_MS || diffMs > REMINDER_LOOKAHEAD_MS) return null;

  const bucket = getReminderBucket(diffMs);
  if (!bucket) return null;

  return {
    ...lead,
    _reminderBucket: bucket,
    _reminderKey: buildReminderKey(lead, bucket),
    _reminderDiffMs: diffMs,
  };
};

/** Overdue first, then soonest - the one reminder to show. */
export const pickActiveReminder = (leads: ReminderLead[], nowMs: number, dismissedKeys: string[]) => {
  const rows = leads
    .map((lead) => normalizeReminderLead(lead, nowMs))
    .filter((lead): lead is ActiveReminder => Boolean(lead))
    .filter((lead) => !dismissedKeys.includes(lead._reminderKey));

  rows.sort((a, b) => {
    const aOverdue = a._reminderDiffMs <= 0;
    const bOverdue = b._reminderDiffMs <= 0;
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    return a._reminderDiffMs - b._reminderDiffMs;
  });

  return rows[0] || null;
};

/*
 * The follow-ups worth a device notification: still ahead, inside the window
 * polled. Keyed by lead and time, so a rescheduled follow-up is a new key and
 * the old notification can be cancelled.
 */
export const upcomingNotificationKeys = (leads: ReminderLead[], nowMs: number) =>
  leads
    .filter((lead) => {
      const status = String(lead?.status || "").trim().toUpperCase();
      const at = new Date(String(lead?.nextFollowUp)).getTime();
      return (
        Boolean(toIdString(lead?._id))
        && Boolean(lead?.nextFollowUp)
        && ACTIVE_LEAD_STATUSES.has(status)
        && Number.isFinite(at)
        && at > nowMs
        && at - nowMs <= REMINDER_LOOKAHEAD_MS
      );
    })
    .map((lead) => ({
      key: `${toIdString(lead._id)}:${new Date(String(lead.nextFollowUp)).getTime()}`,
      lead,
      at: new Date(String(lead.nextFollowUp)),
    }));
