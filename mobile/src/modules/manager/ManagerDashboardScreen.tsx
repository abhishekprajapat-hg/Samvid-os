import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import { useAuth } from "../../context/AuthContext";
import { getAllLeads } from "../../services/leadService";
import { getInventoryAssets } from "../../services/inventoryService";
import { toErrorMessage } from "../../utils/errorMessage";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import type { InventoryAsset, Lead } from "../../types";

/*
 * Home, drawn to the mobile comp.
 *
 * The comp is not the web dashboard reorganised for a phone - it is a
 * different page: a greeting, four headline numbers, a revenue strip, four
 * quick actions, the inventory split, and the two things happening next. The
 * web page's occupancy area chart, inventory donut, pipeline snapshot, recent
 * activity, revenue bar chart and team footer are not on it, so they are not
 * here. Everything they linked to is still reachable - Inventory, Leads,
 * Finance and Calendar all have their own destinations.
 *
 * The numbers come from the same endpoints the old page used, so the data
 * contract in docs/mobile/00_MOBILE_PARITY_SPEC.md is unchanged.
 *
 * Sizes are the comp's, measured at 2x off a 430pt frame: an 18pt gutter, 9pt
 * between grid cells, 100pt stat tiles, a 70pt revenue strip. Widths flex, so
 * the same screen holds at 320pt.
 */

const REFRESH_INTERVAL_MS = 30000;

/*
 * Fields the API returns on a lead that the shared Lead type does not carry
 * yet - the dashboard reads all three straight off the raw payload.
 */
type DashboardLead = Lead & {
  siteVisitDate?: string;
  dealPayment?: { amount?: number } | null;
  saleDetails?: { amount?: number } | null;
};

type DatedLead = DashboardLead & { when: Date | null };

/* The comp writes the amount tight against the sign: "0", not " 0". */
const money = (value: number) => {
  const amount = Number(value || 0);
  return amount >= 100000
    ? `₹${(amount / 100000).toFixed(1)}L`
    : `₹${amount.toLocaleString("en-IN")}`;
};

const dateOf = (value?: string | null) => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

const timeOf = (value: Date) =>
  value
    .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
    .toUpperCase();

/*
 * "Tue, 22 Sep" - the comp's date line.
 *
 * Spelled out rather than handed to Intl: recent ICU renders September's short
 * month as "Sept", which is four characters where the comp has three and wide
 * enough to change the line.
 */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const dayLabel = (value: Date) =>
  `${WEEKDAYS[value.getDay()]}, ${String(value.getDate()).padStart(2, "0")} ${MONTHS[value.getMonth()]}`;

const greetingFor = (hour: number) =>
  hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

/** The comp greets by first name. */
const firstNameOf = (name?: string) => String(name || "").trim().split(/\s+/)[0] || "there";

const statusLabel = (status?: string) => String(status || "").replace(/_/g, " ");

/*
 * The comp puts a place under the visit's title, against a pin. A lead carries
 * no address of its own, so it comes from the unit the visit is against, and
 * falls back to the city the enquiry was filed under.
 */
const placeOf = (lead: DashboardLead) => {
  const linked = lead.inventoryId;
  if (linked && typeof linked === "object" && linked.location) return linked.location;
  return lead.city || "";
};

/* ---------------------------------------------------------- building blocks -- */

/** A section heading, with the comp's optional link on the right. */
const SectionHead = ({
  title,
  onPress,
  style,
}: {
  title: string;
  onPress?: () => void;
  style?: object;
}) => (
  <View style={[styles.sectionHead, style]}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {onPress ? (
      <Pressable style={styles.sectionLink} onPress={onPress} hitSlop={10} accessibilityRole="button">
        <Text style={styles.sectionLinkText}>View all</Text>
        <Glyph name="chevron-forward" size={16} color={brand.ink} />
      </Pressable>
    ) : null}
  </View>
);

/**
 * The two list cards at the foot of the page: a tinted badge, a title, a muted
 * "View all", and a body indented to the title's column.
 */
