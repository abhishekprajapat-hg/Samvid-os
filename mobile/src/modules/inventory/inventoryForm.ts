/*
 * The property form's rules, ported from web's AssetVault.jsx: its defaults,
 * how an existing property is read into the form, how the form is checked, and
 * the payload it saves.
 *
 * Web adds and edits a property with one form, and mobile used to edit through
 * a short dialog that reached a handful of fields. The whole record now travels
 * through this module - including the legacy commercial/residential detail
 * blocks web keeps hidden but still round-trips - so an edit from the phone
 * saves what an edit from the desk would, and loses nothing it did not show.
 * test/inventoryForm.test.cjs pins it.
 */

export type InventoryForm = Record<string, any> & {
  propertyId: string;
  title: string;
  inventoryType: string;
  type: string;
  category: string;
  status: string;
  location: string;
  locationLat: string;
  locationLng: string;
  price: string;
  rent: string;
  inventorySubtypeData: Record<string, unknown>;
  documentsAvailable: Record<string, boolean>;
  images: string[];
  floorPlans: string[];
  documents: string[];
  videoTours: string[];
};

export const DOCUMENT_CHECKS: Array<[string, string]> = [
  ["registry", "Registry"],
  ["searchReport", "Search Report"],
  ["electricityNoc", "Electricity NOC"],
  ["maintenanceNoc", "Maintenance NOC"],
  ["taxReceipt", "Tax Receipt"],
  ["loanNoc", "Loan NOC"],
];

export const OWNERSHIP_OPTIONS = [
  { value: "1ST", label: "1st" },
  { value: "2ND", label: "2nd" },
  { value: "3RD", label: "3rd" },
  { value: "POWER_OF_ATTORNEY", label: "Power of Attorney" },
];

export const DEAL_OPTIONS = [
  { value: "Sale", label: "For Sale" },
  { value: "Rent", label: "For Rent" },
  { value: "Both", label: "For Sale & Rent" },
];

export const UNFURNISHED_LIKE_STATUSES = ["UNFURNISHED", "BARE_SHELL", "WARM_SHELL"];
export const OFFICE_UNFURNISHED_VISIBLE_FIELD_KEYS = new Set(["washroom"]);

const LEGACY_COMMERCIAL_TEXT = [
  "officeType", "commercialTotalCabins", "commercialCabinSeats", "commercialWorkstations", "commercialSeats",
  "commercialConferenceRooms", "commercialConferenceSeats", "commercialWashroomType", "commercialBuildingTotalFloors",
  "commercialParkingType", "commercialParkingSlots", "commercialSecurityType", "commercialAvailableFrom",
];
const LEGACY_COMMERCIAL_FLAGS = [
  "commercialReceptionArea", "commercialWaitingArea", "commercialPantry", "commercialCafeteria", "commercialServerRoom",
  "commercialStorageRoom", "commercialBreakoutArea", "commercialLiftAvailable", "commercialPowerBackup",
  "commercialCentralAC", "commercialFireSafety", "commercialReadyToMove", "commercialUnderConstruction",
];
const LEGACY_RESIDENTIAL_TEXT = [
  "residentialPropertyType", "residentialBhkType", "residentialBedrooms", "residentialBathrooms", "residentialBalcony",
  "residentialParking", "residentialWaterSupply",
];
const LEGACY_RESIDENTIAL_FLAGS = [
  "residentialStudyRoom", "residentialServantRoom", "residentialModularKitchen", "residentialLift", "residentialSecurity",
  "residentialPowerBackup", "residentialGym", "residentialSwimmingPool", "residentialClubhouse",
  "residentialElectricityBackup", "residentialGasPipeline",
];

