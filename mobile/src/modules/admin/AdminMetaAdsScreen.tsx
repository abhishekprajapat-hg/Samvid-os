import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Screen } from "../../components/common/Screen";
import { AppButton, AppCard, AppInput } from "../../components/common/ui";
import { colors, radii, spacing, typography } from "../../theme/tokens";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  getMyTenantMetaIntegration,
  updateMyTenantMetaIntegration,
  type MetaIntegration,
} from "../../services/saasService";
import { themePalette, themedStyles } from "../../theme/themedStyles";

/*
 * Mirrors modules/admin/AdminMetaAdsPanel.jsx - the Meta lead-ads integration
 * for this tenant: which pages feed leads in, whether an access token is
 * configured, and the webhook URLs to paste into Meta's app settings.
 *
 * The access token is never returned in full by the API, only a preview, so the
 * input here always writes a new value rather than editing the existing one.
 */

const ReadOnlyField = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Pressable
      style={styles.readOnly}
      onPress={async () => {
        if (!value) return;
        await Clipboard.setStringAsync(value);
        Alert.alert("Copied", `${label} copied to the clipboard.`);
      }}
    >
      <Text style={styles.readOnlyText} numberOfLines={2}>
        {value || "—"}
      </Text>
      {value ? <Text style={styles.copyHint}>Tap to copy</Text> : null}
    </Pressable>
  </View>
);

export const AdminMetaAdsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [integration, setIntegration] = useState<MetaIntegration | null>(null);
  const [pageIdsInput, setPageIdsInput] = useState("");
  const [accessTokenInput, setAccessTokenInput] = useState("");

  const apply = useCallback((next: MetaIntegration | null) => {
    setIntegration(next);
    setPageIdsInput((Array.isArray(next?.pageIds) ? next?.pageIds : []).join(", "));
    setAccessTokenInput("");
  }, []);

  const load = useCallback(async () => {
    setError("");
    try {
      apply(await getMyTenantMetaIntegration());
    } catch (err) {
      setError(toErrorMessage(err, "Could not load the Meta integration"));
    }
  }, [apply]);

  useEffect(() => {
    let alive = true;
    (async () => {
      await load();
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const pageIds = pageIdsInput
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      const payload: Record<string, unknown> = { pageIds };
      // Only send a token when one was typed - an empty field means "leave the
      // stored token alone", not "clear it".
      if (accessTokenInput.trim()) payload.accessToken = accessTokenInput.trim();

      apply(await updateMyTenantMetaIntegration(payload));
      Alert.alert("Meta Ads", "Integration updated.");
    } catch (err) {
      Alert.alert("Meta Ads", toErrorMessage(err, "Could not save the integration"));
    } finally {
      setSaving(false);
    }
  }, [accessTokenInput, apply, pageIdsInput, saving]);

  const clearToken = useCallback(() => {
    Alert.alert("Remove access token", "Lead delivery will stop until a new token is set.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setSaving(true);
          try {
            apply(await updateMyTenantMetaIntegration({ clearAccessToken: true }));
          } catch (err) {
            Alert.alert("Meta Ads", toErrorMessage(err, "Could not remove the token"));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }, [apply]);

  const ready = Boolean(integration?.readiness?.ready);
  const missing = Array.isArray(integration?.readiness?.missing) ? integration!.readiness!.missing! : [];
  const tokenSet = Boolean(integration?.accessTokenConfigured);

  return (
    <Screen
      title="Meta Ads"
      subtitle={integration?.companyName || "Lead integration"}
      loading={loading}
      error={error}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <AppCard style={styles.card as object}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: ready ? themePalette.success : themePalette.warning },
              ]}
            />
            <Text style={styles.statusText}>
              {ready ? "Connected and receiving leads" : "Not ready"}
            </Text>
          </View>

          {!ready && missing.length ? (
            <View style={styles.missingBox}>
              <Text style={styles.missingHeading}>Still needed</Text>
              {missing.map((item) => (
                <Text key={item} style={styles.missingItem}>
                  • {String(item).replace(/_/g, " ")}
                </Text>
              ))}
            </View>
          ) : null}
        </AppCard>

        <AppCard style={styles.card as object}>
          <Text style={styles.cardTitle}>Configuration</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Meta page IDs</Text>
            <AppInput
              value={pageIdsInput}
              onChangeText={setPageIdsInput}
              placeholder="Comma separated page IDs"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Access token {tokenSet ? `(set · ${integration?.accessTokenPreview || "••••"})` : "(not set)"}
            </Text>
            <AppInput
              value={accessTokenInput}
              onChangeText={setAccessTokenInput}
              placeholder={tokenSet ? "Enter a new token to replace" : "Paste the Meta access token"}
              autoCapitalize="none"
              secureTextEntry
            />
          </View>

          <AppButton
            title={saving ? "Saving..." : "Save changes"}
            disabled={saving}
            onPress={save}
            style={styles.fullWidth as object}
          />

          {tokenSet ? (
            <Pressable onPress={clearToken} disabled={saving} style={styles.dangerLink}>
              <Text style={styles.dangerLinkText}>Remove stored access token</Text>
            </Pressable>
          ) : null}
        </AppCard>

        <AppCard style={styles.card as object}>
          <Text style={styles.cardTitle}>Webhook</Text>
          <Text style={styles.cardNote}>
            Paste these into the Meta app's webhook settings for the lead ads product.
          </Text>
          <ReadOnlyField label="Callback URL" value={String(integration?.webhook?.globalCallbackUrl || "")} />
          <ReadOnlyField
            label="Tenant callback URL"
            value={String(integration?.webhook?.tenantScopedCallbackUrl || "")}
          />
          <ReadOnlyField label="Subdomain" value={String(integration?.subdomain || "")} />
        </AppCard>
      </ScrollView>
    </Screen>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.section,
    fontWeight: "700",
    color: c.text,
    marginBottom: spacing.sm,
  },
  cardNote: {
    fontSize: typography.body,
    color: c.textMuted,
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: typography.section,
    fontWeight: "700",
    color: c.text,
  },
  missingBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.warning,
    backgroundColor: c.warningBg,
  },
  missingHeading: {
    fontSize: typography.label,
    fontWeight: "700",
    color: c.warning,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  missingItem: {
    fontSize: typography.body,
    color: c.warning,
    textTransform: "capitalize",
  },
  field: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.label,
    fontWeight: "600",
    color: c.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  readOnly: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readOnlyText: {
    fontSize: typography.body,
    color: c.text,
  },
  copyHint: {
    marginTop: 4,
    fontSize: typography.label,
    color: c.textMuted,
  },
  fullWidth: {
    width: "100%",
  },
  dangerLink: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  dangerLinkText: {
    fontSize: typography.body,
    fontWeight: "600",
    color: c.error,
  },
}));
