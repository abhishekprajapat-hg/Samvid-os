import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  UserCircle2,
  Loader,
  Save,
  Phone,
  Mail,
  Building2,
  Briefcase,
  Shield,
  Users,
  MapPin,
} from "lucide-react";
import { getMyProfile, updateMyProfile } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";

const ROLE_LABELS = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  ASSISTANT_MANAGER: "Assistant Manager",
  TEAM_LEADER: "Team Leader",
  EXECUTIVE: "Executive",
  FIELD_EXECUTIVE: "Field Executive",
  CHANNEL_PARTNER: "Channel Partner",
};
const MANAGEMENT_ROLES = ["MANAGER", "ASSISTANT_MANAGER", "TEAM_LEADER"];

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

const toSummaryCards = (role, summary = {}) => {
  if (role === "ADMIN") {
    return [
      { key: "users", label: "Active Users", value: summary.users ?? 0, icon: Users },
      { key: "managers", label: "Managers", value: summary.managers ?? 0, icon: Briefcase },
      {
        key: "assistantManagers",
        label: "Assistant Managers",
        value: summary.assistantManagers ?? 0,
        icon: Briefcase,
      },
      { key: "teamLeaders", label: "Team Leaders", value: summary.teamLeaders ?? 0, icon: Users },
      { key: "executives", label: "Executives", value: summary.executives ?? 0, icon: Users },
      {
        key: "fieldExecutives",
        label: "Field Executives",
        value: summary.fieldExecutives ?? 0,
        icon: MapPin,
      },
      { key: "leads", label: "Leads", value: summary.leads ?? 0, icon: Shield },
      { key: "inventory", label: "Inventory", value: summary.inventory ?? 0, icon: Building2 },
    ];
  }

  if (MANAGEMENT_ROLES.includes(role)) {
    return [
      { key: "teamMembers", label: "Team Members", value: summary.teamMembers ?? 0, icon: Users },
      {
        key: "assistantManagers",
        label: "Assistant Managers",
        value: summary.assistantManagers ?? 0,
        icon: Briefcase,
      },
      { key: "teamLeaders", label: "Team Leaders", value: summary.teamLeaders ?? 0, icon: Users },
      { key: "executives", label: "Executives", value: summary.executives ?? 0, icon: Briefcase },
      {
        key: "fieldExecutives",
        label: "Field Team",
        value: summary.fieldExecutives ?? 0,
        icon: MapPin,
      },
      { key: "teamLeads", label: "Team Leads", value: summary.teamLeads ?? 0, icon: Shield },
      {
        key: "dueFollowUpsToday",
        label: "Follow-ups Today",
        value: summary.dueFollowUpsToday ?? 0,
        icon: Briefcase,
      },
    ];
  }

  if (role === "EXECUTIVE" || role === "FIELD_EXECUTIVE") {
    return [
      { key: "assignedLeads", label: "Assigned Leads", value: summary.assignedLeads ?? 0, icon: Users },
      { key: "openLeads", label: "Open Leads", value: summary.openLeads ?? 0, icon: Shield },
      { key: "closedLeads", label: "Closed Leads", value: summary.closedLeads ?? 0, icon: Briefcase },
      {
        key: "dueFollowUpsToday",
        label: "Follow-ups Today",
        value: summary.dueFollowUpsToday ?? 0,
        icon: MapPin,
      },
    ];
  }

  if (role === "CHANNEL_PARTNER") {
    return [
      { key: "createdLeads", label: "Created Leads", value: summary.createdLeads ?? 0, icon: Users },
      { key: "closedLeads", label: "Closed Leads", value: summary.closedLeads ?? 0, icon: Briefcase },
    ];
  }

  return [];
};

