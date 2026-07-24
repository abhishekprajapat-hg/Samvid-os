const AttendanceModel = require("../models/Attendance");
const AttendancePolicy = require("../models/AttendancePolicy");
const LeaveRequestModel = require("../models/LeaveRequest");
const AttendanceRegularizationModel = require("../models/AttendanceRegularization");
const User = require("../models/User");
const logger = require("../config/logger");
const {
  USER_ROLES,
  PLATFORM_ADMIN_ROLES,
  MANAGEMENT_ROLES,
  isPlatformAdminRole,
} = require("../constants/role.constants");
const { getDescendantUsers } = require("../services/hierarchy.service");
const {
  parsePagination,
  buildPaginationMeta,
} = require("../utils/queryOptions");

const Attendance = AttendanceModel;
const { ATTENDANCE_STATUS, ATTENDANCE_SOURCE } = AttendanceModel;
const LeaveRequest = LeaveRequestModel;
const { LEAVE_TYPES, LEAVE_STATUS } = LeaveRequestModel;
const AttendanceRegularization = AttendanceRegularizationModel;
const { REGULARIZATION_STATUS } = AttendanceRegularizationModel;

const ATTENDANCE_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DEFAULT_TIMEZONE = String(process.env.ATTENDANCE_TIMEZONE || "Asia/Kolkata").trim() || "Asia/Kolkata";
const BREAK_NOTE_MAX_LENGTH = 240;
const REASON_MAX_LENGTH = 500;
const MAX_HISTORY_WINDOW_DAYS = Number.parseInt(
  process.env.ATTENDANCE_MAX_HISTORY_DAYS || "",
  10,
) || 120;
const MAX_LEAVE_SPAN_DAYS = Number.parseInt(
  process.env.ATTENDANCE_MAX_LEAVE_SPAN_DAYS || "",
  10,
) || 45;
const DAY_MS = 24 * 60 * 60 * 1000;
const HALF_DAY_PRODUCTIVE_MINUTES = 4 * 60;
const FULL_DAY_PRODUCTIVE_MINUTES = (7 * 60) + 30;
const LATE_CHECK_IN_CUTOFF_MINUTES = 11 * 60;
const DEFAULT_OFFICE_RADIUS_METERS = Math.min(
  5000,
  Math.max(10, Number.parseInt(process.env.ATTENDANCE_OFFICE_RADIUS_METERS || "200", 10) || 200),
);
const MAX_GEOFENCE_ACCURACY_BUFFER_METERS = Math.min(
  500,
  Math.max(
    0,
    Number.parseInt(process.env.ATTENDANCE_MAX_ACCURACY_BUFFER_METERS || "150", 10) || 150,
  ),
);
const DEFAULT_GEOFENCE_ENABLED =
  String(process.env.ATTENDANCE_GEOFENCE_ENABLED || "").trim().toLowerCase() === "true";
const LIVE_ATTENDANCE_STATUS = Object.freeze({
  WORKING: "WORKING",
  BREAK: "BREAK",
});
const DEFAULT_POLICY = Object.freeze({
  timezone: DEFAULT_TIMEZONE,
  shiftStartMinutes: 10 * 60,
  shiftEndMinutes: 19 * 60,
  graceMinutes: 60,
  halfDayMinutes: 240,
  fullDayMinutes: 450,
  weeklyOffDays: [0],
  allowCheckoutDuringBreak: true,
  geofenceEnabled: DEFAULT_GEOFENCE_ENABLED,
  officeLatitude: Number.parseFloat(process.env.ATTENDANCE_OFFICE_LATITUDE || ""),
  officeLongitude: Number.parseFloat(process.env.ATTENDANCE_OFFICE_LONGITUDE || ""),
  officeRadiusMeters: DEFAULT_OFFICE_RADIUS_METERS,
  notes: "",
});

const ADMIN_ATTENDANCE_VIEW_ROLES = new Set([
  ...PLATFORM_ADMIN_ROLES,
  ...MANAGEMENT_ROLES,
]);

const REVIEWABLE_LEAVE_STATUS = new Set(["APPROVED", "REJECTED"]);
const REVIEWABLE_REGULARIZATION_STATUS = new Set(["APPROVED", "REJECTED"]);

const dateKeyFormatterCache = new Map();
const timePartsFormatterCache = new Map();

const getDateKeyFormatter = (timezone) => {
  const tz = String(timezone || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
  if (!dateKeyFormatterCache.has(tz)) {
    dateKeyFormatterCache.set(
      tz,
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    );
  }
  return dateKeyFormatterCache.get(tz);
};

const getTimePartsFormatter = (timezone) => {
  const tz = String(timezone || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
  if (!timePartsFormatterCache.has(tz)) {
    timePartsFormatterCache.set(
      tz,
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
    );
  }
  return timePartsFormatterCache.get(tz);
};

const toTrimmedString = (value) => String(value || "").trim();

const toSafeDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const toInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toPositiveInteger = (value, fallback = 0) => {
  const parsed = toInteger(value, fallback);
  return parsed < 0 ? fallback : parsed;
};

const clampInteger = (value, min, max) => Math.min(max, Math.max(min, value));

const toCoordinate = (value, min, max) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
};

const hasValidOfficeGeofence = (policy = {}) =>
  Number.isFinite(policy.officeLatitude)
  && Number.isFinite(policy.officeLongitude)
  && Number(policy.officeRadiusMeters || 0) > 0;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const calculateDistanceMeters = (first, second) => {
  const earthRadiusMeters = 6371000;
  const deltaLat = toRadians(second.latitude - first.latitude);
  const deltaLon = toRadians(second.longitude - first.longitude);
  const firstLat = toRadians(first.latitude);
  const secondLat = toRadians(second.latitude);

  const haversine =
    Math.sin(deltaLat / 2) ** 2
    + Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(deltaLon / 2) ** 2;
  return Math.round(
    earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)),
  );
};

const parseAttendanceLocation = (value = {}) => {
  const latitude = toCoordinate(value?.latitude ?? value?.lat, -90, 90);
  const longitude = toCoordinate(value?.longitude ?? value?.lng, -180, 180);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const accuracy = Number.parseFloat(value?.accuracy);
  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? Math.round(accuracy) : null,
  };
};

const validateAttendanceGeofence = ({ policy, location, actionLabel }) => {
  if (!policy.geofenceEnabled) return null;

  if (!hasValidOfficeGeofence(policy)) {
    return {
      status: 400,
      message: "Office geofence is enabled but office coordinates are not configured",
    };
  }

  if (!location) {
    return {
      status: 400,
      message: `Location permission is required for ${actionLabel}`,
    };
  }

  const distanceMeters = calculateDistanceMeters(
    {
      latitude: policy.officeLatitude,
      longitude: policy.officeLongitude,
    },
    location,
  );
  const radiusMeters = Number(policy.officeRadiusMeters || DEFAULT_OFFICE_RADIUS_METERS);
  const accuracyBufferMeters = Math.min(
    MAX_GEOFENCE_ACCURACY_BUFFER_METERS,
    Math.max(0, Number(location.accuracy || 0)),
  );
  const effectiveDistanceMeters = Math.max(0, distanceMeters - accuracyBufferMeters);

  if (effectiveDistanceMeters > radiusMeters) {
    return {
      status: 403,
      message: `You are outside the office geofence. Allowed range is ${radiusMeters} m.`,
      distanceMeters,
      effectiveDistanceMeters,
      accuracyMeters: location.accuracy,
    };
  }

  return {
    location: {
      ...location,
      distanceMeters,
      effectiveDistanceMeters,
      accuracyBufferMeters,
    },
  };
};

const toDateKeyInTimezone = (input, timezone = DEFAULT_TIMEZONE) => {
  const date = toSafeDate(input);
  if (!date) return "";

  const parts = getDateKeyFormatter(timezone).formatToParts(date);
  const byType = parts.reduce((acc, item) => {
    acc[item.type] = item.value;
    return acc;
  }, {});

  if (!byType.year || !byType.month || !byType.day) return "";
  return `${byType.year}-${byType.month}-${byType.day}`;
};

const toMinutesOfDayInTimezone = (input, timezone = DEFAULT_TIMEZONE) => {
  const date = toSafeDate(input);
  if (!date) return 0;

  const parts = getTimePartsFormatter(timezone).formatToParts(date);
  const hour = toInteger(parts.find((item) => item.type === "hour")?.value, 0);
  const minute = toInteger(parts.find((item) => item.type === "minute")?.value, 0);
  return clampInteger(hour, 0, 23) * 60 + clampInteger(minute, 0, 59);
};

const toUtcMsFromDateKey = (dateKey) => {
  const [yearRaw, monthRaw, dayRaw] = String(dateKey || "").split("-");
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  const day = Number.parseInt(dayRaw, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return Number.NaN;
  }
  return Date.UTC(year, month - 1, day);
};

const getDaySpanInclusive = (fromDateKey, toDateKey) => {
  const fromMs = toUtcMsFromDateKey(fromDateKey);
  const toMs = toUtcMsFromDateKey(toDateKey);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) {
    return 0;
  }
  return Math.floor((toMs - fromMs) / DAY_MS) + 1;
};

