const mongoose = require("mongoose");
const Project = require("../models/Project");
const ProjectIdCounter = require("../models/ProjectIdCounter");
const {
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
} = require("../constants/project.constants");

const ALL_AMENITIES = [...PROJECT_AMENITIES, ...PROJECT_COMMERCIAL_AMENITIES];
const { parsePagination, buildPaginationMeta } = require("../utils/queryOptions");

const MOBILE_PATTERN = /^[0-9]{10}$/;

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const getCompanyIdForUser = (user) => {
  const companyId = user?.companyId;
  if (!companyId || !isValidObjectId(companyId)) {
    throw createHttpError(403, "Company context is missing for this account");
  }
  return companyId;
};

const sanitizeString = (value) => String(value ?? "").trim();

const sanitizeUppercaseEnum = (value, allowed, label) => {
  const cleanValue = sanitizeString(value).toUpperCase();
  if (!allowed.includes(cleanValue)) {
    throw createHttpError(400, `${label} is invalid`);
  }
  return cleanValue;
};

const sanitizeNonNegativeNumber = (value, label) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw createHttpError(400, `${label} must be a non-negative number`);
  }
  return parsed;
};

const sanitizeMobile = (value, label) => {
  const cleanValue = sanitizeString(value);
  if (!cleanValue) return "";
  if (!MOBILE_PATTERN.test(cleanValue)) {
    throw createHttpError(400, `${label} must be a valid 10-digit mobile number`);
  }
  return cleanValue;
};

const sanitizePositiveInteger = (value, label) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw createHttpError(400, `${label} must be greater than 0`);
  }
  return parsed;
};

const sanitizeBhkConfigurations = (value) => {
  if (!Array.isArray(value)) {
    throw createHttpError(400, "bhkConfigurations must be an array");
  }

  const seenBhkTypes = new Set();

  return value.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw createHttpError(400, "Each BHK configuration must be an object");
    }

    const bhk = sanitizeString(entry.bhk).toUpperCase();
    if (!PROJECT_BHK_TYPES.includes(bhk)) {
      throw createHttpError(400, `Invalid BHK type: ${entry.bhk}`);
    }
    if (seenBhkTypes.has(bhk)) {
      throw createHttpError(400, `Duplicate BHK configuration for ${entry.bhk}`);
    }
    seenBhkTypes.add(bhk);

    const size = Number(entry.size);
    if (!Number.isFinite(size) || size <= 0) {
      throw createHttpError(400, `Flat size for ${entry.bhk} must be greater than 0`);
    }

    const nonNegativeIntFields = ["bedrooms", "kitchens", "washrooms", "drawingRooms", "balconies", "reservedParking"];
    const cleanEntry = { bhk, size };
    nonNegativeIntFields.forEach((field) => {
      const parsed = Number(entry[field] ?? 0);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw createHttpError(400, `${field} for ${entry.bhk} cannot be negative`);
      }
      cleanEntry[field] = parsed;
    });
    cleanEntry.servantRoom = Boolean(entry.servantRoom);

    return cleanEntry;
  });
};

const sanitizeOptionalNonNegativeNumber = (value, label) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw createHttpError(400, `${label} must be a non-negative number`);
  }
  return parsed;
};

const sanitizeEnumOrEmpty = (value, allowed, label) => {
  const cleanValue = sanitizeString(value).toUpperCase();
  if (!cleanValue) return "";
  if (!allowed.includes(cleanValue)) {
    throw createHttpError(400, `${label} is invalid`);
  }
  return cleanValue;
};

const sanitizeUnitRates = (entry, label) => {
  const startingRate = sanitizeOptionalNonNegativeNumber(entry.startingRate, `${label} startingRate`);
  const currentRate = sanitizeOptionalNonNegativeNumber(entry.currentRate, `${label} currentRate`);
  if (
    startingRate !== null
    && currentRate !== null
    && currentRate < startingRate
  ) {
    throw createHttpError(400, `${label} currentRate cannot be less than startingRate`);
  }
  return { startingRate, currentRate };
};

