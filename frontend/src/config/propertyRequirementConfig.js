export const INVENTORY_TYPE_OPTIONS = [
  { value: "", label: "Inventory Type (Any)" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "RESIDENTIAL", label: "Residential" },
];

export const FURNISHING_OPTIONS = [
  { value: "", label: "Any Furnishing" },
  { value: "UNFURNISHED", label: "Unfurnished" },
  { value: "SEMI_FURNISHED", label: "Semi Furnished" },
  { value: "FULLY_FURNISHED", label: "Fully Furnished" },
  { value: "BARE_SHELL", label: "Bare Shell" },
  { value: "WARM_SHELL", label: "Warm Shell" },
];

export const PLOT_LOCATION_OPTIONS = [
  "Within the city",
  "Super Corridor",
  "Bypass Road",
  "Nipania",
  "Rau",
  "AB Road",
  "Vijay Nagar",
  "MR 10",
  "Ring Road",
  "Ujjain Road",
  "Airport Road",
  "Kanadia Road",
];

export const PLOT_OCCUPANCY_OPTIONS = [
  "Vacant",
  "Owner Occupied",
  "Tenant Occupied",
];

export const PLOT_PURPOSE_OPTIONS = [
  "Self",
  "Investment",
];

export const PLOT_PROJECT_STATUS_OPTIONS = [
  "Pre-launching",
  "T&C",
  "Pre-approved",
  "Resale",
];

export const INVENTORY_PLOT_PROJECT_STATUS_OPTIONS = [
  "Pre-launching",
  "T&C",
  "RERA-Approved",
  "Resale",
];

export const PLOT_TYPE_OPTIONS = [
  "Commercial Plots",
  "EWS",
  "LIG",
  "Normal",
];

export const BATHROOM_OPTIONS = [
  "1 Bathroom",
  "2 Bathrooms",
  "3 Bathrooms",
  "4 Bathrooms",
  "5+ Bathrooms",
];

export const HOUSE_FLOOR_OPTIONS = [
  "G",
  "G+1",
  "G+2",
  "G+3",
  "G+4",
  "G+5",
  "G+6",
];

const COWORKING_SEAT_OPTIONS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
];

const COWORKING_PRIVATE_CABIN_OPTIONS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
];

const COWORKING_WORKSTATION_OPTIONS = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
];

const OFFICE_COUNT_OPTIONS = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
];

