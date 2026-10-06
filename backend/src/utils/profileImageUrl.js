const PROFILE_UPLOAD_URL_PATTERN = /^\/api\/uploads\/files\/profile-images\/[a-z0-9][a-z0-9._-]{0,254}(?:\?[^#\s]*)?$/i;

const isAllowedProfileImageUrl = (value) => {
  const url = String(value || "").trim();
  if (!url) return true;
  if (/^https?:\/\//i.test(url)) return true;
  return PROFILE_UPLOAD_URL_PATTERN.test(url);
};

module.exports = { isAllowedProfileImageUrl };
