import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Home,
  Pencil,
  X,
  Loader,
  Image as ImageIcon,
  UploadCloud,
  Trash2,
  AlertCircle,
  Share2,
} from "lucide-react";
import {
  getInventoryAssets,
  createInventoryAsset,
  createInventoryCreateRequest,
  updateInventoryAsset,
  deleteInventoryAsset,
  requestInventoryStatusChange,
  requestInventoryUpdateChange,
  getPendingInventoryRequests,
  approveInventoryRequest,
  rejectInventoryRequest,
} from "../../services/inventoryService";
import { getAllLeads } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  AssetVaultFilters,
  AssetVaultToolbar,
  PendingInventoryRequestsPanel,
} from "./components/AssetVaultSections";

const STATUS_OPTIONS = ["Available", "Reserved", "Sold"];
const STATUS_UPDATE_OPTIONS = [
  { label: "Available", value: "Available" },
  { label: "Reserved", value: "Blocked" },
  { label: "Sold", value: "Sold" },
];
const SOLD_PAYMENT_MODE_OPTIONS = [
  { value: "UPI", label: "UPI" },
  { value: "CASH", label: "Cash" },
  { value: "CHECK", label: "Check / Cheque" },
  { value: "NET_BANKING_NEFTRTGSIMPS", label: "Net Banking (NEFT/RTGS/IMPS)" },
];
const SOLD_PAYMENT_TYPE_OPTIONS = [
  { value: "FULL", label: "Full Payment" },
  { value: "PARTIAL", label: "Partial Payment" },
];
const GEOCODING_SEARCH_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const LOCATION_SUGGESTION_LIMIT = 6;
const GOOGLE_MAPS_SCRIPT_ID = "samvid-google-maps-places-script";
let googleMapsScriptPromise = null;

const loadGoogleMapsPlacesScript = (apiKey) => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps is unavailable"));
  }

  if (window.google?.maps?.places) {
    return Promise.resolve(window.google);
  }

  if (googleMapsScriptPromise) {
    return googleMapsScriptPromise;
  }

  googleMapsScriptPromise = new Promise((resolve, reject) => {
    const rejectWithReset = (message) => {
      googleMapsScriptPromise = null;
      reject(new Error(message));
    };

    const handleLoad = () => {
      if (window.google?.maps?.places) {
        resolve(window.google);
      } else {
        rejectWithReset("Google Maps Places library failed to load");
      }
    };

    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
    const script = existingScript || document.createElement("script");

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", () => rejectWithReset("Google Maps script failed to load"), {
      once: true,
    });

    if (!existingScript) {
      const params = new URLSearchParams({
        key: apiKey,
        libraries: "places",
        v: "weekly",
      });

      script.id = GOOGLE_MAPS_SCRIPT_ID;
      script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else if (window.google?.maps) {
      handleLoad();
    }
  });

  return googleMapsScriptPromise;
};

const toApiStatus = (status) => {
  if (status === "Reserved") return "Blocked";
  return status;
};

const isReservedStatusValue = (status) => toApiStatus(status) === "Blocked";
const isSoldStatusValue = (status) => toApiStatus(status) === "Sold";
const isNonCashPaymentMode = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return Boolean(normalized) && normalized !== "CASH";
};

const DEFAULT_FORM = {
  propertyId: "",
  title: "",
  inventoryType: "COMMERCIAL",
  location: "",
  city: "",
  area: "",
  pincode: "",
  buildingName: "",
  floorNumber: "",
  totalFloors: "",
  totalArea: "",
  carpetArea: "",
  builtUpArea: "",
  areaUnit: "SQ_FT",
  maintenanceCharges: "",
  deposit: "",
  furnishingStatus: "",
  locationLat: "",
  locationLng: "",
  price: "",
  type: "Sale",
  category: "Office",
  status: "Available",
  officeType: "",
  commercialTotalCabins: "",
  commercialWorkstations: "",
  commercialSeats: "",
  commercialConferenceRooms: "",
  commercialMeetingRooms: "",
  commercialReceptionArea: false,
  commercialWaitingArea: false,
  commercialPantry: false,
  commercialCafeteria: false,
  commercialWashroomType: "",
  commercialServerRoom: false,
  commercialStorageRoom: false,
  commercialBreakoutArea: false,
  commercialLiftAvailable: false,
  commercialPowerBackup: false,
  commercialCentralAC: false,
  commercialBuildingTotalFloors: "",
  commercialParkingType: "",
  commercialParkingSlots: "",
  commercialSecurityType: "",
  commercialFireSafety: false,
  commercialReadyToMove: false,
  commercialUnderConstruction: false,
  commercialAvailableFrom: "",
  residentialPropertyType: "",
  residentialBhkType: "",
  residentialBedrooms: "",
  residentialBathrooms: "",
  residentialBalcony: "",
  residentialStudyRoom: false,
  residentialServantRoom: false,
  residentialParking: "",
  residentialModularKitchen: false,
  residentialLift: false,
  residentialSecurity: false,
  residentialPowerBackup: false,
  residentialGym: false,
  residentialSwimmingPool: false,
  residentialClubhouse: false,
  residentialWaterSupply: "",
  residentialElectricityBackup: false,
  residentialGasPipeline: false,
  reservationReason: "",
  saleLeadId: "",
  salePaymentMode: "",
  salePaymentType: "",
  saleTotalAmount: "",
  saleRemainingAmount: "",
  salePaymentReference: "",
  saleNote: "",
  images: [],
  floorPlans: [],
  videoTours: [],
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseRangeInput = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const [minRaw, maxRaw] = raw.split("-").map((part) => part.trim());
  const min = Number(minRaw);
  const max = Number(maxRaw);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
};

const parseBooleanInput = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return null;
};

const listToTextareaValue = (value) =>
  Array.isArray(value) ? value.join("\n") : "";

const parseTextareaList = (value) => {
  const tokens = String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(tokens)];
};

const normalizeToken = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

const hasAmenity = (asset, amenityToken) => {
  const c = asset?.commercialDetails || {};
  const r = asset?.residentialDetails || {};
  const cAmenities = c.amenities || {};
  const cBuilding = c.buildingDetails || {};
  const rAmenities = r.amenities || {};
  const rUtilities = r.utilities || {};

  if (amenityToken === "PANTRY") return Boolean(cAmenities.pantry);
  if (amenityToken === "LIFT") return Boolean(cAmenities.liftAvailable || rAmenities.lift);
  if (amenityToken === "SECURITY") {
    return Boolean(
      rAmenities.security
      || ["SECURITY_24X7", "CCTV", "BOTH"].includes(String(cBuilding.securityType || "").toUpperCase()),
    );
  }
  if (amenityToken === "POWER_BACKUP" || amenityToken === "POWERBACKUP") {
    return Boolean(cAmenities.powerBackup || rAmenities.powerBackup);
  }
  if (amenityToken === "GYM") return Boolean(rAmenities.gym);
  if (amenityToken === "SWIMMING_POOL" || amenityToken === "SWIMMINGPOOL") return Boolean(rAmenities.swimmingPool);
  if (amenityToken === "CLUBHOUSE") return Boolean(rAmenities.clubhouse);
  if (amenityToken === "MODULAR_KITCHEN" || amenityToken === "MODULARKITCHEN") {
    return Boolean(rAmenities.modularKitchen);
  }
  if (amenityToken === "GAS_PIPELINE" || amenityToken === "GASPIPELINE") {
    return Boolean(rUtilities.gasPipeline);
  }
  return false;
};

const statusPillClass = (status) => {
  if (status === "Available") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "Reserved") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "Sold") {
    return "bg-slate-900 text-white";
  }

  if (status === "Rented") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-slate-100 text-slate-600";
};

const formatPrice = (asset) => {
  const value = Number(asset.price) || 0;

  if (asset.type === "Rent") {
    return `Rs ${value.toLocaleString("en-IN")}/mo`;
  }

  return `Rs ${value.toLocaleString("en-IN")}`;
};

const formatCurrency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return `Rs ${parsed.toLocaleString("en-IN")}`;
};

const formatSoldPaymentModeLabel = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return "-";
  if (normalized === "NET_BANKING_NEFTRTGSIMPS") return "Net Banking (NEFT/RTGS/IMPS)";
  if (normalized === "CHECK") return "Check / Cheque";
  return normalized;
};

const formatSoldPaymentTypeLabel = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "FULL") return "Full Payment";
  if (normalized === "PARTIAL") return "Partial Payment";
  return normalized || "-";
};

const formatSoldLeadLabel = (value) => {
  if (!value) return "-";
  if (typeof value === "string") return value;

  const name = String(value?.name || "").trim();
  const phone = String(value?.phone || "").trim();
  if (name && phone) return `${name} (${phone})`;
  if (name) return name;

  const id = String(value?._id || "").trim();
  return id || "-";
};

const toSharePayload = (asset) => {
  if (!asset?._id) return null;
  const firstImage = Array.isArray(asset.images) ? asset.images[0] || "" : "";

  return {
    inventoryId: asset._id,
    title: asset.title || "",
    location: asset.location || "",
    price: Number(asset.price) || 0,
    status: asset.status || "",
    image: firstImage,
  };
};

const getInventoryUnitLabel = (inventoryLike = {}) =>
  [inventoryLike.projectName, inventoryLike.towerName, inventoryLike.unitNumber]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" - ") || "Inventory Unit";

const getAssetTitle = (asset = {}) => {
  const explicitTitle = String(asset?.title || "").trim();
  if (explicitTitle) return explicitTitle;
  return getInventoryUnitLabel(asset);
};

const REQUEST_FIELD_LABELS = {
  propertyId: "Property ID",
  inventoryType: "Inventory Type",
  projectName: "Project",
  towerName: "Tower",
  unitNumber: "Unit",
  price: "Price",
  type: "Transaction Type",
  category: "Category",
  furnishingStatus: "Furnishing",
  status: "Status",
  reservationReason: "Reservation Reason",
  saleDetails: "Sold Details",
  location: "Location",
  city: "City",
  area: "Area",
  pincode: "Pincode",
  buildingName: "Building",
  floorNumber: "Floor",
  totalFloors: "Total Floors",
  totalArea: "Total Area",
  carpetArea: "Carpet Area",
  builtUpArea: "Built-up Area",
  areaUnit: "Area Unit",
  maintenanceCharges: "Maintenance",
  deposit: "Deposit",
  commercialDetails: "Commercial Details",
  residentialDetails: "Residential Details",
  siteLocation: "Coordinates",
  images: "Images",
  documents: "Documents",
  floorPlans: "Floor Plans",
  videoTours: "Video Tours",
};

const CREATE_REQUEST_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "ASSISTANT_MANAGER",
  "TEAM_LEADER",
  "EXECUTIVE",
  "FIELD_EXECUTIVE",
  "CHANNEL_PARTNER",
]);

