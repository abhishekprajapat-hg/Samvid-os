import api from "./api";

export const getTasks = async (params = {}) => {
  const res = await api.get("/tasks", { params });
  return res.data || [];
};

export const getTaskById = async (taskId) => {
  const res = await api.get(`/tasks/${taskId}`);
  return res.data || null;
};

export const createTask = async (payload) => {
  const res = await api.post("/tasks", payload);
  return res.data || null;
};

export const updateTask = async (taskId, payload) => {
  const res = await api.patch(`/tasks/${taskId}`, payload);
  return res.data || null;
};

export const deleteTask = async (taskId) => {
  const res = await api.delete(`/tasks/${taskId}`);
  return res.data || null;
};

export const getTaskStats = async (params = {}) => {
  const res = await api.get("/tasks/stats", { params });
  return res.data || null;
};

export const getTaskStatsByUser = async () => {
  const res = await api.get("/tasks/stats/by-user");
  return res.data || {};
};

export const getTaskAssignees = async () => (await api.get("/tasks/assignees")).data;
