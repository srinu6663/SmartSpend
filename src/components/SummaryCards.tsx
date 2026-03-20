import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { startOfMonth, endOfMonth, startOfMonth as startOfLastMonth, endOfMonth as endOfLastMonth, subMonths } from "date-fns";

const fmt = (n: number) =>
  `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const pctChange = (current: number, prev: number) => {
  if (prev === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 100);
};

const SummaryCards = () => {
  const { transactions, wallets } = useDataStore();

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfLastMonth(subMonths(now, 1));
  const lastMonthEnd = endOfLastMonth(subMonths(now, 1));

  const inRange = (date: string, from: Date, to: Date) => {
    const d = new Date(date);
    return d >= from && d <= to;
  };

  // This month
  const monthIncome = transactions
    .filter(t => t.type === "income" && inRange(t.date, thisMonthStart, thisMonthEnd))
    .reduce((s, t) => s + Number(t.amount), 0);

  const monthExpense = transactions
    .filter(t => t.type === "expense" && inRange(t.date, thisMonthStart, thisMonthEnd))
    .reduce((s, t) => s + Number(t.amount), 0);

  // Last month — for comparison %
  const lastIncome = transactions
    .filter(t => t.type === "income" && inRange(t.date, lastMonthStart, lastMonthEnd))
    .reduce((s, t) => s + Number(t.amount), 0);

  const lastExpense = transactions
    .filter(t => t.type === "expense" && inRange(t.date, lastMonthStart, lastMonthEnd))
    .reduce((s, t) => s + Number(t.amount), 0);

  // Total balance = sum of all wallets (real-time, not derived from transactions)
  const totalBalance = wallets.reduce((s, w) => s + Number(w.balance), 0);
  const netSavings = monthIncome - monthExpense;

  const incomePct = pctChange(monthIncome, lastIncome);
  const expensePct = pctChange(monthExpense, lastExpense);

  return (
    <div className="px-4 space-y-3">
      {/* ── Total Balance card ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="relative overflow-hidden rounded-2xl p-5"
        style={{ background: "linear-gradient(135deg, hsl(239,84%,67%) 0%, hsl(262,83%,58%) 100%)" }}
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-3.5 h-3.5 text-white/60" />
            <p className="text-xs font-medium text-white/70">
              Total Wallet Balance · {wallets.length} wallet{wallets.length !== 1 ? "s" : ""}
            </p>
          </div>
          <p className="text-4xl font-bold tabular-nums tracking-tight text-white">
            {fmt(totalBalance)}
          </p>
          {/* Net savings pill */}
          <div className="flex items-center gap-2 mt-2.5">
            <div className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 ${netSavings >= 0 ? "bg-white/20" : "bg-red-400/30"}`}>
              {netSavings >= 0
                ? <ArrowUpRight className="w-3 h-3 text-white" />
                : <ArrowDownRight className="w-3 h-3 text-white" />
              }
              <span className="text-[11px] font-semibold text-white tabular-nums">
                {netSavings >= 0 ? "+" : ""}{fmt(netSavings)} saved
              </span>
            </div>
            <span className="text-[11px] text-white/55">this month</span>
          </div>
        </div>
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -right-4 -bottom-12 w-32 h-32 rounded-full bg-white/5" />
      </motion.div>

      {/* ── Income / Expense cards ──────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Income */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.06, ease: [0.32, 0.72, 0, 1] }}
          className="bg-card rounded-2xl p-4 shadow-card"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-success-soft flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4 text-success" />
            </div>
            {lastIncome > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${incomePct >= 0 ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"}`}>
                {incomePct >= 0 ? "+" : ""}{incomePct}%
              </span>
            )}
          </div>
          <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Income</p>
          <p className="text-xl font-bold tabular-nums text-foreground">{fmt(monthIncome)}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">This month only</p>
        </motion.div>

        {/* Expenses */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12, ease: [0.32, 0.72, 0, 1] }}
          className="bg-card rounded-2xl p-4 shadow-card"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-destructive-soft flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-destructive" />
            </div>
            {lastExpense > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${expensePct <= 0 ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"}`}>
                {expensePct >= 0 ? "+" : ""}{expensePct}%
              </span>
            )}
          </div>
          <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Expenses</p>
          <p className="text-xl font-bold tabular-nums text-foreground">{fmt(monthExpense)}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">This month only</p>
        </motion.div>
      </div>
    </div>
  );
};

export default SummaryCards;
