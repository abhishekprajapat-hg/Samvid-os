import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AttendanceScreen } from "../modules/attendance/AttendanceScreen";
import { AttendanceHistoryScreen } from "../modules/attendance/AttendanceHistoryScreen";
import { AttendanceDetailsScreen } from "../modules/attendance/AttendanceDetailsScreen";
import { AttendanceApprovalsScreen } from "../modules/attendance/AttendanceApprovalsScreen";
import { AttendancePolicyScreen } from "../modules/attendance/AttendancePolicyScreen";
import { AttendanceViolationsScreen } from "../modules/attendance/AttendanceViolationsScreen";

/*
 * Attendance is a tab with its own stack.
 *
 * The comps keep the bottom bar visible on the history, details, approvals,
 * policy and violations pages, which a push onto the root stack would cover -
 * that stack sits above the tab navigator. Nesting the pushes inside the tab
 * is what keeps the bar, and it also means leaving the tab and coming back
 * returns you where you were rather than resetting to the hub.
 *
 * Every screen here draws its own header, so the navigator's is off; the
 * wordmark bar above comes from the tab navigator and stays put.
 */

const Stack = createNativeStackNavigator();

export const AttendanceStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AttendanceHome" component={AttendanceScreen} />
    <Stack.Screen name="AttendanceHistory" component={AttendanceHistoryScreen} />
    <Stack.Screen name="AttendanceDetails" component={AttendanceDetailsScreen} />
    <Stack.Screen name="AttendanceApprovals" component={AttendanceApprovalsScreen} />
    <Stack.Screen name="AttendancePolicy" component={AttendancePolicyScreen} />
    <Stack.Screen name="AttendanceViolations" component={AttendanceViolationsScreen} />
  </Stack.Navigator>
);

export default AttendanceStack;