const sanitizeUnitDimensions = (entry, label) => {
  const length = Number(entry.length);
  const breadth = Number(entry.breadth);
  if (!Number.isFinite(length) || length <= 0) {
    throw createHttpError(400, `${label} length must be greater than 0`);
  }
  if (!Number.isFinite(breadth) || breadth <= 0) {
    throw createHttpError(400, `${label} breadth must be greater than 0`);
  }
  const height = sanitizeOptionalNonNegativeNumber(entry.height, `${label} height`);
  const carpetArea = entry.carpetArea === undefined || entry.carpetArea === null || entry.carpetArea === ""
    ? length * breadth
    : sanitizeOptionalNonNegativeNumber(entry.carpetArea, `${label} carpetArea`);
  const builtUpArea = sanitizeOptionalNonNegativeNumber(entry.builtUpArea, `${label} builtUpArea`);
  return { length, breadth, height, carpetArea, builtUpArea };
};

const sanitizeOffices = (value) => {
  if (!Array.isArray(value)) {
    throw createHttpError(400, "offices must be an array");
  }
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw createHttpError(400, "Each office must be an object");
    }
    const label = `Office ${index + 1}`;
    const officeCode = sanitizeString(entry.officeCode);
    if (!officeCode) {
      throw createHttpError(400, `${label}: officeCode is required`);
    }
    const floorNumber = sanitizeOptionalNonNegativeNumber(entry.floorNumber, `${label} floorNumber`);
    if (floorNumber === null) {
      throw createHttpError(400, `${label}: floorNumber is required`);
    }
    const dimensions = sanitizeUnitDimensions(entry, label);
    const rates = sanitizeUnitRates(entry, label);

    return {
      officeCode,
      officeName: sanitizeString(entry.officeName),
      floorNumber,
      officeType: sanitizeEnumOrEmpty(entry.officeType, PROJECT_OFFICE_TYPES, `${label} officeType`),
      ...dimensions,
      superBuiltUpArea: sanitizeOptionalNonNegativeNumber(entry.superBuiltUpArea, `${label} superBuiltUpArea`),
      facing: sanitizeEnumOrEmpty(entry.facing, PROJECT_FACING_OPTIONS, `${label} facing`),
      reservedParking: sanitizeOptionalNonNegativeNumber(entry.reservedParking, `${label} reservedParking`) ?? 0,
      status: sanitizeUppercaseEnum(entry.status || "AVAILABLE", PROJECT_UNIT_STATUSES, `${label} status`),
      ...rates,
      plc: sanitizeString(entry.plc),
      remarks: sanitizeString(entry.remarks),
    };
  });
};

const sanitizeShops = (value) => {
  if (!Array.isArray(value)) {
    throw createHttpError(400, "shops must be an array");
  }
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw createHttpError(400, "Each shop must be an object");
    }
    const label = `Shop ${index + 1}`;
    const shopCode = sanitizeString(entry.shopCode);
    if (!shopCode) {
      throw createHttpError(400, `${label}: shopCode is required`);
    }
    const floorNumber = sanitizeOptionalNonNegativeNumber(entry.floorNumber, `${label} floorNumber`);
    if (floorNumber === null) {
      throw createHttpError(400, `${label}: floorNumber is required`);
    }
    const dimensions = sanitizeUnitDimensions(entry, label);
    const rates = sanitizeUnitRates(entry, label);

    return {
      shopCode,
      floorNumber,
      ...dimensions,
      facing: sanitizeEnumOrEmpty(entry.facing, PROJECT_FACING_OPTIONS, `${label} facing`),
      parking: sanitizeOptionalNonNegativeNumber(entry.parking, `${label} parking`) ?? 0,
      status: sanitizeUppercaseEnum(entry.status || "AVAILABLE", PROJECT_UNIT_STATUSES, `${label} status`),
      ...rates,
    };
  });
};

