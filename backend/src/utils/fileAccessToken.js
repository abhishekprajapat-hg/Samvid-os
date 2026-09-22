const jwt = require("jsonwebtoken");

/*
 * Short-lived tokens that authorise reading one uploaded file.
 *
 * Uploaded files are rendered by <img src> and <a href>, which cannot carry an
 * Authorization header, so file access needs a credential the browser attaches
 * on its own. Two shapes exist:
 *
 *   - a session cookie (scope "files", no path claim) set at login, which the
 *     browser sends with every same-origin request for /api/uploads/files;
 *   - a per-URL token (scope "files" plus a `p` path claim) used where there is
 *     no session at all, such as a public inventory share link.
 *
 * Both carry a scope, so authMiddleware.protect refuses them as staff sessions.
 */

const FILE_TOKEN_SCOPE = "files";
const FILE_COOKIE_NAME = "oor_file_access";

const sessionTtl = () => process.env.FILE_ACCESS_COOKIE_TTL || "12h";
const urlTtl = () => process.env.FILE_ACCESS_URL_TTL || "30m";

// Normalises to the "<category>/<filename>" form the static mount resolves,
// so a token minted for one file can never be replayed against another.
const normalizeFilePath = (value) =>
  String(value || "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/[?#].*$/, "")
    .replace(/^\/api\/uploads\/files\//, "")
    .replace(/^\/+/, "");

const signFileSessionToken = (user) =>
  jwt.sign(
    {
      scope: FILE_TOKEN_SCOPE,
      id: String(user?._id || user?.id || ""),
      companyId: String(user?.companyId || ""),
    },
    process.env.JWT_SECRET,
    { expiresIn: sessionTtl() },
  );

const signFileUrlToken = (filePath) =>
  jwt.sign(
    { scope: FILE_TOKEN_SCOPE, p: normalizeFilePath(filePath) },
    process.env.JWT_SECRET,
    { expiresIn: urlTtl() },
  );

const isUploadUrl = (value) => /\/api\/uploads\/files\//.test(String(value || ""));

/*
 * Rewrites one of our own upload URLs to a relative, single-use form.
 * Anything that is not an upload URL (an external CDN link, say) is returned
 * untouched, and historical absolute URLs lose their baked-in host on the way.
 */
const withFileToken = (url) => {
  const raw = String(url || "");
  if (!raw || !isUploadUrl(raw)) return raw;
  const filePath = normalizeFilePath(raw);
  if (!filePath) return raw;
  return `/api/uploads/files/${filePath}?t=${signFileUrlToken(filePath)}`;
};

/*
 * Returns true when the token authorises this exact path. A token with no `p`
 * claim is a session cookie and covers any file the signed-in account requests.
 */
const verifyFileToken = (token, requestedPath) => {
  try {
    const decoded = jwt.verify(String(token || ""), process.env.JWT_SECRET);
    if (decoded?.scope !== FILE_TOKEN_SCOPE) return false;
    if (!decoded.p) return true;
    return decoded.p === normalizeFilePath(requestedPath);
  } catch {
    return false;
  }
};

module.exports = {
  FILE_TOKEN_SCOPE,
  FILE_COOKIE_NAME,
  isUploadUrl,
  normalizeFilePath,
  signFileSessionToken,
  signFileUrlToken,
  withFileToken,
  verifyFileToken,
};
