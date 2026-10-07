import { useEffect, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../services/api";
import {
  boardWithHistory,
  decorate,
  expireHolds,
  initialBoard,
  type BoardAction,
  type BoardState,
  type BoardWithHistory,
} from "./boardReducer";

/*
 * One board, shared by every coworking screen - the mobile counterpart of
 * useBoard() in frontend/src/modules/coworking/booking/boardStore.js.
 *
 * The board is company data. It loads from GET /coworking/board and saves back
 * with PUT, carrying the version it was built on; if someone booked a cabin on
 * the desktop meanwhile the server refuses the write and `sync.error` says so,
 * rather than this phone silently overwriting their work. AsyncStorage is kept
 * as an offline cache, as web keeps localStorage.
 *
 * Web gives each page its own copy of the hook. Here the board and the client
 * screens sit on one navigation stack, so a single module-level store is shared
 * between them - otherwise documents added on the client profile would be
 * missing from the board underneath it, and its next save would be refused.
 */

const STORAGE_KEY = "oor.coworking.board.v3";
const SAVE_DELAY_MS = 600;

export type BoardSync = {
  loading: boolean;
  version: number;
  error: string;
  savedAt: Date | null;
  saving: boolean;
};

type Snapshot = { board: BoardWithHistory; sync: BoardSync };

let snapshot: Snapshot = {
  board: initialBoard(),
  sync: { loading: true, version: 0, error: "", savedAt: null, saving: false },
};
const listeners = new Set<() => void>();
let started = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let pushAgain = false;
/* Local changes the server has not accepted yet. */
let dirty = false;

const emit = (next: Partial<Snapshot>) => {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
};

const setSync = (patch: Partial<BoardSync>) => emit({ sync: { ...snapshot.sync, ...patch } });

/* Why the board is not on the server, in words that say what to do about it. */
export const describeSyncFailure = (error: any, verb: string) => {
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

const writeCache = (board: BoardState) => {
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ cabins: board.cabins, activity: board.activity.slice(0, 200) }),
  ).catch(() => {});
};

const readCache = async (): Promise<BoardState | null> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.cabins) && parsed.cabins.length ? parsed : null;
  } catch {
    return null;
  }
};

export const fetchBoardState = async () => {
  const res = await api.get("/coworking/board");
  return res.data as { state?: BoardState; version?: number; updatedAt?: string; updatedByName?: string };
};

const pushBoardState = async (board: BoardState, version: number) => {
  const res = await api.put("/coworking/board", {
    state: { cabins: board.cabins, activity: (board.activity || []).slice(0, 200) },
    version,
  });
  return res.data as { version: number };
};

/* Saves are serialised: a second save waits for the first so it carries the
   version the first one produced, instead of racing it into a 409. */
const flush = async () => {
  if (inFlight) {
    pushAgain = true;
    return;
  }
  inFlight = true;
  setSync({ saving: true });
  try {
    const { version } = await pushBoardState(snapshot.board, snapshot.sync.version);
    dirty = false;
    setSync({ version, error: "", savedAt: new Date() });
  } catch (error) {
    setSync({ error: describeSyncFailure(error, "saved") });
  } finally {
    inFlight = false;
    setSync({ saving: false });
    if (pushAgain) {
      pushAgain = false;
      void flush();
    }
  }
};

const scheduleSave = () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void flush();
  }, SAVE_DELAY_MS);
};

const hydrate = (state: Partial<BoardState>) =>
  emit({ board: boardWithHistory(snapshot.board, { type: "REPLACE_ALL", state }) });

/** Loads the company's board, replacing whatever this device holds. */
export const reloadBoard = async () => {
  setSync({ loading: true });
  try {
    const { state, version } = await fetchBoardState();
    if (Array.isArray(state?.cabins) && state.cabins.length) hydrate(state);
    dirty = false;
    setSync({ loading: false, version: Number(version || 0), error: "" });
  } catch (error) {
    setSync({ loading: false, error: describeSyncFailure(error, "loaded") });
  }
};

/*
 * Picks up a desk change when a coworking screen comes back into view. Skipped
 * while this device has unsaved work, which the next save would otherwise lose.
 */
export const refreshBoardIfIdle = async () => {
  if (dirty || inFlight || saveTimer) return;
  try {
    const { state, version } = await fetchBoardState();
    if (Number(version || 0) === snapshot.sync.version) return;
    if (dirty || inFlight || saveTimer) return;
    if (Array.isArray(state?.cabins) && state.cabins.length) hydrate(state);
    setSync({ version: Number(version || 0), error: "" });
  } catch {
    // The board still works from what it has.
  }
};

const start = async () => {
  if (started) return;
  started = true;
  const cached = await readCache();
  if (cached) {
    const swept = expireHolds(cached);
    emit({ board: { cabins: decorate(swept.cabins), activity: swept.activity, undoStack: [] } });
  }
  await reloadBoard();
};

export const dispatchBoard = (action: BoardAction) => {
  const next = boardWithHistory(snapshot.board, action);
  if (next === snapshot.board) return;
  emit({ board: next });
  // The local cache is written every time, so a failed save is still
  // recoverable on this device.
  writeCache(next);
  if (snapshot.sync.loading) return;
  dirty = true;
  scheduleSave();
};

/** Restores a whole board - the Restore action - and saves it as a change. */
export const replaceBoard = (state: BoardState) => {
  const swept = expireHolds({
    cabins: Array.isArray(state.cabins) ? state.cabins : [],
    activity: Array.isArray(state.activity) ? state.activity : [],
  });
  const next: BoardWithHistory = {
    cabins: decorate(swept.cabins),
    activity: swept.activity,
    undoStack: [{ cabins: snapshot.board.cabins, activity: snapshot.board.activity }, ...snapshot.board.undoStack].slice(0, 15),
  };
  emit({ board: next });
  writeCache(next);
  dirty = true;
  scheduleSave();
};

export const getBoardSnapshot = () => snapshot;

/* Drops the in-memory board when the session ends, so a second person signing
   in on the same phone never sees the first one's floor before their own loads. */
export const resetBoardStore = () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  started = false;
  dirty = false;
  snapshot = {
    board: initialBoard(),
    sync: { loading: true, version: 0, error: "", savedAt: null, saving: false },
  };
  AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useBoard = (): [BoardWithHistory, typeof dispatchBoard, BoardSync] => {
  const current = useSyncExternalStore(subscribe, getBoardSnapshot, getBoardSnapshot);
  useEffect(() => {
    void start();
  }, []);
  return [current.board, dispatchBoard, current.sync];
};
