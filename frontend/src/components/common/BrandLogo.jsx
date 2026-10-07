import React from "react";

const BrandLogo = ({ className = "", alt = "Samvid OS logo" }) => (
  <img
    src="/samvid-mark-512.png"
    alt={alt}
    className={`brand-logo bg-white object-contain ${className}`.trim()}
  />
);

export default BrandLogo;
