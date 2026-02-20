const { randomUUID } = require("crypto");

const REQUEST_ID_HEADER = "x-request-id";
const REQUEST_ID_REGEX = /^[A-Za-z0-9_.:-]{8,128}$/;

const resolveRequestId = (incomingValue) => {
  const candidate = String(incomingValue || "").trim();
  if (REQUEST_ID_REGEX.test(candidate)) {
    return candidate;
  }

  return randomUUID();
};

const attachRequestId = (req, res, next) => {
  const requestId = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
};

module.exports = {
  REQUEST_ID_HEADER,
  attachRequestId,
};
