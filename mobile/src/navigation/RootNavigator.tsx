import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { AuthStack } from "./AuthStack";
import { RoleTabs } from "./RoleTabs";

const AppShell = () => {
  const { loading, isLoggedIn, role } = useAuth();

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
    <NavigationContainer>
      <AppShell />
    </NavigationContainer>
  </AuthProvider>
);