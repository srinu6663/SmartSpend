import { useState } from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, X, PlusCircle } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import type { Transaction } from "@/store/useDataStore";
import TransactionCard from "@/components/TransactionCard";
import FAB from "@/components/FAB";
import QuickAddSheet from "@/components/QuickAddSheet";

const formatDateHeader = (dateStr: string) => {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dateStr === today.toISOString().split("T")[0]) return "Today";
  if (dateStr === yesterday.toISOString().split("T")[0]) return "Yesterday";

  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
};

const groupByDate = (txns: Transaction[]) => {
  const groups: Record<string, Transaction[]> = {};
  txns.forEach((t) => {
    if (!groups[t.date]) groups[t.date] = [];
    groups[t.date].push(t);
  });
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
};

const Transactions = () => {
  const [search, setSearch] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const { transactions } = useDataStore();

  const filters = ["All", "Income", "Expense", "Transfer"];

  const filtered = transactions.filter((t) => {
    let matchesSearch = true;
    const s = search.trim().toLowerCase();
    
    if (s) {
      if (s.startsWith(">") && !isNaN(parseFloat(s.slice(1)))) {
        matchesSearch = Math.abs(t.amount) > parseFloat(s.slice(1));
      } else if (s.startsWith("<") && !isNaN(parseFloat(s.slice(1)))) {
        matchesSearch = Math.abs(t.amount) < parseFloat(s.slice(1));
      } else {
        const categoryName = t.categories?.name?.toLowerCase() || "";
        const noteStr = t.note?.toLowerCase() || "";
        const monthStr = new Date(t.date).toLocaleDateString('en-US', { month: 'long' }).toLowerCase();
        const shortMonthStr = new Date(t.date).toLocaleDateString('en-US', { month: 'short' }).toLowerCase();
        
        matchesSearch = categoryName.includes(s) || noteStr.includes(s) || monthStr.includes(s) || shortMonthStr.includes(s);
      }
    }
      
    const matchesFilter = !activeFilter || activeFilter === "All"
      ? true 
      : activeFilter.toLowerCase() === t.type.toLowerCase();
        
    return matchesSearch && matchesFilter;
  });

  const grouped = groupByDate(filtered);

  return (
    <div className="min-h-screen bg-background">
      <header className="px-4 pt-[env(safe-area-inset-top)]">
        <div className="pt-5 pb-3">
          <h1 className="text-xl font-bold text-foreground tracking-tight">Transactions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{transactions.length} transactions this month</p>
        </div>

        {/* Search */}
        <div className="flex gap-2 pb-3">
          <div className="flex-1 flex items-center gap-2.5 bg-card rounded-xl px-3.5 py-3 shadow-card">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search (e.g. >5000, Dec, Food, #Tip)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 pb-3">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f === "All" ? null : f)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                (f === "All" && !activeFilter) || activeFilter === f
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card text-muted-foreground shadow-card"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <main className="pb-28">
        {grouped.length === 0 ? (
          transactions.length === 0 ? (
            // True empty state: no data at all
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center py-20 px-8 text-center"
            >
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/15 via-primary/10 to-transparent flex items-center justify-center mb-5 shadow-inner">
                <span className="text-4xl">🧾</span>
              </div>
              <p className="text-base font-bold text-foreground mb-2">No transactions yet</p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Your financial story starts here. Tap the <strong>+</strong> button to log your first income or expense.
              </p>
              <div className="flex items-center gap-2 text-xs font-bold text-primary bg-primary/10 px-5 py-2.5 rounded-full">
                <PlusCircle className="w-4 h-4" />
                Start tracking
              </div>
            </motion.div>
          ) : (
            // Filter/search yielded nothing
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center py-20 px-8 text-center"
            >
              <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mb-5">
                <Search className="w-9 h-9 text-muted-foreground/50" />
              </div>
              <p className="text-base font-bold text-foreground mb-1">Nothing found</p>
              <p className="text-sm text-muted-foreground">Try a different search term or clear your filters.</p>
            </motion.div>
          )
        ) : (
          grouped.map(([date, txns], gi) => (
            <motion.div
              key={date}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: gi * 0.05 }}
            >
              <div className="px-4 pt-4 pb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {formatDateHeader(date)}
                </span>
              </div>
              <div className="bg-card mx-4 rounded-2xl shadow-card overflow-hidden divide-y divide-border/30">
                {txns.map((t) => (
                  <TransactionCard key={t.id} transaction={t} />
                ))}
              </div>
            </motion.div>
          ))
        )}
      </main>

      <FAB onClick={() => setQuickAddOpen(true)} />
      <QuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </div>
  );
};

export default Transactions;
