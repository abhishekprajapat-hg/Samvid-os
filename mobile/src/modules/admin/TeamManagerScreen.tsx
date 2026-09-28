import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import { AppSheet } from "../../components/ui/Overlay";
import { useAuth } from "../../context/AuthContext";
import { getDailyAttendanceForAdmin } from "../../services/attendanceService";
import { getAllLeads } from "../../services/leadService";
import { getTasks } from "../../services/taskService";
import {
  createUserDeleteRequest,
  deleteUser,
  getUsers,
  rebalanceExecutives,
  updateChannelPartnerInventoryAccess,
  updateUserById,
} from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import {
  STATUS_LABELS,
  avatarTone,
  statusTone,
  initialsOf,
  isPendingInvite,
  roleLabelOf,
  statusOf,
  teamTone,
  teamsOf,
  type MemberStatus,
  type TeamMember,
} from "./teamVocab";

/*
 * The team, drawn to the comp.
 *
 * One list of people with four ways to narrow it: the status chips across the
 * top, the search box, and the three selects under the tiles. They compose -
 * picking "Invited" and then a team shows the invited people on that team -
 * and all four work on what has already been fetched, because the users route
 * returns the whole company rather than a page at a time.
 *
 * "Team" here is the `department` field. There is no separate team record to
 * manage, so the Teams card is a grouping of that field and tapping a row
 * filters by it.
 */

const STATUS_TABS: Array<{ key: "ALL" | MemberStatus; label: string }> = [
  { key: "ALL", label: "All Members" },
  { key: "ACTIVE", label: "Active" },
  { key: "INVITED", label: "Invited" },
  { key: "OFF", label: "Deactivated" },
];

const ADMIN_ROLES = new Set(["ADMIN"]);

const idOf = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String((value as { _id?: string })._id || "");
};

/* ------------------------------------------------------------- pieces -- */

const StatTile = ({
  icon,
  tint,
  color,
  valueColor,
  label,
  value,
}: {
  icon: GlyphName;
  tint: string;
  color: string;
  valueColor?: string;
  label: string;
  value: string;
}) => (
  <View style={styles.statTile}>
    <View style={[styles.statIcon, { backgroundColor: tint }]}>
      <Glyph name={icon} size={15} color={color} />
    </View>
    <Text style={styles.statLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={[styles.statValue, { color: valueColor || color }]} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const Avatar = ({ member, status }: { member: TeamMember; status: MemberStatus }) => {
  const tone = avatarTone(member.name);
  const photo = String(member.profileImageUrl || "").trim();
  return (
    <View style={styles.avatarWrap}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.avatarImage} />
      ) : (
        <View style={[styles.avatarImage, { backgroundColor: tone.bg }]}>
          <Text style={[styles.avatarText, { color: tone.fg }]}>{initialsOf(member.name)}</Text>
        </View>
      )}
      <View style={[styles.presence, { backgroundColor: statusTone(status).dot }]} />
    </View>
  );
};

const SelectChip = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <Pressable
    style={[styles.select, active && styles.selectOn]}
    onPress={onPress}
    accessibilityRole="button"
  >
    <Text style={[styles.selectLabel, active && styles.selectLabelOn]} numberOfLines={1}>
      {label}
    </Text>
    <Glyph name="chevron-down" size={15} color={active ? brand.primary : brand.textSecondary} />
  </Pressable>
);

/* ------------------------------------------------------------- screen -- */

