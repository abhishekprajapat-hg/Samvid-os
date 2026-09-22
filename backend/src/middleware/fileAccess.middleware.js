const jwt = require("jsonwebtoken");
const { FILE_COOKIE_NAME, verifyFileToken } = require("../utils/fileAccessToken");

/*
 * Gate for the uploaded-file static mount.
 *
 * Before this existed the uploads directory was served by express.static with
 * no credential of any kind, so lead documents, KYC paperwork and profile
 * photos were readable by anyone who had the URL. A file is now released only
 * to one of three credentials, in the order a real request is most likely to
 * carry them:
 *
 *   1. a staff bearer token  - API and mobile clients;
 *   2. the file-access cookie - <img>/<a> on a same-origin page after login;
 *   3. a per-URL ?t= token    - public share links, which have no session.
 */

const parseCookies = (header) => {
  const jar = {};
  String(header || "")
    .split(";")
    .forEach((part) => {
      const index = part.indexOf("=");
      if (index < 1) return;
      const key = part.slice(0, index).trim();
      if (!key) return;
      try {
        jar[key] = decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        jar[key] = part.slice(index + 1).trim();
      }
    });
  return jar;
};

const hasValidStaffToken = (req) => {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) return false;
  try {
    const decoded = jwt.verify(header.slice(7).trim(), process.env.JWT_SECRET);
    // A staff access token carries no scope; scoped tokens are handled below.
    return !decoded.scope;
  } catch {
    return false;
  }
};

exports.requireFileAccess = (req, res, next) => {
  // req.path here is relative to the mount, e.g. "/chat/1699-abc.png".
  const requestedPath = String(req.path || "").replace(/^\/+/, "");

  if (hasValidStaffToken(req)) return next();

  const cookies = parseCookies(req.headers.cookie);
  if (cookies[FILE_COOKIE_NAME] && verifyFileToken(cookies[FILE_COOKIE_NAME], requestedPath)) {
    return next();
  }

  const urlToken = req.query?.t;
  if (urlToken && verifyFileToken(urlToken, requestedPath)) return next();

  return res.status(401).json({ message: "Not authorized to access this file" });
};

exports.parseCookies = parseCookies;
