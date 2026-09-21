import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/common/Screen";
import { AppCard } from "../../components/ui";
import { palette, spacing, typography } from "../../theme/tokens";
import {
  LEGAL_LAST_UPDATED,
  PRIVACY_SECTIONS,
  TERMS_SECTIONS,
  type LegalSection,
} from "./legalContent";
import { themedStyles, themePalette } from "../../theme/themedStyles";

/*
 * Mirrors modules/legal/DataUseNotice.jsx and ServiceTermsNotice.jsx.
 *
 * One renderer, two documents - the web pages differ only in their heading and
 * their section list.
 *
 * These are registered in the auth stack as well as the app stack, deliberately:
 * both stores expect a reviewer to reach the privacy policy and terms without
 * signing in, and the whole rest of this app is behind a login.
 */

const LegalBody = ({ sections }: { sections: LegalSection[] }) => (
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
    <Text style={styles.updated}>Last updated {LEGAL_LAST_UPDATED}</Text>
    {sections.map((section) => (
      <AppCard key={section.title} style={styles.card}>
        <Text style={styles.title}>{section.title}</Text>
        <Text style={styles.text}>{section.body}</Text>
      </AppCard>
    ))}
    <View style={styles.footer}>
      <Text style={styles.footerText}>The Office On Rent</Text>
    </View>
  </ScrollView>
);

export const DataUseNoticeScreen = () => (
  <Screen title="Privacy Policy" subtitle="How your data is handled">
    <LegalBody sections={PRIVACY_SECTIONS} />
  </Screen>
);

export const ServiceTermsNoticeScreen = () => (
  <Screen title="Terms & Conditions" subtitle="Using this platform">
    <LegalBody sections={TERMS_SECTIONS} />
  </Screen>
);

const styles = themedStyles((c) => StyleSheet.create({
  body: { paddingBottom: spacing.xxl },
  updated: {
    fontSize: typography.caption,
    color: themePalette.slate[500],
    marginBottom: spacing.lg,
  },
  card: { marginBottom: spacing.md },
  title: {
    fontSize: typography.cardTitle,
    fontWeight: "600",
    color: themePalette.slate[900],
    marginBottom: spacing.sm,
  },
  text: { fontSize: typography.body, lineHeight: 20, color: themePalette.slate[600] },
  footer: { marginTop: spacing.lg, alignItems: "center" },
  footerText: { fontSize: typography.caption, color: themePalette.slate[400] },
}));