const ListCard = ({
  icon,
  iconColor,
  badgeColor,
  title,
  onViewAll,
  /* The comp sets the body's own gap per card: 15 under a two-line note, 8
     under a row. */
  bodyGap = 15,
  children,
  style,
}: {
  icon: GlyphName;
  iconColor: string;
  badgeColor: string;
  title: string;
  onViewAll: () => void;
  bodyGap?: number;
  children: React.ReactNode;
  style?: object;
}) => (
  <View style={[styles.card, style]}>
    <View style={styles.cardHead}>
      <View style={[styles.cardBadge, { backgroundColor: badgeColor }]}>
        <Glyph name={icon} size={15} color={iconColor} />
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {title}
      </Text>
      <Pressable style={styles.cardLink} onPress={onViewAll} hitSlop={10} accessibilityRole="button">
        <Text style={styles.cardLinkText}>View all</Text>
        <Glyph name="chevron-forward" size={15} color={brand.textMuted} />
      </Pressable>
    </View>
    <View style={[styles.cardBody, { marginTop: bodyGap }]}>{children}</View>
  </View>
);

/* ---------------------------------------------------------------- screen -- */

export const ManagerDashboardScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState<DashboardLead[]>([]);
  const [inventory, setInventory] = useState<InventoryAsset[]>([]);

  const load = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      const [leadRows, inventoryRows] = await Promise.all([getAllLeads(), getInventoryAssets()]);
      setLeads(Array.isArray(leadRows) ? (leadRows as DashboardLead[]) : []);
      setInventory(Array.isArray(inventoryRows) ? inventoryRows : []);
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
      .slice(0, 3);
    const upcoming = leads
      .map((lead): DatedLead => ({ ...lead, when: dateOf(lead.siteVisitDate || lead.nextFollowUp) }))
      .filter((lead) => !!lead.when && lead.when >= now)
      .sort((a, b) => (a.when?.getTime() || 0) - (b.when?.getTime() || 0))[0];

    return {
      total,
      available,
      occupied,
      occupancy: total ? Math.round((occupied / total) * 100) : 0,
      clients: closed.length,
      open: open.length,
      revenue,
      follow,
      upcoming,
    };
  }, [inventory, leads]);

  const go = useCallback(
    (screen: string, params?: Record<string, unknown>) => () => navigation.navigate(screen, params),
    [navigation],
  );

  /*
   * Inventory, Leads and Tasks are tabs. Navigating to them by name would push
   * the stack's copy on top of the bar instead, which shows a navigator header
   * above the page header those screens already draw.
   */
  const goTab = useCallback(
    (screen: string) => () => navigation.navigate("MainTabs", { screen }),
    [navigation],
  );

  const now = new Date();

  const stats: Array<{ icon: GlyphName; label: string; value: string; onPress: () => void }> = [
    { icon: "home", label: "Properties", value: String(summary.total), onPress: goTab("Inventory") },
    { icon: "people", label: "Open leads", value: String(summary.open), onPress: goTab("Leads") },
    { icon: "pie-chart", label: "Occupancy", value: `${summary.occupancy}%`, onPress: goTab("Inventory") },
    { icon: "person", label: "Clients", value: String(summary.clients), onPress: go("CoworkingClients") },
  ];

  const quickActions: Array<{ icon: GlyphName; label: string; onPress: () => void }> = [
    { icon: "add-circle", label: "Add property", onPress: go("AddProperty") },
    { icon: "people", label: "Add client", onPress: go("CoworkingClients") },
    { icon: "calendar-outline", label: "Schedule visit", onPress: go("Calendar") },
    { icon: "checkbox", label: "Create task", onPress: go("NewTask") },
  ];

  /*
   * The split bar is drawn from the two counts rather than the comp's fixed
   * proportions, so it stays honest when the portfolio changes. An empty
   * portfolio leaves the track showing rather than dividing by zero.
   */
  const availableShare = summary.total ? summary.available / summary.total : 0;

  return (
    <SafeAreaView style={styles.root} edges={["left", "right"]}>
      {loading ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={brand.green} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingBottom: 24 + Math.max(insets.bottom, Platform.OS === "android" ? 16 : 0) },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={brand.green}
            />
          }
        >
          {/*
           * A transient failure sits above the page rather than replacing it:
           * the numbers behind it are the last good ones and still worth
           * showing while a refresh is retried.
           */}
          {error ? (
            <Pressable style={styles.errorBanner} onPress={() => load()} accessibilityRole="button">
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.errorRetry}>Tap to retry</Text>
            </Pressable>
          ) : null}

          {/* ---- greeting ---- */}
          <View style={styles.greetingRow}>
            <View style={styles.greetingText}>
              <Text style={styles.greeting} numberOfLines={2}>
                {greetingFor(now.getHours())}, {firstNameOf(user?.name)}.
              </Text>
              <Text style={styles.date}>{dayLabel(now)}</Text>
            </View>

            <Pressable
              style={styles.cta}
              onPress={goTab("Inventory")}
              accessibilityRole="button"
              accessibilityLabel="Find spaces"
            >
              <View style={styles.ctaText}>
                <Text style={styles.ctaLine}>Find spaces</Text>
                <Text style={styles.ctaLine}>Build tomorrow</Text>
              </View>
              <Glyph name="chevron-forward" size={18} color={brand.ink} />
            </Pressable>
          </View>

          {/* ---- headline numbers ---- */}
          <View style={styles.statRow}>
            {stats.map((stat) => (
              <Pressable
                key={stat.label}
                style={styles.statTile}
                onPress={stat.onPress}
                accessibilityRole="button"
              >
                <Glyph name={stat.icon} size={22} color={brand.green} />
                <Text style={styles.statLabel} numberOfLines={1}>
                  {stat.label}
                </Text>
                <Text
                  style={styles.statValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {stat.value}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* ---- revenue strip ---- */}
          <Pressable style={styles.banner} onPress={go("Finance")} accessibilityRole="button">
            <Glyph name="bar-chart" size={22} color={brand.green} />
            <View style={styles.bannerText}>
              <Text style={styles.bannerLabel}>Monthly revenue</Text>
              <Text style={styles.bannerValue} numberOfLines={1}>
                {money(summary.revenue)}
              </Text>
            </View>
            {/* Decoration, not a chart - the comp draws four fixed bars. */}
            <View style={styles.bannerBars} pointerEvents="none">
              {[10, 20, 32, 50].map((height) => (
                <View key={height} style={[styles.bannerBar, { height }]} />
              ))}
            </View>
            <Glyph name="chevron-forward" size={20} color={brand.ink} />
          </Pressable>

          {/* ---- quick actions ---- */}
          <SectionHead title="Quick actions" style={styles.sectionTop} />
          <View style={styles.statRow}>
            {quickActions.map((action) => (
              <Pressable
                key={action.label}
                style={styles.actionTile}
                onPress={action.onPress}
                accessibilityRole="button"
              >
                <Glyph name={action.icon} size={26} color={brand.green} />
                <Text style={styles.actionLabel} numberOfLines={1}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* ---- inventory split ---- */}
          <SectionHead title="Inventory status" onPress={goTab("Inventory")} style={styles.sectionTop} />
          <View style={styles.splitBar}>
            {availableShare > 0 ? (
              <View style={[styles.splitFill, { flex: availableShare }]} />
            ) : null}
            {availableShare < 1 ? (
              <View style={[styles.splitTrack, { flex: 1 - availableShare }]} />
            ) : null}
          </View>
          <View style={styles.legendRow}>
            <View>
              <View style={styles.legendLabelRow}>
                <View style={[styles.legendDot, { backgroundColor: brand.greenBright }]} />
                <Text style={styles.legendLabel}>Available</Text>
              </View>
              <Text style={styles.legendValue}>{summary.available}</Text>
            </View>
            <View>
              <View style={styles.legendLabelRow}>
                <View style={[styles.legendDot, { backgroundColor: brand.track }]} />
                <Text style={styles.legendLabel}>Occupied</Text>
              </View>
              <Text style={styles.legendValue}>{summary.occupied}</Text>
            </View>
          </View>

          {/* ---- today's follow-ups ---- */}
          <ListCard
            icon="list"
            iconColor={brand.ink}
            badgeColor={brand.neutralBadge}
            title="Today's follow-ups"
            onViewAll={goTab("Leads")}
            style={styles.cardTop}
          >
            {summary.follow.length ? (
              summary.follow.map((lead) => (
                <Pressable
                  key={lead._id}
                  style={styles.row}
                  onPress={() => navigation.navigate("LeadDetails", { leadId: lead._id })}
                  accessibilityRole="button"
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {lead.name || "Lead"}
                    </Text>
                    <View style={styles.rowMeta}>
                      <Glyph name="time-outline" size={14} color={brand.textMuted} />
                      <Text style={styles.rowMetaText} numberOfLines={1}>
                        {lead.when ? timeOf(lead.when) : statusLabel(lead.status)}
                      </Text>
                    </View>
                  </View>
                  <Glyph name="chevron-forward" size={18} color={brand.textMuted} />
                </Pressable>
              ))
            ) : (
              <>
                <Text style={styles.emptyTitle}>No follow-ups today.</Text>
                <Text style={styles.emptyNote}>{"You're all caught up! 🎉"}</Text>
              </>
            )}
          </ListCard>

          {/* ---- next visit ---- */}
          <ListCard
            icon="calendar-outline"
            iconColor={brand.green}
            badgeColor={brand.tintBadge}
            title="Upcoming visit"
            onViewAll={go("Calendar")}
            bodyGap={8}
            style={styles.cardNext}
          >
            {summary.upcoming ? (
              <Pressable
                style={styles.row}
                onPress={() => navigation.navigate("LeadDetails", { leadId: summary.upcoming?._id })}
                accessibilityRole="button"
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {summary.upcoming.projectInterested || summary.upcoming.name || "Site visit"}
                  </Text>
                  <View style={styles.rowMeta}>
                    <Glyph name="location-outline" size={14} color={brand.textMuted} />
                    <Text style={styles.rowMetaText} numberOfLines={1}>
                      {placeOf(summary.upcoming) || summary.upcoming.name || "Lead"}
                    </Text>
                  </View>
                  <View style={styles.rowMeta}>
                    <Glyph name="time-outline" size={14} color={brand.textMuted} />
                    <Text style={styles.rowMetaText} numberOfLines={1}>
                      {summary.upcoming.when ? timeOf(summary.upcoming.when) : ""}
                    </Text>
                  </View>
                </View>
                <Glyph name="chevron-forward" size={18} color={brand.textMuted} />
              </Pressable>
            ) : (
              <>
                <Text style={styles.emptyTitle}>No visits scheduled.</Text>
                <Text style={styles.emptyNote}>Book one from a lead to see it here.</Text>
              </>
            )}
          </ListCard>
        </ScrollView>
      )}
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
    container: {
      paddingHorizontal: layout.gutter,
      paddingTop: 12,
    },

    errorBanner: {
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.card,
      backgroundColor: b.surface,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 12,
    },
    errorText: {
      fontSize: t.body,
      lineHeight: 17,
      color: b.text,
    },
    errorRetry: {
      marginTop: 2,
      fontSize: t.label,
      fontWeight: "600",
      color: b.ink,
    },

    /* ---- greeting ---- */
    greetingRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    greetingText: {
      flex: 1,
      /*
       * Yoga treats a flex child's min-width as 0; CSS flexbox treats it as
       * auto, so on the react-native-web build a row of flex children cannot
       * shrink below its content and overflows the viewport. Every flex child
       * in this file carries minWidth: 0 for that reason - it is a no-op
       * natively and the fix on web.
       */
      minWidth: 0,
    },
    greeting: {
      fontSize: t.hero,
      lineHeight: 26,
      fontWeight: "700",
      letterSpacing: -0.45,
      color: b.text,
    },
    date: {
      marginTop: 2,
      fontSize: t.body,
      lineHeight: 16,
      color: b.textMuted,
    },
    cta: {
      width: 118,
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      borderRadius: round.banner,
      backgroundColor: b.tint,
      paddingLeft: 13,
      paddingRight: 5,
      paddingTop: 9,
      paddingBottom: 10,
    },
    ctaText: {
      flex: 1,
      minWidth: 0,
    },
    ctaLine: {
      fontSize: t.cta,
      lineHeight: 14,
      fontWeight: "600",
      color: b.ink,
    },

    /* ---- the two four-up grids ---- */
    statRow: {
      marginTop: 15,
      flexDirection: "row",
      gap: layout.gridGap,
    },
    statTile: {
      flex: 1,
      minWidth: 0,
      height: 100,
      justifyContent: "center",
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.card,
      backgroundColor: b.surface,
    },
    statLabel: {
      marginTop: 6,
      fontSize: t.label,
      lineHeight: 14,
      fontWeight: "500",
      color: b.textSecondary,
    },
    statValue: {
      marginTop: 4,
      fontSize: t.hero,
      lineHeight: 26,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },
    actionTile: {
      flex: 1,
      minWidth: 0,
      height: 78,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.card,
      backgroundColor: b.surface,
    },
    actionLabel: {
      marginTop: 6,
      fontSize: t.label,
      lineHeight: 14,
      fontWeight: "500",
      textAlign: "center",
      color: b.textSecondary,
    },

    /* ---- revenue strip ---- */
    banner: {
      marginTop: 10,
      height: 70,
      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
      borderRadius: round.banner,
      backgroundColor: b.tintSoft,
      paddingLeft: 15,
      paddingRight: 14,
    },
    bannerText: {
      flex: 1,
      minWidth: 0,
      marginLeft: 18,
    },
    bannerLabel: {
      fontSize: t.label,
      lineHeight: 15,
      fontWeight: "500",
      color: b.textSecondary,
    },
    bannerValue: {
      fontSize: t.hero,
      lineHeight: 26,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },
    bannerBars: {
      /*
       * Laid out in the row rather than positioned absolutely: Yoga measures
       * an absolute child from the parent's padding box, so `right: 0` here
       * would already be inset by the strip's 14pt and the bars would drift.
       * flex-end drops them onto the strip's bottom edge, where the comp
       * clips them.
       */
      alignSelf: "flex-end",
      marginRight: 8,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 6,
    },
    bannerBar: {
      width: 13,
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      backgroundColor: b.tintBar,
    },

    /* ---- section heads ---- */
    sectionHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    sectionTop: {
      marginTop: 16,
    },
    sectionTitle: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: t.sectionTitle,
      lineHeight: 20,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: b.text,
    },
    sectionLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    sectionLinkText: {
      fontSize: t.label,
      fontWeight: "600",
      color: b.ink,
    },

    /* ---- inventory split ---- */
    splitBar: {
      marginTop: 8,
      height: 14,
      flexDirection: "row",
      gap: 2,
    },
    splitFill: {
      borderRadius: round.pill,
      backgroundColor: b.greenBright,
    },
    splitTrack: {
      borderRadius: round.pill,
      backgroundColor: b.track,
    },
    legendRow: {
      marginTop: 9,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    legendLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    legendDot: {
      width: 12,
      height: 12,
      borderRadius: round.pill,
    },
    legendLabel: {
      fontSize: t.label,
      lineHeight: 15,
      fontWeight: "500",
      color: b.textMuted,
    },
    legendValue: {
      marginTop: 1,
      marginLeft: 22,
      fontSize: t.metric,
      lineHeight: 21,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: b.text,
    },

    /* ---- list cards ---- */
    card: {
      padding: 14,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.card,
      backgroundColor: b.surface,
    },
    cardTop: {
      marginTop: 15,
    },
    cardNext: {
      marginTop: 11,
    },
    cardHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    cardBadge: {
      width: 28,
      height: 28,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    cardTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: t.cardTitle,
      lineHeight: 18,
      fontWeight: "700",
      letterSpacing: -0.2,
      color: b.text,
    },
    cardLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    cardLinkText: {
      fontSize: t.label,
      fontWeight: "500",
      color: b.textMuted,
    },
    cardBody: {
      /* Indented to the title's column: the badge plus the gap beside it. */
      paddingLeft: 28 + 14,
    },
    emptyTitle: {
      fontSize: t.body,
      lineHeight: 16,
      fontWeight: "600",
      color: b.text,
    },
    emptyNote: {
      marginTop: 4,
      fontSize: t.body,
      lineHeight: 16,
      color: b.textMuted,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 2,
    },
    rowText: {
      flex: 1,
      minWidth: 0,
    },
    rowTitle: {
      fontSize: t.rowTitle,
      lineHeight: 19,
      fontWeight: "700",
      letterSpacing: -0.2,
      color: b.text,
    },
    rowMeta: {
      marginTop: 3,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    rowMetaText: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: t.body,
      lineHeight: 16,
      color: b.textMuted,
    },
  }),
);
