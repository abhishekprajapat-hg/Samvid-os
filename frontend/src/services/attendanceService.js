import api from "./api";

export const correctUserBreak = async (userId, date, payload) => {
  const res = await api.patch(`/attendance/users/${userId}/${date}/breaks`, payload);
  return res.data;
};

// Starts or ends a break for someone else, as of now, from the team list.
export const manageUserBreak = async (userId, payload) => {
  const res = await api.post(`/attendance/users/${userId}/break`, payload);
  return res.data;
};

export const checkInAttendance = async (payload = {}) => {
  const res = await api.post("/attendance/check-in", payload);
  return {
    message: res.data?.message || "Checked in successfully",
    attendance: res.data?.attendance || null,
    timezone: res.data?.timezone || "",
  };
};

export const checkOutAttendance = async (payload = {}) => {
  const res = await api.post("/attendance/check-out", payload);
  return {
    message: res.data?.message || "Checked out successfully",
    attendance: res.data?.attendance || null,
    timezone: res.data?.timezone || "",
  };
};

export const startBreakAttendance = async (payload = {}) => {
  const res = await api.post("/attendance/break/start", payload);
  return {
    message: res.data?.message || "Break started",
    attendance: res.data?.attendance || null,
    timezone: res.data?.timezone || "",
  };
};

export const endBreakAttendance = async (payload = {}) => {
  const res = await api.post("/attendance/break/end", payload);
  return {
    message: res.data?.message || "Break ended",
    attendance: res.data?.attendance || null,
    timezone: res.data?.timezone || "",
  };
};

export const getMyAttendance = async (params = {}) => {
  const res = await api.get("/attendance/me", { params });
  return {
    timezone: res.data?.timezone || "",
    from: res.data?.from || "",
    to: res.data?.to || "",
    today: res.data?.today || null,
    policy: res.data?.policy || null,
    summary: res.data?.summary || {},
    attendance: Array.isArray(res.data?.attendance) ? res.data.attendance : [],
    pagination: res.data?.pagination || null,
    count: Number(res.data?.count || 0),
  };
};

export const getDailyAttendanceForAdmin = async (params = {}) => {
  const res = await api.get("/attendance/daily", { params });
  return {
    timezone: res.data?.timezone || "",
    date: res.data?.date || "",
    summary: res.data?.summary || {},
    attendance: Array.isArray(res.data?.attendance) ? res.data.attendance : [],
  };
};

export const getUserAttendanceForAdmin = async (userId, params = {}) => {
  const id = String(userId || "").trim();
  if (!id) {
    return {
      timezone: "",
      from: "",
      to: "",
      user: null,
      summary: {},
      attendance: [],
      count: 0,
    };
  }

  const res = await api.get(`/attendance/users/${id}`, { params });
  return {
    timezone: res.data?.timezone || "",
    from: res.data?.from || "",
    to: res.data?.to || "",
    user: res.data?.user || null,
    summary: res.data?.summary || {},
    attendance: Array.isArray(res.data?.attendance) ? res.data.attendance : [],
    count: Number(res.data?.count || 0),
  };
};

export const updateUserAttendanceStatus = async (userId, date, payload = {}) => {
  const id = String(userId || "").trim();
  const attendanceDate = String(date || "").trim();
  if (!id || !attendanceDate) {
    throw new Error("User and attendance date are required");
  }

  const res = await api.patch(`/attendance/users/${id}/${attendanceDate}/status`, payload);
  return {
    message: res.data?.message || "Attendance status updated",
    user: res.data?.user || null,
    attendance: res.data?.attendance || null,
  };
};

export const getAttendancePolicy = async () => {
  const res = await api.get("/attendance/policy");
  return res.data?.policy || null;
};

export const updateAttendancePolicy = async (payload = {}) => {
  const res = await api.patch("/attendance/policy", payload);
  return {
    message: res.data?.message || "Attendance policy updated",
    policy: res.data?.policy || null,
  };
};

export const getMyLeaveBalance = async (params = {}) => {
  const res = await api.get("/attendance/leave-balance/my", { params });
  return {
    month: res.data?.month || "",
    timezone: res.data?.timezone || "",
    monthlyAccrual: Number(res.data?.monthlyAccrual || 0),
    accrualStartMonth: res.data?.accrualStartMonth || "",
    monthsAccrued: Number(res.data?.monthsAccrued || 0),
    accrued: Number(res.data?.accrued || 0),
    used: Number(res.data?.used || 0),
    pending: Number(res.data?.pending || 0),
    available: Number(res.data?.available || 0),
    carryForward: Number(res.data?.carryForward || 0),
  };
};

export const getLeaveBalanceForAdmin = async (userId, params = {}) => {
  const id = String(userId || "").trim();
  if (!id) return null;

  const res = await api.get(`/attendance/leave-balance/${id}`, { params });
  return {
    month: res.data?.month || "",
    timezone: res.data?.timezone || "",
    monthlyAccrual: Number(res.data?.monthlyAccrual || 0),
    accrualStartMonth: res.data?.accrualStartMonth || "",
    monthsAccrued: Number(res.data?.monthsAccrued || 0),
    accrued: Number(res.data?.accrued || 0),
    used: Number(res.data?.used || 0),
    pending: Number(res.data?.pending || 0),
    available: Number(res.data?.available || 0),
    carryForward: Number(res.data?.carryForward || 0),
  };
};

export const createLeaveRequest = async (payload = {}) => {
  const res = await api.post("/attendance/leave-requests", payload);
  return {
    message: res.data?.message || "Leave request created",
    leaveRequest: res.data?.leaveRequest || null,
  };
};

export const getMyLeaveRequests = async () => {
  const res = await api.get("/attendance/leave-requests/my");
  return Array.isArray(res.data?.leaveRequests) ? res.data.leaveRequests : [];
};

export const getAdminLeaveRequests = async (params = {}) => {
  const res = await api.get("/attendance/leave-requests/admin", { params });
  return Array.isArray(res.data?.leaveRequests) ? res.data.leaveRequests : [];
};

export const reviewLeaveRequest = async (requestId, payload = {}) => {
  const res = await api.patch(`/attendance/leave-requests/${requestId}/review`, payload);
  return {
    message: res.data?.message || "Leave request reviewed",
    leaveRequest: res.data?.leaveRequest || null,
  };
};
