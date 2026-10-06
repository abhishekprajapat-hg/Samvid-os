import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import * as Print from "expo-print";
import { WebView } from "react-native-webview";
import { Screen } from "../../components/common/Screen";
import { AppBadge, AppCard, AppEmptyState, AppSkeletonList } from "../../components/ui";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import { spacing, typography } from "../../theme/tokens";
import { toErrorMessage } from "../../utils/errorMessage";
import { getSharedInventory } from "../../services/publicInventoryService";
import { getWebAppOrigin } from "../../services/api";
import { themedStyles, themePalette } from "../../theme/themedStyles";

/*
 * Mirrors modules/inventory/SharedInventoryView.jsx.
 *
 * Reached by a share token, with no session: this is what someone outside the
 * company sees when a listing is shared with them. It must therefore never
 * touch the authenticated api instance and never assume a signed-in user - see
 * publicInventoryService for why it has its own axios client.
 *
 * The sections are web's, in web's order: gallery, price and summary rows,
 * the headline metrics, property and commercial / residential details,
 * amenities, files and media, and the location. The server signs every file
 * URL on this page, so documents and floor plans open in the browser without
 * a session. Web's heart is left out: it is local state that saves nothing.
 */

type Row = [string, unknown];

const shown = (value: unknown) => value !== null && value !== undefined && value !== "";
const price = (value: unknown) =>
  shown(value) && Number.isFinite(Number(value)) ? `₹${Number(value).toLocaleString("en-IN")}` : "Price on request";
const label = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase()) || null;
const area = (value: unknown, unit: unknown) =>
  shown(value) && Number.isFinite(Number(value))
    ? `${Number(value).toLocaleString("en-IN")} ${String(unit).toUpperCase() === "SQ_M" ? "sq m" : "sq ft"}`
    : null;
const yesNo = (value: unknown) => (shown(value) ? (value ? "Yes" : "No") : null);

