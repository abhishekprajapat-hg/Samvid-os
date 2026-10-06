import { CABIN_SEATS, cabinLabel, type CabinStatus } from "./cabinData";

/*
 * The booking board's single source of truth - a port of the pure half of
 * frontend/src/modules/coworking/booking/boardStore.js.
 *
 * Web and mobile read and write the same document (GET/PUT /coworking/board),
 * so this reducer must produce exactly what web's does: same action names, same
 * cabin and contract shape, same activity entries. A cabin onboarded from a
 * phone is then indistinguishable on the desktop board, and the reverse.
 *
 * Kept free of React and storage so it can be tested on its own - see
 * test/boardReducer.test.cjs.
 */

export type ClientDocument = {
  id: string;
  key: string;
  label: string;
  fileName: string;
  size: number;
  type: string;
  uploadedAt: string;
  status: "PENDING" | "VERIFIED";
  verifiedAt: string | null;
  extractedDateOfBirth?: string;
};

export type BoardClient = {
  id: string;
  name: string;
  kind?: string;
  entityType?: string;
  companyName?: string;
  industry?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  pan?: string;
  dateOfBirth?: string;
  since?: string;
  documents?: ClientDocument[];
  [key: string]: unknown;
};

export type SecurityCheque = {
  number?: string;
  bank?: string;
  amount?: number | string;
  date?: string;
  notes?: string;
  /* Copy of the cheque, uploaded to the server from the web onboarding form. */
  file?: { url?: string; fileName?: string; size?: number; type?: string; uploadedAt?: string } | null;
};

export type BoardContract = {
  id: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  deposit: number;
  /* "custom" = an amount typed in; otherwise a multiple of rent. */
  depositMode?: "months" | "custom";
  depositMonths?: number | null;
  lockInMonths: number;
  noticePeriodDays?: number;
  tokenAmount?: number;
  securityCheque?: SecurityCheque;
  nextInvoiceDate: string;
  nextInvoiceAmount: number;
  duesAmount: number;
  notes?: string;
  /* Derived by decorate(), never stored meaningfully. */
  endsInDays?: number;
};

export type PreviousStay = {
  id: string;
  clientId?: string;
  name: string;
  client?: Partial<BoardClient>;
  from: string;
  to: string;
  seats?: number;
};

export type Cabin = {
  code: string;
  label: string;
  wing: string;
  seats: number;
  status: CabinStatus;
  client: BoardClient | null;
  contract: BoardContract | null;
  holdExpiresAt: string | null;
  unavailableReason: string;
  vacantSince: string | null;
  monthlyRent: number;
  deposit: number;
  amenities: string[];
  previousClients: PreviousStay[];
  previousClientCount: number;
  /* Derived by decorate(). */
  vacantDays?: number;
};

export type ActivityEntry = {
  id: string;
  at: string;
  kind: string;
  title: string;
  detail: string;
  cabinCodes: string[];
};

export type BoardState = { cabins: Cabin[]; activity: ActivityEntry[] };
export type BoardWithHistory = BoardState & { undoStack: BoardState[] };

export type OnboardTerms = {
  startDate: string;
  termMonths: number;
  lockInMonths?: number;
  rent: number;
  depositMonths?: number;
  depositMode?: "months" | "custom";
  depositAmount?: number | string | null;
  noticePeriodDays?: number | string;
  tokenAmount?: number | string;
  securityCheque?: SecurityCheque;
  notes?: string;
};

