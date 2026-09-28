import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Glyph } from "../../components/ui/Glyph";
import { TextField } from "../../components/ui/form";
import { Avatar, Banner, BrandButton, BrandPage, Chip, ChipRow, EmptyNote } from "../../components/brand/kit";
import { brand, brandStyles, round, type as t } from "../../theme/brand";
import { shareTextFile } from "../../utils/shareFile";
import { refreshBoardIfIdle, reloadBoard, useBoard } from "./boardStore";
import { directoryFrom, toCsv, type DirectoryClient } from "./boardReducer";
import { kycStatusOf } from "./kycDocuments";
import { BirthdayReminders } from "./components/BoardPanels";

/*
 * Clients in this coworking space, current and former - web's ClientsPage.jsx.
 *
 * The directory is derived from the board's cabins, so there is no client table
 * to fall out of step with it: a former client is the history a cabin keeps.
 * Web puts the profile beside the list; a phone opens it as its own page.
 */

type Tab = "all" | "active" | "former" | "kyc";

export const CoworkingClientsScreen = () => {
  const navigation = useNavigation<any>();
  const [board, , sync] = useBoard();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshBoardIfIdle();
    }, []),
  );

  const directory = useMemo(() => directoryFrom(board.cabins), [board.cabins]);
  const active = directory.filter((client) => client.kind === "active");
  const former = directory.filter((client) => client.kind === "former");
  const pendingKyc = active.filter(
    (client) => !kycStatusOf({ kind: client.entityKind, documents: client.documents }).complete,
  );

  const term = query.trim().toLowerCase();
  const shown = directory
    .filter((client) => {
      if (tab === "all") return true;
      if (tab === "kyc") return pendingKyc.includes(client);
      return client.kind === tab;
    })
    .filter((client) =>
      term
        ? `${client.name} ${client.industry || ""} ${client.contactPerson || ""} ${client.phone || ""} ${client.cabins
            .map((cabin) => cabin.label)
            .join(" ")} ${client.stays.map((stay) => stay.cabinLabel).join(" ")}`
            .toLowerCase()
            .includes(term)
        : true,
    );

  const exportCsv = async () => {
    const header = ["Client", "Status", "Type", "Industry", "Contact", "Phone", "Cabins", "Seats", "Monthly rent", "Dues", "KYC"];
    const rows = directory.map((client) => [
      client.name,
      client.kind === "active" ? (client.returning ? "Current (returning)" : "Current") : "Former",
      client.kind === "active" ? (client.entityKind === "individual" ? "Individual" : "Company") : "",
      client.industry,
      client.contactPerson,
      client.phone,
      (client.kind === "active" ? client.cabins.map((cabin) => cabin.label) : client.stays.map((stay) => stay.cabinLabel)).join(" / "),
      client.capacity || client.stays.reduce((sum, stay) => sum + stay.seats, 0),
      client.monthlyRent,
      client.duesAmount,
      client.kind === "active"
        ? (() => {
            const status = kycStatusOf({ kind: client.entityKind, documents: client.documents });
            return status.complete ? "Complete" : `${status.uploaded}/${status.required}`;
          })()
        : "",
    ]);
    try {
      await shareTextFile("coworking-clients.csv", toCsv([header, ...rows]));
      setNotice(`Exported ${directory.length} clients to CSV.`);
    } catch {
      setNotice("Could not export the clients.");
    }
  };

  const renderClient = (client: DirectoryClient) => (
    <Pressable
      key={client.id}
      onPress={() => navigation.navigate("CoworkingClientProfile", { clientId: client.id })}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${client.name}`}
    >
      <Avatar name={client.name} size={34} muted={client.kind !== "active"} />
      <View style={styles.flex}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>
            {client.name}
          </Text>
          {client.returning ? <Glyph name="repeat" size={13} color={brand.infoInk} /> : null}
          {client.duesAmount > 0 ? <Glyph name="warning" size={13} color={brand.alert} /> : null}
          {pendingKyc.includes(client) ? <Glyph name="document-attach" size={13} color={brand.warning} /> : null}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {client.kind === "active"
            ? `${client.cabins.length} ${client.cabins.length === 1 ? "cabin" : "cabins"} · ${client.capacity} seats`
            : `${client.stays.length} past ${client.stays.length === 1 ? "stay" : "stays"} · ${client.totalMonths} mo`}
        </Text>
      </View>
      <Glyph name="chevron-forward" size={16} color={brand.textMuted} />
    </Pressable>
  );

  return (
    <BrandPage
      title="Clients"
      subtitle={`${active.length} current · ${former.length} former${pendingKyc.length ? ` · ${pendingKyc.length} awaiting documents` : ""}`}
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      right={<BrandButton title="Export CSV" icon="download-outline" size="sm" variant="secondary" onPress={exportCsv} />}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await reloadBoard();
        setRefreshing(false);
      }}
    >
      {sync.error ? <Banner tone="warn" icon="cloud-offline-outline" message={sync.error} /> : null}
      {notice ? <Banner tone="success" message={notice} action="Dismiss" onAction={() => setNotice("")} /> : null}
      <BirthdayReminders clients={directory} />

      <BrandButton title="Booking board" icon="grid-outline" variant="secondary" onPress={() => navigation.navigate("CoworkingBooking")} />

      <TextField value={query} onChangeText={setQuery} placeholder="Search name, contact or cabin" icon="search" />
      <ChipRow>
        <Chip label="All" count={directory.length} active={tab === "all"} onPress={() => setTab("all")} />
        <Chip label="Current" count={active.length} active={tab === "active"} onPress={() => setTab("active")} />
        <Chip label="Former" count={former.length} active={tab === "former"} onPress={() => setTab("former")} />
        <Chip label="KYC due" count={pendingKyc.length} active={tab === "kyc"} onPress={() => setTab("kyc")} />
      </ChipRow>

      {shown.length ? (
        <View style={styles.list}>{shown.map(renderClient)}</View>
      ) : (
        <EmptyNote icon="people-outline" title="No client matches that." />
      )}
    </BrandPage>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    list: {
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: b.hairline,
    },
    rowPressed: { backgroundColor: b.fieldMuted },
    nameLine: { flexDirection: "row", alignItems: "center", gap: 5 },
    name: { flexShrink: 1, fontSize: t.body, fontWeight: "700", color: b.text },
    meta: { marginTop: 2, fontSize: t.label, color: b.textMuted },
  }),
);

export default CoworkingClientsScreen;
