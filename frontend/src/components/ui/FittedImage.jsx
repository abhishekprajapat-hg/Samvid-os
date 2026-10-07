import React, { useState } from "react";
import { ImageOff } from "lucide-react";

/*
 * A property photo shown whole, whatever its shape (R14, 30 Sep 2026 update).
 *
 * Inventory photos used object-cover, which fills the frame by cropping: a
 * portrait photo in a landscape frame lost most of the room, and a small
 * upload was blown up. Here the photo is scaled to fit (object-contain), so
 * nothing is cut off or zoomed beyond its own size, and the empty space
 * around it is filled with a blurred, dimmed copy of the same photo so every
 * frame still looks full and consistent - landscape, portrait or square.
 *
 * The parent sets the frame size; this fills it.
 */
const FittedImage = ({ src, alt = "", className = "", imgClassName = "", backdrop = true, loading = "lazy", onError, fallback = null }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return fallback || (
      <span className={`flex h-full w-full items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-800 ${className}`}>
        <ImageOff size={18} aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className={`relative block h-full w-full overflow-hidden bg-slate-100 dark:bg-slate-900 ${className}`}>
      {backdrop ? (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          loading={loading}
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-xl"
        />
      ) : null}
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        onError={(event) => { setFailed(true); onError?.(event); }}
        className={`relative h-full w-full object-contain ${imgClassName}`}
      />
    </span>
  );
};

export default FittedImage;
