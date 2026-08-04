import { AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * Shown instead of an endless spinner whenever the app cannot reach Supabase.
 * The most common cause by far is a free-tier project that auto-paused, so the
 * copy points straight at the fix.
 */
const BackendErrorScreen = () => {
  const { authError, authErrorDetail, backendStatus, loading, retryInit } = useAuthStore();
  const paused = backendStatus === "unreachable";

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-5 text-center">
        <div className="flex justify-center">
          <div className="bg-destructive/10 p-4 rounded-full">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold">Can't connect to the server</h1>
          <p className="text-sm text-muted-foreground">{authError ?? "The backend is not responding."}</p>
        </div>

        {paused && (
          <ol className="text-left text-[13px] text-muted-foreground space-y-1.5 bg-muted/40 rounded-xl p-4">
            <li>1. Open the Supabase dashboard.</li>
            <li>2. Select the project and click <span className="font-semibold">Resume project</span>.</li>
            <li>3. Wait ~2 minutes for it to come back, then retry below.</li>
          </ol>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={retryInit}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Checking…" : "Retry connection"}
          </button>

          {paused && (
            <a
              href="https://supabase.com/dashboard/projects"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Open Supabase dashboard
            </a>
          )}
        </div>

        {authErrorDetail && (
          <p className="text-[11px] text-muted-foreground/60 break-words font-mono">{authErrorDetail}</p>
        )}
      </div>
    </div>
  );
};

export default BackendErrorScreen;
