import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { Icon } from "../../components/ui/Icon";
import { Screen } from "../../components/common/Screen";
import { radii, spacing, typography } from "../../theme/tokens";
import { themedStyles, themePalette } from "../../theme/themedStyles";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  getAttendancePolicy,
  getDailyAttendanceForAdmin,
  updateAttendancePolicy,
} from "../../services/attendanceService";
import { dayKeyOf, liveStatusOf, type RosterRow } from "./attendanceShared";

/*
 * Comp 6: where the office is, how far counts as "at it", and how today is
 * going against the policy.
 *
 * The map is Leaflet over OpenStreetMap in a WebView - the same approach
 * FieldOpsScreen already uses, rather than adding a native map dependency for
 * one static preview. It needs the network; with none, the panel is simply
 * blank behind the coordinates, which is why the coordinates are also printed
 * as text above it.
 */

const mapHtml = (lat: number, lng: number, radius: number) => `<!doctype html><html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#eef2f7}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
  var lat = ${Number.isFinite(lat) ? lat : 0};
  var lng = ${Number.isFinite(lng) ? lng : 0};
  var radius = ${Number.isFinite(radius) ? radius : 200};
  var map = L.map('map', { zoomControl:false, attributionControl:false, dragging:false, scrollWheelZoom:false, doubleClickZoom:false }).setView([lat, lng], 16);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom:19 }).addTo(map);
  L.circle([lat, lng], { radius: radius, color:'#2549d6', weight:2, fillColor:'#2549d6', fillOpacity:0.15 }).addTo(map);
  L.circleMarker([lat, lng], { radius:9, color:'#ffffff', weight:3, fillColor:'#2549d6', fillOpacity:1 }).addTo(map);
</script></body></html>`;

