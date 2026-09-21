import api from "./api";

/*
 * The coworking module's API surface: 92 endpoints under /api/coworking.
 *
 * Web splits these across eleven service files. They are grouped in one module
 * here, sectioned by sub-router, because on mobile they are consumed by two
 * screens rather than eleven pages - eleven files with three functions each
 * would be filing for its own sake. Function names still match web's, so a
 * change there is still an obvious diff here.
 *
 * Everything below sits behind checkRoleOrPageAccess(COWORKING_ACCESS_ROLES,
 * "coworking_booking", "coworking_clients") plus a per-route requirePermission,
 * so a caller lacking the permission gets a 403 rather than an empty list. The
 * screens gate on the same permissions first - see CoworkingPermissionGate.
 */

const list = (value: unknown) => (Array.isArray(value) ? value : []);

/* ------------------------------------------------------------- access -- */

export const getMyCoworkingPermissions = async () => {
  const res = await api.get("/coworking/permissions/me");
  return {
    role: String(res.data?.role || ""),
    isAdmin: Boolean(res.data?.isAdmin),
    permissions: list(res.data?.permissions) as string[],
  };
};

/* ---------------------------------------------------------- properties -- */

export type CoworkingProperty = {
  _id?: string;
  name?: string;
  address?: string;
  city?: string;
  isActive?: boolean;
  [key: string]: unknown;
};

export const getProperties = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/coworking/properties", { params });
  return list(res.data?.properties) as CoworkingProperty[];
};

export const getPropertyById = async (propertyId: string) => {
  const res = await api.get(`/coworking/properties/${propertyId}`);
  return (res.data?.property || null) as CoworkingProperty | null;
};

export const createProperty = async (payload: Record<string, unknown>) => {
  const res = await api.post("/coworking/properties", payload);
  return res.data?.property || null;
};

export const updateProperty = async (propertyId: string, payload: Record<string, unknown>) => {
  const res = await api.patch(`/coworking/properties/${propertyId}`, payload);
  return res.data?.property || null;
};

export const deleteProperty = async (propertyId: string) => {
  await api.delete(`/coworking/properties/${propertyId}`);
};

/* -------------------------------------------------------------- floors -- */

export type CoworkingFloor = {
  _id?: string;
  propertyId?: string;
  name?: string;
  level?: number;
  [key: string]: unknown;
};

export const getFloors = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/coworking/floors", { params });
  return list(res.data?.floors) as CoworkingFloor[];
};

export const getFloorById = async (floorId: string) => {
  const res = await api.get(`/coworking/floors/${floorId}`);
  return (res.data?.floor || null) as CoworkingFloor | null;
};

/* --------------------------------------------------------------- board -- */

/*
 * The board is the floor plan's saved layout - the whole thing is read and
 * written as one document, which is why this is a PUT and not a patch.
 */
export const getBoard = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/coworking/board", { params });
  return res.data?.board || res.data || null;
};

export const saveBoard = async (payload: Record<string, unknown>) => {
  const res = await api.put("/coworking/board", payload);
  return res.data?.board || res.data || null;
};

/* -------------------------------------------------------------- cabins -- */

export type CoworkingCabin = {
  _id?: string;
  code?: string;
  name?: string;
  floorId?: string;
  propertyId?: string;
  seats?: number;
  status?: string;
  isBlocked?: boolean;
  blockReason?: string;
  clientId?: { _id?: string; name?: string } | string | null;
  [key: string]: unknown;
};

export const getCabins = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/coworking/cabins", { params });
  return list(res.data?.cabins) as CoworkingCabin[];
};

/** Cabins arranged by floor, which is what the board renders from. */
export const getFloorView = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/coworking/cabins/floor-view", { params });
  return {
    floors: list(res.data?.floors),
    cabins: list(res.data?.cabins) as CoworkingCabin[],
    summary: res.data?.summary || {},
  };
};

export const getCabinById = async (cabinId: string) => {
  const res = await api.get(`/coworking/cabins/${cabinId}`);
  return (res.data?.cabin || null) as CoworkingCabin | null;
};

export const createCabin = async (payload: Record<string, unknown>) => {
  const res = await api.post("/coworking/cabins", payload);
  return res.data?.cabin || null;
};

export const updateCabin = async (cabinId: string, payload: Record<string, unknown>) => {
  const res = await api.patch(`/coworking/cabins/${cabinId}`, payload);
  return res.data?.cabin || null;
};

export const deleteCabin = async (cabinId: string) => {
  await api.delete(`/coworking/cabins/${cabinId}`);
};