export const TeamManagerScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { role, user } = useAuth();
  const isAdmin = ADMIN_ROLES.has(String(role || "").toUpperCase());
  const myId = String(user?._id || (user as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [today, setToday] = useState<Record<string, { status?: string; onBreak?: boolean }>>({});
  const [leadLoad, setLeadLoad] = useState<Record<string, number>>({});
  const [taskLoad, setTaskLoad] = useState<Record<string, number>>({});

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"ALL" | MemberStatus>("ALL");
  const [roleFilter, setRoleFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | MemberStatus>("");

  const [picker, setPicker] = useState<"" | "ROLE" | "TEAM" | "STATUS" | "FILTERS" | "TEAMS">("");
  const [actionMember, setActionMember] = useState<TeamMember | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      const [userPayload, leadRows, taskRows, roster] = await Promise.all([
        getUsers(),
        getAllLeads().catch(() => []),
        getTasks().catch(() => []),
        /*
         * Today's roster needs the attendance grant. Without it the list still
         * works - everybody active simply reads as active, which is the truth
         * the app can see rather than a guess about who is on a break.
         */
        getDailyAttendanceForAdmin().catch(() => null),
      ]);

      setMembers((userPayload?.users || []) as TeamMember[]);

      const leads: Record<string, number> = {};
      for (const lead of Array.isArray(leadRows) ? leadRows : []) {
        const owner = idOf((lead as { assignedTo?: unknown }).assignedTo);
        if (!owner) continue;
        const status = String((lead as { status?: string }).status || "");
        if (status === "CLOSED" || status === "LOST") continue;
        leads[owner] = (leads[owner] || 0) + 1;
      }
      setLeadLoad(leads);

      const tasks: Record<string, number> = {};
      for (const task of Array.isArray(taskRows) ? taskRows : []) {
        const owner = idOf((task as { assignedTo?: unknown }).assignedTo);
        if (!owner) continue;
        if (String((task as { status?: string }).status || "") === "COMPLETED") continue;
        tasks[owner] = (tasks[owner] || 0) + 1;
      }
      setTaskLoad(tasks);

      const roll: Record<string, { status?: string; onBreak?: boolean }> = {};
      for (const row of roster?.attendance || []) {
        const owner = idOf((row as { user?: unknown }).user);
        if (!owner) continue;
        roll[owner] = { status: row.status, onBreak: row.onBreak };
      }
      setToday(roll);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load the team"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  /* ----------------------------------------------------------- derived -- */

  const statusById = useMemo(() => {
    const map = new Map<string, MemberStatus>();
    for (const member of members) {
      const id = String(member._id || "");
      map.set(id, statusOf(member, today[id]));
    }
    return map;
  }, [members, today]);

  const counts = useMemo(() => {
    let active = 0;
    let invited = 0;
    let off = 0;
    let leave = 0;
    for (const member of members) {
      const status = statusById.get(String(member._id || "")) || "ACTIVE";
      if (status === "OFF") off += 1;
      else if (status === "INVITED") invited += 1;
      else if (status === "LEAVE") leave += 1;
      else active += 1;
    }
    return { total: members.length, active, invited, off, leave };
  }, [members, statusById]);

  const roleOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const member of members) {
      const label = roleLabelOf(member);
      if (label) seen.set(label, label);
    }
    return [...seen.keys()].sort((a, b) => a.localeCompare(b));
  }, [members]);

  const teams = useMemo(() => teamsOf(members), [members]);

  const visible = useMemo(() => {
    const key = query.trim().toLowerCase();
    return members.filter((member) => {
      const status = statusById.get(String(member._id || "")) || "ACTIVE";

      if (tab === "ACTIVE" && status !== "ACTIVE" && status !== "BREAK") return false;
      if (tab === "INVITED" && status !== "INVITED") return false;
      if (tab === "OFF" && status !== "OFF") return false;

      if (statusFilter && status !== statusFilter) return false;
      if (roleFilter && roleLabelOf(member) !== roleFilter) return false;
      if (teamFilter && String(member.department || "") !== teamFilter) return false;

      if (!key) return true;
      return [member.name, member.email, member.phone, member.employeeId, member.department]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(key));
    });
  }, [members, statusById, tab, statusFilter, roleFilter, teamFilter, query]);

  const activeFilterCount =
    (roleFilter ? 1 : 0) + (teamFilter ? 1 : 0) + (statusFilter ? 1 : 0);

  /* ----------------------------------------------------------- actions -- */

  const setActive = async (member: TeamMember, next: boolean) => {
    const id = String(member._id || "");
    if (!id) return;
    setBusy(true);
    try {
      await updateUserById(id, { isActive: next });
      setActionMember(null);
      await load(true);
    } catch (e) {
      Alert.alert("Could not save", toErrorMessage(e, "Failed to update the member"));
    } finally {
      setBusy(false);
    }
  };

  const removeMember = (member: TeamMember) => {
    const id = String(member._id || "");
    if (!id) return;
    Alert.alert(
      isAdmin ? "Remove member" : "Request removal",
      isAdmin
        ? `${member.name} will lose access immediately.`
        : `An admin will be asked to remove ${member.name}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isAdmin ? "Remove" : "Request",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              if (isAdmin) await deleteUser(id);
              else await createUserDeleteRequest(id, { reason: "Removed from the team screen" });
              setActionMember(null);
              await load(true);
            } catch (e) {
              Alert.alert("Could not remove", toErrorMessage(e, "Failed to remove the member"));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const rebalance = async () => {
    setPicker("");
    setBusy(true);
    try {
      await rebalanceExecutives();
      await load(true);
      Alert.alert("Rebalanced", "Executives have been spread across the managers.");
    } catch (e) {
      Alert.alert("Could not rebalance", toErrorMessage(e, "Failed to rebalance"));
    } finally {
      setBusy(false);
    }
  };

  const togglePartnerInventory = async (member: TeamMember) => {
    const id = String(member._id || "");
    if (!id) return;
    const next = !Boolean(member.canViewInventory);
    setBusy(true);
    try {
      await updateChannelPartnerInventoryAccess(id, next);
      setActionMember(null);
      await load(true);
      Alert.alert("Inventory access updated", next ? "This partner can now open Inventory and Projects." : "Inventory and Projects are now hidden from this partner.");
    } catch (e) {
      Alert.alert("Could not save", toErrorMessage(e, "Failed to update channel partner inventory access"));
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------------------------------------ render -- */

  const renderMember = ({ item, index }: { item: TeamMember; index: number }) => {
    const id = String(item._id || "");
    const status = statusById.get(id) || "ACTIVE";
    const tone = statusTone(status);
    const invited = isPendingInvite(item);

    return (
      <Pressable
        style={[styles.memberRow, index > 0 && styles.memberRowDivided]}
        onPress={() => navigation.navigate("MemberDetails", { userId: id })}
        accessibilityRole="button"
        accessibilityLabel={`${item.name} details`}
      >
        <Avatar member={item} status={status} />

        <View style={styles.memberBody}>
          <View style={styles.memberHead}>
            <Text style={styles.memberName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.roleChip}>
              <Text style={styles.roleChipText} numberOfLines={1}>
                {roleLabelOf(item)}
              </Text>
            </View>
          </View>

          <Text style={styles.memberEmail} numberOfLines={1}>
            {item.email || "—"}
          </Text>

          {invited ? (
            <View style={styles.metaRow}>
              <Glyph name="mail-outline" size={14} color={brand.textSecondary} />
              <Text style={styles.metaText}>Invitation pending</Text>
            </View>
          ) : (
            <View style={styles.metaRow}>
              <Glyph name="person-outline" size={14} color={brand.textSecondary} />
              <Text style={styles.metaText}>{`${leadLoad[id] || 0} leads`}</Text>
              <View style={styles.metaDivider} />
              <Glyph name="checkbox-outline" size={14} color={brand.textSecondary} />
              <Text style={styles.metaText}>{`${taskLoad[id] || 0} tasks`}</Text>
            </View>
          )}
        </View>

        <View style={styles.memberTail}>
          <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: tone.dot }]} />
            <Text style={[styles.statusText, { color: tone.fg }]} numberOfLines={1}>
              {STATUS_LABELS[status]}
            </Text>
          </View>
          <Pressable
            onPress={() => setActionMember(item)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`${item.name} actions`}
          >
            <Glyph name="ellipsis-horizontal" size={19} color={brand.textSecondary} />
          </Pressable>
          <Glyph name="chevron-forward" size={17} color={brand.placeholder} />
        </View>
      </Pressable>
    );
  };

  const header = (
    <>
      <View style={styles.searchBox}>
        <Glyph name="search" size={18} color={brand.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search team members..."
          placeholderTextColor={brand.placeholder}
          returnKeyType="search"
          autoCapitalize="none"
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <Glyph name="close-circle" size={17} color={brand.placeholder} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.tabRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {STATUS_TABS.map((entry) => {
            const active = tab === entry.key;
            const count =
              entry.key === "ALL"
                ? counts.total
                : entry.key === "ACTIVE"
                  ? counts.active
                  : entry.key === "INVITED"
                    ? counts.invited
                    : counts.off;
            return (
              <Pressable
                key={entry.key}
                style={[styles.tab, active && styles.tabOn]}
                onPress={() => setTab(entry.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelOn]}>{entry.label}</Text>
                <View style={[styles.tabCount, active && styles.tabCountOn]}>
                  <Text style={[styles.tabCountText, active && styles.tabCountTextOn]}>{count}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.statRow}>
        <StatTile icon="people" tint={brand.tintSoft} color={brand.deep} label="Total Members" value={String(counts.total)} />
        <StatTile icon="radio-button-on" tint={brand.tintSoft} color={brand.deep} label="Active Today" value={String(counts.active)} />
        {/* The first two counts are green in the comp; the last two are ink. */}
        <StatTile icon="time-outline" tint={brand.warnTint} color="#d67912" valueColor={brand.text} label="On Leave" value={String(counts.leave)} />
        <StatTile icon="mail-outline" tint={brand.infoTint} color={brand.infoInk} valueColor={brand.text} label="Pending Invites" value={String(counts.invited)} />
      </View>

      <View style={styles.selectRow}>
        <SelectChip label={roleFilter || "All Roles"} active={Boolean(roleFilter)} onPress={() => setPicker("ROLE")} />
        <SelectChip label={teamFilter || "All Teams"} active={Boolean(teamFilter)} onPress={() => setPicker("TEAM")} />
        <SelectChip
          label={statusFilter ? STATUS_LABELS[statusFilter] : "Status"}
          active={Boolean(statusFilter)}
          onPress={() => setPicker("STATUS")}
        />
      </View>

      {error ? (
        <Pressable style={styles.banner} onPress={() => load()} accessibilityRole="button">
          <Text style={styles.bannerText}>{error}</Text>
        </Pressable>
      ) : null}

      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Team Members</Text>
        {visible.length === 0 ? (
          <Text style={styles.empty}>No one matches these filters.</Text>
        ) : null}
      </View>
    </>
  );

  const footer = (
    <>
      {teams.length ? (
        <View style={styles.teamsCard}>
          <Text style={styles.listTitle}>Teams</Text>
          {teams.map((team, index) => {
            const tone = teamTone(index);
            return (
              <Pressable
                key={team.name}
                style={styles.teamRow}
                onPress={() => setTeamFilter(teamFilter === team.name ? "" : team.name)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${team.name}`}
              >
                <View style={[styles.teamIcon, { backgroundColor: tone.bg }]}>
                  <Glyph name="people" size={15} color={tone.fg} />
                </View>
                <Text style={styles.teamName} numberOfLines={1}>
                  {team.name}
                </Text>
                <Text style={styles.teamCount}>
                  {`${team.count} member${team.count === 1 ? "" : "s"}`}
                </Text>
                <Glyph name="chevron-forward" size={17} color={brand.placeholder} />
              </Pressable>
            );
          })}

          <Pressable
            style={styles.manageBtn}
            onPress={() => setPicker("TEAMS")}
            accessibilityRole="button"
          >
            <Text style={styles.manageText}>Manage teams</Text>
            <Glyph name="arrow-forward" size={16} color={brand.primary} />
          </Pressable>
        </View>
      ) : null}
    </>
  );

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
      <View style={styles.header}>
        <Text style={styles.pageTitle} numberOfLines={1}>
          Team
        </Text>
        <Text style={styles.pageSubtitle}>Manage members and access</Text>

        <View style={styles.headerActions}>
          <Pressable
            style={[styles.iconBtn, activeFilterCount > 0 && styles.iconBtnOn]}
            onPress={() => setPicker("FILTERS")}
            accessibilityRole="button"
            accessibilityLabel={activeFilterCount ? `Filters, ${activeFilterCount} applied` : "Filters"}
          >
            <Glyph name="filter" size={19} color={activeFilterCount ? brand.primary : brand.text} />
          </Pressable>

          <Pressable
            style={styles.addBtn}
            onPress={() => navigation.navigate("AddTeamMember")}
            accessibilityRole="button"
          >
            <Glyph name="add" size={19} color={brand.onPrimary} />
            <Text style={styles.addBtnText}>Add Member</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => String(item._id || item.email || item.name)}
        renderItem={renderMember}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 26 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={brand.primary} />
        }
        /* The rows are the card's contents, so the card's walls are drawn around
           them rather than around each one. */
        style={styles.list}
        CellRendererComponent={({ children, ...rest }) => (
          <View {...rest} style={styles.memberCell}>
            {children}
          </View>
        )}
      />

      {/* ---- the row's kebab ---- */}
      <AppSheet
        visible={Boolean(actionMember)}
        onClose={() => setActionMember(null)}
        title={actionMember?.name || "Member"}
      >
        <Pressable
          style={styles.sheetRow}
          onPress={() => {
            const id = String(actionMember?._id || "");
            setActionMember(null);
            navigation.navigate("MemberDetails", { userId: id });
          }}
          accessibilityRole="button"
        >
          <Glyph name="person-circle-outline" size={19} color={brand.textSecondary} />
          <Text style={styles.sheetLabel}>Open member</Text>
        </Pressable>

        <Pressable
          style={styles.sheetRow}
          onPress={() => {
            const id = String(actionMember?._id || "");
            setActionMember(null);
            navigation.navigate("UserDetails", { userId: id });
          }}
          accessibilityRole="button"
        >
          <Glyph name="create-outline" size={19} color={brand.textSecondary} />
          <Text style={styles.sheetLabel}>Edit details</Text>
        </Pressable>

        {actionMember && String(actionMember.role || "").toUpperCase() === "CHANNEL_PARTNER" ? (
          <Pressable
            style={styles.sheetRow}
            onPress={() => togglePartnerInventory(actionMember)}
            disabled={busy}
            accessibilityRole="switch"
            accessibilityState={{ checked: Boolean(actionMember.canViewInventory) }}
          >
            <Glyph name="business-outline" size={19} color={brand.textSecondary} />
            <Text style={styles.sheetLabel}>Inventory access</Text>
            <Text style={styles.sheetValue}>{actionMember.canViewInventory ? "On" : "Off"}</Text>
          </Pressable>
        ) : null}

        {actionMember && String(actionMember._id || "") !== myId ? (
          <>
            <Pressable
              style={styles.sheetRow}
              onPress={() => setActive(actionMember, actionMember.isActive === false)}
              disabled={busy}
              accessibilityRole="button"
            >
              <Glyph
                name={actionMember.isActive === false ? "play-circle-outline" : "pause-circle-outline"}
                size={19}
                color={brand.textSecondary}
              />
              <Text style={styles.sheetLabel}>
                {actionMember.isActive === false ? "Reactivate" : "Deactivate"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.sheetRow}
              onPress={() => removeMember(actionMember)}
              disabled={busy}
              accessibilityRole="button"
            >
              <Glyph name="trash-outline" size={19} color={brand.alert} />
              <Text style={[styles.sheetLabel, { color: brand.alert }]}>
                {isAdmin ? "Remove from company" : "Request removal"}
              </Text>
            </Pressable>
          </>
        ) : null}
      </AppSheet>

      {/* ---- the three selects, and the header's funnel ---- */}
      <AppSheet visible={picker === "ROLE"} onClose={() => setPicker("")} title="Role">
        {["", ...roleOptions].map((option) => (
          <Pressable
            key={option || "all"}
            style={styles.sheetOption}
            onPress={() => {
              setRoleFilter(option);
              setPicker("");
            }}
            accessibilityRole="button"
          >
            <Text style={styles.sheetLabel}>{option || "All Roles"}</Text>
            {roleFilter === option ? <Glyph name="checkmark" size={18} color={brand.primary} /> : null}
          </Pressable>
        ))}
      </AppSheet>

      <AppSheet visible={picker === "TEAM"} onClose={() => setPicker("")} title="Team">
        {["", ...teams.map((team) => team.name)].map((option) => (
          <Pressable
            key={option || "all"}
            style={styles.sheetOption}
            onPress={() => {
              setTeamFilter(option);
              setPicker("");
            }}
            accessibilityRole="button"
          >
            <Text style={styles.sheetLabel}>{option || "All Teams"}</Text>
            {teamFilter === option ? <Glyph name="checkmark" size={18} color={brand.primary} /> : null}
          </Pressable>
        ))}
      </AppSheet>

      <AppSheet visible={picker === "STATUS"} onClose={() => setPicker("")} title="Status">
        {(["", "ACTIVE", "BREAK", "LEAVE", "INVITED", "OFF"] as const).map((option) => (
          <Pressable
            key={option || "any"}
            style={styles.sheetOption}
            onPress={() => {
              setStatusFilter(option as "" | MemberStatus);
              setPicker("");
            }}
            accessibilityRole="button"
          >
            <Text style={styles.sheetLabel}>{option ? STATUS_LABELS[option] : "Any status"}</Text>
            {statusFilter === option ? <Glyph name="checkmark" size={18} color={brand.primary} /> : null}
          </Pressable>
        ))}
      </AppSheet>

      <AppSheet visible={picker === "FILTERS"} onClose={() => setPicker("")} title="Filters">
        <Pressable style={styles.sheetRow} onPress={() => setPicker("ROLE")} accessibilityRole="button">
          <Glyph name="ribbon-outline" size={19} color={brand.textSecondary} />
          <Text style={styles.sheetLabel}>Role</Text>
          <Text style={styles.sheetValue}>{roleFilter || "All"}</Text>
        </Pressable>
        <Pressable style={styles.sheetRow} onPress={() => setPicker("TEAM")} accessibilityRole="button">
          <Glyph name="people-outline" size={19} color={brand.textSecondary} />
          <Text style={styles.sheetLabel}>Team</Text>
          <Text style={styles.sheetValue}>{teamFilter || "All"}</Text>
        </Pressable>
        <Pressable style={styles.sheetRow} onPress={() => setPicker("STATUS")} accessibilityRole="button">
          <Glyph name="ellipse-outline" size={19} color={brand.textSecondary} />
          <Text style={styles.sheetLabel}>Status</Text>
          <Text style={styles.sheetValue}>{statusFilter ? STATUS_LABELS[statusFilter] : "Any"}</Text>
        </Pressable>
        <Pressable
          style={styles.sheetRow}
          onPress={() => {
            setRoleFilter("");
            setTeamFilter("");
            setStatusFilter("");
            setPicker("");
          }}
          accessibilityRole="button"
        >
          <Glyph name="refresh-outline" size={19} color={brand.primary} />
          <Text style={[styles.sheetLabel, { color: brand.primary }]}>Clear all</Text>
        </Pressable>
      </AppSheet>

      {/* ---- "Manage teams" ---- */}
      <AppSheet visible={picker === "TEAMS"} onClose={() => setPicker("")} title="Manage teams">
        <Text style={styles.sheetNote}>
          A team is the department on each person&apos;s record. Open a member to move them.
        </Text>
        {teams.map((team, index) => (
          <Pressable
            key={team.name}
            style={styles.sheetRow}
            onPress={() => {
              setTeamFilter(team.name);
              setPicker("");
            }}
            accessibilityRole="button"
          >
            <View style={[styles.teamIcon, { backgroundColor: teamTone(index).bg }]}>
              <Glyph name="people" size={14} color={teamTone(index).fg} />
            </View>
            <Text style={styles.sheetLabel}>{team.name}</Text>
            <Text style={styles.sheetValue}>{`${team.count}`}</Text>
          </Pressable>
        ))}

        <Pressable
          style={styles.sheetRow}
          onPress={() => {
            setPicker("");
            navigation.navigate("RolesPermissions");
          }}
          accessibilityRole="button"
        >
          <Glyph name="lock-closed-outline" size={19} color={brand.textSecondary} />
          <Text style={styles.sheetLabel}>Roles &amp; permissions</Text>
          <Glyph name="chevron-forward" size={17} color={brand.placeholder} />
        </Pressable>

        {isAdmin ? (
          <Pressable style={styles.sheetRow} onPress={rebalance} disabled={busy} accessibilityRole="button">
            <Glyph name="git-compare-outline" size={19} color={brand.textSecondary} />
            <Text style={styles.sheetLabel}>Rebalance executives</Text>
          </Pressable>
        ) : null}
      </AppSheet>
    </SafeAreaView>
  );
};

