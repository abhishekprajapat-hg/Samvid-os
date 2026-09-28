import type { GlyphName } from "../../components/ui/Glyph";
import { brand } from "../../theme/brand";
import { MONTHS_SHORT } from "../finance/financeVocab";
import { avatarTone, initialsOf } from "../leads/leadPipeline";

/*
 * The words, tones and groupings the team comps use.
 *
 * Same job as leadPipeline.ts does for the pipeline: everything the four team
 * screens have to agree about lives here, so a status that reads "On Break" on
 * the list cannot read "Break" on the member page.
 *
 * The avatar helpers are the pipeline's, re-exported rather than rewritten -
 * one person should be the same colour on a lead card and in the team list.
 */

export { avatarTone, initialsOf };

/* ----------------------------------------------------------------- roles -- */

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  INSIDE_EXECUTIVE: "Inside Executive",
  EXECUTIVE: "Executive",
  FIELD_EXECUTIVE: "Field Executive",
  PRODUCTION_EXECUTIVE: "Production Executive",
  COMMUNITY_MANAGER: "Community Manager",
  CHANNEL_PARTNER: "Channel Partner",
  COWORKING_ADMIN: "Coworking admin",
};

/** A named role wins over the built-in one it is a preset for. */
export const roleLabelOf = (member: {
  role?: string;
  customRoleName?: string;
  customRoleId?: unknown;
}): string => {
  const named = String(member?.customRoleName || "").trim();
  if (named) return named;
  const custom = member?.customRoleId as { name?: string } | null | undefined;
  if (custom && typeof custom === "object" && custom.name) return String(custom.name);
  return ROLE_LABELS[String(member?.role || "")] || String(member?.role || "");
};

/* ---------------------------------------------------------------- status -- */

export type MemberStatus = "ACTIVE" | "BREAK" | "LEAVE" | "INVITED" | "OFF";

export const STATUS_LABELS: Record<MemberStatus, string> = {
  ACTIVE: "Active",
  BREAK: "On Break",
  LEAVE: "On Leave",
  INVITED: "Invited",
  OFF: "Deactivated",
};

/*
 * The wash, ink and dot behind a status.
 *
 * A function rather than a table, because the tokens it reads resolve against
 * the active scheme at the moment they are touched. Written out as fixed
 * colours the pills stayed mint on a dark card, which is the one thing the
 * comps cannot tell us - they are all light.
 */
export const statusTone = (status: MemberStatus): { bg: string; fg: string; dot: string } => {
  switch (status) {
    case "BREAK":
      return { bg: brand.warnTint, fg: brand.warnInk, dot: "#e39413" };
    case "LEAVE":
      return { bg: brand.neutralBadge, fg: brand.textSecondary, dot: brand.textMuted };
    case "INVITED":
      return { bg: brand.infoTint, fg: brand.infoInk, dot: "#2f7fe0" };
    case "OFF":
      return { bg: brand.neutralBadge, fg: brand.textMuted, dot: brand.placeholder };
    default:
      return { bg: brand.tint, fg: brand.deep, dot: "#0aa05f" };
  }
};

export type TeamMember = {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  isActive?: boolean;
  profileImageUrl?: string;
  employeeId?: string;
  department?: string;
  branch?: string;
  shiftTiming?: string;
  joiningDate?: string | null;
  invitedAt?: string | null;
  inviteAcceptedAt?: string | null;
  monthlyTarget?: number;
  leadCapacity?: number;
  taskCapacity?: number;
  canViewInventory?: boolean;
  lastLoginAt?: string | null;
  customRoleId?: { _id?: string; name?: string } | string | null;
  customRoleName?: string;
  parentId?: { _id?: string; name?: string; role?: string } | string | null;
  createdAt?: string | null;
};

/** Somebody invited who has never signed in since. */
export const isPendingInvite = (member: TeamMember) =>
  Boolean(member?.invitedAt) && !member?.inviteAcceptedAt && !member?.lastLoginAt;

/*
 * Where somebody is right now.
 *
 * Deactivated and invited are properties of the account, so they are read off
 * the record. Present, on a break and on leave are today's attendance, so they
 * come from the day's roster - and when that is not available (it needs the
 * attendance grant) everyone active reads simply as active rather than as
 * absent, which would be a claim the app cannot make.
 */
export const statusOf = (
  member: TeamMember,
  today?: { status?: string; onBreak?: boolean } | null,
): MemberStatus => {
  if (member?.isActive === false) return "OFF";
  if (isPendingInvite(member)) return "INVITED";
  if (today?.onBreak) return "BREAK";
  const status = String(today?.status || "").toUpperCase();
  if (status === "LEAVE" || status === "ON_LEAVE") return "LEAVE";
  return "ACTIVE";
};

