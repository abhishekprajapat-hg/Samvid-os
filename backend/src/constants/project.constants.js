const PROJECT_CATEGORIES = ["RESIDENTIAL", "COMMERCIAL"];

// Residential-only sub-types. Commercial projects have no project-type dropdown at all.
const PROJECT_TYPES = ["PLOTTING", "BUILDING", "VILLAS_FARMHOUSE"];

// Villas/Farmhouse reuses the exact same "plot-based" form/workflow as Plotting.
const PLOT_BASED_PROJECT_TYPES = ["PLOTTING", "VILLAS_FARMHOUSE"];

const PROJECT_PLOT_SIZES = [
  "600",
  "800",
  "1000",
  "1200",
  "1500",
  "1800",
  "2000",
  "CUSTOM",
];

const PROJECT_BHK_TYPES = [
  "1_BHK",
  "2_BHK",
  "2_5_BHK",
  "3_BHK",
  "4_BHK",
  "4_5_BHK",
];

const PROJECT_STATUSES = [
  "PRE_LAUNCH",
  "TNC",
  "RERA_APPROVED",
  "UNDER_CONSTRUCTION",
  "READY_TO_MOVE",
  "RESALE",
];

const PROJECT_AMENITIES = [
  "KIDS_PLAY_AREA",
  "PARTY_LAWN",
  "SPORTS_AREA",
  "GARDEN",
  "YOGA_MEDITATION_AREA",
  "WATER_TANK",
  "SECURITY_24X7",
  "GAZEBO",
  "SWIMMING_POOL",
  "WALKING_TRACK",
  "CLUB_HOUSE",
];

const PROJECT_COMMERCIAL_AMENITIES = [
  "LIFT",
  "HIGH_SPEED_ELEVATOR",
  "VISITOR_PARKING",
  "RESERVED_PARKING",
  "CAFETERIA",
  "FOOD_COURT",
  "RECEPTION_LOBBY",
  "WAITING_LOUNGE",
  "CONFERENCE_ROOM",
  "MEETING_ROOM",
  "POWER_BACKUP",
  "DG_BACKUP",
  "FIRE_SAFETY_SYSTEM",
  "CCTV_SURVEILLANCE",
  "SECURITY_24X7",
  "ACCESS_CONTROL",
  "BIOMETRIC_ENTRY",
  "CENTRAL_AIR_CONDITIONING",
  "PANTRY",
  "WASHROOMS",
  "ATM_SPACE",
  "EV_CHARGING",
  "LOADING_BAY",
  "SERVICE_LIFT",
  "LANDSCAPED_GARDEN",
];

const PROJECT_HOUSING_CATEGORIES = ["EWS", "LIG", "MIG", "HIG"];

const PROJECT_OFFICE_TYPES = [
  "STANDARD_OFFICE",
  "EXECUTIVE_OFFICE",
  "PREMIUM_OFFICE",
  "CO_WORKING_OFFICE",
  "CABIN_OFFICE",
  "OPEN_WORKSPACE",
];

const PROJECT_FACING_OPTIONS = [
  "NORTH",
  "SOUTH",
  "EAST",
  "WEST",
  "NORTH_EAST",
  "NORTH_WEST",
  "SOUTH_EAST",
  "SOUTH_WEST",
];

const PROJECT_UNIT_STATUSES = ["AVAILABLE", "BOOKED", "SOLD", "LEASED", "RESERVED"];

const PROJECT_ID_PREFIX = Object.freeze({
  RESIDENTIAL: "RES",
  COMMERCIAL: "COM",
});

// id, projectId, createdBy, updatedBy, createdAt, updatedAt, deletedAt, companyId
// are server-managed and must never be settable from client payloads.
const PROJECT_ALLOWED_FIELDS = [
  "projectCategory",
  "projectType",
  "projectName",
  "totalLandArea",
  // Plotting / Villas & Farmhouse fields
  "totalPlots",
  "plotSize",
  "customPlotSize",
  "plotsAvailable",
  // Building fields
  "numberOfFlats",
  "numberOfFloors",
  "flatsPerFloor",
  "bhkConfigurations",
  // Commercial fields
  "totalFloors",
  "totalOffices",
  "officesPerFloor",
  "totalShops",
  "totalShowrooms",
  "offices",
  "shops",
  "showrooms",
  // Media
  "images",
  // Shared pricing / status / meta
  "plc",
  "group",
  "startingRate",
  "currentRate",
  "otherCharges",
  "status",
  "amenities",
  "housingCategory",
  "location",
  "landmark",
  "city",
  "state",
  "pincode",
  "siteLocation",
  "ownerManagerName",
  "ownerManagerMobile",
  "brokerManagerName",
  "brokerManagerMobile",
];

// Fields required for every project, regardless of category/type.
const PROJECT_COMMON_REQUIRED_CREATE_FIELDS = [
  "projectCategory",
  "projectName",
  "totalLandArea",
  "startingRate",
  "currentRate",
  "status",
];

// Additional fields required only for Residential projects (which always have a project type).
const PROJECT_RESIDENTIAL_REQUIRED_CREATE_FIELDS = ["projectType"];

// Additional fields required only for the plot-based project types (Plotting, Villas/Farmhouse).
const PROJECT_PLOT_BASED_REQUIRED_CREATE_FIELDS = ["totalPlots"];

// Additional fields required only for the Building project type.
const PROJECT_BUILDING_REQUIRED_CREATE_FIELDS = [
  "numberOfFlats",
  "numberOfFloors",
  "flatsPerFloor",
  "bhkConfigurations",
];

// Additional fields required only for Commercial projects.
const PROJECT_COMMERCIAL_REQUIRED_CREATE_FIELDS = ["totalFloors", "officesPerFloor"];

module.exports = {
  PROJECT_CATEGORIES,
  PROJECT_TYPES,
  PLOT_BASED_PROJECT_TYPES,
  PROJECT_PLOT_SIZES,
  PROJECT_BHK_TYPES,
  PROJECT_STATUSES,
  PROJECT_AMENITIES,
  PROJECT_COMMERCIAL_AMENITIES,
  PROJECT_HOUSING_CATEGORIES,
  PROJECT_OFFICE_TYPES,
  PROJECT_FACING_OPTIONS,
  PROJECT_UNIT_STATUSES,
  PROJECT_ID_PREFIX,
  PROJECT_ALLOWED_FIELDS,
  PROJECT_COMMON_REQUIRED_CREATE_FIELDS,
  PROJECT_RESIDENTIAL_REQUIRED_CREATE_FIELDS,
  PROJECT_PLOT_BASED_REQUIRED_CREATE_FIELDS,
  PROJECT_BUILDING_REQUIRED_CREATE_FIELDS,
  PROJECT_COMMERCIAL_REQUIRED_CREATE_FIELDS,
};
