import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "../../../components/ui/Icon";
import { radii, spacing, typography } from "../../../theme/tokens";
import { themedStyles, themePalette } from "../../../theme/themedStyles";
import {
  WORKLOAD_BANDS,
  completionRate,
  workloadColor,
  type WorkloadBand,
} from "../taskConstants";
import { Avatar, KebabButton, ProgressBar } from "./TaskPieces";

/*
 * The Team tab's two halves: the workload roll-up and the per-person roster.
 *
 * Every number here comes from /tasks/stats/by-user, which the API already
 * computes per assignee - the screen does not re-tally tasks it has not
 * loaded. The band a person falls in is decided by workloadBand() in
 * taskConstants, so the legend and the roster cannot disagree.
 */

export type TeamMemberRow = {
  id: string;
  name: string;
  role: string;
  band: WorkloadBand;
  total: number;
  done: number;
  overdue: number;
};

const bandLabel = (band: WorkloadBand) =>
  WORKLOAD_BANDS.find((row) => row.id === band)?.label || "Available";

export const TeamWorkloadCard = ({ members }: { members: TeamMemberRow[] }) => {
  const [open, setOpen] = useState(true);
  const total = members.length;

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.cardHead}
        onPress={() => setOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={styles.cardIcon}>
          <Icon name="barChart" size={16} color={themePalette.violet[600]} />
        </View>
        <Text style={styles.cardTitle}>Team Workload</Text>
        <View style={styles.spacer} />
        <Icon name={open ? "chevron-up" : "chevron-down"} size={18} color={themePalette.slate[500]} />
      </Pressable>

      {open ? (
        <View style={styles.bands}>
          {WORKLOAD_BANDS.map((band) => {
            const count = members.filter((member) => member.band === band.id).length;
            const share = total > 0 ? Math.round((count / total) * 100) : 0;
            const color = workloadColor(band.id);
            return (
              <View key={band.id} style={styles.bandRow}>
                <View style={[styles.bandDot, { backgroundColor: color }]} />
                <Text style={styles.bandLabel}>{band.label}</Text>
                <Text style={styles.bandCount}>{count}</Text>
                <View style={styles.bandTrack}>
                  <ProgressBar percent={share} color={color} height={8} />
                </View>
                <Text style={styles.bandShare}>{share}%</Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

export const TeamMemberCard = ({
  member,
  onPress,
  onMenu,
}: {
  member: TeamMemberRow;
  onPress: () => void;
  onMenu: () => void;
}) => {
  const percent = completionRate(member.done, member.total);
  const needsAttention = member.overdue > 0;

  return (
    <Pressable style={styles.member} onPress={onPress} accessibilityRole="button">
      <View style={styles.memberHead}>
        <Avatar name={member.name} size={44} />

        <View style={styles.memberText}>
          <View style={styles.memberNameRow}>
            <Text style={styles.memberName} numberOfLines={1}>
              {member.name}
            </Text>
            {needsAttention ? (
              <View style={styles.attention}>
                <Text style={styles.attentionText}>Needs attention</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.memberSubRow}>
            <Text style={styles.memberRole} numberOfLines={1}>
              {member.role}
            </Text>
            <View style={[styles.bandDot, { backgroundColor: workloadColor(member.band) }]} />
            <Text style={styles.memberBand}>{bandLabel(member.band)}</Text>
          </View>
        </View>

        <KebabButton onPress={onMenu} />
      </View>

      <View style={styles.memberProgress}>
        <ProgressBar percent={percent} />
        <Text style={styles.memberPercent}>{percent}%</Text>
      </View>

      <View style={styles.memberStats}>
        <View style={styles.memberStat}>
          <Text style={styles.memberStatValue}>{member.total}</Text>
          <Text style={styles.memberStatLabel}>Total</Text>
        </View>
        <View style={[styles.memberStat, styles.memberStatMid]}>
          <Text style={[styles.memberStatValue, styles.valueDone]}>{member.done}</Text>
          <Text style={styles.memberStatLabel}>Done</Text>
        </View>
        <View style={[styles.memberStat, styles.memberStatEnd]}>
          <Text style={[styles.memberStatValue, styles.valueOverdue]}>{member.overdue}</Text>
          <Text style={styles.memberStatLabel}>Overdue</Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.violet[50],
  },
  cardTitle: {
    fontSize: typography.section,
    fontWeight: "700",
    color: c.slate[900],
  },
  spacer: {
    flex: 1,
  },
  bands: {
    gap: spacing.lg,
  },
  bandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  bandDot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
  },
  bandLabel: {
    width: 74,
    fontSize: typography.label,
    color: c.slate[700],
  },
  bandCount: {
    width: 18,
    fontSize: typography.label,
    fontWeight: "600",
    color: c.slate[900],
  },
  bandTrack: {
    flex: 1,
    flexDirection: "row",
  },
  bandShare: {
    width: 38,
    textAlign: "right",
    fontSize: typography.label,
    color: c.slate[600],
  },

  /* roster */
  member: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  memberHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  memberText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  memberName: {
    fontSize: typography.title,
    fontWeight: "700",
    color: c.slate[900],
    flexShrink: 1,
  },
  attention: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radii.sm,
    backgroundColor: c.rose[50],
    borderWidth: 1,
    borderColor: c.rose[200],
  },
  attentionText: {
    fontSize: typography.caption,
    fontWeight: "600",
    color: c.rose[600],
  },
  memberSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  memberRole: {
    fontSize: typography.caption,
    fontWeight: "600",
    color: c.slate[500],
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  memberBand: {
    fontSize: typography.caption,
    color: c.slate[600],
  },
  memberProgress: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  memberPercent: {
    width: 42,
    textAlign: "right",
    fontSize: typography.label,
    color: c.slate[600],
  },
  memberStats: {
    flexDirection: "row",
  },
  memberStat: {
    flex: 1,
  },
  memberStatMid: {
    alignItems: "center",
  },
  memberStatEnd: {
    alignItems: "flex-end",
  },
  memberStatValue: {
    fontSize: typography.title,
    fontWeight: "700",
    color: c.slate[900],
  },
  valueDone: {
    color: c.emerald[600],
  },
  valueOverdue: {
    color: c.rose[600],
  },
  memberStatLabel: {
    fontSize: typography.caption,
    color: c.slate[500],
  },
}));