/* ----------------------------------------------------------------- teams -- */

/** The department values in use, largest first - the comp's Teams card. */
export const teamsOf = (members: TeamMember[]) => {
  const counts = new Map<string, number>();
  for (const member of members) {
    const team = String(member.department || "").trim();
    if (!team) continue;
    counts.set(team, (counts.get(team) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

/* The wash behind a team's glyph, in the order the comp draws them. */
const TEAM_TONES = [
  { bg: "#d8efe6", fg: "#1f7a58" },
  { bg: "#dbe7fb", fg: "#2f60a8" },
  { bg: "#e8e2fb", fg: "#5b45a8" },
  { bg: "#fdeacd", fg: "#9a6612" },
  { bg: "#fbe0ec", fg: "#a83f6d" },
];

export const teamTone = (index: number) => TEAM_TONES[index % TEAM_TONES.length];

/* ------------------------------------------------------------ formatting -- */

/** "₹3.2 L" - one decimal, as the member tiles draw it. */
export const tileMoney = (value?: number | null): string => {
  const amount = Math.abs(Number(value) || 0);
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(1)} Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)} L`;
  if (amount >= 1000) return `₹${Math.round(amount / 1000)}K`;
  return `₹${Math.round(amount)}`;
};

const timeOf = (date: Date) =>
  date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .toUpperCase()
    .replace(/\s+/g, " ");

/** "Today, 11:24 AM" / "Yesterday, 4:15 PM" / "21 Sept 2024, 2:30 PM". */
export const activityStampOf = (value?: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(date)) / 86400000);

  if (days === 0) return `Today, ${timeOf(date)}`;
  if (days === 1) return `Yesterday, ${timeOf(date)}`;
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}, ${timeOf(date)}`;
};

/** "12 Jan 2025" - the joining date, the comp's work-details format. */
export const dayMonthYear = (value?: string | null): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${String(date.getDate()).padStart(2, "0")} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
};

/* ----------------------------------------------------- permission matrix -- */

/*
 * The rows the permissions screen draws, and the page each one governs.
 *
 * Seven of the catalogue's pages rather than all of them, because that is what
 * the comp lists. The screen still saves the rest untouched - see the note on
 * `pageAccess` in the roles payload - so leaving Calendar or Chat off this
 * list hides them from the matrix without taking them away from anybody.
 */
export const PERMISSION_ROWS: Array<{ pageKey: string; label: string; icon: GlyphName }> = [
  { pageKey: "dashboard", label: "Dashboard", icon: "grid-outline" },
  { pageKey: "leads", label: "Leads", icon: "person-outline" },
  { pageKey: "inventory", label: "Inventory", icon: "business-outline" },
  { pageKey: "tasks", label: "Tasks", icon: "checkbox-outline" },
  { pageKey: "finance", label: "Finance", icon: "card-outline" },
  { pageKey: "reports", label: "Reports", icon: "bar-chart-outline" },
  { pageKey: "admin_team", label: "Team & Admin", icon: "people-outline" },
];

/** The chips, in the comp's order. An action a page does not offer is skipped. */
export const PERMISSION_ACTIONS: Array<{ action: string; label: string }> = [
  { action: "view", label: "View" },
  { action: "create", label: "Create" },
  { action: "edit", label: "Edit" },
  { action: "delete", label: "Delete" },
  { action: "export", label: "Export" },
];

/*
 * The security card.
 *
 * The first three are existing permissions, so switching one on grants the
 * thing it names rather than recording an intention: manage roles is what the
 * roles routes check, invite members is what user creation checks, and audit
 * logs is what the log listing checks.
 *
 * The fourth is drawn and cannot be switched. There is no second factor in
 * this app to require, and a toggle that reads "on" while every login is still
 * one password is worse than no toggle - an admin would believe the accounts
 * were protected. It stays visible, and says why, rather than disappearing.
 */
export const SECURITY_TOGGLES: Array<{
  permission: string;
  label: string;
  icon: GlyphName;
  note?: string;
}> = [
  { permission: "roles.manage", label: "Can manage roles", icon: "lock-closed-outline" },
  { permission: "users.create", label: "Can invite members", icon: "person-add-outline" },
  { permission: "audit_logs.view", label: "Can view audit logs", icon: "document-text-outline" },
  {
    permission: "",
    label: "Require 2-step verification",
    icon: "shield-outline",
    note: "No second factor is set up for this workspace yet.",
  },
];

export const toPagePermission = (pageKey: string, action: string) => `page.${pageKey}.${action}`;
