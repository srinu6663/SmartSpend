import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, Minus, ChevronRight, AlertTriangle } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { getInsights, type Insight, type SpendingStats } from "@/lib/ai";
import { toDateString } from "@/lib/date";

/** Below this there isn't enough history for an insight to be worth anything. */
const MIN_TRANSACTIONS = 3;
const ANALYSIS_DAYS = 90;

const AIInsightsCard = () => {
  const { transactions, budgets, subscriptions } = useDataStore();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  /**
   * Aggregate locally and send only numbers — no notes, no merchant names. Keeps
   * personal detail out of the model call and makes the payload tiny regardless
   * of how many transactions exist.
   */
  const stats = useMemo<SpendingStats | null>(() => {
    if (transactions.length < MIN_TRANSACTIONS) return null;

    const cutoff = Date.now() - ANALYSIS_DAYS * 86_400_000;
    const recent = transactions.filter((t) => {
      const time = new Date(t.date).getTime();
      return Number.isFinite(time) && time >= cutoff;
    });
    if (recent.length < MIN_TRANSACTIONS) return null;

    const expenses = recent.filter((t) => t.type === "expense");
    const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
    const totalIncome = recent.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);

    const byCategory = new Map<string, number>();
    expenses.forEach((t) => {
      const name = t.categories?.name || "Uncategorised";
      byCategory.set(name, (byCategory.get(name) ?? 0) + t.amount);
    });

    const topCategories = [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, amount]) => ({
        name,
        amount: Math.round(amount),
        share: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
      }));

    const byWeek = new Map<string, number>();
    expenses.forEach((t) => {
      const d = new Date(t.date);
      if (!Number.isFinite(d.getTime())) return;
      // Week bucket = the Monday of that date, as a stable label.
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = toDateString(monday);
      byWeek.set(key, (byWeek.get(key) ?? 0) + t.amount);
    });

    const budgetProgress = budgets.map((b) => {
      const spent = expenses
        .filter((t) => t.category_id === b.category_id && t.date.slice(0, 7) === b.month.slice(0, 7))
        .reduce((s, t) => s + t.amount, 0);
      return {
        category: b.categories?.name || "Unknown",
        limit: Math.round(b.limit_amount),
        spent: Math.round(spent),
      };
    });

    return {
      periodDays: ANALYSIS_DAYS,
      totalIncome: Math.round(totalIncome),
      totalExpense: Math.round(totalExpense),
      transactionCount: recent.length,
      topCategories,
      byWeek: [...byWeek.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-8)
        .map(([week, expense]) => ({ week, expense: Math.round(expense) })),
      budgets: budgetProgress,
      recurringCount: subscriptions.length,
    };
  }, [transactions, budgets, subscriptions]);

  const load = useCallback(
    async (force: boolean) => {
      if (!stats) return;
      setLoading(true);
      setError(null);
      try {
        const result = await getInsights(stats, force);
        setInsights(result);
        setActiveIndex(0);
      } catch (err) {
        console.error("Insights error:", err);
        setError(err instanceof Error ? err.message : "Could not load insights.");
      } finally {
        setLoading(false);
      }
    },
    [stats]
  );

  // Load once per meaningful data change. getInsights() serves from cache when
  // the aggregate is unchanged, so this no longer bills a call per mount.
  const lastKey = useRef<string>("");
  useEffect(() => {
    if (!stats) return;
    const key = `${stats.transactionCount}:${stats.totalExpense}:${stats.totalIncome}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    void load(false);
  }, [stats, load]);

  useEffect(() => {
    if (insights.length <= 1) return;
    const interval = setInterval(() => setActiveIndex((i) => (i + 1) % insights.length), 6000);
    return () => clearInterval(interval);
  }, [insights.length]);

  if (!stats) return null;

  const active = insights[activeIndex];
  const TrendIcon = active?.trend === "up" ? TrendingUp : active?.trend === "down" ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-4"
    >
      <div
        className="relative rounded-2xl overflow-hidden shadow-lg"
        style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 80%, #9333EA 100%)" }}
      >
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10 blur-xl" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/10 blur-xl" />

        <div className="relative z-10 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-white/70">AI Insights</p>
                <p className="text-sm font-bold text-white leading-none">
                  Last {ANALYSIS_DAYS} days · {stats.transactionCount} transactions
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={loading}
              aria-label="Regenerate insights"
              className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-white ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2" role="status" aria-live="polite">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-3 bg-white/20 rounded-full animate-pulse"
                  style={{ width: `${60 + i * 10}%` }}
                />
              ))}
              <p className="text-xs text-white/60 mt-2">Analysing your spending…</p>
            </div>
          ) : error ? (
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-white/80 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-white/90">{error}</p>
                <button
                  type="button"
                  onClick={() => load(true)}
                  className="text-xs font-bold text-white underline mt-1"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : active ? (
            <>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="mb-4"
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        active.severity === "warning"
                          ? "bg-red-400/30"
                          : active.severity === "good"
                            ? "bg-emerald-300/30"
                            : "bg-white/20"
                      }`}
                    >
                      {/* Trend now comes from the model as structured data
                          instead of being guessed by string-matching the text. */}
                      <TrendIcon className="w-3 h-3 text-white" />
                    </div>
                    <p className="text-sm font-medium text-white leading-relaxed">{active.text}</p>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  {insights.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveIndex(i)}
                      aria-label={`Insight ${i + 1}`}
                      className={`transition-all duration-200 rounded-full ${
                        i === activeIndex ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveIndex((i) => (i + 1) % insights.length)}
                  className="flex items-center gap-1 text-[10px] font-bold text-white/70"
                >
                  Next <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-white/80">No insights yet — add a few more transactions.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default AIInsightsCard;
