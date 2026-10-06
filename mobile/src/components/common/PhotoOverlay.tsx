import React, { useState } from "react";
import { Image, StyleSheet } from "react-native";
import { toAbsoluteUrl } from "../../services/uploadService";

/*
 * Drop inside any initials circle: when the person has a profile photo it
 * covers the initials; with no photo (or a broken link) the initials show.
 */
export const profilePhotoOf = (person: unknown): string => {
  if (!person || typeof person !== "object") return "";
  const row = person as { profileImageUrl?: unknown; avatarUrl?: unknown };
  return String(row.profileImageUrl || row.avatarUrl || "").trim();
};

export const PhotoOverlay = ({ uri, radius = 999 }: { uri?: string | null; radius?: number }) => {
  const source = uri ? toAbsoluteUrl(String(uri)) : "";
  const [failed, setFailed] = useState("");
  if (!source || failed === source) return null;
  return (
    <Image
      source={{ uri: source }}
      onError={() => setFailed(source)}
      style={[StyleSheet.absoluteFillObject, { width: "100%", height: "100%", borderRadius: radius }]}
      accessibilityIgnoresInvertColors
    />
  );
};

export default PhotoOverlay;
