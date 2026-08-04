import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes.
 *
 * Without this, any thrown error in a component unmounts the whole React tree
 * and leaves a blank white screen with no way back — the user's only recourse is
 * to guess that a reload might help. A finance app should never silently become
 * a white page.
 *
 * Note this only catches errors during render/lifecycle. Rejected promises in
 * event handlers are handled where they occur (see the stores and `lib/ai.ts`).
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  private reload = () => window.location.reload();

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background text-foreground">
        <div className="w-full max-w-sm space-y-5 text-center">
          <div className="flex justify-center">
            <div className="bg-destructive/10 p-4 rounded-full">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold">Something broke</h1>
            <p className="text-sm text-muted-foreground">
              An unexpected error stopped this screen from rendering. Your data is safe.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.reload}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Reload the app
            </button>
          </div>

          {import.meta.env.DEV && (
            <pre className="text-left text-[11px] text-muted-foreground/70 overflow-x-auto whitespace-pre-wrap break-words">
              {error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