export default TeamManagerScreen;

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
    list: {
      flex: 1,
    },

    /* ---- page header ---- */
    header: {
      paddingHorizontal: layout.pageGutter,
      paddingTop: 8,
      paddingBottom: 12,
    },
    pageTitle: {
      width: "52%",
      fontSize: t.pageTitle,
      lineHeight: 31,
      fontWeight: "700",
      letterSpacing: -0.8,
      color: b.text,
    },
    pageSubtitle: {
      marginTop: 1,
      fontSize: t.cardTitle,
      lineHeight: 18,
      color: b.textMuted,
    },
    headerActions: {
      position: "absolute",
      right: layout.pageGutter,
      top: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    iconBtn: {
      width: 37,
      height: 36,
      borderRadius: round.field,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: b.border,
      backgroundColor: b.surface,
    },
    iconBtnOn: {
      borderColor: b.greenBright,
      backgroundColor: b.tint,
    },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      height: 36,
      paddingHorizontal: 14,
      borderRadius: round.field,
      backgroundColor: "#008561",
    },
    addBtnText: {
      fontSize: t.cardTitle,
      fontWeight: "700",
      color: b.onPrimary,
    },

    body: {
      paddingHorizontal: layout.pageGutter,
    },

    /* ---- search ---- */
    searchBox: {
      height: 36,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 0,
      fontSize: t.cardTitle,
      color: b.text,
    },

    /* ---- status tabs ---- */
    tabRowWrap: {
      marginTop: 11,
      marginHorizontal: -layout.pageGutter,
    },
    tabRow: {
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: layout.pageGutter,
    },
    tab: {
      height: 31,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 9,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    tabOn: {
      borderColor: b.greenBright,
      backgroundColor: b.chipActiveBg,
    },
    tabLabel: {
      fontSize: t.cardTitle,
      fontWeight: "500",
      color: b.text,
    },
    tabLabelOn: {
      fontWeight: "700",
      color: b.deep,
    },
    tabCount: {
      minWidth: 21,
      height: 20,
      paddingHorizontal: 4,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round.pill,
      backgroundColor: b.hairline,
    },
    tabCountOn: {
      backgroundColor: b.chipActiveCount,
    },
    tabCountText: {
      fontSize: t.tagline,
      fontWeight: "700",
      color: b.textSecondary,
    },
    tabCountTextOn: {
      color: b.onPrimary,
    },

    /* ---- stat tiles ---- */
    statRow: {
      marginTop: 10,
      flexDirection: "row",
      gap: 7,
    },
    statTile: {
      flex: 1,
      minWidth: 0,
      /* 9, not the measured 12: at 12 the fourth label is a point wider than
         the box and reads "Pending Inv...". */
      paddingHorizontal: 9,
      paddingTop: 5,
      paddingBottom: 5,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    statIcon: {
      width: 28,
      height: 28,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    statLabel: {
      marginTop: 4,
      fontSize: t.tagline,
      lineHeight: 13,
      color: b.textSecondary,
    },
    statValue: {
      marginTop: 0,
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "700",
      letterSpacing: -0.5,
    },

    /* ---- the three selects ---- */
    selectRow: {
      marginTop: 11,
      flexDirection: "row",
      gap: 9,
    },
    select: {
      flex: 1,
      minWidth: 0,
      height: 32,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    selectOn: {
      borderColor: b.greenBright,
      backgroundColor: b.tint,
    },
    selectLabel: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: t.rowTitle,
      fontWeight: "500",
      color: b.text,
    },
    selectLabelOn: {
      fontWeight: "700",
      color: b.deep,
    },

    banner: {
      marginTop: 11,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: b.alert,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    bannerText: {
      fontSize: t.body,
      lineHeight: 17,
      color: b.alert,
    },

    /* ---- the members card ----
       Drawn in three parts so the rows can be a FlatList: the head carries the
       card's top and its title, every cell carries its two walls, and the
       Teams card below closes it off. */
    listCard: {
      marginTop: 15,
      paddingHorizontal: 12,
      paddingTop: 13,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: b.border,
      borderTopLeftRadius: round.panel,
      borderTopRightRadius: round.panel,
      backgroundColor: b.surface,
    },
    listTitle: {
      fontSize: 16,
      lineHeight: 21,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: b.text,
    },
    empty: {
      paddingVertical: 18,
      fontSize: t.body,
      color: b.textMuted,
    },
    memberCell: {
      paddingHorizontal: 12,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: b.border,
      backgroundColor: b.surface,
    },

    /* ---- a member row ---- */
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingVertical: 7,
    },
    memberRowDivided: {
      borderTopWidth: 1,
      borderTopColor: b.hairline,
    },
    avatarWrap: {
      width: 44,
      height: 44,
    },
    avatarImage: {
      width: 44,
      height: 44,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: t.rowTitle,
      fontWeight: "700",
    },
    presence: {
      position: "absolute",
      right: 0,
      bottom: 1,
      width: 13,
      height: 13,
      borderRadius: round.pill,
      borderWidth: 2,
      borderColor: b.surface,
    },
    memberBody: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    memberHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    memberName: {
      /* The name takes the room first and the role chip beside it gives way:
         a cut surname reads worse than a cut job title. */
      flexShrink: 0.4,
      minWidth: 0,
      fontSize: 11.5,
      lineHeight: 15,
      fontWeight: "700",
      letterSpacing: -0.2,
      color: b.text,
    },
    roleChip: {
      flexShrink: 2,
      minWidth: 0,
      maxWidth: "52%",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: round.pill,
      backgroundColor: b.tintBadge,
    },
    roleChipText: {
      fontSize: 8.5,
      lineHeight: 12,
      fontWeight: "600",
      color: b.deep,
    },
    memberEmail: {
      fontSize: 9,
      lineHeight: 13,
      color: b.textMuted,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    metaText: {
      fontSize: 9.5,
      color: b.textSecondary,
    },
    metaDivider: {
      width: 1,
      height: 11,
      marginHorizontal: 4,
      backgroundColor: b.border,
    },
    memberTail: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: round.pill,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: round.pill,
    },
    statusText: {
      fontSize: 12.5,
      fontWeight: "700",
    },

    /* ---- the teams card ---- */
    teamsCard: {
      paddingHorizontal: 12,
      paddingTop: 13,
      paddingBottom: 12,
      borderWidth: 1,
      borderTopWidth: 0,
      borderColor: b.border,
      borderBottomLeftRadius: round.panel,
      borderBottomRightRadius: round.panel,
      backgroundColor: b.surface,
      marginBottom: 14,
    },
    teamRow: {
      marginTop: 4,
      height: 29,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
    },
    teamIcon: {
      width: 25,
      height: 25,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    teamName: {
      flex: 1,
      minWidth: 0,
      fontSize: 10.5,
      fontWeight: "700",
      color: b.text,
    },
    teamCount: {
      fontSize: t.tagline,
      color: b.textMuted,
    },
    manageBtn: {
      marginTop: 12,
      height: 28,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: round.field,
      backgroundColor: b.tintSoft,
    },
    manageText: {
      fontSize: t.cardTitle,
      fontWeight: "700",
      color: b.primary,
    },

    /* ---- sheets ---- */
    sheetRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: b.hairline,
    },
    sheetOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: b.hairline,
    },
    sheetLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: t.field,
      color: b.text,
    },
    sheetValue: {
      fontSize: t.body,
      color: b.textMuted,
    },
    sheetNote: {
      paddingBottom: 10,
      fontSize: t.body,
      lineHeight: 17,
      color: b.textMuted,
    },
  }),
);