export type BoardAction =
  | { type: "ONBOARD"; cabinCodes: string[]; client: Partial<BoardClient> & { name: string }; terms: OnboardTerms }
  | { type: "HOLD"; cabinCode: string; name: string; days: number }
  | { type: "CONFIRM_HOLD"; cabinCode: string }
  | { type: "DROP_HOLD"; cabinCode: string }
  | { type: "RELEASE"; cabinCode: string }
  | { type: "RENEW"; cabinCode: string; months: number }
  | { type: "TRANSFER"; fromCode: string; toCode: string }
  | { type: "SET_UNAVAILABLE"; cabinCode: string; status: CabinStatus; reason: string }
  | { type: "RETURN_TO_INVENTORY"; cabinCode: string }
  | { type: "RECORD_PAYMENT"; cabinCode: string }
  | { type: "SET_CLIENT_DOCUMENTS"; clientId: string; documents: ClientDocument[] }
  | { type: "UPDATE_CLIENT"; clientId: string; client: Partial<BoardClient>; terms: Partial<OnboardTerms> }
  | { type: "UPDATE_CABIN"; cabinCode: string; seats?: number; monthlyRent?: number }
  | { type: "REPLACE_ALL"; state: Partial<BoardState> }
  | { type: "UNDO" }
  | { type: "RESET" };

const DAY = 24 * 60 * 60 * 1000;
const UNDO_DEPTH = 15;

/* Physical cabin inventory is part of the layout, not demo data. */
export const emptyInventory = (): Cabin[] =>
  Object.entries(CABIN_SEATS).map(([code, seats]) => ({
    code,
    label: cabinLabel(code),
    wing: code[0],
    seats,
    status: "VACANT",
    client: null,
    contract: null,
    holdExpiresAt: null,
    unavailableReason: "",
    vacantSince: null,
    monthlyRent: 0,
    deposit: 0,
    amenities: [],
    previousClients: [],
    previousClientCount: 0,
  }));

const daysBetween = (from: string | Date, to: string | Date) =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY);
const addMonths = (iso: string, months: number) => {
  const date = new Date(iso);
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
};
const addDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * DAY).toISOString();

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
export const slug = (name: string) => String(name).toLowerCase().replace(/[^a-z]+/g, "");

/* Day-counts are derived, never stored. */
export const decorate = (cabins: Cabin[]): Cabin[] => {
  const now = new Date().toISOString();
  return cabins.map((cabin) => ({
    ...cabin,
    previousClients: Array.isArray(cabin.previousClients) ? cabin.previousClients : [],
    previousClientCount: Number(cabin.previousClientCount || 0),
    vacantDays: cabin.vacantSince ? Math.max(0, daysBetween(cabin.vacantSince, now)) : 0,
    contract: cabin.contract
      ? { ...cabin.contract, endsInDays: daysBetween(now, cabin.contract.endDate) }
      : null,
  }));
};

const entry = (kind: string, title: string, detail: string, cabinCodes: string[] = []): ActivityEntry => ({
  id: uid("act"),
  at: new Date().toISOString(),
  kind,
  title,
  detail,
  cabinCodes,
});

/** Move the sitting client into the cabin's history. */
const archiveClient = (cabin: Cabin): PreviousStay[] => {
  if (!cabin.client || !cabin.contract) return cabin.previousClients;
  return [
    {
      id: `${slug(cabin.client.name)}-${cabin.code}-${Date.now()}`,
      clientId: cabin.client.id,
      name: cabin.client.name,
      client: { ...cabin.client, documents: [...(cabin.client.documents || [])] },
      from: cabin.contract.startDate,
      to: new Date().toISOString(),
      seats: cabin.seats,
    },
    ...cabin.previousClients,
  ];
};

const vacate = (cabin: Cabin, extra: Partial<Cabin> = {}): Cabin => ({
  ...cabin,
  status: "VACANT",
  client: null,
  contract: null,
  holdExpiresAt: null,
  unavailableReason: "",
  vacantSince: new Date().toISOString(),
  ...extra,
});

const patch = (cabins: Cabin[], codes: string[], update: (cabin: Cabin) => Partial<Cabin>) =>
  cabins.map((cabin) => (codes.includes(cabin.code) ? { ...cabin, ...update(cabin) } : cabin));

