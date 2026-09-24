import { useEffect, useReducer, useRef, useState } from "react";
import api from "../../../services/api";
import { CABIN_SEATS } from "./cabinData";

export const fetchBoardState = async () => (await api.get("/coworking/board")).data;

/*
 * Why the board is not on the server, in words that say what to do about it.
 *
 * This matters more than a usual error string. A board that cannot save keeps
 * working perfectly against localStorage, so the failure has no symptom until
 * somebody opens the CRM on another machine and finds their clients missing.
 * A permission problem in particular reads as "it works, but only here", which
 * is indistinguishable from the bug this whole sync was built to fix - so it is
 * named rather than folded into a generic failure.
 */
export const describeSyncFailure = (error, verb) => {
  const status = error?.response?.status;
  if (status === 403) {
    return `This board could not be ${verb} to the server: your account is not allowed to save coworking changes. Ask an admin for edit access on the Booking Board — until then anything you do here stays on this device only.`;
  }
  if (status === 409) {
    return "Someone else changed this board. Reload to see their changes before booking again.";
  }
  if (status === 401) {
    return "Your session has expired, so this board is not being saved. Sign in again.";
  }
  return `This board could not be ${verb} to the server${
    error?.response?.data?.message ? `: ${error.response.data.message}` : ""
  }. Changes are held on this device only.`;
};

export const pushBoardState = async (board, version) =>
  (await api.put("/coworking/board", {
    state: { cabins: board.cabins, activity: (board.activity || []).slice(0, 200) },
    version,
  })).data;

/*
 * The board's single source of truth.
 *
 * Every action on the screen goes through this reducer, so the floor is never
 * changed in two places and any action can be undone by keeping the previous
 * cabin list. State persists to localStorage, which is what makes the board
 * behave like a system rather than a demo: onboard a client, reload, they are
 * still in the cabin.
 *
 * This is deliberately the shape a server would return. When the API is wired
 * up, `loadBoard` becomes a fetch and each case here becomes one endpoint - the
 * action names below are the endpoint list.
 *
 * NOTE: the existing backend models occupancy per seat (a seat ledger on the
 * cabin, with cabin status derived from it). This board is cabin-level: a cabin
 * is let whole and has a capacity. That difference has to be settled before
 * wiring, or the two will disagree about what "booked" means.
 */

const STORAGE_KEY = "oor.coworking.board.v3";
const LEGACY_DEMO_STORAGE_KEY = "oor.coworking.board.v1";
const RETIRED_DEMO_STORAGE_KEY = "oor.coworking.board.v2";
const DAY = 24 * 60 * 60 * 1000;
const UNDO_DEPTH = 15;

