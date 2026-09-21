import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton, type ButtonVariant } from "./Button";
import { colors, elevation, palette, radii, spacing, typography } from "../../theme/tokens";
import { themedStyles, themePalette } from "../../theme/themedStyles";

/*
 * Mirrors Modal.jsx and ConfirmDialog.jsx.
 *
 * Web centres a dialog in the viewport. On a phone a centred dialog fights the
 * keyboard and puts its actions out of thumb reach, so these present as bottom
 * sheets - the layout adaptation recorded in the design doc. Copy, button order
 * and destructive styling are unchanged from web.
 */

export const AppSheet = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  style,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPress} onPress={onClose} accessibilityLabel="Close" />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.xl) }, style]}>
          <View style={styles.grabber} />

          {title ? (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          ) : null}

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
};

export const AppConfirmDialog = ({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  busy,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const confirmVariant: ButtonVariant = destructive ? "danger" : "primary";

  return (
    <AppSheet
      visible={visible}
      onClose={onCancel}
      title={title}
      footer={
        <View style={styles.confirmActions}>
          <AppButton
            title={cancelLabel}
            variant="secondary"
            onPress={onCancel}
            disabled={busy}
            style={styles.confirmButton}
          />
          <AppButton
            title={confirmLabel}
            variant={confirmVariant}
            onPress={onConfirm}
            loading={busy}
            style={styles.confirmButton}
          />
        </View>
      }
    >
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </AppSheet>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay,
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    maxHeight: "85%",
    ...elevation.panel,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: themePalette.slate[300],
    marginBottom: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
    marginBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.title,
    fontWeight: "600",
    color: themePalette.slate[900],
    letterSpacing: -0.25,
  },
  subtitle: {
    fontSize: typography.label,
    lineHeight: 18,
    color: themePalette.slate[500],
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    gap: spacing.lg,
  },
  footer: {
    paddingTop: spacing.xl,
    marginTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  confirmActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  confirmButton: {
    flex: 1,
  },
  message: {
    fontSize: typography.body,
    lineHeight: 20,
    color: themePalette.slate[600],
  },
}));
