import { StyleSheet, Text, TextInput } from "react-native";
import { familyForWeight, fontFamily } from "./fonts";

/*
 * Makes Inter the default face for every <Text> and <TextInput> in the app.
 *
 * Why a patch rather than edits: the screens written before Phase 1 set
 * fontWeight ("600", "700") and no fontFamily, which on web-parity terms means
 * Inter at that weight. RN does not synthesise weights for a custom family -
 * on Android a named family plus fontWeight renders at regular and the whole
 * app goes flat - so the weight has to be turned into a *face* name. Doing that
 * by hand would mean touching every style block in 29k lines; doing it here
 * covers all of them and is reversible in one file.
 *
 * An explicit fontFamily in a style always wins, so the UI kit and any migrated
 * screen keep full control.
 *
 * This reaches into RN's Text internals, which are not API. Every step is
 * guarded: if the internals differ on a future RN version the patch quietly
 * does nothing and the app renders in the system face, which is exactly the
 * behaviour it has today. It should be deleted once every screen sets its own
 * fontFamily.
 */

let applied = false;

const withFamily = (style: unknown) => {
  const flattened = StyleSheet.flatten(style as never) as
    | { fontFamily?: string; fontWeight?: string | number }
    | undefined;

  // Caller asked for a specific face - leave it alone.
  if (flattened?.fontFamily) return style;

  return [{ fontFamily: familyForWeight(flattened?.fontWeight) }, style];
};

const patch = (Component: unknown, label: string) => {
  const target = Component as { render?: (...args: unknown[]) => unknown };
  if (typeof target?.render !== "function") {
    if (__DEV__) console.warn(`applyGlobalFont: could not patch ${label}; using the system face.`);
    return;
  }

  const original = target.render;
  target.render = function patched(...args: unknown[]) {
    const props = args[0] as { style?: unknown } | undefined;
    // Apply RN styles before rendering so react-native-web can convert them
    // into DOM styles. Cloning the rendered element bypasses that conversion
    // and sends an array to CSSStyleDeclaration, crashing the browser.
    args[0] = { ...props, style: withFamily(props?.style) };
    return original.apply(this, args);
  };
};

export const applyGlobalFont = () => {
  if (applied) return;
  applied = true;

  try {
    patch(Text, "Text");
    patch(TextInput, "TextInput");
  } catch (error) {
    if (__DEV__) console.warn("applyGlobalFont: patch failed, falling back to the system face.", error);
  }
};

export { fontFamily };
