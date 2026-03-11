import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<any>();

export const navigateFromAnywhere = (name: string, params?: Record<string, unknown>) => {
  if (!navigationRef.isReady()) return;
  (navigationRef as any).navigate(name, params);
};