export const DEFAULT_INVENTORY_FORM: InventoryForm = {
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
  superBuiltUpArea: "",
  length: "",
  width: "",
  height: "",
  areaUnit: "SQ_FT",
  maintenanceCharges: "",
  deposit: "",
  depositMonths: "",
  agreementYears: "",
  lockInYears: "",
  officeNumber: "",
  documentsAvailable: Object.fromEntries(DOCUMENT_CHECKS.map(([key]) => [key, false])),
  ownerName: "",
  ownerNumber: "",
  ownerWhatsappNumber: "",
  ownerType: "",
  keyManagerName: "",
  keyManagerNumber: "",
  dealType: "",
  propertyDate: "",
  gstApplicable: false,
  furnishingStatus: "",
  locationLat: "",
  locationLng: "",
  price: "",
  rent: "",
  type: "Sale",
  category: "Office",
  status: "Available",
  ...Object.fromEntries(LEGACY_COMMERCIAL_TEXT.map((key) => [key, ""])),
  ...Object.fromEntries(LEGACY_COMMERCIAL_FLAGS.map((key) => [key, false])),
  ...Object.fromEntries(LEGACY_RESIDENTIAL_TEXT.map((key) => [key, ""])),
  ...Object.fromEntries(LEGACY_RESIDENTIAL_FLAGS.map((key) => [key, false])),
  inventorySubtypeData: {},
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
  documents: [],
  videoTours: [],
};

/* Web opens the form on the category the user works in. */
export const defaultInventoryFormFor = (rawRoleType: string): InventoryForm => {
  const roleType = String(rawRoleType || "").toUpperCase() === "RESIDENTIAL" ? "RESIDENTIAL" : "COMMERCIAL";
  return { ...DEFAULT_INVENTORY_FORM, inventoryType: roleType, category: roleType === "COMMERCIAL" ? "Office" : "Flat" };
};

export const isInventoryPriceRequired = (type: string) => String(type || "").trim() !== "Rent";
export const isInventoryRentRequired = (type: string) => ["Rent", "Both"].includes(String(type || "").trim());

export const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toApiStatus = (status: string) => (status === "Reserved" ? "Blocked" : status);
export const isReservedStatusValue = (status: string) => toApiStatus(status) === "Blocked";
export const isSoldStatusValue = (status: string) => toApiStatus(status) === "Sold";
export const isNonCashPaymentMode = (value: string) => {
  const normalized = String(value || "").trim().toUpperCase();
  return Boolean(normalized) && normalized !== "CASH";
};

export const normalizeInventoryResidentialPropertyType = (value: unknown) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (["INDEPENDENT_HOUSE", "VILLA", "BUILDER_FLOOR"].includes(normalized)) return "HOUSE";
  if (normalized === "APARTMENT") return "FLAT";
  if (["PG", "HOSTEL", "PG / HOSTEL"].includes(normalized)) return "PG_HOSTEL";
  if (["FLAT", "HOUSE", "PLOT", "PG_HOSTEL", "BUNGALOW", "FARM_HOUSE", "OTHER"].includes(normalized)) return normalized;
  return "";
};

export const normalizeInventoryCategory = (value: unknown, inventoryType = "COMMERCIAL") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (String(inventoryType || "").trim().toUpperCase() === "RESIDENTIAL") {
    if (["apartment", "apartments", "flat", "flats"].includes(normalized)) return "Flat";
    if (["house", "houses", "villa", "villas", "builder floor", "builder_floor"].includes(normalized)) return "House";
    if (["pg", "hostel", "pg / hostel", "pg_hostel"].includes(normalized)) return "PG / Hostel";
    if (["plot", "plots", "land"].includes(normalized)) return "Plot";
    if (["bungalow", "bungalows"].includes(normalized)) return "Bungalow";
    if (["farm_house", "farmhouse", "farm house"].includes(normalized)) return "Farm House";
    if (normalized === "other") return "Other";
    return "Flat";
  }
  if (normalized === "coworking") return "Coworking";
  if (["managed office", "managed_office"].includes(normalized)) return "Managed Office";
  if (["shop", "showroom", "cafe", "rooftop", "warehouse", "industrial", "other"].includes(normalized)) {
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
  return "Office";
};

export const titleCaseFromToken = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

/* The subtype key lives in officeType for commercial, residentialPropertyType
   for residential - web's getInventorySubtypeValue. */
export const getInventorySubtypeValue = (form: Partial<InventoryForm>) =>
  String(form.inventoryType === "COMMERCIAL" ? form.officeType : form.residentialPropertyType).trim().toUpperCase();

