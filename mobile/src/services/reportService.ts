import api from "./api";

/*
 * Saved reports and templates.
 *
 * Only the question is stored - the range, the sections, the filters - never
 * the numbers, so opening a report from last week answers it from today's
 * data. See backend/src/models/Report.js.
 */

export type ReportSection = "SALES" | "FINANCE" | "INVENTORY" | "TEAM" | "ATTENDANCE" | "COWORKING";

export type SavedReport = {
  _id: string;
  name: string;
  type: string;
  from?: string | null;
  to?: string | null;
  sections: ReportSection[];
  metrics: string[];
  filters: { team?: string; property?: string; leadSource?: string; status?: string };
  visualization: string;
  compareWithPrevious: boolean;
  format: string;
  isTemplate: boolean;
  summary?: string;
  generatedBy?: { _id?: string; name?: string } | null;
  generatedAt: string;
};

export type ReportPayload = Omit<SavedReport, "_id" | "generatedBy" | "generatedAt"> & {
  summary?: string;
};

export const getSavedReports = async (
  params: { templates?: boolean; limit?: number } = {},
): Promise<SavedReport[]> => {
  const res = await api.get("/reports", {
    params: {
      ...(params.templates ? { templates: "true" } : {}),
      ...(params.limit ? { limit: params.limit } : {}),
    },
  });
  return (Array.isArray(res.data?.reports) ? res.data.reports : []) as SavedReport[];
};

export const saveReport = async (payload: Partial<ReportPayload>): Promise<SavedReport | null> => {
  const res = await api.post("/reports", payload);
  return (res.data?.report || null) as SavedReport | null;
};

export const deleteReport = async (reportId: string): Promise<void> => {
  await api.delete(`/reports/${reportId}`);
};
