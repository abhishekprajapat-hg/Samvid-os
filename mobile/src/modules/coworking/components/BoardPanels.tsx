import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppSheet } from "../../../components/ui/Overlay";
import { Glyph, type GlyphName } from "../../../components/ui/Glyph";
import {
  Avatar,
  Banner,
  BrandButton,
  Chip,
  ChipRow,
  EmptyNote,
  KeyValue,
  Panel,
  Pill,
  StatTile,
} from "../../../components/brand/kit";
import { brand, brandStyles, round, type as t } from "../../../theme/brand";
import { getActiveScheme } from "../../../theme/themedStyles";
import { formatCurrency, formatDate, formatDateTime } from "../../../utils/format";
import api from "../../../services/api";
import { STATUS_META, STATUS_ORDER, cabinLabel, type CabinStatus } from "../cabinData";
import type { ActivityEntry, BoardAction, BoardClient, Cabin } from "../boardReducer";
import { DocumentChecklist } from "./DocumentChecklist";

/* ------------------------------------------------------- space summary -- */

/*
 * Web's SpaceSummaryPanel: occupancy (cabins let over cabins, not seats), the
 * status list that doubles as the filter, and what frees up in 45 days.
 */
export const OccupancyCard = ({ cabins, vacantCount }: { cabins: Cabin[]; vacantCount: number }) => {
  const letCabins = cabins.filter((cabin) => cabin.status === "BOOKED" || cabin.status === "RESERVED").length;
  const percent = cabins.length ? Math.round((letCabins / cabins.length) * 100) : 0;
  const vacantCapacity = cabins.filter((cabin) => cabin.status === "VACANT").reduce((sum, cabin) => sum + cabin.seats, 0);
  const monthlyRevenue = cabins.filter((cabin) => cabin.status === "BOOKED").reduce((sum, cabin) => sum + cabin.monthlyRent, 0);

  return (
    <Panel>
      <View style={styles.occHead}>
        <Text style={styles.occTitle}>Occupancy</Text>
        <Text style={styles.occPercent}>{percent}%</Text>
      </View>
      <Text style={styles.occCaption}>
        {letCabins} of {cabins.length} cabins let
      </Text>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${percent}%` }]} />
      </View>
      <View style={styles.statRow}>
        <StatTile icon="cash-outline" value={formatCurrency(monthlyRevenue)} label="per month" />
        <StatTile icon="exit-outline" value={vacantCount} label="vacant cabins" hint={`seating ${vacantCapacity} between them`} />
      </View>
    </Panel>
  );
};

export const StatusCard = ({
  counts,
  statusFilter,
  onStatusFilter,
}: {
  counts: Record<string, number>;
  statusFilter: string;
  onStatusFilter: (status: string) => void;
}) => (
  <Panel title="Cabins by status">
    {STATUS_ORDER.map((status) => {
      const active = statusFilter === status;
      return (
        <Pressable
          key={status}
          onPress={() => onStatusFilter(active ? "all" : status)}
          style={[styles.statusRow, active && styles.statusRowActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
        >
          <View style={[styles.dot, { backgroundColor: STATUS_META[status].dot }]} />
          <Text style={styles.statusLabel}>{STATUS_META[status].label}</Text>
          <Text style={styles.statusCount}>{counts[status] || 0}</Text>
        </Pressable>
      );
    })}
  </Panel>
);

export const FreeingSoonCard = ({ cabins }: { cabins: Cabin[] }) => {
  const freeingSoon = cabins
    .filter((cabin) => cabin.status === "BOOKED" && Number(cabin.contract?.endsInDays) <= 45)
    .sort((a, b) => Number(a.contract?.endsInDays) - Number(b.contract?.endsInDays));
  const overdue = cabins.filter((cabin) => Number(cabin.contract?.duesAmount) > 0);
  if (!freeingSoon.length && !overdue.length) return null;

  return (
    <Panel title="Freeing up in 45 days" icon="calendar-outline">
      {freeingSoon.length ? (
        freeingSoon.slice(0, 6).map((cabin) => (
          <View key={cabin.code} style={styles.freeRow}>
            <Text style={styles.freeCode}>{cabin.label}</Text>
            <Text style={styles.freeName} numberOfLines={1}>
              {cabin.client?.name}
            </Text>
            <Text style={styles.freeDays}>{cabin.contract?.endsInDays}d</Text>
          </View>
        ))
      ) : (
        <Text style={styles.muted}>Nothing ends in the next 45 days.</Text>
      )}
      {freeingSoon.length > 6 ? (
        <Text style={styles.muted}>+{freeingSoon.length - 6} more ending within 45 days</Text>
      ) : null}
      {overdue.length ? (
        <Banner
          tone="alert"
          style={styles.gapTop}
          message={`${formatCurrency(overdue.reduce((sum, cabin) => sum + Number(cabin.contract?.duesAmount || 0), 0))} overdue across ${overdue.length} ${overdue.length === 1 ? "cabin" : "cabins"}.`}
        />
      ) : null}
    </Panel>
  );
};

/* ------------------------------------------------------- selection bar -- */

export const SelectionBar = ({
  cabins,
  onRemove,
  onClear,
  onOnboard,
}: {
  cabins: Cabin[];
  onRemove: (code: string) => void;
  onClear: () => void;
  onOnboard: () => void;
}) => {
  if (!cabins.length) return null;
  const capacity = cabins.reduce((sum, cabin) => sum + cabin.seats, 0);
  const rent = cabins.reduce((sum, cabin) => sum + cabin.monthlyRent, 0);

  return (
    <View style={styles.selection}>
      <View style={styles.selectionHead}>
        <View style={styles.flex}>
          <Text style={styles.selectionTitle}>
            {cabins.length} {cabins.length === 1 ? "cabin" : "cabins"} · seats {capacity}
          </Text>
          <Text style={styles.muted}>{formatCurrency(rent)} / month</Text>
        </View>
        <BrandButton title="Clear" size="sm" variant="ghost" onPress={onClear} />
        <BrandButton title="Onboard client" icon="person-add" size="sm" onPress={onOnboard} />
      </View>
      <ChipRow>
        {cabins.map((cabin) => (
          <Chip
            key={cabin.code}
            active
            icon="close"
            label={`${cabin.label} · ${cabin.seats} seater`}
            onPress={() => onRemove(cabin.code)}
          />
        ))}
      </ChipRow>
    </View>
  );
};

/* --------------------------------------------------- birthday reminders -- */

type BirthdayClient = Partial<BoardClient> & { _id?: string; companyName?: string };

const upcomingBirthdays = (clients: BirthdayClient[], today = new Date()) => {
  const current = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(today);
  const anchor = new Date(`${current}T12:00:00Z`);
  const days = Array.from({ length: 8 }, (_, i) => new Date(anchor.getTime() + i * 86400000).toISOString().slice(5, 10));
  return clients
    .map((client) => {
      const dob =
        client.dateOfBirth
        || client.documents?.find((doc) => doc.extractedDateOfBirth)?.extractedDateOfBirth
        || "";
      return { ...client, daysUntil: days.indexOf(String(dob).slice(5, 10)) };
    })
    .filter((client) => client.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil);
};

/*
 * Web's BirthdayReminders: coworking clients from the relational API plus the
 * board's own, with a birthday in the next week. Polled every minute, as web
 * does, so the reminder turns over at midnight without a reload.
 */
export const BirthdayReminders = ({ clients }: { clients: BirthdayClient[] }) => {
  const [remote, setRemote] = useState<BirthdayClient[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let active = true;
    const load = () => {
      setNow(new Date());
      api
        .get("/coworking/clients/birthdays")
        .then(({ data }) => {
          if (active) setRemote(Array.isArray(data?.clients) ? data.clients : []);
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const upcoming = useMemo(() => {
    const unique = [
      ...new Map(
        [...remote, ...clients].map((client) => [client._id || client.id || client.phone || client.name, client]),
      ).values(),
    ];
    return upcomingBirthdays(unique, now);
  }, [clients, now, remote]);

  if (!upcoming.length) return null;
  // Violet, as web draws it; resolved per scheme so it survives dark mode.
  const violet = getActiveScheme() === "dark"
    ? { bg: "rgba(139, 92, 246, 0.12)", border: "rgba(139, 92, 246, 0.35)", ink: "#ddd6fe" }
    : { bg: "#f5f3ff", border: "#ddd6fe", ink: "#4c1d95" };
  return (
    <View style={[styles.birthdays, { backgroundColor: violet.bg, borderColor: violet.border }]} accessibilityRole="summary">
      <View style={styles.birthdayHead}>
        <Glyph name="gift" size={16} color={violet.ink} />
        <Text style={[styles.birthdayTitle, { color: violet.ink }]}>Birthday reminders</Text>
      </View>
      {upcoming.map((client) => (
        <Text key={String(client._id || client.id || client.name)} style={[styles.birthdayLine, { color: violet.ink }]}>
          {client.contactPerson || client.name || client.companyName}:{" "}
          {client.daysUntil === 0 ? "Birthday today" : `in ${client.daysUntil} days`}
        </Text>
      ))}
    </View>
  );
};

/* ---------------------------------------------------------- cabin detail -- */

const DAY = 24 * 60 * 60 * 1000;
const daysBetween = (from: string, to: string) =>
  Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY));
const monthsBetween = (from: string, to: string) => Math.max(1, Math.round(daysBetween(from, to) / 30));

const Section = ({
  title,
  count,
  icon,
  children,
}: {
  title: string;
  count?: string | number;
  icon?: GlyphName;
  children: React.ReactNode;
}) => (
  <View style={styles.section}>
    <View style={styles.sectionHead}>
      {icon ? <Glyph name={icon} size={13} color={brand.textMuted} /> : null}
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      {count !== undefined ? <Text style={styles.sectionCount}>{count}</Text> : null}
    </View>
    {children}
  </View>
);

/*
 * Everything known about one cabin, in the order a manager asks for it - who
 * is in it now, on what terms, and who was in it before. Web's
 * CabinDetailPanel.jsx, as a bottom sheet.
 */
export const CabinDetailSheet = ({
  cabin,
  onClose,
  onAction,
  onOnboard,
  onHold,
  onTransfer,
  onEditClient,
  onOpenClient,
}: {
  cabin: Cabin | null;
  onClose: () => void;
  onAction: (action: BoardAction) => void;
  onOnboard: (cabin: Cabin) => void;
  onHold: (cabin: Cabin) => void;
  onTransfer: (cabin: Cabin) => void;
  onEditClient: (cabin: Cabin) => void;
  onOpenClient: (cabin: Cabin) => void;
}) => {
  if (!cabin) return null;
  const meta = STATUS_META[cabin.status] || STATUS_META.VACANT;
  const contract = cabin.contract;
  const isLet = cabin.status === "BOOKED" || cabin.status === "RESERVED";
  const unavailable = cabin.status === "BLOCKED" || cabin.status === "MAINTENANCE";
  const termDays = contract ? daysBetween(contract.startDate, contract.endDate) : 0;
  const elapsed = contract ? Math.max(0, termDays - Number(contract.endsInDays || 0)) : 0;
  const expiring = Number(contract?.endsInDays) <= 45;
  const clientDateOfBirth =
    cabin.client?.dateOfBirth
    || cabin.client?.documents?.find((doc) => doc.extractedDateOfBirth)?.extractedDateOfBirth
    || "";

  return (
    <AppSheet visible onClose={onClose} title={`Cabin ${cabin.label}`} subtitle={`${cabin.seats} seater · Wing ${cabin.wing} · Coworking space`}>
      <View style={styles.detail}>
        <View style={styles.detailBadgeRow}>
          <View style={[styles.dot, { backgroundColor: meta.dot }]} />
          <Text style={styles.detailStatus}>{meta.label}</Text>
        </View>

        <View style={styles.statRow}>
          <StatTile label="Capacity" value={`${cabin.seats} seater`} />
          <StatTile label="Monthly rent" value={formatCurrency(cabin.monthlyRent)} />
        </View>

        {isLet && cabin.client && contract ? (
          <>
            <Section title={cabin.status === "RESERVED" ? "Held for" : "Current client"} icon="people-outline">
              <View style={styles.clientRow}>
                <Avatar name={cabin.client.name} size={36} />
                <View style={styles.flex}>
                  <Text style={styles.clientName} numberOfLines={1}>
                    {cabin.client.name}
                  </Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {cabin.client.industry} · with us since {formatDate(cabin.client.since)}
                  </Text>
                </View>
              </View>
              <KeyValue label="Contact" value={cabin.client.contactPerson} />
              <KeyValue label="Phone" value={cabin.client.phone} icon="call-outline" mono />
              <KeyValue label="Email" value={cabin.client.email} icon="mail-outline" />
              <KeyValue label="GSTIN" value={cabin.client.gstin} mono />
              <View style={styles.buttonRow}>
                <BrandButton title="Edit client" icon="create-outline" size="sm" variant="secondary" onPress={() => onEditClient(cabin)} style={styles.flex} />
                <BrandButton title="Open client record" icon="open-outline" size="sm" variant="secondary" onPress={() => onOpenClient(cabin)} style={styles.flex} />
              </View>
            </Section>

            <Section title="Agreement" count={contract.id}>
              <Text style={styles.body}>
                {formatDate(contract.startDate)} – {formatDate(contract.endDate)}
              </Text>
              {cabin.status === "BOOKED" ? (
                <>
                  <View style={styles.bar}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${termDays ? Math.round((elapsed / termDays) * 100) : 0}%`,
                          backgroundColor: expiring ? brand.warning : brand.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.muted, expiring && styles.warnText]}>
                    {contract.endsInDays} days left · lock-in {contract.lockInMonths} months
                  </Text>
                </>
              ) : (
                <Text style={[styles.muted, styles.warnText]}>
                  Hold expires {formatDate(cabin.holdExpiresAt)} · moves in {formatDate(contract.startDate)}
                </Text>
              )}

              <KeyValue label="Monthly rent" value={formatCurrency(contract.monthlyRent)} />
              <KeyValue label="Deposit" value={formatCurrency(contract.deposit)} />
              <KeyValue label="Token paid" value={formatCurrency(contract.tokenAmount || 0)} />
              <KeyValue label="Notice period" value={`${contract.noticePeriodDays ?? 30} days`} />
              <KeyValue label="Date of birth" value={clientDateOfBirth ? formatDate(clientDateOfBirth) : "-"} />
              <Text style={styles.subHead}>Security cheque</Text>
              <KeyValue label="Cheque number" value={contract.securityCheque?.number} />
              <KeyValue label="Bank" value={contract.securityCheque?.bank} />
              <KeyValue label="Amount" value={formatCurrency(contract.securityCheque?.amount || 0)} />
              <KeyValue label="Cheque date" value={contract.securityCheque?.date} />
              <KeyValue
                label="Payment status"
                value={<Pill label={contract.duesAmount > 0 ? "Overdue" : "Paid"} tone={contract.duesAmount > 0 ? "alert" : "success"} />}
              />
              <KeyValue label="Next due date" value={formatDate(contract.nextInvoiceDate)} />
              <KeyValue label="Next invoice" value={formatCurrency(contract.nextInvoiceAmount)} />

              {contract.duesAmount > 0 ? (
                <View style={styles.overdue}>
                  <Text style={styles.overdueText}>
                    {formatCurrency(contract.duesAmount)} overdue. Settle before renewing.
                  </Text>
                  <BrandButton
                    title="Record payment"
                    icon="cash-outline"
                    size="sm"
                    variant="secondary"
                    onPress={() => onAction({ type: "RECORD_PAYMENT", cabinCode: cabin.code })}
                  />
                </View>
              ) : null}

              {cabin.status === "BOOKED" ? (
                <>
                  <View style={styles.buttonRow}>
                    <BrandButton
                      title="Renew 12m"
                      icon="calendar-outline"
                      size="sm"
                      variant="secondary"
                      style={styles.flex}
                      onPress={() => onAction({ type: "RENEW", cabinCode: cabin.code, months: 12 })}
                    />
                    <BrandButton title="Move cabin" icon="swap-horizontal" size="sm" variant="secondary" style={styles.flex} onPress={() => onTransfer(cabin)} />
                  </View>
                  <BrandButton
                    title="Release cabin"
                    icon="log-out-outline"
                    size="sm"
                    variant="danger"
                    onPress={() => onAction({ type: "RELEASE", cabinCode: cabin.code })}
                  />
                </>
              ) : (
                <View style={styles.buttonRow}>
                  <BrandButton
                    title="Confirm booking"
                    size="sm"
                    style={styles.flex}
                    onPress={() => onAction({ type: "CONFIRM_HOLD", cabinCode: cabin.code })}
                  />
                  <BrandButton
                    title="Drop hold"
                    size="sm"
                    variant="secondary"
                    style={styles.flex}
                    onPress={() => onAction({ type: "DROP_HOLD", cabinCode: cabin.code })}
                  />
                </View>
              )}
            </Section>

            <Section title="Client documents" count={cabin.client.documents?.length || 0} icon="document-text-outline">
              <DocumentChecklist kind={cabin.client.kind || "company"} documents={cabin.client.documents || []} readOnly />
              <BrandButton
                title="Manage documents in client profile"
                icon="open-outline"
                size="sm"
                variant="secondary"
                onPress={() => onOpenClient(cabin)}
              />
            </Section>
          </>
        ) : null}

        {cabin.status === "VACANT" ? (
          <Section title="Available to let">
            <Text style={styles.body}>
              Free since {formatDate(cabin.vacantSince)} · <Text style={styles.bold}>{cabin.vacantDays || 0} days</Text> idle
            </Text>
            <KeyValue label="Deposit" value={`${formatCurrency(cabin.deposit)} (2 months)`} />
            <KeyValue label="Includes" value={(cabin.amenities || []).join(", ") || "Not configured"} />
            <BrandButton title="Onboard client" icon="person-add" onPress={() => onOnboard(cabin)} />
            <BrandButton title="Hold for a lead" size="sm" variant="secondary" onPress={() => onHold(cabin)} />
            <View style={styles.buttonRow}>
              <BrandButton
                title="Block"
                icon="ban-outline"
                size="sm"
                variant="ghost"
                style={styles.flex}
                onPress={() =>
                  onAction({ type: "SET_UNAVAILABLE", cabinCode: cabin.code, status: "BLOCKED", reason: "Blocked from the board." })
                }
              />
              <BrandButton
                title="Upkeep"
                icon="construct-outline"
                size="sm"
                variant="ghost"
                style={styles.flex}
                onPress={() =>
                  onAction({
                    type: "SET_UNAVAILABLE",
                    cabinCode: cabin.code,
                    status: "MAINTENANCE",
                    reason: "Sent for upkeep from the board.",
                  })
                }
              />
            </View>
          </Section>
        ) : null}

        {unavailable ? (
          <Section title="Off the market">
            <Text style={styles.body}>{cabin.unavailableReason}</Text>
            <BrandButton
              title="Return to inventory"
              icon="refresh"
              size="sm"
              variant="secondary"
              onPress={() => onAction({ type: "RETURN_TO_INVENTORY", cabinCode: cabin.code })}
            />
          </Section>
        ) : null}

        <Section title="Previous clients" count={cabin.previousClientCount} icon="time-outline">
          {cabin.previousClients.length ? (
            cabin.previousClients.map((stay) => (
              <View key={stay.id} style={styles.stayRow}>
                <Avatar name={stay.name} size={28} muted />
                <View style={styles.flex}>
                  <Text style={styles.stayName} numberOfLines={1}>
                    {stay.name}
                  </Text>
                  <Text style={styles.muted}>
                    {formatDate(stay.from)} – {formatDate(stay.to)} · {monthsBetween(stay.from, stay.to)} months
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>No earlier tenant on record. This cabin has only ever had its current occupant.</Text>
          )}
        </Section>
      </View>
    </AppSheet>
  );
};