export const blockCabin = async (cabinId: string, payload: Record<string, unknown> = {}) => {
  const res = await api.post(`/coworking/cabins/${cabinId}/block`, payload);
  return res.data?.cabin || null;
};

export const unblockCabin = async (cabinId: string) => {
  const res = await api.post(`/coworking/cabins/${cabinId}/unblock`);
  return res.data?.cabin || null;
};

/** Seats, for hot-desk style inventory. */
export const getSeats = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/coworking/seats", { params });
  return list(res.data?.seats);
};

/* ------------------------------------------------------------- clients -- */

export type CoworkingClient = {
  _id?: string;
  name?: string;
  companyName?: string;
  phone?: string;
  email?: string;
  status?: string;
  birthday?: string;
  kycStatus?: string;
  [key: string]: unknown;
};

export const getClients = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/coworking/clients", { params });
  return {
    clients: list(res.data?.clients) as CoworkingClient[],
    total: Number(res.data?.total || res.data?.pagination?.totalCount || 0),
  };
};

export const getClientById = async (clientId: string) => {
  const res = await api.get(`/coworking/clients/${clientId}`);
  return (res.data?.client || null) as CoworkingClient | null;
};

/** Which cabins and seats this client currently holds. */
export const getClientAssignments = async (clientId: string) => {
  const res = await api.get(`/coworking/clients/${clientId}/assignments`);
  return list(res.data?.assignments);
};

export const getClientActivity = async (clientId: string) => {
  const res = await api.get(`/coworking/clients/${clientId}/activity`);
  return list(res.data?.activity || res.data?.activities);
};

export const getClientBirthdays = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/coworking/clients/birthdays", { params });
  return list(res.data?.clients) as CoworkingClient[];
};

export const createClient = async (payload: Record<string, unknown>) => {
  const res = await api.post("/coworking/clients", payload);
  return res.data?.client || null;
};

export const updateClient = async (clientId: string, payload: Record<string, unknown>) => {
  const res = await api.patch(`/coworking/clients/${clientId}`, payload);
  return res.data?.client || null;
};

export const deleteClient = async (clientId: string) => {
  await api.delete(`/coworking/clients/${clientId}`);
};

/* ------------------------------------------------------------ bookings -- */

export type CoworkingBooking = {
  _id?: string;
  cabinId?: string;
  clientId?: { _id?: string; name?: string } | string | null;
  startDate?: string;
  endDate?: string;
  status?: string;
  [key: string]: unknown;
};

export const getBookings = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/coworking/bookings", { params });
  return list(res.data?.bookings) as CoworkingBooking[];
};

export const getBookingById = async (bookingId: string) => {
  const res = await api.get(`/coworking/bookings/${bookingId}`);
  return (res.data?.booking || null) as CoworkingBooking | null;
};

export const getAvailableCabins = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/coworking/bookings/available-cabins", { params });
  return list(res.data?.cabins) as CoworkingCabin[];
};

export const getAvailableSeats = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/coworking/bookings/available-seats", { params });
  return list(res.data?.seats);
};

export const getCabinCalendar = async (cabinId: string, params: Record<string, unknown> = {}) => {
  const res = await api.get(`/coworking/bookings/cabins/${cabinId}/calendar`, { params });
  return list(res.data?.entries || res.data?.calendar);
};

export const createBooking = async (payload: Record<string, unknown>) => {
  const res = await api.post("/coworking/bookings", payload);
  return res.data?.booking || null;
};

export const updateBooking = async (bookingId: string, payload: Record<string, unknown>) => {
  const res = await api.patch(`/coworking/bookings/${bookingId}`, payload);
  return res.data?.booking || null;
};

/*
 * A booking moves through confirm → activate → complete, with extend, cancel
 * and no-show as the ways out. Each is its own endpoint because each has its
 * own side effects; none of them is a plain status write.
 */
const bookingAction = (action: string) => async (
  bookingId: string,
  payload: Record<string, unknown> = {},
) => {
  const res = await api.post(`/coworking/bookings/${bookingId}/${action}`, payload);
  return res.data?.booking || null;
};

export const confirmBooking = bookingAction("confirm");
export const activateBooking = bookingAction("activate");
export const completeBooking = bookingAction("complete");
export const extendBooking = bookingAction("extend");
export const cancelBooking = bookingAction("cancel");
export const markBookingNoShow = bookingAction("no-show");

/* ----------------------------------------------------------- contracts -- */

export const getContracts = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/coworking/contracts", { params });
  return list(res.data?.contracts);
};

