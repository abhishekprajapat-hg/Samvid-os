import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";

/*
 * The same two families the web app loads in index.html:
 *   Inter 400/500/600/700, JetBrains Mono 400/500.
 *
 * Only those weights. Each one is a separate TTF in the bundle, and shipping
 * the full family would add several megabytes for cuts nothing renders.
 */
export const appFonts = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
};

/*
 * RN has no font-family fallback list and no synthetic weight: `fontWeight` on
 * a custom family is ignored on Android, which silently renders everything at
 * regular. So weight is selected by naming the exact face instead.
 */
export const fontFamily = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  mono: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
} as const;

/** Maps the fontWeight values already used across the screens onto a face. */
export const familyForWeight = (weight?: string | number): string => {
  const value = String(weight ?? "400");
  if (value === "700" || value === "800" || value === "900" || value === "bold") {
    return fontFamily.bold;
  }
  if (value === "600") return fontFamily.semibold;
  if (value === "500") return fontFamily.medium;
  return fontFamily.regular;
};
