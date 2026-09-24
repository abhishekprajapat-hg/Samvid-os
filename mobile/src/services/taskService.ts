import api from "./api";

export type Task = {
  _id: string;
  title: string;
  description?: string;
  status: "TODO" | "COMPLETED" | string;
  priority: "LOW" | "MEDIUM" | "HIGH" | string;
  dueDate?: string | null;
  assignedTo?: {
    _id: string;
    name: string;
    role?: string;
  } | null;
  leadId?: string | {
    _id: string;
    name: string;
    phone?: string;
    email?: string;
    status?: string;
  } | null;
  subtasks?: Array<{
    _id?: string;
    title: string;
    isCompleted: boolean;
  }>;
  tags?: string[];
  createdBy?: string | {
    _id: string;
    name: string;
    role?: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

export const getTasks = async (params: Record<string, any> = {}): Promise<Task[]> => {
  const res = await api.get("/tasks", { params });
  return res.data || [];
};

export const getTaskById = async (taskId: string): Promise<Task | null> => {
  const res = await api.get(`/tasks/${taskId}`);
  return res.data || null;
};

export const createTask = async (payload: Partial<Task>): Promise<Task | null> => {
  const res = await api.post("/tasks", payload);
  return res.data || null;
};

export const updateTask = async (taskId: string, payload: Partial<Task>): Promise<Task | null> => {
  const res = await api.patch(`/tasks/${taskId}`, payload);
  return res.data || null;
};

export const deleteTask = async (taskId: string): Promise<any> => {
  const res = await api.delete(`/tasks/${taskId}`);
  return res.data || null;
};

export const getTaskStats = async (): Promise<any> => {
  const res = await api.get("/tasks/stats");
  return res.data || null;
};

export const getTaskStatsByUser = async (): Promise<Record<string, any>> => {
  const res = await api.get("/tasks/stats/by-user");
  return res.data || {};
};
