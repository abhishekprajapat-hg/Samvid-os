import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import * as MailComposer from "expo-mail-composer";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import { AppSheet } from "../../components/ui/Overlay";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  getFinanceInvoice,
  type FinanceInvoice,
  type InvoicePayment,
} from "../../services/financeService";
import { exactMoney, fullDateOf, methodIcon, methodLabel, statusTone } from "./financeVocab";

/*
 * One invoice, drawn to the comp.
 *
 * Every number here is the billing service's - subtotal, GST, total and
 * amountPaid are computed there and never recomputed on the phone, so the app
 * and the desktop can never disagree about what is owed.
 */

const Fact = ({ icon, label, value }: { icon: GlyphName; label: string; value: string }) => (
  <View style={styles.fact}>
    <Glyph name={icon} size={17} color={brand.textSecondary} />
    <View style={styles.grow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  </View>
);

export const InvoiceDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const invoiceId = String(route.params?.invoiceId || "");
  const [invoice, setInvoice] = useState<FinanceInvoice | null>(null);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    if (!invoiceId) {
      setError("No invoice was passed in");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const result = await getFinanceInvoice(invoiceId);
      setInvoice(result.invoice);
      setPayments(result.payments);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load the invoice"));
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  /* A payment recorded on the next screen changes the balance here. */
  useFocusEffect(
    useCallback(() => {
      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invoiceId]),
  );

  const total = Number(invoice?.totalAmount || 0);
  const paid = Number(invoice?.amountPaid || 0);
  const balance = Math.max(0, total - paid);
  const share = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const tone = statusTone(invoice?.status);

  const clientName =
    invoice?.clientId?.companyName
    || invoice?.clientId?.contactPerson
    || invoice?.leadId?.name
    || "—";
  const contactName = invoice?.clientId?.contactPerson || invoice?.leadId?.name || clientName;
  const contactPhone = invoice?.clientId?.phone || invoice?.leadId?.phone || "";
  const contactEmail = invoice?.clientId?.email || invoice?.leadId?.email || "";
  const propertyName = [
    invoice?.inventoryId?.projectName || invoice?.inventoryId?.title,
    invoice?.inventoryId?.area || invoice?.inventoryId?.city,
  ]
    .filter(Boolean)
    .join(" · ");

  /*
   * The comp's items list is the invoice's line items plus its additional
   * charges and its GST - the three things the total is made of.
   */
  const items = useMemo(() => {
    const rows: Array<{ label: string; amount: number }> = [];
    for (const item of invoice?.lineItems || []) {
      rows.push({ label: item.description, amount: Number(item.amount) || 0 });
    }
    if (Number(invoice?.discountAmount || 0) > 0) {
      rows.push({ label: "Discount", amount: -Number(invoice?.discountAmount) });
    }
    /* The comp lists the tax before the extras, after the lines it is charged on. */
    if (Number(invoice?.gstAmount || 0) > 0) {
      rows.push({ label: `GST (${invoice?.gstRate || 0}%)`, amount: Number(invoice?.gstAmount) });
    }
    for (const charge of invoice?.additionalCharges || []) {
      rows.push({ label: charge.label, amount: Number(charge.amount) || 0 });
    }
    return rows;
  }, [invoice]);

  const invoiceHtml = () => `
    <html><body style="font-family:-apple-system,Helvetica,Arial;padding:28px;color:#0b1220">
      <h2 style="margin:0">${invoice?.invoiceNumber || "Invoice"}</h2>
      <p style="color:#5a6270;margin:4px 0 20px">${clientName}${propertyName ? ` &middot; ${propertyName}` : ""}</p>
      <table style="width:100%;border-collapse:collapse">
        ${items
    .map(
      (row) =>
        `<tr><td style="padding:7px 0;border-bottom:1px solid #edeff3">${row.label}</td><td style="padding:7px 0;border-bottom:1px solid #edeff3;text-align:right">${exactMoney(row.amount)}</td></tr>`,
    )
    .join("")}
        <tr><td style="padding:10px 0;font-weight:700">Total</td><td style="padding:10px 0;text-align:right;font-weight:700">${exactMoney(total)}</td></tr>
        <tr><td style="padding:2px 0">Paid</td><td style="padding:2px 0;text-align:right">${exactMoney(paid)}</td></tr>
        <tr><td style="padding:2px 0;font-weight:700">Balance</td><td style="padding:2px 0;text-align:right;font-weight:700">${exactMoney(balance)}</td></tr>
      </table>
      <p style="color:#6e7686;margin-top:22px">Issued ${fullDateOf(invoice?.createdAt)} &middot; Due ${fullDateOf(invoice?.dueDate)}</p>
    </body></html>`;

  const downloadPdf = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html: invoiceHtml() });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
      else Alert.alert("Saved", uri);
    } catch (e) {
      Alert.alert("PDF", toErrorMessage(e, "Could not build the PDF"));
    }
  };

  const shareInvoice = async () => {
    await Share.share({
      message: `${invoice?.invoiceNumber || "Invoice"} — ${exactMoney(total)}, ${exactMoney(balance)} due by ${fullDateOf(invoice?.dueDate)}.`,
    }).catch(() => undefined);
  };

  /*
   * There is no mail transport on the server, so a reminder is composed on
   * this phone and sent from the person's own account rather than silently
   * doing nothing.
   */
  const sendReminder = async () => {
    const body = `Hello ${contactName},\n\nThis is a reminder for invoice ${invoice?.invoiceNumber} of ${exactMoney(total)}. ${exactMoney(balance)} is outstanding and due on ${fullDateOf(invoice?.dueDate)}.\n\nThank you.`;
    try {
      if (await MailComposer.isAvailableAsync()) {
        await MailComposer.composeAsync({
          recipients: contactEmail ? [contactEmail] : [],
          subject: `Payment reminder: ${invoice?.invoiceNumber}`,
          body,
        });
        return;
      }
      if (contactEmail) {
        await Linking.openURL(
          `mailto:${contactEmail}?subject=${encodeURIComponent(`Payment reminder: ${invoice?.invoiceNumber}`)}&body=${encodeURIComponent(body)}`,
        );
        return;
      }
      Alert.alert("No email", "This client has no email address on record.");
    } catch (e) {
      Alert.alert("Reminder", toErrorMessage(e, "Could not open the mail composer"));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!invoice) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <Glyph name="arrow-back" size={24} color={brand.text} />
          </Pressable>
          <Text style={styles.barTitle}>Invoice Details</Text>
        </View>
        <View style={styles.centred}>
          <Text style={styles.emptyText}>{error || "Invoice not found"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Glyph name="arrow-back" size={24} color={brand.text} />
        </Pressable>
        <Text style={styles.barTitle} numberOfLines={1}>
          Invoice Details
        </Text>
        <Pressable onPress={shareInvoice} hitSlop={10} accessibilityRole="button" accessibilityLabel="Share invoice">
          <Glyph name="share-outline" size={21} color={brand.text} />
        </Pressable>
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Invoice actions">
          <Glyph name="ellipsis-horizontal" size={21} color={brand.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- header ---- */}
        <View style={styles.card}>
          <View style={styles.headRow}>
            <View style={styles.docIcon}>
              <Glyph name="document-text-outline" size={21} color={brand.deep} />
            </View>
            <View style={styles.grow}>
              <Text style={styles.invoiceNo} numberOfLines={1}>
                {invoice.invoiceNumber}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                <Text style={[styles.statusText, { color: tone.fg }]}>{tone.label}</Text>
              </View>
            </View>
            <View style={styles.dueBlock}>
              <Text style={styles.dueLabel}>Amount due</Text>
              <Text style={styles.dueValue} numberOfLines={1}>
                {exactMoney(balance)}
              </Text>
            </View>
          </View>

          <View style={styles.factGrid}>
            <View style={styles.factCol}>
              <Fact icon="person-outline" label="Client" value={clientName} />
              {propertyName ? (
                <Fact icon="business-outline" label="Property" value={propertyName} />
              ) : null}
            </View>
            <View style={styles.factRule} />
            <View style={styles.factCol}>
              <Fact icon="calendar-outline" label="Issue date" value={fullDateOf(invoice.createdAt)} />
              <Fact icon="calendar-outline" label="Due date" value={fullDateOf(invoice.dueDate)} />
            </View>
          </View>
        </View>

        {/* ---- totals ---- */}
        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.totalRow}>
            <View style={styles.totalCell}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue} numberOfLines={1}>
                {exactMoney(total)}
              </Text>
            </View>
            <View style={styles.totalRule} />
            <View style={styles.totalCell}>
              <Text style={styles.totalLabel}>Paid</Text>
              <Text style={styles.totalValue} numberOfLines={1}>
                {exactMoney(paid)}
              </Text>
            </View>
            <View style={styles.totalRule} />
            <View style={styles.totalCell}>
              <Text style={styles.totalLabel}>Balance</Text>
              <Text style={[styles.totalValue, { color: brand.primary }]} numberOfLines={1}>
                {exactMoney(balance)}
              </Text>
            </View>
          </View>

          <View style={styles.progressRow}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${share}%` }]} />
            </View>
            <Text style={styles.progressText}>{share}%</Text>
          </View>
        </View>

        {/* ---- items ---- */}
        {items.length ? (
          <View style={[styles.card, styles.cardGap]}>
            <Text style={styles.cardTitle}>Invoice Items</Text>
            {items.map((row, index) => (
              <View key={`${row.label}-${index}`} style={styles.itemRow}>
                <Text style={styles.itemLabel} numberOfLines={1}>
                  {row.label}
                </Text>
                <Text style={styles.itemAmount}>{exactMoney(row.amount)}</Text>
              </View>
            ))}
            <View style={styles.itemTotal}>
              <Text style={styles.itemTotalLabel}>Total</Text>
              <Text style={styles.itemTotalAmount}>{exactMoney(total)}</Text>
            </View>
          </View>
        ) : null}

        {/* ---- payment history ---- */}
        <View style={[styles.card, styles.cardGap]}>
          <Text style={styles.cardTitle}>Payment History</Text>
          {payments.length === 0 ? (
            <Text style={styles.emptyText}>Nothing received yet.</Text>
          ) : (
            payments.map((row, index) => (
              <View key={row._id} style={[styles.payRow, index > 0 && styles.payRowDivided]}>
                <View style={styles.payIcon}>
                  <Glyph name={methodIcon(row.method)} size={18} color={brand.deep} />
                </View>
                <View style={styles.grow}>
                  <Text style={styles.payMethod} numberOfLines={1}>
                    {methodLabel(row.method)}
                    {row.type === "REFUND" ? " (refund)" : ""}
                  </Text>
                  <Text style={styles.payDate}>{fullDateOf(row.paymentDate)}</Text>
                </View>
                <View style={styles.payRight}>
                  <Text style={styles.payAmount} numberOfLines={1}>
                    {exactMoney(row.amount)}
                  </Text>
                  <Text style={styles.payCode} numberOfLines={1}>
                    {row.paymentCode}
                  </Text>
                </View>
                <Glyph name="chevron-forward" size={17} color={brand.textMuted} />
              </View>
            ))
          )}
        </View>

        {/* ---- client + actions ---- */}
        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.clientHead}>
            <Text style={[styles.cardTitle, styles.cardTitleFlush]}>Client Details</Text>
            <Pressable
              onPress={() =>
                invoice.leadId?._id
                  ? navigation.navigate("LeadDetails", { leadId: invoice.leadId._id })
                  : Alert.alert("Client", "This client is managed in the coworking clients list.")
              }
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.clientRow}>
            <View style={styles.clientAvatar}>
              <Glyph name="person-outline" size={19} color={brand.deep} />
            </View>
            <View style={styles.grow}>
              <Text style={styles.clientName} numberOfLines={1}>
                {contactName}
              </Text>
              <View style={styles.clientMeta}>
                {contactPhone ? (
                  <Pressable
                    style={styles.clientMetaItem}
                    onPress={() => Linking.openURL(`tel:${contactPhone}`).catch(() => undefined)}
                    accessibilityRole="button"
                  >
                    <Glyph name="call-outline" size={13} color={brand.textSecondary} />
                    <Text style={styles.clientMetaText} numberOfLines={1}>
                      {contactPhone}
                    </Text>
                  </Pressable>
                ) : null}
                {contactEmail ? (
                  <Pressable
                    style={styles.clientMetaItem}
                    onPress={() => Linking.openURL(`mailto:${contactEmail}`).catch(() => undefined)}
                    accessibilityRole="button"
                  >
                    <Glyph name="mail-outline" size={13} color={brand.textSecondary} />
                    <Text style={styles.clientMetaText} numberOfLines={1}>
                      {contactEmail}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>

          <Pressable
            style={styles.primaryBtn}
            onPress={() =>
              navigation.navigate("AddEntry", {
                kind: "INCOME",
                invoiceId: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                amount: balance,
                party: contactName,
              })
            }
            accessibilityRole="button"
          >
            <Glyph name="card-outline" size={18} color={brand.onPrimary} />
            <Text style={styles.primaryBtnText}>Record payment</Text>
          </Pressable>

          <Pressable style={styles.outlineBtn} onPress={sendReminder} accessibilityRole="button">
            <Glyph name="paper-plane-outline" size={17} color={brand.primary} />
            <Text style={styles.outlineBtnText}>Send reminder</Text>
          </Pressable>

          <View style={styles.footerLinks}>
            <Pressable style={styles.footerLink} onPress={downloadPdf} accessibilityRole="button">
              <Glyph name="download-outline" size={16} color={brand.primary} />
              <Text style={styles.linkText}>Download PDF</Text>
            </Pressable>
            <View style={styles.footerRule} />
            <Pressable style={styles.footerLink} onPress={shareInvoice} accessibilityRole="button">
              <Glyph name="share-outline" size={16} color={brand.primary} />
              <Text style={styles.linkText}>Share invoice</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <AppSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={invoice.invoiceNumber}>
        {([
          { id: "pdf", label: "Download PDF", icon: "download-outline" },
          { id: "share", label: "Share invoice", icon: "share-outline" },
          { id: "remind", label: "Send reminder", icon: "paper-plane-outline" },
        ] as Array<{ id: string; label: string; icon: GlyphName }>).map((entry) => (
          <Pressable
            key={entry.id}
            style={styles.sheetRow}
            onPress={() => {
              setMenuOpen(false);
              if (entry.id === "pdf") void downloadPdf();
              else if (entry.id === "share") void shareInvoice();
              else void sendReminder();
            }}
            accessibilityRole="button"
          >
            <Glyph name={entry.icon} size={18} color={brand.textSecondary} />
            <Text style={styles.sheetLabel}>{entry.label}</Text>
          </Pressable>
        ))}
      </AppSheet>
    </SafeAreaView>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: b.bg },
    centred: { flex: 1, alignItems: "center", justifyContent: "center" },
    grow: { flex: 1, minWidth: 0 },

    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 15,
      paddingHorizontal: layout.gutter,
      paddingTop: 6,
      paddingBottom: 12,
    },
    barTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: t.hero,
      lineHeight: 25,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: b.text,
    },

    body: { paddingHorizontal: layout.gutter },
    card: {
      padding: 13,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    cardGap: { marginTop: 10 },
    cardTitle: {
      marginBottom: 11,
      fontSize: t.barTitle,
      lineHeight: 22,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },
    cardTitleFlush: { flex: 1, minWidth: 0, marginBottom: 0 },

    /* ---- header ---- */
    headRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 11,
    },
    docIcon: {
      width: 42,
      height: 42,
      borderRadius: round.field,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    invoiceNo: {
      fontSize: t.hero,
      lineHeight: 24,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },
    statusPill: {
      marginTop: 5,
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: round.pill,
    },
    statusText: { fontSize: t.tagline, fontWeight: "700" },
    dueBlock: { alignItems: "flex-end" },
    dueLabel: { fontSize: t.body, color: b.textMuted },
    dueValue: {
      marginTop: 2,
      fontSize: 25,
      lineHeight: 30,
      fontWeight: "700",
      letterSpacing: -0.8,
      color: b.primary,
    },

    factGrid: {
      marginTop: 14,
      flexDirection: "row",
      gap: 12,
    },
    factCol: { flex: 1, minWidth: 0, gap: 12 },
    factRule: { width: 1, backgroundColor: b.hairline },
    fact: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 9,
    },
    factLabel: { fontSize: t.body, color: b.textMuted },
    factValue: {
      marginTop: 1,
      fontSize: t.cardTitle,
      lineHeight: 18,
      fontWeight: "700",
      color: b.text,
    },

    /* ---- totals ---- */
    totalRow: { flexDirection: "row" },
    totalCell: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
    totalRule: { width: 1, backgroundColor: b.hairline },
    totalLabel: { fontSize: t.body, color: b.textMuted },
    totalValue: {
      marginTop: 3,
      fontSize: t.hero,
      lineHeight: 25,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: b.text,
    },
    progressRow: {
      marginTop: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
    },
    track: {
      flex: 1,
      minWidth: 0,
      height: 8,
      borderRadius: round.pill,
      overflow: "hidden",
      backgroundColor: b.hairline,
    },
    fill: { height: "100%", borderRadius: round.pill, backgroundColor: "#0b7d52" },
    progressText: { fontSize: t.body, color: b.textSecondary },

    /* ---- items ---- */
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 7,
    },
    itemLabel: { flex: 1, minWidth: 0, fontSize: t.field, color: b.text },
    itemAmount: { fontSize: t.field, color: b.text },
    itemTotal: {
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 11,
      paddingVertical: 11,
      borderRadius: round.field,
      backgroundColor: b.tintSoft,
    },
    itemTotalLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: t.sectionTitle,
      fontWeight: "700",
      color: b.text,
    },
    itemTotalAmount: {
      fontSize: t.sectionTitle,
      fontWeight: "700",
      color: b.text,
    },

    /* ---- payments ---- */
    payRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingVertical: 11,
    },
    payRowDivided: { borderTopWidth: 1, borderTopColor: b.hairline },
    payIcon: {
      width: 38,
      height: 38,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    payMethod: { fontSize: t.field, fontWeight: "700", color: b.text },
    payDate: { marginTop: 2, fontSize: t.body, color: b.textMuted },
    payRight: { alignItems: "flex-end" },
    payAmount: { fontSize: t.field, fontWeight: "700", color: b.text },
    payCode: { marginTop: 2, fontSize: t.tagline, color: b.textMuted },

    /* ---- client ---- */
    clientHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 11,
    },
    linkText: { fontSize: t.cardTitle, fontWeight: "700", color: b.primary },
    clientRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
    },
    clientAvatar: {
      width: 38,
      height: 38,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    clientName: { fontSize: t.field, fontWeight: "700", color: b.text },
    clientMeta: {
      marginTop: 3,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    clientMetaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    clientMetaText: { fontSize: t.body, color: b.textSecondary },

    primaryBtn: {
      marginTop: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      height: 48,
      borderRadius: round.field,
      backgroundColor: "#0b7d52",
    },
    primaryBtnText: { fontSize: t.sectionTitle, fontWeight: "700", color: b.onPrimary },
    outlineBtn: {
      marginTop: 9,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      height: 46,
      borderWidth: 1,
      borderColor: b.greenBright,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    outlineBtnText: { fontSize: t.sectionTitle, fontWeight: "700", color: b.primary },
    footerLinks: {
      marginTop: 13,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    footerLink: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
    },
    footerRule: { width: 1, height: 18, backgroundColor: b.hairline },

    emptyText: { fontSize: t.field, color: b.textMuted },
    sheetRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: b.hairline,
    },
    sheetLabel: { fontSize: t.field, color: b.text },
  }),
);

export default InvoiceDetailsScreen;