/* Web's dimension rule: length × width fills the carpet area. */
export const withDimension = (form: InventoryForm, key: "length" | "width" | "height", value: string): InventoryForm => {
  const next = { ...form, [key]: value };
  if (key === "length" || key === "width") {
    const measure = (raw: unknown) => {
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    };
    const length = measure(next.length);
    const width = measure(next.width);
    if (length !== null && width !== null) {
      const area = length * width;
      next.totalArea = Number.isInteger(area) ? String(area) : String(Number(area.toFixed(2)));
    }
  }
  return next;
};

/* Web's subtype change: new preferences, category and furnishing follow. */
export const withSubtype = (form: InventoryForm, subtype: string, showFurnishing: boolean): InventoryForm => ({
  ...form,
  officeType: form.inventoryType === "COMMERCIAL" ? subtype : "",
  residentialPropertyType: form.inventoryType === "RESIDENTIAL" ? normalizeInventoryResidentialPropertyType(subtype) : "",
  inventorySubtypeData: {},
  category:
    form.inventoryType === "RESIDENTIAL"
      ? normalizeInventoryCategory(subtype, "RESIDENTIAL")
      : subtype
        ? titleCaseFromToken(subtype)
        : form.category,
  furnishingStatus: showFurnishing ? form.furnishingStatus : "",
});

/* Web's inventory-type change. */
export const withInventoryType = (form: InventoryForm, inventoryType: string): InventoryForm => ({
  ...form,
  inventoryType,
  category: inventoryType === "COMMERCIAL" ? "Office" : "Flat",
  inventorySubtypeData: {},
  officeType: inventoryType === "COMMERCIAL" ? form.officeType : "",
  residentialPropertyType: inventoryType === "RESIDENTIAL" ? normalizeInventoryResidentialPropertyType(form.residentialPropertyType) : "",
});

/* Web's deal change: switching away clears the price that no longer applies. */
export const withDealType = (form: InventoryForm, type: string): InventoryForm => ({
  ...form,
  type,
  price: type === "Rent" ? "" : form.price,
  rent: type === "Sale" ? "" : form.rent,
  deposit: isInventoryRentRequired(type) ? form.deposit : "",
});

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const numberText = (value: unknown) =>
  value === null || value === undefined || Number.isNaN(Number(value)) ? "" : String(value);

