import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  X,
  Loader,
  Building2,
  UploadCloud,
  MapPin,
  Image as ImageIcon,
  Layers3,
} from "lucide-react";
import {
  getProjectsWithMeta,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} from "../../services/projectService";
import { uploadFile } from "../../services/uploadService";
import { toErrorMessage } from "../../utils/errorMessage";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePermissions } from "../../context/usePermissions";
import ToastNotice from "../../components/ui/ToastNotice";
import {
  PROJECT_CATEGORY_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  PLOT_BASED_PROJECT_TYPES,
  PROJECT_PLOT_SIZE_OPTIONS,
  PROJECT_BHK_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  PROJECT_AMENITY_OPTIONS,
  PROJECT_HOUSING_CATEGORY_OPTIONS,
  PROJECT_OFFICE_TYPE_OPTIONS,
  PROJECT_FACING_OPTIONS,
  PROJECT_UNIT_STATUS_OPTIONS,
  PROJECT_COMMERCIAL_AMENITY_OPTIONS,
  getProjectOptionLabel,
} from "../../config/projectConfig";

const isPlotBasedType = (projectType) => PLOT_BASED_PROJECT_TYPES.includes(projectType);
const isBuildingType = (projectType) => projectType === "BUILDING";
const isCommercialCategory = (projectCategory) => projectCategory === "COMMERCIAL";

