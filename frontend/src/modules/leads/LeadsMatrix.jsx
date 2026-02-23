import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";
import {
  Plus,
  Phone,
  Mail,
  User,
  X,
  Loader,
  Search,
  RefreshCw,
  CalendarClock,
  CheckCircle2,
  History,
  Save,
  ArrowUpRight,
  Mic,
  MicOff,
} from "lucide-react";
import {
  getAllLeads,
  createLead,
  updateLeadStatus,
  assignLead,
  getLeadActivity,
  getLeadDiary,
  addLeadDiaryEntry,
} from "../../services/leadService";
import { getInventoryAssets } from "../../services/inventoryService";
import { getUsers } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";

const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "SITE_VISIT",
  "CLOSED",
  "LOST",
];

const EXECUTIVE_ROLES = ["EXECUTIVE", "FIELD_EXECUTIVE"];
const SITE_VISIT_RADIUS_METERS = 200;

const defaultFormData = {
  inventoryId: "",
  name: "",
  phone: "",
  email: "",
  city: "",
  projectInterested: "",
  siteLat: "",
  siteLng: "",
};

const getInventoryLeadLabel = (inventoryLike = {}) =>
  [inventoryLike.projectName, inventoryLike.towerName, inventoryLike.unitNumber]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" - ");

const getStatusColor = (status) => {
  switch (status) {
    case "NEW":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "CONTACTED":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "INTERESTED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "SITE_VISIT":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "CLOSED":
      return "bg-slate-900 text-white border-slate-900";
    case "LOST":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
};

const toDateTimeInput = (dateValue) => {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
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

const toCoordinateNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizePhoneDigits = (value) =>
  String(value || "").replace(/\D/g, "");

const getDialerHref = (phone) => {
  const digits = normalizePhoneDigits(phone);
  return digits ? `tel:${digits}` : "";
};

const getWhatsAppHref = (phone) => {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return "";

  const waNumber = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${waNumber}`;
};

const getMailHref = (email) => {
  const trimmed = String(email || "").trim();
  return trimmed ? `mailto:${trimmed}` : "";
};

const getMapsHref = (city) => {
  const trimmed = String(city || "").trim();
  return trimmed
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`
    : "";
};

const WhatsAppIcon = ({ size = 13, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M13.601 2.326A7.854 7.854 0 0 0 8.005 0C3.58 0 0 3.577 0 8a7.9 7.9 0 0 0 1.153 4.095L0 16l4.01-1.127A7.9 7.9 0 0 0 8.005 16C12.425 16 16 12.423 16 8a7.85 7.85 0 0 0-2.399-5.674m-5.595 12.34a6.57 6.57 0 0 1-3.335-.908l-.24-.144-2.38.668.672-2.32-.157-.245a6.57 6.57 0 0 1-1.007-3.508c0-3.626 2.957-6.585 6.59-6.585a6.59 6.59 0 0 1 4.659 1.931A6.6 6.6 0 0 1 14.466 8c0 3.626-2.958 6.666-6.46 6.666m3.615-4.955c-.197-.1-1.17-.578-1.353-.645-.182-.065-.315-.1-.448.1-.132.197-.513.645-.627.776-.115.132-.23.149-.428.05-.197-.1-.833-.306-1.587-.977-.586-.52-.982-1.164-1.097-1.361-.115-.198-.012-.305.087-.404.09-.089.197-.23.296-.347.1-.115.132-.197.198-.33.065-.132.033-.248-.017-.347-.05-.1-.448-1.08-.613-1.48-.161-.387-.325-.334-.448-.34q-.182-.007-.396-.007a.76.76 0 0 0-.545.258c-.182.198-.694.678-.694 1.653s.71 1.92.81 2.052c.098.132 1.393 2.124 3.376 2.977.472.203.84.325 1.128.416.474.15.904.129 1.246.078.38-.057 1.17-.48 1.336-.944.164-.463.164-.86.115-.944-.05-.084-.182-.132-.38-.231" />
  </svg>
);

const LeadsMatrix = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("theme-dark"),
  );

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [formData, setFormData] = useState(defaultFormData);
  const [inventoryOptions, setInventoryOptions] = useState([]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [selectedLead, setSelectedLead] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [activityLoading, setActivityLoading] = useState(false);
  const [activities, setActivities] = useState([]);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diaryEntries, setDiaryEntries] = useState([]);
  const [diaryDraft, setDiaryDraft] = useState("");
  const [savingDiary, setSavingDiary] = useState(false);
  const [isDiaryMicSupported, setIsDiaryMicSupported] = useState(false);
  const [isDiaryListening, setIsDiaryListening] = useState(false);
  const [savingUpdates, setSavingUpdates] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [statusDraft, setStatusDraft] = useState("NEW");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [executiveDraft, setExecutiveDraft] = useState("");
  const [siteLatDraft, setSiteLatDraft] = useState("");
  const [siteLngDraft, setSiteLngDraft] = useState("");

  const [executives, setExecutives] = useState([]);
  const diaryRecognitionRef = useRef(null);

  const userRole = localStorage.getItem("role") || "";
  const canAddLead = userRole === "ADMIN" || userRole === "MANAGER";
  const canAssignLead = userRole === "ADMIN" || userRole === "MANAGER";
  const canConfigureSiteLocation = userRole === "ADMIN" || userRole === "MANAGER";

  const fetchLeads = useCallback(async (asRefresh = false) => {
    try {
      if (asRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const list = await getAllLeads();
      setLeads(Array.isArray(list) ? list : []);
    } catch (fetchError) {
      const message = toErrorMessage(fetchError, "Failed to load leads");
      console.error(`Load leads failed: ${message}`);
      setError(message);
      setLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchExecutives = useCallback(async () => {
    if (!canAssignLead) return;

    try {
      const response = await getUsers();
      const users = response?.users || [];
      const list = users.filter(
        (user) => user.isActive && EXECUTIVE_ROLES.includes(user.role),
      );
      setExecutives(list);
    } catch (fetchError) {
      const message = toErrorMessage(fetchError, "Failed to load executives");
      console.error(`Load executives failed: ${message}`);
      setExecutives([]);
    }
  }, [canAssignLead]);

  const fetchInventoryOptions = useCallback(async () => {
    if (!canAddLead) return;

    try {
      const rows = await getInventoryAssets();
      setInventoryOptions(Array.isArray(rows) ? rows : []);
    } catch (fetchError) {
      const message = toErrorMessage(fetchError, "Failed to load inventory");
      console.error(`Load inventory for leads failed: ${message}`);
      setInventoryOptions([]);
    }
  }, [canAddLead]);

  useEffect(() => {
    fetchLeads();
    fetchExecutives();
    fetchInventoryOptions();
  }, [fetchLeads, fetchExecutives, fetchInventoryOptions]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 1600);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("theme-dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsDiaryMicSupported(false);
      return undefined;
    }

    setIsDiaryMicSupported(true);

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsDiaryListening(true);
    };

    recognition.onend = () => {
      setIsDiaryListening(false);
    };

    recognition.onerror = (event) => {
      const speechError = String(event?.error || "");
      setIsDiaryListening(false);

      if (speechError === "not-allowed" || speechError === "service-not-allowed") {
        setError("Microphone permission denied. Please allow mic access in browser.");
        return;
      }

      if (speechError === "no-speech") {
        setError("No speech detected. Try speaking again.");
        return;
      }

      setError("Voice-to-text failed. Please try again.");
    };

    recognition.onresult = (event) => {
      const chunks = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = String(event.results[index]?.[0]?.transcript || "").trim();
        if (transcript) {
          chunks.push(transcript);
        }
      }

      if (!chunks.length) return;

      const incomingText = chunks.join(" ");
      setDiaryDraft((prev) => {
        const normalizedPrev = String(prev || "").trimEnd();
        return normalizedPrev ? `${normalizedPrev} ${incomingText}` : incomingText;
      });
    };

    diaryRecognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch (_) {
        // no-op
      }
      diaryRecognitionRef.current = null;
    };
  }, []);

  const leadRowClass = isDark
    ? "w-full text-left grid grid-cols-12 gap-4 p-4 rounded-xl border border-slate-700/60 hover:border-cyan-300/35 hover:bg-slate-800/70 items-center transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
    : "w-full text-left grid grid-cols-12 gap-4 p-4 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 items-center transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300";

  const filteredLeads = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return leads.filter((lead) => {
      const statusMatch = statusFilter === "ALL" || lead.status === statusFilter;

      const searchMatch =
        !normalized ||
        [lead.name, lead.phone, lead.email, lead.city, lead.projectInterested]
          .map((value) => String(value || "").toLowerCase())
          .some((value) => value.includes(normalized));

      return statusMatch && searchMatch;
    });
  }, [leads, query, statusFilter]);

  const metrics = useMemo(() => {
    const closed = leads.filter((lead) => lead.status === "CLOSED").length;
    const interested = leads.filter((lead) => lead.status === "INTERESTED").length;
    const fresh = leads.filter((lead) => lead.status === "NEW").length;
    const dueFollowUps = leads.filter((lead) => {
      if (!lead.nextFollowUp) return false;
      return new Date(lead.nextFollowUp) <= new Date();
    }).length;

    return {
      total: leads.length,
      new: fresh,
      interested,
      closed,
      dueFollowUps,
    };
  }, [leads]);

  const openLeadDetails = async (lead) => {
    const leadSiteLat = toCoordinateNumber(lead?.siteLocation?.lat);
    const leadSiteLng = toCoordinateNumber(lead?.siteLocation?.lng);

    setSelectedLead(lead);
    setStatusDraft(lead.status || "NEW");
    setFollowUpDraft(toDateTimeInput(lead.nextFollowUp));
    setSiteLatDraft(leadSiteLat === null ? "" : String(leadSiteLat));
    setSiteLngDraft(leadSiteLng === null ? "" : String(leadSiteLng));
    setExecutiveDraft(
      typeof lead.assignedTo === "string"
        ? lead.assignedTo
        : lead.assignedTo?._id || "",
    );
    setDiaryDraft("");
    setIsDetailsOpen(true);

    setActivityLoading(true);
    setDiaryLoading(true);
    const [timelineResult, diaryResult] = await Promise.allSettled([
      getLeadActivity(lead._id),
      getLeadDiary(lead._id),
    ]);

    if (timelineResult.status === "fulfilled") {
      setActivities(Array.isArray(timelineResult.value) ? timelineResult.value : []);
    } else {
      const message = toErrorMessage(timelineResult.reason, "Failed to load activity");
      console.error(`Load lead activity failed: ${message}`);
      setActivities([]);
    }

    if (diaryResult.status === "fulfilled") {
      setDiaryEntries(Array.isArray(diaryResult.value) ? diaryResult.value : []);
    } else {
      const message = toErrorMessage(diaryResult.reason, "Failed to load lead diary");
      console.error(`Load lead diary failed: ${message}`);
      setDiaryEntries([]);
    }

    setActivityLoading(false);
    setDiaryLoading(false);
  };

  const closeDetails = () => {
    if (diaryRecognitionRef.current && isDiaryListening) {
      try {
        diaryRecognitionRef.current.stop();
      } catch (_) {
        // no-op
      }
    }
    setIsDetailsOpen(false);
    setSelectedLead(null);
    setActivities([]);
    setDiaryEntries([]);
    setDiaryDraft("");
    setSiteLatDraft("");
    setSiteLngDraft("");
  };

  const handleInventorySelection = (inventoryId) => {
    setFormData((prev) => {
      const selectedInventory = inventoryOptions.find((item) => item._id === inventoryId);
      if (!selectedInventory) {
        return {
          ...prev,
          inventoryId,
        };
      }

      const inventoryProjectLabel = getInventoryLeadLabel(selectedInventory);
      const inventorySiteLat = toCoordinateNumber(selectedInventory?.siteLocation?.lat);
      const inventorySiteLng = toCoordinateNumber(selectedInventory?.siteLocation?.lng);

      return {
        ...prev,
        inventoryId,
        projectInterested: inventoryProjectLabel || prev.projectInterested,
        city: String(selectedInventory.location || "").trim() || prev.city,
        siteLat: inventorySiteLat === null ? "" : String(inventorySiteLat),
        siteLng: inventorySiteLng === null ? "" : String(inventorySiteLng),
      };
    });
  };

  const handleSaveLead = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      setError("Name and phone are required");
      return;
    }

    const parsedSiteLat = toCoordinateNumber(formData.siteLat);
    const parsedSiteLng = toCoordinateNumber(formData.siteLng);
    const hasAnySiteCoordinate =
      parsedSiteLat !== null || parsedSiteLng !== null;

    if (
      hasAnySiteCoordinate
      && (parsedSiteLat === null || parsedSiteLng === null)
    ) {
      setError("Enter valid site latitude and longitude");
      return;
    }

    try {
      setSavingLead(true);
      setError("");

      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        city: formData.city.trim(),
        projectInterested: formData.projectInterested.trim(),
      };

      if (formData.inventoryId) {
        payload.inventoryId = formData.inventoryId;
      }

      if (hasAnySiteCoordinate) {
        payload.siteLocation = {
          lat: parsedSiteLat,
          lng: parsedSiteLng,
          radiusMeters: SITE_VISIT_RADIUS_METERS,
        };
      }

      const created = await createLead(payload);

      if (created) {
        setLeads((prev) => [created, ...prev]);
      } else {
        await fetchLeads(true);
      }

      setIsAddModalOpen(false);
      setFormData(defaultFormData);
      setSuccess("Lead created successfully");
    } catch (saveError) {
      const message = toErrorMessage(saveError, "Failed to save lead");
      console.error(`Create lead failed: ${message}`);
      setError(message);
    } finally {
      setSavingLead(false);
    }
  };

  const handleUpdateLead = async () => {
    if (!selectedLead) return;

    try {
      setSavingUpdates(true);
      setError("");

      const parsedSiteLat = toCoordinateNumber(siteLatDraft);
      const parsedSiteLng = toCoordinateNumber(siteLngDraft);
      const hasAnySiteCoordinate =
        parsedSiteLat !== null || parsedSiteLng !== null;

      if (
        canConfigureSiteLocation
        && hasAnySiteCoordinate
        && (parsedSiteLat === null || parsedSiteLng === null)
      ) {
        setError("Enter valid site latitude and longitude");
        setSavingUpdates(false);
        return;
      }

      const payload = {
        status: statusDraft,
      };

      if (followUpDraft) {
        payload.nextFollowUp = followUpDraft;
      }

      if (canConfigureSiteLocation && hasAnySiteCoordinate) {
        payload.siteLocation = {
          lat: parsedSiteLat,
          lng: parsedSiteLng,
          radiusMeters: SITE_VISIT_RADIUS_METERS,
        };
      }

      const updatedLead = await updateLeadStatus(selectedLead._id, payload);

      if (!updatedLead) {
        await fetchLeads(true);
        setSuccess("Lead updated");
        return;
      }

      setLeads((prev) =>
        prev.map((lead) => (lead._id === updatedLead._id ? updatedLead : lead)),
      );
      setSelectedLead(updatedLead);
      setSuccess("Lead updated");
    } catch (updateError) {
      const message = toErrorMessage(updateError, "Failed to update lead");
      console.error(`Update lead failed: ${message}`);
      setError(message);
    } finally {
      setSavingUpdates(false);
    }
  };

  const handleAssignLead = async () => {
    if (!selectedLead || !executiveDraft) return;

    try {
      setAssigning(true);
      setError("");

      const updatedLead = await assignLead(selectedLead._id, executiveDraft);

      if (!updatedLead) {
        await fetchLeads(true);
        setSuccess("Lead assigned");
        return;
      }

      setLeads((prev) =>
        prev.map((lead) => (lead._id === updatedLead._id ? updatedLead : lead)),
      );
      setSelectedLead(updatedLead);
      setSuccess("Lead assigned");
    } catch (assignError) {
      const message = toErrorMessage(assignError, "Failed to assign lead");
      console.error(`Assign lead failed: ${message}`);
      setError(message);
    } finally {
      setAssigning(false);
    }
  };

  const handleAddDiary = async () => {
    if (!selectedLead) return;

    const note = diaryDraft.trim();
    if (!note) {
      setError("Diary note cannot be empty");
      return;
    }

    try {
      setSavingDiary(true);
      setError("");

      const createdEntry = await addLeadDiaryEntry(selectedLead._id, note);
      if (createdEntry) {
        setDiaryEntries((prev) => [createdEntry, ...prev]);
      } else {
        const diary = await getLeadDiary(selectedLead._id);
        setDiaryEntries(Array.isArray(diary) ? diary : []);
      }

      const timeline = await getLeadActivity(selectedLead._id);
      setActivities(Array.isArray(timeline) ? timeline : []);
      setDiaryDraft("");
      setSuccess("Diary note added");
    } catch (saveError) {
      const message = toErrorMessage(saveError, "Failed to save diary note");
      console.error(`Save lead diary failed: ${message}`);
      setError(message);
    } finally {
      setSavingDiary(false);
    }
  };

  const handleDiaryVoiceToggle = () => {
    if (!isDiaryMicSupported || !diaryRecognitionRef.current) {
      setError("Voice-to-text is not supported in this browser.");
      return;
    }

    setError("");

    try {
      if (isDiaryListening) {
        diaryRecognitionRef.current.stop();
        return;
      }
      diaryRecognitionRef.current.start();
    } catch (_) {
      setError("Unable to start microphone. Try again.");
    }
  };

  const selectedLeadDialerHref = getDialerHref(selectedLead?.phone);
  const selectedLeadWhatsAppHref = getWhatsAppHref(selectedLead?.phone);
  const selectedLeadMailHref = getMailHref(selectedLead?.email);
  const selectedLeadMapsHref = getMapsHref(selectedLead?.city);
  const selectedLeadSiteLat = toCoordinateNumber(selectedLead?.siteLocation?.lat);
  const selectedLeadSiteLng = toCoordinateNumber(selectedLead?.siteLocation?.lng);
  const selectedLeadInventoryLabel = getInventoryLeadLabel(selectedLead?.inventoryId || {});
  const selectedLeadInventoryLocation = String(selectedLead?.inventoryId?.location || "").trim();

  return (
    <div className="w-full h-full px-4 sm:px-6 lg:px-10 pt-20 md:pt-24 pb-6 flex flex-col bg-slate-50/50 overflow-y-auto custom-scrollbar">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-4xl text-slate-900 tracking-tight">
            Lead Matrix
          </h1>
          <p className="text-slate-500 mt-2 font-mono text-xs uppercase tracking-widest">
            Click any lead to open full detail
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLeads(true)}
            className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold uppercase tracking-wide flex items-center gap-2"
          >
            {refreshing ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>

          {canAddLead && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="h-10 px-5 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-emerald-600"
            >
              <Plus size={15} /> Add Lead
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm px-3 py-2 mb-4 flex items-center gap-2">
          <CheckCircle2 size={14} /> {success}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Total</div>
          <div className="text-2xl font-display text-slate-900 mt-1">{metrics.total}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">New</div>
          <div className="text-2xl font-display text-blue-700 mt-1">{metrics.new}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Interested</div>
          <div className="text-2xl font-display text-emerald-700 mt-1">{metrics.interested}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Closed</div>
          <div className="text-2xl font-display text-slate-900 mt-1">{metrics.closed}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Due Followups</div>
          <div className="text-2xl font-display text-amber-700 mt-1">{metrics.dueFollowUps}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, email, city"
            className="h-10 w-full pl-9 pr-3 rounded-xl border border-slate-300 text-sm"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
        >
          <option value="ALL">All statuses</option>
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[420px]">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-12 gap-4 p-4 border-b bg-slate-50 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <div className="col-span-3">Client</div>
              <div className="col-span-3">Contact</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Next Follow-up</div>
              <div className="col-span-2">Action</div>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center h-40 text-slate-400 gap-2">
                  <Loader className="animate-spin" size={20} /> Loading leads...
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <User size={42} className="mb-3 opacity-30" />
                  <p>No leads found for current filters</p>
                </div>
              ) : (
                filteredLeads.map((lead) => (
                  <motion.button
                    type="button"
                    key={lead._id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => openLeadDetails(lead)}
                    className={leadRowClass}
                  >
                    <div className="col-span-3 font-bold text-slate-800">
                      {lead.name}
                      <div className="text-xs text-slate-400 mt-1">{lead.city || "-"}</div>
                    </div>

                    <div className="col-span-3 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Phone size={12} /> {lead.phone}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Mail size={12} /> {lead.email || "-"}
                      </div>
                    </div>

                    <div className="col-span-2">
                      <span className={`px-2 py-1 text-xs font-bold border rounded ${getStatusColor(lead.status)}`}>
                        {lead.status || "-"}
                      </span>
                    </div>

                    <div className="col-span-2 text-sm text-slate-600">
                      {formatDate(lead.nextFollowUp)}
                    </div>

                    <div className="col-span-2">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Open <ArrowUpRight size={12} />
                      </span>
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isAddModalOpen && canAddLead && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              className="bg-white w-full max-w-md rounded-2xl border shadow-2xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-slate-900">Add New Lead</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="p-1 rounded hover:bg-slate-100">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <select
                  value={formData.inventoryId}
                  onChange={(e) => handleInventorySelection(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                >
                  <option value="">Select Inventory (optional)</option>
                  {inventoryOptions.map((inventory) => {
                    const inventoryLabel = getInventoryLeadLabel(inventory) || "Inventory Unit";
                    const inventoryLocation = String(inventory.location || "").trim();
                    return (
                      <option key={inventory._id} value={inventory._id}>
                        {inventoryLocation ? `${inventoryLabel} - ${inventoryLocation}` : inventoryLabel}
                      </option>
                    );
                  })}
                </select>

                {[
                  ["name", "Name"],
                  ["phone", "Phone"],
                  ["email", "Email"],
                  ["city", "City"],
                  ["projectInterested", "Project Interested"],
                ].map(([field, label]) => (
                  <input
                    key={field}
                    placeholder={label}
                    value={formData[field]}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [field]: e.target.value }))
                    }
                    className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  />
                ))}

                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Site Latitude (optional)"
                    value={formData.siteLat}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, siteLat: e.target.value }))
                    }
                    className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  />
                  <input
                    placeholder="Site Longitude (optional)"
                    value={formData.siteLng}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, siteLng: e.target.value }))
                    }
                    className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 h-10 rounded-lg bg-slate-100 text-slate-600 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLead}
                  disabled={savingLead}
                  className="flex-1 h-10 rounded-lg bg-slate-900 text-white font-semibold text-sm disabled:opacity-60"
                >
                  {savingLead ? "Saving..." : "Save Lead"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDetailsOpen && selectedLead && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDetails}
              className="fixed inset-0 z-50 bg-slate-900/45"
            />

            <motion.aside
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              className="fixed top-0 right-0 h-full w-full max-w-md z-50 bg-white border-l border-slate-200 shadow-2xl flex flex-col"
            >
              <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900">Lead Details</div>
                  <div className="text-[11px] text-slate-500">{selectedLead.name}</div>
                </div>
                <button onClick={closeDetails} className="p-1 rounded hover:bg-slate-100">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                  <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Contact</div>
                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <Phone size={13} />
                      {selectedLeadDialerHref ? (
                        <a
                          href={selectedLeadDialerHref}
                          className="hover:text-emerald-700 hover:underline underline-offset-2"
                        >
                          {selectedLead.phone}
                        </a>
                      ) : (
                        <span>-</span>
                      )}
                      {selectedLeadWhatsAppHref && (
                        <a
                          href={selectedLeadWhatsAppHref}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open WhatsApp chat for ${selectedLead.phone}`}
                          className="ml-1 inline-flex items-center justify-center rounded-full bg-emerald-100 p-1 text-emerald-700 hover:bg-emerald-200"
                        >
                          <WhatsAppIcon size={12} />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail size={13} />
                      {selectedLeadMailHref ? (
                        <a
                          href={selectedLeadMailHref}
                          className="hover:text-emerald-700 hover:underline underline-offset-2 break-all"
                        >
                          {selectedLead.email}
                        </a>
                      ) : (
                        <span>-</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <User size={13} />
                      {selectedLeadMapsHref ? (
                        <a
                          href={selectedLeadMapsHref}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-emerald-700 hover:underline underline-offset-2"
                        >
                          {selectedLead.city}
                        </a>
                      ) : (
                        <span>-</span>
                      )}
                    </div>
                    {selectedLeadInventoryLabel && (
                      <div className="text-xs text-slate-500 pt-1">
                        Inventory: {selectedLeadInventoryLabel}
                        {selectedLeadInventoryLocation
                          ? ` (${selectedLeadInventoryLocation})`
                          : ""}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3 space-y-3">
                  <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Lead Controls</div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Status</label>
                    <select
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value)}
                      className="mt-1 w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                    >
                      {LEAD_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
                      <CalendarClock size={12} /> Next Follow-up
                    </label>
                    <input
                      type="datetime-local"
                      value={followUpDraft}
                      onChange={(e) => setFollowUpDraft(e.target.value)}
                      className="mt-1 w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                    />
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
                      Site Location
                    </div>

                    {canConfigureSiteLocation ? (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          step="any"
                          value={siteLatDraft}
                          onChange={(e) => setSiteLatDraft(e.target.value)}
                          placeholder="Latitude"
                          className="w-full h-9 rounded-lg border border-slate-300 px-3 text-sm bg-white"
                        />
                        <input
                          type="number"
                          step="any"
                          value={siteLngDraft}
                          onChange={(e) => setSiteLngDraft(e.target.value)}
                          placeholder="Longitude"
                          className="w-full h-9 rounded-lg border border-slate-300 px-3 text-sm bg-white"
                        />
                      </div>
                    ) : (
                      <div className="text-xs text-slate-600">
                        {selectedLeadSiteLat !== null && selectedLeadSiteLng !== null
                          ? `${selectedLeadSiteLat}, ${selectedLeadSiteLng}`
                          : "Not configured by admin/manager"}
                      </div>
                    )}

                    <div className="mt-2 text-[10px] text-slate-500">
                      Site visit status is verified within {SITE_VISIT_RADIUS_METERS} meters.
                    </div>
                  </div>

                  {userRole === "FIELD_EXECUTIVE" && statusDraft === "SITE_VISIT" && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                      SITE_VISIT will be accepted only if your live location is within {SITE_VISIT_RADIUS_METERS} meters of configured site location.
                    </div>
                  )}

                  <button
                    onClick={handleUpdateLead}
                    disabled={savingUpdates}
                    className="w-full h-10 rounded-lg bg-slate-900 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {savingUpdates ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                    Save Lead Update
                  </button>
                </div>

                {canAssignLead && (
                  <div className="rounded-xl border border-slate-200 p-3 space-y-3">
                    <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Assignment</div>

                    <select
                      value={executiveDraft}
                      onChange={(e) => setExecutiveDraft(e.target.value)}
                      className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                    >
                      <option value="">Select executive</option>
                      {executives.map((executive) => (
                        <option key={executive._id} value={executive._id}>
                          {executive.name} ({executive.role})
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={handleAssignLead}
                      disabled={!executiveDraft || assigning}
                      className="w-full h-10 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold disabled:opacity-60"
                    >
                      {assigning ? "Assigning..." : "Assign Lead"}
                    </button>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">
                    Lead Diary
                  </div>

                  <textarea
                    value={diaryDraft}
                    onChange={(e) => setDiaryDraft(e.target.value)}
                    placeholder="Add conversation notes, visit details, objections, or next step context..."
                    className="w-full min-h-[84px] rounded-lg border border-slate-300 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-slate-300"
                    maxLength={2000}
                  />

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-[10px] text-slate-500">
                      {diaryDraft.length}/2000
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDiaryVoiceToggle}
                        disabled={savingDiary || !isDiaryMicSupported}
                        className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold disabled:opacity-60 inline-flex items-center gap-1"
                      >
                        {isDiaryListening ? <MicOff size={13} /> : <Mic size={13} />}
                        {isDiaryListening ? "Stop Mic" : "Voice"}
                      </button>
                      <button
                        onClick={handleAddDiary}
                        disabled={savingDiary || !diaryDraft.trim()}
                        className="h-9 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold disabled:opacity-60 inline-flex items-center gap-1"
                      >
                        {savingDiary ? <Loader size={13} className="animate-spin" /> : <Save size={13} />}
                        Add Note
                      </button>
                    </div>
                  </div>

                  {!isDiaryMicSupported && (
                    <div className="mt-2 text-[10px] text-amber-700">
                      Voice input is not supported in this browser. Use Chrome/Edge for mic dictation.
                    </div>
                  )}

                  <div className="mt-3">
                    {diaryLoading ? (
                      <div className="h-16 flex items-center justify-center text-slate-400 text-sm gap-2">
                        <Loader size={14} className="animate-spin" /> Loading diary...
                      </div>
                    ) : diaryEntries.length === 0 ? (
                      <div className="text-sm text-slate-500">No diary notes yet</div>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                        {diaryEntries.map((entry) => (
                          <div key={entry._id} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                            <div className="text-sm text-slate-800 whitespace-pre-wrap break-words">
                              {entry.note}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                              {formatDate(entry.createdAt)}
                              {entry.createdBy?.name ? ` - ${entry.createdBy.name}` : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1 mb-2">
                    <History size={12} /> Activity Timeline
                  </div>

                  {activityLoading ? (
                    <div className="h-24 flex items-center justify-center text-slate-400 text-sm gap-2">
                      <Loader size={14} className="animate-spin" /> Loading timeline...
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="text-sm text-slate-500">No activity yet</div>
                  ) : (
                    <div className="space-y-2">
                      {activities.map((activity) => (
                        <div key={activity._id} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                          <div className="text-sm text-slate-800">{activity.action}</div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            {formatDate(activity.createdAt)}
                            {activity.performedBy?.name ? ` - ${activity.performedBy.name}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeadsMatrix;
