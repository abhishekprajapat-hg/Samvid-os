import api from "./api";

/*
 * The company's money, from the shared ledger.
 *
 * `/api/finance` reads the same invoices, payments and expenses the coworking
 * billing screens write - see backend/src/services/finance.service.js. There is
 * no second set of books.
 */

export type FinanceSummary = {
  month: string;
  income: number;
  expenses: number;
  net: number;
  collected: number;
  receivables: number;
  receivablesCount: number;
  payables: number;
  payablesCount: number;
  overdue: number;
  overdueCount: number;
};

export type FinanceSeriesPoint = {
  month: string;
  income: number;
  expenses: number;
};

export type FinanceTransaction = {
  id: string;
  kind: "INCOME" | "EXPENSE";
  source: "PAYMENT" | "EXPENSE";
  code: string;
  title: string;
  party: string;
  category: string;
  /** Signed: income is positive, expense negative. */
  amount: number;
  method: string;
  status: "PAID" | "PENDING" | "OVERDUE" | "CANCELLED";
  date: string;
  reference: string;
  invoiceId: string;
  invoiceNumber: string;
  notes: string;
};

export type InvoiceLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type FinanceInvoice = {
  _id: string;
  invoiceNumber: string;
  status: string;
  clientId?: { _id?: string; companyName?: string; contactPerson?: string; email?: string; phone?: string } | null;
  leadId?: { _id?: string; name?: string; phone?: string; email?: string } | null;
  inventoryId?: { _id?: string; title?: string; projectName?: string; area?: string; city?: string } | null;
  contractId?: { _id?: string; contractCode?: string } | null;
  lineItems?: InvoiceLineItem[];
  additionalCharges?: Array<{ label: string; amount: number }>;
  discountAmount?: number;
  subtotal?: number;
  additionalChargesTotal?: number;
  gstRate?: number;
  gstAmount?: number;
  totalAmount: number;
  amountPaid: number;
  dueDate?: string;
  notes?: string;
  createdAt?: string;
};

export type InvoicePayment = {
  _id: string;
  paymentCode: string;
  amount: number;
  method: string;
  type?: string;
  transactionReference?: string;
  paymentDate: string;
  status?: string;
};

const monthParam = (month?: string) => (month ? { month } : {});

export const getFinanceOverview = async (
  params: { month?: string; months?: number } = {},
): Promise<{ summary: FinanceSummary | null; series: FinanceSeriesPoint[] }> => {
  const res = await api.get("/finance/overview", {
    params: { ...monthParam(params.month), ...(params.months ? { months: params.months } : {}) },
  });
  return {
    summary: (res.data?.summary || null) as FinanceSummary | null,
    series: (Array.isArray(res.data?.series) ? res.data.series : []) as FinanceSeriesPoint[],
  };
};

export const getFinanceTransactions = async (
  params: {
    month?: string;
    type?: "ALL" | "INCOME" | "EXPENSE";
    status?: string;
    category?: string;
    method?: string;
    q?: string;
    limit?: number;
  } = {},
): Promise<{
  transactions: FinanceTransaction[];
  totals: { in: number; out: number; net: number };
  count: number;
}> => {
  const res = await api.get("/finance/transactions", { params });
  return {
    transactions: (Array.isArray(res.data?.transactions) ? res.data.transactions : []) as FinanceTransaction[],
    totals: res.data?.totals || { in: 0, out: 0, net: 0 },
    count: Number(res.data?.count || 0),
  };
};

export type FinanceEntryPayload = {
  kind: "INCOME" | "EXPENSE";
  amount: number;
  category: string;
  date: string;
  method: string;
  status?: "PAID" | "PENDING";
  reference?: string;
  title?: string;
  party?: string;
  notes?: string;
  invoiceId?: string;
  leadId?: string;
  inventoryId?: string;
  contactId?: string;
  clientId?: string;
  propertyId?: string;
  receipts?: Array<{ name?: string; fileUrl: string; fileType?: string }>;
};

export const createFinanceEntry = async (payload: FinanceEntryPayload) => {
  const res = await api.post("/finance/entries", payload);
  return { kind: String(res.data?.kind || ""), entry: res.data?.entry || null };
};

export const getFinanceInvoices = async (
  params: Record<string, unknown> = {},
): Promise<FinanceInvoice[]> => {
  const res = await api.get("/finance/invoices", { params });
  return (Array.isArray(res.data?.invoices) ? res.data.invoices : []) as FinanceInvoice[];
};

export const getFinanceInvoice = async (
  invoiceId: string,
): Promise<{ invoice: FinanceInvoice | null; payments: InvoicePayment[] }> => {
  const res = await api.get(`/finance/invoices/${invoiceId}`);
  return {
    invoice: (res.data?.invoice || null) as FinanceInvoice | null,
    payments: (Array.isArray(res.data?.payments) ? res.data.payments : []) as InvoicePayment[],
  };
};
