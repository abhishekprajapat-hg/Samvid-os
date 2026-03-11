import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  getMyTenantMetaIntegration,
  updateMyTenantMetaIntegration,
} from "../../services/saasService";
import { toErrorMessage } from "../../utils/errorMessage";

const AdminMetaAdsPanel = ({ theme = "light" }) => {
  const isDark = theme === "dark";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [pageIdsInput, setPageIdsInput] = useState("");
  const [accessTokenInput, setAccessTokenInput] = useState("");
  const [accessTokenConfigured, setAccessTokenConfigured] = useState(false);
  const [accessTokenPreview, setAccessTokenPreview] = useState("");
  const [clearToken, setClearToken] = useState(false);
  const [webhookGlobalUrl, setWebhookGlobalUrl] = useState("");
  const [webhookTenantUrl, setWebhookTenantUrl] = useState("");
  const [readiness, setReadiness] = useState(null);

  const inputClass = `h-10 w-full rounded-xl border px-3 text-sm outline-none ${
    isDark
      ? "border-slate-700 bg-slate-950 text-slate-200"
      : "border-slate-300 bg-white text-slate-700"
  }`;
  const cardClass = `rounded-2xl border p-4 ${
    isDark ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-white"
  }`;

  const readinessStatus = String(readiness?.status || "NOT_CONFIGURED").toUpperCase();
  const readinessRecords = Array.isArray(readiness?.records) ? readiness.records : [];
  const lastCheckedAt = String(readiness?.lastCheckedAt || "").trim();
  const lastCheckedDate = lastCheckedAt ? new Date(lastCheckedAt) : null;
  const lastCheckedLabel = lastCheckedDate && Number.isFinite(lastCheckedDate.getTime())
    ? lastCheckedDate.toLocaleString()
    : "-";
  const readinessBadgeClass = readinessStatus === "READY"
    ? isDark
      ? "bg-emerald-500/15 text-emerald-200"
      : "bg-emerald-100 text-emerald-700"
    : readinessStatus === "PARTIAL"
      ? isDark
        ? "bg-amber-500/15 text-amber-200"
        : "bg-amber-100 text-amber-700"
      : readinessStatus === "FAILED"
        ? isDark
          ? "bg-red-500/15 text-red-200"
          : "bg-red-100 text-red-700"
        : isDark
          ? "bg-slate-700 text-slate-200"
          : "bg-slate-200 text-slate-700";

  const applyIntegration = useCallback((integration) => {
    const pageIds = Array.isArray(integration?.pageIds) ? integration.pageIds : [];
    setCompanyName(String(integration?.companyName || ""));
    setSubdomain(String(integration?.subdomain || ""));
    setPageIdsInput(pageIds.join(", "));
    setAccessTokenConfigured(Boolean(integration?.accessTokenConfigured));
    setAccessTokenPreview(String(integration?.accessTokenPreview || ""));
    setWebhookGlobalUrl(String(integration?.webhook?.globalCallbackUrl || ""));
    setWebhookTenantUrl(String(integration?.webhook?.tenantScopedCallbackUrl || ""));
    setReadiness(integration?.readiness || null);
    setAccessTokenInput("");
    setClearToken(false);
  }, []);

  const loadIntegration = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const integration = await getMyTenantMetaIntegration();
      applyIntegration(integration);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load tenant Meta integration"));
    } finally {
      setLoading(false);
    }
  }, [applyIntegration]);

  useEffect(() => {
    loadIntegration();
  }, [loadIntegration]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 2200);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleSave = async (event) => {
    event.preventDefault();
    const payload = {
      pageIds: pageIdsInput,
    };
    if (accessTokenInput.trim()) {
      payload.accessToken = accessTokenInput.trim();
    }
    if (clearToken) {
      payload.clearAccessToken = true;
    }

    try {
      setSaving(true);
      setError("");
      const updated = await updateMyTenantMetaIntegration(payload);
      applyIntegration(updated);
      const readyPages = Number(updated?.readiness?.readyPages || 0);
      const totalPages = Number(updated?.readiness?.totalPages || 0);
      const status = String(updated?.readiness?.status || "UPDATED").toUpperCase();
      if (totalPages > 0) {
        setNotice(`Meta sync ${status}: ${readyPages}/${totalPages} pages connected.`);
      } else {
        setNotice("Meta integration updated.");
      }
    } catch (err) {
      setError(toErrorMessage(err, "Failed to update tenant Meta integration"));
    } finally {
      setSaving(false);
    }
  };

  const routePreview = useMemo(() => {
    const slug = String(subdomain || "").trim().toLowerCase();
    if (!slug) return "-";
    if (typeof window === "undefined") return `/${slug}/dashboard`;
    const host = String(window.location.host || "").trim().toLowerCase();
    return host ? `${host}/${slug}/dashboard` : `/${slug}/dashboard`;
  }, [subdomain]);

  if (loading) {
    return (
      <div className={`w-full h-full px-4 sm:px-6 md:px-10 pt-6 ${isDark ? "bg-slate-950/40" : "bg-slate-50/70"}`}>
        <div className={cardClass}>Loading Meta integration...</div>
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
              Meta Ads Integration
            </h1>
            <p className={`mt-1 text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Company admin panel for Meta lead routing setup.
            </p>
          </div>
          <button
            type="button"
            onClick={loadIntegration}
            className={`h-10 rounded-xl border px-4 text-sm font-semibold inline-flex items-center gap-2 ${
              isDark
                ? "border-slate-700 bg-slate-950/70 text-slate-200"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            <RefreshCw size={14} />
            Refresh
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

      <section className={cardClass}>
        <div className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
          <div><span className="font-semibold">Company:</span> {companyName || "-"}</div>
          <div className="mt-1"><span className="font-semibold">Route:</span> {routePreview}</div>
        </div>

        <form className="mt-4 space-y-3" onSubmit={handleSave}>
          <input
            type="text"
            value={pageIdsInput}
            onChange={(event) => setPageIdsInput(event.target.value)}
            placeholder="Meta page IDs (comma separated)"
            className={inputClass}
          />

          <input
            type="password"
            value={accessTokenInput}
            onChange={(event) => setAccessTokenInput(event.target.value)}
            placeholder="New Meta access token (optional)"
            className={inputClass}
          />

          <label className={`flex items-center gap-2 text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
            <input
              type="checkbox"
              checked={clearToken}
              onChange={(event) => setClearToken(Boolean(event.target.checked))}
            />
            Clear existing access token
          </label>

          <div className={`rounded-lg border px-3 py-2 text-xs ${isDark ? "border-slate-700 text-slate-300" : "border-slate-200 text-slate-600"}`}>
            <div className="flex items-center gap-2">
              <span>Connection status:</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${readinessBadgeClass}`}>
                {readinessStatus}
              </span>
            </div>
            <div className="mt-1">
              Connected pages: {Number(readiness?.readyPages || 0)}/{Number(readiness?.totalPages || 0)}
            </div>
            {readiness?.message ? (
              <div className="mt-1">Status message: {readiness.message}</div>
            ) : null}
            <div className="mt-1">Last sync: {lastCheckedLabel}</div>
            <div className="mt-2">Token configured: {accessTokenConfigured ? "Yes" : "No"}</div>
            {accessTokenPreview ? (
              <div className="mt-1">Token preview: {accessTokenPreview}</div>
            ) : null}
            <div className="mt-2">Webhook callback: {webhookGlobalUrl || "-"}</div>
            <div className="mt-1">Tenant callback: {webhookTenantUrl || "-"}</div>
            {readiness?.syncErrorMessage ? (
              <div className={`mt-2 ${isDark ? "text-red-300" : "text-red-600"}`}>
                Sync error: {readiness.syncErrorMessage}
              </div>
            ) : null}
          </div>

          {readinessRecords.length ? (
            <div className={`rounded-lg border px-3 py-2 text-xs ${isDark ? "border-slate-700 text-slate-300" : "border-slate-200 text-slate-600"}`}>
              <div className="font-semibold">Page-wise subscription status</div>
              <div className="mt-2 space-y-2">
                {readinessRecords.map((record) => {
                  const pageId = String(record?.pageId || "");
                  const ok = Boolean(record?.success);
                  const recordStatus = String(record?.status || "").toUpperCase() || (ok ? "SUBSCRIBED" : "FAILED");
                  return (
                    <div key={pageId} className={`rounded-md border px-2 py-2 ${isDark ? "border-slate-700" : "border-slate-200"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{pageId || "-"}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          ok
                            ? isDark
                              ? "bg-emerald-500/15 text-emerald-200"
                              : "bg-emerald-100 text-emerald-700"
                            : isDark
                              ? "bg-red-500/15 text-red-200"
                              : "bg-red-100 text-red-700"
                        }`}>
                          {recordStatus}
                        </span>
                      </div>
                      {record?.errorMessage ? (
                        <div className={`mt-1 ${isDark ? "text-red-300" : "text-red-600"}`}>
                          {record.errorMessage}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="h-10 w-full rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save Meta Integration"}
          </button>
        </form>
      </section>
    </div>
  );
};

export default AdminMetaAdsPanel;
