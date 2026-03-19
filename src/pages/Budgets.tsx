import { useState } from "react";
import { motion } from "framer-motion";
import { useDataStore } from "@/store/useDataStore";
import { ShoppingCart, Car, Tv, Coffee, Zap, Package, Dumbbell, MoreHorizontal, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import SubscriptionsList from "@/components/SubscriptionsList";

const iconMap: Record<string, React.ElementType> = {
  ShoppingCart, Car, Tv, Coffee, Zap, Package, Dumbbell,
};

const Budgets = () => {
  const [view, setView] = useState<'budgets'|'subscriptions'>('budgets');
  const { budgets, transactions } = useDataStore();
  
  // Calculate spent amounts for each budget
  const budgetList = budgets.map(b => {
    const spent = transactions
      .filter(t => t.category_id === b.category_id && t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
      
    return {
      ...b,
      spent,
      limit: Number(b.limit_amount)
    };
  });

  const totalLimit = budgetList.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgetList.reduce((s, b) => s + b.spent, 0);
  const totalPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="px-4 pt-[env(safe-area-inset-top)] pb-2 bg-background z-10 sticky top-0">
        <div className="pt-5 pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Finances</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Control your spending</p>
          </div>
        </div>

        {/* Segmented Control */}
        <div className="bg-muted p-1 rounded-xl flex items-center mb-2">
          <button
            onClick={() => setView('budgets')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              view === 'budgets' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            Budgets
          </button>
          <button
            onClick={() => setView('subscriptions')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              view === 'subscriptions' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            Subscriptions
          </button>
        </div>
      </header>

      <main className="pb-28">
        {view === 'subscriptions' ? (
          <div className="pt-2"><SubscriptionsList /></div>
        ) : (
          <div className="px-4 space-y-4">
        {/* Overall budget card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-card rounded-2xl shadow-card p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Overall Budget</p>
              <p className="text-2xl font-bold tabular-nums text-foreground mt-0.5">
                ₹{totalSpent.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">/ ₹{totalLimit.toLocaleString()}</span>
              </p>
            </div>
            <div className={`px-3 py-1.5 rounded-xl text-xs font-bold tabular-nums ${
              totalPct > 90 ? "bg-destructive-soft text-destructive" : totalPct > 70 ? "bg-warning-soft text-warning" : "bg-success-soft text-success"
            }`}>
              {totalPct}%
            </div>
          </div>
          <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(totalPct, 100)}%` }}
              transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
              className="h-full rounded-full"
              style={{
                background: totalPct > 90
                  ? "hsl(0, 72%, 51%)"
                  : "linear-gradient(90deg, hsl(239, 84%, 67%), hsl(262, 83%, 58%))",
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 tabular-nums">
            ₹{(totalLimit - totalSpent).toLocaleString()} remaining
          </p>
        </motion.div>

        {/* Individual budgets */}
        {budgetList.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="bg-card rounded-2xl shadow-card p-8 flex flex-col items-center text-center border border-border/40"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-transparent flex items-center justify-center mb-4 shadow-inner">
              <span className="text-3xl">🎯</span>
            </div>
            <p className="text-sm font-bold text-foreground mb-1.5">No budgets set yet</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Create budgets to control your spending by category — like Food, Travel or Entertainment.
            </p>
          </motion.div>
        ) : budgetList.map((budget, i) => {
          const pct = budget.limit > 0 ? (budget.spent / budget.limit) * 100 : 0;
          const isOver = pct > 100;
          const isNear = pct > 80 && !isOver;
          const iconName = budget.categories?.icon || "MoreHorizontal";
          const Icon = iconMap[iconName] || MoreHorizontal;
          const color = budget.categories?.color || "hsl(220, 9%, 46%)";
          const categoryName = budget.categories?.name || "Unknown";
          const remaining = budget.limit - budget.spent;

          return (
            <motion.div
              key={budget.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 + i * 0.04, ease: [0.32, 0.72, 0, 1] }}
              className="bg-card rounded-2xl shadow-card p-4 active:shadow-card-hover transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${color}15` }}
                  >
                    <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{categoryName}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      ₹{budget.spent.toFixed(2)} of ₹{budget.limit.toFixed(0)}
                    </p>
                  </div>
                </div>
                <div className={`px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums ${
                  isOver
                    ? "bg-destructive-soft text-destructive"
                    : isNear
                    ? "bg-warning-soft text-warning"
                    : "bg-success-soft text-success"
                }`}>
                  {Math.round(pct)}%
                </div>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(pct, 100)}%` }}
                  transition={{ duration: 0.6, delay: 0.1 + i * 0.05, ease: [0.32, 0.72, 0, 1] }}
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: isOver
                      ? "hsl(0, 72%, 51%)"
                      : isNear
                      ? "hsl(38, 92%, 50%)"
                      : color,
                  }}
                />
              </div>
              {isOver && (
                <div className="flex items-center gap-1.5 mt-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                  <p className="text-xs font-medium text-destructive tabular-nums">
                    Over budget by ₹{Math.abs(remaining).toFixed(2)}
                  </p>
                </div>
              )}
              {!isOver && (
                <p className="text-[11px] text-muted-foreground mt-2 tabular-nums">
                  ₹{remaining.toFixed(0)} remaining
                </p>
              )}
            </motion.div>
          );
        })}
        </div>
        )}
      </main>
    </div>
  );
};

export default Budgets;
