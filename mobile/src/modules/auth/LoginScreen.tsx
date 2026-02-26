import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Hexagon } from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { toErrorMessage } from "../../utils/errorMessage";
import { AppButton, AppChip, AppInput } from "../../components/common/ui";

type Portal = "GENERAL" | "ADMIN";
type LegalDoc = "TERMS" | "PRIVACY" | null;

const TERMS_SECTIONS = [
  {
    heading: "ACCEPTANCE OF TERMS",
    body: "By accessing or using Samvid, you agree to these Terms and Conditions. If you do not agree, do not use the platform.",
  },
  {
    heading: "ELIGIBILITY AND ACCOUNTS",
    body: "You must use accurate account information and keep credentials secure. You are responsible for all activities performed through your account.",
  },
  {
    heading: "GOOGLE AUTHENTICATION AND INTEGRATION",
    body: "When Google Sign-In or Google APIs are used, you authorize Samvid to access approved Google account data and API scopes needed for product functions.",
  },
  {
    heading: "GOOGLE POLICY COMPLIANCE",
    body: "Use of Google-derived data is governed by Google API Services requirements. Our handling of such data follows the Google API Services User Data Policy, including Limited Use requirements.",
  },
  {
    heading: "PERMITTED USE",
    body: "You may use the service only for lawful business purposes related to property operations, lead handling, and approved collaboration workflows.",
  },
  {
    heading: "PROHIBITED CONDUCT",
    body: "You must not attempt unauthorized access, interfere with service availability, misuse Google integrations, extract data outside approved scope, or violate applicable laws.",
  },
  {
    heading: "DATA AND PRIVACY",
    body: "Your use of the platform is also subject to our Privacy Policy. You are responsible for lawful collection and processing of any third-party data you upload.",
  },
  {
    heading: "SERVICE AVAILABILITY",
    body: "We may modify, suspend, or discontinue features at any time for maintenance, security, compliance, or product updates.",
  },
  {
    heading: "DISCLAIMER AND LIABILITY",
    body: "The service is provided on an as-is available basis. To the maximum extent permitted by law, Samvid disclaims implied warranties and limits liability for indirect or consequential damages.",
  },
  {
    heading: "TERMINATION",
    body: "We may suspend or terminate access for misuse, policy violations, legal requirements, or security risk. You may stop using the service at any time.",
  },
  {
    heading: "CHANGES TO TERMS",
    body: "We may revise these Terms periodically. Continued use after updates means you accept the revised Terms.",
  },
];

const PRIVACY_SECTIONS = [
  {
    heading: "SCOPE",
    body: "This Privacy Policy explains how Samvid collects, uses, stores, and protects your information when you use our platform, including authentication and integrations with Google services.",
  },
  {
    heading: "DATA WE COLLECT",
    body: "We may collect account details (name, email, role), operational records (inventory, leads, activities), and technical metadata (device/browser logs, IP, session timestamp) required to provide and secure the services.",
  },
  {
    heading: "GOOGLE ACCOUNT AND API DATA",
    body: "If Google Sign-In or Google APIs are enabled, we may access your Google basic profile data (name, email address, profile image, Google user ID) and OAuth tokens required for authentication and authorized API actions.",
  },
  {
    heading: "HOW GOOGLE DATA IS USED",
    body: "Google data is used only to authenticate users, maintain secure sessions, and support approved product workflows. We do not use Google user data for advertising, profiling for ad targeting, or sale to third parties.",
  },
  {
    heading: "GOOGLE LIMITED USE COMMITMENT",
    body: "Our use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.",
  },
  {
    heading: "SHARING AND DISCLOSURE",
    body: "We may share data with authorized team members in your organization and essential service providers (hosting, security, analytics) under contractual controls. We may also disclose data when legally required.",
  },
  {
    heading: "RETENTION AND DELETION",
    body: "Data is retained only as long as needed for service delivery, legal compliance, and security. You can request deletion of your account data and associated records, subject to legal or audit requirements.",
  },
  {
    heading: "REVOKING GOOGLE ACCESS",
    body: "You can revoke app access from your Google Account permissions page at any time. Revocation may disable Google-linked features until re-authorized.",
  },
  {
    heading: "SECURITY",
    body: "We apply reasonable technical and organizational safeguards, including role-based access control, authentication controls, transport security, and operational logging to protect your data.",
  },
  {
    heading: "POLICY UPDATES",
    body: "We may update this policy periodically. Material changes will be reflected by revising the last updated date and, where required, notifying users through platform channels.",
  },
];

export const LoginScreen = () => {
  const { login } = useAuth();

  const [portal, setPortal] = useState<Portal>("GENERAL");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openDoc, setOpenDoc] = useState<LegalDoc>(null);

  const docTitle = openDoc === "TERMS" ? "Terms And Conditions" : "Privacy Policy";
  const docSections = openDoc === "TERMS" ? TERMS_SECTIONS : PRIVACY_SECTIONS;

  const submitLogin = async () => {
    try {
      setLoading(true);
      setError("");
      await login({ email: email.trim(), password, portal });
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
          <Hexagon size={28} color="#0f172a" strokeWidth={2.2} />
        </View>

        <Text style={styles.title}>{portal === "GENERAL" ? "GENERAL LOGIN" : "ADMIN LOGIN"}</Text>

        <View style={styles.portalRow}>
          <AppChip
            label="General Portal"
            active={portal === "GENERAL"}
            onPress={() => setPortal("GENERAL")}
            style={styles.flexChip as object}
          />
          <AppChip
            label="Admin Portal"
            active={portal === "ADMIN"}
            onPress={() => setPortal("ADMIN")}
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
        />

        <AppInput
          style={styles.input as object}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <AppButton
          style={styles.submitButton as object}
          disabled={loading}
          title={loading ? "Please wait..." : "Login"}
          onPress={submitLogin}
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 24,
    backgroundColor: "#eef2f7",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#dbe1ea",
    padding: 20,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
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
    color: "#0f172a",
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
    backgroundColor: "#ffffff",
    borderColor: "#d5dbe5",
  },
  submitButton: {
    marginTop: 4,
    height: 46,
    borderRadius: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "#d9e1ec",
    marginTop: 18,
    marginBottom: 12,
  },
  terms: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
  },
  termsLink: {
    color: "#0f172a",
    fontWeight: "700",
  },
  error: {
    color: "#b91c1c",
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
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dbe1ea",
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
    color: "#64748b",
    fontWeight: "700",
  },
  modalTitle: {
    fontSize: 34,
    lineHeight: 36,
    fontWeight: "700",
    color: "#0f172a",
  },
  closeBtn: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignSelf: "flex-end",
  },
  closeBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  sectionList: {
    gap: 8,
    paddingBottom: 6,
  },
  sectionCard: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
  },
  sectionHeading: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: "#334155",
    fontWeight: "800",
    marginBottom: 6,
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
  },
});
