import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Icon } from "../../../components/ui/Icon";
import { radii, spacing, typography } from "../../../theme/tokens";
import { themedStyles, themePalette } from "../../../theme/themedStyles";
import { avatarTint, initialsOf, type ChipTone } from "../taskConstants";

/*
 * The parts every Tasks view repeats: the stat grid at the top, the two chip
 * shapes, a person's initial badge, a progress bar and the meta line.
 *
 * They live together because the comps reuse them across four tabs, a board
 * and a details page, and the alternative was the same twelve-line block
 * pasted six times with the padding drifting.
 */

/* ------------------------------------------------------------- stat tiles -- */

export type StatTile = {
  label: string;
  value: string;
  icon: string;
  tint: string;
  color: string;
  /** Overdue draws its number in red; the rest stay in body ink. */
  emphasis?: "danger" | "success" | "warning";
};

const emphasisColor = (emphasis?: StatTile["emphasis"]) => {
  const c = themePalette;
  if (emphasis === "danger") return c.rose[600];
  if (emphasis === "success") return c.emerald[600];
  if (emphasis === "warning") return c.amber[700];
  return c.slate[900];
};

const Tile = ({ tile, style }: { tile: StatTile; style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.tile, style]}>
    <View style={[styles.tileIcon, { backgroundColor: tile.tint }]}>
      <Icon name={tile.icon} size={18} color={tile.color} />
    </View>
    <View style={styles.tileText}>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {tile.label}
      </Text>
      <Text style={[styles.tileValue, { color: emphasisColor(tile.emphasis) }]} numberOfLines={1}>
        {tile.value}
      </Text>
    </View>
  </View>
);

/*
 * Five tiles, three on the first row and two on the second - the shape every
 * comp uses. A different count still lays out: the first three fill row one
 * and whatever is left shares row two.
 */
