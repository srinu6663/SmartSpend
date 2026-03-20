import { motion } from "framer-motion";
import { AlertTriangle, TrendingUp, BarChart3, TrendingDown } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";

const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
  warning: { bg: "bg-warning-soft", text: "text-foreground", icon: "text-warning" },
  success: { bg: "bg-success-soft", text: "text-foreground", icon: "text-success" },
  info: { bg: "bg-primary-soft", text: "text-foreground", icon: "text-primary" },
};

const InsightsStrip = () => {
  const { transactions } = useDataStore();

  const currentMonthExp = transactions
    .filter(t => t.type === 'expense' && new Date(t.date).getMonth() === new Date().getMonth())
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const prevMonthExp = transactions
    .filter(t => t.type === 'expense' && new Date(t.date).getMonth() === new Date().getMonth() - 1)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const dynamicInsights = [];

  if (currentMonthExp > prevMonthExp && prevMonthExp > 0) {
    dynamicInsights.push({
      id: "i1", type: "warning", 
      title: "Spending increased", 
      description: `You've spent ₹${(currentMonthExp - prevMonthExp).toLocaleString()} more than last month.`, 
      icon: AlertTriangle
    });
  } else if (currentMonthExp < prevMonthExp && currentMonthExp > 0) {
    dynamicInsights.push({
      id: "i1", type: "success", 
      title: "On track to save", 
      description: `Your expenses are below last month's pace by ₹${(prevMonthExp - currentMonthExp).toLocaleString()}.`, 
      icon: TrendingDown
    });
  }

  const categoryMap: Record<string, number> = {};
  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  transactions
    .filter(t => {
      const d = new Date(t.date);
      return t.type === 'expense' && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    })
    .forEach(t => {
      const name = t.categories?.name || "Other";
      categoryMap[name] = (categoryMap[name] || 0) + Number(t.amount);
    });
  
  const entries = Object.entries(categoryMap).sort((a,b) => b[1] - a[1]);
  if (entries.length > 0) {
    dynamicInsights.push({
      id: "i2", type: "info",
      title: "Top Category this month",
      description: `Most spending goes to ${entries[0][0]} — ₹${entries[0][1].toLocaleString("en-IN")}.`,
      icon: BarChart3
    });
  }

  if (dynamicInsights.length === 0) {
    dynamicInsights.push({
      id: "idx", type: "success",
      title: "Start Tracking",
      description: "Welcome! Add some transactions to see smart insights here.",
      icon: TrendingUp
    });
  }

  return (
    <div className="px-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">Insights</h2>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {dynamicInsights.map((insight, i) => {
          const Icon = insight.icon;
          const colors = colorMap[insight.type] || colorMap.info;

          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
              className={`shrink-0 w-[240px] ${colors.bg} rounded-2xl p-4 border border-border/30`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Icon className={`w-4 h-4 ${colors.icon}`} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${colors.text} mb-0.5`}>{insight.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{insight.description}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default InsightsStrip;