export const getContractById = async (contractId: string) => {
  const res = await api.get(`/coworking/contracts/${contractId}`);
  return res.data?.contract || null;
};

export const createContract = async (payload: Record<string, unknown>) => {
  const res = await api.post("/coworking/contracts", payload);
  return res.data?.contract || null;
};

export const updateContract = async (contractId: string, payload: Record<string, unknown>) => {
  const res = await api.patch(`/coworking/contracts/${contractId}`, payload);
  return res.data?.contract || null;
};

const contractAction = (action: string) => async (
  contractId: string,
  payload: Record<string, unknown> = {},
) => {
  const res = await api.post(`/coworking/contracts/${contractId}/${action}`, payload);
  return res.data?.contract || null;
};

export const activateContract = contractAction("activate");
export const terminateContract = contractAction("terminate");
export const renewContract = contractAction("renew");

/** KYC and signed paperwork. Upload via uploadService first, then attach. */
export const addContractDocument = async (contractId: string, payload: Record<string, unknown>) => {
  const res = await api.post(`/coworking/contracts/${contractId}/documents`, payload);
  return res.data?.contract || null;
};

export const removeContractDocument = async (contractId: string, documentId: string) => {
  const res = await api.delete(`/coworking/contracts/${contractId}/documents/${documentId}`);
  return res.data?.contract || null;
};

/* ------------------------------------------------------------ invoices -- */

export const getInvoices = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/coworking/invoices", { params });
  return list(res.data?.invoices);
};

export const getInvoiceById = async (invoiceId: string) => {
  const res = await api.get(`/coworking/invoices/${invoiceId}`);
  return res.data?.invoice || null;
};

export const createInvoice = async (payload: Record<string, unknown>) => {
  const res = await api.post("/coworking/invoices", payload);
  return res.data?.invoice || null;
};

export const generateInvoiceForContract = async (payload: Record<string, unknown>) => {
  const res = await api.post("/coworking/invoices/generate-for-contract", payload);
  return res.data?.invoice || null;
};

export const updateInvoice = async (invoiceId: string, payload: Record<string, unknown>) => {
  const res = await api.patch(`/coworking/invoices/${invoiceId}`, payload);
  return res.data?.invoice || null;
};

export const cancelInvoice = async (invoiceId: string, payload: Record<string, unknown> = {}) => {
  const res = await api.post(`/coworking/invoices/${invoiceId}/cancel`, payload);
  return res.data?.invoice || null;
};

/* ------------------------------------------------------------ payments -- */

export const getPayments = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/coworking/payments", { params });
  return list(res.data?.payments);
};

export const recordPayment = async (payload: Record<string, unknown>) => {
  const res = await api.post("/coworking/payments", payload);
  return res.data?.payment || null;
};

export const refundPayment = async (paymentId: string, payload: Record<string, unknown> = {}) => {
  const res = await api.post(`/coworking/payments/${paymentId}/refund`, payload);
  return res.data?.payment || null;
};

/* ------------------------------------------------------------ expenses -- */

export const getExpenses = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/coworking/expenses", { params });
  return list(res.data?.expenses);
};

export const getExpenseById = async (expenseId: string) => {
  const res = await api.get(`/coworking/expenses/${expenseId}`);
  return res.data?.expense || null;
};

export const createExpense = async (payload: Record<string, unknown>) => {
  const res = await api.post("/coworking/expenses", payload);
  return res.data?.expense || null;
};

export const updateExpense = async (expenseId: string, payload: Record<string, unknown>) => {
  const res = await api.patch(`/coworking/expenses/${expenseId}`, payload);
  return res.data?.expense || null;
};

export const deleteExpense = async (expenseId: string) => {
  await api.delete(`/coworking/expenses/${expenseId}`);
};

const expenseAction = (action: string) => async (
  expenseId: string,
  payload: Record<string, unknown> = {},
) => {
  const res = await api.post(`/coworking/expenses/${expenseId}/${action}`, payload);
  return res.data?.expense || null;
};

export const approveExpense = expenseAction("approve");
export const rejectExpense = expenseAction("reject");
export const markExpensePaid = expenseAction("mark-paid");

export const addExpenseReceipt = async (expenseId: string, payload: Record<string, unknown>) => {
  const res = await api.post(`/coworking/expenses/${expenseId}/receipts`, payload);
  return res.data?.expense || null;
};

export const removeExpenseReceipt = async (expenseId: string, receiptId: string) => {
  const res = await api.delete(`/coworking/expenses/${expenseId}/receipts/${receiptId}`);
  return res.data?.expense || null;
};
