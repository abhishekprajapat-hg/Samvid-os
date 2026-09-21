import api from "./api";

/* Mirrors frontend/src/services/projectService.js. */

export type Project = {
  _id?: string;
  name?: string;
  location?: string;
  developer?: string;
  status?: string;
  description?: string;
  images?: string[];
  unitCount?: number;
  createdAt?: string;
  [key: string]: unknown;
};

export const getProjectsWithMeta = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/projects", { params });
  return {
    projects: (Array.isArray(res.data?.projects) ? res.data.projects : []) as Project[],
    pagination: res.data?.pagination || null,
  };
};

export const getProjectById = async (projectId: string): Promise<Project | null> => {
  const id = String(projectId || "").trim();
  if (!id) return null;
  const res = await api.get(`/projects/${id}`);
  return res.data?.project || null;
};

export const createProject = async (payload: Record<string, unknown>) => {
  const res = await api.post("/projects", payload);
  return (res.data?.project || null) as Project | null;
};

export const updateProject = async (projectId: string, payload: Record<string, unknown>) => {
  const res = await api.patch(`/projects/${projectId}`, payload);
  return (res.data?.project || null) as Project | null;
};

export const deleteProject = async (projectId: string) => {
  await api.delete(`/projects/${projectId}`);
};
