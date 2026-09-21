import "react-native-gesture-handler";
import React, { useCallback } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import { appFonts } from "./src/theme/fonts";
import { applyGlobalFont } from "./src/theme/applyGlobalFont";
import { ErrorBoundary } from "./src/components/common/ErrorBoundary";

// Patches Text/TextInput to default to Inter. Runs once, at module scope, so it
// is in place before the first render rather than after a flash of system face.
applyGlobalFont();

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or the module is unavailable in this runtime (web). Not
  // worth failing the launch over.
});

const Shell = () => {
  const { scheme, colors, ready: themeReady } = useTheme();
  const [fontsLoaded, fontError] = useFonts(appFonts);

  // A missing font should degrade to the system face, not hold the splash
  // forever - so a load error counts as "done" here.
  const ready = themeReady && (fontsLoaded || Boolean(fontError));

  const onLayout = useCallback(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} onLayout={onLayout}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <RootNavigator />
    </View>
  );
};

export default function App() {
  return (
    /*
     * Outermost, and outside ThemeProvider on purpose: a crash inside the
     * provider itself still has to render something, and the fallback reads
     * static tokens rather than the context for exactly that reason.
     */
    <ErrorBoundary label="app">
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
