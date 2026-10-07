import api from "./api";

/*
 * Mirrors frontend/src/services/attendanceService.js one-for-one: same function
 * names, same arguments, same response shaping. Only the transport differs.
 * Keeping the two files structurally identical is what makes a web-side change
 * an obvious diff here rather than a silent divergence.
 */

export type AttendanceBreak = {
  _id?: string;
  startedAt?: string | null;
  endedAt?: string | null;
  minutes?: number | null;
  reason?: string;
};

export type AttendanceRecord = {
  _id?: string;
  date?: string;
  status?: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  workedMinutes?: number | null;
  breakMinutes?: number | null;
  lateMinutes?: number | null;
  breaks?: AttendanceBreak[];
  onBreak?: boolean;
  notes?: string;
};

export type AttendancePolicy = {
  workdayStart?: string;
  workdayEnd?: string;
  graceMinutes?: number;
  halfDayAfterMinutes?: number;
  minimumFullDayMinutes?: number;
  monthlyLeaveAccrual?: number;
  [key: string]: unknown;
};

export type LeaveBalance = {
  month: string;
  timezone: string;
  monthlyAccrual: number;
  accrualStartMonth: string;
  monthsAccrued: number;
  accrued: number;
  used: number;
  pending: number;
  available: number;
  carryForward: number;
};

export type LeaveRequest = {
  _id?: string;
  fromDate?: string;
  toDate?: string;
  days?: number;
  reason?: string;
  status?: "PENDING" | "APPROVED" | "REJECTED" | string;
  reviewedBy?: { _id?: string; name?: string } | null;
  reviewNote?: string;
  createdAt?: string;
  user?: { _id?: string; name?: string; role?: string } | null;
};

/* ---------------------------------------------------------------- my day -- */

export const checkInAttendance = async (payload: Record<string, unknown> = {}) => {
  const res = await api.post("/attendance/check-in", payload);
  return {
    message: String(res.data?.message || "Checked in successfully"),
    attendance: (res.data?.attendance || null) as AttendanceRecord | null,
    timezone: String(res.data?.timezone || ""),
  };
};

export const checkOutAttendance = async (payload: Record<string, unknown> = {}) => {
  const res = await api.post("/attendance/check-out", payload);
  return {
    message: String(res.data?.message || "Checked out successfully"),
    attendance: (res.data?.attendance || null) as AttendanceRecord | null,
    timezone: String(res.data?.timezone || ""),
  };
};

export const startBreakAttendance = async (payload: Record<string, unknown> = {}) => {
  const res = await api.post("/attendance/break/start", payload);
  return {
    message: String(res.data?.message || "Break started"),
    attendance: (res.data?.attendance || null) as AttendanceRecord | null,
    timezone: String(res.data?.timezone || ""),
  };
};

export const endBreakAttendance = async (payload: Record<string, unknown> = {}) => {
  const res = await api.post("/attendance/break/end", payload);
  return {
    message: String(res.data?.message || "Break ended"),
    attendance: (res.data?.attendance || null) as AttendanceRecord | null,
    timezone: String(res.data?.timezone || ""),
  };
};

export const getMyAttendance = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/attendance/me", { params });
  return {
    timezone: String(res.data?.timezone || ""),
    from: String(res.data?.from || ""),
    to: String(res.data?.to || ""),
    today: (res.data?.today || null) as AttendanceRecord | null,
    policy: (res.data?.policy || null) as AttendancePolicy | null,
    summary: (res.data?.summary || {}) as Record<string, number>,
    attendance: (Array.isArray(res.data?.attendance) ? res.data.attendance : []) as AttendanceRecord[],
    pagination: res.data?.pagination || null,
    count: Number(res.data?.count || 0),
  };
};

/* ------------------------------------------------------------ admin view -- */

export const getDailyAttendanceForAdmin = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/attendance/daily", { params });
  return {
    timezone: String(res.data?.timezone || ""),
    date: String(res.data?.date || ""),
    summary: (res.data?.summary || {}) as Record<string, number>,
    attendance: (Array.isArray(res.data?.attendance) ? res.data.attendance : []) as AttendanceRecord[],
  };
};

export const getUserAttendanceForAdmin = async (
  userId: string,
  params: Record<string, unknown> = {},
) => {
  const id = String(userId || "").trim();
  if (!id) {
    return { timezone: "", from: "", to: "", user: null, summary: {}, attendance: [], count: 0 };
  }

  const res = await api.get(`/attendance/users/${id}`, { params });
  return {
    timezone: String(res.data?.timezone || ""),
    from: String(res.data?.from || ""),
    to: String(res.data?.to || ""),
    user: res.data?.user || null,
    summary: (res.data?.summary || {}) as Record<string, number>,
    attendance: (Array.isArray(res.data?.attendance) ? res.data.attendance : []) as AttendanceRecord[],
    count: Number(res.data?.count || 0),
  };
};

export const updateUserAttendanceStatus = async (
  userId: string,
  date: string,
  payload: Record<string, unknown> = {},
) => {
  const id = String(userId || "").trim();
  const attendanceDate = String(date || "").trim();
  if (!id || !attendanceDate) {
    throw new Error("User and attendance date are required");
  }

  const res = await api.patch(`/attendance/users/${id}/${attendanceDate}/status`, payload);
  return {
    message: String(res.data?.message || "Attendance status updated"),
    user: res.data?.user || null,
    attendance: (res.data?.attendance || null) as AttendanceRecord | null,
  };
};