/* ------------------------------------------------------------ hold sheet -- */

const HOLD_DAYS = [3, 7, 14, 30];

/*
 * Put a cabin on hold for a lead who has not signed yet. A hold has to expire
 * on its own - a cabin quietly held for a prospect who went cold is the most
 * expensive thing on a coworking floor - so the expiry is required.
 */
export const HoldSheet = ({
  cabin,
  onClose,
  onConfirm,
}: {
  cabin: Cabin | null;
  onClose: () => void;
  onConfirm: (payload: { cabinCode: string; name: string; days: number }) => void;
}) => {
  const [name, setName] = useState("");
  const [days, setDays] = useState(7);
  useEffect(() => {
    setName("");
    setDays(7);
  }, [cabin?.code]);
  if (!cabin) return null;

  return (
    <AppSheet
      visible
      onClose={onClose}
      title={`Hold cabin ${cabin.label}`}
      subtitle={`${cabin.seats} seater · ${formatCurrency(cabin.monthlyRent)} per month`}
      footer={
        <View style={styles.buttonRow}>
          <BrandButton title="Cancel" variant="secondary" style={styles.flex} onPress={onClose} />
          <BrandButton
            title={`Hold for ${days} days`}
            icon="timer-outline"
            style={styles.flex}
            disabled={!name.trim()}
            onPress={() => onConfirm({ cabinCode: cabin.code, name: name.trim(), days })}
          />
        </View>
      }
    >
      <Text style={styles.fieldLabel}>Lead or company name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Who is this held for?"
        placeholderTextColor={brand.placeholder}
        style={styles.input}
      />
      <Text style={[styles.fieldLabel, styles.gapTop]}>Hold expires in</Text>
      <ChipRow wrap>
        {HOLD_DAYS.map((option) => (
          <Chip key={option} label={`${option} days`} active={days === option} onPress={() => setDays(option)} />
        ))}
      </ChipRow>
      <Banner
        tone="warn"
        style={styles.gapTop}
        message="The cabin shows as Reserved and cannot be onboarded to anyone else. If the hold lapses, the board releases it automatically and logs it."
      />
    </AppSheet>
  );
};

