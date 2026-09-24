import { normalizeStatusKey } from "./statusStyles";

/**
 * The five stages of forward motion a lead actually travels through.
 * Kept out of StatusStepper.jsx so that file only exports its component,
 * which is what Fast Refresh needs.
 */
export const LEAD_STEPS = [
  { key: "NEW", label: "New" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "INTERESTED", label: "Interested" },
  { key: "SITE_VISIT", label: "Visit" },
  { key: "CLOSED", label: "Closed" },
];

/**
 * Maps any of the 14 lead statuses onto one of the five forward stages, or onto
 * a sideState for the statuses that are not forward motion at all.
 *
 * @param   {string} status Raw status from the API.
 * @returns {{ stepKey: string|null, sideState: string|null }}
 */
export const statusToStep = (status) => {
  const key = normalizeStatusKey(status);

  switch (key) {
    case "NEW":
      return { stepKey: "NEW", sideState: null };
    case "CONTACTED":
      return { stepKey: "CONTACTED", sideState: null };
    case "INTERESTED":
    case "REQUESTED":
      return { stepKey: "INTERESTED", sideState: null };
    case "SITE_VISIT_SCHEDULED":
    case "SITE_VISIT":
    case "SITE_VISIT_OVERDUE":
    case "MISSING_IN_ACTION":
    case "NOT_PICKING_CALLS":
      // Still at the visit stage - these say how it is going, not where it is.
      return { stepKey: "SITE_VISIT", sideState: null };
    case "CLOSED":
      return { stepKey: "CLOSED", sideState: null };
    case "LOST":
    case "INVALID":
    case "OWNER":
    case "BROKER":
      return { stepKey: null, sideState: key };
    default:
      return { stepKey: null, sideState: null };
  }
};
