import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  darkColors,
  darkElevation,
  lightColors,
  lightElevation,
  type ColorScheme,
} from "./tokens";

/*
 * Light / dark / system, matching the web app's theme switch.
 *
 * Web toggles an `html.theme-dark` class and every rule re-resolves. RN has no
 * cascade: StyleSheet.create runs once at import, so a screen that reads the
 * static `colors` export is fixed to light for the life of the process.
 *
 * That is why this is a context rather than a mutation of the token module.
 * Components that call useTheme() re-render with the active scheme; the screens
 * written before Phase 1 keep reading the static export and stay light until
 * they are migrated. Both work at once, which is what lets the switch land
 * without rewriting 29k lines in one go.
 */

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "theme.mode";

type ThemeValue = {
  mode: ThemeMode;
  /** The scheme actually in force once "system" has been resolved. */
  scheme: "light" | "dark";
  colors: ColorScheme;
  elevation: typeof lightElevation;
  setMode: (mode: ThemeMode) => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeValue | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (alive && (stored === "light" || stored === "dark" || stored === "system")) {
          setModeState(stored);
        }
      } catch {
        // A readable preference is a nicety; failing to read one is not an
        // error worth blocking the app on.
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const scheme: "light" | "dark" = mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;

  const value = useMemo<ThemeValue>(
    () => ({
      mode,
      scheme,
      colors: scheme === "dark" ? darkColors : lightColors,
      elevation: scheme === "dark" ? darkElevation : lightElevation,
      setMode,
      ready,
    }),
    [mode, scheme, setMode, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
};

/*
 * For components that may render outside the provider (an error boundary above
 * it, a detached modal root). Falls back to light rather than throwing.
 */
export const useThemeSafe = (): ThemeValue => {
  const context = useContext(ThemeContext);
  return (
    context || {
      mode: "light",
      scheme: "light",
      colors: lightColors,
      elevation: lightElevation,
      setMode: () => {},
      ready: true,
    }
  );
};