/** Web's handleOpenEditModal: an existing property read into the form. */
export const toInventoryForm = (asset: any = {}): InventoryForm => {
  const commercial = asset.commercialDetails || {};
  const layout = commercial.officeLayout || {};
  const amenities = commercial.amenities || {};
  const building = commercial.buildingDetails || {};
  const availability = commercial.availability || {};
  const residential = asset.residentialDetails || {};
  const resAmenities = residential.amenities || {};
  const utilities = residential.utilities || {};
  const sale = asset.saleDetails || {};
  const lat = toNumberOrNull(asset?.siteLocation?.lat);
  const lng = toNumberOrNull(asset?.siteLocation?.lng);
  const inventoryType = String(asset.inventoryType || "COMMERCIAL").toUpperCase();

  return {
    ...DEFAULT_INVENTORY_FORM,
    propertyId: String(asset.propertyId || asset.unitNumber || "").trim(),
    title: asset.projectName || asset.title || "",
    inventoryType,
    location: asset.location || "",
    city: asset.city || "",
    area: asset.area || "",
    pincode: asset.pincode || "",
    buildingName: asset.buildingName || asset.towerName || "",
    floorNumber: text(asset.floorNumber),
    totalFloors: text(asset.totalFloors),
    totalArea: text(asset.totalArea),
    carpetArea: text(asset.carpetArea),
    builtUpArea: text(asset.builtUpArea),
    superBuiltUpArea: text(asset.superBuiltUpArea),
    length: text(asset.length),
    width: text(asset.width),
    height: text(asset.height),
    areaUnit: asset.areaUnit || "SQ_FT",
    maintenanceCharges: text(asset.maintenanceCharges),
    deposit: text(asset.deposit),
    depositMonths: text(asset.depositMonths),
    agreementYears: text(asset.agreementYears),
    lockInYears: text(asset.lockInYears),
    officeNumber: asset.officeNumber || "",
    documentsAvailable: Object.fromEntries(DOCUMENT_CHECKS.map(([key]) => [key, Boolean(asset.documentsAvailable?.[key])])),
    ownerName: asset.ownerName || "",
    ownerNumber: asset.ownerNumber || "",
    ownerWhatsappNumber: asset.ownerWhatsappNumber || "",
    ownerType: asset.ownerType || "",
    keyManagerName: asset.keyManagerName || "",
    keyManagerNumber: asset.keyManagerNumber || "",
    dealType: asset.dealType || "",
    propertyDate: asset.propertyDate ? String(asset.propertyDate).slice(0, 10) : "",
    gstApplicable: Boolean(asset.gstApplicable),
    furnishingStatus: asset.furnishingStatus || "",
    locationLat: lat === null ? "" : String(lat),
    locationLng: lng === null ? "" : String(lng),
    price: numberText(asset.price),
    rent: numberText(asset.rent),
    type: asset.type || "Sale",
    category: normalizeInventoryCategory(asset.category, inventoryType),
    status: asset.status || "Available",
    officeType: commercial.officeType || "",
    commercialTotalCabins: text(layout.totalCabins),
    commercialCabinSeats: text(layout.cabinSeats),
    commercialWorkstations: text(layout.workstations),
    commercialSeats: text(layout.seats),
    commercialConferenceRooms: text(layout.conferenceRooms),
    commercialConferenceSeats: text(layout.conferenceSeats),
    commercialReceptionArea: Boolean(layout.receptionArea),
    commercialWaitingArea: Boolean(layout.waitingArea),
    commercialPantry: Boolean(amenities.pantry),
    commercialCafeteria: Boolean(amenities.cafeteria),
    commercialWashroomType: amenities.washroomType || "",
    commercialServerRoom: Boolean(amenities.serverRoom),
    commercialStorageRoom: Boolean(amenities.storageRoom),
    commercialBreakoutArea: Boolean(amenities.breakoutArea),
    commercialLiftAvailable: Boolean(amenities.liftAvailable),
    commercialPowerBackup: Boolean(amenities.powerBackup),
    commercialCentralAC: Boolean(amenities.centralAC),
    commercialBuildingTotalFloors: text(building.totalFloors),
    commercialParkingType: building.parkingType || "",
    commercialParkingSlots: text(building.parkingSlots),
    commercialSecurityType: building.securityType || "",
    commercialFireSafety: Boolean(building.fireSafety),
    commercialReadyToMove: Boolean(availability.readyToMove),
    commercialUnderConstruction: Boolean(availability.underConstruction),
    commercialAvailableFrom: availability.availableFrom ? new Date(availability.availableFrom).toISOString().slice(0, 10) : "",
    inventorySubtypeData:
      inventoryType === "COMMERCIAL" ? { ...(commercial.subtypeData || {}) } : { ...(residential.subtypeData || {}) },
    residentialPropertyType: normalizeInventoryResidentialPropertyType(residential.propertyType),
    residentialBhkType: residential.bhkType || "",
    residentialBedrooms: text(residential.bedrooms),
    residentialBathrooms: text(residential.bathrooms),
    residentialBalcony: text(residential.balcony),
    residentialStudyRoom: Boolean(residential.studyRoom),
    residentialServantRoom: Boolean(residential.servantRoom),
    residentialParking: text(residential.parking),
    residentialModularKitchen: Boolean(resAmenities.modularKitchen),
    residentialLift: Boolean(resAmenities.lift),
    residentialSecurity: Boolean(resAmenities.security),
    residentialPowerBackup: Boolean(resAmenities.powerBackup),
    residentialGym: Boolean(resAmenities.gym),
    residentialSwimmingPool: Boolean(resAmenities.swimmingPool),
    residentialClubhouse: Boolean(resAmenities.clubhouse),
    residentialWaterSupply: utilities.waterSupply || "",
    residentialElectricityBackup: Boolean(utilities.electricityBackup),
    residentialGasPipeline: Boolean(utilities.gasPipeline),
    reservationReason: asset.reservationReason || "",
    saleLeadId: String(sale?.leadId?._id || sale?.leadId || "").trim(),
    salePaymentMode: String(sale?.paymentMode || "").trim().toUpperCase(),
    salePaymentType: String(sale?.paymentType || "").trim().toUpperCase(),
    saleTotalAmount: numberText(sale?.totalAmount),
    saleRemainingAmount: numberText(sale?.remainingAmount),
    salePaymentReference: String(sale?.paymentReference || "").trim(),
    saleNote: String(sale?.note || "").trim(),
    images: Array.isArray(asset.images) ? asset.images : [],
    floorPlans: Array.isArray(asset.floorPlans) ? asset.floorPlans : [],
    documents: Array.isArray(asset.documents) ? asset.documents : [],
    videoTours: Array.isArray(asset.videoTours) ? asset.videoTours : [],
  };
};

