import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { getAllLeads } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";
import ToastNotice from "../../components/ui/ToastNotice";

const COMMISSION_PER_DEAL = 50000;
const DEFAULT_BROKERAGE_PERCENTAGE = 2;
const DEFAULT_BROKERAGE_CONFIG = Object.freeze({
  mode: "FLAT",
  value: COMMISSION_PER_DEAL,
  notes: "",
});

const RANGE_OPTIONS = [
  { key: "TODAY", label: "Today" },
  { key: "30D", label: "Last 30 Days" },
  { key: "THIS_MONTH", label: "This Month" },
  { key: "CUSTOM", label: "Custom" },
  { key: "ALL", label: "All Time" },
];

const PIPELINE_STATUSES = [
  { key: "NEW", label: "New" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "INTERESTED", label: "Interested" },
  { key: "SITE_VISIT", label: "Site Visit" },
  { key: "REQUESTED", label: "Requested" },
  { key: "CLOSED", label: "Closed" },
  { key: "LOST", label: "Lost" },
];
const LEAD_STATUS_SET = new Set(["ALL", ...PIPELINE_STATUSES.map((status) => status.key)]);
const EXECUTIVE_ROLE_SET = new Set(["EXECUTIVE", "FIELD_EXECUTIVE"]);

const parseLocalDateInput = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const toDate = (value) => {
  const localDate = parseLocalDateInput(value);
  if (localDate) return localDate;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toDateInputValue = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDayStart = (value) => {
  const date = toDate(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const getDayEnd = (value) => {
  const date = toDate(value);
  if (!date) return null;
  date.setHours(23, 59, 59, 999);
  return date;
};

const resolveRangeBounds = ({ rangeKey, customRange }) => {
  const now = new Date();

  if (rangeKey === "TODAY") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (rangeKey === "30D") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (rangeKey === "THIS_MONTH") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end,
    };
  }

  if (rangeKey === "CUSTOM") {
    return {
      start: getDayStart(customRange.startDate),
      end: getDayEnd(customRange.endDate),
    };
  }

  return { start: null, end: null };
};

const getLeadRangeDate = (lead) => {
  const status = String(lead?.status || "").toUpperCase();
  if (status === "CLOSED" || status === "LOST") {
    return toDate(lead?.updatedAt || lead?.createdAt);
  }
  return toDate(lead?.createdAt);
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatCurrencyCompact = (value) => {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 100000) {
    const lakhs = amount / 100000;
    return `₹${lakhs.toFixed(lakhs >= 10 ? 1 : 2).replace(/\.0+$/, "")} L`;
  }
  return formatCurrency(amount);
};

const formatDecimal = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const toObjectIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
};

const toAmountNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getRecordedBrokerageReceived = (lead = {}) => {
  const amount = toAmountNumber(lead?.brokerageReceived);
  return amount === null ? 0 : Math.max(0, amount);
};

const getRecordedBrokerageDistributed = (lead = {}) => {
  const amount = toAmountNumber(lead?.brokerageDistributed);
  return amount === null ? 0 : Math.max(0, amount);
};

const normalizeBrokerageConfig = (config = null) => {
  const mode = String(config?.mode || "").trim().toUpperCase() === "PERCENTAGE"
    ? "PERCENTAGE"
    : DEFAULT_BROKERAGE_CONFIG.mode;
  const fallbackValue = mode === "PERCENTAGE"
    ? DEFAULT_BROKERAGE_PERCENTAGE
    : DEFAULT_BROKERAGE_CONFIG.value;
  const parsedValue = toAmountNumber(config?.value);

  return {
    mode,
    value: parsedValue === null
      ? fallbackValue
      : Math.max(0, mode === "PERCENTAGE" ? Math.min(parsedValue, 100) : parsedValue),
    notes: String(config?.notes || "").trim(),
  };
};