const COMMERCIAL_SUBTYPES = {
  OFFICE: {
    label: "Office",
    showFurnishing: true,
    fields: [
      { key: "seats", label: "Seats", type: "select", options: OFFICE_COUNT_OPTIONS, allowCustomNumber: true },
      { key: "workstations", label: "Workstations", type: "select", options: OFFICE_COUNT_OPTIONS, allowCustomNumber: true },
      { key: "cabins", label: "Cabins", type: "select", options: OFFICE_COUNT_OPTIONS, allowCustomNumber: true },
      { key: "cabinSeats", label: "Cabin Seats", type: "select", options: OFFICE_COUNT_OPTIONS, allowCustomNumber: true },
      { key: "conferenceRooms", label: "Conference Rooms", type: "select", options: OFFICE_COUNT_OPTIONS, allowCustomNumber: true },
      { key: "conferenceSeats", label: "Conference Seats", type: "select", options: OFFICE_COUNT_OPTIONS, allowCustomNumber: true },
      { key: "receptionArea", label: "Reception Area", type: "checkbox" },
      { key: "waitingArea", label: "Waiting Area", type: "checkbox" },
      { key: "pantry", label: "Pantry", type: "checkbox" },
      { key: "cafeteria", label: "Cafeteria", type: "checkbox" },
      { key: "serverRoom", label: "Server / IT Room", type: "checkbox" },
      { key: "storageRoom", label: "Storage Room", type: "checkbox" },
      { key: "breakoutArea", label: "Breakout Area", type: "checkbox" },
      { key: "parking", label: "Reserved Parking", type: "checkbox" },
      { key: "liftAvailable", label: "Lift Available", type: "checkbox" },
      { key: "powerBackup", label: "Power Backup", type: "checkbox" },
      { key: "centralAC", label: "Central AC", type: "checkbox" },
    ],
  },
  COWORKING: {
    label: "Coworking",
    showFurnishing: true,
    fields: [
      { key: "privateCabins", label: "Private Cabins", type: "select", options: COWORKING_PRIVATE_CABIN_OPTIONS, allowCustomNumber: true },
      { key: "requiredSeats", label: "Seats", type: "select", options: COWORKING_SEAT_OPTIONS, allowCustomNumber: true },
      { key: "workstation", label: "Workstation", type: "select", options: COWORKING_WORKSTATION_OPTIONS, allowCustomNumber: true },
      { key: "deskType", label: "Desk Type", type: "select", options: ["Open Desk", "Dedicated Desk"] },
      { key: "internetRequired", label: "Internet Required", type: "checkbox" },
      { key: "printingFacility", label: "Printing Facility", type: "checkbox" },
      { key: "reception", label: "Reception", type: "checkbox" },
      { key: "pantry", label: "Pantry", type: "checkbox" },
      { key: "reservedParking", label: "Reserved Parking", type: "checkbox" },
      { key: "access27x7", label: "27x7 Access", type: "checkbox" },
      { key: "commonConference", label: "Common Conference", type: "checkbox" },
      { key: "teaCoffee", label: "Tea/Coffee", type: "checkbox" },
      { key: "powerBackup", label: "Power Backup", type: "checkbox" },
    ],
  },
  MANAGED_OFFICE: {
    label: "Managed Office",
    showFurnishing: true,
    fields: [
      { key: "seats", label: "Seats", type: "select", options: OFFICE_COUNT_OPTIONS, allowCustomNumber: true },
      { key: "workstations", label: "Workstations", type: "select", options: OFFICE_COUNT_OPTIONS, allowCustomNumber: true },
      { key: "cabins", label: "Cabins", type: "select", options: OFFICE_COUNT_OPTIONS, allowCustomNumber: true },
      { key: "cabinSeats", label: "Cabin Seats", type: "select", options: OFFICE_COUNT_OPTIONS, allowCustomNumber: true },
      { key: "conferenceRooms", label: "Conference Rooms", type: "select", options: OFFICE_COUNT_OPTIONS, allowCustomNumber: true },
      { key: "conferenceSeats", label: "Conference Seats", type: "select", options: OFFICE_COUNT_OPTIONS, allowCustomNumber: true },
      { key: "receptionArea", label: "Reception Area", type: "checkbox" },
      { key: "waitingArea", label: "Waiting Area", type: "checkbox" },
      { key: "pantry", label: "Pantry", type: "checkbox" },
      { key: "cafeteria", label: "Cafeteria", type: "checkbox" },
      { key: "serverRoom", label: "Server / IT Room", type: "checkbox" },
      { key: "storageRoom", label: "Storage Room", type: "checkbox" },
      { key: "breakoutArea", label: "Breakout Area", type: "checkbox" },
      { key: "parking", label: "Reserved Parking", type: "checkbox" },
      { key: "liftAvailable", label: "Lift Available", type: "checkbox" },
      { key: "powerBackup", label: "Power Backup", type: "checkbox" },
      { key: "centralAC", label: "Central AC", type: "checkbox" },
    ],
  },
  SHOP: {
    label: "Shop",
    showFurnishing: true,
    fields: [
      { key: "groundFloorPreferred", label: "Ground Floor Preferred", type: "checkbox" },
      { key: "carpetArea", label: "Carpet Area", type: "number", min: 0 },
      { key: "ceilingHeight", label: "Ceiling Height", type: "select", options: ["8-10 ft", "10-12 ft", "12-15 ft", "15-20 ft", "20+ ft"] },
      { key: "roadType", label: "Road Type", type: "select", options: ["Main Road", "Internal Road"] },
      { key: "cornerShop", label: "Corner Shop", type: "checkbox" },
      { key: "washroom", label: "Washroom", type: "checkbox" },
      { key: "parking", label: "Reserved Parking", type: "checkbox" },
      { key: "nearMall", label: "Near Mall", type: "checkbox" },
      { key: "inMall", label: "In Mall", type: "checkbox" },
      { key: "seatoutArea", label: "Seatout Area", type: "checkbox" },
      { key: "suitableBusinessCategory", label: "Suitable Business Category", type: "text", fullWidth: true },
      { key: "moveInDate", label: "Move In Date", type: "select", options: ["Within 1 Week", "Within 2 Weeks", "Within 1 Month", "Within 2 Months", "Within 3 Months", "After 3 Months", "Flexible"] },
    ],
  },
  SHOWROOM: {
    label: "Showroom",
    showFurnishing: true,
    fields: [
      { key: "carpetArea", label: "Carpet Area", type: "number", min: 0 },
      { key: "ceilingHeight", label: "Ceiling Height", type: "select", options: ["8-10 ft", "10-12 ft", "12-15 ft", "15-20 ft", "20+ ft"] },
      { key: "mainRoadVisibility", label: "Main Road Visibility", type: "checkbox" },
      { key: "displayArea", label: "Display Area", type: "number", min: 0 },
      { key: "mezzanineFloor", label: "Maxxnine Floor", type: "checkbox" },
      { key: "washroom", label: "Washroom", type: "checkbox" },
      { key: "moveInDate", label: "Move In Date", type: "select", options: ["Within 1 Week", "Within 2 Weeks", "Within 1 Month", "Within 2 Months", "Within 3 Months", "After 3 Months", "Flexible"] },
    ],
  },
  CAFE: {
    label: "Cafe",
    showFurnishing: true,
    fields: [
      { key: "seatingCapacity", label: "Seating Capacity", type: "number", min: 0 },
      { key: "kitchenAvailable", label: "Kitchen Available", type: "checkbox" },
      { key: "exhaustProvision", label: "Exhaust Provision", type: "checkbox" },
      { key: "gasConnection", label: "Gas Connection", type: "checkbox" },
      { key: "fireNocRequired", label: "Fire NOC Required", type: "checkbox" },
      { key: "washroom", label: "Washroom", type: "checkbox" },
      { key: "parking", label: "Reserved Parking", type: "checkbox" },
      { key: "highFootfallPreferred", label: "High Footfall Preferred", type: "checkbox" },
      { key: "outdoorSeatingRequired", label: "Outdoor Seating Required", type: "checkbox" },
    ],
  },
  ROOFTOP: {
    label: "Rooftop",
    showFurnishing: true,
    fields: [
      { key: "totalRooftopArea", label: "Total Rooftop Area", type: "number", min: 0 },
      { key: "coveredArea", label: "Covered Area", type: "number", min: 0 },
      { key: "openArea", label: "Open Area", type: "number", min: 0 },
      { key: "liftAccess", label: "Lift Access", type: "checkbox" },
      { key: "washroom", label: "Washroom", type: "checkbox" },
      { key: "kitchenSetup", label: "Kitchen Setup", type: "checkbox" },
      { key: "intendedUse", label: "Intended Use", type: "select", options: ["Restaurant", "Cafe", "Event"] },
      { key: "commercialPermissionRequired", label: "Commercial Permission Required", type: "checkbox" },
      { key: "parking", label: "Reserved Parking", type: "checkbox" },
    ],
  },
  WAREHOUSE: {
    label: "Warehouse",
    showFurnishing: false,
    fields: [
      { key: "warehouseArea", label: "Warehouse Area", type: "number", min: 0 },
      { key: "clearHeight", label: "Clear Height", type: "number", min: 0 },
      { key: "entryGateHeight", label: "Entry Gate Height", type: "number", min: 0 },
      { key: "truckAccess", label: "Truck Access", type: "checkbox" },
      { key: "loadingUnloadingArea", label: "Loading / Unloading Area", type: "checkbox" },
      { key: "dockAvailable", label: "Dock Available", type: "checkbox" },
      { key: "powerLoad", label: "Power Load", type: "text" },
      { key: "fireSafety", label: "Fire Safety", type: "checkbox" },
      { key: "officeSpaceRequired", label: "Office Space Required", type: "checkbox" },
      { key: "washroom", label: "Washroom", type: "checkbox" },
      { key: "parking", label: "Reserved Parking", type: "checkbox" },
      { key: "roadWidth", label: "Road Width", type: "number", min: 0 },
    ],
  },
  INDUSTRIAL: {
    label: "Industrial",
    showFurnishing: false,
    fields: [
      { key: "landArea", label: "Land Area", type: "number", min: 0 },
      { key: "builtUpArea", label: "Built-up Area", type: "number", min: 0 },
      { key: "powerLoad", label: "Power Load", type: "text" },
      { key: "shedHeight", label: "Shed Height", type: "number", min: 0 },
      { key: "machinerySetupRequired", label: "Machinery Setup Required", type: "checkbox" },
      { key: "labourAccommodation", label: "Labour Accommodation", type: "checkbox" },
      { key: "truckAccess", label: "Truck Access", type: "checkbox" },
      { key: "loadingArea", label: "Loading Area", type: "checkbox" },
      { key: "fireSafety", label: "Fire Safety", type: "checkbox" },
      { key: "pollutionCategory", label: "Pollution Category", type: "text" },
      { key: "waterConnection", label: "Water Connection", type: "checkbox" },
      { key: "electricityConnection", label: "Electricity Connection", type: "checkbox" },
    ],
  },
  OTHER: {
    label: "Other",
    showFurnishing: true,
    fields: [
      { key: "customRequirementNotes", label: "Custom Requirement Notes", type: "textarea", fullWidth: true },
    ],
  },
};