// Physical cabin inventory is part of the coworking layout, not demo data.
// Keep it visible without inventing tenant names, agreements, rents, or dues.
const emptyInventory = () =>
  Object.entries(CABIN_SEATS).map(([code, seats]) => ({
    code,
    label: `${code[0]}-${code.slice(1)}`,
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

const daysBetween = (from, to) => Math.round((new Date(to) - new Date(from)) / DAY);
const addMonths = (iso, months) => {
  const date = new Date(iso);
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
};
const addDays = (iso, days) => new Date(new Date(iso).getTime() + days * DAY).toISOString();

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
const slug = (name) => String(name).toLowerCase().replace(/[^a-z]+/g, "");

/*
 * Day-counts are derived, never stored. Storing them means a board restored
 * from localStorage tomorrow still claims "40 days left" today's answer.
 * Runs on load and after every action - outside render, so the clock is safe
 * to read here.
 */
export const decorate = (cabins) => {
  const now = new Date().toISOString();
  return cabins.map((cabin) => ({
    ...cabin,
    vacantDays: cabin.vacantSince ? Math.max(0, daysBetween(cabin.vacantSince, now)) : 0,
    contract: cabin.contract
      ? { ...cabin.contract, endsInDays: daysBetween(now, cabin.contract.endDate) }
      : null,
  }));
};

const entry = (kind, title, detail, cabinCodes = []) => ({
  id: uid("act"),
  at: new Date().toISOString(),
  kind,
  title,
  detail,
  cabinCodes,
});

/** Move the sitting client into the cabin's history. */
const archiveClient = (cabin) => {
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

const vacate = (cabin, extra = {}) => ({
  ...cabin,
  status: "VACANT",
  client: null,
  contract: null,
  holdExpiresAt: null,
  unavailableReason: "",
  vacantSince: new Date().toISOString(),
  ...extra,
});

const patch = (cabins, codes, update) =>
  cabins.map((cabin) => (codes.includes(cabin.code) ? { ...cabin, ...update(cabin) } : cabin));

/*
 * Rent for a multi-cabin agreement is apportioned by each cabin's list rent, so
 * a negotiated total still shows a sensible per-cabin figure on the board and
 * the parts always add back up to the agreed total.
 */
const shareOf = (cabin, selected, total) => {
  const list = selected.reduce((sum, item) => sum + item.monthlyRent, 0);
  if (!list) return 0;
  return Math.round((cabin.monthlyRent / list) * total);
};

export const boardReducer = (state, action) => {
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
          client: { ...client, id: client.id || slug(client.name), since: startDate },
          contract: {
            id: agreementId,
            startDate,
            endDate,
            monthlyRent: rent,
            deposit: Math.round(rent * (terms.depositMonths ?? 2)),
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
      return {
        cabins: patch(cabins, [action.cabinCode], () => ({
          status: "BOOKED",
          holdExpiresAt: null,
          contract: { ...cabin.contract, startDate: now, endDate: addMonths(now, 12) },
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
          entry("release", `Hold dropped on ${action.cabinCode}`, `${cabin.client?.name} did not proceed`, [action.cabinCode]),
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
          entry("release", `${action.cabinCode} released`, `${cabin.client?.name} moved out`, [action.cabinCode]),
          ...activity,
        ],
      };
    }

    case "RENEW": {
      const cabin = cabins.find((item) => item.code === action.cabinCode);
      const from = new Date(cabin.contract.endDate) > new Date(now) ? cabin.contract.endDate : now;
      return {
        cabins: patch(cabins, [action.cabinCode], (item) => ({
          contract: { ...item.contract, endDate: addMonths(from, action.months) },
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
      let next = patch(cabins, [action.toCode], () => ({
        status: from.status,
        vacantSince: null,
        client: from.client,
        // The room changes, the agreement does not - same id, same dates. Rent
        // moves to the new cabin's list rate, which is the thing that differs.
        contract: { ...from.contract, monthlyRent: to.monthlyRent, deposit: to.deposit },
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
        activity: [
          entry("block", `${cabinCode} marked ${status.toLowerCase()}`, reason, [cabinCode]),
          ...activity,
        ],
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
      const amount = cabin.contract.duesAmount || cabin.contract.nextInvoiceAmount;
      return {
        cabins: patch(cabins, [action.cabinCode], (item) => ({
          contract: {
            ...item.contract,
            duesAmount: 0,
            nextInvoiceDate: addMonths(item.contract.nextInvoiceDate, 1),
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
     * they hold - so a chased-up Aadhaar has to land on all of them or the
     * same tenant reads as compliant in one cabin and not in another.
     */
    case "SET_CLIENT_DOCUMENTS": {
      const held = cabins.filter((cabin) => cabin.client?.id === action.clientId);
      const formerCabins = cabins.filter((cabin) => cabin.previousClients.some((stay) =>
        String(stay.clientId || stay.client?.id || slug(stay.name)) === String(action.clientId)));
      if (!held.length && !formerCabins.length) return state;
      const previousDocuments = held[0]?.client?.documents
        || formerCabins[0]?.previousClients.find((stay) =>
          String(stay.clientId || stay.client?.id || slug(stay.name)) === String(action.clientId))?.client?.documents
        || [];
      const clientName = held[0]?.client?.name
        || formerCabins[0]?.previousClients.find((stay) =>
          String(stay.clientId || stay.client?.id || slug(stay.name)) === String(action.clientId))?.name
        || "Former client";
      const affectedCabins = [...new Set([...held, ...formerCabins].map((cabin) => cabin.code))];
      const added = action.documents.length - previousDocuments.length;
      return {
        cabins: cabins.map((cabin) => ({
          ...cabin,
          client: cabin.client?.id === action.clientId
            ? { ...cabin.client, documents: action.documents, dateOfBirth: cabin.client.dateOfBirth || action.documents.find(doc => doc.extractedDateOfBirth)?.extractedDateOfBirth || "" }
            : cabin.client,
          previousClients: cabin.previousClients.map((stay) =>
            String(stay.clientId || stay.client?.id || slug(stay.name)) === String(action.clientId)
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
      if (!held.length) return state;
      const changes = action.client || {};
      const terms = action.terms || {};
      const startDate = new Date(terms.startDate || held[0].contract.startDate).toISOString();
      const endDate = addMonths(startDate, Number(terms.termMonths) || 12);
      const totalRent = Number(terms.rent);
      return {
        cabins: cabins.map((cabin) =>
          cabin.client?.id === action.clientId
            ? {
                ...cabin,
                client: { ...cabin.client, ...changes, id: cabin.client.id },
                contract: {
                  ...cabin.contract,
                  startDate,
                  endDate,
                  monthlyRent: Number.isFinite(totalRent) ? shareOf(cabin, held, totalRent) : cabin.contract.monthlyRent,
                  deposit: Number.isFinite(totalRent)
                    ? Math.round(shareOf(cabin, held, totalRent) * (Number(terms.depositMonths) || 2))
                    : cabin.contract.deposit,
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
            `${changes.name || held[0].client.name} updated`,
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

/*
 * Holds are the one thing that changes without anybody clicking. A hold whose
 * expiry has passed is not a held cabin, so it is swept on load rather than
 * sitting on the board misreporting the floor.
 */
const expireHolds = (state) => {
  const now = Date.now();
  const stale = state.cabins.filter(
    (cabin) => cabin.status === "RESERVED" && cabin.holdExpiresAt && new Date(cabin.holdExpiresAt) < now,
  );
  if (!stale.length) return state;
  return {
    cabins: state.cabins.map((cabin) =>
      stale.includes(cabin) ? vacate(cabin) : cabin,
    ),
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

export const loadBoard = () => {
  let base = { cabins: emptyInventory(), activity: [] };
  try {
    window.localStorage.removeItem(LEGACY_DEMO_STORAGE_KEY);
    window.localStorage.removeItem(RETIRED_DEMO_STORAGE_KEY);
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed?.cabins) && parsed.cabins.length) base = parsed;
    }
  } catch {
    // Private mode or cleared storage: the board starts empty until real
    // coworking inventory is connected.
  }
  const swept = expireHolds(base);
  return { cabins: decorate(swept.cabins), activity: swept.activity, undoStack: [] };
};

export const saveBoard = (state) => {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ cabins: state.cabins, activity: state.activity.slice(0, 200) }),
    );
  } catch {
    // Nothing to do: the board still works for this session.
  }
};

export const resetBoard = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return { cabins: decorate(emptyInventory()), activity: [], undoStack: [] };
};

/** Reducer wrapper that keeps an undo stack and re-derives the day counts. */
export const boardWithHistory = (state, action) => {
  /*
   * Hydration from the server. It replaces the floor outright and clears the
   * undo stack, because undoing back past someone else's saved state would push
   * this tab's idea of the floor over theirs.
   */
  if (action.type === "REPLACE_ALL") {
    const swept = expireHolds({
      cabins: Array.isArray(action.state?.cabins) ? action.state.cabins : [],
      activity: Array.isArray(action.state?.activity) ? action.state.activity : [],
    });
    return { cabins: decorate(swept.cabins), activity: swept.activity, undoStack: [] };
  }
  if (action.type === "UNDO") {
    if (!state.undoStack.length) return state;
    const [previous, ...rest] = state.undoStack;
    return { cabins: decorate(previous.cabins), activity: previous.activity, undoStack: rest };
  }
  if (action.type === "RESET") return resetBoard();

  const next = boardReducer({ cabins: state.cabins, activity: state.activity }, action);
  if (next.cabins === state.cabins && next.activity === state.activity) return state;

  return {
    cabins: decorate(next.cabins),
    activity: next.activity,
    undoStack: [{ cabins: state.cabins, activity: state.activity }, ...state.undoStack].slice(0, UNDO_DEPTH),
  };
};

/** One board, shared by every screen that reads or changes the floor. */
/*
 * The board is company data, not browser data.
 *
 * It used to live only in localStorage, so every machine held a different floor
 * and an admin could see none of them. It now loads from the server and saves
 * back there, with localStorage kept as an offline cache so the board still
 * opens if the request fails.
 *
 * Saves carry the version they were built on. If someone else booked a cabin
 * meanwhile the server refuses the write, and `syncError` says so rather than
 * letting this tab silently overwrite their work.
 */
export const useBoard = () => {
  const [board, dispatch] = useReducer(boardWithHistory, undefined, loadBoard);
  const [sync, setSync] = useState({ loading: true, version: 0, error: "", savedAt: null });
  // Skips the save that would otherwise fire for the server's own payload.
  const hydrating = useRef(true);
  const versionRef = useRef(0);

  useEffect(() => {
    let active = true;
    fetchBoardState()
      .then(({ state, version }) => {
        if (!active) return;
        versionRef.current = version;
        if (Array.isArray(state?.cabins) && state.cabins.length) {
          hydrating.current = true;
          dispatch({ type: "REPLACE_ALL", state });
        }
        setSync({ loading: false, version, error: "", savedAt: null });
      })
      .catch((error) => {
        if (!active) return;
        setSync({ loading: false, version: 0, error: describeSyncFailure(error, "loaded"), savedAt: null });
      })
      .finally(() => {
        // Whatever happened, later changes are the user's and must be saved.
        window.setTimeout(() => { hydrating.current = false; }, 0);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    // The local cache is written every time regardless, so a failed save still
    // leaves the work recoverable on this machine.
    saveBoard(board);
    if (hydrating.current || sync.loading) return undefined;

    const timer = window.setTimeout(() => {
      pushBoardState(board, versionRef.current)
        .then(({ version }) => {
          versionRef.current = version;
          setSync((current) => ({ ...current, version, error: "", savedAt: new Date() }));
        })
        .catch((error) => {
          setSync((current) => ({ ...current, error: describeSyncFailure(error, "saved") }));
        });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [board, sync.loading]);

  return [board, dispatch, sync];
};

const monthsBetween = (from, to) => Math.max(1, Math.round((new Date(to) - new Date(from)) / DAY / 30));

/** Clients, derived from the cabins they hold. There is no separate list. */
export const clientsFrom = (cabins) => {
  const byId = new Map();
  cabins
    .filter((cabin) => cabin.client && (cabin.status === "BOOKED" || cabin.status === "RESERVED"))
    .forEach((cabin) => {
      const existing = byId.get(cabin.client.id) || {
        ...cabin.client,
        /*
         * The client's own kind is individual-or-company; the directory's kind
         * is active-or-former. Two different questions, and the directory spread
         * would otherwise overwrite the first with the second - which quietly
         * measures every individual against the company document set.
         */
        entityKind: cabin.client.kind || "company",
        documents: cabin.client.documents || [],
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
      if (!existing.earliestEnd || new Date(cabin.contract.endDate) < new Date(existing.earliestEnd)) {
        existing.earliestEnd = cabin.contract.endDate;
      }
      byId.set(cabin.client.id, existing);
    });
  return [...byId.values()].sort((a, b) => b.monthlyRent - a.monthlyRent);
};

/*
 * The client directory: everyone who has ever held a cabin on this floor.
 *
 * Both halves are derived from the cabins - current tenants from the cabins
 * they sit in, former ones from the history each cabin keeps. There is no
 * separate client table to fall out of step with the board.
 *
 * A name that appears in both is one record, not two. A tenant who left C-7
 * and later took A-3 is a returning client, and that is worth seeing on their
 * profile rather than filing them twice under opposite headings.
 */
export const directoryFrom = (cabins) => {
  const active = clientsFrom(cabins);
  const byName = new Map(active.map((client) => [client.name, { ...client, kind: "active", stays: [], totalMonths: 0, lastLeft: null }]));

  cabins.forEach((cabin) => {
    cabin.previousClients.forEach((stay) => {
      const snapshot = stay.client || {};
      const record = byName.get(stay.name) || {
        ...snapshot,
        id: stay.clientId || snapshot.id || slug(stay.name),
        name: stay.name,
        kind: "former",
        entityKind: snapshot.kind || "company",
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
      // Active plus a history means they left and came back.
      returning: client.kind === "active" && client.stays.length > 0,
      stays: client.stays.sort((a, b) => new Date(b.to) - new Date(a.to)),
    }))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "active" ? -1 : 1;
      if (a.kind === "active") return b.monthlyRent - a.monthlyRent;
      return new Date(b.lastLeft) - new Date(a.lastLeft);
    });
};