const UPDATE_STATUS_REQUEST_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "ASSISTANT_MANAGER",
  "TEAM_LEADER",
  "EXECUTIVE",
  "FIELD_EXECUTIVE",
]);

const toCoordinateNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toSiteLocationPayload = ({ lat, lng }) => {
  const parsedLat = toCoordinateNumber(lat);
  const parsedLng = toCoordinateNumber(lng);
  const hasAnyCoordinate = parsedLat !== null || parsedLng !== null;

  if (!hasAnyCoordinate) {
    return { value: null };
  }

  if (parsedLat === null || parsedLng === null) {
    return { error: "Enter both latitude and longitude, or leave both empty" };
  }

  if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
    return { error: "Invalid latitude/longitude range" };
  }

  return {
    value: {
      lat: parsedLat,
      lng: parsedLng,
    },
  };
};

const formatRequestValue = (key, value) => {
  if (key === "price" || key === "maintenanceCharges" || key === "deposit") {
    return formatCurrency(value);
  }
  if (key === "siteLocation") {
    const lat = toCoordinateNumber(value?.lat);
    const lng = toCoordinateNumber(value?.lng);
    return lat !== null && lng !== null ? `${lat}, ${lng}` : "-";
  }
  if (key === "saleDetails") {
    const leadText = formatSoldLeadLabel(value?.leadId);
    const modeText = formatSoldPaymentModeLabel(value?.paymentMode);
    const typeText = formatSoldPaymentTypeLabel(value?.paymentType);
    const totalText = formatCurrency(value?.totalAmount);
    const remainingText =
      String(value?.paymentType || "").toUpperCase() === "PARTIAL"
        ? formatCurrency(value?.remainingAmount)
        : formatCurrency(0);
    return `${leadText} | ${modeText} | ${typeText} | Total: ${totalText} | Remaining: ${remainingText}`;
  }
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const AssetVault = () => {
  const navigate = useNavigate();
  const locationProvider = String(import.meta.env.VITE_LOCATION_PROVIDER || "osm")
    .trim()
    .toLowerCase();
  const googleMapsApiKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
  const googlePlacesCountry = String(import.meta.env.VITE_GOOGLE_MAPS_PLACES_COUNTRY || "in")
    .trim()
    .toLowerCase();
  const useGooglePlaces = locationProvider === "google" && Boolean(googleMapsApiKey);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState("");
  const [modeType, setModeType] = useState("sale");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [updatingStatusId, setUpdatingStatusId] = useState("");
  const [requestingStatusId, setRequestingStatusId] = useState("");
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [reserveMode, setReserveMode] = useState("direct");
  const [reserveAssetId, setReserveAssetId] = useState("");
  const [reserveLeadId, setReserveLeadId] = useState("");
  const [reserveReason, setReserveReason] = useState("");
  const [reserveSubmitting, setReserveSubmitting] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [reviewingRequestId, setReviewingRequestId] = useState("");
  const [leadOptions, setLeadOptions] = useState([]);
  const [loadingLeadOptions, setLoadingLeadOptions] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState("all");
  const [furnishingFilter, setFurnishingFilter] = useState("");
  const [bhkFilter, setBhkFilter] = useState("");
  const [cabinsFilter, setCabinsFilter] = useState("");
  const [seatsFilter, setSeatsFilter] = useState("");
  const [areaRangeFilter, setAreaRangeFilter] = useState("");
  const [budgetRangeFilter, setBudgetRangeFilter] = useState("");
  const [floorFilter, setFloorFilter] = useState("");
  const [parkingFilter, setParkingFilter] = useState("");
  const [pantryFilter, setPantryFilter] = useState("");
  const [amenitiesFilter, setAmenitiesFilter] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [loadingLocationSuggestions, setLoadingLocationSuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [googlePlacesReady, setGooglePlacesReady] = useState(
    Boolean(useGooglePlaces && typeof window !== "undefined" && window.google?.maps?.places),
  );
  const [locationBaseline, setLocationBaseline] = useState({
    location: "",
    locationLat: "",
    locationLng: "",
  });
  const locationSuggestionFetchIdRef = useRef(0);
  const googleAutocompleteServiceRef = useRef(null);
  const googleGeocoderRef = useRef(null);

  const role = String(localStorage.getItem("role") || "").trim().toUpperCase();
  const canManage = role === "ADMIN";
  const canRequestCreate = CREATE_REQUEST_ROLES.has(role);
  const canOpenCreateModal = canManage || canRequestCreate;
  const canRequestEdit = UPDATE_STATUS_REQUEST_ROLES.has(role);
  const canOpenEditModal = canManage || canRequestEdit;
  const canRequestStatusChange = UPDATE_STATUS_REQUEST_ROLES.has(role);
  const reserveTargetAsset = useMemo(
    () => assets.find((asset) => String(asset?._id || "") === String(reserveAssetId || "")) || null,
    [assets, reserveAssetId],
  );

  const sortedLeadOptions = useMemo(
    () =>
      [...leadOptions].sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || ""), "en", { sensitivity: "base" })),
    [leadOptions],
  );

  const closeReserveModal = useCallback(() => {
    setIsReserveModalOpen(false);
    setReserveMode("direct");
    setReserveAssetId("");
    setReserveLeadId("");
    setReserveReason("");
    setReserveSubmitting(false);
  }, []);

  const openReserveModal = useCallback((assetId, mode = "direct") => {
    const targetAsset = assets.find((asset) => String(asset?._id || "") === String(assetId || ""));
    if (!targetAsset) return;

    const existingLeadId = String(
      targetAsset?.reservationLeadId?._id
      || targetAsset?.reservationLeadId
      || targetAsset?.reservationLead?._id
      || "",
    ).trim();

    setReserveMode(mode === "request" ? "request" : "direct");
    setReserveAssetId(String(assetId || ""));
    setReserveLeadId(existingLeadId);
    setReserveReason(String(targetAsset?.reservationReason || "").trim());
    setIsReserveModalOpen(true);
  }, [assets]);

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [list, requests] = await Promise.all([
        getInventoryAssets(),
        canManage ? getPendingInventoryRequests() : Promise.resolve([]),
      ]);

      setAssets(Array.isArray(list) ? list : []);
      setPendingRequests(Array.isArray(requests) ? requests : []);
    } catch (fetchError) {
      console.error(`Error loading inventory: ${toErrorMessage(fetchError, "Unknown error")}`);
      setAssets([]);
      setPendingRequests([]);
      setError(toErrorMessage(fetchError, "Failed to load inventory"));
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  useEffect(() => {
    if (!canOpenEditModal) {
      setLeadOptions([]);
      setLoadingLeadOptions(false);
      return undefined;
    }

    let cancelled = false;

    const loadLeadOptions = async () => {
      try {
        setLoadingLeadOptions(true);
        const rows = await getAllLeads();
        if (cancelled) return;

        const options = Array.isArray(rows)
          ? rows
            .map((lead) => ({
              _id: String(lead?._id || "").trim(),
              name: String(lead?.name || "").trim(),
              phone: String(lead?.phone || "").trim(),
              status: String(lead?.status || "").trim(),
              projectInterested: String(lead?.projectInterested || "").trim(),
            }))
            .filter((lead) => lead._id)
          : [];

        setLeadOptions(options);
      } catch {
        if (!cancelled) {
          setLeadOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingLeadOptions(false);
        }
      }
    };

    loadLeadOptions();

    return () => {
      cancelled = true;
    };
  }, [canOpenEditModal]);

  useEffect(() => {
    if (!useGooglePlaces || !(isAddModalOpen || isEditModalOpen)) {
      googleAutocompleteServiceRef.current = null;
      googleGeocoderRef.current = null;
      setGooglePlacesReady(false);
      return undefined;
    }

    let cancelled = false;

    loadGoogleMapsPlacesScript(googleMapsApiKey)
      .then((google) => {
        if (cancelled) return;
        googleAutocompleteServiceRef.current = new google.maps.places.AutocompleteService();
        googleGeocoderRef.current = new google.maps.Geocoder();
        setGooglePlacesReady(true);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error(`Google Places init failed: ${toErrorMessage(loadError, "Unknown error")}`);
        setGooglePlacesReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [googleMapsApiKey, isAddModalOpen, isEditModalOpen, useGooglePlaces]);

  const filteredAssets = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const areaRange = parseRangeInput(areaRangeFilter);
    const budgetRange = parseRangeInput(budgetRangeFilter);
    const minCabins = toNumberOrNull(cabinsFilter);
    const minSeats = toNumberOrNull(seatsFilter);
    const minFloor = toNumberOrNull(floorFilter);
    const parkingAvailable = parseBooleanInput(parkingFilter);
    const pantryAvailable = parseBooleanInput(pantryFilter);
    const amenityTokens = String(amenitiesFilter || "")
      .split(",")
      .map((item) => normalizeToken(item))
      .filter(Boolean);

    return assets.filter((asset) => {
      const typeMatch = modeType === "sale" ? asset.type === "Sale" : asset.type === "Rent";
      const statusMatch = statusFilter === "all" ? true : asset.status === statusFilter;
      const inventoryTypeMatch = inventoryTypeFilter === "all"
        ? true
        : String(asset.inventoryType || "").toUpperCase() === inventoryTypeFilter;

      const searchMatch =
        !normalizedSearch ||
        [
          getAssetTitle(asset),
          asset.location,
          asset.category,
          asset.propertyId,
          asset.city,
          asset.area,
          asset.pincode,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(normalizedSearch),
        );

      const furnishingMatch = furnishingFilter
        ? normalizeToken(asset.furnishingStatus) === normalizeToken(furnishingFilter)
        : true;

      const bhkMatch = bhkFilter
        ? normalizeToken(asset?.residentialDetails?.bhkType) === normalizeToken(bhkFilter)
        : true;

      const cabinsValue = toNumberOrNull(asset?.commercialDetails?.officeLayout?.totalCabins);
      const cabinsMatch = minCabins === null
        ? true
        : (cabinsValue !== null && cabinsValue >= minCabins);

      const seatsValue = toNumberOrNull(
        asset?.commercialDetails?.officeLayout?.seats
          ?? asset?.commercialDetails?.officeLayout?.workstations,
      );
      const seatsMatch = minSeats === null
        ? true
        : (seatsValue !== null && seatsValue >= minSeats);

      const totalAreaValue = toNumberOrNull(asset.totalArea);
      const areaMatch = areaRange
        ? (totalAreaValue !== null && totalAreaValue >= areaRange.min && totalAreaValue <= areaRange.max)
        : true;

      const priceValue = toNumberOrNull(asset.price);
      const budgetMatch = budgetRange
        ? (priceValue !== null && priceValue >= budgetRange.min && priceValue <= budgetRange.max)
        : true;

      const floorNumberValue = toNumberOrNull(asset.floorNumber);
      const floorMatch = minFloor === null
        ? true
        : (floorNumberValue !== null && floorNumberValue >= minFloor);

      const parkingSlotsValue = toNumberOrNull(
        asset?.commercialDetails?.buildingDetails?.parkingSlots
          ?? asset?.residentialDetails?.parking,
      );
      const parkingMatch = parkingAvailable === null
        ? true
        : parkingAvailable
          ? (parkingSlotsValue !== null && parkingSlotsValue >= 1)
          : (parkingSlotsValue === null || parkingSlotsValue <= 0);

      const pantryMatch = pantryAvailable === null
        ? true
        : Boolean(asset?.commercialDetails?.amenities?.pantry) === pantryAvailable;

      const amenitiesMatch = amenityTokens.every((token) => hasAmenity(asset, token));

      return (
        typeMatch
        && statusMatch
        && inventoryTypeMatch
        && searchMatch
        && furnishingMatch
        && bhkMatch
        && cabinsMatch
        && seatsMatch
        && areaMatch
        && budgetMatch
        && floorMatch
        && parkingMatch
        && pantryMatch
        && amenitiesMatch
      );
    });
  }, [
    amenitiesFilter,
    areaRangeFilter,
    assets,
    bhkFilter,
    budgetRangeFilter,
    cabinsFilter,
    floorFilter,
    furnishingFilter,
    inventoryTypeFilter,
    modeType,
    pantryFilter,
    parkingFilter,
    searchTerm,
    seatsFilter,
    statusFilter,
  ]);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    const newImageUrls = [];

    try {
      for (const file of files) {
        const data = new FormData();
        data.append("file", file);
        data.append("upload_preset", "samvid_upload");
        data.append("cloud_name", "djfiq8kiy");

        const res = await fetch("https://api.cloudinary.com/v1_1/djfiq8kiy/image/upload", {
          method: "POST",
          body: data,
        });

        const cloudData = await res.json();
        if (cloudData.secure_url) {
          newImageUrls.push(cloudData.secure_url);
        }
      }

      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...newImageUrls],
      }));
    } catch (uploadError) {
      console.error(`Upload Error: ${toErrorMessage(uploadError, "Unknown error")}`);
      setError("Error uploading one or more images");
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const removeImage = (urlToRemove) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((url) => url !== urlToRemove),
    }));
  };

  const clearLocationSuggestionState = () => {
    locationSuggestionFetchIdRef.current += 1;
    setLocationSuggestions([]);
    setLoadingLocationSuggestions(false);
    setShowLocationSuggestions(false);
  };

  const resetForm = () => {
    setFormData({ ...DEFAULT_FORM });
    clearLocationSuggestionState();
    setLocationBaseline({
      location: "",
      locationLat: "",
      locationLng: "",
    });
  };

  const closeFormModal = () => {
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
    setEditingAssetId("");
    resetForm();
  };

  const openAddModal = () => {
    setError("");
    setSuccess("");
    setIsEditModalOpen(false);
    setEditingAssetId("");
    resetForm();
    setIsAddModalOpen(true);
  };

  const lookupCoordinatesByLocation = useCallback(async (rawLocation) => {
    const query = String(rawLocation || "").trim();
    if (!query) return null;

    const searchUrl = new URL(GEOCODING_SEARCH_ENDPOINT);
    searchUrl.search = new URLSearchParams({
      format: "jsonv2",
      q: query,
      limit: "1",
      addressdetails: "0",
      countrycodes: "in",
    }).toString();

    const response = await fetch(searchUrl.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Location lookup failed");
    }

    const rows = await response.json();
    const first = Array.isArray(rows) ? rows[0] : null;
    const lat = toCoordinateNumber(first?.lat);
    const lng = toCoordinateNumber(first?.lon);

    if (lat === null || lng === null) {
      return null;
    }

    return {
      query,
      lat,
      lng,
    };
  }, []);

  const lookupLocationSuggestions = useCallback(async (rawLocation) => {
    const query = String(rawLocation || "").trim();
    if (!query) return [];

    const searchUrl = new URL(GEOCODING_SEARCH_ENDPOINT);
    searchUrl.search = new URLSearchParams({
      format: "jsonv2",
      q: query,
      limit: String(LOCATION_SUGGESTION_LIMIT),
      addressdetails: "1",
      countrycodes: "in",
    }).toString();

    const response = await fetch(searchUrl.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Location suggestions lookup failed");
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) return [];

    const seen = new Set();
    return rows
      .map((row) => {
        const label = String(row?.display_name || row?.name || "").trim();
        const lat = toCoordinateNumber(row?.lat);
        const lng = toCoordinateNumber(row?.lon);

        if (!label || lat === null || lng === null) {
          return null;
        }

        const dedupeKey = `${label}:${lat}:${lng}`;
        if (seen.has(dedupeKey)) {
          return null;
        }

        seen.add(dedupeKey);
        return {
          id: String(row?.place_id || dedupeKey),
          label,
          lat,
          lng,
        };
      })
      .filter(Boolean);
  }, []);

  const lookupGoogleLocationSuggestions = useCallback((rawLocation) => {
    if (!useGooglePlaces) return Promise.resolve([]);

    const query = String(rawLocation || "").trim();
    if (!query) return Promise.resolve([]);

    const service = googleAutocompleteServiceRef.current;
    const placesStatus = window.google?.maps?.places?.PlacesServiceStatus;

    if (!service || !placesStatus) {
      return Promise.resolve([]);
    }

    return new Promise((resolve, reject) => {
      const request = {
        input: query,
        types: ["geocode"],
      };

      if (googlePlacesCountry) {
        request.componentRestrictions = { country: googlePlacesCountry };
      }

      service.getPlacePredictions(request, (predictions, status) => {
        if (status === placesStatus.ZERO_RESULTS) {
          resolve([]);
          return;
        }

        if (status !== placesStatus.OK || !Array.isArray(predictions)) {
          reject(new Error("Google location suggestions lookup failed"));
          return;
        }

        const rows = predictions
          .map((prediction) => {
            const label = String(prediction?.description || "").trim();
            const placeId = String(prediction?.place_id || "").trim();
            if (!label || !placeId) return null;

            return {
              id: placeId,
              label,
              placeId,
            };
          })
          .filter(Boolean);

        resolve(rows);
      });
    });
  }, [googlePlacesCountry, useGooglePlaces]);

  const resolveGooglePlaceSuggestion = useCallback((suggestion) => {
    if (!useGooglePlaces) return Promise.resolve(null);

    const placeId = String(suggestion?.placeId || "").trim();
    const geocoder = googleGeocoderRef.current;
    const geocoderStatus = window.google?.maps?.GeocoderStatus;

    if (!placeId || !geocoder || !geocoderStatus) {
      return Promise.resolve(null);
    }

    return new Promise((resolve, reject) => {
      geocoder.geocode({ placeId }, (results, status) => {
        if (status === geocoderStatus.ZERO_RESULTS) {
          resolve(null);
          return;
        }

        if (status !== geocoderStatus.OK || !Array.isArray(results) || !results[0]) {
          reject(new Error("Google place details lookup failed"));
          return;
        }

        const first = results[0];
        const lat = toCoordinateNumber(first?.geometry?.location?.lat?.());
        const lng = toCoordinateNumber(first?.geometry?.location?.lng?.());
        if (lat === null || lng === null) {
          resolve(null);
          return;
        }

        resolve({
          id: placeId,
          placeId,
          label: String(first.formatted_address || suggestion?.label || "").trim(),
          lat,
          lng,
        });
      });
    });
  }, [useGooglePlaces]);

  const applyLocationSuggestion = useCallback(async (suggestion) => {
    if (!suggestion) return;

    try {
      setResolvingLocation(true);
      setError("");

      let resolvedSuggestion =
        suggestion.placeId
          ? await resolveGooglePlaceSuggestion(suggestion)
          : suggestion;
      let lat = toCoordinateNumber(resolvedSuggestion?.lat);
      let lng = toCoordinateNumber(resolvedSuggestion?.lng);

      // If Google place details are unavailable, fall back to OpenStreetMap geocoding.
      if (!resolvedSuggestion || lat === null || lng === null) {
        const fallbackQuery = String(suggestion?.label || suggestion?.id || "").trim();
        const fallback = await lookupCoordinatesByLocation(fallbackQuery);
        if (fallback) {
          resolvedSuggestion = {
            id: suggestion.id || fallback.query,
            label: suggestion.label || fallback.query,
            lat: fallback.lat,
            lng: fallback.lng,
          };
          lat = toCoordinateNumber(fallback.lat);
          lng = toCoordinateNumber(fallback.lng);
        }
      }

      if (!resolvedSuggestion || lat === null || lng === null) {
        setError("Unable to resolve selected location coordinates");
        return;
      }

      setFormData((prev) => ({
        ...prev,
        location: resolvedSuggestion.label,
        locationLat: String(lat),
        locationLng: String(lng),
      }));
      setShowLocationSuggestions(false);
      setLocationSuggestions([]);
      setSuccess("Location selected and coordinates auto-filled");
    } catch (applyError) {
      setError(toErrorMessage(applyError, "Unable to resolve selected location"));
    } finally {
      setResolvingLocation(false);
    }
  }, [lookupCoordinatesByLocation, resolveGooglePlaceSuggestion]);

  const resolveCoordinatesFromLocation = async (rawLocation) => {
    const query = String(rawLocation || "").trim();
    if (!query || resolvingLocation) return;

    try {
      setResolvingLocation(true);
      setError("");
      const resolved = await lookupCoordinatesByLocation(query);
      if (!resolved) {
        setError("Location not found. Try entering full address");
        return;
      }

      setFormData((prev) => ({
        ...prev,
        location: resolved.query,
        locationLat: String(resolved.lat),
        locationLng: String(resolved.lng),
      }));
      setShowLocationSuggestions(false);
      setLocationSuggestions([]);
      setSuccess("Coordinates auto-filled from location");
    } catch (lookupError) {
      setError(toErrorMessage(lookupError, "Unable to fetch coordinates"));
    } finally {
      setResolvingLocation(false);
    }
  };

  const handleLocationInputKeyDown = (e) => {
    if (e.key === "Escape") {
      setShowLocationSuggestions(false);
      return;
    }

    if (e.key !== "Enter") return;

    e.preventDefault();
    if (showLocationSuggestions && locationSuggestions.length > 0) {
      void applyLocationSuggestion(locationSuggestions[0]);
      return;
    }

    resolveCoordinatesFromLocation(e.currentTarget.value);
  };

  useEffect(() => {
    if (!showLocationSuggestions || !(isAddModalOpen || isEditModalOpen)) return undefined;

    const query = String(formData.location || "").trim();
    if (query.length < 3) {
      setLocationSuggestions([]);
      setLoadingLocationSuggestions(false);
      return undefined;
    }

    const fetchId = locationSuggestionFetchIdRef.current + 1;
    locationSuggestionFetchIdRef.current = fetchId;

    const timer = setTimeout(async () => {
      try {
        setLoadingLocationSuggestions(true);
        let rows = [];
        if (useGooglePlaces && googlePlacesReady && googleAutocompleteServiceRef.current) {
          try {
            rows = await lookupGoogleLocationSuggestions(query);
          } catch {
            rows = await lookupLocationSuggestions(query);
          }
        } else {
          rows = await lookupLocationSuggestions(query);
        }

        if (locationSuggestionFetchIdRef.current !== fetchId) return;
        setLocationSuggestions(rows);
      } catch {
        if (locationSuggestionFetchIdRef.current !== fetchId) return;
        setLocationSuggestions([]);
      } finally {
        if (locationSuggestionFetchIdRef.current === fetchId) {
          setLoadingLocationSuggestions(false);
        }
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [
    formData.location,
    isAddModalOpen,
    isEditModalOpen,
    useGooglePlaces,
    googlePlacesReady,
    lookupGoogleLocationSuggestions,
    lookupLocationSuggestions,
    showLocationSuggestions,
  ]);

  const getLeadOptionLabel = useCallback((lead) => {
    const name = String(lead?.name || "").trim() || "Lead";
    const phone = String(lead?.phone || "").trim();
    const project = String(lead?.projectInterested || "").trim();
    const status = String(lead?.status || "").trim();

    return [name, phone, status, project].filter(Boolean).join(" | ");
  }, []);

  const buildSaleDetailsPayload = useCallback(() => {
    if (!isSoldStatusValue(formData.status)) {
      return { value: null };
    }

    const saleLeadId = String(formData.saleLeadId || "").trim();
    const salePaymentMode = String(formData.salePaymentMode || "").trim().toUpperCase();
    const salePaymentType = String(formData.salePaymentType || "").trim().toUpperCase();
    const saleTotalAmount = Number(formData.saleTotalAmount);
    const saleRemainingAmount =
      formData.saleRemainingAmount === "" ? null : Number(formData.saleRemainingAmount);
    const salePaymentReference = String(formData.salePaymentReference || "").trim();
    const saleNote = String(formData.saleNote || "").trim();

    if (!saleLeadId) {
      return { error: "Lead selection is required when status is Sold" };
    }

    if (!salePaymentMode) {
      return { error: "Payment mode is required when status is Sold" };
    }

    if (!salePaymentType) {
      return { error: "Payment type is required when status is Sold" };
    }

    if (!Number.isFinite(saleTotalAmount) || saleTotalAmount <= 0) {
      return { error: "Total sold amount must be greater than 0" };
    }

    let remainingAmount = 0;
    if (salePaymentType === "PARTIAL") {
      if (!Number.isFinite(saleRemainingAmount) || saleRemainingAmount <= 0) {
        return { error: "Remaining amount is required for partial payment" };
      }
      remainingAmount = saleRemainingAmount;
    }

    if (isNonCashPaymentMode(salePaymentMode) && !salePaymentReference) {
      return { error: "Payment reference is required for non-cash sold payment" };
    }

    return {
      value: {
        leadId: saleLeadId,
        paymentMode: salePaymentMode,
        paymentType: salePaymentType,
        totalAmount: saleTotalAmount,
        remainingAmount,
        paymentReference: isNonCashPaymentMode(salePaymentMode) ? salePaymentReference : "",
        note: saleNote,
        soldAt: new Date().toISOString(),
      },
    };
  }, [formData]);

  const buildInventoryPayloadFromForm = useCallback(({
    finalLocation,
    trimmedReservationReason,
    saleDetails,
    parsedSiteLocation,
  }) => {
    const inventoryType = String(formData.inventoryType || "COMMERCIAL").toUpperCase();

    const payload = {
      title: formData.title.trim(),
      projectName: formData.title.trim(),
      towerName: String(formData.buildingName || "Main").trim() || "Main",
      unitNumber: formData.propertyId.trim(),
      propertyId: formData.propertyId.trim(),
      inventoryType,
      location: finalLocation,
      city: String(formData.city || "").trim(),
      area: String(formData.area || "").trim(),
      pincode: String(formData.pincode || "").trim(),
      buildingName: String(formData.buildingName || "").trim(),
      floorNumber: toNumberOrNull(formData.floorNumber),
      totalFloors: toNumberOrNull(formData.totalFloors),
      totalArea: toNumberOrNull(formData.totalArea),
      carpetArea: toNumberOrNull(formData.carpetArea),
      builtUpArea: toNumberOrNull(formData.builtUpArea),
      areaUnit: String(formData.areaUnit || "SQ_FT").toUpperCase(),
      price: Number(formData.price),
      maintenanceCharges: toNumberOrNull(formData.maintenanceCharges),
      deposit: toNumberOrNull(formData.deposit),
      type: formData.type,
      category: formData.category,
      furnishingStatus: String(formData.furnishingStatus || "").toUpperCase(),
      status: formData.status,
      reservationReason: isReservedStatusValue(formData.status)
        ? trimmedReservationReason
        : "",
      saleDetails: saleDetails,
      images: Array.isArray(formData.images) ? formData.images : [],
      floorPlans: Array.isArray(formData.floorPlans) ? formData.floorPlans : [],
      videoTours: Array.isArray(formData.videoTours) ? formData.videoTours : [],
    };

    if (inventoryType === "COMMERCIAL") {
      payload.commercialDetails = {
        officeType: String(formData.officeType || "").toUpperCase(),
        officeLayout: {
          totalCabins: toNumberOrNull(formData.commercialTotalCabins),
          workstations: toNumberOrNull(formData.commercialWorkstations),
          seats: toNumberOrNull(formData.commercialSeats),
          conferenceRooms: toNumberOrNull(formData.commercialConferenceRooms),
          meetingRooms: toNumberOrNull(formData.commercialMeetingRooms),
          receptionArea: Boolean(formData.commercialReceptionArea),
          waitingArea: Boolean(formData.commercialWaitingArea),
        },
        amenities: {
          pantry: Boolean(formData.commercialPantry),
          cafeteria: Boolean(formData.commercialCafeteria),
          washroomType: String(formData.commercialWashroomType || "").toUpperCase(),
          serverRoom: Boolean(formData.commercialServerRoom),
          storageRoom: Boolean(formData.commercialStorageRoom),
          breakoutArea: Boolean(formData.commercialBreakoutArea),
          liftAvailable: Boolean(formData.commercialLiftAvailable),
          powerBackup: Boolean(formData.commercialPowerBackup),
          centralAC: Boolean(formData.commercialCentralAC),
        },
        buildingDetails: {
          totalFloors: toNumberOrNull(formData.commercialBuildingTotalFloors),
          parkingType: String(formData.commercialParkingType || "").toUpperCase(),
          parkingSlots: toNumberOrNull(formData.commercialParkingSlots),
          securityType: String(formData.commercialSecurityType || "").toUpperCase(),
          fireSafety: Boolean(formData.commercialFireSafety),
        },
        availability: {
          readyToMove: Boolean(formData.commercialReadyToMove),
          underConstruction: Boolean(formData.commercialUnderConstruction),
          availableFrom: formData.commercialAvailableFrom || null,
        },
      };
    }

    if (inventoryType === "RESIDENTIAL") {
      payload.residentialDetails = {
        propertyType: String(formData.residentialPropertyType || "").toUpperCase(),
        bhkType: String(formData.residentialBhkType || "").toUpperCase(),
        bedrooms: toNumberOrNull(formData.residentialBedrooms),
        bathrooms: toNumberOrNull(formData.residentialBathrooms),
        balcony: toNumberOrNull(formData.residentialBalcony),
        studyRoom: Boolean(formData.residentialStudyRoom),
        servantRoom: Boolean(formData.residentialServantRoom),
        parking: toNumberOrNull(formData.residentialParking),
        amenities: {
          modularKitchen: Boolean(formData.residentialModularKitchen),
          lift: Boolean(formData.residentialLift),
          security: Boolean(formData.residentialSecurity),
          powerBackup: Boolean(formData.residentialPowerBackup),
          gym: Boolean(formData.residentialGym),
          swimmingPool: Boolean(formData.residentialSwimmingPool),
          clubhouse: Boolean(formData.residentialClubhouse),
        },
        utilities: {
          waterSupply: String(formData.residentialWaterSupply || "").toUpperCase(),
          electricityBackup: Boolean(formData.residentialElectricityBackup),
          gasPipeline: Boolean(formData.residentialGasPipeline),
        },
      };
    }

    if (parsedSiteLocation.value) {
      payload.siteLocation = parsedSiteLocation.value;
    }

    return payload;
  }, [formData]);

  const handleSaveAsset = async () => {
    if (!canOpenCreateModal) return;

    const derivedLocation = [formData.city, formData.area, formData.pincode]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(", ");
    const finalLocation = String(formData.location || "").trim() || derivedLocation;

    if (!formData.propertyId.trim() || !formData.title.trim() || formData.price === "" || !finalLocation) {
      setError("Property ID, property name, location and price are required");
      return;
    }

    const parsedSiteLocation = toSiteLocationPayload({
      lat: formData.locationLat,
      lng: formData.locationLng,
    });

    if (parsedSiteLocation.error) {
      setError(parsedSiteLocation.error);
      return;
    }

    const trimmedReservationReason = String(formData.reservationReason || "").trim();
    if (isReservedStatusValue(formData.status) && !trimmedReservationReason) {
      setError("Reservation reason is required when status is Reserved");
      return;
    }

    const saleDetailsPayload = buildSaleDetailsPayload();
    if (saleDetailsPayload.error) {
      setError(saleDetailsPayload.error);
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = buildInventoryPayloadFromForm({
        finalLocation,
        trimmedReservationReason,
        saleDetails: saleDetailsPayload.value,
        parsedSiteLocation,
      });

      if (canManage) {
        const createdAsset = await createInventoryAsset(payload);
        setAssets((prev) => [createdAsset, ...prev]);
        setSuccess("Asset added to inventory");
      } else {
        await createInventoryCreateRequest(payload);
        setSuccess("Inventory request submitted for admin approval");
      }
      closeFormModal();
    } catch (saveError) {
      console.error(`Save asset failed: ${toErrorMessage(saveError, "Unknown error")}`);
      setError(toErrorMessage(saveError, "Failed to save asset"));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditModal = (asset, options = {}) => {
    if (!canOpenEditModal || !asset?._id) return;

    const forcedStatus = String(options?.status || "").trim();
    const resolvedStatus = forcedStatus || asset.status || "Available";
    const existingSaleDetails = asset?.saleDetails || {};

    const existingSiteLat = toCoordinateNumber(asset?.siteLocation?.lat);
    const existingSiteLng = toCoordinateNumber(asset?.siteLocation?.lng);

    setError("");
    setSuccess("");
    clearLocationSuggestionState();
    setIsAddModalOpen(false);
    setEditingAssetId(asset._id);
    const existingCommercial = asset.commercialDetails || {};
    const existingCommercialLayout = existingCommercial.officeLayout || {};
    const existingCommercialAmenities = existingCommercial.amenities || {};
    const existingCommercialBuilding = existingCommercial.buildingDetails || {};
    const existingCommercialAvailability = existingCommercial.availability || {};
    const existingResidential = asset.residentialDetails || {};
    const existingResidentialAmenities = existingResidential.amenities || {};
    const existingResidentialUtilities = existingResidential.utilities || {};

    setFormData({
      ...DEFAULT_FORM,
      propertyId: String(asset.propertyId || asset.unitNumber || "").trim(),
      title: asset.projectName || asset.title || "",
      inventoryType: String(asset.inventoryType || "COMMERCIAL").toUpperCase(),
      location: asset.location || "",
      city: asset.city || "",
      area: asset.area || "",
      pincode: asset.pincode || "",
      buildingName: asset.buildingName || asset.towerName || "",
      floorNumber: asset.floorNumber ?? "",
      totalFloors: asset.totalFloors ?? "",
      totalArea: asset.totalArea ?? "",
      carpetArea: asset.carpetArea ?? "",
      builtUpArea: asset.builtUpArea ?? "",
      areaUnit: asset.areaUnit || "SQ_FT",
      maintenanceCharges: asset.maintenanceCharges ?? "",
      deposit: asset.deposit ?? "",
      furnishingStatus: asset.furnishingStatus || "",
      locationLat: existingSiteLat === null ? "" : String(existingSiteLat),
      locationLng: existingSiteLng === null ? "" : String(existingSiteLng),
      price:
        asset.price === null || asset.price === undefined || Number.isNaN(Number(asset.price))
          ? ""
          : String(asset.price),
      type: asset.type || "Sale",
      category: asset.category || "Apartment",
      status: resolvedStatus,
      officeType: existingCommercial.officeType || "",
      commercialTotalCabins: existingCommercialLayout.totalCabins ?? "",
      commercialWorkstations: existingCommercialLayout.workstations ?? "",
      commercialSeats: existingCommercialLayout.seats ?? "",
      commercialConferenceRooms: existingCommercialLayout.conferenceRooms ?? "",
      commercialMeetingRooms: existingCommercialLayout.meetingRooms ?? "",
      commercialReceptionArea: Boolean(existingCommercialLayout.receptionArea),
      commercialWaitingArea: Boolean(existingCommercialLayout.waitingArea),
      commercialPantry: Boolean(existingCommercialAmenities.pantry),
      commercialCafeteria: Boolean(existingCommercialAmenities.cafeteria),
      commercialWashroomType: existingCommercialAmenities.washroomType || "",
      commercialServerRoom: Boolean(existingCommercialAmenities.serverRoom),
      commercialStorageRoom: Boolean(existingCommercialAmenities.storageRoom),
      commercialBreakoutArea: Boolean(existingCommercialAmenities.breakoutArea),
      commercialLiftAvailable: Boolean(existingCommercialAmenities.liftAvailable),
      commercialPowerBackup: Boolean(existingCommercialAmenities.powerBackup),
      commercialCentralAC: Boolean(existingCommercialAmenities.centralAC),
      commercialBuildingTotalFloors: existingCommercialBuilding.totalFloors ?? "",
      commercialParkingType: existingCommercialBuilding.parkingType || "",
      commercialParkingSlots: existingCommercialBuilding.parkingSlots ?? "",
      commercialSecurityType: existingCommercialBuilding.securityType || "",
      commercialFireSafety: Boolean(existingCommercialBuilding.fireSafety),
      commercialReadyToMove: Boolean(existingCommercialAvailability.readyToMove),
      commercialUnderConstruction: Boolean(existingCommercialAvailability.underConstruction),
      commercialAvailableFrom: existingCommercialAvailability.availableFrom
        ? new Date(existingCommercialAvailability.availableFrom).toISOString().slice(0, 10)
        : "",
      residentialPropertyType: existingResidential.propertyType || "",
      residentialBhkType: existingResidential.bhkType || "",
      residentialBedrooms: existingResidential.bedrooms ?? "",
      residentialBathrooms: existingResidential.bathrooms ?? "",
      residentialBalcony: existingResidential.balcony ?? "",
      residentialStudyRoom: Boolean(existingResidential.studyRoom),
      residentialServantRoom: Boolean(existingResidential.servantRoom),
      residentialParking: existingResidential.parking ?? "",
      residentialModularKitchen: Boolean(existingResidentialAmenities.modularKitchen),
      residentialLift: Boolean(existingResidentialAmenities.lift),
      residentialSecurity: Boolean(existingResidentialAmenities.security),
      residentialPowerBackup: Boolean(existingResidentialAmenities.powerBackup),
      residentialGym: Boolean(existingResidentialAmenities.gym),
      residentialSwimmingPool: Boolean(existingResidentialAmenities.swimmingPool),
      residentialClubhouse: Boolean(existingResidentialAmenities.clubhouse),
      residentialWaterSupply: existingResidentialUtilities.waterSupply || "",
      residentialElectricityBackup: Boolean(existingResidentialUtilities.electricityBackup),
      residentialGasPipeline: Boolean(existingResidentialUtilities.gasPipeline),
      reservationReason: asset.reservationReason || "",
      saleLeadId: String(existingSaleDetails?.leadId?._id || existingSaleDetails?.leadId || "").trim(),
      salePaymentMode: String(existingSaleDetails?.paymentMode || "").trim().toUpperCase(),
      salePaymentType: String(existingSaleDetails?.paymentType || "").trim().toUpperCase(),
      saleTotalAmount:
        existingSaleDetails?.totalAmount === null
        || existingSaleDetails?.totalAmount === undefined
        || Number.isNaN(Number(existingSaleDetails?.totalAmount))
          ? ""
          : String(existingSaleDetails.totalAmount),
      saleRemainingAmount:
        existingSaleDetails?.remainingAmount === null
        || existingSaleDetails?.remainingAmount === undefined
        || Number.isNaN(Number(existingSaleDetails?.remainingAmount))
          ? ""
          : String(existingSaleDetails.remainingAmount),
      salePaymentReference: String(existingSaleDetails?.paymentReference || "").trim(),
      saleNote: String(existingSaleDetails?.note || "").trim(),
      images: Array.isArray(asset.images) ? asset.images : [],
      floorPlans: Array.isArray(asset.floorPlans) ? asset.floorPlans : [],
      videoTours: Array.isArray(asset.videoTours) ? asset.videoTours : [],
    });
    setLocationBaseline({
      location: asset.location || "",
      locationLat: existingSiteLat === null ? "" : String(existingSiteLat),
      locationLng: existingSiteLng === null ? "" : String(existingSiteLng),
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateAsset = async () => {
    if (!canOpenEditModal || !editingAssetId) return;

    const derivedLocation = [formData.city, formData.area, formData.pincode]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(", ");
    const finalLocation = String(formData.location || "").trim() || derivedLocation;

    if (!formData.propertyId.trim() || !formData.title.trim() || formData.price === "" || !finalLocation) {
      setError("Property ID, property name, location and price are required");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      let locationLatInput = formData.locationLat;
      let locationLngInput = formData.locationLng;

      const currentLocation = formData.location.trim();
      const baselineLocation = String(locationBaseline.location || "").trim();
      const locationChanged = currentLocation !== baselineLocation;

      const currentLat = toCoordinateNumber(locationLatInput);
      const currentLng = toCoordinateNumber(locationLngInput);
      const baselineLat = toCoordinateNumber(locationBaseline.locationLat);
      const baselineLng = toCoordinateNumber(locationBaseline.locationLng);

      const hasCompleteCoordinates = currentLat !== null && currentLng !== null;
      const coordinatesUnchangedFromBaseline =
        currentLat === baselineLat && currentLng === baselineLng;

      if (locationChanged && (!hasCompleteCoordinates || coordinatesUnchangedFromBaseline)) {
        setResolvingLocation(true);
        const resolved = await lookupCoordinatesByLocation(currentLocation);
        if (!resolved) {
          setError(
            "Location changed but coordinates could not be resolved. Use Get Lat/Lng or enter coordinates manually.",
          );
          return;
        }

        locationLatInput = String(resolved.lat);
        locationLngInput = String(resolved.lng);
        setFormData((prev) => ({
          ...prev,
          location: resolved.query,
          locationLat: locationLatInput,
          locationLng: locationLngInput,
        }));
      }

      const parsedSiteLocation = toSiteLocationPayload({
        lat: locationLatInput,
        lng: locationLngInput,
      });

      if (parsedSiteLocation.error) {
        setError(parsedSiteLocation.error);
        return;
      }

      const trimmedReservationReason = String(formData.reservationReason || "").trim();
      if (isReservedStatusValue(formData.status) && !trimmedReservationReason) {
        setError("Reservation reason is required when status is Reserved");
        return;
      }

      const saleDetailsPayload = buildSaleDetailsPayload();
      if (saleDetailsPayload.error) {
        setError(saleDetailsPayload.error);
        return;
      }

      const payload = buildInventoryPayloadFromForm({
        finalLocation,
        trimmedReservationReason,
        saleDetails: saleDetailsPayload.value,
        parsedSiteLocation,
      });

      if (canManage) {
        const updatedAsset = await updateInventoryAsset(editingAssetId, payload);
        setAssets((prev) =>
          prev.map((asset) => (String(asset._id) === String(editingAssetId) ? updatedAsset : asset)),
        );
        setSuccess("Asset updated");
      } else {
        await requestInventoryUpdateChange(editingAssetId, payload);
        setSuccess("Edit request submitted for admin approval");
      }
      closeFormModal();
    } catch (updateError) {
      console.error(`Update asset failed: ${toErrorMessage(updateError, "Unknown error")}`);
      setError(toErrorMessage(updateError, "Failed to update asset"));
    } finally {
      setSaving(false);
      setResolvingLocation(false);
    }
  };

  const handleDeleteAsset = async (assetId) => {
    if (!canManage) return;

    const shouldDelete = window.confirm("Delete this asset from inventory?");
    if (!shouldDelete) return;

    try {
      setDeletingId(assetId);
      setError("");
      setSuccess("");

      await deleteInventoryAsset(assetId);
      setAssets((prev) => prev.filter((asset) => asset._id !== assetId));
      setSuccess("Asset deleted");
    } catch (deleteError) {
      console.error(`Delete asset failed: ${toErrorMessage(deleteError, "Unknown error")}`);
      setError(toErrorMessage(deleteError, "Failed to delete asset"));
    } finally {
      setDeletingId("");
    }
  };

  const handleStatusChange = async (assetId, status) => {
    if (!canManage) return;

    const asset = assets.find((row) => String(row._id) === String(assetId));
    if (!asset) return;

    if (status === "Sold") {
      setError("");
      handleOpenEditModal(asset, { status: "Sold" });
      setSuccess("Fill sold payment details and update the property");
      return;
    }

    if (status === "Blocked") {
      setError("");
      openReserveModal(assetId, "direct");
      return;
    }

    try {
      setUpdatingStatusId(assetId);
      setError("");
      setSuccess("");

      const updated = await updateInventoryAsset(assetId, {
        status,
        reservationReason: "",
      });
      setAssets((prev) => prev.map((asset) => (asset._id === assetId ? updated : asset)));
      setSuccess("Asset status updated");
    } catch (statusError) {
      console.error(`Update status failed: ${toErrorMessage(statusError, "Unknown error")}`);
      setError(toErrorMessage(statusError, "Failed to update status"));
    } finally {
      setUpdatingStatusId("");
    }
  };

  const handleStatusChangeRequest = async (assetId, status) => {
    if (!canRequestStatusChange) return;

    const asset = assets.find((row) => String(row._id) === String(assetId));
    const currentStatus = toApiStatus(asset?.status || "");
    if (!asset || !status || status === currentStatus) {
      setError("Please select a different status");
      return;
    }

    if (status === "Sold") {
      setError("");
      handleOpenEditModal(asset, { status: "Sold" });
      setSuccess("Fill sold details and submit request for admin approval");
      return;
    }

    if (status === "Blocked") {
      setError("");
      openReserveModal(assetId, "request");
      return;
    }

    try {
      setRequestingStatusId(assetId);
      setError("");
      setSuccess("");

      await requestInventoryStatusChange(assetId, status);
      setSuccess("Status change request submitted for admin approval");
    } catch (requestError) {
      console.error(`Request status change failed: ${toErrorMessage(requestError, "Unknown error")}`);
      setError(toErrorMessage(requestError, "Failed to submit status change request"));
    } finally {
      setRequestingStatusId("");
    }
  };

  const handleReserveSubmit = async () => {
    if (!reserveAssetId) return;

    const normalizedLeadId = String(reserveLeadId || "").trim();
    const normalizedReason = String(reserveReason || "").trim();

    if (!normalizedLeadId) {
      setError("Lead selection is required when status is Reserved");
      return;
    }

    if (!normalizedReason) {
      setError("Reservation reason is required when status is Reserved");
      return;
    }

    try {
      setReserveSubmitting(true);
      setError("");
      setSuccess("");

      if (reserveMode === "request") {
        setRequestingStatusId(reserveAssetId);
        await requestInventoryStatusChange(reserveAssetId, "Blocked", {
          leadId: normalizedLeadId,
          reservationReason: normalizedReason,
        });
        setSuccess("Reserve request submitted for admin approval");
      } else {
        setUpdatingStatusId(reserveAssetId);
        const updated = await updateInventoryAsset(reserveAssetId, {
          status: "Blocked",
          reservationLeadId: normalizedLeadId,
          reservationReason: normalizedReason,
        });
        setAssets((prev) =>
          prev.map((asset) => (String(asset._id) === String(reserveAssetId) ? updated : asset)));
        setSuccess("Property reserved successfully");
      }

      closeReserveModal();
    } catch (reserveError) {
      console.error(`Reserve property failed: ${toErrorMessage(reserveError, "Unknown error")}`);
      setError(toErrorMessage(reserveError, "Failed to reserve property"));
    } finally {
      setReserveSubmitting(false);
      setUpdatingStatusId("");
      setRequestingStatusId("");
    }
  };

  const handleOpenDetails = (assetId) => {
    if (!assetId) return;
    navigate(`/inventory/${assetId}`);
  };

  const stopCardClick = (e) => {
    e.stopPropagation();
  };

  const handleCardKeyDown = (e, assetId) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    handleOpenDetails(assetId);
  };

  const handleShareAsset = (asset) => {
    const shareProperty = toSharePayload(asset);
    if (!shareProperty) return;

    navigate("/chat", {
      state: { shareProperty },
    });
  };

  const handleApproveRequest = async (requestId) => {
    if (!canManage || !requestId) return;

    try {
      setReviewingRequestId(requestId);
      setError("");
      setSuccess("");

      await approveInventoryRequest(requestId);
      setSuccess("Request approved and inventory updated");
      await fetchAssets();
    } catch (approveError) {
      console.error(`Approve request failed: ${toErrorMessage(approveError, "Unknown error")}`);
      setError(toErrorMessage(approveError, "Failed to approve request"));
    } finally {
      setReviewingRequestId("");
    }
  };

  const handleRejectRequest = async (requestId) => {
    if (!canManage || !requestId) return;

    const reason = window.prompt("Reject reason:");
    if (!reason || !reason.trim()) return;

    try {
      setReviewingRequestId(requestId);
      setError("");
      setSuccess("");

      await rejectInventoryRequest(requestId, reason.trim());
      setSuccess("Request rejected");
      await fetchAssets();
    } catch (rejectError) {
      console.error(`Reject request failed: ${toErrorMessage(rejectError, "Unknown error")}`);
      setError(toErrorMessage(rejectError, "Failed to reject request"));
    } finally {
      setReviewingRequestId("");
    }
  };

  return (
    <div className="w-full h-full px-4 sm:px-6 lg:px-10 pt-20 md:pt-24 pb-8 flex flex-col gap-8 overflow-y-auto custom-scrollbar relative bg-slate-50/50">
      <AssetVaultToolbar
        modeType={modeType}
        onModeChange={setModeType}
        canOpenCreateModal={canOpenCreateModal}
        canManage={canManage}
        onOpenAddModal={openAddModal}
      />

      <AssetVaultFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusOptions={STATUS_OPTIONS}
        inventoryTypeFilter={inventoryTypeFilter}
        onInventoryTypeFilterChange={setInventoryTypeFilter}
        furnishingFilter={furnishingFilter}
        onFurnishingFilterChange={setFurnishingFilter}
        bhkFilter={bhkFilter}
        onBhkFilterChange={setBhkFilter}
        cabinsFilter={cabinsFilter}
        onCabinsFilterChange={setCabinsFilter}
        seatsFilter={seatsFilter}
        onSeatsFilterChange={setSeatsFilter}
        areaRangeFilter={areaRangeFilter}
        onAreaRangeFilterChange={setAreaRangeFilter}
        budgetRangeFilter={budgetRangeFilter}
        onBudgetRangeFilterChange={setBudgetRangeFilter}
        floorFilter={floorFilter}
        onFloorFilterChange={setFloorFilter}
        parkingFilter={parkingFilter}
        onParkingFilterChange={setParkingFilter}
        pantryFilter={pantryFilter}
        onPantryFilterChange={setPantryFilter}
        amenitiesFilter={amenitiesFilter}
        onAmenitiesFilterChange={setAmenitiesFilter}
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-3 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 p-3 text-sm">
          {success}
        </div>
      )}

      <PendingInventoryRequestsPanel
        canManage={canManage}
        pendingRequests={pendingRequests}
        reviewingRequestId={reviewingRequestId}
        requestFieldLabels={REQUEST_FIELD_LABELS}
        getInventoryUnitLabel={getInventoryUnitLabel}
        formatRequestValue={formatRequestValue}
        formatCurrency={formatCurrency}
        onApprove={handleApproveRequest}
        onReject={handleRejectRequest}
        onViewInventory={(inventoryId) => navigate(`/inventory/${inventoryId}`)}
      />

      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
          <Loader className="animate-spin" size={24} /> Accessing Vault...
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
          <Home size={48} className="mb-4 opacity-20" />
          <p className="text-sm font-bold">No assets match current filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-8 z-0">
          {filteredAssets.map((asset) => (
            <Motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={asset._id}
              role="button"
              tabIndex={0}
              onClick={() => handleOpenDetails(asset._id)}
              onKeyDown={(e) => handleCardKeyDown(e, asset._id)}
              className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-xl hover:border-emerald-500/30 transition-all duration-300 flex flex-col h-[360px] cursor-pointer"
            >
              <div className="relative h-52 bg-slate-100 flex items-center justify-center overflow-hidden">
                {asset.images && asset.images.length > 0 ? (
                  <img
                    src={asset.images[0]}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    alt={getAssetTitle(asset)}
                  />
                ) : (
                  <div className="text-slate-300 flex flex-col items-center">
                    <ImageIcon size={32} />
                    <span className="text-[10px] font-bold uppercase mt-2 tracking-widest">
                      No Image
                    </span>
                  </div>
                )}

                {asset.images && asset.images.length > 1 && (
                  <div className="absolute bottom-2 right-2 bg-slate-900/70 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                    +{asset.images.length - 1} more
                  </div>
                )}

                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  {canOpenEditModal && (
                    <button
                      type="button"
                      onClick={(e) => {
                        stopCardClick(e);
                        handleOpenEditModal(asset);
                      }}
                      className="p-1.5 rounded-lg bg-white/90 text-slate-600 hover:bg-slate-900 hover:text-white transition-colors"
                      title={canManage ? "Edit property" : "Request edit"}
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      stopCardClick(e);
                      handleShareAsset(asset);
                    }}
                    className="p-1.5 rounded-lg bg-white/90 text-cyan-700 hover:bg-cyan-600 hover:text-white transition-colors"
                    title="Share to chat"
                  >
                    <Share2 size={12} />
                  </button>
                  <div
                    className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest ${statusPillClass(
                      asset.status,
                    )}`}
                  >
                    {asset.status}
                  </div>
                </div>

                {canManage && (
                  <button
                    type="button"
                    onClick={(e) => {
                      stopCardClick(e);
                      handleDeleteAsset(asset._id);
                    }}
                    disabled={deletingId === asset._id}
                    className="absolute top-3 left-3 p-1.5 rounded-lg bg-white/90 text-red-500 hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {deletingId === asset._id ? (
                      <Loader size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                )}
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg tracking-wide text-slate-800 truncate">
                    {getAssetTitle(asset)}
                  </h3>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                    <MapPin size={12} /> {asset.location || "-"}
                  </div>
                  {toApiStatus(asset.status) === "Blocked" && asset.reservationReason ? (
                    <p className="mt-1 text-[11px] text-amber-700 font-semibold">
                      Reserved reason: {asset.reservationReason}
                    </p>
                  ) : null}
                  {toApiStatus(asset.status) === "Sold" && asset.saleDetails ? (
                    <div className="mt-1 text-[11px] text-slate-600">
                      <p className="font-semibold text-slate-700">
                        Sold to lead: {formatSoldLeadLabel(asset.saleDetails?.leadId)}
                      </p>
                      <p>
                        {formatSoldPaymentModeLabel(asset.saleDetails?.paymentMode)} | {formatSoldPaymentTypeLabel(asset.saleDetails?.paymentType)}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase">{asset.category}</span>
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {formatPrice(asset)}
                    </span>
                  </div>
                  {String(asset?.type || "").trim().toUpperCase() === "RENT"
                    && toNumberOrNull(asset?.deposit) !== null ? (
                    <div className="mt-1 text-[11px] font-semibold text-slate-600">
                      Deposit: {formatCurrency(asset.deposit)}
                    </div>
                    ) : null}

                  {canManage ? (
                    <>
                      <select
                        value={toApiStatus(asset.status)}
                        disabled={updatingStatusId === asset._id}
                        onChange={(e) => handleStatusChange(asset._id, e.target.value)}
                        onClick={stopCardClick}
                        className="mt-3 w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500"
                      >
                        {STATUS_UPDATE_OPTIONS.map((statusOption) => (
                          <option key={statusOption.value} value={statusOption.value}>
                            {statusOption.label}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : canRequestStatusChange ? (
                    <>
                      <select
                        value={toApiStatus(asset.status)}
                        disabled={requestingStatusId === asset._id}
                        onChange={(e) => handleStatusChangeRequest(asset._id, e.target.value)}
                        onClick={stopCardClick}
                        className="mt-3 w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500"
                      >
                        {STATUS_UPDATE_OPTIONS.map((statusOption) => (
                          <option key={statusOption.value} value={statusOption.value}>
                            {statusOption.label}
                          </option>
                        ))}
                      </select>
                      <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                        Admin approval required
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        View-only access
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {((isAddModalOpen && canOpenCreateModal) || (isEditModalOpen && canOpenEditModal)) && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <Motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                <h3 className="font-display text-lg text-slate-900">
                  {isEditModalOpen
                    ? canManage
                      ? "Edit Property"
                      : "Request Property Edit"
                    : canManage
                      ? "New Inventory Asset"
                      : "New Inventory Request"}
                </h3>
                <button
                  onClick={closeFormModal}
                  className="p-2 hover:bg-slate-200 rounded-full text-slate-400"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                    Property Images
                  </label>

                  {formData.images.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                      {formData.images.map((url, index) => (
                        <div
                          key={`${url}-${index}`}
                          className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 group"
                        >
                          <img src={url} className="w-full h-full object-cover" alt="asset" />
                          <button
                            onClick={() => removeImage(url)}
                            className="absolute top-0 right-0 bg-red-500 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-center w-full">
                    <label
                      className={`flex flex-col items-center justify-center w-full h-24 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all ${
                        uploading ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {uploading ? (
                          <Loader className="animate-spin text-slate-400 mb-2" size={24} />
                        ) : (
                          <UploadCloud className="text-slate-400 mb-2" size={24} />
                        )}
                        <p className="text-xs text-slate-500 font-bold">
                          {uploading ? "Uploading..." : "Click to upload photos"}
                        </p>
                        <p className="text-[10px] text-slate-400">SVG, PNG, JPG</p>
                      </div>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Property ID *
                      </label>
                      <input
                        type="text"
                        placeholder="PROP-1001"
                        value={formData.propertyId}
                        onChange={(e) => setFormData((prev) => ({ ...prev, propertyId: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Inventory Type
                      </label>
                      <select
                        value={formData.inventoryType}
                        onChange={(e) => setFormData((prev) => ({ ...prev, inventoryType: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                      >
                        <option value="COMMERCIAL">Commercial</option>
                        <option value="RESIDENTIAL">Residential</option>
                      </select>
                    </div>
                  </div>

                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Property / Project Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sunset Villa 402"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Price (Rs)
                    </label>
                    <input
                      type="number"
                      placeholder="12500000"
                      value={formData.price}
                      onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                    />
                  </div>

                  {formData.type === "Rent" ? (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Security Deposit (Rs)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="250000"
                        value={formData.deposit}
                        onChange={(e) => setFormData((prev) => ({ ...prev, deposit: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                      />
                    </div>
                  ) : null}

                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Location
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Sector 42"
                        value={formData.location}
                        onChange={(e) => {
                          const nextLocation = e.target.value;
                          setFormData((prev) => ({ ...prev, location: nextLocation }));
                          setShowLocationSuggestions(Boolean(nextLocation.trim()));
                        }}
                        onFocus={() => {
                          setShowLocationSuggestions(Boolean(String(formData.location || "").trim()));
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowLocationSuggestions(false), 120);
                        }}
                        onKeyDown={handleLocationInputKeyDown}
                        className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                      />

                      {showLocationSuggestions && (
                        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-52 overflow-y-auto custom-scrollbar">
                          {loadingLocationSuggestions ? (
                            <div className="px-3 py-2 text-xs text-slate-500 flex items-center gap-2">
                              <Loader size={12} className="animate-spin" />
                              {useGooglePlaces && googlePlacesReady
                                ? "Searching Google locations..."
                                : "Searching locations..."}
                            </div>
                          ) : locationSuggestions.length > 0 ? (
                            locationSuggestions.map((suggestion) => (
                              <button
                                key={suggestion.id}
                                type="button"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  void applyLocationSuggestion(suggestion);
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 border-b last:border-b-0 border-slate-100"
                              >
                                {suggestion.label}
                              </button>
                            ))
                          ) : String(formData.location || "").trim().length >= 3 ? (
                            <p className="px-3 py-2 text-xs text-slate-500">No suggestions found</p>
                          ) : (
                            <p className="px-3 py-2 text-xs text-slate-500">
                              Type at least 3 characters
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => resolveCoordinatesFromLocation(formData.location)}
                      disabled={resolvingLocation || !formData.location.trim()}
                      className="mt-2 h-[42px] min-w-[124px] rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold uppercase tracking-widest text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                    >
                      {resolvingLocation ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader size={12} className="animate-spin" />
                          ...
                        </span>
                      ) : (
                        <>
                          <MapPin size={12} />
                          Get Lat/Lng
                        </>
                      )}
                    </button>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {useGooglePlaces
                        ? "Type address for Google-style suggestions. Press Enter to auto-fill coordinates."
                        : "Type address for free OpenStreetMap suggestions. Press Enter to auto-fill coordinates."}
                    </p>
                  </div>

                  <div className="col-span-2 grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Latitude (Optional)
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="28.4595"
                        value={formData.locationLat}
                        onChange={(e) => setFormData((prev) => ({ ...prev, locationLat: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Longitude (Optional)
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="77.0266"
                        value={formData.locationLng}
                        onChange={(e) => setFormData((prev) => ({ ...prev, locationLng: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                      />
                    </div>
                  </div>

                  <div className="col-span-2 grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        City
                      </label>
                      <input
                        type="text"
                        placeholder="Gurugram"
                        value={formData.city}
                        onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Area
                      </label>
                      <input
                        type="text"
                        placeholder="Golf Course Road"
                        value={formData.area}
                        onChange={(e) => setFormData((prev) => ({ ...prev, area: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Pincode
                      </label>
                      <input
                        type="text"
                        placeholder="122002"
                        value={formData.pincode}
                        onChange={(e) => setFormData((prev) => ({ ...prev, pincode: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                      />
                    </div>
                  </div>

                  <div className="col-span-2 grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Building Name
                      </label>
                      <input
                        type="text"
                        placeholder="DLF One Horizon"
                        value={formData.buildingName}
                        onChange={(e) => setFormData((prev) => ({ ...prev, buildingName: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Floor Number
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="7"
                        value={formData.floorNumber}
                        onChange={(e) => setFormData((prev) => ({ ...prev, floorNumber: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Total Floors
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="20"
                        value={formData.totalFloors}
                        onChange={(e) => setFormData((prev) => ({ ...prev, totalFloors: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Maintenance Charges
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="25000"
                        value={formData.maintenanceCharges}
                        onChange={(e) => setFormData((prev) => ({ ...prev, maintenanceCharges: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                      />
                    </div>
                  </div>

                  <div className="col-span-2 grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Total Area
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="2800"
                        value={formData.totalArea}
                        onChange={(e) => setFormData((prev) => ({ ...prev, totalArea: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Carpet Area
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="2200"
                        value={formData.carpetArea}
                        onChange={(e) => setFormData((prev) => ({ ...prev, carpetArea: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Built-up Area
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="2500"
                        value={formData.builtUpArea}
                        onChange={(e) => setFormData((prev) => ({ ...prev, builtUpArea: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          type: nextType,
                          deposit: nextType === "Rent" ? prev.deposit : "",
                        }));
                      }}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                    >
                      <option value="Sale">For Sale</option>
                      <option value="Rent">For Rent</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                    >
                      <option value="Apartment">Apartment</option>
                      <option value="Villa">Villa</option>
                      <option value="Office">Office</option>
                      <option value="Plot">Plot</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Furnishing Status
                    </label>
                    <select
                      value={formData.furnishingStatus}
                      onChange={(e) => setFormData((prev) => ({ ...prev, furnishingStatus: e.target.value }))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                    >
                      <option value="">Select furnishing</option>
                      <option value="UNFURNISHED">Unfurnished</option>
                      <option value="SEMI_FURNISHED">Semi Furnished</option>
                      <option value="FULLY_FURNISHED">Fully Furnished</option>
                      <option value="BARE_SHELL">Bare Shell</option>
                      <option value="WARM_SHELL">Warm Shell</option>
                      <option value="MANAGED_OFFICE">Managed Office</option>
                      <option value="COWORKING">Coworking</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Area Unit
                    </label>
                    <select
                      value={formData.areaUnit}
                      onChange={(e) => setFormData((prev) => ({ ...prev, areaUnit: e.target.value }))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                    >
                      <option value="SQ_FT">Sq Ft</option>
                      <option value="SQ_M">Sq M</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formData.inventoryType === "COMMERCIAL" ? (
                    <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Commercial Office Details
                      </p>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Office Type
                          </label>
                          <select
                            value={formData.officeType}
                            onChange={(e) => setFormData((prev) => ({ ...prev, officeType: e.target.value }))}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                          >
                            <option value="">Select office type</option>
                            <option value="BARE_SHELL">Bare Shell</option>
                            <option value="WARM_SHELL">Warm Shell</option>
                            <option value="SEMI_FURNISHED">Semi Furnished</option>
                            <option value="FULLY_FURNISHED">Fully Furnished</option>
                            <option value="MANAGED_OFFICE">Managed Office</option>
                            <option value="COWORKING">Coworking</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Washroom Type
                          </label>
                          <select
                            value={formData.commercialWashroomType}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, commercialWashroomType: e.target.value }))
                            }
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                          >
                            <option value="">Select washroom type</option>
                            <option value="ATTACHED">Attached</option>
                            <option value="COMMON">Common</option>
                            <option value="BOTH">Both</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Total Cabins
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.commercialTotalCabins}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, commercialTotalCabins: e.target.value }))
                            }
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Workstations
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.commercialWorkstations}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, commercialWorkstations: e.target.value }))
                            }
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Seats
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.commercialSeats}
                            onChange={(e) => setFormData((prev) => ({ ...prev, commercialSeats: e.target.value }))}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Conference Rooms
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.commercialConferenceRooms}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, commercialConferenceRooms: e.target.value }))
                            }
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Meeting Rooms
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.commercialMeetingRooms}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, commercialMeetingRooms: e.target.value }))
                            }
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Building Total Floors
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.commercialBuildingTotalFloors}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, commercialBuildingTotalFloors: e.target.value }))
                            }
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Parking Type
                          </label>
                          <select
                            value={formData.commercialParkingType}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, commercialParkingType: e.target.value }))
                            }
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                          >
                            <option value="">Select parking</option>
                            <option value="COVERED">Covered</option>
                            <option value="OPEN">Open</option>
                            <option value="BOTH">Both</option>
                            <option value="NONE">None</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Parking Slots
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.commercialParkingSlots}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, commercialParkingSlots: e.target.value }))
                            }
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Security
                          </label>
                          <select
                            value={formData.commercialSecurityType}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, commercialSecurityType: e.target.value }))
                            }
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                          >
                            <option value="">Select security</option>
                            <option value="SECURITY_24X7">24x7 Security</option>
                            <option value="CCTV">CCTV</option>
                            <option value="BOTH">Both</option>
                            <option value="NONE">None</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          ["commercialReceptionArea", "Reception Area"],
                          ["commercialWaitingArea", "Waiting Area"],
                          ["commercialPantry", "Pantry"],
                          ["commercialCafeteria", "Cafeteria"],
                          ["commercialServerRoom", "Server / IT Room"],
                          ["commercialStorageRoom", "Storage Room"],
                          ["commercialBreakoutArea", "Breakout Area"],
                          ["commercialLiftAvailable", "Lift Available"],
                          ["commercialPowerBackup", "Power Backup"],
                          ["commercialCentralAC", "Central AC"],
                          ["commercialFireSafety", "Fire Safety"],
                          ["commercialReadyToMove", "Ready to Move"],
                          ["commercialUnderConstruction", "Under Construction"],
                        ].map(([field, label]) => (
                          <label
                            key={field}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(formData[field])}
                              onChange={(e) =>
                                setFormData((prev) => ({ ...prev, [field]: e.target.checked }))
                              }
                              className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            {label}
                          </label>
                        ))}
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Available From
                        </label>
                        <input
                          type="date"
                          value={formData.commercialAvailableFrom}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, commercialAvailableFrom: e.target.value }))
                          }
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                        />
                      </div>
                    </div>
                  ) : null}

                  {formData.inventoryType === "RESIDENTIAL" ? (
                    <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Residential Details
                      </p>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Property Type
                          </label>
                          <select
                            value={formData.residentialPropertyType}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, residentialPropertyType: e.target.value }))
                            }
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                          >
                            <option value="">Select property type</option>
                            <option value="FLAT">Flat</option>
                            <option value="VILLA">Villa</option>
                            <option value="BUILDER_FLOOR">Builder Floor</option>
                            <option value="PLOT">Plot</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            BHK Type
                          </label>
                          <select
                            value={formData.residentialBhkType}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, residentialBhkType: e.target.value }))
                            }
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                          >
                            <option value="">Select BHK</option>
                            <option value="1BHK">1 BHK</option>
                            <option value="2BHK">2 BHK</option>
                            <option value="3BHK">3 BHK</option>
                            <option value="4BHK">4 BHK</option>
                            <option value="5BHK">5 BHK</option>
                            <option value="STUDIO">Studio</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Parking Slots
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.residentialParking}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, residentialParking: e.target.value }))
                            }
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Bedrooms
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.residentialBedrooms}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, residentialBedrooms: e.target.value }))
                            }
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Bathrooms
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.residentialBathrooms}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, residentialBathrooms: e.target.value }))
                            }
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Balcony
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.residentialBalcony}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, residentialBalcony: e.target.value }))
                            }
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Water Supply
                          </label>
                          <select
                            value={formData.residentialWaterSupply}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, residentialWaterSupply: e.target.value }))
                            }
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                          >
                            <option value="">Select water source</option>
                            <option value="MUNICIPAL">Municipal</option>
                            <option value="BOREWELL">Borewell</option>
                            <option value="TANKER">Tanker</option>
                            <option value="BOTH">Both</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          ["residentialStudyRoom", "Study Room"],
                          ["residentialServantRoom", "Servant Room"],
                          ["residentialModularKitchen", "Modular Kitchen"],
                          ["residentialLift", "Lift"],
                          ["residentialSecurity", "Security"],
                          ["residentialPowerBackup", "Power Backup"],
                          ["residentialGym", "Gym"],
                          ["residentialSwimmingPool", "Swimming Pool"],
                          ["residentialClubhouse", "Clubhouse"],
                          ["residentialElectricityBackup", "Electricity Backup"],
                          ["residentialGasPipeline", "Gas Pipeline"],
                        ].map(([field, label]) => (
                          <label
                            key={field}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(formData[field])}
                              onChange={(e) =>
                                setFormData((prev) => ({ ...prev, [field]: e.target.checked }))
                              }
                              className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="col-span-2 grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Floor Plans (one URL per line)
                      </label>
                      <textarea
                        rows={3}
                        placeholder="https://.../floor-plan-1.pdf"
                        value={listToTextareaValue(formData.floorPlans)}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, floorPlans: parseTextareaList(e.target.value) }))
                        }
                        className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Video Tours (one URL per line)
                      </label>
                      <textarea
                        rows={3}
                        placeholder="https://.../property-video"
                        value={listToTextareaValue(formData.videoTours)}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, videoTours: parseTextareaList(e.target.value) }))
                        }
                        className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 resize-none"
                      />
                    </div>
                  </div>

                  {isReservedStatusValue(formData.status) ? (
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">
                        Reservation Reason *
                      </label>
                      <textarea
                        value={formData.reservationReason}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            reservationReason: e.target.value,
                          }))
                        }
                        placeholder="Mention why this property is reserved"
                        rows={3}
                        className="mt-1 w-full p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-amber-500 resize-none"
                      />
                    </div>
                  ) : null}

                  {isSoldStatusValue(formData.status) ? (
                    <div className="col-span-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                        Sold Details (Mandatory)
                      </p>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          Sold To Lead *
                        </label>
                        <select
                          value={formData.saleLeadId}
                          onChange={(e) => setFormData((prev) => ({ ...prev, saleLeadId: e.target.value }))}
                          className="mt-1 w-full p-3 bg-white border border-emerald-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">
                            {loadingLeadOptions ? "Loading leads..." : "Select lead"}
                          </option>
                          {leadOptions.map((lead) => (
                            <option key={lead._id} value={lead._id}>
                              {getLeadOptionLabel(lead)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            Payment Mode *
                          </label>
                          <select
                            value={formData.salePaymentMode}
                            onChange={(e) => setFormData((prev) => ({ ...prev, salePaymentMode: e.target.value }))}
                            className="mt-1 w-full p-3 bg-white border border-emerald-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">Select mode</option>
                            {SOLD_PAYMENT_MODE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            Payment Type *
                          </label>
                          <select
                            value={formData.salePaymentType}
                            onChange={(e) => setFormData((prev) => ({ ...prev, salePaymentType: e.target.value }))}
                            className="mt-1 w-full p-3 bg-white border border-emerald-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">Select type</option>
                            {SOLD_PAYMENT_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            Total Amount *
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.saleTotalAmount}
                            onChange={(e) => setFormData((prev) => ({ ...prev, saleTotalAmount: e.target.value }))}
                            placeholder="Enter sold amount"
                            className="mt-1 w-full p-3 bg-white border border-emerald-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        {formData.salePaymentType === "PARTIAL" ? (
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              Remaining Amount *
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={formData.saleRemainingAmount}
                              onChange={(e) => setFormData((prev) => ({ ...prev, saleRemainingAmount: e.target.value }))}
                              placeholder="Enter remaining"
                              className="mt-1 w-full p-3 bg-white border border-emerald-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              Remaining Amount
                            </label>
                            <input
                              type="text"
                              readOnly
                              value="0"
                              className="mt-1 w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500"
                            />
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          Payment Reference {isNonCashPaymentMode(formData.salePaymentMode) ? "*" : ""}
                        </label>
                        <input
                          type="text"
                          value={formData.salePaymentReference}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, salePaymentReference: e.target.value }))
                          }
                          placeholder={
                            isNonCashPaymentMode(formData.salePaymentMode)
                              ? "Enter UTR / transaction / cheque number"
                              : "Not required for cash payment"
                          }
                          className="mt-1 w-full p-3 bg-white border border-emerald-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          Sale Note
                        </label>
                        <textarea
                          rows={3}
                          value={formData.saleNote}
                          onChange={(e) => setFormData((prev) => ({ ...prev, saleNote: e.target.value }))}
                          placeholder="Add important context (payment proof, remarks, commitments, etc.)"
                          className="mt-1 w-full p-3 bg-white border border-emerald-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 resize-none"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3 shrink-0">
                <button
                  onClick={closeFormModal}
                  className="flex-1 py-3 text-xs font-bold uppercase text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={isEditModalOpen ? handleUpdateAsset : handleSaveAsset}
                  disabled={uploading || saving || resolvingLocation}
                  className={`flex-1 py-3 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-all ${
                    uploading || saving || resolvingLocation
                      ? "bg-slate-400 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {uploading || saving || resolvingLocation
                    ? isEditModalOpen
                      ? (resolvingLocation ? "Resolving..." : "Updating...")
                      : (resolvingLocation ? "Resolving..." : "Saving...")
                    : isEditModalOpen
                      ? canManage
                        ? "Update Asset"
                        : "Submit Edit Request"
                      : canManage
                        ? "Save Asset"
                        : "Submit Request"}
                </button>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isReserveModalOpen && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          >
            <Motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 p-5">
                <div>
                  <h3 className="font-display text-lg text-slate-900">
                    Reserve Property
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Link this property with a lead and add reservation reason.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeReserveModal}
                  disabled={reserveSubmitting}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-200 disabled:opacity-60"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 p-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Property
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {getAssetTitle(reserveTargetAsset)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {String(reserveTargetAsset?.location || "-").trim() || "-"}
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Reserve For Lead *
                  </label>
                  <select
                    value={reserveLeadId}
                    onChange={(event) => setReserveLeadId(event.target.value)}
                    disabled={reserveSubmitting || loadingLeadOptions}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                  >
                    <option value="">
                      {loadingLeadOptions ? "Loading leads..." : "Select lead"}
                    </option>
                    {sortedLeadOptions.map((lead) => (
                      <option key={lead._id} value={lead._id}>
                        {getLeadOptionLabel(lead)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Reservation Reason *
                  </label>
                  <textarea
                    rows={3}
                    value={reserveReason}
                    onChange={(event) => setReserveReason(event.target.value)}
                    placeholder="Why are you reserving this property?"
                    disabled={reserveSubmitting}
                    className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="flex gap-3 border-t border-slate-100 bg-slate-50/50 p-5">
                <button
                  type="button"
                  onClick={closeReserveModal}
                  disabled={reserveSubmitting}
                  className="flex-1 rounded-xl py-2.5 text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReserveSubmit}
                  disabled={reserveSubmitting || loadingLeadOptions}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {reserveSubmitting
                    ? (reserveMode === "request" ? "Submitting..." : "Reserving...")
                    : (reserveMode === "request" ? "Submit Reserve Request" : "Reserve Property")}
                </button>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AssetVault;


