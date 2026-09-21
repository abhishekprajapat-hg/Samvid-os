import React from "react";
import { View, StyleSheet } from "react-native";
import { Lock } from "lucide-react-native";
import { AppEmptyState, AppSkeletonList } from "../ui";
import { Icon } from "../ui/Icon";
import { usePermissions } from "../../context/PermissionContext";
import { useAuth } from "../../context/AuthContext";
import { canAccessPage } from "../../navigation/access";
import { palette, spacing } from "../../theme/tokens";
import type { UserRole } from "../../types";
import { themedStyles, themePalette } from "../../theme/themedStyles";

/*
 * Mirrors frontend/src/components/auth/PageAccessGate.jsx.
 *
 * Hiding a destination in the nav is not enough on mobile: a deep link or a
 * push notification can land someone on a screen their nav never offered. So
 * the screen gates itself too, exactly as the web route does.
 */

export const PageAccessGate = ({
  page,
  allowedRoles,
  children,
}: {
  page?: string;
  allowedRoles?: UserRole[];
  children: React.ReactNode;
}) => {
  const { canPage, enforcePageAccess, isAdmin, loading } = usePermissions();
  const { role, user } = useAuth();

  if (loading) {
    return (
      <View style={styles.wrap}>
        <AppSkeletonList rows={3} />
      </View>
    );
  }

  const hasEmployeePages = enforcePageAccess && !isAdmin;

  if (hasEmployeePages) {
    if (page && !canPage(page)) return <AccessDenied />;
    return <>{children}</>;
  }

  // Role defaults: the built-in matrix decides.
  if (allowedRoles && !isAdmin && role && !allowedRoles.includes(role)) {
    return <AccessDenied />;
  }

  // Catches the partner-inventory and coworking-permission branches too.
  if (page && !canAccessPage(page, role, user ?? {})) return <AccessDenied />;

  return <>{children}</>;
};

/*
 * Mirrors CoworkingPermissionGate.jsx - the fine-grained half of the model,
 * for the 50 coworking permissions.
 */
export const CoworkingPermissionGate = ({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) => {
  const { can, loading } = usePermissions();

  if (loading) {
    return (
      <View style={styles.wrap}>
        <AppSkeletonList rows={3} />
      </View>
    );
  }

  if (!can(permission)) return <AccessDenied />;

  return <>{children}</>;
};

const AccessDenied = () => (
  <View style={styles.wrap}>
    <AppEmptyState
      icon={<Lock size={20} color={themePalette.slate[500]} />}
      title="You do not have access to this page"
      description="Your account does not include this page. Ask an admin to update your page access."
    />
  </View>
);

const styles = themedStyles((c) => StyleSheet.create({
  wrap: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.lg,
  },
}));

export default PageAccessGate;
