export const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};