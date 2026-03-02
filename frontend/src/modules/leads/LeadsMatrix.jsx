import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  getAllLeads,
  createLead,
  updateLeadStatus,
  assignLead,
  addLeadRelatedProperty,
  selectLeadRelatedProperty,
  removeLeadRelatedProperty,
  getLeadActivity,
  getLeadDiary,
  addLeadDiaryEntry,
} from "../../services/leadService";
import { getInventoryAssets } from "../../services/inventoryService";
import { getUsers } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  AddLeadModal,
  LeadDetailsDrawer,
  LeadsMatrixAlerts,
  LeadsMatrixFilters,
  LeadsMatrixMetrics,
  LeadsMatrixTable,
  LeadsMatrixToolbar,
} from "./components/LeadsMatrixSections";

const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "SITE_VISIT",
  "CLOSED",
  "LOST",
];

const EXECUTIVE_ROLES = ["EXECUTIVE", "FIELD_EXECUTIVE"];
const MANAGEMENT_ROLES = ["MANAGER", "ASSISTANT_MANAGER", "TEAM_LEADER"];
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

const toObjectIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
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
  const navigate = useNavigate();
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
  const [linkingProperty, setLinkingProperty] = useState(false);
  const [propertyActionInventoryId, setPropertyActionInventoryId] = useState("");
  const [propertyActionType, setPropertyActionType] = useState("");

  const [statusDraft, setStatusDraft] = useState("NEW");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [executiveDraft, setExecutiveDraft] = useState("");
  const [siteLatDraft, setSiteLatDraft] = useState("");
  const [siteLngDraft, setSiteLngDraft] = useState("");
  const [relatedInventoryDraft, setRelatedInventoryDraft] = useState("");

  const [executives, setExecutives] = useState([]);
  const diaryRecognitionRef = useRef(null);

  const userRole = localStorage.getItem("role") || "";
  const canAddLead = userRole === "ADMIN" || MANAGEMENT_ROLES.includes(userRole);
  const canAssignLead = userRole === "ADMIN" || MANAGEMENT_ROLES.includes(userRole);
  const canManageLeadProperties = userRole !== "CHANNEL_PARTNER";
  const canConfigureSiteLocation =
    userRole === "ADMIN" || MANAGEMENT_ROLES.includes(userRole);

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
    if (!canManageLeadProperties) return;

    try {
      const rows = await getInventoryAssets();
      setInventoryOptions(Array.isArray(rows) ? rows : []);
    } catch (fetchError) {
      const message = toErrorMessage(fetchError, "Failed to load inventory");
      console.error(`Load inventory for leads failed: ${message}`);
      setInventoryOptions([]);
    }
  }, [canManageLeadProperties]);

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
    if (!selectedLead) {
      if (relatedInventoryDraft !== "") {
        setRelatedInventoryDraft("");
      }
      return;
    }

    const linkedIds = new Set(
      getLeadRelatedInventories(selectedLead).map((row) => toObjectIdString(row)),
    );
    const available = inventoryOptions.filter(
      (inventory) => !linkedIds.has(String(inventory?._id || "")),
    );

    const draftExists = available.some(
      (inventory) => String(inventory?._id || "") === String(relatedInventoryDraft || ""),
    );

    if (!draftExists && relatedInventoryDraft !== "") {
      setRelatedInventoryDraft("");
    }
  }, [selectedLead, inventoryOptions, relatedInventoryDraft]);

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
      } catch {
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
      const relatedInventorySearchValue = getLeadRelatedInventories(lead)
        .map((inventory) => {
          const inventoryLabel = getInventoryLeadLabel(inventory);
          const inventoryLocation = String(inventory?.location || "").trim();
          return `${inventoryLabel} ${inventoryLocation}`.trim();
        })
        .join(" ");

      const searchMatch =
        !normalized ||
        [
          lead.name,
          lead.phone,
          lead.email,
          lead.city,
          lead.projectInterested,
          relatedInventorySearchValue,
        ]
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
    setRelatedInventoryDraft("");
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
      } catch {
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
    setRelatedInventoryDraft("");
  };

  const applyUpdatedLeadState = (updatedLead) => {
    if (!updatedLead) return;

    setLeads((prev) =>
      prev.map((lead) => (lead._id === updatedLead._id ? updatedLead : lead)),
    );
    setSelectedLead(updatedLead);

    const nextSiteLat = toCoordinateNumber(updatedLead?.siteLocation?.lat);
    const nextSiteLng = toCoordinateNumber(updatedLead?.siteLocation?.lng);
    setSiteLatDraft(nextSiteLat === null ? "" : String(nextSiteLat));
    setSiteLngDraft(nextSiteLng === null ? "" : String(nextSiteLng));
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

  const handleLinkPropertyToLead = async (inventoryIdOverride = "") => {
    const inventoryId = String(inventoryIdOverride || relatedInventoryDraft || "").trim();
    if (!selectedLead || !inventoryId) return;

    try {
      setLinkingProperty(true);
      setError("");

      const updatedLead = await addLeadRelatedProperty(
        selectedLead._id,
        inventoryId,
      );

      if (!updatedLead) {
        await fetchLeads(true);
        setSuccess("Property linked");
        return;
      }

      applyUpdatedLeadState(updatedLead);
      setRelatedInventoryDraft("");
      setSuccess("Property linked");
    } catch (linkError) {
      const message = toErrorMessage(linkError, "Failed to link property");
      console.error(`Link property failed: ${message}`);
      setError(message);
    } finally {
      setLinkingProperty(false);
    }
  };

  const handleSelectRelatedProperty = async (
    inventoryId,
    options = {},
  ) => {
    const resolvedInventoryId = String(inventoryId || "").trim();
    if (!selectedLead || !resolvedInventoryId) return false;
    const { showSuccess = true } = options;

    try {
      setPropertyActionType("select");
      setPropertyActionInventoryId(resolvedInventoryId);
      setError("");

      const updatedLead = await selectLeadRelatedProperty(
        selectedLead._id,
        resolvedInventoryId,
      );

      if (!updatedLead) {
        await fetchLeads(true);
        if (showSuccess) {
          setSuccess("Property selected");
        }
        return false;
      }

      applyUpdatedLeadState(updatedLead);
      if (showSuccess) {
        setSuccess("Property selected");
      }
      return true;
    } catch (selectError) {
      const message = toErrorMessage(selectError, "Failed to select property");
      console.error(`Select related property failed: ${message}`);
      setError(message);
      return false;
    } finally {
      setPropertyActionType("");
      setPropertyActionInventoryId("");
    }
  };

  const handleOpenRelatedProperty = async (inventoryId) => {
    const resolvedInventoryId = String(inventoryId || "").trim();
    if (!resolvedInventoryId) return;

    await handleSelectRelatedProperty(resolvedInventoryId, {
      showSuccess: false,
    });

    navigate(`/inventory/${resolvedInventoryId}`);
  };

  const handleRemoveRelatedProperty = async (inventoryId) => {
    const resolvedInventoryId = String(inventoryId || "").trim();
    if (!selectedLead || !resolvedInventoryId) return;

    const confirmed = window.confirm("Remove this property from lead?");
    if (!confirmed) return;

    try {
      setPropertyActionType("remove");
      setPropertyActionInventoryId(resolvedInventoryId);
      setError("");

      const updatedLead = await removeLeadRelatedProperty(
        selectedLead._id,
        resolvedInventoryId,
      );

      if (!updatedLead) {
        await fetchLeads(true);
        setSuccess("Property removed");
        return;
      }

      applyUpdatedLeadState(updatedLead);
      setRelatedInventoryDraft("");
      setSuccess("Property removed");
    } catch (removeError) {
      const message = toErrorMessage(removeError, "Failed to remove property");
      console.error(`Remove related property failed: ${message}`);
      setError(message);
    } finally {
      setPropertyActionType("");
      setPropertyActionInventoryId("");
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
    } catch {
      setError("Unable to start microphone. Try again.");
    }
  };

  const selectedLeadDialerHref = getDialerHref(selectedLead?.phone);
  const selectedLeadWhatsAppHref = getWhatsAppHref(selectedLead?.phone);
  const selectedLeadMailHref = getMailHref(selectedLead?.email);
  const selectedLeadMapsHref = getMapsHref(selectedLead?.city);
  const selectedLeadSiteLat = toCoordinateNumber(selectedLead?.siteLocation?.lat);
  const selectedLeadSiteLng = toCoordinateNumber(selectedLead?.siteLocation?.lng);
  const selectedLeadRelatedInventories = getLeadRelatedInventories(selectedLead);
  const selectedLeadActiveInventoryId = toObjectIdString(selectedLead?.inventoryId);
  const selectedLeadRelatedInventoryIds = new Set(
    selectedLeadRelatedInventories.map((row) => toObjectIdString(row)),
  );
  const availableRelatedInventoryOptions = inventoryOptions.filter(
    (inventory) => !selectedLeadRelatedInventoryIds.has(String(inventory?._id || "")),
  );

  return (
    <div className="w-full h-full px-4 sm:px-6 lg:px-10 pt-20 md:pt-24 pb-6 flex flex-col bg-slate-50/50 overflow-y-auto custom-scrollbar">
      <LeadsMatrixToolbar
        refreshing={refreshing}
        canAddLead={canAddLead}
        onRefresh={() => fetchLeads(true)}
        onOpenAddModal={() => setIsAddModalOpen(true)}
      />

      <LeadsMatrixAlerts error={error} success={success} />

      <LeadsMatrixMetrics metrics={metrics} />

      <LeadsMatrixFilters
        query={query}
        onQueryChange={setQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        leadStatuses={LEAD_STATUSES}
      />

      <LeadsMatrixTable
        loading={loading}
        filteredLeads={filteredLeads}
        onOpenLeadDetails={openLeadDetails}
        leadRowClass={leadRowClass}
        getStatusColor={getStatusColor}
        formatDate={formatDate}
      />

      <AnimatePresence>
        {isAddModalOpen && canAddLead && (
          <AddLeadModal
            formData={formData}
            setFormData={setFormData}
            inventoryOptions={inventoryOptions}
            getInventoryLeadLabel={getInventoryLeadLabel}
            onInventorySelection={handleInventorySelection}
            onClose={() => setIsAddModalOpen(false)}
            onSave={handleSaveLead}
            savingLead={savingLead}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDetailsOpen && selectedLead && (
          <LeadDetailsDrawer
            selectedLead={selectedLead}
            onClose={closeDetails}
            selectedLeadDialerHref={selectedLeadDialerHref}
            selectedLeadWhatsAppHref={selectedLeadWhatsAppHref}
            selectedLeadMailHref={selectedLeadMailHref}
            selectedLeadMapsHref={selectedLeadMapsHref}
            selectedLeadRelatedInventories={selectedLeadRelatedInventories}
            selectedLeadActiveInventoryId={selectedLeadActiveInventoryId}
            propertyActionType={propertyActionType}
            propertyActionInventoryId={propertyActionInventoryId}
            canManageLeadProperties={canManageLeadProperties}
            onSelectRelatedProperty={handleSelectRelatedProperty}
            onOpenRelatedProperty={handleOpenRelatedProperty}
            onRemoveRelatedProperty={handleRemoveRelatedProperty}
            availableRelatedInventoryOptions={availableRelatedInventoryOptions}
            relatedInventoryDraft={relatedInventoryDraft}
            setRelatedInventoryDraft={setRelatedInventoryDraft}
            linkingProperty={linkingProperty}
            onLinkPropertyToLead={handleLinkPropertyToLead}
            leadStatuses={LEAD_STATUSES}
            statusDraft={statusDraft}
            setStatusDraft={setStatusDraft}
            followUpDraft={followUpDraft}
            setFollowUpDraft={setFollowUpDraft}
            siteLatDraft={siteLatDraft}
            setSiteLatDraft={setSiteLatDraft}
            siteLngDraft={siteLngDraft}
            setSiteLngDraft={setSiteLngDraft}
            canConfigureSiteLocation={canConfigureSiteLocation}
            selectedLeadSiteLat={selectedLeadSiteLat}
            selectedLeadSiteLng={selectedLeadSiteLng}
            siteVisitRadiusMeters={SITE_VISIT_RADIUS_METERS}
            userRole={userRole}
            onUpdateLead={handleUpdateLead}
            savingUpdates={savingUpdates}
            canAssignLead={canAssignLead}
            executiveDraft={executiveDraft}
            setExecutiveDraft={setExecutiveDraft}
            executives={executives}
            onAssignLead={handleAssignLead}
            assigning={assigning}
            diaryDraft={diaryDraft}
            setDiaryDraft={setDiaryDraft}
            onDiaryVoiceToggle={handleDiaryVoiceToggle}
            savingDiary={savingDiary}
            isDiaryMicSupported={isDiaryMicSupported}
            isDiaryListening={isDiaryListening}
            onAddDiary={handleAddDiary}
            diaryLoading={diaryLoading}
            diaryEntries={diaryEntries}
            activityLoading={activityLoading}
            activities={activities}
            formatDate={formatDate}
            getInventoryLeadLabel={getInventoryLeadLabel}
            toObjectIdString={toObjectIdString}
            WhatsAppIcon={WhatsAppIcon}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeadsMatrix;

