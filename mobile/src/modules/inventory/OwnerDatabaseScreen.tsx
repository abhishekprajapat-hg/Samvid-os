import React from "react";
import { ContactDatabaseScreen } from "./components/ContactDatabaseScreen";

// Mirrors modules/inventory/OwnerDatabase.jsx - blurb copied verbatim.
export const OwnerDatabaseScreen = () => (
  <ContactDatabaseScreen
    kind="OWNER"
    title="Owner Database"
    blurb="Every property owner on file, kept separately from whether their property is currently available. A property can go from available to rented and back; the owner record stays put. Phone number is the key, so re-saving a number updates that owner instead of creating a duplicate."
  />
);