export const toSiteLocationPayload = ({ lat, lng }: { lat: unknown; lng: unknown }) => {
  const parsedLat = toNumberOrNull(lat);
  const parsedLng = toNumberOrNull(lng);
  if (parsedLat === null && parsedLng === null) return { value: null as null | { lat: number; lng: number } };
  if (parsedLat === null || parsedLng === null) return { error: "Enter both latitude and longitude, or leave both empty" };
  if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) return { error: "Invalid latitude/longitude range" };
  return { value: { lat: parsedLat, lng: parsedLng } };
};

/* Web's buildSaleDetailsPayload - only a Sold property carries sale details. */
export const buildSaleDetails = (form: InventoryForm, now = new Date()) => {
  if (!isSoldStatusValue(form.status)) return { value: null as Record<string, unknown> | null };
  const saleLeadId = String(form.saleLeadId || "").trim();
  const mode = String(form.salePaymentMode || "").trim().toUpperCase();
  const paymentType = String(form.salePaymentType || "").trim().toUpperCase();
  const total = Number(form.saleTotalAmount);
  const remainingInput = form.saleRemainingAmount === "" ? null : Number(form.saleRemainingAmount);
  const reference = String(form.salePaymentReference || "").trim();
  if (!saleLeadId) return { error: "Lead selection is required when status is Sold" };
  if (!mode) return { error: "Payment mode is required when status is Sold" };
  if (!paymentType) return { error: "Payment type is required when status is Sold" };
  if (!Number.isFinite(total) || total <= 0) return { error: "Total sold amount must be greater than 0" };
  let remainingAmount = 0;
  if (paymentType === "PARTIAL") {
    if (remainingInput === null || !Number.isFinite(remainingInput) || remainingInput <= 0) {
      return { error: "Remaining amount is required for partial payment" };
    }
    remainingAmount = remainingInput;
  }
  if (isNonCashPaymentMode(mode) && !reference) return { error: "Payment reference is required for non-cash sold payment" };
  return {
    value: {
      leadId: saleLeadId,
      paymentMode: mode,
      paymentType,
      totalAmount: total,
      remainingAmount,
      paymentReference: isNonCashPaymentMode(mode) ? reference : "",
      note: String(form.saleNote || "").trim(),
      soldAt: now.toISOString(),
    },
  };
};

const subtypeNumber = (data: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = toNumberOrNull(data?.[key]);
    if (value !== null) return value;
  }
  return null;
};
const subtypeFlag = (data: Record<string, unknown>, ...keys: string[]) => keys.some((key) => Boolean(data?.[key]));