/* Rent for a multi-cabin agreement is apportioned by each cabin's list rent. */
const shareOf = (cabin: Cabin, selected: Cabin[], total: number) => {
  const amount = Number(total) || 0;
  if (!amount || !selected.length) return 0;
  const list = selected.reduce((sum, item) => sum + (Number(item.monthlyRent) || 0), 0);
  // Cabins without a list rate still carry what was typed in: split evenly.
  if (!list) return Math.round(amount / selected.length);
  return Math.round(((Number(cabin.monthlyRent) || 0) / list) * amount);
};

/* Deposit for one cabin; a custom amount is split across cabins by rent, as on web. */
export const depositFor = (cabin: Cabin, cabins: Cabin[], terms: Partial<OnboardTerms>, rent: number) => {
  if (terms?.depositMode === "custom") {
    const total = Number(terms.depositAmount);
    return Number.isFinite(total) && total >= 0 ? shareOf(cabin, cabins, total) : 0;
  }
  return Math.round(rent * (Number(terms?.depositMonths) || 2));
};

const depositFields = (terms: Partial<OnboardTerms>) => ({
  depositMode: (terms.depositMode === "custom" ? "custom" : "months") as "months" | "custom",
  depositMonths: terms.depositMode === "custom" ? null : Number(terms.depositMonths) || 2,
});

const stayClientId = (stay: PreviousStay) => String(stay.clientId || stay.client?.id || slug(stay.name));

