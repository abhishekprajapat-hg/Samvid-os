import api from "./api";

export const getProjectsWithMeta = async (params = {}) => {
  const res = await api.get("/projects", { params });
  return {
    projects: Array.isArray(res.data?.projects) ? res.data.projects : [],
    pagination: res.data?.pagination || null,
  };
};

export const getProjectById = async (projectId) => {
  const res = await api.get(`/projects/${projectId}`);
  return res.data?.project || null;
};

export const createProject = async (payload) => {
  const res = await api.post("/projects", payload);
  return res.data?.project;
};

export const updateProject = async (projectId, payload) => {
  const res = await api.patch(`/projects/${projectId}`, payload);
  return res.data?.project;
};

export const deleteProject = async (projectId) => {
  await api.delete(`/projects/${projectId}`);
};