const RESIDENTIAL_COMMON_SUBTYPES = {
  APARTMENT: {
    label: "Flat",
    showFurnishing: true,
    fields: [
      { key: "bhkType", label: "BHK Type", type: "select", options: ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "5 BHK", "Other"] },
      { key: "area", label: "Area", type: "number", min: 0 },
      { key: "superBuiltUpArea", label: "Super Built-up Area", type: "number", min: 0 },
      { key: "carpetArea", label: "Carpet Area", type: "number", min: 0 },
      { key: "purpose", label: "Purpose", type: "select", options: ["Self", "Investment"] },
      { key: "bathrooms", label: "Bathrooms", type: "select", options: BATHROOM_OPTIONS },
      { key: "preferredFloor", label: "Preferred Floor", type: "text" },
      { key: "balconies", label: "Balconies", type: "number", min: 0 },
      { key: "facing", label: "Facing", type: "text" },
      { key: "gatedSociety", label: "Gated Society", type: "checkbox" },
      { key: "lift", label: "Lift", type: "checkbox" },
      { key: "security", label: "Security", type: "checkbox" },
      { key: "gym", label: "Gym", type: "checkbox" },
      { key: "swimmingPool", label: "Swimming Pool", type: "checkbox" },
      { key: "clubhouse", label: "Clubhouse", type: "checkbox" },
      { key: "parking", label: "Reserved Parking", type: "checkbox" },
      { key: "powerBackup", label: "Power Backup", type: "checkbox" },
      { key: "gasPipeline", label: "Gas Pipeline", type: "checkbox" },
      { key: "modularKitchen", label: "Modular Kitchen", type: "checkbox" },
      { key: "servantRoom", label: "Servant Room", type: "checkbox" },
      { key: "studyRoom", label: "Study Room", type: "checkbox" },
    ],
  },
  INDEPENDENT_HOUSE: { label: "House", showFurnishing: true, fields: [
    { key: "bhkType", label: "BHK Type", type: "select", options: ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "5 BHK", "Other"] },
    { key: "area", label: "Area", type: "number", min: 0 },
    { key: "superBuiltUpArea", label: "Super Built-up Area", type: "number", min: 0 },
    { key: "carpetArea", label: "Carpet Area", type: "number", min: 0 },
    { key: "purpose", label: "Purpose", type: "select", options: ["Self", "Investment"] },
    { key: "bathrooms", label: "Bathrooms", type: "select", options: BATHROOM_OPTIONS },
    { key: "numberOfFloors", label: "Number of Floors", type: "select", options: HOUSE_FLOOR_OPTIONS },
    { key: "balconies", label: "Balconies", type: "number", min: 0 },
    { key: "facing", label: "Facing", type: "text" },
    { key: "cornerProperty", label: "Corner Property", type: "checkbox" },
    { key: "privateParking", label: "Private Parking", type: "checkbox" },
    { key: "garden", label: "Garden", type: "checkbox" },
    { key: "terrace", label: "Terrace", type: "checkbox" },
    { key: "servantRoom", label: "Servant Room", type: "checkbox" },
    { key: "storageRoom", label: "Storage Room", type: "checkbox" },
    { key: "powerBackup", label: "Power Backup", type: "checkbox" },
    { key: "gasPipeline", label: "Gas Pipeline", type: "checkbox" },
    { key: "separateEntry", label: "Separate Entry", type: "checkbox" },
  ] },
  OTHER: { label: "Other", showFurnishing: true, fields: [
    { key: "customRequirementNotes", label: "Custom Requirement Notes", type: "textarea", fullWidth: true },
  ] },
};