const formatBrokerageRule = (config = null) => {
  const normalized = normalizeBrokerageConfig(config);
  return normalized.mode === "PERCENTAGE"
    ? `${formatDecimal(normalized.value)}% of sell value`
    : `${formatCurrency(normalized.value)} per closed deal`;
};

const getLeadBroker = (lead = {}) => {
  const creatorRole = String(lead?.createdBy?.role || "").trim().toUpperCase();
  return creatorRole === "CHANNEL_PARTNER" ? lead.createdBy : null;
};

const getLeadBrokerLabel = (lead = {}) => {
  const broker = getLeadBroker(lead);
  if (!broker) {
    return {
      name: "Direct",
      detail: "No broker mapped",
    };
  }

  return {
    name: broker.name || "Channel Partner",
    detail: broker.partnerCode || formatBrokerageRule(broker.brokerageConfig),
  };
};

const getBrokerageAmountsForSaleEntry = (entry, brokerageConfig) => {
  const totalAmount = Number(entry?.totalAmount || 0);
  const pendingAmount = Math.max(0, Number(entry?.remainingAmount || 0));
  const collectedAmount = Math.max(0, totalAmount - pendingAmount);
  const config = normalizeBrokerageConfig(brokerageConfig);

  if (config.mode === "PERCENTAGE") {
    const totalBrokerage = (totalAmount * config.value) / 100;
    const realizedBrokerage = (collectedAmount * config.value) / 100;
    return {
      collectedAmount,
      totalBrokerage,
      realizedBrokerage,
      pendingBrokerage: Math.max(0, totalBrokerage - realizedBrokerage),
    };
  }

  const collectionRatio = totalAmount > 0 ? Math.min(1, collectedAmount / totalAmount) : 0;
  const totalBrokerage = config.value;
  const realizedBrokerage = totalBrokerage * collectionRatio;
  return {
    collectedAmount,
    totalBrokerage,
    realizedBrokerage,
    pendingBrokerage: Math.max(0, totalBrokerage - realizedBrokerage),
  };
};

const getLeadRelatedInventories = (lead = {}) => {
  const merged = [];
  const seen = new Set();
  const pushUnique = (value) => {
    const id = toObjectIdString(value);
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push(value);
  };

  pushUnique(lead?.inventoryId);
  if (Array.isArray(lead?.relatedInventoryIds)) {
    lead.relatedInventoryIds.forEach((row) => pushUnique(row));
  }

  return merged;
};

const getLeadSaleEntries = (lead = {}) => {
  const leadId = toObjectIdString(lead?._id) || "lead";
  const leadStatus = String(lead?.status || "").trim().toUpperCase();
  const isClosedContext = ["CLOSED", "REQUESTED"].includes(leadStatus);
  const linkedInventories = getLeadRelatedInventories(lead);
  const saleEntries = [];

  linkedInventories.forEach((inventory, index) => {
    if (!inventory || typeof inventory !== "object") return;

    const saleTotalAmount = toAmountNumber(inventory?.saleDetails?.totalAmount);
    const inventoryPrice = toAmountNumber(inventory?.price);
    const totalAmount =
      saleTotalAmount !== null && saleTotalAmount > 0
        ? saleTotalAmount
        : inventoryPrice;

    if (totalAmount === null || totalAmount <= 0) return;

    const inventoryStatus = String(inventory?.status || "").trim().toUpperCase();
    const hasSaleDetails = saleTotalAmount !== null && saleTotalAmount > 0;
    const isSoldInventory = inventoryStatus === "SOLD" || hasSaleDetails;

    if (!isClosedContext && !isSoldInventory) return;

    const remainingRaw = toAmountNumber(inventory?.saleDetails?.remainingAmount);
    const remainingAmount =
      remainingRaw === null
        ? 0
        : Math.max(0, Math.min(remainingRaw, totalAmount));
    const entryKey = toObjectIdString(inventory) || `${leadId}:${index}`;

    saleEntries.push({
      entryKey,
      totalAmount,
      remainingAmount,
    });
  });

  if (saleEntries.length > 0 || !isClosedContext) return saleEntries;

  const fallbackInventory = linkedInventories.find((inventory) => {
    if (!inventory || typeof inventory !== "object") return false;
    const amount = toAmountNumber(inventory?.price);
    return amount !== null && amount > 0;
  });
  const fallbackTotalAmount = toAmountNumber(fallbackInventory?.price);
  if (fallbackTotalAmount === null || fallbackTotalAmount <= 0) return saleEntries;

  const paymentType = String(lead?.dealPayment?.paymentType || "").trim().toUpperCase();
  const dealRemainingRaw = toAmountNumber(lead?.dealPayment?.remainingAmount);
  const fallbackRemainingAmount =
    paymentType === "PARTIAL" && dealRemainingRaw !== null
      ? Math.max(0, Math.min(dealRemainingRaw, fallbackTotalAmount))
      : 0;

  saleEntries.push({
    entryKey: `${leadId}:fallback`,
    totalAmount: fallbackTotalAmount,
    remainingAmount: fallbackRemainingAmount,
  });

  return saleEntries;
};

