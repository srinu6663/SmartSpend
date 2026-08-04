import { useCallback, useEffect, useState } from "react";
import { MessageSquare, ShieldCheck, RefreshCw, Check, X, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SmsReader, isSmsAvailable } from "@/lib/smsReader";
import {
  scanInbox,
  fetchPendingImports,
  approveImport,
  ignoreImport,
  isImportEnabled,
  setImportEnabled,
  type PendingImport,
} from "@/lib/smsImport";
import { formatINR } from "@/lib/finance";

/**
 * Settings + review queue for SMS import.
 *
 * Two deliberate choices:
 *  - Permission is requested only when the user turns the feature on, never on
 *    app start. An unexplained SMS prompt at launch is how apps get uninstalled.
 *  - Low-confidence parses land here for approval instead of being written
 *    straight to the ledger. A wrong auto-import is a wrong balance.
 */
const SmsImportCard = () => {
  const available = isSmsAvailable();
  const [enabled, setEnabled] = useState(isImportEnabled());
  const [granted, setGranted] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pending, setPending] = useState<PendingImport[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    try {
      setPending(await fetchPendingImports());
    } catch (err) {
      console.error("Could not load pending imports:", err);
    }
  }, []);

  useEffect(() => {
    if (!available) return;
    void SmsReader.checkSmsPermission().then(({ granted }) => setGranted(granted));
    void loadPending();
  }, [available, loadPending]);

  const toggle = async () => {
    if (enabled) {
      setEnabled(false);
      setImportEnabled(false);
      await SmsReader.stopWatching();
      toast.info("SMS import turned off.");
      return;
    }

    const { granted: ok } = await SmsReader.requestSmsPermission();
    setGranted(ok);
    if (!ok) {
      toast.error("SMS permission denied. Import stays off.");
      return;
    }

    setEnabled(true);
    setImportEnabled(true);
    await SmsReader.startWatching();
    toast.success("SMS import on. Scanning recent messages…");
    void runScan();
  };

  const runScan = async () => {
    setScanning(true);
    try {
      const result = await scanInbox();
      await loadPending();

      if (result.scanned === 0) {
        toast.info("No new messages since the last scan.");
      } else {
        toast.success(
          `Scanned ${result.scanned}: ${result.imported} added, ${result.queued} to review, ${result.rejected} ignored.`
        );
      }
    } catch (err) {
      console.error("Scan failed:", err);
      toast.error("Could not scan messages.");
    } finally {
      setScanning(false);
    }
  };

  const onApprove = async (item: PendingImport) => {
    setBusyId(item.id);
    const { error } = await approveImport(item);
    setBusyId(null);

    if (error) {
      toast.error(`Could not add: ${(error as Error)?.message ?? "unknown error"}`);
      return;
    }
    setPending((prev) => prev.filter((p) => p.id !== item.id));
    toast.success(`Added ${formatINR(item.amount)}`);
  };

  const onIgnore = async (item: PendingImport) => {
    setBusyId(item.id);
    try {
      await ignoreImport(item.id);
      setPending((prev) => prev.filter((p) => p.id !== item.id));
    } catch {
      toast.error("Could not dismiss.");
    } finally {
      setBusyId(null);
    }
  };

  if (!available) {
    return (
      <div className="mx-4 rounded-2xl border border-border p-4">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">SMS import needs the Android app</p>
            <p className="text-xs text-muted-foreground mt-1">
              Browsers have no access to the SMS inbox, so this only works in the installed
              Android build. Receipt scanning works everywhere.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 space-y-3">
      <div className="rounded-2xl border border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">Auto-import from SMS</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Reads bank alerts on this device and logs transactions for you.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggle}
            role="switch"
            aria-checked={enabled}
            aria-label="Toggle SMS import"
            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
              enabled ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div className="flex items-start gap-2 mt-3 rounded-xl bg-muted/40 p-3">
          <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Messages are read and parsed on your device. Only a matched amount, date and
            merchant are saved — never the full message of anything that isn't a
            transaction. OTPs, promotions and reminders are discarded before anything leaves
            the phone.
          </p>
        </div>

        {enabled && granted && (
          <button
            type="button"
            onClick={runScan}
            disabled={scanning}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Scanning…" : "Scan for new messages"}
          </button>
        )}
      </div>

      {pending.length > 0 && (
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">
            Needs review · {pending.length}
          </p>

          <div className="space-y-2">
            {pending.map((item) => (
              <div key={item.id} className="rounded-xl bg-muted/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">
                      {item.direction === "income" ? "+" : "−"}
                      {formatINR(item.amount, { decimals: 2 }).replace("₹", "₹")}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.merchant || item.sender || "Unknown"} · {item.occurred_on}
                    </p>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onIgnore(item)}
                      disabled={busyId === item.id}
                      aria-label="Dismiss"
                      className="w-8 h-8 rounded-lg bg-background flex items-center justify-center disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onApprove(item)}
                      disabled={busyId === item.id}
                      aria-label="Add transaction"
                      className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center disabled:opacity-50"
                    >
                      {busyId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 text-primary-foreground animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-primary-foreground" />
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground/70 mt-2 line-clamp-2">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SmsImportCard;
