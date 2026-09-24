export const ADVANCED_FILTER_LABELS = {
  source: "Source", assignedTo: "Assigned to", inventoryType: "Category",
  transactionType: "Transaction", city: "City", project: "Project",
  budgetMin: "Budget from", budgetMax: "Budget to", createdFrom: "Created from",
  createdTo: "Created to", followUpDateFrom: "Follow-up from", followUpDateTo: "Follow-up to",
};
export const readAdvancedFilters = (params) => Object.fromEntries(
  Object.keys(ADVANCED_FILTER_LABELS).map((key) => [key, params.get(key) || ""]),
);