export const correctUserBreak = async (
  userId: string,
  date: string,
  payload: Record<string, unknown>,
) => {
  const res = await api.patch(`/attendance/users/${userId}/${date}/breaks`, payload);
  return res.data;
};

// Starts or ends a break for someone else, as of now, from the team list.
export const manageUserBreak = async (userId: string, payload: Record<string, unknown>) => {
  const res = await api.post(`/attendance/users/${userId}/break`, payload);
  return res.data;
};

/* ---------------------------------------------------------------- policy -- */

export const getAttendancePolicy = async (): Promise<AttendancePolicy | null> => {
  const res = await api.get("/attendance/policy");
  return res.data?.policy || null;
};

export const updateAttendancePolicy = async (payload: Record<string, unknown> = {}) => {
  const res = await api.patch("/attendance/policy", payload);
  return {
    message: String(res.data?.message || "Attendance policy updated"),
    policy: (res.data?.policy || null) as AttendancePolicy | null,
  };
};

/* ----------------------------------------------------------------- leave -- */

const toLeaveBalance = (data: any): LeaveBalance => ({
  month: String(data?.month || ""),
  timezone: String(data?.timezone || ""),
  monthlyAccrual: Number(data?.monthlyAccrual || 0),
  accrualStartMonth: String(data?.accrualStartMonth || ""),
  monthsAccrued: Number(data?.monthsAccrued || 0),
  accrued: Number(data?.accrued || 0),
  used: Number(data?.used || 0),
  pending: Number(data?.pending || 0),
  available: Number(data?.available || 0),
  carryForward: Number(data?.carryForward || 0),
});

export const getMyLeaveBalance = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/attendance/leave-balance/my", { params });
  return toLeaveBalance(res.data);
};

export const getLeaveBalanceForAdmin = async (
  userId: string,
  params: Record<string, unknown> = {},
) => {
  const id = String(userId || "").trim();
  if (!id) return null;

  const res = await api.get(`/attendance/leave-balance/${id}`, { params });
  return toLeaveBalance(res.data);
};

export const createLeaveRequest = async (payload: Record<string, unknown> = {}) => {
  const res = await api.post("/attendance/leave-requests", payload);
  return {
    message: String(res.data?.message || "Leave request created"),
    leaveRequest: (res.data?.leaveRequest || null) as LeaveRequest | null,
  };
};

export const getMyLeaveRequests = async (): Promise<LeaveRequest[]> => {
  const res = await api.get("/attendance/leave-requests/my");
  return Array.isArray(res.data?.leaveRequests) ? res.data.leaveRequests : [];
};

export const getAdminLeaveRequests = async (
  params: Record<string, unknown> = {},
): Promise<LeaveRequest[]> => {
  const res = await api.get("/attendance/leave-requests/admin", { params });
  return Array.isArray(res.data?.leaveRequests) ? res.data.leaveRequests : [];
};

export const reviewLeaveRequest = async (
  requestId: string,
  payload: Record<string, unknown> = {},
) => {
  const res = await api.patch(`/attendance/leave-requests/${requestId}/review`, payload);
  return {
    message: String(res.data?.message || "Leave request reviewed"),
    leaveRequest: (res.data?.leaveRequest || null) as LeaveRequest | null,
  };
};

/* ------------------------------------------------------------ violations -- */

export type AttendanceViolation = {
  _id?: string;
  userId?: { _id?: string; name?: string; role?: string } | string;
  date?: string;
  month?: string;
  kind?: "REJECTED_LEAVE" | "UNINFORMED" | string;
  level?: "RECORDED" | "WARNING" | "MANAGEMENT_REVIEW" | string;
  ordinal?: number;
  active?: boolean;
  excused?: boolean;
  note?: string;
};

export type ViolationSummary = {
  userId?: string;
  name?: string;
  role?: string;
  rejectedLeave?: number;
  uninformed?: number;
  level?: string;
};

/** The endpoint reconciles a whole month, so it answers per-month, not per-page. */
export const getAttendanceViolations = async (params: { month?: string } = {}) => {
  const res = await api.get("/attendance/violations", { params });
  return {
    month: String(res.data?.month || ""),
    summaries: (Array.isArray(res.data?.summaries) ? res.data.summaries : []) as ViolationSummary[],
    violations: (Array.isArray(res.data?.violations) ? res.data.violations : []) as AttendanceViolation[],
    policyNote: String(res.data?.policyNote || ""),
  };
};

export type ViolationAction = "WARNING_ISSUED" | "MANAGEMENT_REVIEW" | "EXCUSED";

/** The backend requires a non-empty management note alongside the action. */
export const reviewAttendanceViolation = async (
  violationId: string,
  payload: { action: ViolationAction; note: string },
) => {
  const res = await api.patch(`/attendance/violations/${violationId}`, payload);
  return {
    message: String(res.data?.message || "Violation reviewed"),
    violation: (res.data?.violation || null) as AttendanceViolation | null,
  };
};
