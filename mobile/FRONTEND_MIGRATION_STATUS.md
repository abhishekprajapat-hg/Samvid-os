# Samvid OS Frontend Migration Status (Web -> React Native)

This file tracks parity progress using `frontend/src` as the reference.

## Completed

- `components/auth/Login.jsx` -> `src/modules/auth/LoginScreen.tsx`
- `modules/manager/ManagerDashboard.jsx` -> `src/modules/manager/ManagerDashboardScreen.tsx`
- `modules/executive/ExecutiveDashboard.jsx` -> `src/modules/executive/ExecutiveDashboardScreen.tsx`
- `modules/field/FieldDashboard.jsx` -> `src/modules/field/FieldDashboardScreen.tsx`
- `modules/leads/LeadsMatrix.jsx` -> `src/modules/leads/LeadsMatrixScreen.tsx`
- `modules/leads/LeadDetails.jsx` -> `src/modules/leads/LeadDetailsScreen.tsx`
- `modules/inventory/AssetVault.jsx` -> `src/modules/inventory/AssetVaultScreen.tsx`
- `modules/inventory/InventoryDetails.jsx` -> `src/modules/inventory/InventoryDetailsScreen.tsx`
- `modules/reports/IntelligenceReports.jsx` -> `src/modules/reports/IntelligenceReportsScreen.tsx`
- `modules/reports/Performance.jsx` -> `src/modules/reports/PerformanceScreen.tsx`
- `modules/calendar/MasterSchedule.jsx` -> `src/modules/calendar/MasterScheduleScreen.tsx`
- `modules/chat/TeamChat.jsx` -> `src/modules/chat/TeamChatScreen.tsx`
- `modules/admin/TeamManager.jsx` -> `src/modules/admin/TeamManagerScreen.tsx`
- `modules/admin/SystemSettings.jsx` -> `src/modules/admin/SystemSettingsScreen.tsx`
- `modules/finance/FinancialCore.jsx` -> `src/modules/finance/FinancialCoreScreen.tsx`
- Shared mobile design system:
  - `src/theme/tokens.ts`
  - `src/components/common/ui.tsx` (`AppCard`, `AppButton`, `AppChip`, `AppInput`)
  - Integrated in core screens: `LoginScreen`, `LeadsMatrixScreen`, `LeadDetailsScreen`, `TeamManagerScreen`, and `Screen` shell

## Not Included In Mobile Scope (for now)

- `modules/manager/LeadPool.jsx` (desktop-heavy workflow; can be merged into leads flow if needed)
- `modules/portal/ClientHome.jsx`
- `modules/portal/ClientListing.jsx`
- `components/layout/Navbar.jsx` and `components/layout/Sidebar.jsx` (replaced by mobile tab navigation)
- `components/background/WarpField.jsx` (web visual effect)

## Next Suggested Pass

1. Apply shared UI components to remaining modules (`Inventory`, `Reports`, `Chat`, `Calendar`).
2. Add role-wise snapshot tests for critical screens.
3. Build a dedicated mobile onboarding flow for first-time users.
