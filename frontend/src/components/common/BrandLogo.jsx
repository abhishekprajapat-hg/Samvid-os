import React from "react";

const BrandLogo = ({ className = "", alt = "Samvid logo" }) => (
  <img
    src="/favicon.png"
    alt={alt}
    className={`object-contain ${className}`.trim()}
  />
);

export default BrandLogo;
