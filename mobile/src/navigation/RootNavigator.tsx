import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { RealtimeAlertsProvider } from "../context/RealtimeAlertsContext";
import { AuthStack } from "./AuthStack";
import { RoleTabs } from "./RoleTabs";
import { navigateFromAnywhere, navigationRef } from "./navigationRef";
import { ensureNotificationSetup, registerNotificationTapListener } from "../services/pushNotifications";
import { RealtimePopupOverlay } from "../components/common/RealtimePopupOverlay";

const AppShell = () => {
  const { loading, isLoggedIn, role } = useAuth();

  useEffect(() => {
    if (!isLoggedIn) return;

    void ensureNotificationSetup();
    const subscription = registerNotificationTapListener((payload) => {
      navigateFromAnywhere("ChatConversation", {
        conversationId: payload.conversationId,
        contactId: payload.contactId,
        contactName: payload.contactName || "Chat",
        contactRole: payload.contactRole || "",
        contactAvatar: payload.contactAvatar || "",
      });
    });

    return () => subscription.remove();
  }, [isLoggedIn]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#0f172a" />
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
    <RealtimeAlertsProvider>
      <NavigationContainer ref={navigationRef}>
        <AppShell />
        <RealtimePopupOverlay />
      </NavigationContainer>
    </RealtimeAlertsProvider>
  </AuthProvider>
);
