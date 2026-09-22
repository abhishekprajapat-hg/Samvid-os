/*
 * The half of the admin console that *does* something.
 *
 * Mobile's console could only answer questions; web's can also act - approve or
 * reject a pending request - and every action goes through a two-step confirm
 * before it runs, with an audit entry recorded after. That two-step is the
 * point: a natural-language surface guesses at intent, so the one thing it must
 * never do is guess its way into an irreversible change.
 *
 * Kept out of the screen so the parsing and the audit trimming can be tested
 * without a renderer - see test/consoleActions.test.cjs.
 */

export const CONFIRM_INTENT_TERMS = ["confirm", "yes confirm", "proceed", "yes proceed", "ok confirm", "yes"];
export const CANCEL_INTENT_TERMS = ["cancel", "stop", "abort", "dismiss", "no"];

export const APPROVE_ACTION_TERMS = [
  "approve", "accept", "manzoor", "approve karo", "ok karo", "pass karo",
];
export const REJECT_ACTION_TERMS = ["reject", "decline", "mana", "reject karo", "deny"];

export const FINANCE_INTENT_TERMS = [
  "finance", "revenue", "payment", "payments", "collection", "collections",
  "invoice", "invoices", "outstanding", "paisa", "kitna paisa",
];

/** What a request is about, which decides which service answers it. */
export type ActionTargetKind = "INVENTORY" | "LEAD_STATUS" | "USER_DELETE";

export type PendingAction = {
  kind: "APPROVE" | "REJECT";
  target: ActionTargetKind;
  id: string;
  /** Shown in the confirm prompt so the person sees what they are agreeing to. */
  label: string;
};

export type AuditEntry = {
  at: string;
  actor: string;
  action: string;
  details: string;
};

export const MAX_AUDIT_ROWS = 200;

export const normalize = (value: unknown) =>
  String(value || "").toLowerCase().replace(/\s+/g, " ").trim();

export const includesAny = (query: string, terms: string[]) =>
  terms.some((term) => query.includes(term));

/*
 * A bare "yes" is a confirmation only when something is actually waiting. On
 * its own it is far more likely to be conversational, and treating it as a
 * blanket confirm is how a console approves something nobody meant to approve.
 */
export const isConfirmCommand = (query: string, hasPending: boolean) => {
  const q = normalize(query);
  if (!hasPending) return false;
  return CONFIRM_INTENT_TERMS.some((term) => q === term);
};

export const isCancelCommand = (query: string, hasPending: boolean) => {
  const q = normalize(query);
  if (!hasPending) return false;
  return CANCEL_INTENT_TERMS.some((term) => q === term);
};

/** Which request kind a phrase is talking about, if any. */
export const matchActionTarget = (query: string): ActionTargetKind | null => {
  const q = normalize(query);
  if (includesAny(q, ["inventory", "property", "asset", "unit"])) return "INVENTORY";
  if (includesAny(q, ["lead status", "status request", "lead request"])) return "LEAD_STATUS";
  if (includesAny(q, ["user", "delete user", "remove user", "team member"])) return "USER_DELETE";
  return null;
};

/**
 * Reads an approve/reject instruction out of a phrase.
 *
 * Returns null unless the phrase names both an action and a target - an
 * ambiguous instruction is better answered with a question than acted on.
 */
export const parseActionIntent = (
  query: string,
): { kind: "APPROVE" | "REJECT"; target: ActionTargetKind } | null => {
  const q = normalize(query);

  const wantsApprove = includesAny(q, APPROVE_ACTION_TERMS);
  const wantsReject = includesAny(q, REJECT_ACTION_TERMS);
  // "approve or reject" names both and settles nothing.
  if (wantsApprove === wantsReject) return null;

  const target = matchActionTarget(q);
  if (!target) return null;

  return { kind: wantsApprove ? "APPROVE" : "REJECT", target };
};

export const describeAction = (action: PendingAction) =>
  `${action.kind === "APPROVE" ? "Approve" : "Reject"} ${action.label}`;

/** The prompt shown before anything runs. */
export const buildConfirmPrompt = (action: PendingAction) =>
  [
    `${describeAction(action)}?`,
    "",
    'Reply "confirm" to go ahead, or "cancel" to drop it.',
  ].join("\n");

export const appendAudit = (log: AuditEntry[], entry: AuditEntry): AuditEntry[] =>
  // Newest first, and bounded: this lives in device storage, not a database.
  [entry, ...log].slice(0, MAX_AUDIT_ROWS);

export const buildAuditReply = (log: AuditEntry[]) => {
  if (!log.length) return "No actions recorded on this device yet.";
  const rows = log
    .slice(0, 10)
    .map((entry) => `- ${entry.action} · ${entry.details} · ${entry.actor}`);
  return [`Recent actions (${log.length} recorded)`, ...rows].join("\n");
};
