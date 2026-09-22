import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { Icon } from "../../components/ui/Icon";
import { Screen } from "../../components/common/Screen";
import { useAuth } from "../../context/AuthContext";
import { getAllLeads } from "../../services/leadService";
import { getInventoryAssets } from "../../services/inventoryService";
import { getUsers } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";
import { elevation, radii, spacing, typography } from "../../theme/tokens";
import { themedStyles, themePalette } from "../../theme/themedStyles";
import type { InventoryAsset, Lead, User } from "../../types";

/*
 * The mobile cut of frontend/src/modules/manager/ManagerDashboard.jsx - the
 * page ADMIN and MANAGER land on. Section for section it is the same page:
 * greeting, five KPI tiles, occupancy area chart, inventory donut, today's
 * follow-ups, pipeline snapshot, recent activity, revenue bars, upcoming
 * visits, quick actions, team footer.
 *
 * What changes is only what has to. Web lays the page out in three wide rows;
 * a phone has one column, so the rows stack and the tile grids go two-up. The
 * hex literals the web file writes inline resolve to the nearest token here,
 * per the rule in docs/mobile/01_MOBILE_DESIGN_SYSTEM.md - #f6f8fc is slate-50,
 * #1747e8 is blue-600, and so on down the file.
 */

const REFRESH_INTERVAL_MS = 30000;

type StageKey = "NEW" | "CONTACTED" | "INTERESTED" | "SITE_VISIT" | "REQUESTED" | "CLOSED";

type Stage = {
  key: StageKey;
  label: string;
  icon: string;
  color: string;
  soft: string;
};

/*
 * A function, not a constant. themePalette answers for the scheme active when
 * it is read, and a module-level array reads it once at import - when the
 * scheme is always still light.
 */
const buildStages = (): Stage[] => [
  { key: "NEW", label: "New", icon: "todo", color: themePalette.blue[500], soft: themePalette.blue[50] },
  { key: "CONTACTED", label: "Contacted", icon: "call", color: themePalette.blue[400], soft: themePalette.blue[50] },
  { key: "INTERESTED", label: "Interested", icon: "people", color: themePalette.emerald[500], soft: themePalette.emerald[50] },
  { key: "SITE_VISIT", label: "Visit", icon: "calendarDays", color: themePalette.amber[400], soft: themePalette.amber[50] },
  { key: "REQUESTED", label: "Requested", icon: "activity", color: themePalette.rose[500], soft: themePalette.rose[50] },
  { key: "CLOSED", label: "Closed", icon: "checkmark-circle-outline", color: themePalette.emerald[400], soft: themePalette.emerald[50] },
];

/* The page header strings web builds in resolveHomeHeader(). */
const HOME_SCOPE: Record<string, string> = {
  ADMIN: "Admin Command Center",
  MANAGER: "Management Command Center",
};

/*
 * Fields the API returns on a lead that the shared Lead type does not carry
 * yet - the web dashboard reads all three straight off the raw payload.
 */
type DashboardLead = Lead & {
  siteVisitDate?: string;
  dealPayment?: { amount?: number } | null;
  saleDetails?: { amount?: number } | null;
};

type DatedLead = DashboardLead & { when: Date | null };

const money = (value: number) => {
  const amount = Number(value || 0);
  return amount >= 100000 ? `₹ ${(amount / 100000).toFixed(1)}L` : `₹ ${amount.toLocaleString("en-IN")}`;
};

const dateOf = (value?: string | null) => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

const initials = (name = "") =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "NA";

const timeOf = (value: Date) => value.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

const statusLabel = (status?: string) => String(status || "").replace(/_/g, " ");

/* ---------------------------------------------------------- building blocks -- */

/*
 * Web's local <Card>: a 48px header bar with a divider under it, the title on
 * the left and an optional action on the right. Content sits flush, so each
 * section pads itself the way it wants to.
 */
