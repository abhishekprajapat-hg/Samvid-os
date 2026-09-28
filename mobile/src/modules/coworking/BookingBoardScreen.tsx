import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { TextField, Segmented } from "../../components/ui/form";
import {
  Banner,
  BrandButton,
  BrandPage,
  Chip,
  ChipRow,
} from "../../components/brand/kit";
import { brandStyles, type as t } from "../../theme/brand";
import { formatCurrency } from "../../utils/format";
import { shareTextFile } from "../../utils/shareFile";
import { reloadBoard, refreshBoardIfIdle, replaceBoard, useBoard } from "./boardStore";
import { toCsv, type BoardAction, type Cabin } from "./boardReducer";
import { SEAT_BANDS, STATUS_META, STATUS_ORDER, WINGS } from "./cabinData";
import { pickBackup, restoreBackup, shareBackup } from "./boardBackup";
import { WingSeatMap } from "./components/WingSeatMap";
import { FloorLayoutMap } from "./components/FloorLayoutMap";
import {
  ActivitySheet,
  BirthdayReminders,
  CabinDetailSheet,
  FreeingSoonCard,
  HoldSheet,
  OccupancyCard,
  SelectionBar,
  StatusCard,
  TransferSheet,
} from "./components/BoardPanels";

/*
 * Cabin Booking Board - web's BookingBoard.jsx.
 *
 * Built around the three questions a coworking desk answers all day: what is
 * free right now, who is in the cabin someone is asking about, and can I put a
 * client into it today. Every action runs through the shared board store, which
 * owns the floor, keeps an undo stack and saves to the same /coworking/board
 * document the desktop reads - so a cabin let from this phone is let on the
 * desktop, and the reverse. This screen holds only view state.
 *
 * The September version of this screen read the relational /coworking/cabins
 * API instead, which the desktop board never writes to; the two apps showed
 * different floors. That is what this rebuild fixes.
 */

const ACTION_MESSAGES: Partial<Record<BoardAction["type"], (cabin: Cabin) => string>> = {
  RELEASE: (cabin) => `${cabin.label} released. ${cabin.client?.name} moved to its history.`,
  RENEW: (cabin) => `${cabin.label} renewed by 12 months.`,
  CONFIRM_HOLD: (cabin) => `${cabin.label} confirmed for ${cabin.client?.name}.`,
  DROP_HOLD: (cabin) => `Hold dropped on ${cabin.label}.`,
  RECORD_PAYMENT: (cabin) => `Payment recorded for ${cabin.label}.`,
  SET_UNAVAILABLE: (cabin) => `${cabin.label} taken off the market.`,
  RETURN_TO_INVENTORY: (cabin) => `${cabin.label} is back in inventory.`,
};

