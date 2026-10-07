/*
 * The mobile UI kit - the RN counterpart of frontend/src/components/ui/.
 *
 * Every screen from Phase 1 onward builds from these. See
 * docs/mobile/01_MOBILE_DESIGN_SYSTEM.md for the component contract each one
 * implements and the places mobile deliberately departs from web.
 */

export { AppButton, type AppButtonProps, type ButtonVariant, type ButtonSize } from "./Button";
export { AppIconButton, type IconButtonSize } from "./IconButton";
export {
  AppCard,
  AppCardHeader,
  AppCardTitle,
  AppCardDescription,
  AppCardContent,
  AppCardFooter,
} from "./Card";
export { AppBadge, type BadgeVariant } from "./Badge";
export { AppInput, AppSearchInput, type AppInputProps } from "./Input";
export { AppTabs, AppSegmentedTabs, type TabItem } from "./Tabs";
export { AppSheet, AppConfirmDialog } from "./Overlay";
export { AppEmptyState, AppErrorState, AppSkeleton, AppSkeletonList } from "./Feedback";