// Lead Requirements: unchanged, original Plot / PG-Hostel behavior.
export const PROPERTY_REQUIREMENT_CONFIG = {
  COMMERCIAL: {
    label: "Commercial",
    subtypeLabel: "Commercial Property Type",
    subtypes: COMMERCIAL_SUBTYPES,
  },
  RESIDENTIAL: {
    label: "Residential",
    subtypeLabel: "Residential Property Type",
    subtypes: {
      ...RESIDENTIAL_COMMON_SUBTYPES,
      PLOT: { label: "Plot", showFurnishing: false, fields: [
        { key: "plotLocation", label: "Location", type: "select", options: PLOT_LOCATION_OPTIONS },
        { key: "plotOccupancy", label: "Occupancy", type: "select", options: PLOT_OCCUPANCY_OPTIONS },
        { key: "plotPurpose", label: "Purpose", type: "select", options: PLOT_PURPOSE_OPTIONS },
        { key: "projectStatus", label: "Project Status", type: "select", options: PLOT_PROJECT_STATUS_OPTIONS },
        { key: "plotType", label: "Plot Type", type: "select", options: PLOT_TYPE_OPTIONS },
        { key: "plotLength", label: "Plot Length", type: "number", min: 0, unit: "ft" },
        { key: "plotWidth", label: "Plot Width", type: "number", min: 0, unit: "ft" },
        { key: "plotArea", label: "Plot Area", type: "number", min: 0, unit: "sq ft" },
        { key: "facing", label: "Facing", type: "text" },
        { key: "loanRequired", label: "Loan Required", type: "checkbox" },
        { key: "semiCommercialPlot", label: "Semi-commercial Plot", type: "checkbox" },
        { key: "commercialPlot", label: "Commercial Plot", type: "checkbox" },
        { key: "gardenFacing", label: "Garden Facing", type: "checkbox" },
        { key: "cornerPlot", label: "Corner Plot", type: "checkbox" },
        { key: "gatedColony", label: "Gated Colony", type: "checkbox" },
        { key: "approvedColony", label: "Approved Colony", type: "checkbox" },
      ] },
      PG_HOSTEL: { label: "PG / Hostel", showFurnishing: true, fields: [
        { key: "occupancyType", label: "Occupancy Type", type: "select", options: ["Male", "Female", "Co-living"] },
        { key: "sharingType", label: "Sharing Type", type: "select", options: ["Single", "Double", "Triple"] },
        { key: "numberOfBeds", label: "Number of Beds", type: "number", min: 0 },
        { key: "perBedBudget", label: "Per Bed Budget", type: "number", min: 0 },
        { key: "foodIncluded", label: "Food Included", type: "checkbox" },
        { key: "attachedWashroom", label: "Attached Washroom", type: "checkbox" },
        { key: "acRequired", label: "AC Required", type: "checkbox" },
        { key: "wifi", label: "Wi-Fi", type: "checkbox" },
        { key: "laundry", label: "Laundry", type: "checkbox" },
        { key: "powerBackup", label: "Power Backup", type: "checkbox" },
        { key: "security", label: "Security", type: "checkbox" },
        { key: "parking", label: "Reserved Parking", type: "checkbox" },
        { key: "moveInDate", label: "Move-in Date", type: "date" },
      ] },
    },
  },
};

