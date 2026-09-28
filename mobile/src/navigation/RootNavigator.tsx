import React, { useEffect } from "react";
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from "@react-navigation/native";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { PermissionProvider } from "../context/PermissionContext";
import { RealtimeAlertsProvider } from "../context/RealtimeAlertsContext";
import { AuthStack } from "./AuthStack";
import { RoleTabs } from "./RoleTabs";
import { navigateFromAnywhere, navigationRef } from "./navigationRef";
import { linking } from "./linking";
import * as ExpoLinking from "expo-linking";
import { ensureNotificationSetup, registerNotificationTapListener } from "../services/pushNotifications";
import { useLiveLocationSync } from "../services/liveLocation";
import { RealtimePopupOverlay } from "../components/common/RealtimePopupOverlay";
import { FollowUpReminderCard } from "../components/common/FollowUpReminderCard";
import { palette } from "../theme/tokens";
import { themePalette } from "../theme/themedStyles";
import { useTheme } from "../theme/ThemeContext";

const AppShell = () => {
  const { loading, isLoggedIn, role } = useAuth();

  // Field Ops' map is drawn from this; web streams it for the same role.
  useLiveLocationSync(isLoggedIn && role === "FIELD_EXECUTIVE");

  useEffect(() => {
    if (!isLoggedIn) return;

    void ensureNotificationSetup();
    const subscription = registerNotificationTapListener((payload: any) => {
      /*
       * Chat notifications carry the conversation and open it directly. Anything
       * else carries the web `url` the server put in the payload, which the
       * linking config already knows how to resolve - so a task, a lead or an
       * approval lands on its own screen instead of the home tab.
       */
      if (payload?.conversationId) {
        navigateFromAnywhere("ChatConversation", {
          conversationId: payload.conversationId,
          contactId: payload.contactId,
          contactName: payload.contactName || "Chat",
          contactRole: payload.contactRole || "",
          contactAvatar: payload.contactAvatar || "",
        });
        return;
      }

      const url = String(payload?.url || "").trim();
      if (url && url !== "/") {
        void ExpoLinking.openURL(`theofficeonrent://${url.replace(/^\//, "")}`);
      }
    });

    return () => subscription.remove();
  }, [isLoggedIn]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={themePalette.blue[600]} />
      </View>
    );
  }

  if (!isLoggedIn || !role) {
    return <AuthStack />;
  }

  return <RoleTabs role={role} />;
};

/*
 * React Navigation paints surfaces this app's tokens never reach: the scene
 * background behind a screen, and the card colour during a push transition.
 * Left on DefaultTheme those stay light, so a dark screen sits on a white
 * page and every transition flashes white. This maps the navigator's own
 * palette onto the active scheme.
 */
const useNavigationTheme = (): Theme => {
  const { scheme } = useTheme();
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: scheme === "dark",
    colors: {
      ...base.colors,
      primary: themePalette.primary,
      background: themePalette.bg,
      card: themePalette.surface,
      text: themePalette.text,
      border: themePalette.border,
      notification: themePalette.rose[500],
    },
  };
};

const NavigationRoot = () => {
  const navigationTheme = useNavigationTheme();

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      theme={navigationTheme}
    >
      <AppShell />
      <RealtimePopupOverlay />
      <FollowUpReminderCard />
    </NavigationContainer>
  );
};

export const RootNavigator = () => (
  <AuthProvider>
    {/*
     * PermissionProvider sits inside AuthProvider because it reads the session
     * to decide whether to fetch, and outside the navigator because the tab bar
     * itself is built from the permissions it resolves.
     */}
    <PermissionProvider>
      <RealtimeAlertsProvider>
        <NavigationRoot />
      </RealtimeAlertsProvider>
    </PermissionProvider>
  </AuthProvider>
);
