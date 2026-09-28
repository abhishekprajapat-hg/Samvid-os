import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Glyph, type GlyphName } from "../../../components/ui/Glyph";
import { brand, brandStyles, layout, round, type as t } from "../../../theme/brand";
import type { InventoryAsset, Lead } from "../../../types";
import type { LeadDiaryEntry } from "../../../services/leadService";
import {
  STEPPER_STAGES,
  areaLabel,
  budgetLabel,
  clockLabel,
  seatsLabel,
  compactAmount,
  displayPhone,
  followUpLabel,
  initialsOf,
  isOverdue,
  propertyLabel,
  sourceTone,
  stageOf,
  temperatureOf,
  temperatureTone,
  transactionLabel,
} from "../leadPipeline";

/*
 * The comp's Lead Details summary: who they are, where they are in the
 * pipeline, what they want, what is next, what they have been shown, and the
 * two most recent notes and activities.
 *
 * It sits above the screen's existing tabs rather than replacing them. The
 * tabs still hold the whole machine - editing the profile, the close flow with
 * its payment and approval, brokerage, status requests, documents - none of
 * which the comp draws and none of which has another home.
 */

const prettyAction = (value?: string) =>
  String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (ch) => ch.toUpperCase());

const timeAgoLabel = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const startOfDay = (input: Date) =>
    new Date(input.getFullYear(), input.getMonth(), input.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (days === 0) return `Today, ${clockLabel(value)}`;
  if (days === 1) return `Yesterday, ${clockLabel(value)}`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const ACTIVITY_ICONS: Array<{ match: RegExp; icon: GlyphName }> = [
  { match: /call/i, icon: "call" },
  { match: /whatsapp|message/i, icon: "logo-whatsapp" },
  { match: /mail|email/i, icon: "mail-outline" },
  { match: /follow/i, icon: "calendar-outline" },
  { match: /creat|new/i, icon: "megaphone-outline" },
  { match: /assign/i, icon: "person-outline" },
  { match: /status|stage/i, icon: "git-branch-outline" },
];

const activityIcon = (action?: string): GlyphName =>
  ACTIVITY_ICONS.find((entry) => entry.match.test(String(action || "")))?.icon || "ellipse-outline";

const Fact = ({ icon, text }: { icon: GlyphName; text: string }) => (
  <View style={styles.fact}>
    <Glyph name={icon} size={15} color={brand.textSecondary} />
    <Text style={styles.factText} numberOfLines={2}>
      {text}
    </Text>
  </View>
);

export const LeadOverview = ({
  lead,
  assigneeName,
  matches,
  notes,
  activities,
  onCall,
  onWhatsApp,
  onEmail,
  onUpdate,
  onReschedule,
  onMarkDone,
  onAddNote,
  onOpenMatch,
  onSeeAllMatches,
}: {
  lead: Lead;
  assigneeName: string;
  matches: InventoryAsset[];
  notes: LeadDiaryEntry[];
  activities: Array<{ _id: string; action: string; createdAt: string; performedBy?: { name?: string } }>;
  onCall: () => void;
  onWhatsApp: () => void;
  onEmail: () => void;
  onUpdate: () => void;
  onReschedule: () => void;
  onMarkDone: () => void;
  onAddNote: () => void;
  onOpenMatch: (asset: InventoryAsset) => void;
  onSeeAllMatches: () => void;
}) => {
  const temperature = temperatureTone(temperatureOf(lead));
  const source = sourceTone(lead);
  const currentIndex = STEPPER_STAGES.findIndex((entry) => entry.key === stageOf(lead));

  const follow = followUpLabel(lead.nextFollowUp);
  const late = isOverdue(lead.nextFollowUp);

  type Fact = { icon: GlyphName; text: string };
  const left: Fact[] = [];
  const right: Fact[] = [];

  const property = propertyLabel(lead);
  if (property) left.push({ icon: "business-outline", text: property });
  const transaction = transactionLabel(lead);
  if (transaction) left.push({ icon: "document-text-outline", text: transaction });
  if (lead.city) left.push({ icon: "location-outline", text: lead.city });
  const size = seatsLabel(lead) || areaLabel(lead, true);
  if (size) left.push({ icon: "resize-outline", text: size });

  const furnishing = String(lead.requirements?.furnishingStatus || "");
  if (furnishing) {
    right.push({ icon: "bed-outline", text: prettyAction(furnishing.replaceAll("_", " ")) });
  }
  const budget = budgetLabel(lead, true);
  if (budget) right.push({ icon: "cash-outline", text: budget });
  if (lead.company) right.push({ icon: "briefcase-outline", text: lead.company });
  const facts = [...left, ...right];

  return (
    <>
      {/* ---- profile ---- */}
      <View style={styles.card}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsOf(lead.name || lead.phone)}</Text>
          </View>

          <View style={styles.grow}>
            <Text style={styles.name} numberOfLines={1}>
              {lead.name || "Unnamed lead"}
            </Text>
            <View style={styles.pillRow}>
              <View style={[styles.pill, { backgroundColor: source.bg }]}>
                <Glyph name={source.icon as GlyphName} size={12} color={source.fg} />
                <Text style={[styles.pillText, { color: source.fg }]}>{source.label}</Text>
              </View>
              <View style={[styles.pill, { backgroundColor: temperature.bg }]}>
                {temperatureOf(lead) === "HOT" ? (
                  <Glyph name="flame" size={12} color={temperature.fg} />
                ) : null}
                <Text style={[styles.pillText, { color: temperature.fg }]}>{temperature.label}</Text>
              </View>
            </View>
          </View>

          <View style={styles.assignedBlock}>
            <Text style={styles.assignedLabel}>Assigned to</Text>
            <View style={styles.assignedRow}>
              <View style={styles.assignedAvatar}>
                <Text style={styles.assignedAvatarText}>{initialsOf(assigneeName)}</Text>
              </View>
              <Text style={styles.assignedName} numberOfLines={1}>
                {assigneeName || "Unassigned"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.contactRow}>
          <Glyph name="call-outline" size={15} color={brand.textSecondary} />
          <Text style={styles.contactText} numberOfLines={1}>
            {displayPhone(lead.phone) || "No phone"}
          </Text>
        </View>
        {lead.email ? (
          <View style={styles.contactRow}>
            <Glyph name="mail-outline" size={15} color={brand.textSecondary} />
            <Text style={styles.contactText} numberOfLines={1}>
              {lead.email}
            </Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable style={styles.actionSoft} onPress={onCall} accessibilityRole="button">
            <Glyph name="call" size={16} color={brand.deep} />
            <Text style={styles.actionSoftText}>Call</Text>
          </Pressable>
          <Pressable style={styles.actionSolid} onPress={onWhatsApp} accessibilityRole="button">
            <Glyph name="logo-whatsapp" size={17} color={brand.onPrimary} />
            <Text style={styles.actionSolidText}>WhatsApp</Text>
          </Pressable>
          <Pressable style={styles.actionSoft} onPress={onEmail} accessibilityRole="button">
            <Glyph name="mail-outline" size={16} color={brand.deep} />
            <Text style={styles.actionSoftText}>Email</Text>
          </Pressable>
        </View>
      </View>

      {/* ---- stage ---- */}
      <Pressable style={[styles.card, styles.cardGap]} onPress={onUpdate} accessibilityRole="button">
        <View style={styles.stepRow}>
          {STEPPER_STAGES.map((entry, index) => {
            const done = index < currentIndex;
            const active = index === currentIndex;
            return (
              <React.Fragment key={entry.key}>
                {index > 0 ? (
                  <View style={[styles.stepLine, index <= currentIndex && styles.stepLineOn]} />
                ) : null}
                <View style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepDot,
                      done && styles.stepDotDone,
                      active && styles.stepDotActive,
                    ]}
                  >
                    {done ? <Glyph name="checkmark" size={13} color={brand.onPrimary} /> : null}
                    {active ? <View style={styles.stepCore} /> : null}
                  </View>
                  <Text style={[styles.stepLabel, active && styles.stepLabelOn]} numberOfLines={1}>
                    {entry.label}
                  </Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>
      </Pressable>

      {/* ---- requirement ---- */}
      {facts.length ? (
        <View style={[styles.card, styles.cardGap]}>
          <Text style={styles.cardTitle}>Requirement</Text>
          {/* The comp fills the left column first, then the right. */}
          <View style={styles.factGrid}>
            <View style={styles.factCol}>
              {left.map((fact) => (
                <Fact key={`${fact.icon}-${fact.text}`} icon={fact.icon} text={fact.text} />
              ))}
            </View>
            <View style={styles.factCol}>
              {right.map((fact) => (
                <Fact key={`${fact.icon}-${fact.text}`} icon={fact.icon} text={fact.text} />
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {/* ---- next follow-up ---- */}
      <View style={[styles.card, styles.cardGap]}>
        <Text style={styles.cardTitle}>Next Follow-up</Text>
        <View style={styles.followRow}>
          <View style={styles.followIcon}>
            <Glyph name="calendar-outline" size={18} color={brand.primary} />
          </View>
          <View style={styles.grow}>
            <Text style={[styles.followWhen, late && { color: brand.alert }]} numberOfLines={1}>
              {follow ? follow.replace(/^(Today|Tomorrow|Yesterday) /, "$1, ") : "Not scheduled"}
            </Text>
            <Text style={styles.followNote} numberOfLines={2}>
              {lead.followUpPurpose || (follow ? "No purpose set" : "No follow-up on the calendar")}
            </Text>
          </View>

          <View style={styles.followActions}>
            <Pressable style={styles.outlineBtn} onPress={onReschedule} accessibilityRole="button">
              <Text style={styles.outlineBtnText}>Reschedule</Text>
            </Pressable>
            <Pressable
              style={[styles.solidBtn, !follow && styles.solidBtnOff]}
              onPress={onMarkDone}
              disabled={!follow}
              accessibilityRole="button"
            >
              <Text style={styles.solidBtnText}>Mark done</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* ---- matched properties ---- */}
      {matches.length ? (
        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.cardHeadRow}>
            <Text style={[styles.cardTitle, styles.cardTitleFlush]}>Matched Properties</Text>
            <Pressable style={styles.linkRow} onPress={onSeeAllMatches} accessibilityRole="button">
              <Text style={styles.linkText}>View all {matches.length} matches</Text>
              <Glyph name="arrow-forward" size={14} color={brand.primary} />
            </Pressable>
          </View>

          {matches.slice(0, 2).map((asset, index) => {
            const image = Array.isArray(asset.images) ? asset.images[0] : undefined;
            const price = asset.rent || asset.price;
            const area = asset.carpetArea || asset.builtUpArea || asset.totalArea;
            return (
              <Pressable
                key={asset._id || index}
                style={[styles.matchRow, index > 0 && styles.matchRowDivided]}
                onPress={() => onOpenMatch(asset)}
                accessibilityRole="button"
              >
                {image ? (
                  <Image source={{ uri: image }} style={styles.matchThumb} />
                ) : (
                  <View style={[styles.matchThumb, styles.matchThumbEmpty]}>
                    <Glyph name="business-outline" size={19} color={brand.placeholder} />
                  </View>
                )}

                <View style={styles.grow}>
                  <Text style={styles.matchTitle} numberOfLines={1}>
                    {asset.projectName || asset.title || "Untitled"}
                  </Text>
                  <View style={styles.matchMeta}>
                    <Glyph name="location-outline" size={12} color={brand.textMuted} />
                    <Text style={styles.matchMetaText} numberOfLines={1}>
                      {[asset.area, asset.city].filter(Boolean).join(", ") || asset.location || "-"}
                    </Text>
                  </View>
                  <View style={styles.matchMeta}>
                    {area ? (
                      <>
                        <Glyph name="resize-outline" size={12} color={brand.textMuted} />
                        <Text style={styles.matchMetaText}>
                          {Number(area).toLocaleString("en-IN")} sq ft
                        </Text>
                      </>
                    ) : null}
                    {asset.furnishingStatus ? (
                      <>
                        <Glyph name="business-outline" size={12} color={brand.textMuted} />
                        <Text style={styles.matchMetaText} numberOfLines={1}>
                          {prettyAction(asset.furnishingStatus.replaceAll("_", " "))}
                        </Text>
                      </>
                    ) : null}
                  </View>
                </View>

                <View style={styles.matchRight}>
                  <Text style={styles.matchPrice} numberOfLines={1}>
                    {price ? `${compactAmount(price)}${asset.rent ? "/month" : ""}` : "-"}
                  </Text>
                  <Glyph name="chevron-forward" size={17} color={brand.textMuted} />
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* ---- notes ---- */}
      <View style={[styles.card, styles.cardGap]}>
        <View style={styles.cardHeadRow}>
          <Text style={[styles.cardTitle, styles.cardTitleFlush]}>Notes</Text>
          <Pressable style={styles.linkRow} onPress={onAddNote} accessibilityRole="button">
            <Text style={styles.linkText}>Add note</Text>
            <Glyph name="add" size={15} color={brand.primary} />
          </Pressable>
        </View>

        {notes.length === 0 ? (
          <Text style={styles.emptyText}>No notes yet.</Text>
        ) : (
          notes.slice(0, 2).map((entry, index) => (
            <View key={entry._id || index} style={[styles.noteRow, index > 0 && styles.noteRowGap]}>
              <View style={styles.noteAvatar}>
                <Text style={styles.noteAvatarText}>{initialsOf(entry.createdBy?.name)}</Text>
              </View>
              <View style={styles.grow}>
                <View style={styles.noteHead}>
                  <Text style={styles.noteAuthor} numberOfLines={1}>
                    {entry.createdBy?.name || "Someone"}
                  </Text>
                  <Text style={styles.noteTime}>{timeAgoLabel(entry.createdAt)}</Text>
                </View>
                <Text style={styles.noteBody}>
                  {entry.note || entry.conversation || entry.visitDetails || entry.nextStep || ""}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* ---- activity ---- */}
      <View style={[styles.card, styles.cardGap]}>
        <Text style={styles.cardTitle}>Activity</Text>
        {activities.length === 0 ? (
          <Text style={styles.emptyText}>Nothing recorded yet.</Text>
        ) : (
          activities.slice(0, 4).map((entry, index) => (
            <View key={entry._id || index} style={styles.actRow}>
              <View style={styles.actRail}>
                <View style={styles.actIcon}>
                  <Glyph name={activityIcon(entry.action)} size={14} color={brand.deep} />
                </View>
                {index < Math.min(activities.length, 4) - 1 ? <View style={styles.actLine} /> : null}
              </View>
              <View style={styles.actBody}>
                <Text style={styles.actTitle}>{prettyAction(entry.action)}</Text>
                <Text style={styles.actTime}>
                  {timeAgoLabel(entry.createdAt)}
                  {entry.performedBy?.name ? ` · ${entry.performedBy.name}` : ""}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    grow: {
      flex: 1,
      minWidth: 0,
    },
    card: {
      padding: 13,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    cardGap: {
      marginTop: 10,
    },
    cardHeadRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    cardTitle: {
      marginBottom: 11,
      fontSize: t.barTitle,
      lineHeight: 22,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },
    cardTitleFlush: {
      flex: 1,
      minWidth: 0,
      marginBottom: 11,
    },
    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 11,
    },
    linkText: {
      fontSize: t.body,
      fontWeight: "700",
      color: b.primary,
    },
    emptyText: {
      fontSize: t.body,
      color: b.textMuted,
    },

    /* ---- profile ---- */
    profileRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 11,
    },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    avatarText: {
      fontSize: t.sectionTitle,
      fontWeight: "700",
      color: b.text,
    },
    name: {
      fontSize: t.hero,
      lineHeight: 25,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: b.text,
    },
    pillRow: {
      marginTop: 5,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      height: 21,
      paddingHorizontal: 8,
      borderRadius: round.pill,
    },
    pillText: {
      fontSize: t.tagline,
      fontWeight: "700",
    },
    assignedBlock: {
      alignItems: "flex-end",
      maxWidth: 122,
    },
    assignedLabel: {
      fontSize: t.tagline,
      color: b.textMuted,
    },
    assignedRow: {
      marginTop: 4,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    assignedAvatar: {
      width: 26,
      height: 26,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    assignedAvatarText: {
      fontSize: t.tagline,
      fontWeight: "700",
      color: b.deep,
    },
    assignedName: {
      flexShrink: 1,
      fontSize: t.body,
      color: b.text,
    },

    contactRow: {
      marginTop: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    contactText: {
      flex: 1,
      minWidth: 0,
      fontSize: t.field,
      color: b.textSecondary,
    },

    actionRow: {
      marginTop: 13,
      flexDirection: "row",
      gap: 8,
    },
    actionSoft: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      height: 42,
      borderRadius: round.field,
      backgroundColor: b.tint,
    },
    actionSoftText: {
      fontSize: t.cardTitle,
      fontWeight: "700",
      color: b.deep,
    },
    actionSolid: {
      flex: 1.2,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      height: 42,
      borderRadius: round.field,
      backgroundColor: "#0d7a48",
    },
    actionSolidText: {
      fontSize: t.cardTitle,
      fontWeight: "700",
      color: b.onPrimary,
    },

    /* ---- stage ---- */
    stepRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    stepItem: {
      alignItems: "center",
      gap: 7,
      /* Wide enough for "Requested" at 9pt, which is the longest of the six. */
      width: 54,
    },
    stepDot: {
      width: 24,
      height: 24,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: b.hairline,
      backgroundColor: b.surface,
    },
    stepDotDone: {
      borderColor: b.primary,
      backgroundColor: b.primary,
    },
    stepDotActive: {
      borderColor: b.primary,
    },
    stepCore: {
      width: 11,
      height: 11,
      borderRadius: round.pill,
      backgroundColor: b.primary,
    },
    stepLabel: {
      fontSize: t.micro,
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
      marginTop: 11,
      backgroundColor: b.hairline,
    },
    stepLineOn: {
      backgroundColor: b.primary,
    },

    /* ---- requirement ---- */
    factGrid: {
      flexDirection: "row",
      gap: 10,
    },
    factCol: {
      flex: 1,
      minWidth: 0,
      gap: 10,
    },
    fact: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 9,
    },
    factText: {
      flex: 1,
      minWidth: 0,
      fontSize: t.body,
      lineHeight: 17,
      color: b.textSecondary,
    },

    /* ---- follow-up ---- */
    followRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
    },
    followIcon: {
      width: 36,
      height: 36,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    followWhen: {
      fontSize: t.field,
      fontWeight: "700",
      color: b.primary,
    },
    followNote: {
      marginTop: 1,
      fontSize: t.fieldLabel,
      lineHeight: 15,
      color: b.textMuted,
    },
    followActions: {
      flexDirection: "row",
      gap: 8,
    },
    outlineBtn: {
      paddingHorizontal: 9,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: b.greenBright,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    outlineBtnText: {
      fontSize: t.body,
      fontWeight: "700",
      color: b.primary,
    },
    solidBtn: {
      paddingHorizontal: 9,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round.field,
      backgroundColor: "#0d7a48",
    },
    solidBtnOff: {
      opacity: 0.45,
    },
    solidBtnText: {
      fontSize: t.body,
      fontWeight: "700",
      color: b.onPrimary,
    },

    /* ---- matches ---- */
    matchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingVertical: 10,
    },
    matchRowDivided: {
      borderTopWidth: 1,
      borderTopColor: b.hairline,
    },
    matchThumb: {
      width: 62,
      height: 52,
      borderRadius: round.field,
      backgroundColor: b.hairline,
    },
    matchThumbEmpty: {
      alignItems: "center",
      justifyContent: "center",
    },
    matchTitle: {
      fontSize: t.rowTitle,
      fontWeight: "700",
      color: b.text,
    },
    matchMeta: {
      marginTop: 3,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    matchMetaText: {
      flexShrink: 1,
      fontSize: t.tagline,
      color: b.textMuted,
    },
    matchRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    matchPrice: {
      fontSize: t.cardTitle,
      fontWeight: "700",
      color: b.primary,
    },

    /* ---- notes ---- */
    noteRow: {
      flexDirection: "row",
      gap: 10,
    },
    noteRowGap: {
      marginTop: 13,
      paddingTop: 13,
      borderTopWidth: 1,
      borderTopColor: b.hairline,
    },
    noteAvatar: {
      width: 30,
      height: 30,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    noteAvatarText: {
      fontSize: t.tagline,
      fontWeight: "700",
      color: b.deep,
    },
    noteHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    noteAuthor: {
      flexShrink: 1,
      fontSize: t.cardTitle,
      fontWeight: "700",
      color: b.text,
    },
    noteTime: {
      fontSize: t.tagline,
      color: b.textMuted,
    },
    noteBody: {
      marginTop: 3,
      fontSize: t.body,
      lineHeight: 18,
      color: b.textSecondary,
    },

    /* ---- activity ---- */
    actRow: {
      flexDirection: "row",
      gap: 11,
    },
    actRail: {
      alignItems: "center",
      width: 30,
    },
    actIcon: {
      width: 30,
      height: 30,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    actLine: {
      flex: 1,
      width: 2,
      marginVertical: 3,
      backgroundColor: b.hairline,
    },
    actBody: {
      flex: 1,
      minWidth: 0,
      paddingBottom: 14,
    },
    actTitle: {
      fontSize: t.cardTitle,
      fontWeight: "600",
      color: b.text,
    },
    actTime: {
      marginTop: 2,
      fontSize: t.tagline,
      color: b.textMuted,
    },
  }),
);

export default LeadOverview;