/** Web's buildInventoryPayloadFromForm. */
export const buildInventoryPayload = (
  form: InventoryForm,
  {
    finalLocation,
    reservationReason,
    saleDetails,
    siteLocation,
  }: { finalLocation: string; reservationReason: string; saleDetails: Record<string, unknown> | null; siteLocation: { lat: number; lng: number } | null },
) => {
  const inventoryType = String(form.inventoryType || "COMMERCIAL").toUpperCase();
  const data = (form.inventorySubtypeData || {}) as Record<string, unknown>;
  const payload: Record<string, unknown> = {
    title: form.title.trim(),
    projectName: form.title.trim(),
    towerName: String(form.buildingName || "Main").trim() || "Main",
    unitNumber: form.propertyId.trim(),
    propertyId: form.propertyId.trim(),
    inventoryType,
    location: finalLocation,
    city: String(form.city || "").trim(),
    area: String(form.area || "").trim(),
    pincode: String(form.pincode || "").trim(),
    buildingName: String(form.buildingName || "").trim(),
    floorNumber: toNumberOrNull(form.floorNumber),
    totalFloors: toNumberOrNull(form.totalFloors),
    totalArea: toNumberOrNull(form.totalArea),
    carpetArea: toNumberOrNull(form.carpetArea),
    builtUpArea: toNumberOrNull(form.builtUpArea),
    superBuiltUpArea: toNumberOrNull(form.superBuiltUpArea),
    length: toNumberOrNull(form.length),
    width: toNumberOrNull(form.width),
    height: toNumberOrNull(form.height),
    areaUnit: String(form.areaUnit || "SQ_FT").toUpperCase(),
    price: isInventoryPriceRequired(form.type) ? Number(form.price) : toNumberOrNull(form.price),
    rent: toNumberOrNull(form.rent),
    maintenanceCharges: toNumberOrNull(form.maintenanceCharges),
    deposit: toNumberOrNull(form.deposit),
    depositMonths: toNumberOrNull(form.depositMonths),
    agreementYears: toNumberOrNull(form.agreementYears),
    lockInYears: toNumberOrNull(form.lockInYears),
    officeNumber: String(form.officeNumber || "").trim(),
    documentsAvailable: Object.fromEntries(DOCUMENT_CHECKS.map(([key]) => [key, Boolean(form.documentsAvailable?.[key])])),
    ownerName: String(form.ownerName || "").trim(),
    ownerNumber: String(form.ownerNumber || "").trim(),
    ownerWhatsappNumber: String(form.ownerWhatsappNumber || "").trim(),
    ownerType: String(form.ownerType || "").toUpperCase(),
    keyManagerName: String(form.keyManagerName || "").trim(),
    keyManagerNumber: String(form.keyManagerNumber || "").trim(),
    dealType: String(form.dealType || "").toUpperCase(),
    propertyDate: form.propertyDate || null,
    gstApplicable: Boolean(form.gstApplicable),
    type: form.type,
    category: form.category,
    furnishingStatus: String(form.furnishingStatus || "").toUpperCase(),
    status: form.status,
    reservationReason: isReservedStatusValue(form.status) ? reservationReason : "",
    saleDetails,
    images: Array.isArray(form.images) ? form.images : [],
    floorPlans: Array.isArray(form.floorPlans) ? form.floorPlans : [],
    documents: Array.isArray(form.documents) ? form.documents : [],
    videoTours: Array.isArray(form.videoTours) ? form.videoTours : [],
  };

  if (inventoryType === "COMMERCIAL") {
    const parking = subtypeFlag(data, "parking", "reservedParking");
    payload.commercialDetails = {
      officeType: String(form.officeType || "").toUpperCase(),
      officeLayout: {
        totalCabins: subtypeNumber(data, "cabins", "privateCabins") ?? toNumberOrNull(form.commercialTotalCabins),
        cabinSeats: subtypeNumber(data, "cabinSeats") ?? toNumberOrNull(form.commercialCabinSeats),
        workstations: subtypeNumber(data, "workstations", "workstation") ?? toNumberOrNull(form.commercialWorkstations),
        seats: subtypeNumber(data, "seats", "requiredSeats") ?? toNumberOrNull(form.commercialSeats),
        conferenceRooms: subtypeNumber(data, "conferenceRooms") ?? toNumberOrNull(form.commercialConferenceRooms),
        conferenceSeats: subtypeNumber(data, "conferenceSeats") ?? toNumberOrNull(form.commercialConferenceSeats),
        receptionArea: subtypeFlag(data, "receptionArea", "reception") || Boolean(form.commercialReceptionArea),
        waitingArea: subtypeFlag(data, "waitingArea") || Boolean(form.commercialWaitingArea),
      },
      subtypeData: data,
      amenities: {
        pantry: subtypeFlag(data, "pantry") || Boolean(form.commercialPantry),
        cafeteria: Boolean(form.commercialCafeteria),
        washroomType: String(form.commercialWashroomType || "").toUpperCase(),
        serverRoom: Boolean(form.commercialServerRoom),
        storageRoom: Boolean(form.commercialStorageRoom),
        breakoutArea: Boolean(form.commercialBreakoutArea),
        liftAvailable: Boolean(form.commercialLiftAvailable),
        powerBackup: subtypeFlag(data, "powerBackup") || Boolean(form.commercialPowerBackup),
        centralAC: Boolean(form.commercialCentralAC),
      },
      buildingDetails: {
        totalFloors: toNumberOrNull(form.commercialBuildingTotalFloors),
        parkingType: String(form.commercialParkingType || "").toUpperCase() || (parking ? "COVERED" : ""),
        parkingSlots: toNumberOrNull(form.commercialParkingSlots) ?? (parking ? 1 : null),
        securityType: String(form.commercialSecurityType || "").toUpperCase(),
        fireSafety: Boolean(form.commercialFireSafety),
      },
      availability: {
        readyToMove: Boolean(form.commercialReadyToMove),
        underConstruction: Boolean(form.commercialUnderConstruction),
        availableFrom: form.commercialAvailableFrom || null,
      },
    };
  }

  if (inventoryType === "RESIDENTIAL") {
    payload.residentialDetails = {
      propertyType: normalizeInventoryResidentialPropertyType(form.residentialPropertyType),
      subtypeData: data,
      bhkType: String(form.residentialBhkType || "").toUpperCase(),
      bedrooms: toNumberOrNull(form.residentialBedrooms),
      bathrooms: toNumberOrNull(form.residentialBathrooms),
      balcony: toNumberOrNull(form.residentialBalcony),
      studyRoom: Boolean(form.residentialStudyRoom),
      servantRoom: Boolean(form.residentialServantRoom),
      parking: toNumberOrNull(form.residentialParking),
      amenities: {
        modularKitchen: Boolean(form.residentialModularKitchen),
        lift: Boolean(form.residentialLift),
        security: Boolean(form.residentialSecurity),
        powerBackup: Boolean(form.residentialPowerBackup),
        gym: Boolean(form.residentialGym),
        swimmingPool: Boolean(form.residentialSwimmingPool),
        clubhouse: Boolean(form.residentialClubhouse),
      },
      utilities: {
        waterSupply: String(form.residentialWaterSupply || "").toUpperCase(),
        electricityBackup: Boolean(form.residentialElectricityBackup),
        gasPipeline: Boolean(form.residentialGasPipeline),
      },
    };
  }

  if (siteLocation) payload.siteLocation = siteLocation;
  return payload;
};

