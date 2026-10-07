const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const createBadQueryError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

// A repeated query parameter arrives as an array (?limit=5&limit=9), and with
// Express's simple parser ?limit[]=5 lands under the literal key "limit[]".
// Both used to slip past the numeric parse and fall through to "no pagination".
const firstScalar = (value) => (Array.isArray(value) ? value[0] : value);

const parsePagination = (query = {}, options = {}) => {
  const maxLimit = toPositiveInt(options.maxLimit, 200);
  const defaultLimit = toPositiveInt(options.defaultLimit, 25);
  const strict = Boolean(options.strict);

  /*
   * Pagination is always on.
   *
   * This used to return { enabled: false } whenever the caller sent neither
   * page nor limit, and every caller read that as "skip .skip()/.limit()
   * entirely" - so a bare GET /leads, or any filter-only query, streamed the
   * whole collection (1,195 leads / 2.7MB on the audited database, and seven
   * screens requested exactly that on every visit). A request that does not ask
   * for a page now gets the first one instead of all of them.
   */
  const rawPage = firstScalar(query.page ?? query["page[]"]);
  const rawLimit = firstScalar(query.limit ?? query["limit[]"]);

  if (strict && rawPage !== undefined) {
    const pageText = String(rawPage).trim();
    if (!/^\d+$/.test(pageText) || Number.parseInt(pageText, 10) <= 0) {
      throw createBadQueryError("page must be a positive integer");
    }
  }

  if (strict && rawLimit !== undefined) {
    const limitText = String(rawLimit).trim();
    const parsedLimit = Number.parseInt(limitText, 10);
    if (!/^\d+$/.test(limitText) || parsedLimit <= 0 || parsedLimit > maxLimit) {
      throw createBadQueryError(`limit must be a positive integer up to ${maxLimit}`);
    }
  }

  const page = toPositiveInt(rawPage, 1);
  const requestedLimit = toPositiveInt(rawLimit, defaultLimit);
  const limit = Math.min(requestedLimit, maxLimit);
  const skip = (page - 1) * limit;

  return {
    // Retained so existing callers keep compiling; it is now always true.
    enabled: true,
    page,
    limit,
    skip,
    maxLimit,
    // True when the caller named a page explicitly, for callers that want to
    // tell "give me page 1" apart from "I didn't ask".
    explicit: rawPage !== undefined || rawLimit !== undefined,
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