export const StatGrid = ({ tiles }: { tiles: StatTile[] }) => {
  const top = tiles.slice(0, 3);
  const bottom = tiles.slice(3);
  return (
    <View style={styles.statGrid}>
      <View style={styles.statRow}>
        {top.map((tile) => (
          <Tile key={tile.label} tile={tile} style={styles.tileFlex} />
        ))}
      </View>
      {bottom.length ? (
        <View style={styles.statRow}>
          {bottom.map((tile, index) => (
            <Tile
              key={tile.label}
              tile={tile}
              /* The comp gives the second tile on this row the wider share. */
              style={index === 1 && bottom.length === 2 ? styles.tileWide : styles.tileFlex}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
};

/* ------------------------------------------------------------------ chips -- */

export const ToneChip = ({ tone }: { tone: ChipTone }) => (
  <View style={[styles.chip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
    <Text style={[styles.chipText, { color: tone.color }]}>{tone.label}</Text>
  </View>
);

/** The dot-plus-label form the My Task rows use instead of a filled chip. */
export const DotLabel = ({ color, label }: { color: string; label: string }) => (
  <View style={styles.metaItem}>
    <View style={[styles.dot, { backgroundColor: color }]} />
    <Text style={styles.metaText}>{label}</Text>
  </View>
);

export const MetaItem = ({
  icon,
  label,
  tone,
}: {
  icon: string;
  label: string;
  tone?: "danger" | "muted";
}) => {
  const color = tone === "danger" ? themePalette.rose[600] : themePalette.slate[500];
  return (
    <View style={styles.metaItem}>
      <Icon name={icon} size={13} color={color} />
      <Text style={[styles.metaText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

/* ----------------------------------------------------------------- people -- */

export const Avatar = ({ name, size = 28 }: { name: string; size?: number }) => {
  const tint = avatarTint(name);
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tint.bg },
      ]}
    >
      <Text style={[styles.avatarText, { color: tint.fg, fontSize: size * 0.36 }]}>
        {initialsOf(name)}
      </Text>
    </View>
  );
};

export const PersonMeta = ({ name }: { name: string }) =>
  name ? (
    <View style={styles.metaItem}>
      <Avatar name={name} size={22} />
      <Text style={styles.metaText} numberOfLines={1}>
        {name}
      </Text>
    </View>
  ) : (
    <MetaItem icon="person-outline" label="Unassigned" />
  );

/* --------------------------------------------------------------- progress -- */

export const ProgressBar = ({
  percent,
  color,
  height = 7,
}: {
  percent: number;
  color?: string;
  height?: number;
}) => (
  <View style={[styles.track, { height, borderRadius: height / 2 }]}>
    <View
      style={{
        width: `${Math.max(0, Math.min(100, percent))}%`,
        height: "100%",
        borderRadius: height / 2,
        backgroundColor: color || themePalette.emerald[500],
      }}
    />
  </View>
);

/* ---------------------------------------------------------------- buttons -- */

/** The bordered pill the filter row is made of: label, optional value, caret. */
export const FilterPill = ({
  icon,
  label,
  active,
  onPress,
  caret = true,
  style,
}: {
  icon?: string;
  label: string;
  active?: boolean;
  onPress: () => void;
  caret?: boolean;
  style?: StyleProp<ViewStyle>;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    style={[styles.pill, active && styles.pillActive, style]}
  >
    {icon ? (
      <Icon
        name={icon}
        size={14}
        color={active ? themePalette.blue[600] : themePalette.slate[600]}
      />
    ) : null}
    <Text style={[styles.pillText, active && styles.pillTextActive]} numberOfLines={1}>
      {label}
    </Text>
    {caret ? (
      <Icon
        name="chevron-down"
        size={13}
        color={active ? themePalette.blue[600] : themePalette.slate[500]}
      />
    ) : null}
  </Pressable>
);

export const KebabButton = ({ onPress }: { onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    hitSlop={10}
    accessibilityRole="button"
    accessibilityLabel="More actions"
    style={styles.kebab}
  >
    <Icon name="ellipsis-vertical" size={16} color={themePalette.slate[500]} />
  </Pressable>
);

/** The hollow circle that marks a task done from a list row. */
export const CompleteToggle = ({
  done,
  onPress,
}: {
  done: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    hitSlop={8}
    accessibilityRole="checkbox"
    accessibilityState={{ checked: done }}
    accessibilityLabel={done ? "Mark as not complete" : "Mark as complete"}
    style={[styles.toggle, done && styles.toggleDone]}
  >
    {done ? <Icon name="checkmark" size={13} color={themePalette.emerald[700]} /> : null}
  </Pressable>
);

const styles = themedStyles((c) => StyleSheet.create({
  /* stat grid */
  statGrid: {
    gap: spacing.md,
  },
  statRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  tileFlex: {
    flex: 1,
  },
  tileWide: {
    flex: 1.45,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: {
    flex: 1,
    minWidth: 0,
  },
  tileLabel: {
    fontSize: typography.caption,
    color: c.slate[500],
  },
  tileValue: {
    marginTop: 1,
    fontSize: typography.title,
    fontWeight: "700",
    letterSpacing: -0.3,
  },

  /* chips + meta */
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  chipText: {
    fontSize: typography.caption,
    fontWeight: "600",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    maxWidth: "100%",
  },
  metaText: {
    fontSize: typography.caption,
    color: c.slate[500],
    flexShrink: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },

  /* people */
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontWeight: "700",
  },

  /* progress */
  track: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: c.slate[200],
  },

  /* buttons */
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  pillActive: {
    borderColor: c.blue[400],
    backgroundColor: c.blue[50],
  },
  pillText: {
    fontSize: typography.label,
    fontWeight: "600",
    color: c.slate[700],
    flexShrink: 1,
  },
  pillTextActive: {
    color: c.blue[600],
  },
  kebab: {
    width: 26,
    alignItems: "flex-end",
  },
  toggle: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: c.slate[300],
    alignItems: "center",
    justifyContent: "center",
  },
  toggleDone: {
    borderColor: c.emerald[500],
    backgroundColor: c.emerald[50],
  },
}));