const makeUnitKey = () => `unit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const DEFAULT_OFFICE = {
  officeCode: "",
  officeName: "",
  floorNumber: "",
  officeType: "",
  length: "",
  breadth: "",
  height: "",
  carpetArea: "",
  builtUpArea: "",
  superBuiltUpArea: "",
  facing: "",
  reservedParking: "",
  status: "AVAILABLE",
  startingRate: "",
  currentRate: "",
  plc: "",
  remarks: "",
};

const DEFAULT_SHOP = {
  shopCode: "",
  floorNumber: "",
  length: "",
  breadth: "",
  height: "",
  carpetArea: "",
  builtUpArea: "",
  facing: "",
  parking: "",
  status: "AVAILABLE",
  startingRate: "",
  currentRate: "",
};

const DEFAULT_SHOWROOM = {
  showroomCode: "",
  floorNumber: "",
  length: "",
  breadth: "",
  height: "",
  carpetArea: "",
  builtUpArea: "",
  entranceWidth: "",
  ceilingHeight: "",
  parking: "",
  status: "AVAILABLE",
  startingRate: "",
  currentRate: "",
};

const SOLD_LIKE_UNIT_STATUSES = new Set(["SOLD", "LEASED", "BOOKED"]);

const DEFAULT_BHK_CONFIG = {
  size: "",
  bedrooms: "",
  kitchens: "",
  washrooms: "",
  drawingRooms: "",
  balconies: "",
  servantRoom: false,
  reservedParking: "",
};

const OFFICE_FIELDS = [
  { key: "officeName", label: "Office Name (Optional)", type: "text", placeholder: "Marketing Office" },
  { key: "floorNumber", label: "Floor Number", type: "floor" },
  { key: "officeType", label: "Office Type", type: "select", options: PROJECT_OFFICE_TYPE_OPTIONS },
  { key: "length", label: "Length (ft) *", type: "number" },
  { key: "breadth", label: "Breadth (ft) *", type: "number" },
  { key: "height", label: "Height (ft)", type: "number" },
  { key: "carpetArea", label: "Carpet Area (Sq.ft)", type: "number" },
  { key: "builtUpArea", label: "Built-up Area (Sq.ft)", type: "number" },
  { key: "superBuiltUpArea", label: "Super Built-up Area (Sq.ft)", type: "number" },
  { key: "facing", label: "Facing", type: "select", options: PROJECT_FACING_OPTIONS },
  { key: "reservedParking", label: "Reserved Parking", type: "number" },
  { key: "status", label: "Office Status", type: "select", options: PROJECT_UNIT_STATUS_OPTIONS },
  { key: "startingRate", label: "Starting Rate / Sq.ft", type: "number" },
  { key: "currentRate", label: "Current Rate / Sq.ft", type: "number" },
  { key: "plc", label: "PLC", type: "text" },
  { key: "remarks", label: "Remarks", type: "textarea" },
];

const SHOP_FIELDS = [
  { key: "floorNumber", label: "Floor Number", type: "floor" },
  { key: "length", label: "Length (ft) *", type: "number" },
  { key: "breadth", label: "Breadth (ft) *", type: "number" },
  { key: "height", label: "Height (ft)", type: "number" },
  { key: "carpetArea", label: "Carpet Area (Sq.ft)", type: "number" },
  { key: "builtUpArea", label: "Built-up Area (Sq.ft)", type: "number" },
  { key: "facing", label: "Facing", type: "select", options: PROJECT_FACING_OPTIONS },
  { key: "parking", label: "Parking", type: "number" },
  { key: "status", label: "Status", type: "select", options: PROJECT_UNIT_STATUS_OPTIONS },
  { key: "startingRate", label: "Starting Rate / Sq.ft", type: "number" },
  { key: "currentRate", label: "Current Rate / Sq.ft", type: "number" },
];

const SHOWROOM_FIELDS = [
  { key: "floorNumber", label: "Floor Number", type: "floor" },
  { key: "length", label: "Length (ft) *", type: "number" },
  { key: "breadth", label: "Breadth (ft) *", type: "number" },
  { key: "height", label: "Height (ft)", type: "number" },
  { key: "carpetArea", label: "Carpet Area (Sq.ft)", type: "number" },
  { key: "builtUpArea", label: "Built-up Area (Sq.ft)", type: "number" },
  { key: "entranceWidth", label: "Entrance Width (ft)", type: "number" },
  { key: "ceilingHeight", label: "Ceiling Height (ft)", type: "number" },
  { key: "parking", label: "Parking", type: "number" },
  { key: "status", label: "Status", type: "select", options: PROJECT_UNIT_STATUS_OPTIONS },
  { key: "startingRate", label: "Starting Rate / Sq.ft", type: "number" },
  { key: "currentRate", label: "Current Rate / Sq.ft", type: "number" },
];

const PROJECT_MANAGE_ROLES = new Set(["ADMIN", "MANAGER"]);
const PROJECT_DELETE_ROLES = new Set(["ADMIN"]);
const MOBILE_PATTERN = /^[0-9]{10}$/;
const PAGE_LIMIT = 25;

const SECTION_CLASS = "rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4";
const SECTION_HEADING_CLASS = "mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500";
const FIELD_TITLE_CLASS = "text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500";
const INPUT_CLASS =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:border-emerald-500 md:h-10";
const CHECKBOX_CLASS =
  "inline-flex min-h-10 items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-2 text-[11px] text-slate-700 md:min-h-0 md:px-2 md:py-1";

const DEFAULT_FORM = {
  projectCategory: "",
  projectType: "",
  projectName: "",
  totalLandArea: "",
  totalPlots: "",
  plotSize: "",
  customPlotSize: "",
  numberOfFlats: "",
  numberOfFloors: "",
  flatsPerFloor: "",
  bhkConfigurations: [],
  totalFloors: "",
  totalOffices: "",
  officesPerFloor: "",
  totalShops: "",
  totalShowrooms: "",
  offices: [],
  shops: [],
  showrooms: [],
  plc: "",
  group: "",
  startingRate: "",
  currentRate: "",
  otherCharges: "",
  status: "",
  amenities: [],
  housingCategory: "",
  location: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  locationLat: "",
  locationLng: "",
  ownerManagerName: "",
  ownerManagerMobile: "",
  brokerManagerName: "",
  brokerManagerMobile: "",
  plotsAvailable: "",
  images: [],
};

const toFormFromProject = (project = {}) => ({
  projectCategory: project.projectCategory || "",
  projectType: project.projectType || "",
  projectName: project.projectName || "",
  totalLandArea: project.totalLandArea || "",
  totalPlots: project.totalPlots ?? "",
  plotSize: project.plotSize || "",
  customPlotSize: project.customPlotSize || "",
  numberOfFlats: project.numberOfFlats ?? "",
  numberOfFloors: project.numberOfFloors ?? "",
  flatsPerFloor: project.flatsPerFloor ?? "",
  bhkConfigurations: Array.isArray(project.bhkConfigurations)
    ? project.bhkConfigurations.map((entry) => ({
      bhk: entry.bhk,
      size: entry.size ?? "",
      bedrooms: entry.bedrooms ?? "",
      kitchens: entry.kitchens ?? "",
      washrooms: entry.washrooms ?? "",
      drawingRooms: entry.drawingRooms ?? "",
      balconies: entry.balconies ?? "",
      servantRoom: Boolean(entry.servantRoom),
      reservedParking: entry.reservedParking ?? "",
    }))
    : [],
  totalFloors: project.totalFloors ?? "",
  totalOffices: project.totalOffices ?? "",
  officesPerFloor: project.officesPerFloor ?? "",
  totalShops: project.totalShops ?? "",
  totalShowrooms: project.totalShowrooms ?? "",
  offices: Array.isArray(project.offices)
    ? project.offices.map((entry) => ({ ...DEFAULT_OFFICE, ...entry, _key: entry._id || makeUnitKey() }))
    : [],
  shops: Array.isArray(project.shops)
    ? project.shops.map((entry) => ({ ...DEFAULT_SHOP, ...entry, _key: entry._id || makeUnitKey() }))
    : [],
  showrooms: Array.isArray(project.showrooms)
    ? project.showrooms.map((entry) => ({ ...DEFAULT_SHOWROOM, ...entry, _key: entry._id || makeUnitKey() }))
    : [],
  plc: project.plc || "",
  group: project.group || "",
  startingRate: project.startingRate ?? "",
  currentRate: project.currentRate ?? "",
  otherCharges: project.otherCharges || "",
  status: project.status || "",
  amenities: Array.isArray(project.amenities) ? project.amenities : [],
  housingCategory: project.housingCategory || "",
  location: project.location || "",
  landmark: project.landmark || "",
  city: project.city || "",
  state: project.state || "",
  pincode: project.pincode || "",
  locationLat: project.siteLocation?.lat ?? "",
  locationLng: project.siteLocation?.lng ?? "",
  ownerManagerName: project.ownerManagerName || "",
  ownerManagerMobile: project.ownerManagerMobile || "",
  brokerManagerName: project.brokerManagerName || "",
  brokerManagerMobile: project.brokerManagerMobile || "",
  plotsAvailable: project.plotsAvailable ?? "",
  images: Array.isArray(project.images) ? project.images : [],
});

const numOrZero = (value) => (value === "" || value === null || value === undefined ? 0 : Number(value));
const numOrNull = (value) => (value === "" || value === null || value === undefined ? null : Number(value));

const buildProjectPayload = (formData) => {
  const isCommercial = isCommercialCategory(formData.projectCategory);
  const isPlotBased = !isCommercial && isPlotBasedType(formData.projectType);
  const isBuilding = !isCommercial && isBuildingType(formData.projectType);

  const payload = {
    projectCategory: formData.projectCategory,
    projectType: isCommercial ? "" : formData.projectType,
    projectName: formData.projectName.trim(),
    totalLandArea: formData.totalLandArea.trim(),
    plc: formData.plc.trim(),
    group: formData.group.trim(),
    startingRate: Number(formData.startingRate),
    currentRate: Number(formData.currentRate),
    otherCharges: formData.otherCharges.trim(),
    status: formData.status,
    amenities: formData.amenities,
    housingCategory: isCommercial ? "" : formData.housingCategory,
    location: formData.location.trim(),
    ownerManagerName: formData.ownerManagerName.trim(),
    ownerManagerMobile: formData.ownerManagerMobile.trim(),
    brokerManagerName: formData.brokerManagerName.trim(),
    brokerManagerMobile: formData.brokerManagerMobile.trim(),
    images: Array.isArray(formData.images) ? formData.images : [],
  };

  if (isPlotBased) {
    payload.totalPlots = Number(formData.totalPlots);
    payload.plotSize = formData.plotSize;
    payload.customPlotSize = formData.plotSize === "CUSTOM" ? formData.customPlotSize.trim() : "";
    payload.plotsAvailable = formData.plotsAvailable === "" ? 0 : Number(formData.plotsAvailable);
  }

  if (isBuilding) {
    payload.numberOfFlats = Number(formData.numberOfFlats);
    payload.numberOfFloors = Number(formData.numberOfFloors);
    payload.flatsPerFloor = Number(formData.flatsPerFloor);
    payload.bhkConfigurations = formData.bhkConfigurations.map((config) => ({
      bhk: config.bhk,
      size: Number(config.size),
      bedrooms: config.bedrooms === "" ? 0 : Number(config.bedrooms),
      kitchens: config.kitchens === "" ? 0 : Number(config.kitchens),
      washrooms: config.washrooms === "" ? 0 : Number(config.washrooms),
      drawingRooms: config.drawingRooms === "" ? 0 : Number(config.drawingRooms),
      balconies: config.balconies === "" ? 0 : Number(config.balconies),
      servantRoom: Boolean(config.servantRoom),
      reservedParking: config.reservedParking === "" ? 0 : Number(config.reservedParking),
    }));
  }

  if (isCommercial) {
    payload.totalFloors = Number(formData.totalFloors);
    payload.officesPerFloor = Number(formData.officesPerFloor);
    payload.totalOffices = numOrZero(formData.totalOffices);
    payload.totalShops = numOrZero(formData.totalShops);
    payload.totalShowrooms = numOrZero(formData.totalShowrooms);
    payload.landmark = formData.landmark.trim();
    payload.city = formData.city.trim();
    payload.state = formData.state.trim();
    payload.pincode = formData.pincode.trim();
    payload.siteLocation = { lat: numOrNull(formData.locationLat), lng: numOrNull(formData.locationLng) };
    payload.offices = formData.offices.map((office) => ({
      officeCode: office.officeCode.trim(),
      officeName: office.officeName.trim(),
      floorNumber: Number(office.floorNumber),
      officeType: office.officeType,
      length: Number(office.length),
      breadth: Number(office.breadth),
      height: numOrNull(office.height),
      carpetArea: numOrNull(office.carpetArea),
      builtUpArea: numOrNull(office.builtUpArea),
      superBuiltUpArea: numOrNull(office.superBuiltUpArea),
      facing: office.facing,
      reservedParking: numOrZero(office.reservedParking),
      status: office.status,
      startingRate: numOrNull(office.startingRate),
      currentRate: numOrNull(office.currentRate),
      plc: office.plc.trim(),
      remarks: office.remarks.trim(),
    }));
    payload.shops = formData.shops.map((shop) => ({
      shopCode: shop.shopCode.trim(),
      floorNumber: Number(shop.floorNumber),
      length: Number(shop.length),
      breadth: Number(shop.breadth),
      height: numOrNull(shop.height),
      carpetArea: numOrNull(shop.carpetArea),
      builtUpArea: numOrNull(shop.builtUpArea),
      facing: shop.facing,
      parking: numOrZero(shop.parking),
      status: shop.status,
      startingRate: numOrNull(shop.startingRate),
      currentRate: numOrNull(shop.currentRate),
    }));
    payload.showrooms = formData.showrooms.map((showroom) => ({
      showroomCode: showroom.showroomCode.trim(),
      floorNumber: Number(showroom.floorNumber),
      length: Number(showroom.length),
      breadth: Number(showroom.breadth),
      height: numOrNull(showroom.height),
      carpetArea: numOrNull(showroom.carpetArea),
      builtUpArea: numOrNull(showroom.builtUpArea),
      entranceWidth: numOrNull(showroom.entranceWidth),
      ceilingHeight: numOrNull(showroom.ceilingHeight),
      parking: numOrZero(showroom.parking),
      status: showroom.status,
      startingRate: numOrNull(showroom.startingRate),
      currentRate: numOrNull(showroom.currentRate),
    }));
  }

  return payload;
};

const validateForm = (formData) => {
  const isCommercial = isCommercialCategory(formData.projectCategory);
  const isPlotBased = !isCommercial && isPlotBasedType(formData.projectType);
  const isBuilding = !isCommercial && isBuildingType(formData.projectType);

  if (!formData.projectCategory) return "Project Category is required";
  if (!isCommercial && !formData.projectType) return "Project Type is required";
  if (!formData.projectName.trim()) return "Project Name is required";
  if (!formData.totalLandArea.trim()) return "Total Land Area is required";

  if (isPlotBased) {
    if (formData.totalPlots === "" || Number(formData.totalPlots) < 0) {
      return "Number of Plots is required and cannot be negative";
    }
    if (formData.plotSize === "CUSTOM" && !formData.customPlotSize.trim()) {
      return "Custom Plot Size is required";
    }
    if (
      formData.plotsAvailable !== ""
      && Number(formData.plotsAvailable) > Number(formData.totalPlots)
    ) {
      return "Plots Available cannot exceed Total Number of Plots";
    }
  }

  if (isBuilding) {
    if (formData.numberOfFlats === "" || Number(formData.numberOfFlats) <= 0) {
      return "Number of Flats must be greater than 0";
    }
    if (formData.numberOfFloors === "" || Number(formData.numberOfFloors) <= 0) {
      return "Number of Floors must be greater than 0";
    }
    if (formData.flatsPerFloor === "" || Number(formData.flatsPerFloor) <= 0) {
      return "Flats Per Floor must be greater than 0";
    }
    if (formData.bhkConfigurations.length === 0) {
      return "At least one BHK configuration is required";
    }
    for (const config of formData.bhkConfigurations) {
      const bhkLabel = getProjectOptionLabel(PROJECT_BHK_OPTIONS, config.bhk);
      if (config.size === "" || Number(config.size) <= 0) {
        return `Flat Size for ${bhkLabel} must be greater than 0`;
      }
      const nonNegativeFields = [
        ["bedrooms", "Bedrooms"],
        ["kitchens", "Kitchens"],
        ["washrooms", "Washrooms"],
        ["drawingRooms", "Drawing Rooms"],
        ["balconies", "Balconies"],
        ["reservedParking", "Reserved Parking"],
      ];
      for (const [field, label] of nonNegativeFields) {
        if (config[field] !== "" && Number(config[field]) < 0) {
          return `${label} for ${bhkLabel} cannot be negative`;
        }
      }
    }
  }

  if (isCommercial) {
    if (formData.totalFloors === "" || Number(formData.totalFloors) <= 0) {
      return "Total Floors must be greater than 0";
    }
    if (formData.officesPerFloor === "" || Number(formData.officesPerFloor) <= 0) {
      return "Offices Per Floor must be greater than 0";
    }

    const unitGroups = [
      ["offices", "Office", formData.offices],
      ["shops", "Shop", formData.shops],
      ["showrooms", "Showroom", formData.showrooms],
    ];
    for (const [, unitLabel, units] of unitGroups) {
      for (let index = 0; index < units.length; index += 1) {
        const unit = units[index];
        const label = `${unitLabel} ${index + 1}`;
        if (unit.length === "" || Number(unit.length) <= 0) {
          return `${label}: Length must be greater than 0`;
        }
        if (unit.breadth === "" || Number(unit.breadth) <= 0) {
          return `${label}: Breadth must be greater than 0`;
        }
        if (unit.height !== "" && Number(unit.height) < 0) {
          return `${label}: Height cannot be negative`;
        }
        if (
          unit.startingRate !== ""
          && unit.currentRate !== ""
          && Number(unit.currentRate) < Number(unit.startingRate)
        ) {
          return `${label}: Current Rate cannot be less than Starting Rate`;
        }
      }
    }
  }

  if (formData.startingRate === "" || Number(formData.startingRate) < 0) {
    return "Starting Rate is required and cannot be negative";
  }
  if (formData.currentRate === "" || Number(formData.currentRate) < 0) {
    return "Current Rate is required and cannot be negative";
  }
  if (Number(formData.currentRate) < Number(formData.startingRate)) {
    return "Current Rate cannot be less than Starting Rate";
  }
  if (!formData.status) return "Status is required";
  if (formData.ownerManagerMobile && !MOBILE_PATTERN.test(formData.ownerManagerMobile)) {
    return "Owner / Manager Mobile must be a valid 10-digit number";
  }
  if (formData.brokerManagerMobile && !MOBILE_PATTERN.test(formData.brokerManagerMobile)) {
    return "Broker Manager Mobile must be a valid 10-digit number";
  }
  return "";
};

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `₹${num.toLocaleString("en-IN")}`;
};

const StatusPill = ({ status }) => {
  const label = getProjectOptionLabel(PROJECT_STATUS_OPTIONS, status) || "-";
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
      {label}
    </span>
  );
};

const ProjectMeta = ({ icon, label, value }) => (
  <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
      {React.createElement(icon, { size: 12 })}
      {label}
    </div>
    <div className="mt-1 truncate text-sm font-semibold text-slate-800">{value ?? "-"}</div>
  </div>
);

const ProjectCard = ({ project, canManage, canDelete, onView, onEdit, onDelete }) => {
  const image = Array.isArray(project?.images) ? project.images[0] : "";
  const imageCount = Array.isArray(project?.images) ? project.images.length : 0;
  const commercial = isCommercialCategory(project?.projectCategory);

  const secondaryMeta = commercial
    ? { label: "Total Offices", value: project.totalOffices ?? project.offices?.length ?? 0 }
    : { label: "Total Plots", value: project.totalPlots ?? "-" };

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg">
      <button
        type="button"
        onClick={() => onView(project)}
        className="relative block h-40 w-full overflow-hidden bg-slate-100 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:h-52"
        aria-label={`View ${project.projectName}`}
      >
        {image ? (
          <img
            src={image}
            alt={project.projectName}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-slate-300">
            <ImageIcon size={34} />
            <span className="mt-2 text-[10px] font-bold uppercase tracking-widest">No Image</span>
          </div>
        )}
        <div className="absolute left-3 top-3">
          <StatusPill status={project?.status} />
        </div>
        {imageCount > 1 && (
          <div className="absolute bottom-3 right-3 rounded-full bg-slate-950/75 px-2 py-1 text-[10px] font-bold text-white">
            +{imageCount - 1} photos
          </div>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-4">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-slate-900">{project.projectName}</h3>
              <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-medium text-slate-500">
                <MapPin size={13} />
                {project.location || "-"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-extrabold text-slate-950">{formatCurrency(project.currentRate)}</div>
              <div className="mt-0.5 font-mono text-[10px] text-slate-400">{project.projectId}</div>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
              {getProjectOptionLabel(PROJECT_CATEGORY_OPTIONS, project.projectCategory)}
            </span>
            {!commercial && project.projectType && (
              <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                {getProjectOptionLabel(PROJECT_TYPE_OPTIONS, project.projectType)}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          <ProjectMeta icon={Layers3} label="Land Area" value={project.totalLandArea} />
          <ProjectMeta icon={Building2} label={secondaryMeta.label} value={secondaryMeta.value} />
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => onView(project)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50"
          >
            <Eye size={14} />
            View
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => onEdit(project)}
              aria-label="Edit project"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            >
              <Pencil size={15} />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(project)}
              aria-label="Delete project"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-white text-red-500 hover:bg-red-50"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

const ProjectsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = String(localStorage.getItem("role") || "").trim().toUpperCase();
  const { canPageAction, enforcePageAccess } = usePermissions();
  const canManage = PROJECT_MANAGE_ROLES.has(role)
    || (enforcePageAccess && canPageAction("projects", "edit"))
    || (enforcePageAccess && canPageAction("projects", "create"));
  const canDelete = PROJECT_DELETE_ROLES.has(role)
    || (enforcePageAccess && canPageAction("projects", "delete"));

  const [projects, setProjects] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 250);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState("");
  const [formData, setFormData] = useState({ ...DEFAULT_FORM });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [collapsedUnits, setCollapsedUnits] = useState(() => new Set());

  useEffect(() => {
    if (!error && !success) return undefined;
    const timer = window.setTimeout(() => {
      setError("");
      setSuccess("");
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [error, success]);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: PAGE_LIMIT };
      if (debouncedSearchTerm.trim()) params.search = debouncedSearchTerm.trim();
      if (categoryFilter !== "all") params.projectCategory = categoryFilter;
      if (typeFilter !== "all") params.projectType = typeFilter;
      if (statusFilter !== "all") params.status = statusFilter;

      const result = await getProjectsWithMeta(params);
      setProjects(result.projects);
      setPagination(result.pagination);
    } catch (fetchError) {
      setError(toErrorMessage(fetchError, "Failed to load projects"));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearchTerm, categoryFilter, typeFilter, statusFilter]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, categoryFilter, typeFilter, statusFilter]);

  const resetForm = () => {
    setFormData({ ...DEFAULT_FORM });
    setFormError("");
    setEditingProjectId("");
  };

  const openAddModal = () => {
    resetForm();
    setIsFormModalOpen(true);
  };

  const openEditModal = async (project) => {
    setFormError("");
    setEditingProjectId(project._id);
    setFormData(toFormFromProject(project));
    setIsFormModalOpen(true);
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    resetForm();
  };

  const handleAmenityToggle = (amenityValue) => {
    setFormData((prev) => {
      const has = prev.amenities.includes(amenityValue);
      return {
        ...prev,
        amenities: has
          ? prev.amenities.filter((item) => item !== amenityValue)
          : [...prev.amenities, amenityValue],
      };
    });
  };

  const handleBhkToggle = (bhkValue) => {
    setFormData((prev) => {
      const exists = prev.bhkConfigurations.some((config) => config.bhk === bhkValue);
      return {
        ...prev,
        bhkConfigurations: exists
          ? prev.bhkConfigurations.filter((config) => config.bhk !== bhkValue)
          : [...prev.bhkConfigurations, { ...DEFAULT_BHK_CONFIG, bhk: bhkValue }],
      };
    });
  };

  const handleBhkFieldChange = (bhkValue, field, value) => {
    setFormData((prev) => ({
      ...prev,
      bhkConfigurations: prev.bhkConfigurations.map((config) =>
        config.bhk === bhkValue ? { ...config, [field]: value } : config),
    }));
  };

  const handleCategoryChange = (nextCategory) => {
    setFormData((prev) => ({
      ...prev,
      projectCategory: nextCategory,
      projectType: "",
    }));
  };

  const toggleUnitCollapse = (unitKey) => {
    setCollapsedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitKey)) next.delete(unitKey);
      else next.add(unitKey);
      return next;
    });
  };

  const addUnit = (groupKey, defaults, codePrefix, codeField) => {
    setFormData((prev) => {
      const nextIndex = prev[groupKey].length + 1;
      const newUnit = {
        ...defaults,
        _key: makeUnitKey(),
        [codeField]: `${codePrefix}-${String(nextIndex).padStart(3, "0")}`,
      };
      return { ...prev, [groupKey]: [...prev[groupKey], newUnit] };
    });
  };

  const duplicateUnit = (groupKey, unitKey) => {
    setFormData((prev) => {
      const source = prev[groupKey].find((unit) => unit._key === unitKey);
      if (!source) return prev;
      const duplicate = { ...source, _key: makeUnitKey() };
      const sourceIndex = prev[groupKey].findIndex((unit) => unit._key === unitKey);
      const nextGroup = [...prev[groupKey]];
      nextGroup.splice(sourceIndex + 1, 0, duplicate);
      return { ...prev, [groupKey]: nextGroup };
    });
  };

  const removeUnit = (groupKey, unitKey) => {
    setFormData((prev) => ({
      ...prev,
      [groupKey]: prev[groupKey].filter((unit) => unit._key !== unitKey),
    }));
  };

  const updateUnitField = (groupKey, unitKey, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [groupKey]: prev[groupKey].map((unit) => {
        if (unit._key !== unitKey) return unit;
        const nextUnit = { ...unit, [field]: value };
        if (field === "length" || field === "breadth") {
          const length = Number(field === "length" ? value : unit.length);
          const breadth = Number(field === "breadth" ? value : unit.breadth);
          if (Number.isFinite(length) && Number.isFinite(breadth) && length > 0 && breadth > 0) {
            nextUnit.carpetArea = String(Math.round(length * breadth * 100) / 100);
          }
        }
        return nextUnit;
      }),
    }));
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploadingImages(true);
    const newImageUrls = [];
    const failedFiles = [];

    for (const file of files) {
      try {
        const result = await uploadFile(file, "project-images");
        newImageUrls.push(result.url);
      } catch (uploadError) {
        failedFiles.push(`${file.name}: ${toErrorMessage(uploadError, "unknown error")}`);
      }
    }

    if (newImageUrls.length) {
      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...newImageUrls],
      }));
    }
    if (failedFiles.length) {
      setFormError(`Failed to upload: ${failedFiles.join(", ")}`);
    }

    setUploadingImages(false);
    e.target.value = null;
  };

  const removeImage = (urlToRemove) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((url) => url !== urlToRemove),
    }));
  };

  const renderUnitCard = (unit, fields, groupKey, codeField, codeLabel) => {
    const isCollapsed = collapsedUnits.has(unit._key);
    return (
      <div key={unit._key} className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <button
            type="button"
            onClick={() => toggleUnitCollapse(unit._key)}
            className="flex flex-1 items-center gap-2 text-left"
          >
            {isCollapsed ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
            <span className="text-xs font-bold text-slate-800">{unit[codeField] || codeLabel}</span>
            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
              {getProjectOptionLabel(PROJECT_UNIT_STATUS_OPTIONS, unit.status)}
            </span>
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Duplicate"
              onClick={() => duplicateUnit(groupKey, unit._key)}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <Copy size={13} />
            </button>
            <button
              type="button"
              title="Delete"
              onClick={() => removeUnit(groupKey, unit._key)}
              className="rounded-lg border border-red-200 p-1.5 text-red-500 hover:bg-red-50"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="border-t border-slate-100 p-3">
            <div className="mb-2.5">
              <label className={FIELD_TITLE_CLASS}>{codeLabel} Number / Code</label>
              <input
                type="text"
                value={unit[codeField]}
                onChange={(e) => updateUnitField(groupKey, unit._key, codeField, e.target.value)}
                className={`${INPUT_CLASS} mt-1 sm:max-w-xs`}
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {fields.map((field) => (
                <div key={field.key} className={field.type === "textarea" ? "col-span-2 sm:col-span-4" : ""}>
                  <label className={FIELD_TITLE_CLASS}>{field.label}</label>
                  {field.type === "select" ? (
                    <select
                      value={unit[field.key]}
                      onChange={(e) => updateUnitField(groupKey, unit._key, field.key, e.target.value)}
                      className={`${INPUT_CLASS} mt-1`}
                    >
                      <option value="">Select</option>
                      {field.options.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : field.type === "floor" ? (
                    <select
                      value={unit.floorNumber}
                      onChange={(e) => updateUnitField(groupKey, unit._key, "floorNumber", e.target.value)}
                      className={`${INPUT_CLASS} mt-1`}
                    >
                      <option value="">Select floor</option>
                      {Array.from({ length: Number(formData.totalFloors) || 0 }, (_, i) => i + 1).map((floor) => (
                        <option key={floor} value={floor}>{floor}</option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      rows={2}
                      value={unit[field.key]}
                      onChange={(e) => updateUnitField(groupKey, unit._key, field.key, e.target.value)}
                      className="mt-1 w-full resize-none rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
                    />
                  ) : (
                    <input
                      type={field.type}
                      min={field.type === "number" ? "0" : undefined}
                      value={unit[field.key]}
                      placeholder={field.placeholder}
                      onChange={(e) => updateUnitField(groupKey, unit._key, field.key, e.target.value)}
                      className={`${INPUT_CLASS} mt-1`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Keep Total Offices synced to the office list length whenever it changes, while still
  // letting the user manually override the number afterward (per "auto-calculated but editable").
  useEffect(() => {
    setFormData((prev) => ({ ...prev, totalOffices: String(prev.offices.length) }));
  }, [formData.offices.length]);

  const handleSubmit = async () => {
    const validationError = validateForm(formData);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload = buildProjectPayload(formData);
      if (editingProjectId) {
        await updateProject(editingProjectId, payload);
        setSuccess("Project updated successfully");
      } else {
        await createProject(payload);
        setSuccess("Project created successfully");
      }
      closeFormModal();
      await fetchProjects();
    } catch (submitError) {
      setFormError(toErrorMessage(submitError, "Failed to save project"));
    } finally {
      setSaving(false);
    }
  };

  const goToProjectDetails = (project) => {
    navigate(`/projects/${project._id}`);
  };

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId) return;

    getProjectById(editId)
      .then((project) => {
        if (project) openEditModal(project);
      })
      .catch((editLoadError) => {
        setError(toErrorMessage(editLoadError, "Failed to load project for editing"));
      })
      .finally(() => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete("edit");
          return next;
        }, { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProject(deleteTarget._id);
      setSuccess("Project deleted");
      setDeleteTarget(null);
      await fetchProjects();
    } catch (deleteError) {
      setError(toErrorMessage(deleteError, "Failed to delete project"));
    } finally {
      setDeleting(false);
    }
  };

  const emptyState = !loading && projects.length === 0;

  const paginationSummary = useMemo(() => {
    if (!pagination) return "";
    const { page: currentPage, limit, totalCount } = pagination;
    if (!totalCount) return "";
    const start = (currentPage - 1) * limit + 1;
    const end = Math.min(currentPage * limit, totalCount);
    return `Showing ${start}-${end} of ${totalCount}`;
  }, [pagination]);

  return (
    <div className="ui-page-shell projects-page custom-scrollbar relative flex flex-col bg-slate-50/50">
      <ToastNotice message={error} type="error" />
      <ToastNotice message={success} type="success" />

      <div className="flex flex-wrap items-center justify-between gap-3 py-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">Projects</h1>
          <p className="text-xs text-slate-500">Manage plotting, building, and villa/farmhouse projects</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-800"
          >
            <Plus size={14} />
            New Project
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by project name, ID, or location"
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
        >
          <option value="all">Category (All)</option>
          {PROJECT_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
        >
          <option value="all">Type (All)</option>
          {PROJECT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
        >
          <option value="all">Status (All)</option>
          {PROJECT_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="mt-3 grid grid-cols-1 gap-3 pb-8 sm:gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
              <div className="h-40 w-full rounded-xl bg-slate-100 sm:h-52" />
              <div className="mt-4 h-5 w-3/4 rounded bg-slate-100" />
              <div className="mt-2 h-4 w-1/2 rounded bg-slate-100" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="h-12 rounded-xl bg-slate-100" />
                <div className="h-12 rounded-xl bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {emptyState && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-14 text-center">
          <Building2 size={28} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-bold text-slate-500">No projects found</p>
          <p className="text-xs text-slate-400">Try adjusting your search or filters</p>
        </div>
      )}

      {!loading && !emptyState && (
        <div className="mt-3 grid grid-cols-1 gap-3 pb-8 sm:gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project._id}
              project={project}
              canManage={canManage}
              canDelete={canDelete}
              onView={goToProjectDetails}
              onEdit={openEditModal}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {pagination && pagination.totalCount > 0 && (
        <div className="flex items-center justify-between py-3 text-xs text-slate-500">
          <span>{paginationSummary}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!pagination.hasPrevPage}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((prev) => prev + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-6">
              <h2 className="text-base font-extrabold text-slate-900">
                {editingProjectId ? "Edit Project" : "New Project"}
              </h2>
              <button type="button" onClick={closeFormModal} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <ToastNotice message={formError} type="error" />

            <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-6">
              <div className={SECTION_CLASS}>
                <div className={SECTION_HEADING_CLASS}>Basic Information</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={FIELD_TITLE_CLASS}>Project Category *</label>
                    <select
                      value={formData.projectCategory}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className={`${INPUT_CLASS} mt-1`}
                    >
                      <option value="">Select category</option>
                      {PROJECT_CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  {!isCommercialCategory(formData.projectCategory) && (
                    <div>
                      <label className={FIELD_TITLE_CLASS}>Project Type *</label>
                      <select
                        value={formData.projectType}
                        onChange={(e) => setFormData((prev) => ({ ...prev, projectType: e.target.value }))}
                        className={`${INPUT_CLASS} mt-1`}
                      >
                        <option value="">Select type</option>
                        {PROJECT_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className={FIELD_TITLE_CLASS}>Project Name *</label>
                    <input
                      type="text"
                      value={formData.projectName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, projectName: e.target.value }))}
                      placeholder="e.g. Sunrise Meadows"
                      className={`${INPUT_CLASS} mt-1`}
                    />
                  </div>
                  <div>
                    <label className={FIELD_TITLE_CLASS}>Total Land Area *</label>
                    <input
                      type="text"
                      value={formData.totalLandArea}
                      onChange={(e) => setFormData((prev) => ({ ...prev, totalLandArea: e.target.value }))}
                      placeholder="Example: 20 Acres"
                      className={`${INPUT_CLASS} mt-1`}
                    />
                  </div>

                  {isCommercialCategory(formData.projectCategory) ? (
                    <>
                      <div>
                        <label className={FIELD_TITLE_CLASS}>Total Floors *</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.totalFloors}
                          onChange={(e) => setFormData((prev) => ({ ...prev, totalFloors: e.target.value }))}
                          className={`${INPUT_CLASS} mt-1`}
                        />
                      </div>
                      <div>
                        <label className={FIELD_TITLE_CLASS}>Offices Per Floor *</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.officesPerFloor}
                          onChange={(e) => setFormData((prev) => ({ ...prev, officesPerFloor: e.target.value }))}
                          className={`${INPUT_CLASS} mt-1`}
                        />
                      </div>
                      <div>
                        <label className={FIELD_TITLE_CLASS}>Total Offices</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.totalOffices}
                          onChange={(e) => setFormData((prev) => ({ ...prev, totalOffices: e.target.value }))}
                          placeholder="Auto-calculated from Office Inventory"
                          className={`${INPUT_CLASS} mt-1`}
                        />
                      </div>
                      <div>
                        <label className={FIELD_TITLE_CLASS}>Total Shops</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.totalShops}
                          onChange={(e) => setFormData((prev) => ({ ...prev, totalShops: e.target.value }))}
                          className={`${INPUT_CLASS} mt-1`}
                        />
                      </div>
                      <div>
                        <label className={FIELD_TITLE_CLASS}>Total Showrooms</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.totalShowrooms}
                          onChange={(e) => setFormData((prev) => ({ ...prev, totalShowrooms: e.target.value }))}
                          className={`${INPUT_CLASS} mt-1`}
                        />
                      </div>
                    </>
                  ) : isBuildingType(formData.projectType) ? (
                    <>
                      <div>
                        <label className={FIELD_TITLE_CLASS}>Number of Flats *</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.numberOfFlats}
                          onChange={(e) => setFormData((prev) => ({ ...prev, numberOfFlats: e.target.value }))}
                          className={`${INPUT_CLASS} mt-1`}
                        />
                      </div>
                      <div>
                        <label className={FIELD_TITLE_CLASS}>Number of Floors *</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.numberOfFloors}
                          onChange={(e) => setFormData((prev) => ({ ...prev, numberOfFloors: e.target.value }))}
                          className={`${INPUT_CLASS} mt-1`}
                        />
                      </div>
                      <div>
                        <label className={FIELD_TITLE_CLASS}>Flats Per Floor *</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.flatsPerFloor}
                          onChange={(e) => setFormData((prev) => ({ ...prev, flatsPerFloor: e.target.value }))}
                          className={`${INPUT_CLASS} mt-1`}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className={FIELD_TITLE_CLASS}>Number of Plots *</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.totalPlots}
                          onChange={(e) => setFormData((prev) => ({ ...prev, totalPlots: e.target.value }))}
                          className={`${INPUT_CLASS} mt-1`}
                        />
                      </div>
                      <div>
                        <label className={FIELD_TITLE_CLASS}>Plot Size</label>
                        <select
                          value={formData.plotSize}
                          onChange={(e) => setFormData((prev) => ({ ...prev, plotSize: e.target.value }))}
                          className={`${INPUT_CLASS} mt-1`}
                        >
                          <option value="">Select plot size</option>
                          {PROJECT_PLOT_SIZE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      {formData.plotSize === "CUSTOM" && (
                        <div>
                          <label className={FIELD_TITLE_CLASS}>Custom Plot Size</label>
                          <input
                            type="text"
                            value={formData.customPlotSize}
                            onChange={(e) => setFormData((prev) => ({ ...prev, customPlotSize: e.target.value }))}
                            placeholder="1350 Sq.ft"
                            className={`${INPUT_CLASS} mt-1`}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {isCommercialCategory(formData.projectCategory) && (
                <div className={SECTION_CLASS}>
                  <div className={SECTION_HEADING_CLASS}>Summary</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
                    {[
                      ["Total Floors", formData.totalFloors || 0],
                      ["Total Offices", formData.offices.length],
                      ["Total Shops", formData.shops.length],
                      ["Total Showrooms", formData.showrooms.length],
                      ["Available Units", [...formData.offices, ...formData.shops, ...formData.showrooms].filter((unit) => unit.status === "AVAILABLE").length],
                      ["Sold / Leased Units", [...formData.offices, ...formData.shops, ...formData.showrooms].filter((unit) => SOLD_LIKE_UNIT_STATUSES.has(unit.status)).length],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-slate-200 bg-white p-2.5 text-center">
                        <div className="text-lg font-extrabold text-slate-900">{value}</div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isCommercialCategory(formData.projectCategory) && (
                <div className={SECTION_CLASS}>
                  <div className="mb-3 flex items-center justify-between">
                    <div className={`${SECTION_HEADING_CLASS} mb-0`}>Office Inventory</div>
                    <button
                      type="button"
                      onClick={() => addUnit("offices", DEFAULT_OFFICE, "OFF", "officeCode")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-slate-800"
                    >
                      <Plus size={12} /> Add Office
                    </button>
                  </div>
                  {formData.offices.length === 0 ? (
                    <p className="text-xs text-slate-400">No offices added yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {formData.offices.map((office) => renderUnitCard(office, OFFICE_FIELDS, "offices", "officeCode", "Office"))}
                    </div>
                  )}
                </div>
              )}

              {isCommercialCategory(formData.projectCategory) && (
                <div className={SECTION_CLASS}>
                  <div className="mb-3 flex items-center justify-between">
                    <div className={`${SECTION_HEADING_CLASS} mb-0`}>Shop Inventory</div>
                    <button
                      type="button"
                      onClick={() => addUnit("shops", DEFAULT_SHOP, "SHOP", "shopCode")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-slate-800"
                    >
                      <Plus size={12} /> Add Shop
                    </button>
                  </div>
                  {formData.shops.length === 0 ? (
                    <p className="text-xs text-slate-400">No shops added yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {formData.shops.map((shop) => renderUnitCard(shop, SHOP_FIELDS, "shops", "shopCode", "Shop"))}
                    </div>
                  )}
                </div>
              )}

              {isCommercialCategory(formData.projectCategory) && (
                <div className={SECTION_CLASS}>
                  <div className="mb-3 flex items-center justify-between">
                    <div className={`${SECTION_HEADING_CLASS} mb-0`}>Showroom Inventory</div>
                    <button
                      type="button"
                      onClick={() => addUnit("showrooms", DEFAULT_SHOWROOM, "SR", "showroomCode")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-slate-800"
                    >
                      <Plus size={12} /> Add Showroom
                    </button>
                  </div>
                  {formData.showrooms.length === 0 ? (
                    <p className="text-xs text-slate-400">No showrooms added yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {formData.showrooms.map((showroom) => renderUnitCard(showroom, SHOWROOM_FIELDS, "showrooms", "showroomCode", "Showroom"))}
                    </div>
                  )}
                </div>
              )}

              {isBuildingType(formData.projectType) && (
                <div className={SECTION_CLASS}>
                  <div className={SECTION_HEADING_CLASS}>Flat Configuration</div>
                  <div>
                    <label className={FIELD_TITLE_CLASS}>BHK Configuration *</label>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {PROJECT_BHK_OPTIONS.map((option) => (
                        <label key={option.value} className={CHECKBOX_CLASS}>
                          <input
                            type="checkbox"
                            checked={formData.bhkConfigurations.some((config) => config.bhk === option.value)}
                            onChange={() => handleBhkToggle(option.value)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {formData.bhkConfigurations.length > 0 && (
                    <div className="mt-3 space-y-3">
                      {formData.bhkConfigurations.map((config) => (
                        <div key={config.bhk} className="rounded-lg border border-slate-200 bg-white p-3">
                          <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-emerald-700">
                            {getProjectOptionLabel(PROJECT_BHK_OPTIONS, config.bhk)}
                          </div>
                          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                            <div>
                              <label className={FIELD_TITLE_CLASS}>Flat Size (Sq.ft) *</label>
                              <input
                                type="number"
                                min="0"
                                value={config.size}
                                onChange={(e) => handleBhkFieldChange(config.bhk, "size", e.target.value)}
                                placeholder="1250"
                                className={`${INPUT_CLASS} mt-1`}
                              />
                            </div>
                            <div>
                              <label className={FIELD_TITLE_CLASS}>Bedrooms</label>
                              <input
                                type="number"
                                min="0"
                                value={config.bedrooms}
                                onChange={(e) => handleBhkFieldChange(config.bhk, "bedrooms", e.target.value)}
                                className={`${INPUT_CLASS} mt-1`}
                              />
                            </div>
                            <div>
                              <label className={FIELD_TITLE_CLASS}>Kitchens</label>
                              <input
                                type="number"
                                min="0"
                                value={config.kitchens}
                                onChange={(e) => handleBhkFieldChange(config.bhk, "kitchens", e.target.value)}
                                className={`${INPUT_CLASS} mt-1`}
                              />
                            </div>
                            <div>
                              <label className={FIELD_TITLE_CLASS}>Washrooms</label>
                              <input
                                type="number"
                                min="0"
                                value={config.washrooms}
                                onChange={(e) => handleBhkFieldChange(config.bhk, "washrooms", e.target.value)}
                                className={`${INPUT_CLASS} mt-1`}
                              />
                            </div>
                            <div>
                              <label className={FIELD_TITLE_CLASS}>Drawing / Living Rooms</label>
                              <input
                                type="number"
                                min="0"
                                value={config.drawingRooms}
                                onChange={(e) => handleBhkFieldChange(config.bhk, "drawingRooms", e.target.value)}
                                className={`${INPUT_CLASS} mt-1`}
                              />
                            </div>
                            <div>
                              <label className={FIELD_TITLE_CLASS}>Balconies</label>
                              <input
                                type="number"
                                min="0"
                                value={config.balconies}
                                onChange={(e) => handleBhkFieldChange(config.bhk, "balconies", e.target.value)}
                                className={`${INPUT_CLASS} mt-1`}
                              />
                            </div>
                            <div>
                              <label className={FIELD_TITLE_CLASS}>Servant Room</label>
                              <select
                                value={config.servantRoom ? "yes" : "no"}
                                onChange={(e) => handleBhkFieldChange(config.bhk, "servantRoom", e.target.value === "yes")}
                                className={`${INPUT_CLASS} mt-1`}
                              >
                                <option value="no">No</option>
                                <option value="yes">Yes</option>
                              </select>
                            </div>
                            <div>
                              <label className={FIELD_TITLE_CLASS}>Reserved Parking</label>
                              <input
                                type="number"
                                min="0"
                                value={config.reservedParking}
                                onChange={(e) => handleBhkFieldChange(config.bhk, "reservedParking", e.target.value)}
                                placeholder="2"
                                className={`${INPUT_CLASS} mt-1`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className={SECTION_CLASS}>
                <div className={SECTION_HEADING_CLASS}>Pricing</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={FIELD_TITLE_CLASS}>PLC (Preferential Location Charges)</label>
                    <input
                      type="text"
                      value={formData.plc}
                      onChange={(e) => setFormData((prev) => ({ ...prev, plc: e.target.value }))}
                      placeholder="e.g. 5% or ₹50,000"
                      className={`${INPUT_CLASS} mt-1`}
                    />
                  </div>
                  <div>
                    <label className={FIELD_TITLE_CLASS}>Group</label>
                    <input
                      type="text"
                      value={formData.group}
                      onChange={(e) => setFormData((prev) => ({ ...prev, group: e.target.value }))}
                      placeholder="e.g. Group A, Premium"
                      className={`${INPUT_CLASS} mt-1`}
                    />
                  </div>
                  <div>
                    <label className={FIELD_TITLE_CLASS}>Starting Rate Per Sq.ft *</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.startingRate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, startingRate: e.target.value }))}
                      placeholder="₹1500"
                      className={`${INPUT_CLASS} mt-1`}
                    />
                  </div>
                  <div>
                    <label className={FIELD_TITLE_CLASS}>Current Rate Per Sq.ft *</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.currentRate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, currentRate: e.target.value }))}
                      placeholder="₹1800"
                      className={`${INPUT_CLASS} mt-1`}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={FIELD_TITLE_CLASS}>Other Charges</label>
                    <textarea
                      rows={2}
                      value={formData.otherCharges}
                      onChange={(e) => setFormData((prev) => ({ ...prev, otherCharges: e.target.value }))}
                      placeholder="Maintenance, Electricity, Water Connection, Registry, Club Charges"
                      className="mt-1 w-full resize-none rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className={SECTION_CLASS}>
                <div className={SECTION_HEADING_CLASS}>Project Status</div>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                  className={`${INPUT_CLASS} sm:max-w-xs`}
                >
                  <option value="">Select status</option>
                  {PROJECT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className={SECTION_CLASS}>
                <div className={SECTION_HEADING_CLASS}>Amenities</div>
                <div className="flex flex-wrap gap-2">
                  {(isCommercialCategory(formData.projectCategory) ? PROJECT_COMMERCIAL_AMENITY_OPTIONS : PROJECT_AMENITY_OPTIONS).map((option) => (
                    <label key={option.value} className={CHECKBOX_CLASS}>
                      <input
                        type="checkbox"
                        checked={formData.amenities.includes(option.value)}
                        onChange={() => handleAmenityToggle(option.value)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              {!isCommercialCategory(formData.projectCategory) && (
                <div className={SECTION_CLASS}>
                  <div className={SECTION_HEADING_CLASS}>Housing Category</div>
                  <select
                    value={formData.housingCategory}
                    onChange={(e) => setFormData((prev) => ({ ...prev, housingCategory: e.target.value }))}
                    className={`${INPUT_CLASS} sm:max-w-xs`}
                  >
                    <option value="">Select housing category</option>
                    {PROJECT_HOUSING_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className={SECTION_CLASS}>
                <div className={SECTION_HEADING_CLASS}>Location</div>
                <div>
                  <label className={FIELD_TITLE_CLASS}>Complete Address</label>
                  <textarea
                    rows={2}
                    value={formData.location}
                    onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="Complete address"
                    className="mt-1 w-full resize-none rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                {isCommercialCategory(formData.projectCategory) && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className={FIELD_TITLE_CLASS}>Landmark</label>
                      <input
                        type="text"
                        value={formData.landmark}
                        onChange={(e) => setFormData((prev) => ({ ...prev, landmark: e.target.value }))}
                        className={`${INPUT_CLASS} mt-1`}
                      />
                    </div>
                    <div>
                      <label className={FIELD_TITLE_CLASS}>City</label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                        className={`${INPUT_CLASS} mt-1`}
                      />
                    </div>
                    <div>
                      <label className={FIELD_TITLE_CLASS}>State</label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                        className={`${INPUT_CLASS} mt-1`}
                      />
                    </div>
                    <div>
                      <label className={FIELD_TITLE_CLASS}>Pincode</label>
                      <input
                        type="text"
                        value={formData.pincode}
                        onChange={(e) => setFormData((prev) => ({ ...prev, pincode: e.target.value }))}
                        className={`${INPUT_CLASS} mt-1`}
                      />
                    </div>
                    <div>
                      <label className={FIELD_TITLE_CLASS}>Latitude (Optional)</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.locationLat}
                        onChange={(e) => setFormData((prev) => ({ ...prev, locationLat: e.target.value }))}
                        className={`${INPUT_CLASS} mt-1`}
                      />
                    </div>
                    <div>
                      <label className={FIELD_TITLE_CLASS}>Longitude (Optional)</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.locationLng}
                        onChange={(e) => setFormData((prev) => ({ ...prev, locationLng: e.target.value }))}
                        className={`${INPUT_CLASS} mt-1`}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className={SECTION_CLASS}>
                <div className={SECTION_HEADING_CLASS}>Owner / Manager</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={FIELD_TITLE_CLASS}>Owner / Manager Name</label>
                    <input
                      type="text"
                      value={formData.ownerManagerName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, ownerManagerName: e.target.value }))}
                      className={`${INPUT_CLASS} mt-1`}
                    />
                  </div>
                  <div>
                    <label className={FIELD_TITLE_CLASS}>Owner / Manager Mobile</label>
                    <input
                      type="tel"
                      value={formData.ownerManagerMobile}
                      onChange={(e) => setFormData((prev) => ({ ...prev, ownerManagerMobile: e.target.value }))}
                      placeholder="e.g. 9876543210"
                      className={`${INPUT_CLASS} mt-1`}
                    />
                  </div>
                </div>
              </div>

              <div className={SECTION_CLASS}>
                <div className={SECTION_HEADING_CLASS}>Broker Manager</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={FIELD_TITLE_CLASS}>Broker Manager Name</label>
                    <input
                      type="text"
                      value={formData.brokerManagerName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, brokerManagerName: e.target.value }))}
                      className={`${INPUT_CLASS} mt-1`}
                    />
                  </div>
                  <div>
                    <label className={FIELD_TITLE_CLASS}>Broker Manager Mobile</label>
                    <input
                      type="tel"
                      value={formData.brokerManagerMobile}
                      onChange={(e) => setFormData((prev) => ({ ...prev, brokerManagerMobile: e.target.value }))}
                      placeholder="e.g. 9876543210"
                      className={`${INPUT_CLASS} mt-1`}
                    />
                  </div>
                </div>
              </div>

              {isPlotBasedType(formData.projectType) && (
                <div className={SECTION_CLASS}>
                  <div className={SECTION_HEADING_CLASS}>Inventory</div>
                  <div className="sm:max-w-xs">
                    <label className={FIELD_TITLE_CLASS}>Plots Available With Us</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.plotsAvailable}
                      onChange={(e) => setFormData((prev) => ({ ...prev, plotsAvailable: e.target.value }))}
                      className={`${INPUT_CLASS} mt-1`}
                    />
                  </div>
                </div>
              )}

              <div className={SECTION_CLASS}>
                <div className={SECTION_HEADING_CLASS}>Project Media</div>
                <label className={`${FIELD_TITLE_CLASS} mb-2 block`}>Project Photos</label>

                {formData.images.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {formData.images.map((url, index) => (
                      <div
                        key={`${url}-${index}`}
                        className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg"
                      >
                        <img src={url} className="h-full w-full object-cover" alt="project" />
                        <button
                          type="button"
                          onClick={() => removeImage(url)}
                          className="absolute right-0 top-0 bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex w-full items-center justify-center">
                  <label
                    className={`flex h-24 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 transition-all hover:bg-slate-100 ${
                      uploadingImages ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center pb-6 pt-5">
                      {uploadingImages ? (
                        <Loader className="mb-2 animate-spin text-slate-400" size={24} />
                      ) : (
                        <UploadCloud className="mb-2 text-slate-400" size={24} />
                      )}
                      <p className="text-xs font-bold text-slate-500">
                        {uploadingImages ? "Uploading..." : "Click to upload photos"}
                      </p>
                      <p className="text-[10px] text-slate-400">SVG, PNG, JPG</p>
                    </div>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImages}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mobile-safe-footer flex shrink-0 gap-3 border-t border-slate-100 bg-slate-50/50 px-4 pt-3 sm:p-6">
              <button
                type="button"
                onClick={closeFormModal}
                className="flex-1 rounded-xl py-3 text-xs font-bold uppercase text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className={`flex-1 rounded-xl py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg transition-all ${
                  saving ? "cursor-not-allowed bg-slate-400" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {saving ? "Saving..." : "Save Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-extrabold text-slate-900">Delete Project?</h2>
            <p className="mt-2 text-sm text-slate-500">
              Are you sure you want to delete <span className="font-bold text-slate-700">{deleteTarget.projectName}</span>? This action cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl py-2.5 text-xs font-bold uppercase text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className={`flex-1 rounded-xl py-2.5 text-xs font-bold uppercase tracking-widest text-white ${
                  deleting ? "cursor-not-allowed bg-slate-400" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
