import {
  PLOT_BASED_PROJECT_TYPES,
  PROJECT_BHK_OPTIONS,
  PROJECT_FACING_OPTIONS,
  PROJECT_OFFICE_TYPE_OPTIONS,
  PROJECT_UNIT_STATUS_OPTIONS,
  getProjectOptionLabel,
  type ProjectOption,
} from "../../config/projectConfig";

/*
 * The project form's rules - a port of the pure half of
 * frontend/src/modules/inventory/Projects.jsx: the defaults, the per-unit field
 * lists, toFormFromProject, buildProjectPayload and validateForm.
 *
 * A project saved from the phone must be the record the desk would save, so
 * the payload builder and the validation messages are web's, unchanged. Kept
 * free of React so they can be tested; see test/projectForm.test.cjs.
 */

export const isPlotBasedType = (projectType?: string) => PLOT_BASED_PROJECT_TYPES.includes(String(projectType || ""));
export const isBuildingType = (projectType?: string) => projectType === "BUILDING";
export const isCommercialCategory = (projectCategory?: string) => projectCategory === "COMMERCIAL";

export const makeUnitKey = () => `unit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export type Unit = Record<string, string> & { _key: string };

export const DEFAULT_OFFICE: Record<string, string> = {
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

export const DEFAULT_SHOP: Record<string, string> = {
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

export const DEFAULT_SHOWROOM: Record<string, string> = {
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

export const SOLD_LIKE_UNIT_STATUSES = new Set(["SOLD", "LEASED", "BOOKED"]);

export type BhkConfig = {
  bhk: string;
  size: string;
  bedrooms: string;
  kitchens: string;
  washrooms: string;
  drawingRooms: string;
  balconies: string;
  servantRoom: boolean;
  reservedParking: string;
};

export const DEFAULT_BHK_CONFIG: Omit<BhkConfig, "bhk"> = {
  size: "",
  bedrooms: "",
  kitchens: "",
  washrooms: "",
  drawingRooms: "",
  balconies: "",
  servantRoom: false,
  reservedParking: "",
};

export type UnitField = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "floor" | "textarea";
  options?: ProjectOption[];
  placeholder?: string;
};

export const OFFICE_FIELDS: UnitField[] = [
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

export const SHOP_FIELDS: UnitField[] = [
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

export const SHOWROOM_FIELDS: UnitField[] = [
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

export const PROJECT_MANAGE_ROLES = new Set(["ADMIN", "MANAGER"]);
export const PROJECT_DELETE_ROLES = new Set(["ADMIN"]);
const MOBILE_PATTERN = /^[0-9]{10}$/;

export type ProjectFormData = {
  projectCategory: string;
  projectType: string;
  projectName: string;
  totalLandArea: string;
  totalPlots: string;
  plotSize: string;
  customPlotSize: string;
  numberOfFlats: string;
  numberOfFloors: string;
  flatsPerFloor: string;
  bhkConfigurations: BhkConfig[];
  totalFloors: string;
  totalOffices: string;
  officesPerFloor: string;
  totalShops: string;
  totalShowrooms: string;
  offices: Unit[];
  shops: Unit[];
  showrooms: Unit[];
  plc: string;
  group: string;
  startingRate: string;
  currentRate: string;
  otherCharges: string;
  status: string;
  amenities: string[];
  housingCategory: string;
  location: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  locationLat: string;
  locationLng: string;
  ownerManagerName: string;
  ownerManagerMobile: string;
  brokerManagerName: string;
  brokerManagerMobile: string;
  plotsAvailable: string;
  images: string[];
};

export const DEFAULT_FORM: ProjectFormData = {
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

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));

const toUnits = (rows: unknown, defaults: Record<string, string>): Unit[] =>
  Array.isArray(rows)
    ? rows.map((entry: any) => {
        const unit: Record<string, string> = { ...defaults };
        Object.keys(entry || {}).forEach((key) => {
          unit[key] = str(entry[key]);
        });
        return { ...unit, _key: String(entry?._id || makeUnitKey()) } as Unit;
      })
    : [];

export const toFormFromProject = (project: any = {}): ProjectFormData => ({
  projectCategory: project.projectCategory || "",
  projectType: project.projectType || "",
  projectName: project.projectName || "",
  totalLandArea: project.totalLandArea || "",
  totalPlots: str(project.totalPlots ?? ""),
  plotSize: project.plotSize || "",
  customPlotSize: project.customPlotSize || "",
  numberOfFlats: str(project.numberOfFlats ?? ""),
  numberOfFloors: str(project.numberOfFloors ?? ""),
  flatsPerFloor: str(project.flatsPerFloor ?? ""),
  bhkConfigurations: Array.isArray(project.bhkConfigurations)
    ? project.bhkConfigurations.map((entry: any) => ({
        bhk: entry.bhk,
        size: str(entry.size ?? ""),
        bedrooms: str(entry.bedrooms ?? ""),
        kitchens: str(entry.kitchens ?? ""),
        washrooms: str(entry.washrooms ?? ""),
        drawingRooms: str(entry.drawingRooms ?? ""),
        balconies: str(entry.balconies ?? ""),
        servantRoom: Boolean(entry.servantRoom),
        reservedParking: str(entry.reservedParking ?? ""),
      }))
    : [],
  totalFloors: str(project.totalFloors ?? ""),
  totalOffices: str(project.totalOffices ?? ""),
  officesPerFloor: str(project.officesPerFloor ?? ""),
  totalShops: str(project.totalShops ?? ""),
  totalShowrooms: str(project.totalShowrooms ?? ""),
  offices: toUnits(project.offices, DEFAULT_OFFICE),
  shops: toUnits(project.shops, DEFAULT_SHOP),
  showrooms: toUnits(project.showrooms, DEFAULT_SHOWROOM),
  plc: project.plc || "",
  group: project.group || "",
  startingRate: str(project.startingRate ?? ""),
  currentRate: str(project.currentRate ?? ""),
  otherCharges: project.otherCharges || "",
  status: project.status || "",
  amenities: Array.isArray(project.amenities) ? project.amenities : [],
  housingCategory: project.housingCategory || "",
  location: project.location || "",
  landmark: project.landmark || "",
  city: project.city || "",
  state: project.state || "",
  pincode: project.pincode || "",
  locationLat: str(project.siteLocation?.lat ?? ""),
  locationLng: str(project.siteLocation?.lng ?? ""),
  ownerManagerName: project.ownerManagerName || "",
  ownerManagerMobile: project.ownerManagerMobile || "",
  brokerManagerName: project.brokerManagerName || "",
  brokerManagerMobile: project.brokerManagerMobile || "",
  plotsAvailable: str(project.plotsAvailable ?? ""),
  images: Array.isArray(project.images) ? project.images : [],
});

const numOrZero = (value: string) => (value === "" || value === null || value === undefined ? 0 : Number(value));
const numOrNull = (value: string) => (value === "" || value === null || value === undefined ? null : Number(value));

export const buildProjectPayload = (formData: ProjectFormData) => {
  const isCommercial = isCommercialCategory(formData.projectCategory);
  const isPlotBased = !isCommercial && isPlotBasedType(formData.projectType);
  const isBuilding = !isCommercial && isBuildingType(formData.projectType);

  const payload: Record<string, unknown> = {
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

export const validateForm = (formData: ProjectFormData) => {
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
    if (formData.plotsAvailable !== "" && Number(formData.plotsAvailable) > Number(formData.totalPlots)) {
      return "Plots Available cannot exceed Total Number of Plots";
    }
  }

  if (isBuilding) {
    if (formData.numberOfFlats === "" || Number(formData.numberOfFlats) <= 0) return "Number of Flats must be greater than 0";
    if (formData.numberOfFloors === "" || Number(formData.numberOfFloors) <= 0) return "Number of Floors must be greater than 0";
    if (formData.flatsPerFloor === "" || Number(formData.flatsPerFloor) <= 0) return "Flats Per Floor must be greater than 0";
    if (formData.bhkConfigurations.length === 0) return "At least one BHK configuration is required";
    for (const config of formData.bhkConfigurations) {
      const bhkLabel = getProjectOptionLabel(PROJECT_BHK_OPTIONS, config.bhk);
      if (config.size === "" || Number(config.size) <= 0) return `Flat Size for ${bhkLabel} must be greater than 0`;
      const nonNegativeFields: Array<[keyof BhkConfig, string]> = [
        ["bedrooms", "Bedrooms"],
        ["kitchens", "Kitchens"],
        ["washrooms", "Washrooms"],
        ["drawingRooms", "Drawing Rooms"],
        ["balconies", "Balconies"],
        ["reservedParking", "Reserved Parking"],
      ];
      for (const [field, label] of nonNegativeFields) {
        if (config[field] !== "" && Number(config[field]) < 0) return `${label} for ${bhkLabel} cannot be negative`;
      }
    }
  }

  if (isCommercial) {
    if (formData.totalFloors === "" || Number(formData.totalFloors) <= 0) return "Total Floors must be greater than 0";
    if (formData.officesPerFloor === "" || Number(formData.officesPerFloor) <= 0) return "Offices Per Floor must be greater than 0";

    const unitGroups: Array<[string, Unit[]]> = [
      ["Office", formData.offices],
      ["Shop", formData.shops],
      ["Showroom", formData.showrooms],
    ];
    for (const [unitLabel, units] of unitGroups) {
      for (let index = 0; index < units.length; index += 1) {
        const unit = units[index];
        const label = `${unitLabel} ${index + 1}`;
        if (unit.length === "" || Number(unit.length) <= 0) return `${label}: Length must be greater than 0`;
        if (unit.breadth === "" || Number(unit.breadth) <= 0) return `${label}: Breadth must be greater than 0`;
        if (unit.height !== "" && Number(unit.height) < 0) return `${label}: Height cannot be negative`;
        if (unit.startingRate !== "" && unit.currentRate !== "" && Number(unit.currentRate) < Number(unit.startingRate)) {
          return `${label}: Current Rate cannot be less than Starting Rate`;
        }
      }
    }
  }

  if (formData.startingRate === "" || Number(formData.startingRate) < 0) return "Starting Rate is required and cannot be negative";
  if (formData.currentRate === "" || Number(formData.currentRate) < 0) return "Current Rate is required and cannot be negative";
  if (Number(formData.currentRate) < Number(formData.startingRate)) return "Current Rate cannot be less than Starting Rate";
  if (!formData.status) return "Status is required";
  if (formData.ownerManagerMobile && !MOBILE_PATTERN.test(formData.ownerManagerMobile)) {
    return "Owner / Manager Mobile must be a valid 10-digit number";
  }
  if (formData.brokerManagerMobile && !MOBILE_PATTERN.test(formData.brokerManagerMobile)) {
    return "Broker Manager Mobile must be a valid 10-digit number";
  }
  return "";
};

/* Web's updateUnitField: length x breadth fills carpet area as either is typed. */
export const applyUnitField = (unit: Unit, field: string, value: string): Unit => {
  const next: Unit = { ...unit, [field]: value };
  if (field === "length" || field === "breadth") {
    const length = Number(field === "length" ? value : unit.length);
    const breadth = Number(field === "breadth" ? value : unit.breadth);
    if (Number.isFinite(length) && Number.isFinite(breadth) && length > 0 && breadth > 0) {
      next.carpetArea = String(Math.round(length * breadth * 100) / 100);
    }
  }
  return next;
};

export const newUnit = (defaults: Record<string, string>, codePrefix: string, codeField: string, index: number): Unit => ({
  ...defaults,
  _key: makeUnitKey(),
  [codeField]: `${codePrefix}-${String(index).padStart(3, "0")}`,
}) as Unit;

export const formatRate = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `₹${num.toLocaleString("en-IN")}`;
};
