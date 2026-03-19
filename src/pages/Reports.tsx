import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, Tooltip } from "recharts";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";

const Reports = () => {
  const { transactions, budgets } = useDataStore();

  const categoryData = budgets.map((b) => {
    const spent = transactions
      .filter(t => t.category_id === b.category_id && t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return {
      name: b.categories?.name || "Unknown",
      spent,
      limit: Number(b.limit_amount),
      pct: Number(b.limit_amount) > 0 ? Math.round((spent / Number(b.limit_amount)) * 100) : 0,
      color: b.categories?.color || "hsl(220, 9%, 46%)",
    };
  }).sort((a, b) => b.spent - a.spent);

  // Calculate monthly data (last 6 months)
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyDataMap: Record<string, { month: string, income: number, expense: number, index: number }> = {};
  
  const today = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const m = monthNames[d.getMonth()];
    monthlyDataMap[m] = { month: m, income: 0, expense: 0, index: 5 - i };
  }

  transactions.forEach(t => {
    const d = new Date(t.date);
    const diffMonths = (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth());
    if (diffMonths >= 0 && diffMonths < 6) {
      const m = monthNames[d.getMonth()];
      if (monthlyDataMap[m]) {
        if (t.type === 'income') monthlyDataMap[m].income += Number(t.amount);
        else monthlyDataMap[m].expense += Number(t.amount);
      }
    }
  });

  const monthlyData = Object.values(monthlyDataMap).sort((a, b) => a.index - b.index);

  const totalIncome = monthlyData.reduce((s, m) => s + m.income, 0);
  const totalExpense = monthlyData.reduce((s, m) => s + m.expense, 0);
  const savingsRate = totalIncome > 0 ? (((totalIncome - totalExpense) / totalIncome) * 100).toFixed(1) : "0.0";
  
  const avgDaily = (totalExpense / Math.max(1, 6 * 30)).toFixed(0); 
  const topCategory = categoryData.length > 0 ? categoryData[0].name : "None";

  // Comparison
  const currentMonthData = monthlyData[monthlyData.length - 1] || { income: 0, expense: 0 };
  const lastMonthData = monthlyData.length > 1 ? monthlyData[monthlyData.length - 2] : { income: 0, expense: 0 };
  
  const incPct = lastMonthData.income > 0 ? ((currentMonthData.income - lastMonthData.income) / lastMonthData.income * 100) : 0;
  const expPct = lastMonthData.expense > 0 ? ((currentMonthData.expense - lastMonthData.expense) / lastMonthData.expense * 100) : 0;
  const netSavings = currentMonthData.income - currentMonthData.expense;

  // Hashtag Analytics
  const hashtagData = transactions.reduce((acc, t) => {
    if (!t.note || t.type !== 'expense') return acc;
    const tags = t.note.match(/#[\w]+/g) || [];
    tags.forEach(tag => {
       let existing = acc.find(x => x.tag === tag);
       if (existing) {
         existing.amount += Number(t.amount);
         existing.count += 1;
       } else {
         acc.push({ tag, amount: Number(t.amount), count: 1 });
       }
    });
    return acc;
  }, [] as {tag: string, amount: number, count: number}[]).sort((a, b) => b.amount - a.amount).slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <header className="px-4 pt-[env(safe-area-inset-top)]">
        <div className="pt-5 pb-4">
          <h1 className="text-xl font-bold text-foreground tracking-tight">Reports</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Current Month Overview</p>
        </div>
      </header>

      {transactions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center justify-center px-8 text-center pt-16"
        >
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/15 via-primary/10 to-transparent flex items-center justify-center mb-6 shadow-inner">
            <span className="text-5xl">📊</span>
          </div>
          <p className="text-lg font-bold text-foreground mb-2">No data to show yet</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Add a few transactions and your spending insights, charts, and category breakdowns will appear here automatically.
          </p>
        </motion.div>
      ) : (
      <main className="pb-28 space-y-5 px-4">
        {/* Summary stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-3 gap-3"
        >
          <div className="bg-card rounded-2xl shadow-card p-4 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Savings Rate</p>
            <p className="text-2xl font-bold tabular-nums text-success">{savingsRate}%</p>
          </div>
          <div className="bg-card rounded-2xl shadow-card p-4 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Avg Daily</p>
            <p className="text-2xl font-bold tabular-nums text-foreground">₹{avgDaily}</p>
          </div>
          <div className="bg-card rounded-2xl shadow-card p-4 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Top Category</p>
            <p className="text-lg font-bold text-foreground truncate px-1">{topCategory}</p>
          </div>
        </motion.div>

        {/* Income vs Expense trend */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-card rounded-2xl shadow-card p-5"
        >
          <h3 className="text-sm font-semibold text-foreground mb-1">Income vs Expenses</h3>
          <p className="text-xs text-muted-foreground mb-4">Last 6 months</p>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barGap={4}>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(220, 9%, 46%)" }}
                />
                <YAxis hide />
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    backgroundColor: "hsl(0, 0%, 100%)",
                    border: "1px solid hsl(220, 13%, 91%)",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,.08)",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`₹${value.toLocaleString()}`, ""]}
                />
                <Bar dataKey="income" fill="hsl(160, 84%, 39%)" radius={[6, 6, 0, 0]} barSize={16} />
                <Bar dataKey="expense" fill="hsl(0, 72%, 51%)" radius={[6, 6, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-5 mt-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-success" />
              <span className="text-xs text-muted-foreground">Income</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-destructive" />
              <span className="text-xs text-muted-foreground">Expenses</span>
            </div>
          </div>
        </motion.div>

        {/* Spending trend line */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="bg-card rounded-2xl shadow-card p-5"
        >
          <h3 className="text-sm font-semibold text-foreground mb-1">Spending Trend</h3>
          <p className="text-xs text-muted-foreground mb-4">Monthly expenses over time</p>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(220, 9%, 46%)" }}
                />
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    backgroundColor: "hsl(0, 0%, 100%)",
                    border: "1px solid hsl(220, 13%, 91%)",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,.08)",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`₹${value.toLocaleString()}`, ""]}
                />
                <Line
                  type="monotone"
                  dataKey="expense"
                  stroke="hsl(239, 84%, 67%)"
                  strokeWidth={2.5}
                  dot={{ fill: "hsl(239, 84%, 67%)", r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Category breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-card rounded-2xl shadow-card p-5"
        >
          <h3 className="text-sm font-semibold text-foreground mb-4">Category Breakdown</h3>
          <div className="space-y-4">
            {categoryData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center">No category data</p>
            ) : categoryData.map((cat, i) => (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-sm font-medium text-foreground">{cat.name}</span>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-foreground">₹{cat.spent.toFixed(0)}</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(cat.pct, 100)}%` }}
                    transition={{ duration: 0.6, delay: 0.3 + i * 0.05 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Month comparison */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="bg-card rounded-2xl shadow-card p-5"
        >
          <h3 className="text-sm font-semibold text-foreground mb-4">This Month vs Last</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Income</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tabular-nums text-foreground">₹{currentMonthData.income.toLocaleString()}</span>
                <div className={`flex items-center gap-0.5 ${incPct >= 0 ? "text-success" : "text-destructive"}`}>
                  {incPct >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span className="text-xs font-semibold tabular-nums">{incPct > 0 ? "+" : ""}{incPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Expenses</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tabular-nums text-foreground">₹{currentMonthData.expense.toLocaleString()}</span>
                <div className={`flex items-center gap-0.5 ${expPct <= 0 ? "text-success" : "text-destructive"}`}>
                  {expPct <= 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                  <span className="text-xs font-semibold tabular-nums">{expPct > 0 ? "+" : ""}{expPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <span className="text-sm font-medium text-foreground">Net Savings</span>
              <span className={`text-sm font-bold tabular-nums ${netSavings >= 0 ? "text-success" : "text-destructive"}`}>
                {netSavings > 0 ? "+" : ""}₹{netSavings.toLocaleString()}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Hashtag Analytics */}
        {hashtagData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="bg-card rounded-2xl shadow-card p-5"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4">Top Custom Tags</h3>
            <div className="space-y-3">
              {hashtagData.map((h) => (
                <div key={h.tag} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/40">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shadow-inner">
                      #
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{h.tag}</p>
                      <p className="text-xs font-medium text-muted-foreground">{h.count} transactions</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-foreground">₹{h.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>
      )}
      </div>
  );
};

export default Reports;
