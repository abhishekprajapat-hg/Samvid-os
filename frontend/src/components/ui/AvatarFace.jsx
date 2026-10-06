import { useState } from "react";
import { getNameInitials, getProfileImageUrl } from "./avatarUtils";

/*
 * What goes inside any round avatar in the app: the person's profile photo
 * when they have one, otherwise their initials (or a fallback icon).
 * The caller keeps its own circle (size, colours); the photo just fills it.
 * A broken or deleted photo quietly falls back to the initials.
 */
const AvatarFace = ({ user, src, name, fallback = null, initials, alt = "" }) => {
  const imageUrl = String(src ?? getProfileImageUrl(user)).trim();
  const [failedUrl, setFailedUrl] = useState("");

  if (imageUrl && failedUrl !== imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        draggable={false}
        onError={() => setFailedUrl(imageUrl)}
        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit", display: "block" }}
      />
    );
  }

  const text = initials ?? getNameInitials(name ?? user?.name);
  return text || fallback || null;
};

export default AvatarFace;
