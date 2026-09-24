import { useSyncExternalStore } from "react";

/*
 * The one place the phone breakpoint is decided.
 *
 * 767px matches the CSS the workspace layout already switches on, so a
 * component that hides something here and a stylesheet that moves it stay in
 * agreement.
 *
 * matchMedia is an external store, so it is read as one: useSyncExternalStore
 * takes the value at render time rather than copying it into state and pushing
 * it back on every change, which is what keeps a rotation or a resized window
 * from costing an extra render pass - and what keeps the first render from
 * briefly claiming desktop on a phone.
 */
const MOBILE_QUERY = "(max-width: 767px)";

const canMatch = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

const subscribe = (onStoreChange) => {
  if (!canMatch()) return () => {};

  const mediaQuery = window.matchMedia(MOBILE_QUERY);
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", onStoreChange);
    return () => mediaQuery.removeEventListener("change", onStoreChange);
  }

  // Safari before 14 only has the deprecated listener API.
  mediaQuery.addListener(onStoreChange);
  return () => mediaQuery.removeListener(onStoreChange);
};

const getSnapshot = () => (canMatch() ? window.matchMedia(MOBILE_QUERY).matches : false);

/*
 * No viewport to measure without a window. Answering "not mobile" is the safer
 * default: the phone-only branches are the ones that take things away.
 */
const getServerSnapshot = () => false;

export const useIsMobileViewport = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
