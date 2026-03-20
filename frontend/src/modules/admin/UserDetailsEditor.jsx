import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, RefreshCw, Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getUserProfileById,
  getUsers,
  updateUserByAdmin,
} from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";

const ROLE_OPTIONS = [
  { label: "Manager", value: "MANAGER" },
  { label: "Assistant Manager", value: "ASSISTANT_MANAGER" },
  { label: "Team Leader", value: "TEAM_LEADER" },
  { label: "Executive", value: "EXECUTIVE" },
  { label: "Field Executive", value: "FIELD_EXECUTIVE" },
  { label: "Channel Partner", value: "CHANNEL_PARTNER" },
];

const REPORTING_PARENT_ROLES = {
  MANAGER: ["ADMIN"],
  ASSISTANT_MANAGER: ["MANAGER"],
  TEAM_LEADER: ["ASSISTANT_MANAGER"],
  EXECUTIVE: ["TEAM_LEADER"],
  FIELD_EXECUTIVE: ["TEAM_LEADER"],
  CHANNEL_PARTNER: ["ADMIN"],
};

const ROLE_LABELS = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  ASSISTANT_MANAGER: "Assistant Manager",
  TEAM_LEADER: "Team Leader",
  EXECUTIVE: "Executive",
  FIELD_EXECUTIVE: "Field Executive",
  CHANNEL_PARTNER: "Channel Partner",
};
const BROKERAGE_MODE_OPTIONS = [
  { label: "Flat per closed deal", value: "FLAT" },
  { label: "Percentage of sell value", value: "PERCENTAGE" },
];
const DEFAULT_BROKERAGE_VALUE = 50000;
const DEFAULT_BROKERAGE_PERCENTAGE = 2;

const getEntityId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value._id || value.id || "");
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const safeReadCurrentUserId = () => {
  try {
    const row = JSON.parse(localStorage.getItem("user") || "{}");
    return String(row?._id || row?.id || "").trim();
  } catch {
    return "";
  }
};

const normalizeBrokerageMode = (value) =>
  String(value || "").trim().toUpperCase() === "PERCENTAGE" ? "PERCENTAGE" : "FLAT";

