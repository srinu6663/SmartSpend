import { useState } from "react";
import { motion } from "framer-motion";
import { Bell, MessageCircle } from "lucide-react";
import SummaryCards from "@/components/SummaryCards";
import WalletList from "@/components/WalletList";
import SpendingChart from "@/components/SpendingChart";
import WeeklyChart from "@/components/WeeklyChart";
import InsightsStrip from "@/components/InsightsStrip";
import BudgetProgress from "@/components/BudgetProgress";
import RecentTransactions from "@/components/RecentTransactions";
import AIInsightsCard from "@/components/AIInsightsCard";
import FAB from "@/components/FAB";
import QuickAddSheet from "@/components/QuickAddSheet";
import NotificationsPanel from "@/components/NotificationsPanel";
import AIChatSheet from "@/components/AIChatSheet";
import { useAuthStore } from "@/store/useAuthStore";

const Dashboard = () => {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { user } = useAuthStore();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const fullName = user?.user_metadata?.full_name || "User";
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || "US";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="px-4 pt-[env(safe-area-inset-top)]">
        <div className="pt-5 pb-4 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <p className="text-[13px] text-muted-foreground font-medium">{greeting} 👋</p>
            <h1 className="text-xl font-bold text-foreground tracking-tight">{fullName}</h1>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex items-center"
          >
            <button
              onClick={() => setNotifOpen(true)}
              className="relative w-10 h-10 rounded-xl bg-card shadow-card flex items-center justify-center active:scale-95 transition-transform"
            >
              <Bell className="w-5 h-5 text-foreground" strokeWidth={1.8} />
              <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-destructive" />
            </button>
          </motion.div>
        </div>
      </header>

      {/* Content */}
      <main className="overflow-y-auto pb-28 space-y-5">
        <SummaryCards />
        <WalletList />
        <AIInsightsCard />

        {/* Entry point to the conversational assistant */}
        <div className="mx-4">
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="w-full flex items-center gap-3 rounded-2xl border border-border px-4 py-3.5 text-left active:scale-[0.99] transition-transform"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-none">Ask about your money</p>
              <p className="text-[11px] text-muted-foreground mt-1 truncate">
                "How much did I spend on food this month?"
              </p>
            </div>
          </button>
        </div>

        <InsightsStrip />
        <SpendingChart />
        <WeeklyChart />
        <BudgetProgress />
        <RecentTransactions />
      </main>

      <FAB onClick={() => setQuickAddOpen(true)} />
      <QuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      <AIChatSheet open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
};

export default Dashboard;
