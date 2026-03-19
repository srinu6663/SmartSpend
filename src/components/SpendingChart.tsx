import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useDataStore } from "@/store/useDataStore";
import { motion } from "framer-motion";

const SpendingChart = () => {
  const { transactions } = useDataStore();
  
  const currentMonthExpenses = transactions.filter(t => {
    const d = new Date(t.date);
    const now = new Date();
    return t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const categoryMap: Record<string, { value: number, color: string }> = {};
  
  currentMonthExpenses.forEach(t => {
    const catName = t.categories?.name || "Other";
    const color = t.categories?.color || "hsl(220, 9%, 46%)";
    if (!categoryMap[catName]) {
      categoryMap[catName] = { value: 0, color };
    }
    categoryMap[catName].value += Number(t.amount);
  });

  const data = Object.entries(categoryMap).map(([name, { value, color }]) => ({
    name, value, color
  })).sort((a, b) => b.value - a.value);

  const totalSpent = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="px-4"
    >
      <div className="bg-card rounded-2xl shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Spending Breakdown</h2>
          <span className="text-xs text-muted-foreground">This month</span>
        </div>

        {data.length === 0 ? (
          <div className="py-8 text-center bg-muted/30 rounded-xl">
             <p className="text-xs text-muted-foreground">No expenses this month</p>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="relative w-[140px] h-[140px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                    animationBegin={200}
                    animationDuration={800}
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold tabular-nums text-foreground">
                  ₹{totalSpent >= 1000 ? (totalSpent / 1000).toFixed(1) + 'k' : totalSpent.toFixed(0)}
                </span>
                <span className="text-[10px] text-muted-foreground">spent</span>
              </div>
            </div>

            <div className="flex-1 space-y-2.5 min-w-0">
              {data.slice(0, 5).map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-muted-foreground truncate flex-1">{item.name}</span>
                  <span className="text-xs font-medium tabular-nums text-foreground">
                    ₹{item.value.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default SpendingChart;
