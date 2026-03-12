import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Building2, CreditCard, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import {
  assignSubscription,
  createCompany,
  createPlan,
  deleteCompany,
  getCompanyUsage,
  getGlobalAnalytics,
  listCompanies,
  listPlans,
  updateCompany,
  updatePlan,
} from "../../services/saasService";
import { toErrorMessage } from "../../utils/errorMessage";

const BILLING_CYCLES = ["MONTHLY", "YEARLY"];
const SUBSCRIPTION_STATUSES = ["ACTIVE", "TRIAL", "PAST_DUE", "CANCELED"];

const initialCompanyForm = {
  name: "",
  subdomain: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
};

const initialPlanForm = {
  code: "",
  name: "",
  monthlyPrice: "",
  yearlyPrice: "",
};

const initialSubscriptionForm = {
  companyId: "",
  planId: "",
  status: "ACTIVE",
  billingCycle: "MONTHLY",
  seats: "5",
};

const toId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value.id || value._id || "");
};

const toPositiveInt = (value, fallback = 1) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sanitizeRouteSlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);

const resolveRouteHost = () => {
  const envHost = String(import.meta.env.VITE_PUBLIC_ROOT_DOMAIN || "")
    .trim()
    .toLowerCase();
  if (envHost) return envHost;
  if (typeof window === "undefined") return "";
  return String(window.location.host || "").trim().toLowerCase();
};

const buildRouteLabel = ({ company = null, routeHost = "" } = {}) => {
  const explicitRoute = String(company?.dashboardUrl || "").trim();
  if (explicitRoute) return explicitRoute;

  const slug = sanitizeRouteSlug(company?.subdomain);
  if (!slug) return "-";
  if (!routeHost) return `/${slug}/dashboard`;
  return `${routeHost}/${slug}/dashboard`;
};

const numberFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const SuperAdminPanel = ({ theme = "light" }) => {
  const isDark = theme === "dark";
  const routeHost = useMemo(() => resolveRouteHost(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [overview, setOverview] = useState({});
  const [companies, setCompanies] = useState([]);
  const [plans, setPlans] = useState([]);

  const [companyForm, setCompanyForm] = useState(initialCompanyForm);
  const [planForm, setPlanForm] = useState(initialPlanForm);
  const [subscriptionForm, setSubscriptionForm] = useState(initialSubscriptionForm);

  const [creatingCompany, setCreatingCompany] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [assigningSubscription, setAssigningSubscription] = useState(false);
  const [updatingCompanyId, setUpdatingCompanyId] = useState("");
  const [deletingCompanyId, setDeletingCompanyId] = useState("");
  const [updatingPlanId, setUpdatingPlanId] = useState("");

  const [usageCompanyId, setUsageCompanyId] = useState("");
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const companyRoutePreview = useMemo(() => {
    const previewSlug = sanitizeRouteSlug(companyForm.subdomain || companyForm.name);
    if (!previewSlug) return "";
    if (!routeHost) return `/${previewSlug}/dashboard`;
    return `${routeHost}/${previewSlug}/dashboard`;
  }, [companyForm.name, companyForm.subdomain, routeHost]);

  const inputClass = `h-10 w-full rounded-xl border px-3 text-sm outline-none ${
    isDark
      ? "border-slate-700 bg-slate-950 text-slate-200"
      : "border-slate-300 bg-white text-slate-700"
  }`;

  const cardClass = `rounded-2xl border p-4 ${
    isDark ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-white"
  }`;

  const loadData = useCallback(async (background = false) => {
    try {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const [analyticsRes, companiesRes, plansRes] = await Promise.all([
        getGlobalAnalytics(),
        listCompanies({ page: 1, limit: 50 }),
        listPlans(),
      ]);

      const nextCompanies = Array.isArray(companiesRes.companies) ? companiesRes.companies : [];
      const nextPlans = Array.isArray(plansRes) ? plansRes : [];

      setOverview(analyticsRes.overview || {});
      setCompanies(nextCompanies);
      setPlans(nextPlans);

      const defaultCompanyId = toId(nextCompanies[0]);
      const defaultPlanId = toId(nextPlans.find((row) => row.isActive) || nextPlans[0]);

      setUsageCompanyId((prev) => (prev && nextCompanies.some((row) => toId(row) === prev)
        ? prev
        : defaultCompanyId));

      setSubscriptionForm((prev) => {
        const validCompanyId = prev.companyId
          && nextCompanies.some((row) => toId(row) === prev.companyId);
        const validPlanId = prev.planId
          && nextPlans.some((row) => toId(row) === prev.planId);

        return {
          ...prev,
          companyId: validCompanyId ? prev.companyId : defaultCompanyId,
          planId: validPlanId ? prev.planId : defaultPlanId,
        };
      });
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load super admin data"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadUsage = useCallback(async (companyId) => {
    if (!companyId) {
      setUsage(null);
      return;
    }

    try {
      setUsageLoading(true);
      const response = await getCompanyUsage(companyId);
      setUsage(response);
    } catch (err) {
      setUsage(null);
      setError(toErrorMessage(err, "Failed to load usage"));
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  useEffect(() => {
    loadUsage(usageCompanyId);
  }, [loadUsage, usageCompanyId]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 2200);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleCreateCompany = async (event) => {
    event.preventDefault();
    if (!companyForm.name || !companyForm.adminName || !companyForm.adminEmail || !companyForm.adminPassword) {
      setError("Company name, admin name, admin email and admin password are required.");
      return;
    }

    try {
      setCreatingCompany(true);
      setError("");

      const response = await createCompany({
        name: companyForm.name.trim(),
        subdomain: companyForm.subdomain.trim(),
        adminName: companyForm.adminName.trim(),
        adminEmail: companyForm.adminEmail.trim(),
        adminPassword: companyForm.adminPassword,
      });

      const createdCompanyId = toId(response.company);
      const routeLabel = buildRouteLabel({
        company: response.company || null,
        routeHost,
      });
      setCompanyForm(initialCompanyForm);
      setNotice(routeLabel !== "-" ? `Company created. Route: ${routeLabel}` : "Company created.");
      await loadData(true);

      if (createdCompanyId) {
        setUsageCompanyId(createdCompanyId);
        setSubscriptionForm((prev) => ({ ...prev, companyId: createdCompanyId }));
      }
    } catch (err) {
      setError(toErrorMessage(err, "Failed to create company"));
    } finally {
      setCreatingCompany(false);
    }
  };

  const handleCreatePlan = async (event) => {
    event.preventDefault();
    if (!planForm.code || !planForm.name) {
      setError("Plan code and name are required.");
      return;
    }

    try {
      setCreatingPlan(true);
      setError("");

      const response = await createPlan({
        code: planForm.code.trim().toUpperCase(),
        name: planForm.name.trim(),
        pricing: {
          monthly: toNumber(planForm.monthlyPrice),
          yearly: toNumber(planForm.yearlyPrice),
        },
      });

      const createdPlanId = toId(response.plan);
      setPlanForm(initialPlanForm);
      setNotice("Plan created.");
      await loadData(true);

      if (createdPlanId) {
        setSubscriptionForm((prev) => ({ ...prev, planId: createdPlanId }));
      }
    } catch (err) {
      setError(toErrorMessage(err, "Failed to create plan"));
    } finally {
      setCreatingPlan(false);
    }
  };

  const handleAssignSubscription = async (event) => {
    event.preventDefault();
    if (!subscriptionForm.companyId || !subscriptionForm.planId) {
      setError("Company and plan are required.");
      return;
    }

    try {
      setAssigningSubscription(true);
      setError("");

      await assignSubscription({
        companyId: subscriptionForm.companyId,
        planId: subscriptionForm.planId,
        status: subscriptionForm.status,
        billingCycle: subscriptionForm.billingCycle,
        seats: toPositiveInt(subscriptionForm.seats, 1),
      });

      setNotice("Subscription assigned.");
      await loadData(true);
      if (usageCompanyId === subscriptionForm.companyId) {
        await loadUsage(usageCompanyId);
      }
    } catch (err) {
      setError(toErrorMessage(err, "Failed to assign subscription"));
    } finally {
      setAssigningSubscription(false);
    }
  };

  const handleToggleCompanyStatus = async (company) => {
    const companyId = toId(company);
    if (!companyId) return;

    const nextStatus = String(company.status || "").toUpperCase() === "ACTIVE"
      ? "INACTIVE"
      : "ACTIVE";

    try {
      setUpdatingCompanyId(companyId);
      setError("");
      await updateCompany(companyId, { status: nextStatus });
      setNotice(`Company status set to ${nextStatus}.`);
      await loadData(true);
      if (usageCompanyId === companyId) {
        await loadUsage(companyId);
      }
    } catch (err) {
      setError(toErrorMessage(err, "Failed to update company status"));
    } finally {
      setUpdatingCompanyId("");
    }
  };

  const handleDeleteCompany = async (company) => {
    const companyId = toId(company);
    if (!companyId) return;

    const companyName = String(company?.name || "this company").trim() || "this company";
    const confirmed = window.confirm(
      `Delete ${companyName} permanently?\n\nThis will remove users, leads, inventory, subscriptions, and related records.`,
    );
    if (!confirmed) return;

    try {
      setDeletingCompanyId(companyId);
      setError("");

      const response = await deleteCompany(companyId);
      const deletedUsers = Number(response?.summary?.users || 0);
      const deletedLeads = Number(response?.summary?.leads || 0);
      const deletedInventory = Number(response?.summary?.inventory || 0);
      setNotice(
        `Company deleted. Users: ${deletedUsers}, Leads: ${deletedLeads}, Inventory: ${deletedInventory}.`,
      );

      if (usageCompanyId === companyId) {
        setUsageCompanyId("");
        setUsage(null);
      }

      setSubscriptionForm((prev) =>
        prev.companyId === companyId
          ? { ...prev, companyId: "" }
          : prev,
      );

      await loadData(true);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to delete company"));
    } finally {
      setDeletingCompanyId("");
    }
  };

  const handleTogglePlanStatus = async (plan) => {
    const planId = toId(plan);
    if (!planId) return;

    try {
      setUpdatingPlanId(planId);
      setError("");
      await updatePlan(planId, { isActive: !Boolean(plan.isActive) });
      setNotice("Plan status updated.");
      await loadData(true);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to update plan status"));
    } finally {
      setUpdatingPlanId("");
    }
  };

  if (loading) {
    return (
      <div className={`w-full h-full px-4 sm:px-6 md:px-10 pt-6 ${isDark ? "bg-slate-950/40" : "bg-slate-50/70"}`}>
        <div className={cardClass}>Loading super admin workspace...</div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full overflow-y-auto custom-scrollbar px-4 sm:px-6 md:px-10 pt-4 md:pt-6 pb-8 flex flex-col gap-4 ${
      isDark ? "bg-slate-950/40" : "bg-slate-50/70"
    }`}>
      <section className={cardClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className={`text-2xl font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              Super Admin Panel
            </h1>
            <p className={`mt-1 text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Tenant lifecycle, plans, subscriptions, and global analytics.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className={`h-10 rounded-xl border px-4 text-sm font-semibold inline-flex items-center gap-2 ${
              isDark
                ? "border-slate-700 bg-slate-950/70 text-slate-200"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </section>

      {error ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${isDark ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-red-200 bg-red-50 text-red-700"}`}>
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${isDark ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {notice}
        </div>
      ) : null}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <article className={cardClass}>
          <div className="flex items-center justify-between">
            <span className={`text-xs uppercase tracking-[0.14em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Companies</span>
            <Building2 size={16} className={isDark ? "text-slate-300" : "text-slate-600"} />
          </div>
          <p className={`mt-2 text-2xl font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
            {numberFormatter.format(Number(overview.totalCompanies || 0))}
          </p>
        </article>
        <article className={cardClass}>
          <div className="flex items-center justify-between">
            <span className={`text-xs uppercase tracking-[0.14em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Active Users</span>
            <ShieldCheck size={16} className={isDark ? "text-slate-300" : "text-slate-600"} />
          </div>
          <p className={`mt-2 text-2xl font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
            {numberFormatter.format(Number(overview.activeUsers || 0))}
          </p>
        </article>
        <article className={cardClass}>
          <div className="flex items-center justify-between">
            <span className={`text-xs uppercase tracking-[0.14em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Subscriptions</span>
            <CreditCard size={16} className={isDark ? "text-slate-300" : "text-slate-600"} />
          </div>
          <p className={`mt-2 text-2xl font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
            {numberFormatter.format(Number(overview.activeSubscriptions || 0))}
          </p>
        </article>
        <article className={cardClass}>
          <div className="flex items-center justify-between">
            <span className={`text-xs uppercase tracking-[0.14em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>MRR</span>
            <Activity size={16} className={isDark ? "text-slate-300" : "text-slate-600"} />
          </div>
          <p className={`mt-2 text-2xl font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
            {currencyFormatter.format(Number(overview.mrrEstimate || 0))}
          </p>
        </article>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className={cardClass}>
          <div className="mb-3">
            <h2 className={`text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              Companies
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className={isDark ? "text-slate-400" : "text-slate-500"}>
                  <th className="py-2 pr-3 text-left font-semibold">Name</th>
                  <th className="py-2 pr-3 text-left font-semibold">Subdomain</th>
                  <th className="py-2 pr-3 text-left font-semibold">Status</th>
                  <th className="py-2 pr-3 text-left font-semibold">Plan</th>
                  <th className="py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => {
                  const companyId = toId(company);
                  const status = String(company.status || "UNKNOWN").toUpperCase();
                  return (
                    <tr key={companyId} className={`border-t ${isDark ? "border-slate-800" : "border-slate-100"}`}>
                      <td className="py-3 pr-3">
                        <div className={`font-semibold ${isDark ? "text-slate-100" : "text-slate-800"}`}>{company.name}</div>
                      </td>
                      <td className={`py-3 pr-3 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                        {buildRouteLabel({ company, routeHost })}
                      </td>
                      <td className="py-3 pr-3">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          status === "ACTIVE"
                            ? isDark
                              ? "bg-emerald-500/15 text-emerald-200"
                              : "bg-emerald-100 text-emerald-700"
                            : isDark
                              ? "bg-amber-500/15 text-amber-200"
                              : "bg-amber-100 text-amber-700"
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td className={`py-3 pr-3 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                        {company.subscription?.plan?.name || "-"}
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            className={`h-8 rounded-lg border px-3 text-xs ${isDark ? "border-slate-700 text-slate-200" : "border-slate-300 text-slate-700"}`}
                            onClick={() => setUsageCompanyId(companyId)}
                          >
                            Usage
                          </button>
                          <button
                            type="button"
                            className={`h-8 rounded-lg border px-3 text-xs ${isDark ? "border-slate-700 text-slate-200" : "border-slate-300 text-slate-700"}`}
                            onClick={() => handleToggleCompanyStatus(company)}
                            disabled={updatingCompanyId === companyId}
                          >
                            {updatingCompanyId === companyId
                              ? "Saving..."
                              : status === "ACTIVE"
                                ? "Deactivate"
                                : "Activate"}
                          </button>
                          <button
                            type="button"
                            className={`h-8 rounded-lg border px-3 text-xs inline-flex items-center gap-1 ${
                              isDark
                                ? "border-rose-500/45 text-rose-200 hover:bg-rose-500/10"
                                : "border-rose-300 text-rose-700 hover:bg-rose-50"
                            }`}
                            onClick={() => handleDeleteCompany(company)}
                            disabled={deletingCompanyId === companyId}
                          >
                            <Trash2 size={12} />
                            {deletingCompanyId === companyId ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <section className={cardClass}>
            <h2 className={`text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              Usage Monitor
            </h2>
            <select
              value={usageCompanyId}
              onChange={(event) => setUsageCompanyId(event.target.value)}
              className={`${inputClass} mt-3`}
            >
              <option value="">Select company</option>
              {companies.map((company) => (
                <option key={toId(company)} value={toId(company)}>
                  {company.name}
                </option>
              ))}
            </select>

            {usageLoading ? (
              <p className={`mt-3 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>Loading usage...</p>
            ) : usage ? (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className={cardClass}>Users: {usage.usage?.totalUsers || 0}</div>
                <div className={cardClass}>Leads: {usage.usage?.totalLeads || 0}</div>
                <div className={cardClass}>Inventory: {usage.usage?.totalInventory || 0}</div>
                <div className={cardClass}>Pending Requests: {usage.usage?.pendingInventoryRequests || 0}</div>
              </div>
            ) : (
              <p className={`mt-3 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Choose a company to view usage.
              </p>
            )}
          </section>

          <section className={cardClass}>
            <h2 className={`text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>Create Company</h2>
            <form className="mt-3 space-y-3" onSubmit={handleCreateCompany}>
              <input
                type="text"
                value={companyForm.name}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Company name"
                className={inputClass}
                required
              />
              <input
                type="text"
                value={companyForm.subdomain}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, subdomain: event.target.value }))}
                placeholder="Company route slug (optional, e.g. abc)"
                className={inputClass}
              />
              {companyRoutePreview ? (
                <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Route preview: {companyRoutePreview}
                </p>
              ) : null}
              <input
                type="text"
                value={companyForm.adminName}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, adminName: event.target.value }))}
                placeholder="Admin name"
                className={inputClass}
                required
              />
              <input
                type="email"
                value={companyForm.adminEmail}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, adminEmail: event.target.value }))}
                placeholder="Admin email"
                className={inputClass}
                required
              />
              <input
                type="password"
                value={companyForm.adminPassword}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, adminPassword: event.target.value }))}
                placeholder="Admin password"
                className={inputClass}
                required
              />
              <button
                type="submit"
                disabled={creatingCompany}
                className="h-10 w-full rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white disabled:opacity-70"
              >
                {creatingCompany ? "Creating..." : "Create Company"}
              </button>
            </form>
          </section>

          <section className={cardClass}>
            <h2 className={`text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>Create Plan</h2>
            <form className="mt-3 space-y-3" onSubmit={handleCreatePlan}>
              <input
                type="text"
                value={planForm.code}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                placeholder="Plan code"
                className={inputClass}
                required
              />
              <input
                type="text"
                value={planForm.name}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Plan name"
                className={inputClass}
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={planForm.monthlyPrice}
                  onChange={(event) => setPlanForm((prev) => ({ ...prev, monthlyPrice: event.target.value }))}
                  placeholder="Monthly"
                  className={inputClass}
                />
                <input
                  type="number"
                  value={planForm.yearlyPrice}
                  onChange={(event) => setPlanForm((prev) => ({ ...prev, yearlyPrice: event.target.value }))}
                  placeholder="Yearly"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={creatingPlan}
                className="h-10 w-full rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white disabled:opacity-70"
              >
                {creatingPlan ? "Creating..." : "Create Plan"}
              </button>
            </form>

            <div className="mt-3 space-y-2">
              {plans.map((plan) => {
                const planId = toId(plan);
                return (
                  <div key={planId} className={`rounded-lg border px-3 py-2 ${isDark ? "border-slate-700" : "border-slate-200"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className={`text-sm ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                        {plan.code} - {plan.name}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTogglePlanStatus(plan)}
                        disabled={updatingPlanId === planId}
                        className={`h-7 rounded-lg border px-2 text-xs ${isDark ? "border-slate-700 text-slate-200" : "border-slate-300 text-slate-700"}`}
                      >
                        {updatingPlanId === planId ? "Saving..." : plan.isActive ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={cardClass}>
            <h2 className={`text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              Assign Subscription
            </h2>
            <form className="mt-3 space-y-3" onSubmit={handleAssignSubscription}>
              <select
                value={subscriptionForm.companyId}
                onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, companyId: event.target.value }))}
                className={inputClass}
                required
              >
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={toId(company)} value={toId(company)}>
                    {company.name}
                  </option>
                ))}
              </select>
              <select
                value={subscriptionForm.planId}
                onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, planId: event.target.value }))}
                className={inputClass}
                required
              >
                <option value="">Select plan</option>
                {plans.map((plan) => (
                  <option key={toId(plan)} value={toId(plan)}>
                    {plan.code} - {plan.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={subscriptionForm.status}
                  onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, status: event.target.value }))}
                  className={inputClass}
                >
                  {SUBSCRIPTION_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <select
                  value={subscriptionForm.billingCycle}
                  onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, billingCycle: event.target.value }))}
                  className={inputClass}
                >
                  {BILLING_CYCLES.map((cycle) => (
                    <option key={cycle} value={cycle}>{cycle}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={subscriptionForm.seats}
                  onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, seats: event.target.value }))}
                  placeholder="Seats"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={assigningSubscription}
                className="h-10 w-full rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white disabled:opacity-70"
              >
                {assigningSubscription ? "Assigning..." : "Assign Subscription"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminPanel;
