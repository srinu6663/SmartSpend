import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useDataStore } from "@/store/useDataStore";
import TransactionCard from "./TransactionCard";
import { PlusCircle } from "lucide-react";

const RecentTransactions = () => {
  const navigate = useNavigate();
  const { transactions } = useDataStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="px-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-foreground tracking-tight">Recent Transactions</h2>
        {transactions.length > 0 && (
          <button
            onClick={() => navigate("/transactions")}
            className="text-xs font-semibold text-primary"
          >
            See All
          </button>
        )}
      </div>

      {transactions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-card rounded-2xl shadow-card border border-border/40 p-8 flex flex-col items-center text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-4 shadow-inner">
            <span className="text-3xl">💸</span>
          </div>
          <p className="text-sm font-bold text-foreground mb-1">No transactions yet</p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            Track your first income or expense — tap the <strong>+</strong> button to get started.
          </p>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 px-4 py-2 rounded-full">
            <PlusCircle className="w-3.5 h-3.5" />
            Add your first entry
          </div>
        </motion.div>
      ) : (
        <div className="bg-card rounded-2xl shadow-card overflow-hidden divide-y divide-border/30">
          {transactions.slice(0, 5).map((t) => (
            <TransactionCard key={t.id} transaction={t} />
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default RecentTransactions;