/* -------------------------------------------------------- transfer sheet -- */

/*
 * Move a sitting client into a different cabin. The agreement carries over -
 * same id, same dates - and only the room and its rent change.
 */
export const TransferSheet = ({
  cabin,
  cabins,
  onClose,
  onConfirm,
}: {
  cabin: Cabin | null;
  cabins: Cabin[];
  onClose: () => void;
  onConfirm: (payload: { fromCode: string; toCode: string }) => void;
}) => {
  const [target, setTarget] = useState("");
  useEffect(() => setTarget(""), [cabin?.code]);
  if (!cabin) return null;

  const options = cabins
    .filter((item) => item.status === "VACANT" && item.code !== cabin.code)
    .sort((a, b) => a.seats - b.seats || a.code.localeCompare(b.code));
  const chosen = options.find((item) => item.code === target);
  const difference = chosen ? chosen.monthlyRent - cabin.monthlyRent : 0;

  return (
    <AppSheet
      visible
      onClose={onClose}
      title={`Move ${cabin.client?.name || "client"} out of ${cabin.label}`}
      subtitle="The agreement carries over. Only the room and its rent change."
      footer={
        <View style={styles.buttonRow}>
          <BrandButton title="Cancel" variant="secondary" style={styles.flex} onPress={onClose} />
          <BrandButton
            title={`Move to ${chosen?.label || "…"}`}
            icon="swap-horizontal"
            style={styles.flex}
            disabled={!chosen}
            onPress={() => chosen && onConfirm({ fromCode: cabin.code, toCode: chosen.code })}
          />
        </View>
      }
    >
      {chosen ? (
        <View style={styles.moveCard}>
          <View style={styles.flex}>
            <Text style={styles.muted}>From</Text>
            <Text style={styles.clientName}>
              {cabin.label} · {cabin.seats} seater
            </Text>
            <Text style={styles.muted}>{formatCurrency(cabin.contract?.monthlyRent ?? cabin.monthlyRent)}/mo</Text>
          </View>
          <Glyph name="arrow-forward" size={16} color={brand.textMuted} />
          <View style={styles.flex}>
            <Text style={styles.muted}>To</Text>
            <Text style={styles.clientName}>
              {chosen.label} · {chosen.seats} seater
            </Text>
            <Text style={[styles.muted, difference > 0 ? styles.upText : difference < 0 ? styles.warnText : null]}>
              {formatCurrency(chosen.monthlyRent)}/mo
              {difference !== 0 ? ` (${difference > 0 ? "+" : ""}${formatCurrency(difference)})` : " (same rent)"}
            </Text>
          </View>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>VACANT CABINS ({options.length})</Text>
      {options.length ? (
        options.map((option) => (
          <Pressable
            key={option.code}
            onPress={() => setTarget(option.code)}
            style={[styles.optionRow, target === option.code && styles.optionRowActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: target === option.code }}
          >
            <Text style={styles.clientName}>{option.label}</Text>
            <Text style={styles.muted}>{option.seats} seater</Text>
            <Text style={styles.optionRent}>{formatCurrency(option.monthlyRent)}</Text>
          </Pressable>
        ))
      ) : (
        <EmptyNote title="No vacant cabin to move into" message="Release one first, or drop a hold." />
      )}
    </AppSheet>
  );
};

/* -------------------------------------------------------- activity sheet -- */

const KINDS: Record<string, { icon: GlyphName; tone: "success" | "warn" | "alert" | "info" | "neutral" }> = {
  onboard: { icon: "person-add", tone: "success" },
  book: { icon: "checkmark", tone: "success" },
  hold: { icon: "timer-outline", tone: "warn" },
  expire: { icon: "timer-outline", tone: "warn" },
  release: { icon: "log-out-outline", tone: "alert" },
  renew: { icon: "calendar-outline", tone: "info" },
  transfer: { icon: "swap-horizontal", tone: "info" },
  block: { icon: "ban-outline", tone: "neutral" },
  unblock: { icon: "refresh", tone: "neutral" },
  payment: { icon: "cash-outline", tone: "success" },
  edit: { icon: "create-outline", tone: "neutral" },
  document: { icon: "document-text-outline", tone: "neutral" },
};

/* What has happened to this floor, newest first. */
export const ActivitySheet = ({
  visible,
  activity,
  onClose,
  onOpenCabin,
}: {
  visible: boolean;
  activity: ActivityEntry[];
  onClose: () => void;
  onOpenCabin: (code: string) => void;
}) => (
  <AppSheet
    visible={visible}
    onClose={onClose}
    title="Activity"
    subtitle={activity.length ? `${activity.length} recorded for this coworking space` : "Nothing recorded yet"}
    footer={<BrandButton title="Done" onPress={onClose} />}
  >
    {activity.length ? (
      activity.map((item) => {
        const kind = KINDS[item.kind] || KINDS.edit;
        return (
          <View key={item.id} style={styles.activityRow}>
            <View style={styles.activityIcon}>
              <Glyph name={kind.icon} size={14} color={brand.deep} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.clientName}>{item.title}</Text>
              <Text style={styles.muted}>{item.detail}</Text>
              <View style={styles.activityCodes}>
                {(item.cabinCodes || []).map((code) => (
                  <Pressable key={code} onPress={() => onOpenCabin(code)} style={styles.codeChip} accessibilityRole="button">
                    <Text style={styles.codeChipText}>{cabinLabel(code)}</Text>
                  </Pressable>
                ))}
                <Text style={styles.activityAt}>{formatDateTime(item.at)}</Text>
              </View>
            </View>
          </View>
        );
      })
    ) : (
      <EmptyNote title="Nothing recorded yet" message="Onboard a client, hold a cabin or record a payment and it will show up here." />
    )}
  </AppSheet>
);

export const statusLabel = (status: CabinStatus) => STATUS_META[status]?.label || status;

const styles = brandStyles((b) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    muted: { fontSize: t.label, lineHeight: 16, color: b.textMuted },
    body: { fontSize: t.body, lineHeight: 18, color: b.textSecondary },
    bold: { fontWeight: "700", color: b.text },
    gapTop: { marginTop: 10 },
    warnText: { color: b.warnInk, fontWeight: "600" },
    upText: { color: b.deep },

    occHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    occTitle: { fontSize: t.cardTitle, fontWeight: "700", color: b.text },
    occPercent: { fontSize: 24, fontWeight: "700", letterSpacing: -0.6, color: b.text },
    occCaption: { marginTop: 2, fontSize: t.body, color: b.textMuted },
    bar: { height: 6, marginVertical: 8, borderRadius: 3, overflow: "hidden", backgroundColor: b.hairline },
    barFill: { height: "100%", borderRadius: 3, backgroundColor: b.primary },
    statRow: { flexDirection: "row", gap: 8 },

    statusRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 8, borderRadius: round.field },
    statusRowActive: { backgroundColor: b.fieldMuted },
    dot: { width: 10, height: 10, borderRadius: 5 },
    statusLabel: { flex: 1, fontSize: t.body, color: b.textSecondary },
    statusCount: { fontSize: t.body, fontWeight: "700", color: b.text },

    freeRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
    freeCode: { fontSize: t.label, fontWeight: "700", color: b.text },
    freeName: { flex: 1, fontSize: t.label, color: b.textMuted },
    freeDays: { fontSize: t.label, fontWeight: "600", color: b.warnInk },

    selection: { gap: 8 },
    selectionHead: { flexDirection: "row", alignItems: "center", gap: 6 },
    selectionTitle: { fontSize: t.cardTitle, fontWeight: "700", color: b.text },

    birthdays: { padding: 12, gap: 3, borderRadius: round.panel, borderWidth: 1 },
    birthdayHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
    birthdayTitle: { fontSize: t.cardTitle, fontWeight: "700" },
    birthdayLine: { fontSize: t.body },

    detail: { gap: 12 },
    detailBadgeRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    detailStatus: { fontSize: t.body, fontWeight: "700", color: b.text },
    section: { gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: b.hairline },
    sectionHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
    sectionTitle: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6, color: b.textMuted },
    sectionCount: {
      paddingHorizontal: 6,
      borderRadius: round.pill,
      overflow: "hidden",
      backgroundColor: b.fieldMuted,
      fontSize: 10.5,
      fontWeight: "700",
      color: b.textSecondary,
    },
    subHead: { marginTop: 6, fontSize: t.label, fontWeight: "700", color: b.text },
    clientRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
    clientName: { fontSize: t.body, fontWeight: "700", color: b.text },
    buttonRow: { flexDirection: "row", gap: 8, marginTop: 4 },
    overdue: { gap: 8, padding: 10, borderRadius: round.field, backgroundColor: b.alertTint },
    overdueText: { fontSize: t.label, fontWeight: "600", color: b.alertInk },
    stayRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 8,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
    },
    stayName: { fontSize: t.body, fontWeight: "600", color: b.text },

    fieldLabel: { marginBottom: 6, fontSize: t.fieldLabel, fontWeight: "500", color: b.text },
    input: {
      height: 44,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: b.fieldBorder,
      borderRadius: round.field,
      fontSize: t.field,
      color: b.text,
      backgroundColor: b.surface,
    },
    moveCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 7,
      paddingHorizontal: 12,
      height: 44,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
    },
    optionRowActive: { borderColor: b.primary, backgroundColor: b.tintSoft },
    optionRent: { marginLeft: "auto", fontSize: t.label, fontWeight: "600", color: b.textSecondary },

    activityRow: {
      flexDirection: "row",
      gap: 10,
      padding: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
    },
    activityIcon: {
      width: 28,
      height: 28,
      borderRadius: 7,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    activityCodes: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5, marginTop: 5 },
    codeChip: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: b.fieldBorder,
      borderRadius: round.pill,
    },
    codeChipText: { fontSize: 10.5, fontWeight: "700", color: b.textSecondary },
    activityAt: { marginLeft: "auto", fontSize: 10.5, color: b.placeholder },
  }),
);