/**
 * Web's checks before a save, in web's order. Returns the error, or what the
 * payload needs. Location lookup on an edit is the screen's job - it needs the
 * network - so `siteLocation` here is whatever the form holds.
 */
export const prepareInventorySave = (form: InventoryForm, now = new Date()) => {
  const derived = [form.city, form.area, form.pincode].map((value) => String(value || "").trim()).filter(Boolean).join(", ");
  const finalLocation = String(form.location || "").trim() || derived;
  if (!form.title.trim() || !finalLocation) return { error: "Property name and location are required" };
  if (isInventoryPriceRequired(form.type) && String(form.price) === "") return { error: "Price is required for Sale listings" };
  if (isInventoryRentRequired(form.type) && String(form.rent) === "") return { error: "Rent is required for Rent listings" };
  const site = toSiteLocationPayload({ lat: form.locationLat, lng: form.locationLng });
  if ("error" in site && site.error) return { error: site.error };
  const reservationReason = String(form.reservationReason || "").trim();
  if (isReservedStatusValue(form.status) && !reservationReason) return { error: "Block reason is required when status is Blocked" };
  const sale = buildSaleDetails(form, now);
  if ("error" in sale && sale.error) return { error: sale.error };
  return {
    payload: buildInventoryPayload(form, {
      finalLocation,
      reservationReason,
      saleDetails: (sale as { value: Record<string, unknown> | null }).value,
      siteLocation: (site as { value: { lat: number; lng: number } | null }).value,
    }),
  };
};
