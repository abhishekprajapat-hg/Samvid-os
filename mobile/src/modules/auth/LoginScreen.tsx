import React, { useEffect, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Hexagon } from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { toErrorMessage } from "../../utils/errorMessage";
import { AppButton, AppChip, AppInput } from "../../components/common/ui";

import {
  PRIVACY_SECTIONS as CANONICAL_PRIVACY,
  TERMS_SECTIONS as CANONICAL_TERMS,
  type LegalSection,
} from "../legal/legalContent";
import { themedStyles, themeColor } from "../../theme/themedStyles";

type Portal = "GENERAL" | "ADMIN";
type LegalDoc = "TERMS" | "PRIVACY" | null;

/*
 * The login screen used to carry its own abbreviated copy of the terms and
 * privacy text, with different headings from the real policy - two different
 * statements of the company's legal position, either of which could drift.
 * Both modals now read the canonical content, the same text the Privacy and
 * Terms screens render.
 */
const asModalSections = (sections: LegalSection[]) =>
  sections.map((section) => ({ heading: section.title, body: section.body }));

const TERMS_SECTIONS = asModalSections(CANONICAL_TERMS);
const PRIVACY_SECTIONS = asModalSections(CANONICAL_PRIVACY);

export const LoginScreen = () => {
  const { login } = useAuth();

  const [portal, setPortal] = useState<Portal>("ADMIN");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openDoc, setOpenDoc] = useState<LegalDoc>(null);

  useEffect(() => {
    if (email.trim().toLowerCase() === "admin@test.com") {
      setPortal("ADMIN");
    }
  }, [email]);

  const docTitle = openDoc === "TERMS" ? "Terms And Conditions" : "Privacy Policy";
  const docSections = openDoc === "TERMS" ? TERMS_SECTIONS : PRIVACY_SECTIONS;

  const submitLogin = async () => {
    try {
      setLoading(true);
      setError("");
      const normalizedEmail = email.trim().toLowerCase();
      const effectivePortal: Portal = normalizedEmail === "admin@test.com" ? "ADMIN" : portal;
      await login({ email: normalizedEmail, password, portal: effectivePortal });
    } catch (e) {
      setError(toErrorMessage(e, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.logoWrap}>
          <Hexagon size={28} color={themeColor("#161c24")} strokeWidth={2.2} />
        </View>

        <Text style={styles.title}>{portal === "GENERAL" ? "GENERAL LOGIN" : "ADMIN LOGIN"}</Text>

        <View style={styles.portalRow}>
          <AppChip
            label="General Portal"
            active={portal === "GENERAL"}
            onPress={() => setPortal("GENERAL")}
            testID="login-general-portal"
            style={styles.flexChip as object}
          />
          <AppChip
            label="Admin Portal"
            active={portal === "ADMIN"}
            onPress={() => setPortal("ADMIN")}
            testID="login-admin-portal"
            style={styles.flexChip as object}
          />
        </View>

        <AppInput
          style={styles.input as object}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          accessibilityLabel="Email"
          testID="login-email"
        />

        <AppInput
          style={styles.input as object}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          accessibilityLabel="Password"
          testID="login-password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <AppButton
          style={styles.submitButton as object}
          disabled={loading}
          title={loading ? "Please wait..." : "Login"}
          onPress={submitLogin}
          accessibilityLabel="Login"
          testID="login-submit"
        />

        <View style={styles.divider} />
        <Text style={styles.terms}>
          By continuing, you agree to our{" "}
          <Text style={styles.termsLink} onPress={() => setOpenDoc("TERMS")}>
            Terms
          </Text>{" "}
          and{" "}
          <Text style={styles.termsLink} onPress={() => setOpenDoc("PRIVACY")}>
            Privacy Policy
          </Text>
          .
        </Text>
      </View>

      <Modal visible={openDoc !== null} animationType="slide" transparent onRequestClose={() => setOpenDoc(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalKicker}>LEGAL</Text>
                <Text style={styles.modalTitle}>{docTitle}</Text>
              </View>
              <Pressable onPress={() => setOpenDoc(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.sectionList}>
                {docSections.map((item) => (
                  <View key={item.heading} style={styles.sectionCard}>
                    <Text style={styles.sectionHeading}>{item.heading}</Text>
                    <Text style={styles.sectionBody}>{item.body}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  root: {
    flex: 1,
    padding: 24,
    backgroundColor: c.surfaceMuted,
    justifyContent: "center",
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: c.border,
    padding: 20,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 8px 20px rgba(15, 23, 42, 0.08)" }
      : {
        shadowColor: c.text,
        shadowOpacity: 0.08,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
      }),
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
    fontSize: 32,
    fontWeight: "800",
    color: c.text,
    letterSpacing: 0.6,
  },
  portalRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  flexChip: {
    flex: 1,
    alignSelf: "stretch",
  },
  input: {
    height: 50,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: c.surface,
    borderColor: c.borderStrong,
  },
  submitButton: {
    marginTop: 4,
    height: 46,
    borderRadius: 12,
  },
  divider: {
    height: 1,
    backgroundColor: c.borderStrong,
    marginTop: 18,
    marginBottom: 12,
  },
  terms: {
    textAlign: "center",
    color: c.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  termsLink: {
    color: c.text,
    fontWeight: "700",
  },
  error: {
    color: c.rose[700],
    marginBottom: 10,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "center",
    padding: 12,
  },
  modalCard: {
    backgroundColor: c.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    maxHeight: "92%",
    padding: 12,
  },
  modalHeader: {
    flexDirection: "column",
    alignItems: "stretch",
    marginBottom: 10,
  },
  modalTitleWrap: {
    marginBottom: 10,
  },
  modalKicker: {
    fontSize: 10,
    letterSpacing: 1.8,
    color: c.textMuted,
    fontWeight: "700",
  },
  modalTitle: {
    fontSize: 34,
    lineHeight: 36,
    fontWeight: "700",
    color: c.text,
  },
  closeBtn: {
    backgroundColor: c.text,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignSelf: "flex-end",
  },
  closeBtnText: {
    color: c.surface,
    fontWeight: "700",
    fontSize: 12,
  },
  sectionList: {
    gap: 8,
    paddingBottom: 6,
  },
  sectionCard: {
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    padding: 10,
  },
  sectionHeading: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: c.slate[700],
    fontWeight: "800",
    marginBottom: 6,
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 19,
    color: c.slate[600],
  },
}));
