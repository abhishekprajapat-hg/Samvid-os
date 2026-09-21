import React, { useCallback, useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import { Screen } from "../../components/common/Screen";
import { AppBadge, AppCard, AppEmptyState, AppSkeletonList } from "../../components/ui";
import { palette, spacing, typography } from "../../theme/tokens";
import { toErrorMessage } from "../../utils/errorMessage";
import { getSharedInventory } from "../../services/publicInventoryService";
import { toAbsoluteUrl } from "../../services/uploadService";

/*
 * Mirrors modules/inventory/SharedInventoryView.jsx.
 *
 * Reached by a share token, with no session: this is what someone outside the
 * company sees when a listing is shared with them. It must therefore never
 * touch the authenticated api instance, never assume a signed-in user, and
 * never offer an action - see publicInventoryService for why it has its own
 * axios client.
 */

const formatPrice = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "Price on request";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
};

export const SharedInventoryViewScreen = () => {
  const route = useRoute<any>();
  const shareToken = String(route.params?.shareToken || "");

  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSharedInventory(shareToken);
      setAsset(data);
      setError(data ? "" : "This link is no longer valid.");
    } catch (err) {
      setError(toErrorMessage(err, "This link is no longer valid."));
    } finally {
      setLoading(false);
    }
  }, [shareToken]);

  useEffect(() => {
    void load();
  }, [load]);

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
        <AppEmptyState
          title="Link expired"
          description={error || "Ask whoever shared this to send a fresh link."}
        />
      </Screen>
    );
  }

  const images: string[] = Array.isArray(asset.images) ? asset.images : [];

  return (
    <Screen title={asset.title || "Listing"} subtitle={asset.location || "Shared with you"}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {images.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
            {images.map((image, index) => (
              <Image
                key={`${image}-${index}`}
                source={{ uri: toAbsoluteUrl(image) }}
                style={styles.image}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        ) : null}

        <AppCard style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>{asset.title || "Listing"}</Text>
            {asset.status ? <AppBadge variant="slate">{String(asset.status)}</AppBadge> : null}
          </View>
          <Text style={styles.price}>{formatPrice(asset.price)}</Text>
          {asset.location ? <Text style={styles.meta}>{asset.location}</Text> : null}
          {asset.type ? <Text style={styles.meta}>{String(asset.type).replace(/_/g, " ")}</Text> : null}
          {asset.description ? <Text style={styles.description}>{asset.description}</Text> : null}
        </AppCard>

        {Array.isArray(asset.amenities) && asset.amenities.length > 0 ? (
          <AppCard style={styles.card}>
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.amenities}>
              {asset.amenities.map((amenity: string, index: number) => (
                <AppBadge key={`${amenity}-${index}`} variant="slate">
                  {amenity}
                </AppBadge>
              ))}
            </View>
          </AppCard>
        ) : null}

        <Text style={styles.footer}>Shared from The Office On Rent</Text>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  body: { paddingBottom: spacing.xxl },
  gallery: { marginBottom: spacing.lg },
  image: { width: 260, height: 170, borderRadius: 14, marginRight: spacing.md },
  card: { marginBottom: spacing.md },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: { flex: 1, fontSize: typography.title, fontWeight: "600", color: palette.slate[900] },
  price: { marginTop: spacing.sm, fontSize: typography.displayMd, fontWeight: "700", color: palette.blue[600] },
  meta: { marginTop: 3, fontSize: typography.label, color: palette.slate[500] },
  description: {
    marginTop: spacing.lg,
    fontSize: typography.body,
    lineHeight: 20,
    color: palette.slate[600],
  },
  sectionTitle: {
    fontSize: typography.cardTitle,
    fontWeight: "600",
    color: palette.slate[900],
    marginBottom: spacing.md,
  },
  amenities: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  footer: {
    marginTop: spacing.lg,
    textAlign: "center",
    fontSize: typography.caption,
    color: palette.slate[400],
  },
});
