import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "../modules/auth/LoginScreen";
import { DataUseNoticeScreen, ServiceTermsNoticeScreen } from "../modules/legal/LegalNoticeScreen";
import { SharedInventoryViewScreen } from "../modules/inventory/SharedInventoryViewScreen";

const Stack = createNativeStackNavigator();

/*
 * The signed-out stack.
 *
 * It carries more than the login screen on purpose. Both app stores expect a
 * reviewer to reach the privacy policy and terms without an account, and a
 * shared inventory link is meant to open for someone who has none - so all
 * three have to live on this side of the session boundary as well as inside
 * the app.
 */
export const AuthStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Privacy" component={DataUseNoticeScreen} options={{ title: "Privacy Policy" }} />
    <Stack.Screen name="Terms" component={ServiceTermsNoticeScreen} options={{ title: "Terms & Conditions" }} />
    <Stack.Screen
      name="SharedInventory"
      component={SharedInventoryViewScreen}
      options={{ title: "Shared Listing" }}
    />
  </Stack.Navigator>
);
