import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import * as Updates from "expo-updates";
import { AppButton } from "../ui";
import { palette, spacing, typography } from "../../theme/tokens";
import { toErrorMessage } from "../../utils/errorMessage";

/*
 * Mirrors frontend/src/components/ErrorBoundary.jsx.
 *
 * Mobile had none at all, so a render error anywhere took the whole app to a
 * blank screen with no way back short of force-quitting. That is worse on a
 * phone than in a browser: there is no address bar to reload from and no
 * console to read.
 *
 * Recovery differs from web's for the same reason. `window.location.reload()`
 * has no equivalent here, so this offers two steps: try rendering again, which
 * is enough for a transient failure, and a full reload through expo-updates
 * when it is not.
 */

type Props = {
  children: React.ReactNode;
  /** Named in the fallback so a crash report says which stack failed. */
  label?: string;
};

type State = { hasError: boolean; message: string; stack: string };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: "", stack: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: toErrorMessage(error, "Unexpected UI error"),
      stack: "",
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    const message = toErrorMessage(error, "Unexpected UI error");
    const componentStack = String(errorInfo?.componentStack || "");

    console.error(`React UI error boundary${this.props.label ? ` (${this.props.label})` : ""}:`, message);
    if (componentStack) console.error(componentStack);

    // Held for the fallback, which shows it in development only - a component
    // stack on a customer's screen is noise they cannot act on.
    this.setState({ stack: componentStack });
  }

  private retry = () => {
    this.setState({ hasError: false, message: "", stack: "" });
  };

  private reload = async () => {
    try {
      await Updates.reloadAsync();
    } catch {
      // Not available in Expo Go or a dev client without updates; retrying the
      // render is the only thing left to offer.
      this.retry();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.root}>
        <View style={styles.card}>
          <View style={styles.heading}>
            <AlertTriangle size={20} color={palette.amber[600]} />
            <Text style={styles.title}>Something went wrong</Text>
          </View>

          <Text style={styles.message}>
            {this.state.message || "A screen crashed unexpectedly."}
          </Text>

          {__DEV__ && this.state.stack ? (
            <ScrollView style={styles.stackWrap}>
              <Text style={styles.stack}>{this.state.stack}</Text>
            </ScrollView>
          ) : null}

          <View style={styles.actions}>
            <AppButton title="Try again" variant="secondary" onPress={this.retry} style={styles.action} />
            <AppButton title="Reload app" onPress={this.reload} style={styles.action} />
          </View>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: palette.slate[50],
  },
  card: {
    width: "100%",
    maxWidth: 480,
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: spacing.xl,
  },
  heading: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  title: { fontSize: typography.title, fontWeight: "600", color: palette.slate[900] },
  message: {
    marginTop: spacing.lg,
    fontSize: typography.body,
    lineHeight: 20,
    color: palette.slate[600],
  },
  stackWrap: {
    marginTop: spacing.lg,
    maxHeight: 180,
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: 10,
    backgroundColor: palette.slate[50],
    padding: spacing.md,
  },
  stack: { fontSize: 11, lineHeight: 16, color: palette.slate[600] },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  action: { flex: 1 },
});

export default ErrorBoundary;
