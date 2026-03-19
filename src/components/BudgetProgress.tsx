import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useDataStore } from "@/store/useDataStore";

const BudgetProgress = () => {
  const navigate = useNavigate();
  const { budgets, transactions } = useDataStore();

  const budgetList = budgets.map(b => {
    const spent = transactions
      .filter(t => t.category_id === b.category_id && t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
      
    return {
      ...b,
      spent,
      limit: Number(b.limit_amount)
    };
  }).slice(0, 4);

  return (
    <div className="px-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Budget Overview</h2>
        <button onClick={() => navigate("/budgets")} className="text-xs font-medium text-primary">
          See All
        </button>
      </div>
      <div className="bg-card rounded-2xl shadow-card p-5 space-y-5">
        {budgetList.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No budgets set yet.</p>
        ) : budgetList.map((budget, i) => {
          const pct = budget.limit > 0 ? Math.min((budget.spent / budget.limit) * 100, 100) : 0;
          const isOver = budget.spent > budget.limit;
          const isNear = pct > 80 && !isOver;
          const color = budget.categories?.color || "hsl(220, 9%, 46%)";
          const categoryName = budget.categories?.name || "Unknown";

          return (
            <div key={budget.id}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm font-medium text-foreground">{categoryName}</span>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  ₹{budget.spent.toFixed(0)} / ₹{budget.limit.toFixed(0)}
                </span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: i * 0.06, ease: [0.32, 0.72, 0, 1] }}
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
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BudgetProgress;
