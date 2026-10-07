import api from "./api";

/* Mirrors frontend/src/services/projectService.js. */

/*
 * The fields the Project model actually carries (backend/src/models/Project.js,
 * as web's Projects.jsx reads them). This used to declare name / developer /
 * unitCount, none of which exist, so every project listed as "Untitled".
 */
export type Project = {
  _id?: string;
  projectId?: string;
  projectName?: string;
  projectCategory?: string;
  projectType?: string;
  totalLandArea?: string;
  totalPlots?: number;
  plotsAvailable?: number;
  totalOffices?: number;
  status?: string;
  location?: string;
  currentRate?: number;
  startingRate?: number;
  images?: string[];
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