export const AttendancePolicyScreen = () => {
  const navigation = useNavigation<any>();

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("200");
  const [geofenceEnabled, setGeofenceEnabled] = useState(false);
  const [fullDayMinutes, setFullDayMinutes] = useState(540);
  const [graceMinutes, setGraceMinutes] = useState(0);
  const [roster, setRoster] = useState<RosterRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const [policy, daily] = await Promise.allSettled([
        getAttendancePolicy(),
        getDailyAttendanceForAdmin({ date: dayKeyOf(new Date()) }),
      ]);
      if (policy.status === "fulfilled" && policy.value) {
        const row = policy.value as any;
        setLatitude(row.officeLatitude != null ? String(row.officeLatitude) : "");
        setLongitude(row.officeLongitude != null ? String(row.officeLongitude) : "");
        setRadius(String(row.officeRadiusMeters ?? 200));
        setGeofenceEnabled(Boolean(row.geofenceEnabled));
        setFullDayMinutes(Number(row.fullDayMinutes ?? 540));
        setGraceMinutes(Number(row.graceMinutes ?? 0));
      } else if (policy.status === "rejected") {
        setError(toErrorMessage(policy.reason, "Could not load the attendance policy"));
      }
      if (daily.status === "fulfilled") setRoster((daily.value.attendance || []) as RosterRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(""), 2200);
    return () => clearTimeout(timer);
  }, [saved]);

  const lat = Number(latitude);
  const lng = Number(longitude);
  const radiusValue = Number(radius);
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);

  const insights = useMemo(() => {
    const c = themePalette;
    const total = roster.length || 1;
    const live = roster.map(liveStatusOf);
    const onTime = roster.filter((row) => row.checkInAt && Number(row.lateMinutes || 0) <= graceMinutes).length;
    const attended = live.filter((s) => s !== "ABSENT" && s !== "PENDING").length;
    const worked = roster.reduce((sum, row) => sum + Number(row.workedMinutes || 0), 0);
    const targetTotal = total * (fullDayMinutes || 540);

    return [
      { label: "On time arrival rate", value: Math.round((onTime / total) * 100), color: c.emerald[500] },
      { label: "Attendance vs target", value: Math.round((attended / total) * 100), color: c.amber[500] },
      {
        label: `Hours vs ${Math.round((fullDayMinutes || 540) / 60)}h target`,
        value: targetTotal ? Math.round((worked / targetTotal) * 100) : 0,
        color: c.blue[500],
      },
    ];
  }, [roster, graceMinutes, fullDayMinutes]);

  const useCurrent = async () => {
    setLocating(true);
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError("Location permission is needed to read your current position.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setLatitude(position.coords.latitude.toFixed(6));
      setLongitude(position.coords.longitude.toFixed(6));
    } catch (err) {
      setError(toErrorMessage(err, "Could not read your current location"));
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    if (geofenceEnabled && !hasPoint) {
      setError("Set the office latitude and longitude before turning the geofence on.");
      return;
    }
    if (!Number.isFinite(radiusValue) || radiusValue < 10 || radiusValue > 5000) {
      setError("Allowed radius must be between 10 and 5000 meters.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateAttendancePolicy({
        geofenceEnabled,
        officeLatitude: hasPoint ? lat : null,
        officeLongitude: hasPoint ? lng : null,
        officeRadiusMeters: radiusValue,
      });
      setSaved("Attendance policy saved");
    } catch (err) {
      setError(toErrorMessage(err, "Could not save the attendance policy"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      title="Attendance Policy & Geofence"
      description="Set your office location, allowed radius and attendance policy settings."
      back={() => navigation.goBack()}
      loading={loading}
      error={error}
      onRetry={() => load()}
    >
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {saved ? <Text style={styles.saved}>{saved}</Text> : null}

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardIcon}>
              <Icon name="location-outline" size={18} color={themePalette.blue[600]} />
            </View>
            <Text style={styles.cardTitle}>Office Location (Geofence)</Text>
            <View style={styles.spacer} />
            <Icon name="alert-circle-outline" size={17} color={themePalette.slate[400]} />
          </View>

          <View style={styles.divider} />

          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <View style={styles.fieldHead}>
                <View style={styles.fieldIcon}>
                  <Icon name="targets" size={14} color={themePalette.blue[600]} />
                </View>
                <Text style={styles.fieldLabel}>Office Latitude</Text>
              </View>
              <TextInput
                value={latitude}
                onChangeText={setLatitude}
                placeholder="22.748414"
                placeholderTextColor={themePalette.slate[400]}
                keyboardType="numbers-and-punctuation"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <View style={styles.fieldHead}>
                <View style={styles.fieldIcon}>
                  <Icon name="targets" size={14} color={themePalette.blue[600]} />
                </View>
                <Text style={styles.fieldLabel}>Office Longitude</Text>
              </View>
              <TextInput
                value={longitude}
                onChangeText={setLongitude}
                placeholder="75.890864"
                placeholderTextColor={themePalette.slate[400]}
                keyboardType="numbers-and-punctuation"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <View style={styles.fieldHead}>
                <View style={styles.fieldIcon}>
                  <Icon name="location-outline" size={14} color={themePalette.blue[600]} />
                </View>
                <Text style={styles.fieldLabel}>Allowed Radius (meters)</Text>
              </View>
              <TextInput
                value={radius}
                onChangeText={setRadius}
                placeholder="200"
                placeholderTextColor={themePalette.slate[400]}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>

            <View style={[styles.field, styles.toggleCard]}>
              <View style={styles.toggleRow}>
                <Icon name="location-outline" size={16} color={themePalette.blue[600]} />
                <Text style={styles.toggleTitle}>Geofence</Text>
                <View style={styles.spacer} />
                <Switch
                  value={geofenceEnabled}
                  onValueChange={setGeofenceEnabled}
                  trackColor={{ true: themePalette.blue[500], false: themePalette.slate[300] }}
                  thumbColor="#ffffff"
                />
              </View>
              <Text style={styles.toggleHelp}>Enable location-based attendance</Text>
            </View>
          </View>

          <View style={styles.mapBox}>
            {hasPoint ? (
              <WebView
                originWhitelist={["*"]}
                source={{ html: mapHtml(lat, lng, radiusValue || 200) }}
                style={styles.map}
                javaScriptEnabled
                scrollEnabled={false}
                pointerEvents="none"
              />
            ) : (
              <View style={styles.mapEmpty}>
                <Icon name="location-outline" size={22} color={themePalette.slate[400]} />
                <Text style={styles.mapEmptyText}>Set a latitude and longitude to preview the geofence.</Text>
              </View>
            )}

            {hasPoint ? (
              <View style={styles.callout} pointerEvents="none">
                <Icon name="location-outline" size={15} color={themePalette.blue[600]} />
                <View>
                  <Text style={styles.calloutTitle}>Office Location</Text>
                  <Text style={styles.calloutMeta}>{lat}, {lng}</Text>
                  <Text style={styles.calloutMeta}>Radius: {radiusValue || 200} meters</Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.secondary} onPress={useCurrent} disabled={locating} accessibilityRole="button">
              <Icon name="location-outline" size={16} color={themePalette.text} />
              <Text style={styles.secondaryText}>{locating ? "Locating…" : "Use current"}</Text>
            </Pressable>
            <Pressable style={[styles.primary, saving && styles.busy]} onPress={save} disabled={saving} accessibilityRole="button">
              <Icon name="checkmark" size={17} color="#ffffff" />
              <Text style={styles.primaryText}>Save</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={[styles.cardIcon, { backgroundColor: themePalette.amber[50] }]}>
              <Icon name="alert-circle-outline" size={18} color={themePalette.amber[600]} />
            </View>
            <Text style={styles.cardTitle}>Today&apos;s Insights</Text>
          </View>

          <View style={styles.divider} />

          {insights.map((row) => (
            <View key={row.label} style={styles.insightRow}>
              <Text style={styles.insightLabel} numberOfLines={1}>{row.label}</Text>
              <View style={styles.insightTrack}>
                <View
                  style={[
                    styles.insightFill,
                    { width: `${Math.max(0, Math.min(100, row.value))}%`, backgroundColor: row.color },
                  ]}
                />
              </View>
              <Text style={styles.insightValue}>{row.value}%</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  page: { gap: spacing.lg, paddingBottom: spacing.xxl },
  saved: {
    borderWidth: 1,
    borderColor: c.emerald[200],
    borderRadius: radii.md,
    backgroundColor: c.emerald[50],
    color: c.emerald[700],
    padding: spacing.md,
    fontSize: typography.label,
    fontWeight: "700",
  },
  card: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.blue[50],
  },
  cardTitle: { fontSize: typography.title, fontWeight: "700", color: c.text },
  spacer: { flex: 1 },
  divider: { height: 1, backgroundColor: c.border, marginHorizontal: -spacing.lg },

  fieldRow: { flexDirection: "row", gap: spacing.lg },
  field: { flex: 1, gap: spacing.sm },
  fieldHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  fieldIcon: {
    width: 26,
    height: 26,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.blue[50],
  },
  fieldLabel: { flex: 1, fontSize: typography.label, color: c.slate[600] },
  input: {
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    color: c.text,
    fontSize: typography.body,
  },
  toggleCard: {
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: c.blue[50],
    justifyContent: "center",
  },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  toggleTitle: { fontSize: typography.section, fontWeight: "700", color: c.text },
  toggleHelp: { fontSize: typography.caption, color: c.slate[600] },

  mapBox: {
    height: 210,
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceMuted,
  },
  map: { flex: 1, backgroundColor: c.surfaceMuted },
  mapEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  mapEmptyText: { textAlign: "center", fontSize: typography.label, color: c.slate[500] },
  callout: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  calloutTitle: { fontSize: typography.label, fontWeight: "700", color: c.text },
  calloutMeta: { fontSize: typography.caption, color: c.slate[500] },

  actions: { flexDirection: "row", gap: spacing.md },
  busy: { opacity: 0.7 },
  secondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  secondaryText: { fontSize: typography.title, fontWeight: "600", color: c.text },
  primary: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: c.blue[600],
  },
  primaryText: { fontSize: typography.title, fontWeight: "700", color: "#ffffff" },

  insightRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  insightLabel: { width: 132, fontSize: typography.label, color: c.slate[600] },
  insightTrack: { flex: 1, height: 9, borderRadius: radii.pill, overflow: "hidden", backgroundColor: c.slate[200] },
  insightFill: { height: "100%", borderRadius: radii.pill },
  insightValue: { width: 42, textAlign: "right", fontSize: typography.label, fontWeight: "700", color: c.text },
}));

export default AttendancePolicyScreen;