const normalizeBrokerageFormState = (config = null) => {
  const mode = normalizeBrokerageMode(config?.mode);
  const fallbackValue = mode === "PERCENTAGE"
    ? DEFAULT_BROKERAGE_PERCENTAGE
    : DEFAULT_BROKERAGE_VALUE;
  const parsedValue = Number(config?.value);

  return {
    brokerageMode: mode,
    brokerageValue: Number.isFinite(parsedValue) ? String(parsedValue) : String(fallbackValue),
    brokerageNotes: String(config?.notes || ""),
  };
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatBrokerageSummary = (config = null) => {
  const normalized = normalizeBrokerageFormState(config);
  const rawValue = Number(normalized.brokerageValue);
  const value = Number.isFinite(rawValue)
    ? rawValue
    : normalized.brokerageMode === "PERCENTAGE"
      ? DEFAULT_BROKERAGE_PERCENTAGE
      : DEFAULT_BROKERAGE_VALUE;

  return normalized.brokerageMode === "PERCENTAGE"
    ? `${value}% of sell value`
    : `${formatCurrency(value)} per closed deal`;
};

const UserDetailsEditor = ({ theme = "light" }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const isDarkTheme = theme === "dark";
  const currentUserId = safeReadCurrentUserId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "MANAGER",
    reportingToId: "",
    isActive: true,
    canViewInventory: false,
    ...normalizeBrokerageFormState(null),
    password: "",
  });

  const loadData = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError("");

      const [profileData, usersData] = await Promise.all([
        getUserProfileById(userId),
        getUsers(),
      ]);

      const resolvedProfile = profileData?.profile || null;
      const rows = Array.isArray(usersData?.users) ? usersData.users : [];

      if (!resolvedProfile) {
        setProfile(null);
        setUsers(rows);
        return;
      }

      setProfile(resolvedProfile);
      setUsers(rows);
      setFormData({
        name: resolvedProfile.name || "",
        email: resolvedProfile.email || "",
        phone: resolvedProfile.phone || "",
        role: resolvedProfile.role || "MANAGER",
        reportingToId: getEntityId(resolvedProfile.parentId),
        isActive: Boolean(resolvedProfile.isActive),
        canViewInventory: Boolean(resolvedProfile.canViewInventory),
        ...normalizeBrokerageFormState(resolvedProfile.brokerageConfig),
        password: "",
      });
    } catch (loadError) {
      setError(toErrorMessage(loadError, "Failed to load user details"));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(""), 1800);
    return () => clearTimeout(timer);
  }, [success]);

  const allowedParentRoles = useMemo(
    () => REPORTING_PARENT_ROLES[formData.role] || [],
    [formData.role],
  );

  const reportingCandidates = useMemo(() => {
    if (!allowedParentRoles.length) return [];
    return users.filter((row) => {
      const candidateId = String(row?._id || "");
      return row?.isActive
        && allowedParentRoles.includes(row.role)
        && candidateId !== String(userId || "");
    });
  }, [allowedParentRoles, userId, users]);

  const needsReporting = allowedParentRoles.length > 0;
  const isEditingSelf = String(currentUserId || "") === String(userId || "");

  useEffect(() => {
    if (!needsReporting) {
      if (formData.reportingToId !== "") {
        setFormData((prev) => ({ ...prev, reportingToId: "" }));
      }
      return;
    }

    const hasSelectedParent = reportingCandidates.some(
      (candidate) => String(candidate._id) === String(formData.reportingToId || ""),
    );
    if (!hasSelectedParent) {
      setFormData((prev) => ({ ...prev, reportingToId: "" }));
    }
  }, [formData.reportingToId, needsReporting, reportingCandidates]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRoleChange = (nextRole) => {
    setFormData((prev) => ({
      ...prev,
      role: nextRole,
      reportingToId: "",
      canViewInventory:
        nextRole === "CHANNEL_PARTNER" ? prev.canViewInventory : false,
    }));
  };

  const handleSave = async () => {
    if (!profile || !userId) return;

    const name = String(formData.name || "").trim();
    const email = String(formData.email || "").trim();
    if (!name || !email) {
      setError("Name and email are required.");
      return;
    }

    const payload = {
      name,
      email,
      phone: String(formData.phone || "").trim(),
      role: formData.role,
      reportingToId: needsReporting ? formData.reportingToId : null,
      isActive: Boolean(formData.isActive),
      canViewInventory:
        formData.role === "CHANNEL_PARTNER"
          ? Boolean(formData.canViewInventory)
          : false,
    };

    if (formData.role === "CHANNEL_PARTNER") {
      const brokerageMode = normalizeBrokerageMode(formData.brokerageMode);
      const brokerageValue = Number(formData.brokerageValue);
      if (!Number.isFinite(brokerageValue) || brokerageValue < 0) {
        setError("Brokerage value must be 0 or more.");
        return;
      }
      if (brokerageMode === "PERCENTAGE" && brokerageValue > 100) {
        setError("Brokerage percentage cannot be more than 100.");
        return;
      }

      payload.brokerageConfig = {
        mode: brokerageMode,
        value: brokerageValue,
        notes: String(formData.brokerageNotes || "").trim(),
      };
    }

    const password = String(formData.password || "");
    if (password.trim()) {
      payload.password = password;
    }

    try {
      setSaving(true);
      setError("");

      const updated = await updateUserByAdmin(userId, payload);
      if (!updated) {
        await loadData();
        setSuccess("User updated");
        return;
      }

      setProfile(updated);
      setFormData((prev) => ({
        ...prev,
        name: updated.name || "",
        email: updated.email || "",
        phone: updated.phone || "",
        role: updated.role || prev.role,
        reportingToId: getEntityId(updated.parentId),
        isActive: Boolean(updated.isActive),
        canViewInventory: Boolean(updated.canViewInventory),
        ...normalizeBrokerageFormState(updated.brokerageConfig),
        password: "",
      }));
      setSuccess("User updated");
    } catch (saveError) {
      setError(toErrorMessage(saveError, "Failed to update user"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`w-full h-full px-4 sm:px-6 md:px-10 pt-20 md:pt-24 pb-8 ${isDarkTheme ? "bg-slate-950/40" : "bg-slate-50/70"}`}>
        <div className={`rounded-xl border p-4 text-sm flex items-center gap-2 ${isDarkTheme ? "border-slate-700 bg-slate-900/70 text-slate-200" : "border-slate-200 bg-white text-slate-700"}`}>
          <Loader2 size={16} className="animate-spin" />
          Loading user details...
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={`w-full h-full px-4 sm:px-6 md:px-10 pt-20 md:pt-24 pb-8 ${isDarkTheme ? "bg-slate-950/40" : "bg-slate-50/70"}`}>
        <button
          type="button"
          onClick={() => navigate("/admin/users")}
          className={`mb-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            isDarkTheme ? "border-slate-700 text-slate-200 bg-slate-900/70" : "border-slate-300 text-slate-700 bg-white"
          }`}
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div className={`rounded-xl border p-4 text-sm ${isDarkTheme ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
          User not found or inaccessible.
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full overflow-y-auto custom-scrollbar px-4 sm:px-6 md:px-10 pt-20 md:pt-24 pb-8 flex flex-col gap-5 ${isDarkTheme ? "bg-slate-950/40" : "bg-slate-50/70"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate("/admin/users")}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            isDarkTheme ? "border-slate-700 text-slate-200 bg-slate-900/70" : "border-slate-300 text-slate-700 bg-white"
          }`}
        >
          <ArrowLeft size={14} />
          Back to Team Access
        </button>
        <button
          type="button"
          onClick={loadData}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            isDarkTheme ? "border-slate-700 text-slate-200 bg-slate-900/70" : "border-slate-300 text-slate-700 bg-white"
          }`}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className={`rounded-xl border p-3 text-sm ${isDarkTheme ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
          {error}
        </div>
      ) : null}

      {success ? (
        <div className={`rounded-xl border p-3 text-sm ${isDarkTheme ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {success}
        </div>
      ) : null}

      {isEditingSelf ? (
        <div className={`rounded-xl border p-3 text-sm ${isDarkTheme ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
          Own account edit yahan se blocked hai. Profile page se apna account update karo.
        </div>
      ) : null}

      <section className={`rounded-xl border p-4 ${isDarkTheme ? "border-slate-700 bg-slate-900/75" : "border-slate-200 bg-white"}`}>
        <h2 className={`text-lg font-bold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
          {profile.name}
        </h2>
        <p className={`mt-1 text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
          {ROLE_LABELS[profile.role] || profile.role}
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>Name</span>
            <input
              type="text"
              value={formData.name}
              onChange={(event) => handleChange("name", event.target.value)}
              disabled={isEditingSelf}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
            />
          </label>

          <label className="space-y-1">
            <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>Email</span>
            <input
              type="email"
              value={formData.email}
              onChange={(event) => handleChange("email", event.target.value)}
              disabled={isEditingSelf}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
            />
          </label>

          <label className="space-y-1">
            <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>Phone</span>
            <input
              type="text"
              value={formData.phone}
              onChange={(event) => handleChange("phone", event.target.value)}
              disabled={isEditingSelf}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
            />
          </label>

          <label className="space-y-1">
            <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>Role</span>
            <select
              value={formData.role}
              onChange={(event) => handleRoleChange(event.target.value)}
              disabled={isEditingSelf}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {needsReporting ? (
            <label className="space-y-1 md:col-span-2">
              <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>
                Reporting To ({allowedParentRoles.map((role) => ROLE_LABELS[role] || role).join(" / ")})
              </span>
              <select
                value={formData.reportingToId}
                onChange={(event) => handleChange("reportingToId", event.target.value)}
                disabled={isEditingSelf}
                className={`w-full rounded-lg border px-3 py-2 text-sm ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
              >
                <option value="">Auto assign (least-loaded)</option>
                {reportingCandidates.map((candidate) => (
                  <option key={candidate._id} value={candidate._id}>
                    {candidate.name} ({candidate.email}) - {ROLE_LABELS[candidate.role] || candidate.role}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="space-y-1">
            <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>Reset Password</span>
            <input
              type="password"
              value={formData.password}
              onChange={(event) => handleChange("password", event.target.value)}
              disabled={isEditingSelf}
              placeholder="Leave blank to keep current password"
              className={`w-full rounded-lg border px-3 py-2 text-sm ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
            />
          </label>

          <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"}`}>
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(event) => handleChange("isActive", event.target.checked)}
              disabled={isEditingSelf}
            />
            <span className="text-sm">Active User</span>
          </label>

          {formData.role === "CHANNEL_PARTNER" ? (
            <div className={`md:col-span-2 rounded-xl border p-3 ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"}`}>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.canViewInventory}
                    onChange={(event) => handleChange("canViewInventory", event.target.checked)}
                    disabled={isEditingSelf}
                  />
                  <span className="text-sm">Can View Inventory</span>
                </label>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>
                      Brokerage Model
                    </span>
                    <select
                      value={formData.brokerageMode}
                      onChange={(event) => {
                        const nextMode = event.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          brokerageMode: nextMode,
                          brokerageValue:
                            nextMode === "PERCENTAGE"
                              ? String(DEFAULT_BROKERAGE_PERCENTAGE)
                              : String(DEFAULT_BROKERAGE_VALUE),
                        }));
                      }}
                      disabled={isEditingSelf}
                      className={`w-full rounded-lg border px-3 py-2 text-sm ${isDarkTheme ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
                    >
                      {BROKERAGE_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>
                      {formData.brokerageMode === "PERCENTAGE" ? "Brokerage %" : "Flat Brokerage"}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={formData.brokerageMode === "PERCENTAGE" ? "100" : undefined}
                      step={formData.brokerageMode === "PERCENTAGE" ? "0.01" : "1000"}
                      value={formData.brokerageValue}
                      onChange={(event) => handleChange("brokerageValue", event.target.value)}
                      disabled={isEditingSelf}
                      className={`w-full rounded-lg border px-3 py-2 text-sm ${isDarkTheme ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
                    />
                  </label>

                  <label className="space-y-1 md:col-span-2">
                    <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>
                      Brokerage Notes
                    </span>
                    <textarea
                      rows={3}
                      value={formData.brokerageNotes}
                      onChange={(event) => handleChange("brokerageNotes", event.target.value)}
                      disabled={isEditingSelf}
                      placeholder="Example: payable after full collection"
                      className={`w-full rounded-lg border px-3 py-2 text-sm ${isDarkTheme ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
                    />
                  </label>
                </div>

                <p className={`text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                  Finance dashboard will calculate realized and pending brokerage using this rule.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || isEditingSelf}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </section>

      <section className={`rounded-xl border p-4 ${isDarkTheme ? "border-slate-700 bg-slate-900/75" : "border-slate-200 bg-white"}`}>
        <div className={`text-[11px] uppercase tracking-wider font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
          Account Metadata
        </div>
        <div className={`mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs ${isDarkTheme ? "text-slate-300" : "text-slate-700"}`}>
          <div>User ID: {String(profile._id || "-")}</div>
          <div>Company ID: {String(profile.companyId || "-")}</div>
          <div>Partner Code: {profile.partnerCode || "-"}</div>
          <div>Brokerage Rule: {formatBrokerageSummary(profile.brokerageConfig)}</div>
          <div>Manager: {profile.manager?.name || "-"}</div>
          <div>Created: {formatDate(profile.createdAt)}</div>
          <div>Updated: {formatDate(profile.updatedAt)}</div>
          <div>Last Assigned: {formatDate(profile.lastAssignedAt)}</div>
          <div>Location Updated: {formatDate(profile.liveLocation?.updatedAt)}</div>
          <div className="md:col-span-2">Brokerage Note: {profile.brokerageConfig?.notes || "-"}</div>
        </div>
      </section>
    </div>
  );
};

export default UserDetailsEditor;