const getDealPaymentApproval = (lead = {}) =>
  String(lead?.dealPayment?.approvalStatus || lead?.dealPayment?.status || "")
    .trim()
    .toUpperCase();

const getDealPaymentMode = (lead = {}) =>
  String(lead?.dealPayment?.mode || lead?.dealPayment?.paymentMode || "")
    .trim()
    .toUpperCase();

const hasDealPaymentRecord = (lead = {}) =>
  Boolean(
    getDealPaymentMode(lead)
      || String(lead?.dealPayment?.paymentType || "").trim()
      || getDealPaymentApproval(lead)
      || String(lead?.dealPayment?.paymentReference || "").trim()
      || toAmountNumber(lead?.dealPayment?.remainingAmount) !== null,
  );

const getDealPaymentAmount = (lead = {}) => {
  const explicitAmount = toAmountNumber(lead?.dealPayment?.amount);
  if (explicitAmount !== null) return Math.max(0, explicitAmount);

  const brokerageReceived = getRecordedBrokerageReceived(lead);
  if (brokerageReceived > 0) return brokerageReceived;

  return getLeadSaleEntries(lead).reduce((sum, entry) => {
    const collected = Math.max(0, Number(entry.totalAmount || 0) - Number(entry.remainingAmount || 0));
    return sum + collected;
  }, 0);
};

const getLeadPropertyLabel = (lead = {}) => {
  const inventory = getLeadRelatedInventories(lead)[0] || {};
  const code =
    inventory.propertyId
    || inventory.unitNumber
    || inventory.inventoryId
    || (lead?._id ? `PRP-${String(lead._id).slice(-4).toUpperCase()}` : "-");
  const name =
    inventory.projectName
    || inventory.buildingName
    || inventory.title
    || lead.projectInterested
    || "Property not mapped";

  return { code, name };
};

const getPaymentModeBucket = (mode = "") => {
  const normalized = String(mode || "").trim().toUpperCase();
  if (normalized === "UPI") return "UPI";
  if (normalized === "CASH") return "Cash";
  if (normalized === "CHECK" || normalized === "CHEQUE") return "Cheque";
  if (normalized.includes("NEFT") || normalized.includes("RTGS") || normalized.includes("IMPS") || normalized.includes("NET")) {
    return "NEFT / RTGS";
  }
  return "Other";
};

const getMonthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const FinancialCore = () => {
  const navigate = useNavigate();
  const [leadWorkspaceBasePath, setLeadWorkspaceBasePath] = useState("/leads");
  const [rangeKey] = useState("THIS_MONTH");
  const [customRange] = useState(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 9);
    return {
      startDate: toDateInputValue(start),
      endDate: toDateInputValue(now),
    };
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState([]);
  const [, setLastUpdatedAt] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const role = String(window.localStorage.getItem("role") || "")
      .trim()
      .toUpperCase();
    setLeadWorkspaceBasePath(EXECUTIVE_ROLE_SET.has(role) ? "/my-leads" : "/leads");
  }, []);

  const loadFinanceData = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }

      setError("");
      const rows = await getAllLeads();
      setLeads(Array.isArray(rows) ? rows : []);
      setLastUpdatedAt(new Date());
    } catch (fetchError) {
      setError(toErrorMessage(fetchError, "Failed to load finance data"));
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFinanceData(false);
  }, [loadFinanceData]);

  const scopedLeads = useMemo(() => {
    const { start, end } = resolveRangeBounds({ rangeKey, customRange });
    if (!start && !end) return leads;

    return leads.filter((lead) => {
      const rangeDate = getLeadRangeDate(lead);
      if (!rangeDate) return false;
      if (start && rangeDate < start) return false;
      if (end && rangeDate > end) return false;
      return true;
    });
  }, [customRange, leads, rangeKey]);

  const dashboard = useMemo(() => {
    const statusCount = PIPELINE_STATUSES.reduce((acc, status) => {
      acc[status.key] = 0;
      return acc;
    }, {});

    const sourceCount = { META: 0, MANUAL: 0, OTHER: 0 };
    const activeStatuses = new Set(["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"]);
    const countedSaleKeys = new Set();
    let totalSellAmount = 0;
    let pendingSellCollection = 0;
    let companyBrokerageRevenue = 0;
    let brokerageDistributedTotal = 0;

    scopedLeads.forEach((lead) => {
      const status = String(lead.status || "NEW");
      const source = String(lead.source || "");

      if (Object.prototype.hasOwnProperty.call(statusCount, status)) {
        statusCount[status] += 1;
      }

      if (source === "META") {
        sourceCount.META += 1;
      } else if (source === "MANUAL") {
        sourceCount.MANUAL += 1;
      } else {
        sourceCount.OTHER += 1;
      }

      getLeadSaleEntries(lead).forEach((entry) => {
        if (countedSaleKeys.has(entry.entryKey)) return;
        countedSaleKeys.add(entry.entryKey);
        totalSellAmount += entry.totalAmount;
        pendingSellCollection += entry.remainingAmount;
      });

      if (String(lead.status || "").toUpperCase() === "CLOSED") {
        companyBrokerageRevenue += getRecordedBrokerageReceived(lead);
        brokerageDistributedTotal += getRecordedBrokerageDistributed(lead);
      }
    });

    const totalLeads = scopedLeads.length;
    const closedDeals = statusCount.CLOSED;
    const lostDeals = statusCount.LOST;
    const activePipeline = [...activeStatuses].reduce(
      (sum, status) => sum + (statusCount[status] || 0),
      0,
    );

    const conversionRate = totalLeads > 0 ? Math.round((closedDeals / totalLeads) * 100) : 0;
    const winRate =
      closedDeals + lostDeals > 0
        ? Math.round((closedDeals / (closedDeals + lostDeals)) * 100)
        : 0;

    const collectedSellValue = Math.max(0, totalSellAmount - pendingSellCollection);
    const avgBrokeragePerClosed = closedDeals > 0 ? companyBrokerageRevenue / closedDeals : 0;

    return {
      totalLeads,
      closedDeals,
      lostDeals,
      activePipeline,
      conversionRate,
      winRate,
      totalSellAmount,
      pendingSellCollection,
      collectedSellValue,
      companyBrokerageRevenue,
      brokerageDistributedTotal,
      avgBrokeragePerClosed,
      statusCount,
      sourceCount,
    };
  }, [scopedLeads]);

  const brokerDashboard = useMemo(() => {
    const brokerRows = new Map();
    const countedSaleKeys = new Set();

    scopedLeads.forEach((lead) => {
      const broker = getLeadBroker(lead);
      if (!broker) return;

      const brokerId = toObjectIdString(broker) || String(broker?.partnerCode || broker?.name || "");
      if (!brokerId) return;

      const brokerLeadId = toObjectIdString(lead?._id);
      const brokerSearchToken = String(broker?.partnerCode || broker?.name || "").trim();
      const resolvedConfig = normalizeBrokerageConfig(broker?.brokerageConfig);
      const current =
        brokerRows.get(brokerId)
        || {
          id: brokerId,
          name: broker?.name || "Channel Partner",
          partnerCode: broker?.partnerCode || "",
          searchToken: brokerSearchToken,
          brokerageConfig: resolvedConfig,
          totalLeads: 0,
          closedLeads: 0,
          totalSellValue: 0,
          collectedSellValue: 0,
          pendingCollection: 0,
          brokeragePayable: 0,
          realizedBrokerage: 0,
          pendingBrokerage: 0,
          lastActivityAt: null,
          lastClosureAt: null,
          leadIds: new Set(),
          closedLeadIds: new Set(),
        };

      if (brokerLeadId && !current.leadIds.has(brokerLeadId)) {
        current.leadIds.add(brokerLeadId);
        current.totalLeads += 1;
      }

      const leadStatus = String(lead?.status || "").trim().toUpperCase();
      const activityAt = toDate(lead?.updatedAt || lead?.createdAt);
      if (activityAt && (!current.lastActivityAt || activityAt > current.lastActivityAt)) {
        current.lastActivityAt = activityAt;
      }

      if (leadStatus === "CLOSED" && brokerLeadId && !current.closedLeadIds.has(brokerLeadId)) {
        current.closedLeadIds.add(brokerLeadId);
        current.closedLeads += 1;
        if (activityAt && (!current.lastClosureAt || activityAt > current.lastClosureAt)) {
          current.lastClosureAt = activityAt;
        }
      }

      getLeadSaleEntries(lead).forEach((entry) => {
        if (countedSaleKeys.has(entry.entryKey)) return;
        countedSaleKeys.add(entry.entryKey);

        const brokerage = getBrokerageAmountsForSaleEntry(entry, resolvedConfig);
        current.totalSellValue += entry.totalAmount;
        current.collectedSellValue += brokerage.collectedAmount;
        current.pendingCollection += entry.remainingAmount;
        current.brokeragePayable += brokerage.totalBrokerage;
        current.realizedBrokerage += brokerage.realizedBrokerage;
        current.pendingBrokerage += brokerage.pendingBrokerage;
      });

      brokerRows.set(brokerId, current);
    });

    const rows = [...brokerRows.values()]
      .map((row) => {
        const nextRow = { ...row };
        delete nextRow.leadIds;
        delete nextRow.closedLeadIds;

        return {
          ...nextRow,
          brokerageShare:
            nextRow.totalSellValue > 0
              ? Math.round((nextRow.brokeragePayable / nextRow.totalSellValue) * 1000) / 10
              : 0,
        };
      })
      .sort((left, right) => {
        if (right.brokeragePayable !== left.brokeragePayable) {
          return right.brokeragePayable - left.brokeragePayable;
        }
        if (right.totalSellValue !== left.totalSellValue) {
          return right.totalSellValue - left.totalSellValue;
        }
        if (right.closedLeads !== left.closedLeads) {
          return right.closedLeads - left.closedLeads;
        }
        return String(left.name || "").localeCompare(String(right.name || ""));
      });

    return {
      brokerCount: rows.length,
      brokerLeadCount: rows.reduce((sum, row) => sum + row.totalLeads, 0),
      brokerClosedDeals: rows.reduce((sum, row) => sum + row.closedLeads, 0),
      totalBrokerSellValue: rows.reduce((sum, row) => sum + row.totalSellValue, 0),
      totalBrokerCollectedValue: rows.reduce((sum, row) => sum + row.collectedSellValue, 0),
      totalBrokerPendingCollection: rows.reduce((sum, row) => sum + row.pendingCollection, 0),
      totalBrokeragePayable: rows.reduce((sum, row) => sum + row.brokeragePayable, 0),
      realizedBrokerageTotal: rows.reduce((sum, row) => sum + row.realizedBrokerage, 0),
      pendingBrokerageTotal: rows.reduce((sum, row) => sum + row.pendingBrokerage, 0),
      rows,
    };
  }, [scopedLeads]);

  const openLeadWorkspace = useCallback(
    ({ status = "", query = "", leadId = "" } = {}) => {
      const normalizedStatus = String(status || "").trim().toUpperCase();
      const normalizedQuery = String(query || "").trim();
      const normalizedLeadId = String(leadId || "").trim();
      const searchParams = new URLSearchParams();

      if (normalizedStatus && LEAD_STATUS_SET.has(normalizedStatus)) {
        searchParams.set("status", normalizedStatus);
      }

      if (normalizedQuery) {
        searchParams.set("q", normalizedQuery);
      }

      const targetPath = normalizedLeadId
        ? `${leadWorkspaceBasePath}/${normalizedLeadId}`
        : leadWorkspaceBasePath;
      const search = searchParams.toString();
      navigate(search ? `${targetPath}?${search}` : targetPath);
    },
    [leadWorkspaceBasePath, navigate],
  );

  const currentRole = typeof window === "undefined"
    ? ""
    : String(window.localStorage.getItem("role") || "").trim().toUpperCase();
  const isManagerView = currentRole === "MANAGER";
  const monthLabel = new Date().toLocaleString("en-IN", { month: "short" });
  const pendingPayments = scopedLeads.filter((lead) =>
    hasDealPaymentRecord(lead) && getDealPaymentApproval(lead) === "PENDING",
  );
  const approvedPayments = scopedLeads.filter((lead) =>
    hasDealPaymentRecord(lead) && getDealPaymentApproval(lead) === "APPROVED",
  );
  const rejectedPayments = scopedLeads.filter((lead) =>
    hasDealPaymentRecord(lead) && getDealPaymentApproval(lead) === "REJECTED",
  );
  const billedAmount = isManagerView
    ? dashboard.totalSellAmount
    : brokerDashboard.totalBrokerSellValue;
  const collectedAmount = isManagerView
    ? dashboard.collectedSellValue
    : brokerDashboard.totalBrokerCollectedValue;
  const outstandingAmount = isManagerView
    ? dashboard.pendingSellCollection
    : brokerDashboard.totalBrokerPendingCollection;
  const collectedPercent = billedAmount > 0
    ? Math.round((collectedAmount / billedAmount) * 100)
    : 0;
  const financeStats = [
    {
      key: isManagerView ? `Revenue - ${monthLabel}` : `My earnings - ${monthLabel}`,
      value: isManagerView
        ? formatCurrencyCompact(dashboard.companyBrokerageRevenue)
        : formatCurrencyCompact(brokerDashboard.realizedBrokerageTotal),
      detail: "Current month",
    },
    {
      key: "Collected",
      value: isManagerView
        ? formatCurrencyCompact(dashboard.collectedSellValue)
        : formatCurrencyCompact(brokerDashboard.totalBrokerCollectedValue),
      detail: billedAmount > 0 ? `${collectedPercent}% of billed` : "No billed deals",
    },
    {
      key: "Outstanding",
      value: formatCurrencyCompact(outstandingAmount),
      detail: `${pendingPayments.length} deals pending`,
      alert: true,
    },
    {
      key: "Approvals waiting",
      value: pendingPayments.length,
      detail: "Deal payments",
    },
  ];
  const dealPaymentRows = [
    ...pendingPayments,
    ...approvedPayments,
  ].slice(0, 3);
  const paymentModeMix = useMemo(() => {
    const rows = scopedLeads.filter(hasDealPaymentRecord);
    const totals = new Map([
      ["NEFT / RTGS", 0],
      ["UPI", 0],
      ["Cheque", 0],
      ["Cash", 0],
      ["Other", 0],
    ]);

    rows.forEach((lead) => {
      const bucket = getPaymentModeBucket(getDealPaymentMode(lead));
      totals.set(bucket, (totals.get(bucket) || 0) + Math.max(1, getDealPaymentAmount(lead)));
    });

    const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
    const colors = {
      "NEFT / RTGS": "var(--b500)",
      UPI: "var(--ok500)",
      Cheque: "var(--wa500)",
      Cash: "var(--vi500)",
      Other: "var(--muted)",
    };
    let cursor = 0;
    const rowsWithPercent = [...totals.entries()]
      .filter(([, value]) => value > 0)
      .map(([label, value]) => {
        const percent = total > 0 ? Math.round((value / total) * 100) : 0;
        const start = cursor;
        cursor += percent;
        return { label, percent, color: colors[label], start, end: cursor };
      });

    const gradient = rowsWithPercent.length
      ? `conic-gradient(${rowsWithPercent
        .map((row) => `${row.color} ${row.start}% ${row.end}%`)
        .join(", ")})`
      : "conic-gradient(var(--line) 0 100%)";

    return { rows: rowsWithPercent, gradient };
  }, [scopedLeads]);
  const collectionChart = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) =>
      new Date(now.getFullYear(), now.getMonth() - 5 + index, 1),
    );
    const monthTotals = new Map(months.map((month) => [getMonthKey(month), 0]));

    leads.forEach((lead) => {
      const collectionDate = toDate(lead?.brokerageClosedAt || lead?.updatedAt || lead?.createdAt);
      if (!collectionDate) return;
      const key = getMonthKey(collectionDate);
      if (!monthTotals.has(key)) return;

      const collected = getLeadSaleEntries(lead).reduce(
        (sum, entry) => sum + Math.max(0, Number(entry.totalAmount || 0) - Number(entry.remainingAmount || 0)),
        0,
      );
      monthTotals.set(key, (monthTotals.get(key) || 0) + collected);
    });

    const maxValue = Math.max(...monthTotals.values(), 0);
    const bars = months.map((month) => {
      const value = monthTotals.get(getMonthKey(month)) || 0;
      return {
        label: month.toLocaleString("en-IN", { month: "short" }),
        value,
        height: maxValue > 0 ? Math.max(8, Math.round((value / maxValue) * 100)) : 8,
        isCurrentMonth: getMonthKey(month) === getMonthKey(now),
      };
    });

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return {
      bars,
      hint: `${now.toLocaleString("en-IN", { month: "long" })} is partial - ${now.getDate()} of ${daysInMonth} days.`,
    };
  }, [leads]);

  if (loading) {
    return (
      <div className="ui-page-shell custom-scrollbar flex items-center justify-center text-slate-500 gap-2">
        <RefreshCw size={18} className="animate-spin" />
        Loading finance dashboard...
      </div>
    );
  }

  return (
    <div className="finance-doc-screen ui-page-shell custom-scrollbar">
      <ToastNotice message={error} type="error" />

      <div className="finance-statgrid">
        {financeStats.map((stat) => (
          <button
            key={stat.key}
            type="button"
            onClick={() => openLeadWorkspace({ status: stat.key === "Approvals waiting" ? "REQUESTED" : "CLOSED" })}
            className={`finance-stat ${stat.alert ? "is-alert" : ""}`}
          >
            <div className="finance-k">{stat.key}</div>
            <div className="finance-v">{stat.value}</div>
            <div className="finance-d">{stat.detail}</div>
          </button>
        ))}
      </div>

      <div className="finance-split">
        <div className="finance-card">
          <div className="finance-card-h">
            <h4>Deal payments</h4>
            <div className="finance-seg">
              <button type="button" className="on">Pending <b>{pendingPayments.length}</b></button>
              <button type="button">Approved <b>{approvedPayments.length}</b></button>
              <button type="button">Rejected <b>{rejectedPayments.length}</b></button>
            </div>
          </div>
          <div className="finance-table-wrap">
            <table className="finance-tbl">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Property</th>
                  <th>Amount</th>
                  <th>Mode</th>
                  <th>Approval</th>
                  {isManagerView ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {dealPaymentRows.length === 0 ? (
                  <tr>
                    <td colSpan={isManagerView ? 6 : 5} className="finance-empty-row">
                      No deal payments found for this month.
                    </td>
                  </tr>
                ) : null}
                {dealPaymentRows.map((lead) => {
                  const broker = getLeadBrokerLabel(lead);
                  const property = getLeadPropertyLabel(lead);
                  const amount = getDealPaymentAmount(lead);
                  const remaining = Math.max(0, toAmountNumber(lead?.dealPayment?.remainingAmount) ?? 0);
                  const paymentType = String(lead?.dealPayment?.paymentType || "").toUpperCase();
                  const mode = getPaymentModeBucket(getDealPaymentMode(lead));
                  const approval = getDealPaymentApproval(lead);
                  return (
                    <tr key={lead._id}>
                      <td><b>{lead.name || "Unnamed Lead"}</b><br /><small>{broker.name}</small></td>
                      <td><span className="finance-mono">{property.code}</span><br /><span>{property.name}</span></td>
                      <td className="finance-num"><b>{formatCurrency(amount)}</b><br /><small>{paymentType === "PARTIAL" ? `Partial - ${formatCurrency(remaining)} left` : paymentType || "Payment type not set"}</small></td>
                      <td><span className="finance-pill t-dead">{mode}</span></td>
                      <td><span className={`finance-pill ${approval === "APPROVED" ? "t-won" : "t-warm"}`}><i />{approval === "APPROVED" ? "Approved" : "Pending"}</span></td>
                      {isManagerView ? (
                        <td>
                          {approval === "APPROVED" ? null : (
                            <div className="finance-actions">
                              <button type="button" className="finance-btn finance-btn-pri finance-btn-sm" onClick={() => openLeadWorkspace({ leadId: lead._id })}>Approve</button>
                              <button type="button" className="finance-btn finance-btn-sec finance-btn-sm" onClick={() => openLeadWorkspace({ leadId: lead._id })}>Reject</button>
                            </div>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="finance-side">
          <div className="finance-card">
            <div className="finance-card-h"><h4>Collections - 6 months</h4></div>
            <div className="finance-card-b">
              <div className="finance-bars">
                {collectionChart.bars.map((bar) => (
                  <div key={bar.label} title={formatCurrency(bar.value)}>
                    <i
                      style={{
                        height: `${bar.height}%`,
                        background: bar.isCurrentMonth ? "var(--b300)" : "var(--b500)",
                      }}
                    />
                    <span>{bar.label}</span>
                  </div>
                ))}
              </div>
              <p className="finance-hint">{collectionChart.hint}</p>
            </div>
          </div>

          <div className="finance-card">
            <div className="finance-card-h"><h4>By payment mode</h4></div>
            <div className="finance-card-b finance-payment-mix">
              <div className="finance-donut" style={{ background: paymentModeMix.gradient }} />
              <div className="finance-legend">
                {paymentModeMix.rows.length === 0 ? (
                  <div><i style={{ background: "var(--line)" }} />No payment modes<b>0%</b></div>
                ) : null}
                {paymentModeMix.rows.map((row) => (
                  <div key={row.label}><i style={{ background: row.color }} />{row.label}<b>{row.percent}%</b></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialCore;