const UserProfile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState({});
  const [nameDraft, setNameDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await getMyProfile();
      setProfile(response.profile || null);
      setSummary(response.summary || {});
      setNameDraft(String(response.profile?.name || ""));
      setPhoneDraft(String(response.profile?.phone || ""));
    } catch (fetchError) {
      const message = toErrorMessage(fetchError, "Failed to load profile");
      console.error(`Load profile failed: ${message}`);
      setError(message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(""), 1800);
    return () => clearTimeout(timer);
  }, [success]);

  const summaryCards = useMemo(
    () => toSummaryCards(profile?.role, summary),
    [profile?.role, summary],
  );

  const handleSave = async () => {
    if (!profile) return;

    const nextName = String(nameDraft || "").trim();
    const nextPhone = String(phoneDraft || "").trim();
    if (!nextName) {
      setError("Name is required");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const response = await updateMyProfile({
        name: nextName,
        phone: nextPhone,
      });
      setProfile(response.profile || profile);
      setSummary(response.summary || summary);
      setNameDraft(String(response.profile?.name || nextName));
      setPhoneDraft(String(response.profile?.phone || nextPhone));

      const storedUserRaw = localStorage.getItem("user");
      if (storedUserRaw) {
        try {
          const storedUser = JSON.parse(storedUserRaw);
          storedUser.name = response.profile?.name || nextName;
          storedUser.phone = response.profile?.phone || nextPhone;
          localStorage.setItem("user", JSON.stringify(storedUser));
        } catch {
          // ignore invalid local cache
        }
      }

      setSuccess("Profile updated");
    } catch (saveError) {
      const message = toErrorMessage(saveError, "Failed to update profile");
      console.error(`Update profile failed: ${message}`);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full h-full px-4 sm:px-6 lg:px-10 pt-20 md:pt-24 pb-8 space-y-6 overflow-y-auto custom-scrollbar">
      <div>
        <h1 className="font-display text-2xl sm:text-4xl text-slate-900 tracking-tight">
          User Profile
        </h1>
        <p className="text-slate-500 mt-2 font-mono text-xs uppercase tracking-widest">
          Personal account details and role summary
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm px-3 py-2">
          {success}
        </div>
      )}

      {loading ? (
        <div className="h-56 rounded-2xl border bg-white flex items-center justify-center text-slate-400 gap-2">
          <Loader size={18} className="animate-spin" /> Loading profile...
        </div>
      ) : !profile ? (
        <div className="h-56 rounded-2xl border bg-white flex items-center justify-center text-slate-500">
          Profile data not available
        </div>
      ) : (
        <>
          <div className="rounded-2xl border bg-white p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <UserCircle2 size={30} />
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Name
                  </label>
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="mt-1 w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value)}
                    className="mt-1 w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Email
                  </label>
                  <div className="mt-1 h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 flex items-center gap-2">
                    <Mail size={13} /> {profile.email || "-"}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Role
                  </label>
                  <div className="mt-1 h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 flex items-center gap-2">
                    <Briefcase size={13} /> {ROLE_LABELS[profile.role] || profile.role || "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                Save Profile
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border bg-white p-5">
              <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-3">
                Reporting
              </div>
              {profile.manager ? (
                <div className="space-y-2 text-sm text-slate-700">
                  <div className="font-semibold text-slate-900">{profile.manager.name || "-"}</div>
                  <div className="flex items-center gap-2">
                    <Mail size={13} />
                    {profile.manager.email || "-"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={13} />
                    {profile.manager.phone || "-"}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">
                  No reporting manager mapped
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-5">
              <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-3">
                Account Metadata
              </div>
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <Building2 size={13} />
                  Company Id: {String(profile.companyId || "-")}
                </div>
                <div>Created: {formatDate(profile.createdAt)}</div>
                <div>Updated: {formatDate(profile.updatedAt)}</div>
                <div>Last Assigned: {formatDate(profile.lastAssignedAt)}</div>
              </div>
            </div>
          </div>

          {summaryCards.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {summaryCards.map((card) => (
                <div key={card.key} className="rounded-2xl border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                      {card.label}
                    </div>
                    <card.icon size={14} className="text-slate-500" />
                  </div>
                  <div className="mt-2 text-2xl font-display text-slate-900">
                    {card.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserProfile;
