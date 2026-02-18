import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toErrorMessage } from "../utils/errorMessage";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      message: "",
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: toErrorMessage(error, "Unexpected UI error"),
    };
  }

  componentDidCatch(error, errorInfo) {
    const message = toErrorMessage(error, "Unexpected UI error");
    const componentStack =
      typeof errorInfo?.componentStack === "string"
        ? errorInfo.componentStack
        : "";

    console.error("React UI error boundary:", message);
    if (componentStack) {
      console.error(componentStack);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-950 text-slate-100">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900/85 p-6">
            <div className="flex items-center gap-3 text-amber-300">
              <AlertTriangle size={20} />
              <h2 className="text-lg font-semibold">Something went wrong</h2>
            </div>
            <p className="mt-3 text-sm text-slate-300 break-words">
              {this.state.message || "A component crashed unexpectedly."}
            </p>
            <button
              onClick={this.handleReload}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/20"
            >
              <RefreshCw size={14} />
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