export const boardReducer = (state: BoardState, action: BoardAction): BoardState => {
  const { cabins, activity } = state;
  const now = new Date().toISOString();

  switch (action.type) {
    case "ONBOARD": {
      const { cabinCodes, client, terms } = action;
      const selected = cabins.filter((cabin) => cabinCodes.includes(cabin.code));
      const startDate = new Date(terms.startDate).toISOString();
      const endDate = addMonths(startDate, terms.termMonths);
      const agreementId = `AGR-${new Date().getFullYear()}-${String(activity.length + 1).padStart(3, "0")}`;

      const next = patch(cabins, cabinCodes, (cabin) => {
        const rent = shareOf(cabin, selected, terms.rent);
        return {
          status: "BOOKED",
          vacantSince: null,
          holdExpiresAt: null,
          client: { ...client, id: String(client.id || slug(client.name)), name: client.name, since: startDate },
          contract: {
            id: agreementId,
            startDate,
            endDate,
            monthlyRent: rent,
            deposit: depositFor(cabin, selected, terms, rent),
            ...depositFields(terms),
            lockInMonths: terms.lockInMonths ?? 0,
            noticePeriodDays: Number(terms.noticePeriodDays ?? 30),
            tokenAmount: shareOf(cabin, selected, Number(terms.tokenAmount || 0)),
            securityCheque: { ...terms.securityCheque },
            nextInvoiceDate: addMonths(startDate, 1),
            nextInvoiceAmount: rent,
            duesAmount: 0,
            notes: terms.notes || "",
          },
        };
      });

      return {
        cabins: next,
        activity: [
          entry(
            "onboard",
            `${client.name} onboarded`,
            `${cabinCodes.length} ${cabinCodes.length === 1 ? "cabin" : "cabins"} on a ${terms.termMonths}-month agreement (${agreementId})`,
            cabinCodes,
          ),
          ...activity,
        ],
      };
    }

    case "HOLD": {
      const { cabinCode, name, days } = action;
      return {
        cabins: patch(cabins, [cabinCode], (cabin) => ({
          status: "RESERVED",
          vacantSince: null,
          holdExpiresAt: addDays(now, days),
          client: { id: slug(name), name, industry: "Prospect", contactPerson: "", phone: "", email: "", gstin: "" },
          contract: {
            id: uid("HOLD").toUpperCase(),
            startDate: addDays(now, days),
            endDate: addMonths(addDays(now, days), 12),
            monthlyRent: cabin.monthlyRent,
            deposit: cabin.deposit,
            lockInMonths: 0,
            nextInvoiceDate: addDays(now, days),
            nextInvoiceAmount: cabin.monthlyRent,
            duesAmount: 0,
          },
        })),
        activity: [entry("hold", `${cabinCode} held for ${name}`, `Hold expires in ${days} days`, [cabinCode]), ...activity],
      };
    }

    case "CONFIRM_HOLD": {
      const cabin = cabins.find((item) => item.code === action.cabinCode);
      if (!cabin?.contract) return state;
      return {
        cabins: patch(cabins, [action.cabinCode], () => ({
          status: "BOOKED",
          holdExpiresAt: null,
          contract: { ...(cabin.contract as BoardContract), startDate: now, endDate: addMonths(now, 12) },
        })),
        activity: [
          entry("book", `${action.cabinCode} confirmed`, `${cabin.client?.name} moves in, 12-month agreement`, [action.cabinCode]),
          ...activity,
        ],
      };
    }

    case "DROP_HOLD": {
      const cabin = cabins.find((item) => item.code === action.cabinCode);
      return {
        cabins: patch(cabins, [action.cabinCode], (item) => vacate(item)),
        activity: [
          entry("release", `Hold dropped on ${action.cabinCode}`, `${cabin?.client?.name} did not proceed`, [action.cabinCode]),
          ...activity,
        ],
      };
    }

    case "RELEASE": {
      const cabin = cabins.find((item) => item.code === action.cabinCode);
      return {
        cabins: patch(cabins, [action.cabinCode], (item) =>
          vacate(item, { previousClients: archiveClient(item), previousClientCount: item.previousClientCount + 1 }),
        ),
        activity: [
          entry("release", `${action.cabinCode} released`, `${cabin?.client?.name} moved out`, [action.cabinCode]),
          ...activity,
        ],
      };
    }

    case "RENEW": {
      const cabin = cabins.find((item) => item.code === action.cabinCode);
      if (!cabin?.contract) return state;
      const from = new Date(cabin.contract.endDate) > new Date(now) ? cabin.contract.endDate : now;
      return {
        cabins: patch(cabins, [action.cabinCode], (item) => ({
          contract: { ...(item.contract as BoardContract), endDate: addMonths(from, action.months) },
        })),
        activity: [
          entry("renew", `${action.cabinCode} renewed`, `${cabin.client?.name} extended by ${action.months} months`, [action.cabinCode]),
          ...activity,
        ],
      };
    }

    case "TRANSFER": {
      const from = cabins.find((item) => item.code === action.fromCode);
      const to = cabins.find((item) => item.code === action.toCode);
      if (!from || !to || !from.contract) return state;
      let next = patch(cabins, [action.toCode], () => ({
        status: from.status,
        vacantSince: null,
        client: from.client,
        // The room changes, the agreement does not - same id, same dates.
        contract: { ...(from.contract as BoardContract), monthlyRent: to.monthlyRent, deposit: to.deposit },
      }));
      next = patch(next, [action.fromCode], (item) =>
        vacate(item, { previousClients: archiveClient(item), previousClientCount: item.previousClientCount + 1 }),
      );
      return {
        cabins: next,
        activity: [
          entry(
            "transfer",
            `${from.client?.name} moved to ${action.toCode}`,
            `From ${action.fromCode} (${from.seats} seater) to ${action.toCode} (${to.seats} seater)`,
            [action.fromCode, action.toCode],
          ),
          ...activity,
        ],
      };
    }

    case "SET_UNAVAILABLE": {
      const { cabinCode, status, reason } = action;
      return {
        cabins: patch(cabins, [cabinCode], () => ({
          status,
          client: null,
          contract: null,
          holdExpiresAt: null,
          unavailableReason: reason,
          vacantSince: null,
        })),
        activity: [entry("block", `${cabinCode} marked ${status.toLowerCase()}`, reason, [cabinCode]), ...activity],
      };
    }

    case "RETURN_TO_INVENTORY":
      return {
        cabins: patch(cabins, [action.cabinCode], (item) => vacate(item)),
        activity: [
          entry("unblock", `${action.cabinCode} back in inventory`, "Available to let again", [action.cabinCode]),
          ...activity,
        ],
      };

    case "RECORD_PAYMENT": {
      const cabin = cabins.find((item) => item.code === action.cabinCode);
      if (!cabin?.contract) return state;
      const amount = cabin.contract.duesAmount || cabin.contract.nextInvoiceAmount;
      return {
        cabins: patch(cabins, [action.cabinCode], (item) => ({
          contract: {
            ...(item.contract as BoardContract),
            duesAmount: 0,
            nextInvoiceDate: addMonths((item.contract as BoardContract).nextInvoiceDate, 1),
          },
        })),
        activity: [
          entry("payment", `Payment recorded for ${action.cabinCode}`, `${cabin.client?.name} · ${amount}`, [action.cabinCode]),
          ...activity,
        ],
      };
    }

    /*
     * Documents live on the client, and the client is stored on every cabin
     * they hold - so a chased-up Aadhaar has to land on all of them.
     */
    case "SET_CLIENT_DOCUMENTS": {
      const held = cabins.filter((cabin) => cabin.client?.id === action.clientId);
      const formerCabins = cabins.filter((cabin) =>
        cabin.previousClients.some((stay) => stayClientId(stay) === String(action.clientId)));
      if (!held.length && !formerCabins.length) return state;
      const formerStay = formerCabins[0]?.previousClients.find(
        (stay) => stayClientId(stay) === String(action.clientId),
      );
      const previousDocuments = held[0]?.client?.documents || formerStay?.client?.documents || [];
      const clientName = held[0]?.client?.name || formerStay?.name || "Former client";
      const affectedCabins = [...new Set([...held, ...formerCabins].map((cabin) => cabin.code))];
      const added = action.documents.length - previousDocuments.length;
      return {
        cabins: cabins.map((cabin) => ({
          ...cabin,
          client: cabin.client?.id === action.clientId
            ? {
                ...cabin.client,
                documents: action.documents,
                dateOfBirth: cabin.client.dateOfBirth
                  || action.documents.find((doc) => doc.extractedDateOfBirth)?.extractedDateOfBirth
                  || "",
              }
            : cabin.client,
          previousClients: cabin.previousClients.map((stay) =>
            stayClientId(stay) === String(action.clientId)
              ? {
                  ...stay,
                  clientId: action.clientId,
                  client: {
                    ...(stay.client || {}),
                    id: action.clientId,
                    name: stay.name,
                    kind: stay.client?.kind || "company",
                    documents: action.documents,
                  },
                }
              : stay),
        })),
        activity: [
          entry(
            "document",
            `Documents updated for ${clientName}`,
            `${action.documents.length} on file${added > 0 ? `, ${added} added` : ""}`,
            affectedCabins,
          ),
          ...activity,
        ],
      };
    }

    case "UPDATE_CLIENT": {
      const held = cabins.filter((cabin) => cabin.client?.id === action.clientId);
      if (!held.length || !held[0].contract) return state;
      const changes = action.client || {};
      const terms = action.terms || {};
      const startDate = new Date(terms.startDate || held[0].contract.startDate).toISOString();
      const endDate = addMonths(startDate, Number(terms.termMonths) || 12);
      const totalRent = Number(terms.rent);
      return {
        cabins: cabins.map((cabin) =>
          cabin.client?.id === action.clientId && cabin.contract
            ? {
                ...cabin,
                client: { ...cabin.client, ...changes, id: cabin.client.id } as BoardClient,
                contract: {
                  ...cabin.contract,
                  startDate,
                  endDate,
                  monthlyRent: Number.isFinite(totalRent) ? shareOf(cabin, held, totalRent) : cabin.contract.monthlyRent,
                  deposit: terms.depositMode === "custom"
                    ? depositFor(cabin, held, terms, 0)
                    : Number.isFinite(totalRent)
                      ? Math.round(shareOf(cabin, held, totalRent) * (Number(terms.depositMonths) || 2))
                      : cabin.contract.deposit,
                  ...depositFields(terms),
                  lockInMonths: Number(terms.lockInMonths) || 0,
                  noticePeriodDays: Number(terms.noticePeriodDays ?? 30),
                  tokenAmount: shareOf(cabin, held, Number(terms.tokenAmount || 0)),
                  securityCheque: { ...terms.securityCheque },
                  notes: terms.notes || "",
                },
              }
            : cabin,
        ),
        activity: [
          entry(
            "edit",
            `${changes.name || held[0].client?.name} updated`,
            "Onboarded client details updated",
            held.map((cabin) => cabin.code),
          ),
          ...activity,
        ],
      };
    }

    case "UPDATE_CABIN":
      return {
        cabins: patch(cabins, [action.cabinCode], (item) => ({
          seats: action.seats ?? item.seats,
          monthlyRent: action.monthlyRent ?? item.monthlyRent,
          deposit: (action.monthlyRent ?? item.monthlyRent) * 2,
        })),
        activity: [
          entry("edit", `${action.cabinCode} updated`, `Capacity ${action.seats} seater`, [action.cabinCode]),
          ...activity,
        ],
      };

    default:
      return state;
  }
};

