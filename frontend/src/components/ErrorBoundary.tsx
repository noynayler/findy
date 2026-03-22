import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional label for the fallback (e.g. app name). */
  title?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

/**
 * Catches render errors in the subtree and shows a recovery UI.
 * Async errors must still be handled with try/catch in callers.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, message: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, message: null });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      const title = this.props.title ?? "Something went wrong";
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
          <div
            role="alert"
            className="max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-lg"
          >
            <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {this.state.message ?? "An unexpected error occurred."}
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="mt-6 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