const sanitizeShowrooms = (value) => {
  if (!Array.isArray(value)) {
    throw createHttpError(400, "showrooms must be an array");
  }
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw createHttpError(400, "Each showroom must be an object");
    }
    const label = `Showroom ${index + 1}`;
    const showroomCode = sanitizeString(entry.showroomCode);
    if (!showroomCode) {
      throw createHttpError(400, `${label}: showroomCode is required`);
    }
    const floorNumber = sanitizeOptionalNonNegativeNumber(entry.floorNumber, `${label} floorNumber`);
    if (floorNumber === null) {
      throw createHttpError(400, `${label}: floorNumber is required`);
    }
    const dimensions = sanitizeUnitDimensions(entry, label);
    const rates = sanitizeUnitRates(entry, label);

    return {
      showroomCode,
      floorNumber,
      ...dimensions,
      entranceWidth: sanitizeOptionalNonNegativeNumber(entry.entranceWidth, `${label} entranceWidth`),
      ceilingHeight: sanitizeOptionalNonNegativeNumber(entry.ceilingHeight, `${label} ceilingHeight`),
      parking: sanitizeOptionalNonNegativeNumber(entry.parking, `${label} parking`) ?? 0,
      status: sanitizeUppercaseEnum(entry.status || "AVAILABLE", PROJECT_UNIT_STATUSES, `${label} status`),
      ...rates,
    };
  });
};

const sanitizeSiteLocation = (value) => {
  if (!value || typeof value !== "object") return { lat: null, lng: null };
  const lat = value.lat === "" || value.lat === null || value.lat === undefined ? null : Number(value.lat);
  const lng = value.lng === "" || value.lng === null || value.lng === undefined ? null : Number(value.lng);
  if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
    throw createHttpError(400, "siteLocation.lat must be a valid latitude");
  }
  if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
    throw createHttpError(400, "siteLocation.lng must be a valid longitude");
  }
  return { lat, lng };
};

