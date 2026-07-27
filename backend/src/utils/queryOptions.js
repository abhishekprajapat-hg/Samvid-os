const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const createBadQueryError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const parsePagination = (query = {}, options = {}) => {
  const maxLimit = toPositiveInt(options.maxLimit, 200);
  const defaultLimit = toPositiveInt(options.defaultLimit, 25);
  const strict = Boolean(options.strict);
  const hasPaginationInput =
    query.page !== undefined || query.limit !== undefined;

  if (!hasPaginationInput) {
    return {
      enabled: false,
      page: 1,
      limit: defaultLimit,
      skip: 0,
      maxLimit,
    };
  }

  if (strict && query.page !== undefined) {
    const rawPage = String(query.page).trim();
    if (!/^\d+$/.test(rawPage) || Number.parseInt(rawPage, 10) <= 0) {
      throw createBadQueryError("page must be a positive integer");
    }
  }

  if (strict && query.limit !== undefined) {
    const rawLimit = String(query.limit).trim();
    const parsedLimit = Number.parseInt(rawLimit, 10);
    if (!/^\d+$/.test(rawLimit) || parsedLimit <= 0 || parsedLimit > maxLimit) {
      throw createBadQueryError(`limit must be a positive integer up to ${maxLimit}`);
    }
  }

  const page = toPositiveInt(query.page, 1);
  const requestedLimit = toPositiveInt(query.limit, defaultLimit);
  const limit = Math.min(requestedLimit, maxLimit);
  const skip = (page - 1) * limit;

  return {
    enabled: true,
    page,
    limit,
    skip,
    maxLimit,
  };
};

const buildPaginationMeta = ({ page, limit, totalCount }) => ({
  page,
  limit,
  totalCount,
  totalPages: totalCount > 0 ? Math.ceil(totalCount / limit) : 0,
  hasNextPage: page * limit < totalCount,
  hasPrevPage: page > 1,
});

const parseFieldSelection = (fieldsInput, allowedFields = []) => {
  const rawFields = String(fieldsInput || "").trim();
  if (!rawFields) return "";

  const allowedFieldSet = new Set(allowedFields);
  const selectedFields = rawFields
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean)
    .filter((field) => allowedFieldSet.has(field));

  if (!selectedFields.length) return "";
  if (!selectedFields.includes("_id")) {
    selectedFields.push("_id");
  }

  return selectedFields.join(" ");
};

module.exports = {
  parsePagination,
  buildPaginationMeta,
  parseFieldSelection,
};
