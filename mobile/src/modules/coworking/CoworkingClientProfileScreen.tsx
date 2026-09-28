import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Glyph } from "../../components/ui/Glyph";
import {
  Avatar,
  Banner,
  BrandButton,
  BrandPage,
  EmptyNote,
  KeyValue,
  Panel,
  Pill,
  StatTile,
} from "../../components/brand/kit";
import { brand, brandStyles, round, type as t } from "../../theme/brand";
import { formatCurrency, formatDate } from "../../utils/format";
import { useBoard } from "./boardStore";
import { directoryFrom } from "./boardReducer";
import { STATUS_META } from "./cabinData";
import { CLIENT_KINDS, kycStatusOf } from "./kycDocuments";
import { DocumentChecklist } from "./components/DocumentChecklist";

/*
 * One client, current or former - web's ClientProfile.jsx.
 *
 * Both use the same profile because they are the same relationship at
 * different points: a former client is a lead you already know everything
 * about. Documents are edited here, and land on every cabin the client holds.
 */

export const CoworkingClientProfileScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [board, dispatch, sync] = useBoard();
  const [notice, setNotice] = useState("");
  const clientId = String(route.params?.clientId || "");

  const client = useMemo(
    () => directoryFrom(board.cabins).find((item) => item.id === clientId) || null,
    [board.cabins, clientId],
  );

  if (!client) {
    return (
      <BrandPage title="Client" onBack={() => navigation.goBack()} loading={sync.loading}>
        <EmptyNote icon="people-outline" title="This client is no longer on the board." message="They may have been released on another device." />
      </BrandPage>
    );
  }

  const isActive = client.kind === "active";
  const kyc = kycStatusOf({ kind: client.entityKind, documents: client.documents });
  const kindLabel = CLIENT_KINDS.find((option) => option.id === client.entityKind)?.label;
  const tenureLabel = client.totalMonths
    ? `${client.totalMonths} ${client.totalMonths === 1 ? "month" : "months"} of earlier tenancy`
    : "No earlier tenancy on record";
  const dateOfBirth = client.dateOfBirth || client.documents?.find((doc) => doc.extractedDateOfBirth)?.extractedDateOfBirth;
  const openCabin = (code: string) => navigation.navigate("CoworkingBooking", { cabin: code });

  return (
    <BrandPage
      title={client.name}
      subtitle={[
        client.industry || "Industry not recorded",
        isActive && client.since ? `with us since ${formatDate(client.since)}` : "",
        !isActive && client.lastLeft ? `left ${formatDate(client.lastLeft)}` : "",
      ]
        .filter(Boolean)
        .join(" · ")}
      onBack={() => navigation.goBack()}
      right={
        isActive ? (
          <BrandButton
            title="Edit"
            icon="create-outline"
            size="sm"
            variant="secondary"
            onPress={() => navigation.navigate("CoworkingOnboard", { clientId: client.id })}
          />
        ) : undefined
      }
    >
      {sync.error ? <Banner tone="warn" icon="cloud-offline-outline" message={sync.error} /> : null}
      {notice ? <Banner tone="success" message={notice} action="Dismiss" onAction={() => setNotice("")} /> : null}

      <View style={styles.badges}>
        <Avatar name={client.name} size={44} muted={!isActive} />
        <View style={styles.badgeWrap}>
          <Pill label={isActive ? "Current client" : "Former client"} tone={isActive ? "success" : "neutral"} />
          {kindLabel ? <Pill label={`${kindLabel}${client.entityType ? ` · ${client.entityType}` : ""}`} tone="neutral" /> : null}
          <Pill label={kyc.complete ? "KYC complete" : `KYC ${kyc.uploaded}/${kyc.required}`} tone={kyc.complete ? "success" : "warn"} />
          {client.returning ? <Pill label="Returning" tone="info" icon="repeat" /> : null}
        </View>
      </View>

      <View style={styles.statRow}>
        {isActive ? (
          <>
            <StatTile label="Monthly rent" value={formatCurrency(client.monthlyRent)} />
            <StatTile label="Cabins" value={client.cabins.length} />
            <StatTile label="Seats" value={client.capacity} />
          </>
        ) : (
          <>
            <StatTile label="Cabins held" value={client.stays.length} />
            <StatTile label="Total tenancy" value={`${client.totalMonths} mo`} />
            <StatTile label="Last seen" value={formatDate(client.lastLeft)} />
          </>
        )}
      </View>

      <Panel>
        <KeyValue label="Date of birth" value={dateOfBirth ? formatDate(dateOfBirth) : undefined} />
      </Panel>

      {client.duesAmount > 0 ? (
        <View style={styles.overdue}>
          <Text style={styles.overdueTitle}>{formatCurrency(client.duesAmount)} overdue</Text>
          <View style={styles.overdueActions}>
            {client.cabins
              .filter((cabin) => Number(cabin.contract?.duesAmount) > 0)
              .map((cabin) => (
                <BrandButton
                  key={cabin.code}
                  title={`Record payment for ${cabin.label}`}
                  icon="cash-outline"
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    dispatch({ type: "RECORD_PAYMENT", cabinCode: cabin.code });
                    setNotice(`Payment recorded for ${cabin.label}.`);
                  }}
                />
              ))}
          </View>
        </View>
      ) : null}

      <Panel title="Contact">
        <KeyValue label="Contact" value={client.contactPerson} />
        <KeyValue label="Phone" value={client.phone} icon="call-outline" mono />
        <KeyValue label="Email" value={client.email} icon="mail-outline" />
        <KeyValue label="GSTIN" value={client.gstin} mono />
      </Panel>

      {isActive ? (
        <Panel title="Cabins held" count={client.cabins.length} icon="business-outline">
          {client.cabins.map((cabin) => {
            const meta = STATUS_META[cabin.status];
            const expiring = Number(cabin.contract?.endsInDays) <= 45;
            return (
              <Pressable
                key={cabin.code}
                onPress={() => openCabin(cabin.code)}
                style={styles.cabinRow}
                accessibilityRole="button"
                accessibilityLabel={`Open cabin ${cabin.label}`}
              >
                <View style={[styles.dot, { backgroundColor: meta.dot }]} />
                <Text style={styles.cabinCode}>{cabin.label}</Text>
                <Text style={styles.muted}>{cabin.seats} seater</Text>
                <View style={styles.cabinRight}>
                  <Text style={styles.cabinRent}>{formatCurrency(cabin.contract?.monthlyRent ?? cabin.monthlyRent)}</Text>
                  <Text style={[styles.muted, expiring && styles.warnText]}>
                    {cabin.contract ? `${cabin.contract.endsInDays}d left` : "—"}
                  </Text>
                </View>
                <Glyph name="open-outline" size={14} color={brand.textMuted} />
              </Pressable>
            );
          })}
          {client.earliestEnd ? (
            <Text style={styles.muted}>Next renewal {formatDate(client.earliestEnd)}</Text>
          ) : null}
        </Panel>
      ) : null}

      <Panel title="Documents" count={`${kyc.totalUploaded}/${kyc.total}`} icon="document-text-outline">
        <DocumentChecklist
          kind={client.entityKind || "company"}
          documents={client.documents || []}
          onChange={(documents) => {
            dispatch({ type: "SET_CLIENT_DOCUMENTS", clientId: client.id, documents });
            setNotice("Documents updated.");
          }}
        />
      </Panel>

      <Panel title="Tenancy history" count={client.stays.length} icon="time-outline">
        {client.stays.length ? (
          <>
            {client.stays.map((stay) => (
              <View key={stay.id} style={styles.stayRow}>
                <Pressable onPress={() => openCabin(stay.cabinCode)} accessibilityRole="button" hitSlop={6}>
                  <Text style={styles.cabinCode}>{stay.cabinLabel}</Text>
                </Pressable>
                <Text style={styles.muted}>{stay.seats} seater</Text>
                <Text style={styles.stayDates}>
                  {formatDate(stay.from)} – {formatDate(stay.to)}
                </Text>
                <Text style={styles.stayMonths}>{stay.months} mo</Text>
              </View>
            ))}
            <Text style={styles.muted}>{tenureLabel}.</Text>
          </>
        ) : (
          <Text style={styles.muted}>This is their first tenancy in this coworking space.</Text>
        )}
      </Panel>
    </BrandPage>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    muted: { fontSize: t.label, color: b.textMuted },
    warnText: { color: b.warnInk, fontWeight: "700" },
    badges: { flexDirection: "row", alignItems: "center", gap: 12 },
    badgeWrap: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 5 },
    statRow: { flexDirection: "row", gap: 8 },
    overdue: { gap: 8, padding: 12, borderRadius: round.panel, backgroundColor: b.alertTint },
    overdueTitle: { fontSize: t.cardTitle, fontWeight: "700", color: b.alertInk },
    overdueActions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    cabinRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 10,
      paddingVertical: 9,
      marginBottom: 7,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    cabinCode: { fontSize: t.body, fontWeight: "700", color: b.text },
    cabinRight: { marginLeft: "auto", alignItems: "flex-end" },
    cabinRent: { fontSize: t.body, fontWeight: "700", color: b.text },
    stayRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 7,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
    },
    stayDates: { flex: 1, textAlign: "right", fontSize: t.label, color: b.textSecondary },
    stayMonths: { width: 40, textAlign: "right", fontSize: t.label, color: b.textMuted },
  }),
);

export default CoworkingClientProfileScreen;
