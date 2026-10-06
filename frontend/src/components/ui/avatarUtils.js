export const getNameInitials = (name = "") =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

export const getProfileImageUrl = (person) => {
  if (!person || typeof person !== "object") return "";
  return String(person.profileImageUrl || person.avatarUrl || person.photoUrl || "").trim();
};
