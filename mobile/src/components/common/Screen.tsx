import React from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Glyph } from "../ui/Glyph";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";

/*
 * The page shell. Plays the part of the web app's page header inside
 * WorkbenchShell: a title, an optional eyebrow, and the body beneath.
 *
 * The header used to be a floating translucent card with a 24px radius, which
 * was the old mobile look and nothing like web. Web's page header is flat - it
 * sits on the page background with no border, no fill and no shadow - so this
 * one is too.
 */

export const Screen = ({
  title,
  subtitle,
  description,
  back,
  loading,
  error,
  onRetry,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  /*
   * A sentence under the title. `subtitle` is the uppercase eyebrow that sits
   * above it; screens whose comp puts the explanation below the heading pass
   * this instead.
   */
  description?: string;
  /* A back affordance beside the title, for pushed screens whose comp draws
     one in the page header rather than relying on a navigator header. */
  back?: () => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) => {
  const insets = useSafeAreaInsets();
  // Android's gesture bar is not in the inset on every OEM skin; 16 is the floor.
  const androidBottom = Platform.OS === "android" ? 16 : 0;

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        {back ? (
          <Pressable
            onPress={back}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.back}
          >
            <Glyph name="arrow-back" size={20} color={brand.text} />
          </Pressable>
        ) : null}
        <View style={styles.headerText}>
          {subtitle ? <Text style={styles.eyebrow}>{subtitle}</Text> : null}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
        {right ? <View style={styles.headerRight}>{right}</View> : null}
      </View>

      {loading ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={brand.primary} />
        </View>
      ) : (
        <View style={[styles.body, { paddingBottom: 12 + Math.max(insets.bottom, androidBottom) }]}>
          {/*
           * The banner sits above the body rather than replacing it. Several
           * screens pass a transient failure here - a message that would not
           * send, a refresh that failed - while the content behind it is still
           * valid and still worth showing.
           */}
          {error ? (
            <Pressable
              onPress={onRetry}
              disabled={!onRetry}
              style={styles.errorBanner}
              accessibilityRole={onRetry ? "button" : "alert"}
            >
              <Text style={styles.errorText}>{error}</Text>
              {onRetry ? <Text style={styles.errorRetry}>Tap to retry</Text> : null}
            </Pressable>
          ) : null}

          {children}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = brandStyles((b) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: b.bg,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: round.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: b.surface,
    borderWidth: 1,
    borderColor: b.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: layout.pageGutter,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerText: {
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eyebrow: {
    fontSize: t.micro,
    lineHeight: 12,
    fontWeight: "700",
    color: b.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  title: {
    fontSize: t.pageTitle,
    lineHeight: 31,
    fontWeight: "800",
    color: b.text,
    letterSpacing: -0.55,
  },
  description: {
    marginTop: 3,
    fontSize: t.body,
    lineHeight: 17,
    color: b.textMuted,
  },
  body: {
    flex: 1,
    paddingHorizontal: layout.pageGutter,
  },
  centred: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBanner: {
    borderWidth: 1,
    borderColor: b.alertChip,
    borderRadius: round.banner,
    backgroundColor: b.alertTint,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: t.body,
    lineHeight: 17,
    color: b.alertInk,
  },
  errorRetry: {
    marginTop: 2,
    fontSize: t.label,
    fontWeight: "700",
    color: b.alertInk,
  },
}));