// Inventory (Asset Vault): Plot No./Dimension + Bungalow/Farm House, no PG-Hostel or Plot Occupancy/Purpose.
export const INVENTORY_PROPERTY_REQUIREMENT_CONFIG = {
  COMMERCIAL: {
    label: "Commercial",
    subtypeLabel: "Commercial Property Type",
    subtypes: {
      ...COMMERCIAL_SUBTYPES,
      OFFICE: {
        label: "Office",
        showFurnishing: true,
        fields: [
          { key: "washroom", label: "Washroom", type: "select", options: ["Single", "Male", "Female", "Both"] },
          ...COMMERCIAL_SUBTYPES.OFFICE.fields.filter((field) => field.key !== "seats"),
        ],
      },
      COWORKING: {
        ...COMMERCIAL_SUBTYPES.COWORKING,
        fields: COMMERCIAL_SUBTYPES.COWORKING.fields.filter((field) => field.key !== "requiredSeats"),
      },
      MANAGED_OFFICE: {
        ...COMMERCIAL_SUBTYPES.MANAGED_OFFICE,
        fields: COMMERCIAL_SUBTYPES.MANAGED_OFFICE.fields.filter((field) => field.key !== "seats"),
      },
    },
  },
  RESIDENTIAL: {
    label: "Residential",
    subtypeLabel: "Residential Property Type",
    subtypes: {
      ...RESIDENTIAL_COMMON_SUBTYPES,
      PLOT: { label: "Plot", showFurnishing: false, fields: [
        { key: "plotLocation", label: "Location", type: "select", options: PLOT_LOCATION_OPTIONS },
        { key: "projectStatus", label: "Project Status", type: "select", options: INVENTORY_PLOT_PROJECT_STATUS_OPTIONS },
        { key: "plotType", label: "Plot Type", type: "select", options: PLOT_TYPE_OPTIONS },
        { key: "plotNumber", label: "Plot No.", type: "text" },
        { key: "plotLength", label: "Plot Length", type: "number", min: 0, unit: "ft" },
        { key: "plotWidth", label: "Plot Width", type: "number", min: 0, unit: "ft" },
        { key: "plotArea", label: "Plot Area", type: "number", min: 0, unit: "sq ft", readOnly: true },
        { key: "facing", label: "Facing", type: "text" },
        { key: "loanRequired", label: "Loan Required", type: "checkbox" },
        { key: "semiCommercialPlot", label: "Semi-commercial Plot", type: "checkbox" },
        { key: "commercialPlot", label: "Commercial Plot", type: "checkbox" },
        { key: "gardenFacing", label: "Garden Facing", type: "checkbox" },
        { key: "cornerPlot", label: "Corner Plot", type: "checkbox" },
        { key: "gatedColony", label: "Gated Colony", type: "checkbox" },
        { key: "approvedColony", label: "Approved Colony", type: "checkbox" },
      ] },
      BUNGALOW: { label: "Bungalow", showFurnishing: true, fields: [
        { key: "bhkType", label: "BHK Type", type: "select", options: ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "5 BHK", "Other"] },
        { key: "area", label: "Area", type: "number", min: 0 },
        { key: "superBuiltUpArea", label: "Super Built-up Area", type: "number", min: 0 },
        { key: "carpetArea", label: "Carpet Area", type: "number", min: 0 },
        { key: "purpose", label: "Purpose", type: "select", options: ["Self", "Investment"] },
        { key: "bathrooms", label: "Bathrooms", type: "select", options: BATHROOM_OPTIONS },
        { key: "numberOfFloors", label: "Number of Floors", type: "select", options: HOUSE_FLOOR_OPTIONS },
        { key: "balconies", label: "Balconies", type: "number", min: 0 },
        { key: "facing", label: "Facing", type: "text" },
        { key: "cornerProperty", label: "Corner Property", type: "checkbox" },
        { key: "privateParking", label: "Private Parking", type: "checkbox" },
        { key: "garden", label: "Garden", type: "checkbox" },
        { key: "terrace", label: "Terrace", type: "checkbox" },
        { key: "servantRoom", label: "Servant Room", type: "checkbox" },
        { key: "storageRoom", label: "Storage Room", type: "checkbox" },
        { key: "powerBackup", label: "Power Backup", type: "checkbox" },
        { key: "gasPipeline", label: "Gas Pipeline", type: "checkbox" },
        { key: "separateEntry", label: "Separate Entry", type: "checkbox" },
      ] },
      FARM_HOUSE: { label: "Farm House", showFurnishing: true, fields: [
        { key: "landArea", label: "Land Area", type: "number", min: 0 },
        { key: "builtUpArea", label: "Built-up Area", type: "number", min: 0 },
        { key: "purpose", label: "Purpose", type: "select", options: ["Self", "Investment"] },
        { key: "bathrooms", label: "Bathrooms", type: "select", options: BATHROOM_OPTIONS },
        { key: "facing", label: "Facing", type: "text" },
        { key: "privateParking", label: "Private Parking", type: "checkbox" },
        { key: "garden", label: "Garden", type: "checkbox" },
        { key: "swimmingPool", label: "Swimming Pool", type: "checkbox" },
        { key: "servantRoom", label: "Servant Room", type: "checkbox" },
        { key: "powerBackup", label: "Power Backup", type: "checkbox" },
        { key: "waterConnection", label: "Water Connection", type: "checkbox" },
        { key: "boundaryWall", label: "Boundary Wall", type: "checkbox" },
        { key: "moveInDate", label: "Move-in Date", type: "date" },
      ] },
      OTHER: RESIDENTIAL_COMMON_SUBTYPES.OTHER,
    },
  },
};

