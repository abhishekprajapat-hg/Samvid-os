import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
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
import { RealtimePopupOverlay } from "../components/common/RealtimePopupOverlay";
import { palette } from "../theme/tokens";

const AppShell = () => {
  const { loading, isLoggedIn, role } = useAuth();

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
        <ActivityIndicator size="large" color={palette.blue[600]} />
      </View>
    );
  }

  if (!isLoggedIn || !role) {
    return <AuthStack />;
  }

  return <RoleTabs role={role} />;
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
        <NavigationContainer ref={navigationRef} linking={linking}>
          <AppShell />
          <RealtimePopupOverlay />
        </NavigationContainer>
      </RealtimeAlertsProvider>
    </PermissionProvider>
  </AuthProvider>
);
