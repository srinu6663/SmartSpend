import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";

const SummaryCards = () => {
  const { transactions, wallets } = useDataStore();

  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  const expense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);
    
  const balance = wallets.reduce((sum, w) => sum + Number(w.balance), 0);

  return (
    <div className="px-4 space-y-3">
      {/* Main balance card with gradient */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="relative overflow-hidden rounded-2xl p-5"
        style={{
          background: "linear-gradient(135deg, hsl(239, 84%, 67%) 0%, hsl(262, 83%, 58%) 100%)",
        }}
      >
        <div className="relative z-10">
          <p className="text-xs font-medium text-white/70 mb-1">Total Balance</p>
          <p className="text-4xl font-bold tabular-nums tracking-tight text-white">
            ₹{balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <div className="flex items-center gap-1 mt-2">
            <div className="flex items-center gap-0.5 bg-white/20 rounded-full px-2 py-0.5">
              <ArrowUpRight className="w-3 h-3 text-white" />
              <span className="text-[11px] font-semibold text-white tabular-nums">+0%</span>
            </div>
            <span className="text-[11px] text-white/60">vs last month</span>
          </div>
        </div>
        {/* Decorative circles */}
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -right-4 -bottom-12 w-32 h-32 rounded-full bg-white/5" />
      </motion.div>

      {/* Income / Expense cards */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.06, ease: [0.32, 0.72, 0, 1] }}
          className="bg-card rounded-2xl p-4 shadow-card"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-success-soft flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4 text-success" />
            </div>
          </div>
          <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Income</p>
          <p className="text-xl font-bold tabular-nums text-foreground">
            ₹{income.toLocaleString("en-US", { minimumFractionDigits: 0 })}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12, ease: [0.32, 0.72, 0, 1] }}
          className="bg-card rounded-2xl p-4 shadow-card"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-destructive-soft flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-destructive" />
            </div>
          </div>
          <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Expenses</p>
          <p className="text-xl font-bold tabular-nums text-foreground">
            ₹{expense.toLocaleString("en-US", { minimumFractionDigits: 0 })}
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default SummaryCards;
