const INVENTORY_TYPES = ["COMMERCIAL", "RESIDENTIAL"];

const FURNISHING_OPTIONS = [
  "",
  "UNFURNISHED",
  "SEMI_FURNISHED",
  "FULLY_FURNISHED",
  "BARE_SHELL",
  "WARM_SHELL",
];

const text = (key) => ({ key, type: "text" });
const number = (key) => ({ key, type: "number" });
const bool = (key) => ({ key, type: "boolean" });
const date = (key) => ({ key, type: "date" });
const select = (key) => ({ key, type: "select" });

const PROPERTY_REQUIREMENT_CONFIG = {
  COMMERCIAL: {
    OFFICE: [
      number("seats"), number("workstations"), number("cabins"), number("cabinSeats"), number("conferenceRooms"), number("conferenceSeats"),
      bool("receptionArea"), bool("waitingArea"), bool("pantry"), bool("cafeteria"),
      bool("serverRoom"), bool("storageRoom"), bool("breakoutArea"), bool("parking"),
      bool("liftAvailable"), bool("powerBackup"), bool("centralAC"),
    ],
    COWORKING: [
      number("requiredSeats"), select("deskType"), number("privateCabins"), number("workstation"),
      bool("internetRequired"), bool("printingFacility"), bool("reception"), bool("pantry"),
      bool("reservedParking"), bool("access27x7"), bool("commonConference"), bool("teaCoffee"),
      bool("powerBackup"),
    ],
    MANAGED_OFFICE: [
      number("seats"), number("workstations"), number("cabins"), number("cabinSeats"), number("conferenceRooms"), number("conferenceSeats"),
      bool("receptionArea"), bool("waitingArea"), bool("pantry"), bool("cafeteria"),
      bool("serverRoom"), bool("storageRoom"), bool("breakoutArea"), bool("parking"),
      bool("liftAvailable"), bool("powerBackup"), bool("centralAC"),
    ],
    SHOP: [
      bool("groundFloorPreferred"), number("carpetArea"), select("ceilingHeight"),
      select("roadType"), bool("cornerShop"), bool("washroom"), bool("parking"),
      bool("nearMall"), bool("inMall"), bool("seatoutArea"),
      text("suitableBusinessCategory"), select("moveInDate"),
    ],
    SHOWROOM: [
      number("carpetArea"), select("ceilingHeight"), bool("mainRoadVisibility"),
      number("displayArea"), bool("mezzanineFloor"), bool("washroom"), select("moveInDate"),
    ],
    CAFE: [
      number("seatingCapacity"), bool("kitchenAvailable"),
      bool("exhaustProvision"), bool("gasConnection"), bool("fireNocRequired"), bool("washroom"),
      bool("parking"), bool("highFootfallPreferred"), bool("outdoorSeatingRequired"),
    ],
    ROOFTOP: [
      number("totalRooftopArea"), number("coveredArea"), number("openArea"), bool("liftAccess"),
      bool("washroom"), bool("kitchenSetup"), select("intendedUse"),
      bool("commercialPermissionRequired"), bool("parking"),
    ],
    WAREHOUSE: [
      number("warehouseArea"), number("clearHeight"), number("entryGateHeight"), bool("truckAccess"),
      bool("loadingUnloadingArea"), bool("dockAvailable"), text("powerLoad"), bool("fireSafety"),
      bool("officeSpaceRequired"), bool("washroom"), bool("parking"), number("roadWidth"),
    ],
    INDUSTRIAL: [
      number("landArea"), number("builtUpArea"), text("powerLoad"), number("shedHeight"),
      bool("machinerySetupRequired"), bool("labourAccommodation"), bool("truckAccess"),
      bool("loadingArea"), bool("fireSafety"), text("pollutionCategory"),
      bool("waterConnection"), bool("electricityConnection"),
    ],
    OTHER: [text("customRequirementNotes")],
  },
  RESIDENTIAL: {
    APARTMENT: [
      select("bhkType"), number("area"), number("superBuiltUpArea"), number("carpetArea"),
      select("purpose"), select("bathrooms"), text("preferredFloor"), number("balconies"), text("facing"), bool("gatedSociety"),
      bool("lift"), bool("security"), bool("gym"), bool("swimmingPool"), bool("clubhouse"),
      bool("parking"), bool("powerBackup"), bool("gasPipeline"), bool("modularKitchen"),
      bool("servantRoom"), bool("studyRoom"),
    ],
    INDEPENDENT_HOUSE: [
      select("bhkType"), number("area"), number("superBuiltUpArea"), number("carpetArea"),
      select("purpose"), select("bathrooms"), select("numberOfFloors"), number("balconies"), text("facing"), bool("cornerProperty"),
      bool("privateParking"), bool("garden"), bool("terrace"), bool("servantRoom"),
      bool("storageRoom"), bool("powerBackup"), bool("gasPipeline"), bool("separateEntry"),
    ],
    PLOT: [
      select("plotLocation"), select("plotOccupancy"), select("plotPurpose"),
      select("projectStatus"), select("plotType"),
      number("plotLength"), number("plotWidth"), number("plotArea"),
      text("facing"), bool("loanRequired"), bool("semiCommercialPlot"), bool("commercialPlot"),
      bool("gardenFacing"), bool("cornerPlot"), bool("gatedColony"), bool("approvedColony"),
    ],
    PG_HOSTEL: [
      select("occupancyType"), select("sharingType"), number("numberOfBeds"), number("perBedBudget"),
      bool("foodIncluded"), bool("attachedWashroom"), bool("acRequired"), bool("wifi"),
      bool("laundry"), bool("powerBackup"), bool("security"), bool("parking"), date("moveInDate"),
    ],
    OTHER: [text("customRequirementNotes")],
  },
};

const PROPERTY_SUBTYPE_VALUES = Object.fromEntries(
  Object.entries(PROPERTY_REQUIREMENT_CONFIG).map(([inventoryType, subtypes]) => [
    inventoryType,
    Object.keys(subtypes),
  ]),
);

const PROPERTY_SUBTYPE_FIELD_MAP = Object.fromEntries(
  Object.entries(PROPERTY_REQUIREMENT_CONFIG).flatMap(([inventoryType, subtypes]) =>
    Object.entries(subtypes).map(([subtype, fields]) => [
      `${inventoryType}:${subtype}`,
      new Map(fields.map((field) => [field.key, field])),
    ]),
  ),
);

module.exports = {
  INVENTORY_TYPES,
  FURNISHING_OPTIONS,
  PROPERTY_REQUIREMENT_CONFIG,
  PROPERTY_SUBTYPE_VALUES,
  PROPERTY_SUBTYPE_FIELD_MAP,
};