const buildDateKeysInRange = (fromDateKey, toDateKey) => {
  const span = getDaySpanInclusive(fromDateKey, toDateKey);
  if (!span) return [];
  const rows = [];
  let cursorMs = toUtcMsFromDateKey(fromDateKey);

  for (let index = 0; index < span; index += 1) {
    const date = new Date(cursorMs);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    rows.push(`${year}-${month}-${day}`);
    cursorMs += DAY_MS;
  }

  return rows;
};

const resolveMonthRange = (monthKey) => {
  if (!MONTH_KEY_PATTERN.test(monthKey)) return null;
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${yearRaw}-${monthRaw}-01`,
    to: `${yearRaw}-${monthRaw}-${String(lastDay).padStart(2, "0")}`,
  };
};

const resolveRangeFromQuery = (query = {}) => {
  const rawFrom = toTrimmedString(query.from);
  const rawTo = toTrimmedString(query.to);
  const rawMonth = toTrimmedString(query.month);

  if (rawMonth && !rawFrom && !rawTo) {
    const rangeFromMonth = resolveMonthRange(rawMonth);
    if (!rangeFromMonth) {
      return { error: "month must be in YYYY-MM format" };
    }
    return rangeFromMonth;
  }

  const today = toDateKeyInTimezone(new Date(), DEFAULT_TIMEZONE);
  const from = rawFrom || rawTo || today;
  const to = rawTo || rawFrom || today;

  if (!ATTENDANCE_DATE_PATTERN.test(from) || !ATTENDANCE_DATE_PATTERN.test(to)) {
    return { error: "from and to must be in YYYY-MM-DD format" };
  }

  if (from > to) {
    return { error: "from cannot be greater than to" };
  }

  const daySpan = getDaySpanInclusive(from, to);
  if (!daySpan) {
    return { error: "Invalid date range" };
  }
  if (daySpan > MAX_HISTORY_WINDOW_DAYS) {
    return {
      error: `Date range cannot exceed ${MAX_HISTORY_WINDOW_DAYS} days`,
    };
  }

  return { from, to };
};

const toMinutesBetween = (startAt, endAt) => {
  const start = toSafeDate(startAt);
  const end = toSafeDate(endAt);
  if (!start || !end) return 0;
  if (end <= start) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / (60 * 1000)));
};

const toBreakNote = (value) => toTrimmedString(value).slice(0, BREAK_NOTE_MAX_LENGTH);
const toReason = (value) => toTrimmedString(value).slice(0, REASON_MAX_LENGTH);

const normalizeBreakSessions = (
  sessions = [],
  { closeOpenAt = null, includeOpenTill = null } = {},
) => {
  const closeReference = toSafeDate(closeOpenAt);
  const includeReference = toSafeDate(includeOpenTill);
  const source = Array.isArray(sessions) ? sessions : [];

  let closedBreakMinutes = 0;
  let effectiveBreakMinutes = 0;
  let activeBreakStartedAt = null;

  const normalizedSessions = source
    .map((session) => {
      const start = toSafeDate(session?.startAt);
      if (!start) return null;

      let end = toSafeDate(session?.endAt);
      if (!end && closeReference) {
        end = closeReference;
      }
      if (end && end <= start) {
        end = null;
      }

      const closedDuration = end ? toMinutesBetween(start, end) : 0;
      let liveDuration = closedDuration;

      if (!end) {
        if (!activeBreakStartedAt) {
          activeBreakStartedAt = start;
        }
        if (includeReference && includeReference > start) {
          liveDuration = toMinutesBetween(start, includeReference);
        } else {
          liveDuration = 0;
        }
      }

      closedBreakMinutes += closedDuration;
      effectiveBreakMinutes += liveDuration;

      return {
        startAt: start,
        endAt: end || null,
        durationMinutes: closedDuration,
        startNote: toBreakNote(session?.startNote),
        endNote: toBreakNote(session?.endNote),
      };
    })
    .filter(Boolean);

  return {
    sessions: normalizedSessions,
    closedBreakMinutes,
    effectiveBreakMinutes,
    activeBreakStartedAt,
  };
};

const getActiveBreakIndex = (sessions = []) => {
  if (!Array.isArray(sessions) || !sessions.length) return -1;
  for (let index = sessions.length - 1; index >= 0; index -= 1) {
    const session = sessions[index];
    if (toSafeDate(session?.startAt) && !toSafeDate(session?.endAt)) {
      return index;
    }
  }
  return -1;
};

const toWorkedMinutes = (checkInAt, checkOutAt) => {
  const inTime = toSafeDate(checkInAt);
  const outTime = toSafeDate(checkOutAt);
  if (!inTime || !outTime) return 0;
  if (outTime <= inTime) return 0;
  return Math.max(0, Math.round((outTime.getTime() - inTime.getTime()) / (60 * 1000)));
};

const normalizeWeeklyOffDays = (value) => {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const rows = [];
  source.forEach((item) => {
    const day = toInteger(item, -1);
    if (day < 0 || day > 6) return;
    if (seen.has(day)) return;
    seen.add(day);
    rows.push(day);
  });
  return rows.sort((left, right) => left - right);
};

const toPolicyView = (policy = null) => {
  const source = policy || {};
  const timezone = toTrimmedString(source.timezone) || DEFAULT_POLICY.timezone;
  const shiftStartMinutes = clampInteger(
    toInteger(source.shiftStartMinutes, DEFAULT_POLICY.shiftStartMinutes),
    0,
    1439,
  );
  const shiftEndMinutes = clampInteger(
    toInteger(source.shiftEndMinutes, DEFAULT_POLICY.shiftEndMinutes),
    0,
    1439,
  );
  const graceMinutes = clampInteger(
    toInteger(source.graceMinutes, DEFAULT_POLICY.graceMinutes),
    0,
    180,
  );
  const halfDayMinutes = clampInteger(
    toInteger(source.halfDayMinutes, DEFAULT_POLICY.halfDayMinutes),
    0,
    1000,
  );
  const fullDayMinutes = clampInteger(
    toInteger(source.fullDayMinutes, DEFAULT_POLICY.fullDayMinutes),
    0,
    1000,
  );
  const weeklyOffDays = normalizeWeeklyOffDays(source.weeklyOffDays);
  const officeLatitude = toCoordinate(source.officeLatitude, -90, 90);
  const officeLongitude = toCoordinate(source.officeLongitude, -180, 180);

  return {
    timezone,
    shiftStartMinutes,
    shiftEndMinutes,
    graceMinutes,
    halfDayMinutes,
    fullDayMinutes,
    weeklyOffDays: weeklyOffDays.length ? weeklyOffDays : [...DEFAULT_POLICY.weeklyOffDays],
    allowCheckoutDuringBreak:
      Object.prototype.hasOwnProperty.call(source || {}, "allowCheckoutDuringBreak")
        ? Boolean(source.allowCheckoutDuringBreak)
        : DEFAULT_POLICY.allowCheckoutDuringBreak,
    geofenceEnabled: Object.prototype.hasOwnProperty.call(source || {}, "geofenceEnabled")
      ? Boolean(source.geofenceEnabled)
      : DEFAULT_POLICY.geofenceEnabled,
    officeLatitude,
    officeLongitude,
    officeRadiusMeters: clampInteger(
      toInteger(source.officeRadiusMeters, DEFAULT_POLICY.officeRadiusMeters),
      10,
      5000,
    ),
    notes: toTrimmedString(source.notes).slice(0, 500),
  };
};

const resolvePolicyForCompany = async (companyId) => {
  if (!companyId) return toPolicyView(DEFAULT_POLICY);
  const policy = await AttendancePolicy.findOne({ companyId }).lean();
  return toPolicyView(policy || DEFAULT_POLICY);
};

const resolveAttendanceStatus = ({
  attendanceDate,
  checkInAt,
  workedMinutes,
  policy,
}) => {
  const safePolicy = toPolicyView(policy || DEFAULT_POLICY);
  const effectiveWorkedMinutes = Math.max(0, Number(workedMinutes || 0));

  if (!checkInAt) {
    return ATTENDANCE_STATUS.ABSENT;
  }

  if (effectiveWorkedMinutes < HALF_DAY_PRODUCTIVE_MINUTES) {
    return ATTENDANCE_STATUS.ABSENT;
  }

  if (effectiveWorkedMinutes < FULL_DAY_PRODUCTIVE_MINUTES) {
    return ATTENDANCE_STATUS.HALF_DAY;
  }

  if (
    ATTENDANCE_DATE_PATTERN.test(attendanceDate)
    && safePolicy.weeklyOffDays.includes(new Date(toUtcMsFromDateKey(attendanceDate)).getUTCDay())
    && effectiveWorkedMinutes < FULL_DAY_PRODUCTIVE_MINUTES
  ) {
    return ATTENDANCE_STATUS.PRESENT;
  }

  return ATTENDANCE_STATUS.PRESENT;
};

const getMonthSpanInclusive = (fromMonthKey, toMonthKey) => {
  if (!MONTH_KEY_PATTERN.test(fromMonthKey) || !MONTH_KEY_PATTERN.test(toMonthKey)) return 0;
  const [fromYearRaw, fromMonthRaw] = fromMonthKey.split("-");
  const [toYearRaw, toMonthRaw] = toMonthKey.split("-");
  const fromYear = Number.parseInt(fromYearRaw, 10);
  const fromMonth = Number.parseInt(fromMonthRaw, 10);
  const toYear = Number.parseInt(toYearRaw, 10);
  const toMonth = Number.parseInt(toMonthRaw, 10);
  if (
    !Number.isFinite(fromYear)
    || !Number.isFinite(fromMonth)
    || !Number.isFinite(toYear)
    || !Number.isFinite(toMonth)
  ) {
    return 0;
  }
  const diff = ((toYear - fromYear) * 12) + (toMonth - fromMonth);
  return diff < 0 ? 0 : diff + 1;
};

const toMonthKeyFromDate = (value, timezone = DEFAULT_TIMEZONE) =>
  toDateKeyInTimezone(value, timezone).slice(0, 7);

const isLateCheckInTime = (checkInAt, policy = DEFAULT_POLICY) => {
  const safeCheckInAt = toSafeDate(checkInAt);
  if (!safeCheckInAt) return false;
  const safePolicy = toPolicyView(policy || DEFAULT_POLICY);
  return toMinutesOfDayInTimezone(safeCheckInAt, safePolicy.timezone)
    > LATE_CHECK_IN_CUTOFF_MINUTES;
};

const applyWorkingSnapshot = (
  attendance,
  {
    referenceTime = new Date(),
    closeOpenBreakAt = null,
    explicitBreakMinutes = null,
  } = {},
) => {
  const checkInAt = toSafeDate(attendance?.checkInAt);
  if (!checkInAt) {
    attendance.breakSessions = [];
    attendance.totalBreakMinutes = 0;
    attendance.workedMinutes = 0;
    return;
  }

  const snapshotEnd = toSafeDate(attendance?.checkOutAt) || toSafeDate(referenceTime) || new Date();
  const normalizedBreaks = normalizeBreakSessions(attendance?.breakSessions, {
    closeOpenAt: closeOpenBreakAt,
    includeOpenTill: snapshotEnd,
  });

  attendance.breakSessions = normalizedBreaks.sessions;
  const grossWorkedMinutes = toWorkedMinutes(checkInAt, snapshotEnd);
  const effectiveBreakMinutes = attendance?.checkOutAt
    ? normalizedBreaks.closedBreakMinutes
    : normalizedBreaks.effectiveBreakMinutes;
  const appliedBreakMinutes = Number.isFinite(explicitBreakMinutes)
    ? Math.max(0, Number(explicitBreakMinutes))
    : effectiveBreakMinutes;

  attendance.totalBreakMinutes = attendance?.checkOutAt
    ? (Number.isFinite(explicitBreakMinutes)
      ? Math.max(0, Number(explicitBreakMinutes))
      : normalizedBreaks.closedBreakMinutes)
    : appliedBreakMinutes;
  attendance.workedMinutes = Math.max(0, grossWorkedMinutes - appliedBreakMinutes);
};

const resolveLiveAttendanceStatus = ({
  isOnBreak,
}) => {
  if (isOnBreak) {
    return LIVE_ATTENDANCE_STATUS.BREAK;
  }

  return LIVE_ATTENDANCE_STATUS.WORKING;
};

const toAttendanceView = (row, policy = DEFAULT_POLICY) => {
  const normalizedBreaks = normalizeBreakSessions(row?.breakSessions, {
    includeOpenTill: new Date(),
  });
  const isOnBreak = Boolean(normalizedBreaks.activeBreakStartedAt);
  const referenceEnd = row?.checkOutAt || new Date();
  const grossWorkedMinutes = toWorkedMinutes(row?.checkInAt, referenceEnd);
  const breakMinutes = row?.checkOutAt
    ? Number(row?.totalBreakMinutes || normalizedBreaks.closedBreakMinutes || 0)
    : normalizedBreaks.effectiveBreakMinutes;
  const isManualStatus = row?.source === ATTENDANCE_SOURCE.MANUAL;
  const resolvedWorkedMinutes = isManualStatus
    ? Number(row?.workedMinutes || 0)
    : row?.checkOutAt
    ? Number(row?.workedMinutes || 0)
    : Math.max(0, grossWorkedMinutes - breakMinutes);
  const isLateCheckIn = isLateCheckInTime(row?.checkInAt, policy);
  const status = isManualStatus
    ? (row?.status || ATTENDANCE_STATUS.PENDING)
    : row?.checkInAt
    ? (row?.checkOutAt
      ? resolveAttendanceStatus({
        attendanceDate: row.attendanceDate,
        checkInAt: row.checkInAt,
        workedMinutes: resolvedWorkedMinutes,
        policy,
      })
      : resolveLiveAttendanceStatus({
        isOnBreak,
      }))
    : (row?.status || ATTENDANCE_STATUS.PENDING);

  return {
    _id: row._id || null,
    attendanceDate: row.attendanceDate || "",
    checkInAt: row.checkInAt || null,
    checkOutAt: row.checkOutAt || null,
    workedMinutes: resolvedWorkedMinutes,
    workedHours: Math.round((resolvedWorkedMinutes / 60) * 100) / 100,
    totalBreakMinutes: breakMinutes,
    totalBreakHours: Math.round((breakMinutes / 60) * 100) / 100,
    breakSessions: normalizedBreaks.sessions.map((session) => {
      const liveDurationMinutes = session.endAt
        ? Number(session.durationMinutes || 0)
        : toMinutesBetween(session.startAt, new Date());
      return {
        startAt: session.startAt || null,
        endAt: session.endAt || null,
        durationMinutes: liveDurationMinutes,
        closedDurationMinutes: Number(session.durationMinutes || 0),
        startNote: session.startNote || "",
        endNote: session.endNote || "",
      };
    }),
    activeBreakStartedAt: normalizedBreaks.activeBreakStartedAt,
    isOnBreak,
    isLateCheckIn,
    status,
    source: row.source || ATTENDANCE_SOURCE.WEB,
    checkInNote: row.checkInNote || "",
    checkOutNote: row.checkOutNote || "",
    checkInLocation: row.checkInLocation || null,
    checkOutLocation: row.checkOutLocation || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
};

const toUserView = (user) => ({
  _id: user._id,
  name: user.name || "",
  email: user.email || "",
  role: user.role || "",
});

const toLeaveView = (row) => ({
  _id: row._id,
  userId: row.userId,
  fromDate: row.fromDate,
  toDate: row.toDate,
  totalDays: Number(row.totalDays || 0),
  leaveType: row.leaveType || "CASUAL",
  reason: row.reason || "",
  status: row.status || "PENDING",
  reviewedBy: row.reviewedBy || null,
  reviewedAt: row.reviewedAt || null,
  reviewNote: row.reviewNote || "",
  createdAt: row.createdAt || null,
  updatedAt: row.updatedAt || null,
});

const toRegularizationView = (row) => ({
  _id: row._id,
  userId: row.userId,
  attendanceDate: row.attendanceDate || "",
  requestedCheckInAt: row.requestedCheckInAt || null,
  requestedCheckOutAt: row.requestedCheckOutAt || null,
  requestedTotalBreakMinutes: Number(row.requestedTotalBreakMinutes || 0),
  reason: row.reason || "",
  status: row.status || "PENDING",
  reviewedBy: row.reviewedBy || null,
  reviewedAt: row.reviewedAt || null,
  reviewNote: row.reviewNote || "",
  resolvedAttendanceId: row.resolvedAttendanceId || null,
  createdAt: row.createdAt || null,
  updatedAt: row.updatedAt || null,
});

const getScopedUsersForAttendanceViewer = async (viewer) => {
  if (!viewer?.companyId) return [];

  if (isPlatformAdminRole(viewer.role)) {
    return User.find({
      companyId: viewer.companyId,
      isActive: true,
      role: { $ne: USER_ROLES.ADMIN },
    })
      .select("_id name email role")
      .sort({ name: 1 })
      .lean();
  }

  if (MANAGEMENT_ROLES.includes(viewer.role)) {
    const descendants = await getDescendantUsers({
      rootUserId: viewer._id,
      companyId: viewer.companyId,
      includeInactive: false,
      select: "_id name email role parentId isActive",
    });
    const rows = descendants.map((row) => ({
      _id: row._id,
      name: row.name || "",
      email: row.email || "",
      role: row.role || "",
    }));

    const me = await User.findOne({
      _id: viewer._id,
      companyId: viewer.companyId,
      isActive: true,
    })
      .select("_id name email role")
      .lean();

    return me
      ? [me, ...rows].sort((left, right) =>
        String(left.name || "").localeCompare(String(right.name || "")))
      : rows;
  }

  return [];
};

const getApprovedLeavesMap = async ({
  companyId,
  userIds = [],
  fromDate,
  toDate,
}) => {
  if (!companyId || !userIds.length || !fromDate || !toDate) {
    return new Map();
  }

  const leaveRows = await LeaveRequest.find({
    companyId,
    userId: { $in: userIds },
    status: "APPROVED",
    fromDate: { $lte: toDate },
    toDate: { $gte: fromDate },
  })
    .select("_id userId fromDate toDate leaveType reason status")
    .lean();

  const map = new Map();
  leaveRows.forEach((row) => {
    const start = row.fromDate < fromDate ? fromDate : row.fromDate;
    const end = row.toDate > toDate ? toDate : row.toDate;
    buildDateKeysInRange(start, end).forEach((dateKey) => {
      const userKey = String(row.userId);
      if (!map.has(userKey)) {
        map.set(userKey, new Map());
      }
      map.get(userKey).set(dateKey, row);
    });
  });

  return map;
};

const canManageAttendance = (role) => ADMIN_ATTENDANCE_VIEW_ROLES.has(String(role || ""));

const ensureManageAttendanceRole = (req, res) => {
  if (!canManageAttendance(req.user?.role)) {
    res.status(403).json({
      message: "Only admin and management roles can perform this action",
    });
    return false;
  }
  return true;
};

const ensurePersonalAttendanceRole = (req, res) => {
  if (isPlatformAdminRole(req.user?.role)) {
    res.status(403).json({
      message: "Admin users audit attendance and cannot mark personal attendance",
    });
    return false;
  }
  return true;
};

const ensureUserInScope = async ({ actor, targetUserId }) => {
  if (!actor?.companyId || !targetUserId) return false;
  if (isPlatformAdminRole(actor.role)) return true;
  if (!MANAGEMENT_ROLES.includes(actor.role)) return false;
  const descendants = await getDescendantUsers({
    rootUserId: actor._id,
    companyId: actor.companyId,
    includeInactive: false,
    select: "_id role parentId isActive",
  });
  return descendants.some((row) => String(row._id) === String(targetUserId))
    || String(actor._id) === String(targetUserId);
};

exports.getAttendancePolicy = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }
    if (!ensureManageAttendanceRole(req, res)) return null;

    const policy = await resolvePolicyForCompany(req.user.companyId);
    return res.json({ policy });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getAttendancePolicy failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.upsertAttendancePolicy = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }
    if (!ensureManageAttendanceRole(req, res)) return null;

    const payload = {
      timezone: toTrimmedString(req.body?.timezone) || DEFAULT_POLICY.timezone,
      shiftStartMinutes: clampInteger(
        toInteger(req.body?.shiftStartMinutes, DEFAULT_POLICY.shiftStartMinutes),
        0,
        1439,
      ),
      shiftEndMinutes: clampInteger(
        toInteger(req.body?.shiftEndMinutes, DEFAULT_POLICY.shiftEndMinutes),
        0,
        1439,
      ),
      graceMinutes: clampInteger(
        toInteger(req.body?.graceMinutes, DEFAULT_POLICY.graceMinutes),
        0,
        180,
      ),
      halfDayMinutes: clampInteger(
        toInteger(req.body?.halfDayMinutes, DEFAULT_POLICY.halfDayMinutes),
        0,
        1000,
      ),
      fullDayMinutes: clampInteger(
        toInteger(req.body?.fullDayMinutes, DEFAULT_POLICY.fullDayMinutes),
        0,
        1000,
      ),
      weeklyOffDays: normalizeWeeklyOffDays(req.body?.weeklyOffDays),
      allowCheckoutDuringBreak: Object.prototype.hasOwnProperty.call(req.body || {}, "allowCheckoutDuringBreak")
        ? Boolean(req.body.allowCheckoutDuringBreak)
        : DEFAULT_POLICY.allowCheckoutDuringBreak,
      geofenceEnabled: Object.prototype.hasOwnProperty.call(req.body || {}, "geofenceEnabled")
        ? Boolean(req.body.geofenceEnabled)
        : DEFAULT_POLICY.geofenceEnabled,
      officeLatitude: toCoordinate(req.body?.officeLatitude, -90, 90),
      officeLongitude: toCoordinate(req.body?.officeLongitude, -180, 180),
      officeRadiusMeters: clampInteger(
        toInteger(req.body?.officeRadiusMeters, DEFAULT_POLICY.officeRadiusMeters),
        10,
        5000,
      ),
      notes: toTrimmedString(req.body?.notes).slice(0, 500),
    };

    if (!payload.weeklyOffDays.length) {
      payload.weeklyOffDays = [...DEFAULT_POLICY.weeklyOffDays];
    }
    if (
      payload.geofenceEnabled
      && (!Number.isFinite(payload.officeLatitude) || !Number.isFinite(payload.officeLongitude))
    ) {
      return res.status(400).json({
        message: "Valid office latitude and longitude are required when geofence is enabled",
      });
    }

    const updated = await AttendancePolicy.findOneAndUpdate(
      { companyId: req.user.companyId },
      { $set: payload },
      { upsert: true, setDefaultsOnInsert: true, new: true },
    ).lean();

    return res.json({
      message: "Attendance policy updated",
      policy: toPolicyView(updated),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "upsertAttendancePolicy failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.checkIn = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }
    if (!ensurePersonalAttendanceRole(req, res)) return null;

    const policy = await resolvePolicyForCompany(req.user.companyId);
    const now = new Date();
    const attendanceDate = toDateKeyInTimezone(now, policy.timezone);
    if (!ATTENDANCE_DATE_PATTERN.test(attendanceDate)) {
      return res.status(500).json({ message: "Failed to resolve attendance date" });
    }

    const rawSource = toTrimmedString(req.body?.source).toUpperCase();
    const source = Object.values(ATTENDANCE_SOURCE).includes(rawSource)
      ? rawSource
      : ATTENDANCE_SOURCE.WEB;
    const checkInNote = toTrimmedString(req.body?.note).slice(0, 240);
    const parsedLocation = parseAttendanceLocation(req.body?.location);
    const geofenceResult = validateAttendanceGeofence({
      policy,
      location: parsedLocation,
      actionLabel: "check-in",
    });
    if (geofenceResult?.status) {
      return res.status(geofenceResult.status).json({
        message: geofenceResult.message,
        distanceMeters: geofenceResult.distanceMeters,
        effectiveDistanceMeters: geofenceResult.effectiveDistanceMeters,
        accuracyMeters: geofenceResult.accuracyMeters,
      });
    }
    const userAgent = toTrimmedString(req.headers["user-agent"]).slice(0, 400);
    const ipAddress =
      toTrimmedString(req.headers["x-forwarded-for"]).split(",")[0].trim()
      || toTrimmedString(req.ip);

    let attendance = await Attendance.findOne({
      companyId: req.user.companyId,
      userId: req.user._id,
      attendanceDate,
    });

    if (attendance?.checkInAt) {
      return res.status(409).json({
        message: "Already checked in for today",
        attendance: toAttendanceView(attendance, policy),
      });
    }

    if (!attendance) {
      attendance = new Attendance({
        companyId: req.user.companyId,
        userId: req.user._id,
        attendanceDate,
      });
    }

    attendance.checkInAt = now;
    attendance.checkOutAt = null;
    attendance.workedMinutes = 0;
    attendance.totalBreakMinutes = 0;
    attendance.breakSessions = [];
    attendance.checkInLocation = geofenceResult?.location || parsedLocation || null;
    attendance.checkOutLocation = null;
    attendance.status = ATTENDANCE_STATUS.PENDING;
    attendance.source = source;
    attendance.checkInNote = checkInNote;
    attendance.checkOutNote = "";
    attendance.metadata = {
      ...(attendance.metadata || {}),
      checkInIp: ipAddress,
      checkInUserAgent: userAgent,
    };

    await attendance.save();

    return res.status(201).json({
      message: "Checked in successfully",
      attendance: toAttendanceView(attendance, policy),
      timezone: policy.timezone,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Attendance already exists for today" });
    }
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "checkIn failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.startBreak = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }
    if (!ensurePersonalAttendanceRole(req, res)) return null;

    const policy = await resolvePolicyForCompany(req.user.companyId);
    const now = new Date();
    const attendanceDate = toDateKeyInTimezone(now, policy.timezone);
    if (!ATTENDANCE_DATE_PATTERN.test(attendanceDate)) {
      return res.status(500).json({ message: "Failed to resolve attendance date" });
    }

    const attendance = await Attendance.findOne({
      companyId: req.user.companyId,
      userId: req.user._id,
      attendanceDate,
    });

    if (!attendance || !attendance.checkInAt) {
      return res.status(400).json({ message: "Check-in is required before starting break" });
    }
    if (attendance.checkOutAt) {
      return res.status(400).json({ message: "Cannot start break after check-out" });
    }

    const normalized = normalizeBreakSessions(attendance.breakSessions, {
      includeOpenTill: now,
    });
    if (normalized.activeBreakStartedAt) {
      return res.status(409).json({
        message: "Break already started",
        attendance: toAttendanceView(attendance, policy),
      });
    }

    attendance.breakSessions = [
      ...normalized.sessions,
      {
        startAt: now,
        endAt: null,
        durationMinutes: 0,
        startNote: toBreakNote(req.body?.note),
        endNote: "",
      },
    ];

    applyWorkingSnapshot(attendance, { referenceTime: now });
    await attendance.save();

    return res.status(201).json({
      message: "Break started",
      attendance: toAttendanceView(attendance, policy),
      timezone: policy.timezone,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "startBreak failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.endBreak = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }
    if (!ensurePersonalAttendanceRole(req, res)) return null;

    const policy = await resolvePolicyForCompany(req.user.companyId);
    const now = new Date();
    const attendanceDate = toDateKeyInTimezone(now, policy.timezone);
    if (!ATTENDANCE_DATE_PATTERN.test(attendanceDate)) {
      return res.status(500).json({ message: "Failed to resolve attendance date" });
    }

    const attendance = await Attendance.findOne({
      companyId: req.user.companyId,
      userId: req.user._id,
      attendanceDate,
    });

    if (!attendance || !attendance.checkInAt) {
      return res.status(400).json({ message: "Check-in is required before ending break" });
    }
    if (attendance.checkOutAt) {
      return res.status(400).json({ message: "Cannot end break after check-out" });
    }

    const currentSessions = normalizeBreakSessions(attendance.breakSessions, {
      includeOpenTill: now,
    }).sessions;
    const activeBreakIndex = getActiveBreakIndex(currentSessions);
    if (activeBreakIndex < 0) {
      return res.status(400).json({ message: "No active break found" });
    }

    currentSessions[activeBreakIndex] = {
      ...currentSessions[activeBreakIndex],
      endAt: now,
      durationMinutes: toMinutesBetween(currentSessions[activeBreakIndex].startAt, now),
      endNote: toBreakNote(req.body?.note),
    };

    attendance.breakSessions = currentSessions;
    applyWorkingSnapshot(attendance, { referenceTime: now });
    await attendance.save();

    return res.json({
      message: "Break ended",
      attendance: toAttendanceView(attendance, policy),
      timezone: policy.timezone,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "endBreak failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.checkOut = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }
    if (!ensurePersonalAttendanceRole(req, res)) return null;

    const policy = await resolvePolicyForCompany(req.user.companyId);
    const now = new Date();
    const attendanceDate = toDateKeyInTimezone(now, policy.timezone);
    if (!ATTENDANCE_DATE_PATTERN.test(attendanceDate)) {
      return res.status(500).json({ message: "Failed to resolve attendance date" });
    }

    const attendance = await Attendance.findOne({
      companyId: req.user.companyId,
      userId: req.user._id,
      attendanceDate,
    });

    if (!attendance || !attendance.checkInAt) {
      return res.status(400).json({ message: "Check-in is required before check-out" });
    }
    if (attendance.checkOutAt) {
      return res.status(409).json({
        message: "Already checked out for today",
        attendance: toAttendanceView(attendance, policy),
      });
    }

    const normalizedBreaks = normalizeBreakSessions(attendance.breakSessions, {
      includeOpenTill: now,
    });
    if (normalizedBreaks.activeBreakStartedAt && !policy.allowCheckoutDuringBreak) {
      return res.status(400).json({
        message: "Active break must be ended before check-out as per attendance policy",
      });
    }

    const parsedLocation = parseAttendanceLocation(req.body?.location);
    const geofenceResult = validateAttendanceGeofence({
      policy,
      location: parsedLocation,
      actionLabel: "check-out",
    });
    if (geofenceResult?.status) {
      return res.status(geofenceResult.status).json({
        message: geofenceResult.message,
        distanceMeters: geofenceResult.distanceMeters,
        effectiveDistanceMeters: geofenceResult.effectiveDistanceMeters,
        accuracyMeters: geofenceResult.accuracyMeters,
      });
    }

    attendance.checkOutAt = now;
    applyWorkingSnapshot(attendance, {
      referenceTime: now,
      closeOpenBreakAt: now,
    });
    attendance.status = resolveAttendanceStatus({
      attendanceDate,
      checkInAt: attendance.checkInAt,
      workedMinutes: attendance.workedMinutes,
      policy,
    });
    attendance.checkOutNote = toTrimmedString(req.body?.note).slice(0, 240);
    attendance.checkOutLocation = geofenceResult?.location || parsedLocation || null;
    attendance.metadata = {
      ...(attendance.metadata || {}),
      checkOutIp:
        toTrimmedString(req.headers["x-forwarded-for"]).split(",")[0].trim()
        || toTrimmedString(req.ip),
      checkOutUserAgent: toTrimmedString(req.headers["user-agent"]).slice(0, 400),
    };

    await attendance.save();

    return res.json({
      message: "Checked out successfully",
      attendance: toAttendanceView(attendance, policy),
      timezone: policy.timezone,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "checkOut failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getMyLeaveBalance = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }
    if (isPlatformAdminRole(req.user?.role)) {
      return res.status(403).json({ message: "Admin users do not have employee leave balance" });
    }

    const policy = await resolvePolicyForCompany(req.user.companyId);
    const requestedMonth = toTrimmedString(req.query.month) || toMonthKeyFromDate(new Date(), policy.timezone);
    if (!MONTH_KEY_PATTERN.test(requestedMonth)) {
      return res.status(400).json({ message: "month must be in YYYY-MM format" });
    }

    const user = await User.findOne({
      _id: req.user._id,
      companyId: req.user.companyId,
      isActive: true,
    })
      .select("_id createdAt role")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (isPlatformAdminRole(user.role)) {
      return res.status(403).json({ message: "Admin users do not have employee leave balance" });
    }

    const startMonth = toMonthKeyFromDate(user.createdAt || new Date(), policy.timezone);
    const monthsAccrued = getMonthSpanInclusive(startMonth, requestedMonth);
    const accrued = monthsAccrued;
    const requestedMonthRange = resolveMonthRange(requestedMonth);

    const leaveRows = await LeaveRequest.find({
      companyId: req.user.companyId,
      userId: req.user._id,
      status: { $in: ["PENDING", "APPROVED"] },
      leaveType: { $ne: "UNPAID" },
      fromDate: { $lte: requestedMonthRange.to },
    })
      .select("_id fromDate toDate totalDays leaveType status")
      .lean();

    const used = leaveRows
      .filter((row) => row.status === "APPROVED")
      .reduce((sum, row) => sum + Number(row.totalDays || 0), 0);
    const pending = leaveRows
      .filter((row) => row.status === "PENDING")
      .reduce((sum, row) => sum + Number(row.totalDays || 0), 0);
    const available = Math.max(0, accrued - used);

    return res.json({
      month: requestedMonth,
      timezone: policy.timezone,
      monthlyAccrual: 1,
      accrualStartMonth: startMonth,
      monthsAccrued,
      accrued,
      used,
      pending,
      available,
      carryForward: available,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getMyLeaveBalance failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.createLeaveRequest = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }
    if (!ensurePersonalAttendanceRole(req, res)) return null;

    const fromDate = toTrimmedString(req.body?.fromDate);
    const toDate = toTrimmedString(req.body?.toDate) || fromDate;
    const leaveTypeRaw = toTrimmedString(req.body?.leaveType).toUpperCase();
    const reason = toReason(req.body?.reason);

    if (!ATTENDANCE_DATE_PATTERN.test(fromDate) || !ATTENDANCE_DATE_PATTERN.test(toDate)) {
      return res.status(400).json({ message: "fromDate and toDate must be in YYYY-MM-DD format" });
    }
    if (fromDate > toDate) {
      return res.status(400).json({ message: "fromDate cannot be after toDate" });
    }
    if (!reason) {
      return res.status(400).json({ message: "reason is required" });
    }

    const span = getDaySpanInclusive(fromDate, toDate);
    if (!span || span > MAX_LEAVE_SPAN_DAYS) {
      return res.status(400).json({
        message: `Leave span must be between 1 and ${MAX_LEAVE_SPAN_DAYS} days`,
      });
    }

    const leaveType = LEAVE_TYPES.includes(leaveTypeRaw) ? leaveTypeRaw : "CASUAL";

    const overlap = await LeaveRequest.findOne({
      companyId: req.user.companyId,
      userId: req.user._id,
      status: { $in: ["PENDING", "APPROVED"] },
      fromDate: { $lte: toDate },
      toDate: { $gte: fromDate },
    })
      .select("_id fromDate toDate status")
      .lean();
    if (overlap) {
      return res.status(409).json({
        message: "Overlapping leave request already exists",
      });
    }

    const created = await LeaveRequest.create({
      companyId: req.user.companyId,
      userId: req.user._id,
      fromDate,
      toDate,
      totalDays: span,
      leaveType,
      reason,
      status: "PENDING",
    });

    return res.status(201).json({
      message: "Leave request created",
      leaveRequest: toLeaveView(created.toObject()),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "createLeaveRequest failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getMyLeaveRequests = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }
    if (!ensurePersonalAttendanceRole(req, res)) return null;

    const rows = await LeaveRequest.find({
      companyId: req.user.companyId,
      userId: req.user._id,
    })
      .sort({ createdAt: -1 })
      .limit(120)
      .lean();

    return res.json({
      count: rows.length,
      leaveRequests: rows.map(toLeaveView),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getMyLeaveRequests failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getAdminLeaveRequests = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }
    if (!ensureManageAttendanceRole(req, res)) return null;

    const scopedUsers = await getScopedUsersForAttendanceViewer(req.user);
    const userIds = scopedUsers.map((row) => row._id);
    const status = toTrimmedString(req.query.status).toUpperCase();
    const query = {
      companyId: req.user.companyId,
      userId: { $in: userIds },
    };
    if (LEAVE_STATUS.includes(status)) {
      query.status = status;
    }

    const rows = await LeaveRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(300)
      .populate("userId", "_id name email role")
      .populate("reviewedBy", "_id name email role")
      .lean();

    return res.json({
      count: rows.length,
      leaveRequests: rows.map((row) => ({
        ...toLeaveView(row),
        user: row.userId
          ? {
            _id: row.userId._id,
            name: row.userId.name || "",
            email: row.userId.email || "",
            role: row.userId.role || "",
          }
          : null,
        reviewedByUser: row.reviewedBy
          ? {
            _id: row.reviewedBy._id,
            name: row.reviewedBy.name || "",
            email: row.reviewedBy.email || "",
            role: row.reviewedBy.role || "",
          }
          : null,
      })),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getAdminLeaveRequests failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.reviewLeaveRequest = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }
    if (!ensureManageAttendanceRole(req, res)) return null;

    const requestId = toTrimmedString(req.params?.requestId);
    const nextStatus = toTrimmedString(req.body?.status).toUpperCase();
    if (!REVIEWABLE_LEAVE_STATUS.has(nextStatus)) {
      return res.status(400).json({ message: "status must be APPROVED or REJECTED" });
    }

    const leaveRequest = await LeaveRequest.findOne({
      _id: requestId,
      companyId: req.user.companyId,
    });
    if (!leaveRequest) {
      return res.status(404).json({ message: "Leave request not found" });
    }
    if (leaveRequest.status !== "PENDING") {
      return res.status(400).json({ message: "Only pending requests can be reviewed" });
    }

    const inScope = await ensureUserInScope({
      actor: req.user,
      targetUserId: leaveRequest.userId,
    });
    if (!inScope) {
      return res.status(403).json({
        message: "You cannot review leave requests outside your hierarchy",
      });
    }

    leaveRequest.status = nextStatus;
    leaveRequest.reviewedBy = req.user._id;
    leaveRequest.reviewedAt = new Date();
    leaveRequest.reviewNote = toReason(req.body?.reviewNote);
    await leaveRequest.save();

    return res.json({
      message: `Leave request ${nextStatus.toLowerCase()}`,
      leaveRequest: toLeaveView(leaveRequest.toObject()),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "reviewLeaveRequest failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.createRegularizationRequest = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const attendanceDate = toTrimmedString(req.body?.attendanceDate);
    const requestedCheckInAt = toSafeDate(req.body?.requestedCheckInAt);
    const requestedCheckOutAt = toSafeDate(req.body?.requestedCheckOutAt);
    const requestedTotalBreakMinutes = clampInteger(
      toPositiveInteger(req.body?.requestedTotalBreakMinutes, 0),
      0,
      1000,
    );
    const reason = toReason(req.body?.reason);

    if (!ATTENDANCE_DATE_PATTERN.test(attendanceDate)) {
      return res.status(400).json({ message: "attendanceDate must be in YYYY-MM-DD format" });
    }
    if (!reason) {
      return res.status(400).json({ message: "reason is required" });
    }
    if (!requestedCheckInAt && !requestedCheckOutAt) {
      return res.status(400).json({ message: "requestedCheckInAt or requestedCheckOutAt is required" });
    }
    if (requestedCheckInAt && requestedCheckOutAt && requestedCheckOutAt <= requestedCheckInAt) {
      return res.status(400).json({ message: "requestedCheckOutAt must be greater than requestedCheckInAt" });
    }

    const pendingRow = await AttendanceRegularization.findOne({
      companyId: req.user.companyId,
      userId: req.user._id,
      attendanceDate,
      status: "PENDING",
    })
      .select("_id")
      .lean();
    if (pendingRow) {
      return res.status(409).json({
        message: "Pending regularization request already exists for this date",
      });
    }

    const created = await AttendanceRegularization.create({
      companyId: req.user.companyId,
      userId: req.user._id,
      attendanceDate,
      requestedCheckInAt,
      requestedCheckOutAt,
      requestedTotalBreakMinutes,
      reason,
      status: "PENDING",
    });

    return res.status(201).json({
      message: "Regularization request submitted",
      regularization: toRegularizationView(created.toObject()),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "createRegularizationRequest failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getMyRegularizations = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const rows = await AttendanceRegularization.find({
      companyId: req.user.companyId,
      userId: req.user._id,
    })
      .sort({ createdAt: -1 })
      .limit(120)
      .lean();

    return res.json({
      count: rows.length,
      regularizations: rows.map(toRegularizationView),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getMyRegularizations failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getAdminRegularizations = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }
    if (!ensureManageAttendanceRole(req, res)) return null;

    const scopedUsers = await getScopedUsersForAttendanceViewer(req.user);
    const userIds = scopedUsers.map((row) => row._id);
    const status = toTrimmedString(req.query.status).toUpperCase();
    const query = {
      companyId: req.user.companyId,
      userId: { $in: userIds },
    };
    if (REGULARIZATION_STATUS.includes(status)) {
      query.status = status;
    }

    const rows = await AttendanceRegularization.find(query)
      .sort({ createdAt: -1 })
      .limit(300)
      .populate("userId", "_id name email role")
      .populate("reviewedBy", "_id name email role")
      .populate("resolvedAttendanceId", "_id attendanceDate status checkInAt checkOutAt workedMinutes")
      .lean();

    return res.json({
      count: rows.length,
      regularizations: rows.map((row) => ({
        ...toRegularizationView(row),
        user: row.userId
          ? {
            _id: row.userId._id,
            name: row.userId.name || "",
            email: row.userId.email || "",
            role: row.userId.role || "",
          }
          : null,
        reviewedByUser: row.reviewedBy
          ? {
            _id: row.reviewedBy._id,
            name: row.reviewedBy.name || "",
            email: row.reviewedBy.email || "",
            role: row.reviewedBy.role || "",
          }
          : null,
      })),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getAdminRegularizations failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.reviewRegularization = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }
    if (!ensureManageAttendanceRole(req, res)) return null;

    const regularizationId = toTrimmedString(req.params?.regularizationId);
    const nextStatus = toTrimmedString(req.body?.status).toUpperCase();
    if (!REVIEWABLE_REGULARIZATION_STATUS.has(nextStatus)) {
      return res.status(400).json({ message: "status must be APPROVED or REJECTED" });
    }

    const regularization = await AttendanceRegularization.findOne({
      _id: regularizationId,
      companyId: req.user.companyId,
    });
    if (!regularization) {
      return res.status(404).json({ message: "Regularization request not found" });
    }
    if (regularization.status !== "PENDING") {
      return res.status(400).json({ message: "Only pending requests can be reviewed" });
    }

    const inScope = await ensureUserInScope({
      actor: req.user,
      targetUserId: regularization.userId,
    });
    if (!inScope) {
      return res.status(403).json({
        message: "You cannot review regularization requests outside your hierarchy",
      });
    }

    if (nextStatus === "APPROVED") {
      const policy = await resolvePolicyForCompany(req.user.companyId);
      let attendance = await Attendance.findOne({
        companyId: req.user.companyId,
        userId: regularization.userId,
        attendanceDate: regularization.attendanceDate,
      });
      if (!attendance) {
        attendance = new Attendance({
          companyId: req.user.companyId,
          userId: regularization.userId,
          attendanceDate: regularization.attendanceDate,
        });
      }

      if (regularization.requestedCheckInAt) {
        attendance.checkInAt = regularization.requestedCheckInAt;
      }
      if (regularization.requestedCheckOutAt) {
        attendance.checkOutAt = regularization.requestedCheckOutAt;
      }
      if (attendance.checkInAt && attendance.checkOutAt && attendance.checkOutAt <= attendance.checkInAt) {
        return res.status(400).json({
          message: "Regularization creates invalid check-in/check-out duration",
        });
      }

      attendance.breakSessions = [];
      applyWorkingSnapshot(attendance, {
        referenceTime: attendance.checkOutAt || new Date(),
        explicitBreakMinutes: regularization.requestedTotalBreakMinutes,
      });
      attendance.source = ATTENDANCE_SOURCE.MANUAL;
      attendance.status = attendance.checkInAt && attendance.checkOutAt
        ? resolveAttendanceStatus({
          attendanceDate: attendance.attendanceDate,
          checkInAt: attendance.checkInAt,
          workedMinutes: attendance.workedMinutes,
          policy,
        })
        : ATTENDANCE_STATUS.PENDING;
      attendance.checkOutNote = "Regularized by reviewer";
      await attendance.save();
      regularization.resolvedAttendanceId = attendance._id;
    }

    regularization.status = nextStatus;
    regularization.reviewedBy = req.user._id;
    regularization.reviewedAt = new Date();
    regularization.reviewNote = toReason(req.body?.reviewNote);
    await regularization.save();

    return res.json({
      message: `Regularization request ${nextStatus.toLowerCase()}`,
      regularization: toRegularizationView(regularization.toObject()),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "reviewRegularization failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getMyAttendance = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const policy = await resolvePolicyForCompany(req.user.companyId);
    const range = resolveRangeFromQuery(req.query);
    if (range.error) {
      return res.status(400).json({ message: range.error });
    }

    const pagination = parsePagination(req.query, {
      defaultLimit: Number.parseInt(process.env.ATTENDANCE_PAGE_LIMIT, 10) || 31,
      maxLimit: Number.parseInt(process.env.ATTENDANCE_PAGE_MAX_LIMIT, 10) || 120,
    });

    const query = {
      companyId: req.user.companyId,
      userId: req.user._id,
      attendanceDate: { $gte: range.from, $lte: range.to },
    };

    const rowsQuery = Attendance.find(query)
      .sort({ attendanceDate: -1, checkInAt: -1, createdAt: -1 });
    if (pagination.enabled) {
      rowsQuery.skip(pagination.skip).limit(pagination.limit);
    }

    const [rows, todayAttendance, totalCount, leaveMap] = await Promise.all([
      rowsQuery.lean(),
      Attendance.findOne({
        companyId: req.user.companyId,
        userId: req.user._id,
        attendanceDate: toDateKeyInTimezone(new Date(), policy.timezone),
      }).lean(),
      pagination.enabled ? Attendance.countDocuments(query) : Promise.resolve(0),
      getApprovedLeavesMap({
        companyId: req.user.companyId,
        userIds: [req.user._id],
        fromDate: range.from,
        toDate: range.to,
      }),
    ]);

    const attendanceMap = new Map(
      rows.map((row) => [String(row.attendanceDate), toAttendanceView(row, policy)]),
    );
    const userLeaveMap = leaveMap.get(String(req.user._id)) || new Map();
    userLeaveMap.forEach((leaveRow, dateKey) => {
      if (attendanceMap.has(dateKey)) return;
      attendanceMap.set(dateKey, {
        _id: `leave:${dateKey}`,
        attendanceDate: dateKey,
        checkInAt: null,
        checkOutAt: null,
        workedMinutes: 0,
        workedHours: 0,
        totalBreakMinutes: 0,
        totalBreakHours: 0,
        breakSessions: [],
        activeBreakStartedAt: null,
        isOnBreak: false,
        status: ATTENDANCE_STATUS.LEAVE,
        source: leaveRow.leaveType || "LEAVE",
        checkInNote: "",
        checkOutNote: leaveRow.reason || "",
        createdAt: leaveRow.createdAt || null,
        updatedAt: leaveRow.updatedAt || null,
      });
    });

    const attendance = [...attendanceMap.values()].sort((left, right) =>
      String(right.attendanceDate || "").localeCompare(String(left.attendanceDate || "")));

    const presentDays = attendance.filter((row) =>
      [
        ATTENDANCE_STATUS.PRESENT,
        LIVE_ATTENDANCE_STATUS.WORKING,
        LIVE_ATTENDANCE_STATUS.BREAK,
      ].includes(row.status)).length;
    const lateDays = attendance.filter((row) => row.isLateCheckIn).length;
    const halfDays = attendance.filter((row) => row.status === ATTENDANCE_STATUS.HALF_DAY).length;
    const absentDays = attendance.filter((row) => row.status === ATTENDANCE_STATUS.ABSENT).length;
    const leaveDays = attendance.filter((row) => row.status === ATTENDANCE_STATUS.LEAVE).length;
    const pendingDays = attendance.filter((row) => row.status === ATTENDANCE_STATUS.PENDING).length;
    const totalWorkedMinutes = attendance.reduce(
      (sum, row) => sum + Number(row.workedMinutes || 0),
      0,
    );
    const totalBreakMinutes = attendance.reduce(
      (sum, row) => sum + Number(row.totalBreakMinutes || 0),
      0,
    );

    const payload = {
      timezone: policy.timezone,
      from: range.from,
      to: range.to,
      today: todayAttendance ? toAttendanceView(todayAttendance, policy) : null,
      policy,
      summary: {
        totalDays: attendance.length,
        presentDays,
        lateDays,
        halfDays,
        absentDays,
        leaveDays,
        pendingDays,
        totalWorkedMinutes,
        totalWorkedHours: Math.round((totalWorkedMinutes / 60) * 100) / 100,
        totalBreakMinutes,
        totalBreakHours: Math.round((totalBreakMinutes / 60) * 100) / 100,
      },
      attendance,
    };

    if (pagination.enabled) {
      payload.pagination = buildPaginationMeta({
        page: pagination.page,
        limit: pagination.limit,
        totalCount,
      });
    } else {
      payload.count = attendance.length;
    }

    return res.json(payload);
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getMyAttendance failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getUserAttendanceForAdmin = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }
    if (!ensureManageAttendanceRole(req, res)) return null;

    const targetUserId = toTrimmedString(req.params?.userId);
    if (!targetUserId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const inScope = await ensureUserInScope({
      actor: req.user,
      targetUserId,
    });
    if (!inScope) {
      return res.status(403).json({ message: "User is outside your attendance scope" });
    }

    const targetUser = await User.findOne({
      _id: targetUserId,
      companyId: req.user.companyId,
    })
      .select("_id name email role")
      .lean();
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const policy = await resolvePolicyForCompany(req.user.companyId);
    const range = resolveRangeFromQuery(req.query);
    if (range.error) {
      return res.status(400).json({ message: range.error });
    }

    const query = {
      companyId: req.user.companyId,
      userId: targetUser._id,
      attendanceDate: { $gte: range.from, $lte: range.to },
    };

    const [rows, leaveMap] = await Promise.all([
      Attendance.find(query)
        .sort({ attendanceDate: -1, checkInAt: -1, createdAt: -1 })
        .lean(),
      getApprovedLeavesMap({
        companyId: req.user.companyId,
        userIds: [targetUser._id],
        fromDate: range.from,
        toDate: range.to,
      }),
    ]);

    const attendanceMap = new Map(
      rows.map((row) => [String(row.attendanceDate), toAttendanceView(row, policy)]),
    );
    const userLeaveMap = leaveMap.get(String(targetUser._id)) || new Map();
    userLeaveMap.forEach((leaveRow, dateKey) => {
      if (attendanceMap.has(dateKey)) return;
      attendanceMap.set(dateKey, {
        _id: `leave:${targetUser._id}:${dateKey}`,
        attendanceDate: dateKey,
        checkInAt: null,
        checkOutAt: null,
        workedMinutes: 0,
        workedHours: 0,
        totalBreakMinutes: 0,
        totalBreakHours: 0,
        breakSessions: [],
        activeBreakStartedAt: null,
        isOnBreak: false,
        isLateCheckIn: false,
        status: ATTENDANCE_STATUS.LEAVE,
        source: leaveRow.leaveType || "LEAVE",
        checkInNote: "",
        checkOutNote: leaveRow.reason || "",
        createdAt: leaveRow.createdAt || null,
        updatedAt: leaveRow.updatedAt || null,
      });
    });

    const attendance = [...attendanceMap.values()].sort((left, right) =>
      String(right.attendanceDate || "").localeCompare(String(left.attendanceDate || "")));

    const presentDays = attendance.filter((row) =>
      [
        ATTENDANCE_STATUS.PRESENT,
        LIVE_ATTENDANCE_STATUS.WORKING,
        LIVE_ATTENDANCE_STATUS.BREAK,
      ].includes(row.status)).length;
    const lateDays = attendance.filter((row) => row.isLateCheckIn).length;
    const halfDays = attendance.filter((row) => row.status === ATTENDANCE_STATUS.HALF_DAY).length;
    const absentDays = attendance.filter((row) => row.status === ATTENDANCE_STATUS.ABSENT).length;
    const leaveDays = attendance.filter((row) => row.status === ATTENDANCE_STATUS.LEAVE).length;
    const pendingDays = attendance.filter((row) => row.status === ATTENDANCE_STATUS.PENDING).length;
    const totalWorkedMinutes = attendance.reduce(
      (sum, row) => sum + Number(row.workedMinutes || 0),
      0,
    );
    const totalBreakMinutes = attendance.reduce(
      (sum, row) => sum + Number(row.totalBreakMinutes || 0),
      0,
    );

    return res.json({
      timezone: policy.timezone,
      from: range.from,
      to: range.to,
      user: toUserView(targetUser),
      policy,
      summary: {
        totalDays: attendance.length,
        presentDays,
        lateDays,
        halfDays,
        absentDays,
        leaveDays,
        pendingDays,
        totalWorkedMinutes,
        totalWorkedHours: Math.round((totalWorkedMinutes / 60) * 100) / 100,
        totalBreakMinutes,
        totalBreakHours: Math.round((totalBreakMinutes / 60) * 100) / 100,
      },
      attendance,
      count: attendance.length,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getUserAttendanceForAdmin failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateUserAttendanceStatus = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }
    if (!ensureManageAttendanceRole(req, res)) return null;

    const targetUserId = toTrimmedString(req.params?.userId);
    const attendanceDate = toTrimmedString(req.params?.date);
    const nextStatus = toTrimmedString(req.body?.status).toUpperCase();
    const note = toTrimmedString(req.body?.note).slice(0, 240);

    if (!targetUserId) {
      return res.status(400).json({ message: "userId is required" });
    }
    if (!ATTENDANCE_DATE_PATTERN.test(attendanceDate)) {
      return res.status(400).json({ message: "date must be in YYYY-MM-DD format" });
    }
    if (![
      ATTENDANCE_STATUS.PRESENT,
      ATTENDANCE_STATUS.HALF_DAY,
      ATTENDANCE_STATUS.ABSENT,
    ].includes(nextStatus)) {
      return res.status(400).json({ message: "status must be PRESENT, HALF_DAY, or ABSENT" });
    }

    const canAccessTarget = await ensureUserInScope({
      actor: req.user,
      targetUserId,
    });
    if (!canAccessTarget) {
      return res.status(403).json({ message: "User is outside your attendance scope" });
    }

    const targetUser = await User.findOne({
      _id: targetUserId,
      companyId: req.user.companyId,
      isActive: true,
    })
      .select("_id name email role")
      .lean();
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }
    if (isPlatformAdminRole(targetUser.role)) {
      return res.status(403).json({ message: "Admin attendance cannot be marked manually" });
    }

    const policy = await resolvePolicyForCompany(req.user.companyId);
    let attendance = await Attendance.findOne({
      companyId: req.user.companyId,
      userId: targetUser._id,
      attendanceDate,
    });

    if (!attendance) {
      attendance = new Attendance({
        companyId: req.user.companyId,
        userId: targetUser._id,
        attendanceDate,
      });
    }

    attendance.status = nextStatus;
    attendance.source = ATTENDANCE_SOURCE.MANUAL;
    attendance.totalBreakMinutes = nextStatus === ATTENDANCE_STATUS.ABSENT
      ? 0
      : Number(attendance.totalBreakMinutes || 0);
    attendance.breakSessions = nextStatus === ATTENDANCE_STATUS.ABSENT
      ? []
      : normalizeBreakSessions(attendance.breakSessions).sessions;
    attendance.workedMinutes = nextStatus === ATTENDANCE_STATUS.PRESENT
      ? Number(policy.fullDayMinutes || DEFAULT_POLICY.fullDayMinutes)
      : nextStatus === ATTENDANCE_STATUS.HALF_DAY
        ? Number(policy.halfDayMinutes || DEFAULT_POLICY.halfDayMinutes)
        : 0;

    if (nextStatus === ATTENDANCE_STATUS.ABSENT) {
      attendance.checkInAt = null;
      attendance.checkOutAt = null;
      attendance.checkInNote = note || "Marked absent manually";
      attendance.checkOutNote = "";
    } else {
      attendance.checkInNote = note || `Marked ${nextStatus.toLowerCase().replaceAll("_", " ")} manually`;
    }

    attendance.metadata = {
      ...(attendance.metadata || {}),
      manualStatusBy: req.user._id,
      manualStatusAt: new Date(),
      manualStatusNote: note,
    };

    await attendance.save();

    return res.json({
      message: "Attendance status updated",
      user: toUserView(targetUser),
      attendance: toAttendanceView(attendance.toObject(), policy),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "updateUserAttendanceStatus failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getDailyAttendanceForAdmin = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }
    if (!ensureManageAttendanceRole(req, res)) return null;

    const policy = await resolvePolicyForCompany(req.user.companyId);
    const requestedDate = toTrimmedString(req.query.date) || toDateKeyInTimezone(new Date(), policy.timezone);
    if (!ATTENDANCE_DATE_PATTERN.test(requestedDate)) {
      return res.status(400).json({ message: "date must be in YYYY-MM-DD format" });
    }

    const scopedUsers = await getScopedUsersForAttendanceViewer(req.user);
    if (!scopedUsers.length) {
      return res.json({
        timezone: policy.timezone,
        date: requestedDate,
        summary: {
          totalUsers: 0,
          checkedIn: 0,
          checkedOut: 0,
          activeLogins: 0,
          onBreak: 0,
          leave: 0,
          absent: 0,
        },
        attendance: [],
      });
    }

    const userIds = scopedUsers.map((user) => user._id);
    const [attendanceRows, leaveMap] = await Promise.all([
      Attendance.find({
        companyId: req.user.companyId,
        attendanceDate: requestedDate,
        userId: { $in: userIds },
      })
        .select(
          "_id userId attendanceDate checkInAt checkOutAt checkInLocation checkOutLocation workedMinutes totalBreakMinutes breakSessions status source checkInNote checkOutNote createdAt updatedAt",
        )
        .lean(),
      getApprovedLeavesMap({
        companyId: req.user.companyId,
        userIds,
        fromDate: requestedDate,
        toDate: requestedDate,
      }),
    ]);

    const attendanceByUserId = new Map(
      attendanceRows.map((row) => [String(row.userId), toAttendanceView(row, policy)]),
    );

    const statusFilter = toTrimmedString(req.query.status).toUpperCase();
    const validStatusFilter = statusFilter && [
      ATTENDANCE_STATUS.PRESENT,
      ATTENDANCE_STATUS.HALF_DAY,
      ATTENDANCE_STATUS.PENDING,
      ATTENDANCE_STATUS.ABSENT,
      ATTENDANCE_STATUS.LEAVE,
      LIVE_ATTENDANCE_STATUS.WORKING,
      LIVE_ATTENDANCE_STATUS.BREAK,
      "ON_BREAK",
    ].includes(statusFilter)
      ? statusFilter
      : "";

    const rows = scopedUsers
      .map((user) => {
        const userId = String(user._id);
        const mappedAttendance = attendanceByUserId.get(userId);
        if (mappedAttendance) {
          return {
            user: toUserView(user),
            attendance: mappedAttendance,
          };
        }

        const leaveRow = leaveMap.get(userId)?.get(requestedDate) || null;
        if (leaveRow) {
          return {
            user: toUserView(user),
            attendance: {
              _id: `leave:${userId}:${requestedDate}`,
              attendanceDate: requestedDate,
              checkInAt: null,
              checkOutAt: null,
              workedMinutes: 0,
              workedHours: 0,
              totalBreakMinutes: 0,
              totalBreakHours: 0,
              breakSessions: [],
              activeBreakStartedAt: null,
              isOnBreak: false,
              status: ATTENDANCE_STATUS.LEAVE,
              source: leaveRow.leaveType || "LEAVE",
              checkInNote: "",
              checkOutNote: leaveRow.reason || "",
              createdAt: leaveRow.createdAt || null,
              updatedAt: leaveRow.updatedAt || null,
            },
          };
        }

        return {
          user: toUserView(user),
          attendance: {
            _id: null,
            attendanceDate: requestedDate,
            checkInAt: null,
            checkOutAt: null,
            workedMinutes: 0,
            workedHours: 0,
            totalBreakMinutes: 0,
            totalBreakHours: 0,
            breakSessions: [],
            activeBreakStartedAt: null,
            isOnBreak: false,
            status: ATTENDANCE_STATUS.ABSENT,
            source: "",
            checkInNote: "",
            checkOutNote: "",
            createdAt: null,
            updatedAt: null,
          },
        };
      })
      .filter((row) => {
        if (!validStatusFilter) return true;
        if (
          validStatusFilter === "ON_BREAK"
          || validStatusFilter === LIVE_ATTENDANCE_STATUS.BREAK
        ) {
          return Boolean(row.attendance.isOnBreak);
        }
        return row.attendance.status === validStatusFilter;
      })
      .sort((left, right) =>
        String(left.user.name || "").localeCompare(String(right.user.name || "")));

    const checkedIn = rows.filter((row) => Boolean(row.attendance.checkInAt)).length;
    const checkedOut = rows.filter((row) => Boolean(row.attendance.checkOutAt)).length;
    const activeLogins = rows.filter((row) =>
      Boolean(row.attendance.checkInAt) && !row.attendance.checkOutAt).length;
    const onBreak = rows.filter((row) => Boolean(row.attendance.isOnBreak)).length;
    const leave = rows.filter((row) => row.attendance.status === ATTENDANCE_STATUS.LEAVE).length;
    const absent = rows.filter((row) => row.attendance.status === ATTENDANCE_STATUS.ABSENT).length;

    return res.json({
      timezone: policy.timezone,
      date: requestedDate,
      policy,
      summary: {
        totalUsers: rows.length,
        checkedIn,
        checkedOut,
        activeLogins,
        onBreak,
        leave,
        absent,
      },
      attendance: rows,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getDailyAttendanceForAdmin failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};