export const BookingBoardScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [board, dispatch, sync] = useBoard();
  const [view, setView] = useState<"wings" | "layout">("wings");
  const [statusFilter, setStatusFilter] = useState("all");
  const [wingFilter, setWingFilter] = useState("");
  const [seatBand, setSeatBand] = useState("");
  const [search, setSearch] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [cart, setCart] = useState<string[]>([]);
  const [detailCode, setDetailCode] = useState("");
  const [holdCode, setHoldCode] = useState("");
  const [transferCode, setTransferCode] = useState("");
  const [showActivity, setShowActivity] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "info" | "alert"; message: string } | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { cabins, activity, undoStack } = board;

  // A cabin or a notice handed over by another screen: the client profile's
  // "open cabin", or the onboarding page reporting what it just did.
  useEffect(() => {
    const params = route.params || {};
    if (params.cabin) setDetailCode(String(params.cabin));
    if (params.notice) {
      setNotice({ tone: "success", message: String(params.notice) });
      setCart([]);
      setSelectMode(false);
    }
    if (params.cabin || params.notice) navigation.setParams({ cabin: undefined, notice: undefined });
  }, [navigation, route.params]);

  useFocusEffect(
    useCallback(() => {
      void refreshBoardIfIdle();
    }, []),
  );

  const passesNonStatus = useCallback(
    (cabin: Cabin) => {
      if (wingFilter && cabin.wing !== wingFilter) return false;
      if (seatBand && !SEAT_BANDS.find((band) => band.id === seatBand)?.test(cabin.seats)) return false;
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return `${cabin.label} ${cabin.code} ${cabin.client?.name || ""} ${cabin.client?.contactPerson || ""}`
        .toLowerCase()
        .includes(query);
    },
    [search, seatBand, wingFilter],
  );

  // Filters dim rather than remove: a missing cabin reads as a gap in the building.
  const matches = useCallback(
    (cabin: Cabin) => passesNonStatus(cabin) && (statusFilter === "all" || cabin.status === statusFilter),
    [passesNonStatus, statusFilter],
  );

  const scoped = useMemo(() => cabins.filter(passesNonStatus), [cabins, passesNonStatus]);
  const counts = useMemo(
    () =>
      STATUS_ORDER.reduce<Record<string, number>>(
        (tally, status) => ({ ...tally, [status]: scoped.filter((cabin) => cabin.status === status).length }),
        { all: scoped.length },
      ),
    [scoped],
  );

  const byCode = (code: string) => cabins.find((cabin) => cabin.code === code) || null;
  const detailCabin = byCode(detailCode);
  const holdCabin = byCode(holdCode);
  const transferCabin = byCode(transferCode);
  const cartCabins = cart.map(byCode).filter(Boolean) as Cabin[];
  const vacantCount = cabins.filter((cabin) => cabin.status === "VACANT").length;

  const toggleSelectMode = () => {
    if (selectMode) setCart([]);
    setSelectMode((value) => !value);
  };

  const handleSelect = (cabin: Cabin) => {
    if (selectMode && cabin.status === "VACANT") {
      setCart((current) =>
        current.includes(cabin.code) ? current.filter((code) => code !== cabin.code) : [...current, cabin.code],
      );
      return;
    }
    if (selectMode) {
      setNotice({
        tone: "info",
        message: `${cabin.label} is ${STATUS_META[cabin.status].label.toLowerCase()} and cannot be allotted. Opened its details instead.`,
      });
    }
    setDetailCode(cabin.code);
  };

  const runAction = (action: BoardAction, message?: string) => {
    dispatch(action);
    if (message) setNotice({ tone: "success", message });
  };

  const openOnboarding = (codes: string[]) => {
    setDetailCode("");
    navigation.navigate("CoworkingOnboard", { cabinCodes: codes });
  };

  const exportCsv = async () => {
    const header = ["Cabin", "Wing", "Capacity", "Status", "Client", "Monthly rent", "Agreement ends", "Dues"];
    const rows = cabins.map((cabin) => [
      cabin.label,
      cabin.wing,
      `${cabin.seats} seater`,
      STATUS_META[cabin.status].label,
      cabin.client?.name || "",
      cabin.contract?.monthlyRent ?? cabin.monthlyRent,
      cabin.contract ? new Date(cabin.contract.endDate).toISOString().slice(0, 10) : "",
      cabin.contract?.duesAmount || 0,
    ]);
    try {
      await shareTextFile("coworking-booking-board.csv", toCsv([header, ...rows]));
      setNotice({ tone: "success", message: `Exported ${cabins.length} cabins to CSV.` });
    } catch {
      setNotice({ tone: "alert", message: "Could not export the board." });
    }
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const backup = await shareBackup(board);
      setNotice({
        tone: backup.counts.cabinsLet ? "success" : "info",
        message: backup.counts.cabinsLet
          ? `Backed up ${backup.counts.cabinsLet} let cabin(s) and ${backup.counts.documents} document(s). Keep this file safe.`
          : "Backup saved, but this board holds no let cabins.",
      });
    } catch {
      setNotice({ tone: "alert", message: "Could not create the backup." });
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async () => {
    let payload;
    try {
      payload = await pickBackup();
    } catch {
      setNotice({ tone: "alert", message: "Could not read that backup file." });
      return;
    }
    if (!payload) return;
    Alert.alert(
      "Restore this backup?",
      "Restoring replaces the booking board with the contents of the file, and saves it for everyone who uses the board. Undo can take it back.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await restoreBackup(payload);
              replaceBoard(result.board);
              setNotice({
                tone: "success",
                message: `Restored ${result.cabinsLet || 0} let cabin(s) and ${result.restoredDocuments} document(s).`,
              });
            } catch (error: any) {
              setNotice({ tone: "alert", message: error?.message || "Could not read that backup file." });
            }
          },
        },
      ],
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await reloadBoard();
    setRefreshing(false);
  };

  const boardClients = useMemo(
    () => [...new Map(cabins.filter((cabin) => cabin.client).map((cabin) => [cabin.client!.id, cabin.client!])).values()],
    [cabins],
  );

  const mapProps = { cabins, selectedCode: detailCode, cart, matches, onSelect: handleSelect };

  return (
    <BrandPage
      title="Booking Board"
      subtitle="Coworking space"
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      right={
        <BrandButton
          title="Onboard"
          icon="person-add"
          size="sm"
          disabled={!vacantCount}
          onPress={() => {
            setSelectMode(true);
            setNotice({ tone: "info", message: "Pick the vacant cabins to allot, then confirm from the bar at the bottom." });
          }}
        />
      }
      refreshing={refreshing}
      onRefresh={onRefresh}
      footer={
        cartCabins.length ? (
          <SelectionBar
            cabins={cartCabins}
            onRemove={(code) => setCart((current) => current.filter((value) => value !== code))}
            onClear={() => setCart([])}
            onOnboard={() => openOnboarding(cartCabins.map((cabin) => cabin.code))}
          />
        ) : undefined
      }
    >
      {sync.error ? (
        <Banner
          tone="warn"
          icon="cloud-offline-outline"
          message={sync.error}
          action="Reload the board"
          onAction={() => void reloadBoard()}
        />
      ) : null}
      {sync.loading ? <Text style={styles.muted}>Loading the board…</Text> : null}
      {notice ? (
        <Banner tone={notice.tone} message={notice.message} action="Dismiss" onAction={() => setNotice(null)} />
      ) : null}

      <BirthdayReminders clients={boardClients} />

      <TextField value={search} onChangeText={setSearch} placeholder="Search cabins, clients, or IDs…" icon="search" />

      <View style={styles.tools}>
        <Segmented
          options={[
            { label: "Wings", value: "wings" },
            { label: "Layout", value: "layout" },
          ]}
          value={view}
          onChange={(value) => setView(value as "wings" | "layout")}
        />
        <View style={styles.toolGrid}>
          <BrandButton title="Clients" icon="people-outline" size="sm" variant="secondary" style={styles.tool} onPress={() => navigation.navigate("CoworkingClients")} />
          <BrandButton title="Activity" icon="time-outline" size="sm" variant="secondary" style={styles.tool} onPress={() => setShowActivity(true)} />
          <BrandButton title="Export" icon="download-outline" size="sm" variant="secondary" style={styles.tool} onPress={exportCsv} />
          <BrandButton title={backingUp ? "Saving…" : "Backup"} icon="save-outline" size="sm" variant="secondary" style={styles.tool} disabled={backingUp} onPress={handleBackup} />
          <BrandButton title="Restore" icon="cloud-upload-outline" size="sm" variant="secondary" style={styles.tool} onPress={handleRestore} />
          <BrandButton
            title="Undo"
            icon="arrow-undo-outline"
            size="sm"
            variant="secondary"
            style={styles.tool}
            disabled={!undoStack.length}
            accessibilityLabel={undoStack.length ? `Undo: ${activity[0]?.title}` : "Nothing to undo"}
            onPress={() => {
              const undone = activity[0]?.title;
              dispatch({ type: "UNDO" });
              setNotice({ tone: "info", message: undone ? `Undone: ${undone}` : "Undone." });
            }}
          />
        </View>
      </View>

      <OccupancyCard cabins={scoped} vacantCount={counts.VACANT || 0} />

      {view === "layout" ? (
        <>
          <BrandButton
            title={selectMode ? "Selecting cabins" : "Select cabins"}
            icon={selectMode ? "checkbox" : "square-outline"}
            size="sm"
            variant={selectMode ? "primary" : "secondary"}
            onPress={toggleSelectMode}
          />
          <FloorLayoutMap {...mapProps} />
        </>
      ) : (
        <>
          <ChipRow>
            <Chip label="All" count={counts.all} active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
            {STATUS_ORDER.map((status) => (
              <Chip
                key={status}
                label={STATUS_META[status].label}
                count={counts[status]}
                dot={STATUS_META[status].dot}
                active={statusFilter === status}
                onPress={() => setStatusFilter(status)}
              />
            ))}
          </ChipRow>
          <ChipRow>
            <Chip label="All wings" active={!wingFilter} onPress={() => setWingFilter("")} />
            {WINGS.map((wing) => (
              <Chip
                key={wing.id}
                label={wing.id}
                active={wingFilter === wing.id}
                onPress={() => setWingFilter(wingFilter === wing.id ? "" : wing.id)}
              />
            ))}
            {SEAT_BANDS.map((band) => (
              <Chip
                key={band.id}
                label={band.label}
                active={seatBand === band.id}
                onPress={() => setSeatBand(seatBand === band.id ? "" : band.id)}
              />
            ))}
          </ChipRow>
          <BrandButton
            title={selectMode ? "Selecting cabins" : "Select cabins"}
            icon={selectMode ? "checkbox" : "square-outline"}
            size="sm"
            variant={selectMode ? "primary" : "secondary"}
            onPress={toggleSelectMode}
          />
          <Text style={styles.heading}>Cabins by wing</Text>
          <WingSeatMap {...mapProps} />
        </>
      )}

      <StatusCard counts={counts} statusFilter={statusFilter} onStatusFilter={setStatusFilter} />
      <FreeingSoonCard cabins={scoped} />
      {cartCabins.length ? (
        <Text style={styles.muted}>
          {cartCabins.length} selected · {formatCurrency(cartCabins.reduce((sum, cabin) => sum + cabin.monthlyRent, 0))} / month
        </Text>
      ) : null}

      <CabinDetailSheet
        cabin={detailCabin}
        onClose={() => setDetailCode("")}
        onAction={(action) => detailCabin && runAction(action, ACTION_MESSAGES[action.type]?.(detailCabin))}
        onOnboard={(cabin) => openOnboarding([cabin.code])}
        onHold={(cabin) => {
          setDetailCode("");
          setHoldCode(cabin.code);
        }}
        onTransfer={(cabin) => {
          setDetailCode("");
          setTransferCode(cabin.code);
        }}
        onEditClient={(cabin) => {
          setDetailCode("");
          navigation.navigate("CoworkingOnboard", { clientId: cabin.client?.id });
        }}
        onOpenClient={(cabin) => {
          setDetailCode("");
          navigation.navigate("CoworkingClientProfile", { clientId: cabin.client?.id });
        }}
      />

      <HoldSheet
        cabin={holdCabin}
        onClose={() => setHoldCode("")}
        onConfirm={(payload) => {
          const label = holdCabin?.label;
          setHoldCode("");
          runAction({ type: "HOLD", ...payload }, `${label} held for ${payload.name} for ${payload.days} days.`);
        }}
      />

      <TransferSheet
        cabin={transferCabin}
        cabins={cabins}
        onClose={() => setTransferCode("")}
        onConfirm={(payload) => {
          const name = transferCabin?.client?.name;
          setTransferCode("");
          runAction({ type: "TRANSFER", ...payload }, `${name} moved to ${payload.toCode.replace(/^([A-D])/, "$1-")}.`);
        }}
      />

      <ActivitySheet
        visible={showActivity}
        activity={activity}
        onClose={() => setShowActivity(false)}
        onOpenCabin={(code) => {
          setShowActivity(false);
          setDetailCode(code);
        }}
      />
    </BrandPage>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    muted: { fontSize: t.label, color: b.textMuted },
    heading: { fontSize: t.cardTitle, fontWeight: "700", color: b.text },
    tools: { gap: 8 },
    toolGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    tool: { flexGrow: 1, flexBasis: "30%" },
  }),
);

export default BookingBoardScreen;
