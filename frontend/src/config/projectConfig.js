export const PROJECT_CATEGORY_OPTIONS = [
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "COMMERCIAL", label: "Commercial" },
];

export const PROJECT_TYPE_OPTIONS = [
  { value: "PLOTTING", label: "Plotting" },
  { value: "BUILDING", label: "Building" },
  { value: "VILLAS_FARMHOUSE", label: "Villas / Farmhouse" },
];

export const PLOT_BASED_PROJECT_TYPES = ["PLOTTING", "VILLAS_FARMHOUSE"];

export const PROJECT_BHK_OPTIONS = [
  { value: "1_BHK", label: "1 BHK" },
  { value: "2_BHK", label: "2 BHK" },
  { value: "2_5_BHK", label: "2.5 BHK" },
  { value: "3_BHK", label: "3 BHK" },
  { value: "4_BHK", label: "4 BHK" },
  { value: "4_5_BHK", label: "4.5 BHK" },
];

export const PROJECT_PLOT_SIZE_OPTIONS = [
  { value: "600", label: "600 Sq.ft" },
  { value: "800", label: "800 Sq.ft" },
  { value: "1000", label: "1000 Sq.ft" },
  { value: "1200", label: "1200 Sq.ft" },
  { value: "1500", label: "1500 Sq.ft" },
  { value: "1800", label: "1800 Sq.ft" },
  { value: "2000", label: "2000 Sq.ft" },
  { value: "CUSTOM", label: "Custom" },
];

export const PROJECT_STATUS_OPTIONS = [
  { value: "PRE_LAUNCH", label: "Pre Launch" },
  { value: "TNC", label: "TNC" },
  { value: "RERA_APPROVED", label: "RERA Approved" },
  { value: "UNDER_CONSTRUCTION", label: "Under Construction" },
  { value: "READY_TO_MOVE", label: "Ready To Move (RTM)" },
  { value: "RESALE", label: "Resale" },
];

export const PROJECT_AMENITY_OPTIONS = [
  { value: "KIDS_PLAY_AREA", label: "Kids Play Area" },
  { value: "PARTY_LAWN", label: "Party Lawn" },
  { value: "SPORTS_AREA", label: "Sports Area" },
  { value: "GARDEN", label: "Garden" },
  { value: "YOGA_MEDITATION_AREA", label: "Yoga & Meditation Area" },
  { value: "WATER_TANK", label: "Water Tank" },
  { value: "SECURITY_24X7", label: "24x7 Security" },
  { value: "GAZEBO", label: "Gazebo" },
  { value: "SWIMMING_POOL", label: "Swimming Pool" },
  { value: "WALKING_TRACK", label: "Walking Track" },
  { value: "CLUB_HOUSE", label: "Club House" },
];

export const PROJECT_HOUSING_CATEGORY_OPTIONS = [
  { value: "EWS", label: "EWS" },
  { value: "LIG", label: "LIG" },
  { value: "MIG", label: "MIG" },
  { value: "HIG", label: "HIG" },
];

export const PROJECT_OFFICE_TYPE_OPTIONS = [
  { value: "STANDARD_OFFICE", label: "Standard Office" },
  { value: "EXECUTIVE_OFFICE", label: "Executive Office" },
  { value: "PREMIUM_OFFICE", label: "Premium Office" },
  { value: "CO_WORKING_OFFICE", label: "Co-working Office" },
  { value: "CABIN_OFFICE", label: "Cabin Office" },
  { value: "OPEN_WORKSPACE", label: "Open Workspace" },
];

export const PROJECT_FACING_OPTIONS = [
  { value: "NORTH", label: "North" },
  { value: "SOUTH", label: "South" },
  { value: "EAST", label: "East" },
  { value: "WEST", label: "West" },
  { value: "NORTH_EAST", label: "North-East" },
  { value: "NORTH_WEST", label: "North-West" },
  { value: "SOUTH_EAST", label: "South-East" },
  { value: "SOUTH_WEST", label: "South-West" },
];

export const PROJECT_UNIT_STATUS_OPTIONS = [
  { value: "AVAILABLE", label: "Available" },
  { value: "BOOKED", label: "Booked" },
  { value: "SOLD", label: "Sold" },
  { value: "LEASED", label: "Leased" },
  { value: "RESERVED", label: "Reserved" },
];

export const PROJECT_COMMERCIAL_AMENITY_OPTIONS = [
  { value: "LIFT", label: "Lift" },
  { value: "HIGH_SPEED_ELEVATOR", label: "High Speed Elevator" },
  { value: "VISITOR_PARKING", label: "Visitor Parking" },
  { value: "RESERVED_PARKING", label: "Reserved Parking" },
  { value: "CAFETERIA", label: "Cafeteria" },
  { value: "FOOD_COURT", label: "Food Court" },
  { value: "RECEPTION_LOBBY", label: "Reception Lobby" },
  { value: "WAITING_LOUNGE", label: "Waiting Lounge" },
  { value: "CONFERENCE_ROOM", label: "Conference Room" },
  { value: "MEETING_ROOM", label: "Meeting Room" },
  { value: "POWER_BACKUP", label: "Power Backup" },
  { value: "DG_BACKUP", label: "DG Backup" },
  { value: "FIRE_SAFETY_SYSTEM", label: "Fire Safety System" },
  { value: "CCTV_SURVEILLANCE", label: "CCTV Surveillance" },
  { value: "SECURITY_24X7", label: "24x7 Security" },
  { value: "ACCESS_CONTROL", label: "Access Control" },
  { value: "BIOMETRIC_ENTRY", label: "Biometric Entry" },
  { value: "CENTRAL_AIR_CONDITIONING", label: "Central Air Conditioning" },
  { value: "PANTRY", label: "Pantry" },
  { value: "WASHROOMS", label: "Washrooms" },
  { value: "ATM_SPACE", label: "ATM Space" },
  { value: "EV_CHARGING", label: "EV Charging" },
  { value: "LOADING_BAY", label: "Loading Bay" },
  { value: "SERVICE_LIFT", label: "Service Lift" },
  { value: "LANDSCAPED_GARDEN", label: "Landscaped Garden" },
];

export const getProjectOptionLabel = (options, value) =>
  options.find((option) => option.value === value)?.label || value || "";