export const getPropertySubtypeOptions = (inventoryType = "") =>
  Object.entries(PROPERTY_REQUIREMENT_CONFIG[String(inventoryType).toUpperCase()]?.subtypes || {})
    .map(([value, config]) => ({ value, label: config.label }));

export const getPropertySubtypeConfig = (inventoryType = "", propertySubtype = "") =>
  PROPERTY_REQUIREMENT_CONFIG[String(inventoryType).toUpperCase()]?.subtypes?.[
    String(propertySubtype).toUpperCase()
  ] || null;

export const getPropertySubtypeLabel = (inventoryType = "", propertySubtype = "") =>
  getPropertySubtypeConfig(inventoryType, propertySubtype)?.label || "";

export const getInventorySubtypeOptions = (inventoryType = "") =>
  Object.entries(INVENTORY_PROPERTY_REQUIREMENT_CONFIG[String(inventoryType).toUpperCase()]?.subtypes || {})
    .map(([value, config]) => ({ value, label: config.label }));

export const getInventorySubtypeConfig = (inventoryType = "", propertySubtype = "") =>
  INVENTORY_PROPERTY_REQUIREMENT_CONFIG[String(inventoryType).toUpperCase()]?.subtypes?.[
    String(propertySubtype).toUpperCase()
  ] || null;
