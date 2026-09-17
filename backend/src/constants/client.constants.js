const CLIENT_STATUSES = Object.freeze([
  "LEAD",
  "PROSPECT",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "CLOSED",
]);

const CLIENT_TYPES = Object.freeze([
  "INDIVIDUAL",
  "FREELANCER",
  "STARTUP",
  "SME",
  "ENTERPRISE",
  "OTHER",
]);

const KYC_STATUSES = Object.freeze(["PENDING", "SUBMITTED", "VERIFIED", "REJECTED"]);

const DOCUMENT_CATEGORIES = Object.freeze(["KYC", "AGREEMENT", "ID_PROOF", "POLICE_VERIFICATION", "OTHER"]);

const GST_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const MOBILE_PATTERN = /^[0-9]{10}$/;

const CLIENT_ALLOWED_FIELDS = Object.freeze([
  "companyName",
  "contactPerson",
  "dateOfBirth",
  "phone",
  "email",
  "alternatePhone",
  "address",
  "gstNumber",
  "panNumber",
  "kycStatus",
  "clientType",
  "industry",
  "notes",
  "status",
]);

module.exports = {
  CLIENT_STATUSES,
  CLIENT_TYPES,
  KYC_STATUSES,
  DOCUMENT_CATEGORIES,
  GST_PATTERN,
  PAN_PATTERN,
  MOBILE_PATTERN,
  CLIENT_ALLOWED_FIELDS,
};