/* A hold whose expiry has passed is not a held cabin, so it is swept on load. */
export const expireHolds = (state: BoardState): BoardState => {
  const now = Date.now();
  const stale = state.cabins.filter(
    (cabin) => cabin.status === "RESERVED" && cabin.holdExpiresAt && new Date(cabin.holdExpiresAt).getTime() < now,
  );
  if (!stale.length) return state;
  return {
    cabins: state.cabins.map((cabin) => (stale.includes(cabin) ? vacate(cabin) : cabin)),
    activity: [
      entry(
        "expire",
        `${stale.length} ${stale.length === 1 ? "hold" : "holds"} expired`,
        stale.map((cabin) => cabin.code).join(", "),
        stale.map((cabin) => cabin.code),
      ),
      ...state.activity,
    ],
  };
};

export const initialBoard = (): BoardWithHistory => ({
  cabins: decorate(emptyInventory()),
  activity: [],
  undoStack: [],
});

/** Reducer wrapper that keeps an undo stack and re-derives the day counts. */
export const boardWithHistory = (state: BoardWithHistory, action: BoardAction): BoardWithHistory => {
  /*
   * Hydration from the server replaces the floor outright and clears the undo
   * stack, because undoing back past someone else's saved state would push this
   * device's idea of the floor over theirs.
   */
  if (action.type === "REPLACE_ALL") {
    const swept = expireHolds({
      cabins: Array.isArray(action.state?.cabins) ? (action.state.cabins as Cabin[]) : [],
      activity: Array.isArray(action.state?.activity) ? (action.state.activity as ActivityEntry[]) : [],
    });
    return { cabins: decorate(swept.cabins), activity: swept.activity, undoStack: [] };
  }
  if (action.type === "UNDO") {
    if (!state.undoStack.length) return state;
    const [previous, ...rest] = state.undoStack;
    return { cabins: decorate(previous.cabins), activity: previous.activity, undoStack: rest };
  }
  if (action.type === "RESET") return initialBoard();

  const next = boardReducer({ cabins: state.cabins, activity: state.activity }, action);
  if (next.cabins === state.cabins && next.activity === state.activity) return state;

  return {
    cabins: decorate(next.cabins),
    activity: next.activity,
    undoStack: [{ cabins: state.cabins, activity: state.activity }, ...state.undoStack].slice(0, UNDO_DEPTH),
  };
};

