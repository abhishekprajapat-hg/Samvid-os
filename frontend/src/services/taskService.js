import api from "./api";

export const getTasks = async (params = {}) => {
  const res = await api.get("/tasks", { params });
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.data?.tasks)) return res.data.tasks;
  return [];
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

export const getTaskStats = async () => {
  const res = await api.get("/tasks/stats");
  return res.data || null;
};