/* Public file links arrive as server paths; the page's own origin serves them. */
const fileUrl = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw || /^https?:\/\//i.test(raw)) return raw;
  return `${getWebAppOrigin()}${raw.startsWith("/") ? "" : "/"}${raw}`;
};
const urlOf = (entry: any) => fileUrl(typeof entry === "string" ? entry : entry?.url);

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const MapFrame = ({ lat, lng, height }: { lat: number; lng: number; height: number }) => {
  const src = `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  if (Platform.OS === "web") {
    // @ts-ignore web-only element
    return <iframe title="Property location" src={src} style={{ width: "100%", height, border: 0, borderRadius: 12 }} />;
  }
  return (
    <View style={{ height, borderRadius: 12, overflow: "hidden" }}>
      <WebView source={{ uri: src }} javaScriptEnabled domStorageEnabled />
    </View>
  );
};

export const SharedInventoryViewScreen = () => {
  const route = useRoute<any>();
  const shareToken = String(route.params?.shareToken || "");
  const { width } = useWindowDimensions();

  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageIndex, setImageIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    if (!shareToken) {
      setError("This share link is invalid.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getSharedInventory(shareToken);
      setAsset(data);
      setError(data ? "" : "Property not found");
    } catch (err: any) {
      setError(
        err?.response?.status === 410
          ? "This share link has expired. Please request a new link."
          : toErrorMessage(err, "Unable to load property"),
      );
    } finally {
      setLoading(false);
    }
  }, [shareToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const images = useMemo(
    () => (Array.isArray(asset?.images) ? asset.images.map(urlOf).filter(Boolean) : []) as string[],
    [asset?.images],
  );
  const docs = useMemo(() => (Array.isArray(asset?.documents) ? asset.documents.map(urlOf).filter(Boolean) : []) as string[], [asset?.documents]);
  const plans = useMemo(() => (Array.isArray(asset?.floorPlans) ? asset.floorPlans.map(urlOf).filter(Boolean) : []) as string[], [asset?.floorPlans]);
  const videos = useMemo(() => (Array.isArray(asset?.videoTours) ? asset.videoTours.map(urlOf).filter(Boolean) : []) as string[], [asset?.videoTours]);

  const commercial = asset?.commercialDetails || {};
  const layout = commercial.officeLayout || {};
  const building = commercial.buildingDetails || {};
  const availability = commercial.availability || {};
  const amenities = commercial.amenities || {};
  const residential = asset?.residentialDetails || {};
  const isCommercial = String(asset?.inventoryType).toUpperCase() === "COMMERCIAL";
  const transaction = label(asset?.type) || "Sale";
  const title = asset?.title || "Property Details";
  const address = [asset?.location, asset?.city, asset?.area, asset?.pincode]
    .filter(Boolean)
    .filter((value: unknown, index: number, all: unknown[]) => all.indexOf(value) === index)
    .join(", ");
  const shareUrl = `${getWebAppOrigin()}/shared/inventory/${shareToken}`;
  const safeIndex = Math.min(imageIndex, Math.max(images.length - 1, 0));
  const lat = Number(asset?.siteLocation?.lat);
  const lng = Number(asset?.siteLocation?.lng);
  const hasPin = asset?.siteLocation?.lat != null && asset?.siteLocation?.lng != null && Number.isFinite(lat) && Number.isFinite(lng);

  const amenityList = useMemo(() => {
    const entries: Row[] = [
      ["Reception Area", layout.receptionArea], ["Waiting Area", layout.waitingArea], ["Pantry", amenities.pantry],
      ["Cafeteria", amenities.cafeteria], ["Server Room", amenities.serverRoom], ["Power Backup", amenities.powerBackup],
      ["Central AC", amenities.centralAC], ["Lift", amenities.liftAvailable], ["Security", residential?.amenities?.security],
      ["Gym", residential?.amenities?.gym], ["Storage Room", amenities.storageRoom], ["Breakout Area", amenities.breakoutArea],
      ["Fire Safety", building.fireSafety], ["Modular Kitchen", residential?.amenities?.modularKitchen],
      ["Lift", residential?.amenities?.lift], ["Power Backup", residential?.amenities?.powerBackup],
      ["Swimming Pool", residential?.amenities?.swimmingPool], ["Clubhouse", residential?.amenities?.clubhouse],
      ["Electricity Backup", residential?.utilities?.electricityBackup], ["Gas Pipeline", residential?.utilities?.gasPipeline],
    ];
    const names = entries.filter(([, active]) => active).map(([name]) => name);
    /* Older listings carry a plain amenity list instead of the flags. */
    const listed = Array.isArray(asset?.amenities) ? asset.amenities.map((value: unknown) => String(value || "").trim()).filter(Boolean) : [];
    return [...new Set([...names, ...listed])];
  }, [asset?.amenities, layout, amenities, residential, building]);

  const summaryRows: Row[] = [
    ["Project", asset?.projectName], ["Property ID", asset?.propertyId],
    ["Property Type", label(asset?.inventoryType)],
    [isCommercial ? "Commercial Type" : "Residential Type", label(isCommercial ? commercial.officeType : residential.propertyType)],
    ["Furnishing", label(asset?.furnishingStatus)], ["Built-up Area", area(asset?.builtUpArea, asset?.areaUnit)],
    ["Total Floors", asset?.totalFloors ?? building.totalFloors],
    ["Maintenance", shown(asset?.maintenanceCharges) ? price(asset.maintenanceCharges) : null],
  ];
  const infoRows: Row[] = [
    ["Project", asset?.projectName], ["Property ID", asset?.propertyId],
    ["Category", label(asset?.category)], ["Furnishing", label(asset?.furnishingStatus)],
    ["Total Floors", asset?.totalFloors],
  ];
  const detailRows: Row[] = isCommercial
    ? [
        ["Commercial Property Type", label(commercial.officeType)], ["Cabins", layout.totalCabins],
        ["Cabin Seats", layout.cabinSeats], ["Workstations", layout.workstations ?? layout.seats],
        ["Conference Rooms", layout.conferenceRooms], ["Conference Seats", layout.conferenceSeats],
        ["Parking Type", label(building.parkingType)], ["Parking Slots", building.parkingSlots],
      ]
    : [
        ["Property Type", label(residential.propertyType)], ["BHK", label(residential.bhkType)],
        ["Bedrooms", residential.bedrooms], ["Bathrooms", residential.bathrooms], ["Parking Slots", residential.parking],
      ];
  type MetricRow = { icon: GlyphName; name: string; value: unknown; alert?: boolean };
  const metricRows: MetricRow[] = [
    { icon: "business-outline", name: "Property Type", value: label(asset?.inventoryType) },
    { icon: "briefcase-outline", name: isCommercial ? "Office Type" : "Home Type", value: label(isCommercial ? commercial.officeType : residential.propertyType) },
    ...(isCommercial
      ? ([
          { icon: "people-outline", name: "Cabins", value: layout.totalCabins },
          { icon: "people-outline", name: "Workstations", value: layout.workstations ?? layout.seats },
          { icon: "people-outline", name: "Conference Rooms", value: layout.conferenceRooms },
          { icon: "key-outline", name: "Ready to Move", value: yesNo(availability.readyToMove), alert: availability.readyToMove === false },
        ] as MetricRow[])
      : []),
  ];
  const metrics = metricRows.filter((row) => shown(row.value));
  const files = [
    ...docs.map((url, i) => ({ url, name: `Document ${i + 1}` })),
    ...plans.map((url, i) => ({ url, name: `Floor Plan ${i + 1}` })),
    ...videos.map((url, i) => ({ url, name: `Video Tour ${i + 1}` })),
  ];
  const carpet = area(asset?.carpetArea ?? asset?.totalArea, asset?.areaUnit);
  const headlinePrice = price(transaction === "Rent" ? asset?.rent ?? asset?.price : asset?.price);

  const shareListing = async () => {
    try {
      await Share.share({ title, message: `${title}\n${shareUrl}`, url: shareUrl });
    } catch {
      /* dismissed */
    }
  };

  /* Web's "Print / Save PDF": the system print dialog offers both. */
  const printListing = async () => {
    const rows = (list: Row[]) =>
      list
        .filter(([, value]) => shown(value))
        .map(([name, value]) => `<tr><td style="color:#64748b;padding:4px 12px 4px 0">${escapeHtml(name)}</td><td style="font-weight:600">${escapeHtml(value)}</td></tr>`)
        .join("");
    const html = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
      <body style="font-family:-apple-system,Roboto,Arial,sans-serif;color:#0f172a;padding:24px">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#047857;font-weight:700">Office on Rent · Property Showcase</div>
        <h1 style="margin:8px 0 4px">${escapeHtml(title)}</h1>
        ${address ? `<div style="color:#475569">${escapeHtml(address)}</div>` : ""}
        <div style="margin:10px 0;color:#475569">${escapeHtml(label(asset?.status) || "Available")} · ${escapeHtml(transaction)}${label(asset?.inventoryType) ? ` · ${escapeHtml(label(asset?.inventoryType))}` : ""}</div>
        <div style="font-size:26px;font-weight:800;color:#065f46">${escapeHtml(headlinePrice)}</div>
        <div style="color:#64748b;font-size:12px">${transaction === "Rent" ? "Monthly Rent" : "Asking Price"}${carpet ? ` · Carpet area ${escapeHtml(carpet)}` : ""}</div>
        ${images.length ? `<div style="margin:16px 0;display:flex;flex-wrap:wrap;gap:8px">${images.slice(0, 6).map((url) => `<img src="${escapeHtml(url)}" style="width:48%;height:180px;object-fit:cover;border-radius:8px"/>`).join("")}</div>` : ""}
        <h3>Summary</h3><table style="font-size:13px">${rows(summaryRows)}</table>
        <h3>${isCommercial ? "Commercial Details" : "Residential Details"}</h3><table style="font-size:13px">${rows(detailRows)}</table>
        ${amenityList.length ? `<h3>Amenities</h3><div style="font-size:13px">${amenityList.map(escapeHtml).join(" · ")}</div>` : ""}
        ${hasPin ? `<h3>Location</h3><div style="font-size:13px">${escapeHtml(address || "Property location")} (${lat}, ${lng})</div>` : ""}
        <p style="margin-top:24px;text-align:center;font-size:11px;color:#94a3b8">Shared securely via Office on Rent</p>
      </body></html>`;
    setPrinting(true);
    try {
      await Print.printAsync({ html });
    } catch {
      /* dismissed */
    } finally {
      setPrinting(false);
    }
  };

  const openFile = (url: string) => {
    void Linking.openURL(url).catch(() => undefined);
  };

  const openInMaps = () => {
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() => undefined);
  };

  if (loading) {
    return (
      <Screen title="Listing" subtitle="Shared with you">
        <AppSkeletonList rows={3} />
      </Screen>
    );
  }

  if (!asset) {
    return (
      <Screen title="Listing" subtitle="Shared with you">
        <AppEmptyState title="Link unavailable" description={error || "Ask whoever shared this to send a fresh link."} />
      </Screen>
    );
  }

  const galleryWidth = Math.min(width - 32, 720);

  return (
    <Screen title={title} subtitle="Property Showcase">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {address ? (
          <View style={styles.addressRow}>
            <Glyph name="location-outline" size={15} color={themePalette.slate[500]} />
            <Text style={styles.address}>{address}</Text>
          </View>
        ) : null}
        <View style={styles.badges}>
          <AppBadge variant={String(asset?.status).toLowerCase() === "available" ? "emerald" : "slate"}>
            {label(asset?.status) || "Available"}
          </AppBadge>
          <AppBadge variant="slate">{transaction}</AppBadge>
          {label(asset?.inventoryType) ? <AppBadge variant="slate">{label(asset?.inventoryType) as string}</AppBadge> : null}
        </View>

        {images.length ? (
          <View style={styles.gallery}>
            <Pressable onPress={() => setLightbox(true)} accessibilityRole="button" accessibilityLabel="Enlarge photo">
              <Image source={{ uri: images[safeIndex] }} style={[styles.stage, { width: galleryWidth }]} resizeMode="cover" />
            </Pressable>
            <Text style={styles.counter}>{safeIndex + 1}/{images.length}</Text>
            {images.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
                {images.map((url, index) => (
                  <Pressable
                    key={`${url}-${index}`}
                    onPress={() => setImageIndex(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Show photo ${index + 1}`}
                    accessibilityState={{ selected: index === safeIndex }}
                  >
                    <Image source={{ uri: url }} style={[styles.thumb, index === safeIndex && styles.thumbOn]} />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>
        ) : null}

        <AppCard style={styles.card}>
          <View style={styles.priceRow}>
            <View style={styles.priceCol}>
              <Text style={styles.priceLabel}>{transaction === "Rent" ? "Monthly Rent" : "Asking Price"}</Text>
              <Text style={styles.price}>{headlinePrice}</Text>
            </View>
            {carpet ? (
              <View style={styles.carpet}>
                <Text style={styles.priceLabel}>Carpet Area</Text>
                <Text style={styles.carpetValue}>{carpet}</Text>
              </View>
            ) : null}
          </View>
          {summaryRows.filter(([, value]) => shown(value)).map(([name, value], index) => (
            <DetailRow key={`${name}-${index}`} name={name} value={value} />
          ))}
          <View style={styles.actions}>
            <Pressable style={styles.action} onPress={printListing} disabled={printing} accessibilityRole="button">
              <Glyph name="download-outline" size={15} color={themePalette.emerald[800]} />
              <Text style={styles.actionText}>{printing ? "Preparing…" : "Print / Save PDF"}</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={shareListing} accessibilityRole="button">
              <Glyph name="share-social-outline" size={15} color={themePalette.emerald[800]} />
              <Text style={styles.actionText}>Share</Text>
            </Pressable>
          </View>
        </AppCard>

        {metrics.length ? (
          <View style={styles.metrics}>
            {metrics.map((metric) => (
              <View key={metric.name} style={styles.metric}>
                <Glyph name={metric.icon} size={18} color={themePalette.emerald[700]} />
                <View style={styles.metricBody}>
                  <Text style={styles.metricName}>{metric.name}</Text>
                  <Text style={[styles.metricValue, metric.alert && styles.metricAlert]}>{String(metric.value)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <Section icon="business-outline" title="Property Information" rows={infoRows} />
        <Section icon="briefcase-outline" title={isCommercial ? "Commercial Details" : "Residential Details"} rows={detailRows} />

        {amenityList.length ? (
          <AppCard style={styles.card}>
            <SectionHead icon="sparkles-outline" title="Amenities" />
            <View style={styles.amenities}>
              {amenityList.map((name) => (
                <View key={name} style={styles.amenity}>
                  <Glyph name="checkmark-circle" size={13} color={themePalette.emerald[700]} />
                  <Text style={styles.amenityText}>{name}</Text>
                </View>
              ))}
            </View>
          </AppCard>
        ) : null}

        {asset?.description ? (
          <AppCard style={styles.card}>
            <SectionHead icon="document-text-outline" title="About this property" />
            <Text style={styles.description}>{asset.description}</Text>
          </AppCard>
        ) : null}

        {files.length ? (
          <AppCard style={styles.card}>
            <SectionHead icon="document-text-outline" title="Files & Media" />
            {files.map((file) => (
              <Pressable key={`${file.url}-${file.name}`} style={styles.file} onPress={() => openFile(file.url)} accessibilityRole="link">
                <Glyph name="document-outline" size={16} color={themePalette.slate[600]} />
                <Text style={styles.fileName}>{file.name}</Text>
                <Glyph name="download-outline" size={15} color={themePalette.slate[500]} />
              </Pressable>
            ))}
          </AppCard>
        ) : null}

        {hasPin ? (
          <AppCard style={styles.card}>
            <SectionHead icon="map-outline" title="Location" />
            <View style={styles.locationNote}>
              <Glyph name="location" size={16} color={themePalette.emerald[700]} />
              <View style={styles.metricBody}>
                <Text style={styles.locationTitle}>{address || "Property location"}</Text>
                <Text style={styles.metricName}>Explore the location and nearby connectivity.</Text>
              </View>
            </View>
            <MapFrame lat={lat} lng={lng} height={220} />
            <Pressable style={[styles.action, styles.mapsBtn]} onPress={openInMaps} accessibilityRole="button">
              <Glyph name="navigate-outline" size={15} color={themePalette.emerald[800]} />
              <Text style={styles.actionText}>Open in Maps</Text>
            </Pressable>
          </AppCard>
        ) : null}

        <Text style={styles.footer}>Shared securely via Office on Rent</Text>
      </ScrollView>

      <Modal visible={lightbox && images.length > 0} transparent animationType="fade" onRequestClose={() => setLightbox(false)}>
        <View style={styles.lightbox}>
          <Pressable style={styles.lightboxClose} onPress={() => setLightbox(false)} accessibilityRole="button" accessibilityLabel="Close photo viewer">
            <Glyph name="close" size={26} color="#ffffff" />
          </Pressable>
          <Image source={{ uri: images[safeIndex] }} style={styles.lightboxImage} resizeMode="contain" />
          {images.length > 1 ? (
            <View style={styles.lightboxNav}>
              <Pressable
                style={styles.lightboxBtn}
                onPress={() => setImageIndex((i) => (i <= 0 ? images.length - 1 : i - 1))}
                accessibilityRole="button"
                accessibilityLabel="Previous photo"
              >
                <Glyph name="chevron-back" size={26} color="#ffffff" />
              </Pressable>
              <Text style={styles.lightboxCount}>{safeIndex + 1}/{images.length}</Text>
              <Pressable
                style={styles.lightboxBtn}
                onPress={() => setImageIndex((i) => (i >= images.length - 1 ? 0 : i + 1))}
                accessibilityRole="button"
                accessibilityLabel="Next photo"
              >
                <Glyph name="chevron-forward" size={26} color="#ffffff" />
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
};

const DetailRow = ({ name, value }: { name: string; value: unknown }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailName}>{name}</Text>
    <Text style={styles.detailValue}>{String(value)}</Text>
  </View>
);

const SectionHead = ({ icon, title }: { icon: GlyphName; title: string }) => (
  <View style={styles.sectionHead}>
    <Glyph name={icon} size={17} color={themePalette.emerald[700]} />
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const Section = ({ icon, title, rows }: { icon: GlyphName; title: string; rows: Row[] }) => {
  const visible = rows.filter(([, value]) => shown(value));
  if (!visible.length) return null;
  return (
    <AppCard style={styles.card}>
      <SectionHead icon={icon} title={title} />
      {visible.map(([name, value], index) => (
        <DetailRow key={`${name}-${index}`} name={name} value={value} />
      ))}
    </AppCard>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  body: { paddingBottom: spacing.xxl },
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: spacing.sm },
  address: { flex: 1, fontSize: typography.label, color: c.slate[600] },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.md },
  gallery: { marginBottom: spacing.md },
  stage: { height: 220, borderRadius: 14, backgroundColor: c.slate[100] },
  counter: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
    backgroundColor: "rgba(15,23,42,0.6)",
  },
  thumbs: { gap: 8, paddingTop: 8 },
  thumb: { width: 64, height: 48, borderRadius: 8, opacity: 0.7 },
  thumbOn: { opacity: 1, borderWidth: 2, borderColor: c.emerald[600] },
  card: { marginBottom: spacing.md },
  priceRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.md, marginBottom: spacing.sm },
  priceCol: { flex: 1 },
  priceLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", color: c.emerald[700] },
  price: { marginTop: 2, fontSize: 24, fontWeight: "800", color: c.emerald[900] },
  carpet: { paddingLeft: spacing.md, borderLeftWidth: 1, borderLeftColor: c.emerald[200] },
  carpetValue: { marginTop: 2, fontSize: typography.body, fontWeight: "700", color: c.text },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  detailName: { fontSize: 12, color: c.slate[500] },
  detailValue: { flexShrink: 1, textAlign: "right", fontSize: 12, fontWeight: "600", color: c.slate[800] },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.emerald[700],
  },
  actionText: { fontSize: 12, fontWeight: "700", color: c.emerald[800] },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  metric: {
    flexGrow: 1,
    flexBasis: "46%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  metricBody: { flex: 1 },
  metricName: { fontSize: 11, color: c.slate[500] },
  metricValue: { marginTop: 1, fontSize: 13, fontWeight: "700", color: c.slate[800] },
  metricAlert: { color: c.rose[600] },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.sm },
  sectionTitle: { fontSize: typography.cardTitle, fontWeight: "700", color: c.text },
  amenities: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  amenity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: c.emerald[50],
  },
  amenityText: { fontSize: 12, fontWeight: "600", color: c.emerald[800] },
  description: { fontSize: typography.body, lineHeight: 20, color: c.slate[600] },
  file: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  fileName: { flex: 1, fontSize: 13, fontWeight: "600", color: c.text },
  locationNote: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    marginBottom: spacing.sm,
    borderRadius: 12,
    backgroundColor: c.surfaceMuted,
  },
  locationTitle: { fontSize: 13, fontWeight: "700", color: c.text },
  mapsBtn: { flex: 0, marginTop: spacing.sm },
  footer: { marginTop: spacing.lg, textAlign: "center", fontSize: typography.caption, color: c.slate[400] },
  lightbox: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(2,6,23,0.94)" },
  lightboxClose: { position: "absolute", top: 48, right: 20, zIndex: 2, padding: 6 },
  lightboxImage: { width: "100%", height: "75%" },
  lightboxNav: { flexDirection: "row", alignItems: "center", gap: 24, marginTop: 16 },
  lightboxBtn: { padding: 8 },
  lightboxCount: { fontSize: 13, fontWeight: "700", color: "#ffffff" },
}));