/* ------------------------------------------------------------ directory -- */

const monthsBetween = (from: string, to: string) =>
  Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY / 30));

export type BoardClientSummary = BoardClient & {
  entityKind: string;
  documents: ClientDocument[];
  cabins: Cabin[];
  capacity: number;
  monthlyRent: number;
  duesAmount: number;
  earliestEnd: string | null;
};

/** Clients, derived from the cabins they hold. There is no separate list. */
export const clientsFrom = (cabins: Cabin[]): BoardClientSummary[] => {
  const byId = new Map<string, BoardClientSummary>();
  cabins
    .filter((cabin) => cabin.client && (cabin.status === "BOOKED" || cabin.status === "RESERVED"))
    .forEach((cabin) => {
      const client = cabin.client as BoardClient;
      const existing = byId.get(client.id) || {
        ...client,
        entityKind: client.kind || "company",
        documents: client.documents || [],
        cabins: [],
        capacity: 0,
        monthlyRent: 0,
        duesAmount: 0,
        earliestEnd: null,
      };
      existing.cabins.push(cabin);
      existing.capacity += cabin.seats;
      existing.monthlyRent += cabin.contract?.monthlyRent || 0;
      existing.duesAmount += cabin.contract?.duesAmount || 0;
      if (cabin.contract && (!existing.earliestEnd || new Date(cabin.contract.endDate) < new Date(existing.earliestEnd))) {
        existing.earliestEnd = cabin.contract.endDate;
      }
      byId.set(client.id, existing);
    });
  return [...byId.values()].sort((a, b) => b.monthlyRent - a.monthlyRent);
};