const DashCard = ({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  /*
   * Web prefixes five of these titles with a glyph: 🏢 ♨ ▣ ⌁ ▥. Three of
   * those live in Unicode blocks Android has no guaranteed font for, and a
   * tofu box is a worse match for the design than the lucide mark that means
   * the same thing. So the mark is an icon here rather than a character.
   */
  icon?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <View style={styles.cardTitleWrap}>
        {icon ? <Icon name={icon} size={15} color={themePalette.slate[600]} /> : null}
        <Text style={styles.cardTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {action}
    </View>
    {children}
  </View>
);

const CardLink = ({ label = "View All", onPress }: { label?: string; onPress: () => void }) => (
  <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
    <Text style={styles.cardLink}>{label} →</Text>
  </Pressable>
);

/*
 * Web's single-option <select>. It filters nothing there either, so it reads
 * as the static label it is rather than pretending to be a picker.
 */
const RangePill = ({ label }: { label: string }) => (
  <View style={styles.rangePill}>
    <Text style={styles.rangePillText}>{label}</Text>
    <Icon name="chevron-down" size={12} color={themePalette.slate[500]} />
  </View>
);

const EmptyNote = ({ label, tall }: { label: string; tall?: boolean }) => (
  <Text style={[styles.emptyNote, tall && styles.emptyNoteTall]}>{label}</Text>
);

/*
 * The occupancy area chart. Web draws a fixed decorative path rather than
 * charting anything, so this draws the same one, stretched the same way.
 */
const OccupancyChart = () => (
  <View style={styles.occBox}>
    <View style={styles.occGrid} pointerEvents="none">
      {[0, 1, 2, 3].map((row) => (
        <View key={row} style={styles.occGridRow} />
      ))}
    </View>
    <View style={styles.occChartLayer} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 600 190" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="occupancyFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={themePalette.blue[500]} stopOpacity="0.28" />
            <Stop offset="1" stopColor={themePalette.blue[500]} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path
          d="M15 145L120 115L225 86L330 57L435 57L540 36L585 24L585 178L15 178Z"
          fill="url(#occupancyFill)"
        />
        <Path
          d="M15 145L120 115L225 86L330 57L435 57L540 36L585 24"
          fill="none"
          stroke={themePalette.blue[600]}
          strokeWidth={2}
        />
      </Svg>
    </View>
    <View style={styles.occMonths} pointerEvents="none">
      {["Apr", "May", "Jun", "Jul", "Aug", "Sep"].map((month) => (
        <Text key={month} style={styles.occMonth}>
          {month}
        </Text>
      ))}
    </View>
  </View>
);

/*
 * The inventory donut. Same trick web uses: r = 15.9155 makes the
 * circumference 100, so each slice's dash array is just its percentage.
 */
const InventoryDonut = ({
  total,
  segments,
}: {
  total: number;
  segments: Array<{ label: string; value: number; color: string }>;
}) => {
  let offset = 0;
  return (
    <View style={styles.donutWrap}>
      <Svg width={128} height={128} viewBox="0 0 42 42">
        <G rotation={-90} origin="21, 21">
          <Circle cx="21" cy="21" r="15.9155" fill="none" stroke={themePalette.border} strokeWidth={6} />
          {segments.map((segment) => {
            const share = total ? (segment.value / total) * 100 : 0;
            const slice = (
              <Circle
                key={segment.label}
                cx="21"
                cy="21"
                r="15.9155"
                fill="none"
                stroke={segment.color}
                strokeWidth={6}
                strokeDasharray={[share, 100 - share]}
                strokeDashoffset={-offset}
              />
            );
            offset += share;
            return slice;
          })}
        </G>
      </Svg>
      <View style={styles.donutCenter} pointerEvents="none">
        <Text style={styles.donutTotal}>{total}</Text>
        <Text style={styles.donutCaption}>Total Units</Text>
      </View>
    </View>
  );
};

/*
 * Revenue bars. Web's nine bars are hardcoded percentages behind a mint
 * gradient; both carry over as they are.
 */
const REVENUE_BARS = [18, 26, 38, 54, 59, 67, 78, 91, 100];
const REVENUE_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];

const RevenueChart = () => {
  const width = 330;
  const height = 176;
  const padX = 14;
  const plot = 130;
  const baseline = 146;
  const slot = (width - padX * 2) / REVENUE_BARS.length;
  const barWidth = Math.min(20, slot * 0.6);
  const barX = (index: number) => padX + index * slot + (slot - barWidth) / 2;

  return (
    <View style={styles.revenueBox}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={themePalette.emerald[200]} />
            <Stop offset="1" stopColor={themePalette.emerald[300]} />
          </LinearGradient>
        </Defs>
        {REVENUE_BARS.map((percent, index) => {
          const barHeight = (percent / 100) * plot;
          return (
            <Rect
              key={`bar-${REVENUE_MONTHS[index]}`}
              x={barX(index)}
              y={baseline - barHeight}
              width={barWidth}
              height={barHeight}
              rx={4}
              fill="url(#revenueFill)"
            />
          );
        })}
        {REVENUE_MONTHS.map((month, index) => (
          <SvgText
            key={`label-${month}`}
            x={barX(index) + barWidth / 2}
            y={baseline + 16}
            fontSize="9"
            textAnchor="middle"
            fill={themePalette.slate[500]}
          >
            {month}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
};

/* ---------------------------------------------------------------- screen -- */

export const ManagerDashboardScreen = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState<DashboardLead[]>([]);
  const [inventory, setInventory] = useState<InventoryAsset[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const load = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      const [leadRows, inventoryRows, userRows] = await Promise.all([
        getAllLeads(),
        getInventoryAssets(),
        getUsers({ pagination: "false", fields: "_id,name,role,isActive" }),
      ]);
      setLeads(Array.isArray(leadRows) ? (leadRows as DashboardLead[]) : []);
      setInventory(Array.isArray(inventoryRows) ? inventoryRows : []);
      setUsers(Array.isArray(userRows?.users) ? userRows.users : []);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load dashboard"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => load(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const summary = useMemo(() => {
    const count = (status: string) =>
      inventory.filter((asset) => String(asset.status).toUpperCase() === status).length;

    const total = inventory.length;
    const available = count("AVAILABLE");
    const blocked = count("BLOCKED");
    const maintenance = count("MAINTENANCE");
    const occupied = Math.max(total - available - blocked - maintenance, 0);

    const closed = leads.filter((lead) => String(lead.status).toUpperCase() === "CLOSED");
    const open = leads.filter((lead) => String(lead.status).toUpperCase() !== "CLOSED");
    const revenue = closed.reduce(
      (sum, lead) => sum + Number(lead?.dealPayment?.amount || lead?.saleDetails?.amount || 0),
      0,
    );

    const now = new Date();
    const follow = leads
      .map((lead): DatedLead => ({ ...lead, when: dateOf(lead.nextFollowUp) }))
      .filter((lead) => lead.when?.toDateString() === now.toDateString())
      .sort((a, b) => (a.when?.getTime() || 0) - (b.when?.getTime() || 0))
      .slice(0, 4);
    const upcoming = leads
      .map((lead): DatedLead => ({ ...lead, when: dateOf(lead.nextFollowUp || lead.siteVisitDate) }))
      .filter((lead) => !!lead.when && lead.when >= now)
      .sort((a, b) => (a.when?.getTime() || 0) - (b.when?.getTime() || 0))
      .slice(0, 3);
    const recent = [...leads]
      .sort((a, b) => (dateOf(b.updatedAt)?.getTime() || 0) - (dateOf(a.updatedAt)?.getTime() || 0))
      .slice(0, 4);

    const stages = buildStages().map((stage) => ({
      ...stage,
      value: leads.filter((lead) => String(lead.status).toUpperCase() === stage.key).length,
    }));

    return {
      total,
      available,
      blocked,
      maintenance,
      occupied,
      occupancy: total ? Math.round((occupied / total) * 100) : 0,
      closed,
      open,
      revenue,
      follow,
      upcoming,
      recent,
      stages,
    };
  }, [inventory, leads]);

  const go = useCallback(
    (screen: string, params?: Record<string, unknown>) => () => navigation.navigate(screen, params),
    [navigation],
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const stageMax = Math.max(...summary.stages.map((stage) => stage.value), 1);
  const interested = summary.stages.find((stage) => stage.key === "INTERESTED")?.value || 0;
  const activeTeam = users.filter((member) => member?.isActive !== false).length;
  const scope = HOME_SCOPE[String(user?.role || "")] || "Workspace Command Center";

  const segments = [
    { label: "Available", value: summary.available, color: themePalette.emerald[500] },
    { label: "Occupied", value: summary.occupied, color: themePalette.blue[500] },
    { label: "Blocked", value: summary.blocked, color: themePalette.amber[400] },
    { label: "Under Maintenance", value: summary.maintenance, color: themePalette.rose[500] },
  ];

  const kpis = [
    {
      label: "Total Properties",
      value: String(summary.total),
      help: "Active in portfolio",
      icon: "inventory",
      color: themePalette.blue[600],
      tint: themePalette.blue[50],
      down: false,
      onPress: go("Inventory"),
    },
    {
      label: "Total Clients",
      value: String(summary.closed.length),
      help: "Across all locations",
      icon: "people",
      color: themePalette.blue[600],
      tint: themePalette.blue[50],
      down: false,
      onPress: go("CoworkingClients"),
    },
    {
      label: "Current Occupancy",
      value: `${summary.occupancy}%`,
      help: `${summary.occupied}/${summary.total || 0} units occupied`,
      icon: "targets",
      color: themePalette.blue[600],
      tint: themePalette.blue[50],
      down: false,
      onPress: go("Inventory"),
    },
    {
      label: "Open Leads",
      value: String(summary.open.length),
      help: `${interested} interested`,
      icon: "activity",
      color: themePalette.rose[500],
      tint: themePalette.rose[50],
      down: true,
      onPress: go("Leads"),
    },
    {
      label: "Monthly Revenue",
      value: money(summary.revenue),
      help: "Expected this month",
      icon: "revenue",
      color: themePalette.emerald[500],
      tint: themePalette.emerald[50],
      down: false,
      onPress: go("Finance"),
    },
  ];

  const quickActions = [
    { label: "Add Property", icon: "inventory", tint: themePalette.blue[50], color: themePalette.blue[700], onPress: go("Inventory") },
    { label: "Add Client", icon: "addUser", tint: themePalette.emerald[50], color: themePalette.emerald[700], onPress: go("CoworkingClients") },
    { label: "Schedule Visit", icon: "calendarDays", tint: themePalette.amber[50], color: themePalette.amber[700], onPress: go("Calendar") },
    { label: "Create Task", icon: "quickAction", tint: themePalette.violet[50], color: themePalette.violet[700], onPress: go("Tasks") },
  ];

  return (
    <Screen title="Home" subtitle={scope} loading={loading} error={error} onRetry={() => load()}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <View style={styles.greeting}>
          <Text style={styles.greetingTitle}>
            {greeting}, {user?.name || "Admin"} 👋
          </Text>
          <Text style={styles.greetingSub}>Here&apos;s what&apos;s happening with your workspace today.</Text>
        </View>

        <View style={styles.tileGrid}>
          {kpis.map((kpi) => (
            <Pressable key={kpi.label} style={styles.kpiCard} onPress={kpi.onPress} accessibilityRole="button">
              <View style={[styles.kpiIcon, { backgroundColor: kpi.tint }]}>
                <Icon name={kpi.icon} size={20} color={kpi.color} />
              </View>
              <Text style={styles.kpiLabel} numberOfLines={1}>
                {kpi.label}
              </Text>
              <View style={styles.kpiValueRow}>
                <Text style={styles.kpiValue} numberOfLines={1}>
                  {kpi.value}
                </Text>
                <View style={styles.kpiTrend}>
                  <Icon
                    name={kpi.down ? "trendDown" : "trend"}
                    size={11}
                    color={kpi.down ? themePalette.rose[500] : themePalette.emerald[600]}
                  />
                  <Text style={[styles.kpiTrendText, { color: kpi.down ? themePalette.rose[500] : themePalette.emerald[600] }]}>
                    {kpi.down ? "6%" : "8%"}
                  </Text>
                </View>
              </View>
              <Text style={styles.kpiHelp} numberOfLines={1}>
                {kpi.help}
              </Text>
            </Pressable>
          ))}
        </View>

        <DashCard title="Occupancy Overview" icon="inventory" action={<RangePill label="Last 6 Months" />}>
          <OccupancyChart />
        </DashCard>

        <DashCard title="Inventory Status" icon="pieChart" action={<CardLink onPress={go("Inventory")} />}>
          <View style={styles.donutRow}>
            <InventoryDonut total={summary.total} segments={segments} />
            <View style={styles.legend}>
              {segments.map((segment) => (
                <View key={segment.label} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
                  <Text style={styles.legendLabel} numberOfLines={1}>
                    {segment.label}
                  </Text>
                  <Text style={styles.legendValue}>
                    {segment.value} ({summary.total ? Math.round((segment.value / summary.total) * 100) : 0}%)
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </DashCard>

        <DashCard title="Today's Follow-ups" icon="list" action={<CardLink onPress={go("Leads")} />}>
          <View style={styles.list}>
            {summary.follow.length ? (
              summary.follow.map((lead, index) => (
                <Pressable key={lead._id} style={styles.listRow} onPress={go("Leads")} accessibilityRole="button">
                  <View style={[styles.avatar, index % 2 ? styles.avatarAlt : null]}>
                    <Text style={[styles.avatarText, index % 2 ? styles.avatarTextAlt : null]}>
                      {initials(lead.name)}
                    </Text>
                  </View>
                  <View style={styles.listBody}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {lead.name || "Lead"}
                    </Text>
                    <Text style={styles.listSub} numberOfLines={1}>
                      {statusLabel(lead.status)}
                    </Text>
                  </View>
                  <Text style={styles.listTime}>{lead.when ? timeOf(lead.when) : ""}</Text>
                </Pressable>
              ))
            ) : (
              <EmptyNote label="No follow-ups today" tall />
            )}
          </View>
        </DashCard>

        <DashCard title="Pipeline Snapshot">
          <View style={[styles.tileGrid, styles.stageGrid]}>
            {summary.stages.map((stage) => (
              <Pressable
                key={stage.key}
                style={[styles.stageCard, { backgroundColor: stage.soft }]}
                onPress={go("Leads")}
                accessibilityRole="button"
              >
                <View style={styles.stageHead}>
                  <Icon name={stage.icon} size={14} color={stage.color} />
                  <Text style={styles.stageLabel} numberOfLines={1}>
                    {stage.label}
                  </Text>
                </View>
                <View style={styles.stageValueRow}>
                  <Text style={styles.stageValue}>{stage.value}</Text>
                  <Text style={styles.stageShare}>
                    {leads.length ? Math.round((stage.value / leads.length) * 100) : 0}%
                  </Text>
                </View>
                <View style={styles.stageTrack}>
                  <View
                    style={[
                      styles.stageFill,
                      { width: `${(stage.value / stageMax) * 100}%`, backgroundColor: stage.color },
                    ]}
                  />
                </View>
              </Pressable>
            ))}
          </View>
        </DashCard>

        <DashCard title="Recent Activity" icon="activity" action={<CardLink onPress={go("Leads")} />}>
          <View style={styles.list}>
            {summary.recent.length ? (
              summary.recent.map((lead, index) => (
                <Pressable key={lead._id} style={styles.listRow} onPress={go("Leads")} accessibilityRole="button">
                  <View style={styles.activityDot} />
                  <View style={styles.listBody}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {index ? statusLabel(lead.status) : "Lead updated"}
                    </Text>
                    <Text style={styles.listSub} numberOfLines={1}>
                      {lead.name || lead.phone}
                    </Text>
                  </View>
                  <Text style={styles.listTime}>
                    {dateOf(lead.updatedAt)?.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) || ""}
                  </Text>
                </Pressable>
              ))
            ) : (
              <EmptyNote label="No recent activity" />
            )}
          </View>
        </DashCard>

        <DashCard title="Revenue Overview" icon="barChart" action={<RangePill label="This Year" />}>
          <RevenueChart />
        </DashCard>

        <DashCard title="Upcoming Visits" action={<CardLink label="View Calendar" onPress={go("Calendar")} />}>
          <View style={styles.list}>
            {summary.upcoming.length ? (
              summary.upcoming.map((lead) => (
                <Pressable key={lead._id} style={styles.listRow} onPress={go("Calendar")} accessibilityRole="button">
                  <View style={styles.visitIcon}>
                    <Icon name="location-outline" size={16} color={themePalette.blue[600]} />
                  </View>
                  <View style={styles.listBody}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {lead.projectInterested || lead.name}
                    </Text>
                    <Text style={styles.listSub} numberOfLines={1}>
                      {lead.name}
                    </Text>
                  </View>
                  <Text style={styles.listTime}>{lead.when ? timeOf(lead.when) : ""}</Text>
                </Pressable>
              ))
            ) : (
              <EmptyNote label="No upcoming visits" />
            )}
          </View>
        </DashCard>

        <DashCard title="Quick Actions">
          <View style={[styles.tileGrid, styles.actionGrid]}>
            {quickActions.map((action) => (
              <Pressable
                key={action.label}
                style={[styles.actionCard, { backgroundColor: action.tint }]}
                onPress={action.onPress}
                accessibilityRole="button"
              >
                <Icon name={action.icon} size={20} color={action.color} />
                <Text style={[styles.actionLabel, { color: action.color }]}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </DashCard>

        <Text style={styles.footerNote}>{activeTeam} active team members</Text>
      </ScrollView>
    </Screen>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  container: {
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },

  /* ---- greeting ---- */
  greeting: {
    gap: 2,
  },
  greetingTitle: {
    fontSize: typography.displayLg,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: themePalette.slate[900],
  },
  greetingSub: {
    fontSize: typography.label,
    color: themePalette.slate[500],
  },

  /* ---- shared two-up grid ---- */
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.lg,
  },

  /* ---- KPI tiles ---- */
  kpiCard: {
    width: "48%",
    minHeight: 112,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    padding: spacing.lg,
    gap: spacing.xs,
    ...elevation.card,
  },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  kpiLabel: {
    fontSize: typography.label,
    color: themePalette.slate[500],
  },
  kpiValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  kpiValue: {
    flexShrink: 1,
    fontSize: typography.displayMd,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: themePalette.slate[900],
  },
  kpiTrend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  kpiTrendText: {
    fontSize: typography.caption,
    fontWeight: "600",
  },
  kpiHelp: {
    fontSize: typography.caption,
    color: themePalette.slate[500],
  },

  /* ---- card shell ---- */
  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    ...elevation.card,
  },
  cardHeader: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  cardTitleWrap: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  cardTitle: {
    flexShrink: 1,
    fontSize: typography.section,
    fontWeight: "700",
    color: themePalette.slate[900],
  },
  cardLink: {
    fontSize: typography.caption,
    fontWeight: "600",
    color: c.primary,
  },
  rangePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: 30,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.sm,
    backgroundColor: c.surface,
  },
  rangePillText: {
    fontSize: typography.caption,
    color: themePalette.slate[600],
  },
  emptyNote: {
    paddingVertical: 28,
    textAlign: "center",
    fontSize: typography.label,
    color: themePalette.slate[400],
  },
  emptyNoteTall: {
    paddingVertical: 52,
  },

  /* ---- occupancy chart ---- */
  occBox: {
    height: 208,
    padding: spacing.xl,
  },
  occGrid: {
    position: "absolute",
    left: spacing.xxl,
    right: spacing.xl,
    top: spacing.xl,
    bottom: 30,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: c.border,
  },
  occGridRow: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: themePalette.slate[100],
  },
  occChartLayer: {
    position: "absolute",
    left: spacing.xxl,
    right: spacing.xl,
    top: spacing.xl,
    bottom: 30,
  },
  occMonths: {
    position: "absolute",
    left: spacing.xxl,
    right: spacing.xl,
    bottom: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  occMonth: {
    fontSize: 10,
    color: themePalette.slate[500],
  },

  /* ---- inventory donut ---- */
  donutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
    padding: spacing.xl,
  },
  donutWrap: {
    width: 128,
    height: 128,
    alignItems: "center",
    justifyContent: "center",
  },
  donutCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  donutTotal: {
    fontSize: typography.title,
    fontWeight: "700",
    color: themePalette.slate[900],
  },
  donutCaption: {
    fontSize: 10,
    color: themePalette.slate[500],
  },
  legend: {
    flex: 1,
    gap: spacing.lg,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
  },
  legendLabel: {
    flex: 1,
    fontSize: typography.caption,
    color: themePalette.slate[500],
  },
  legendValue: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: themePalette.slate[900],
  },

  /* ---- list rows: follow-ups, activity, visits ---- */
  list: {
    paddingHorizontal: spacing.xl,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: themePalette.slate[100],
  },
  listBody: {
    flex: 1,
    gap: 1,
  },
  listTitle: {
    fontSize: typography.label,
    fontWeight: "700",
    color: themePalette.slate[900],
  },
  listSub: {
    fontSize: typography.caption,
    color: themePalette.slate[500],
  },
  listTime: {
    fontSize: 10,
    color: themePalette.slate[600],
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themePalette.blue[100],
  },
  avatarAlt: {
    backgroundColor: themePalette.violet[100],
  },
  avatarText: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: themePalette.blue[700],
  },
  avatarTextAlt: {
    color: themePalette.violet[700],
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: themePalette.blue[500],
  },
  visitIcon: {
    width: 44,
    height: 36,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themePalette.blue[50],
  },

  /* ---- pipeline snapshot ---- */
  stageGrid: {
    padding: spacing.lg,
  },
  stageCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  stageHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  stageLabel: {
    flexShrink: 1,
    fontSize: typography.caption,
    color: themePalette.slate[500],
  },
  stageValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  stageValue: {
    fontSize: typography.title,
    fontWeight: "700",
    color: themePalette.slate[900],
  },
  stageShare: {
    fontSize: 10,
    color: themePalette.slate[600],
  },
  stageTrack: {
    height: 8,
    borderRadius: radii.pill,
    overflow: "hidden",
    backgroundColor: c.surface,
  },
  stageFill: {
    height: "100%",
    borderRadius: radii.pill,
  },

  /* ---- revenue ---- */
  revenueBox: {
    padding: spacing.lg,
  },

  /* ---- quick actions ---- */
  actionGrid: {
    padding: spacing.lg,
  },
  actionCard: {
    width: "48%",
    minHeight: 80,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  actionLabel: {
    fontSize: typography.caption,
    fontWeight: "600",
  },

  /* ---- footer ---- */
  footerNote: {
    textAlign: "right",
    fontSize: 10,
    color: themePalette.slate[400],
  },
}));

export default ManagerDashboardScreen;