const generateProjectId = async ({ companyId, projectCategory }) => {
  const category = PROJECT_ID_PREFIX[projectCategory] ? projectCategory : "RESIDENTIAL";
  const counter = await ProjectIdCounter.findOneAndUpdate(
    { companyId, category },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  const prefix = PROJECT_ID_PREFIX[category];
  return `${prefix}-PROJ-${String(counter.seq).padStart(4, "0")}`;
};

const sanitizeProjectPayload = ({ payload, mode, currentTotalPlots, currentProjectType, currentProjectCategory }) => {
  const safePayload = {};

  Object.keys(payload || {}).forEach((field) => {
    if (!PROJECT_ALLOWED_FIELDS.includes(field)) return;
    const value = payload[field];

    if (field === "projectCategory") {
      safePayload[field] = sanitizeUppercaseEnum(value, PROJECT_CATEGORIES, "projectCategory");
      return;
    }
    if (field === "projectType") {
      safePayload[field] = sanitizeEnumOrEmpty(value, PROJECT_TYPES, "projectType");
      return;
    }
    if (field === "status") {
      safePayload[field] = sanitizeUppercaseEnum(value, PROJECT_STATUSES, "status");
      return;
    }
    if (field === "plotSize") {
      const cleanValue = sanitizeString(value).toUpperCase();
      if (cleanValue && !PROJECT_PLOT_SIZES.includes(cleanValue)) {
        throw createHttpError(400, "plotSize is invalid");
      }
      safePayload[field] = cleanValue;
      return;
    }
    if (field === "housingCategory") {
      const cleanValue = sanitizeString(value).toUpperCase();
      if (cleanValue && !PROJECT_HOUSING_CATEGORIES.includes(cleanValue)) {
        throw createHttpError(400, "housingCategory is invalid");
      }
      safePayload[field] = cleanValue;
      return;
    }
    if (field === "amenities") {
      if (!Array.isArray(value)) {
        throw createHttpError(400, "amenities must be an array");
      }
      const cleanAmenities = value
        .map((item) => sanitizeString(item).toUpperCase())
        .filter(Boolean);
      const invalidAmenity = cleanAmenities.find((item) => !ALL_AMENITIES.includes(item));
      if (invalidAmenity) {
        throw createHttpError(400, `Invalid amenity: ${invalidAmenity}`);
      }
      safePayload[field] = [...new Set(cleanAmenities)];
      return;
    }
    if (field === "images") {
      if (!Array.isArray(value)) {
        throw createHttpError(400, "images must be an array");
      }
      safePayload[field] = value.map((item) => sanitizeString(item)).filter(Boolean);
      return;
    }
    if (field === "projectName") {
      const cleanValue = sanitizeString(value);
      if (!cleanValue) {
        throw createHttpError(400, "projectName must be a non-empty string");
      }
      safePayload[field] = cleanValue;
      return;
    }
    if (field === "totalLandArea") {
      const cleanValue = sanitizeString(value);
      if (!cleanValue) {
        throw createHttpError(400, "totalLandArea must be a non-empty string");
      }
      safePayload[field] = cleanValue;
      return;
    }
    if (["totalPlots", "startingRate", "currentRate", "plotsAvailable"].includes(field)) {
      safePayload[field] = sanitizeNonNegativeNumber(value, field);
      return;
    }
    if (["numberOfFlats", "numberOfFloors", "flatsPerFloor", "totalFloors", "officesPerFloor"].includes(field)) {
      safePayload[field] = value === "" || value === null || value === undefined
        ? null
        : sanitizePositiveInteger(value, field);
      return;
    }
    if (["totalOffices", "totalShops", "totalShowrooms"].includes(field)) {
      safePayload[field] = sanitizeOptionalNonNegativeNumber(value, field) ?? 0;
      return;
    }
    if (field === "bhkConfigurations") {
      safePayload[field] = sanitizeBhkConfigurations(value);
      return;
    }
    if (field === "offices") {
      safePayload[field] = sanitizeOffices(value);
      return;
    }
    if (field === "shops") {
      safePayload[field] = sanitizeShops(value);
      return;
    }
    if (field === "showrooms") {
      safePayload[field] = sanitizeShowrooms(value);
      return;
    }
    if (field === "siteLocation") {
      safePayload[field] = sanitizeSiteLocation(value);
      return;
    }
    if (field === "ownerManagerMobile") {
      safePayload[field] = sanitizeMobile(value, "ownerManagerMobile");
      return;
    }
    if (field === "brokerManagerMobile") {
      safePayload[field] = sanitizeMobile(value, "brokerManagerMobile");
      return;
    }

    safePayload[field] = sanitizeString(value);
  });

  const effectiveProjectCategory = safePayload.projectCategory || currentProjectCategory;
  const effectiveProjectType = safePayload.projectType || currentProjectType;
  const isResidential = effectiveProjectCategory === "RESIDENTIAL";
  const isCommercial = effectiveProjectCategory === "COMMERCIAL";
  const isPlotBased = isResidential && PLOT_BASED_PROJECT_TYPES.includes(effectiveProjectType);
  const isBuilding = isResidential && effectiveProjectType === "BUILDING";

  if (mode === "create") {
    const requiredFields = [
      ...PROJECT_COMMON_REQUIRED_CREATE_FIELDS,
      ...(isCommercial
        ? PROJECT_COMMERCIAL_REQUIRED_CREATE_FIELDS
        : [
          ...PROJECT_RESIDENTIAL_REQUIRED_CREATE_FIELDS,
          ...(isBuilding ? PROJECT_BUILDING_REQUIRED_CREATE_FIELDS : PROJECT_PLOT_BASED_REQUIRED_CREATE_FIELDS),
        ]),
    ];
    requiredFields.forEach((field) => {
      const isMissing =
        safePayload[field] === undefined
        || safePayload[field] === null
        || safePayload[field] === ""
        || (Array.isArray(safePayload[field]) && safePayload[field].length === 0);
      if (isMissing) {
        throw createHttpError(400, `${field} is required`);
      }
    });
  }

  if (isPlotBased) {
    const totalPlots = safePayload.totalPlots ?? currentTotalPlots;
    if (
      safePayload.plotsAvailable !== undefined
      && safePayload.plotsAvailable !== null
      && totalPlots !== undefined
      && totalPlots !== null
      && safePayload.plotsAvailable > totalPlots
    ) {
      throw createHttpError(400, "plotsAvailable cannot exceed totalPlots");
    }

    if (safePayload.plotSize === "CUSTOM" && Object.prototype.hasOwnProperty.call(safePayload, "customPlotSize")) {
      if (!sanitizeString(safePayload.customPlotSize)) {
        throw createHttpError(400, "customPlotSize is required when plotSize is Custom");
      }
    }
  }

  if (
    safePayload.currentRate !== undefined
    && safePayload.currentRate !== null
    && safePayload.startingRate !== undefined
    && safePayload.startingRate !== null
    && safePayload.currentRate < safePayload.startingRate
  ) {
    throw createHttpError(400, "currentRate cannot be less than startingRate");
  }

  return safePayload;
};

const ensureUniqueProjectName = async ({ companyId, projectName, excludeId }) => {
  const query = {
    companyId,
    projectName,
    deletedAt: null,
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  const existing = await Project.findOne(query).select("_id").lean();
  if (existing) {
    throw createHttpError(409, "A project with this name already exists");
  }
};

const createProject = async ({ user, payload }) => {
  const companyId = getCompanyIdForUser(user);
  const safePayload = sanitizeProjectPayload({ payload, mode: "create" });

  await ensureUniqueProjectName({ companyId, projectName: safePayload.projectName });

  const projectId = await generateProjectId({
    companyId,
    projectCategory: safePayload.projectCategory,
  });

  const project = await Project.create({
    ...safePayload,
    companyId,
    projectId,
    createdBy: user._id,
    updatedBy: user._id,
  });

  return project;
};

const getProjectById = async ({ user, projectId }) => {
  const companyId = getCompanyIdForUser(user);
  if (!isValidObjectId(projectId)) {
    throw createHttpError(400, "Invalid project id");
  }

  const project = await Project.findOne({
    _id: projectId,
    companyId,
    deletedAt: null,
  }).populate("createdBy", "name");

  if (!project) {
    throw createHttpError(404, "Project not found");
  }

  return project;
};

const updateProject = async ({ user, projectId, payload }) => {
  const companyId = getCompanyIdForUser(user);
  const project = await getProjectById({ user, projectId });

  const safePayload = sanitizeProjectPayload({
    payload,
    mode: "update",
    currentTotalPlots: project.totalPlots,
    currentProjectType: project.projectType,
    currentProjectCategory: project.projectCategory,
  });

  if (safePayload.projectName && safePayload.projectName !== project.projectName) {
    await ensureUniqueProjectName({
      companyId,
      projectName: safePayload.projectName,
      excludeId: project._id,
    });
  }

  Object.assign(project, safePayload);
  project.updatedBy = user._id;
  await project.save();

  return project;
};

const deleteProject = async ({ user, projectId }) => {
  const project = await getProjectById({ user, projectId });
  project.deletedAt = new Date();
  project.updatedBy = user._id;
  await project.save();
  return project;
};

const getProjectList = async ({ user, filters = {}, pagination }) => {
  const companyId = getCompanyIdForUser(user);
  const query = { companyId, deletedAt: null };

  const normalizedCategory = sanitizeString(filters.projectCategory).toUpperCase();
  if (PROJECT_CATEGORIES.includes(normalizedCategory)) {
    query.projectCategory = normalizedCategory;
  }

  const normalizedType = sanitizeString(filters.projectType).toUpperCase();
  if (PROJECT_TYPES.includes(normalizedType)) {
    query.projectType = normalizedType;
  }

  const normalizedStatus = sanitizeString(filters.status).toUpperCase();
  if (PROJECT_STATUSES.includes(normalizedStatus)) {
    query.status = normalizedStatus;
  }

  const search = sanitizeString(filters.search);
  if (search) {
    query.$or = [
      { projectName: { $regex: search, $options: "i" } },
      { projectId: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
    ];
  }

  const createdBy = sanitizeString(filters.createdBy);
  if (createdBy && mongoose.Types.ObjectId.isValid(createdBy)) {
    query.createdBy = createdBy;
  }

  const totalCount = await Project.countDocuments(query);
  const cursor = Project.find(query)
    .sort({ updatedAt: -1 })
    .populate("createdBy", "name");

  if (pagination?.enabled) {
    cursor.skip(pagination.skip).limit(pagination.limit);
  }

  const rows = await cursor.lean();

  return { rows, totalCount };
};

module.exports = {
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectList,
  parsePagination,
  buildPaginationMeta,
};
