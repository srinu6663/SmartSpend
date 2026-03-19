import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, TrendingDown, TrendingUp, ArrowLeftRight, Check, Info } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const formatDate = (dateStr: string) => {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "dd MMM");
};

const NotificationsPanel = ({ open, onClose }: Props) => {
  const { transactions, budgets, categories } = useDataStore();
  const { requestPermission } = usePushNotifications();
  const [enabling, setEnabling] = useState(false);
  const pushEnabled = Notification.permission === "granted";

  const handleEnablePush = async () => {
    setEnabling(true);
    await requestPermission();
    setEnabling(false);
  };

  // Build notification items from real data
  const recent = transactions.slice(0, 10);

  // Find exceeded budgets
  const exceededBudgets = budgets.filter(b => {
    const spent = transactions
      .filter(t => t.category_id === b.category_id && t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);
    return spent >= b.limit_amount * 0.8; // 80% or more
  });

  const notifItems = [
    // Budget alerts first
    ...exceededBudgets.map(b => {
      const cat = categories.find(c => c.id === b.category_id);
      const spent = transactions
        .filter(t => t.category_id === b.category_id && t.type === "expense")
        .reduce((s, t) => s + t.amount, 0);
      const isOver = spent >= b.limit_amount;
      return {
        id: `budget-${b.id}`,
        type: "alert" as const,
        icon: Info,
        iconBg: isOver ? "#FEE2E2" : "#FEF3C7",
        iconColor: isOver ? "#DC2626" : "#D97706",
        title: isOver ? `${cat?.name || "Budget"} limit exceeded!` : `${cat?.name || "Budget"} at ${Math.round((spent / b.limit_amount) * 100)}%`,
        subtitle: `₹${Math.round(spent).toLocaleString("en-IN")} of ₹${b.limit_amount.toLocaleString("en-IN")}`,
        date: "Now",
      };
    }),
    // Recent transactions
    ...recent.map(t => ({
      id: t.id,
      type: t.type as "income" | "expense" | "transfer",
      icon: t.type === "income" ? TrendingUp : t.type === "transfer" ? ArrowLeftRight : TrendingDown,
      iconBg: t.type === "income" ? "#DCFCE7" : t.type === "transfer" ? "#EFF6FF" : "#FEF2F2",
      iconColor: t.type === "income" ? "#16A34A" : t.type === "transfer" ? "#2563EB" : "#DC2626",
      title: t.note || t.categories?.name || (t.type === "income" ? "Income" : "Expense"),
      subtitle: `${t.type === "income" ? "+" : t.type === "transfer" ? "⇄" : "-"}₹${t.amount.toLocaleString("en-IN")}`,
      date: formatDate(t.date),
    })),
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-[64px] right-4 left-4 max-w-lg mx-auto z-50 bg-card rounded-2xl shadow-2xl overflow-hidden"
            style={{ maxHeight: "75vh" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/30">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-foreground" strokeWidth={1.8} />
                <span className="text-sm font-bold text-foreground">Notifications</span>
                {notifItems.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-destructive text-white text-[10px] font-black flex items-center justify-center">
                    {Math.min(notifItems.length, 9)}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-muted flex items-center justify-center active:scale-95"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* Push enable banner */}
            {!pushEnabled && (
              <div className="mx-3 mt-3 p-3 rounded-xl bg-primary/8 border border-primary/15 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-primary" strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">Enable push notifications</p>
                  <p className="text-[11px] text-muted-foreground">Get real-time budget & goal alerts</p>
                </div>
                <button
                  onClick={handleEnablePush}
                  disabled={enabling}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-bold active:scale-95 transition-transform"
                >
                  {enabling ? "..." : "Enable"}
                </button>
              </div>
            )}

            {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight: "calc(75vh - 120px)" }}>
              {notifItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Bell className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">No notifications yet</p>
                  <p className="text-xs text-muted-foreground">
                    Add transactions to see activity here
                  </p>
                </div>
              ) : (
                <div className="p-3 space-y-1">
                  {notifItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/40 transition-colors"
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: item.iconBg }}
                      >
                        <item.icon className="w-4 h-4" style={{ color: item.iconColor }} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">{item.title}</p>
                        <p className="text-[11px] text-muted-foreground">{item.subtitle}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground/60 font-medium shrink-0">{item.date}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Push enabled badge */}
              {pushEnabled && (
                <div className="mx-3 mb-3 p-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15 flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Push notifications are active</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationsPanel;
