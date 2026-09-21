import React, { useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Screen } from "../../components/common/Screen";
import { AppTabs, type TabItem } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionContext";
import { spacing } from "../../theme/tokens";
import { MyDaySection } from "./components/MyDaySection";
import { LeaveSection } from "./components/LeaveSection";
import { TeamSection } from "./components/TeamSection";
import { ViolationsSection } from "./components/ViolationsSection";

/*
 * Attendance hub, mirroring modules/attendance/AttendanceHub.jsx.
 *
 * Web arranges the same material as a wide table with controls around it. On a
 * phone the sections become tabs, and "My day" leads because marking your own
 * day is the thing people open this screen to do - on a desktop it is the thing
 * they do least.
 *
 * The management tabs are gated the way the API gates them: the roster, leave
 * approval and violation endpoints all run through ensureManageAttendanceRole,
 * so offering those tabs to anyone else would produce a screen that 403s.
 */

const MANAGE_ROLES = new Set(["ADMIN", "MANAGER"]);

export const AttendanceScreen = () => {
  const { role } = useAuth();
  const { canPageAction } = usePermissions();

  // Role decides, and an explicit page grant can still narrow it.
  const canManage = Boolean(role && MANAGE_ROLES.has(role) && canPageAction("attendance", "approve"));

  const tabs = useMemo<TabItem[]>(() => {
    const base: TabItem[] = [
      { key: "day", label: "My day" },
      { key: "leave", label: "Leave" },
    ];
    if (canManage) {
      base.push({ key: "team", label: "Team" }, { key: "violations", label: "Violations" });
    }
    return base;
  }, [canManage]);

  const [active, setActive] = useState("day");

  // A manager whose grant is revoked mid-session should not be left on a tab
  // that no longer exists.
  const activeKey = tabs.some((tab) => tab.key === active) ? active : "day";

  const dayLabel = useMemo(
    () => new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }),
    [],
  );

  return (
    <Screen title="Attendance" subtitle={dayLabel}>
      <AppTabs tabs={tabs} activeKey={activeKey} onChange={setActive} style={styles.tabs} />

      <View style={styles.section}>
        {activeKey === "day" ? <MyDaySection /> : null}
        {activeKey === "leave" ? <LeaveSection /> : null}
        {activeKey === "team" && canManage ? <TeamSection /> : null}
        {activeKey === "violations" && canManage ? <ViolationsSection /> : null}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  tabs: {
    marginBottom: spacing.lg,
  },
  section: {
    flex: 1,
  },
});