export type ClientStay = {
  id: string;
  cabinCode: string;
  cabinLabel: string;
  seats: number;
  from: string;
  to: string;
  months: number;
};

type DirectoryRecord = BoardClientSummary & {
  kind: "active" | "former";
  stays: ClientStay[];
  totalMonths: number;
  lastLeft: string | null;
};

export type DirectoryClient = DirectoryRecord & { returning: boolean };

/*
 * Everyone who has ever held a cabin on this floor - current tenants from the
 * cabins they sit in, former ones from each cabin's history. A name in both is
 * one record: a returning client.
 */
export const directoryFrom = (cabins: Cabin[]): DirectoryClient[] => {
  const active = clientsFrom(cabins);
  const byName = new Map<string, DirectoryRecord>(
    active.map((client) => [
      client.name,
      { ...client, kind: "active" as const, stays: [], totalMonths: 0, lastLeft: null },
    ]),
  );

  cabins.forEach((cabin) => {
    cabin.previousClients.forEach((stay) => {
      const snapshot = (stay.client || {}) as Partial<BoardClient>;
      const record: DirectoryRecord = byName.get(stay.name) || {
        ...snapshot,
        id: String(stay.clientId || snapshot.id || slug(stay.name)),
        name: stay.name,
        kind: "former" as const,
        entityKind: String(snapshot.kind || "company"),
        documents: snapshot.documents || [],
        industry: snapshot.industry || "",
        contactPerson: snapshot.contactPerson || "",
        phone: snapshot.phone || "",
        email: snapshot.email || "",
        gstin: snapshot.gstin || "",
        cabins: [],
        capacity: 0,
        monthlyRent: 0,
        duesAmount: 0,
        earliestEnd: null,
        stays: [],
        totalMonths: 0,
        lastLeft: null,
      };
      record.stays.push({
        id: stay.id,
        cabinCode: cabin.code,
        cabinLabel: cabin.label,
        seats: stay.seats ?? cabin.seats,
        from: stay.from,
        to: stay.to,
        months: monthsBetween(stay.from, stay.to),
      });
      record.totalMonths += monthsBetween(stay.from, stay.to);
      if (!record.lastLeft || new Date(stay.to) > new Date(record.lastLeft)) record.lastLeft = stay.to;
      byName.set(stay.name, record);
    });
  });

  return [...byName.values()]
    .map((client) => ({
      ...client,
      returning: client.kind === "active" && client.stays.length > 0,
      stays: client.stays.sort((a, b) => new Date(b.to).getTime() - new Date(a.to).getTime()),
    }))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "active" ? -1 : 1;
      if (a.kind === "active") return b.monthlyRent - a.monthlyRent;
      return new Date(b.lastLeft || 0).getTime() - new Date(a.lastLeft || 0).getTime();
    });
};

/* ----------------------------------------------------------------- CSV -- */

const CSV_NEWLINE = "\r\n";
export const csvEscape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
export const toCsv = (rows: unknown[][]) => rows.map((row) => row.map(csvEscape).join(",")).join(CSV_NEWLINE);
