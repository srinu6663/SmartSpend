import { motion } from "framer-motion";
import {
  User, Settings, CreditCard, Bell, Shield, Moon, ChevronRight, LogOut, HelpCircle,
  Star, ExternalLink
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useDataStore } from "@/store/useDataStore";
import { toast } from "sonner";
import GoalsList from "@/components/GoalsList";

const settingsSections = [
  {
    title: "Preferences",
    items: [
      { icon: CreditCard, label: "Currency", value: "INR (₹)", color: "hsl(239, 84%, 67%)" },
      { icon: Bell, label: "Notifications", value: "On", color: "hsl(38, 92%, 50%)" },
      { icon: Moon, label: "Appearance", value: "Light", color: "hsl(262, 83%, 58%)" },
      { icon: Settings, label: "Categories", value: "Manage", color: "hsl(160, 84%, 39%)" },
    ],
  },
  {
    title: "Security",
    items: [
      { icon: Shield, label: "Privacy & Security", color: "hsl(190, 80%, 42%)" },
      { icon: ExternalLink, label: "Export Data", color: "hsl(220, 9%, 46%)" },
    ],
  },
  {
    title: "Support",
    items: [
      { icon: HelpCircle, label: "Help Center", color: "hsl(239, 84%, 67%)" },
      { icon: Star, label: "Rate the App", color: "hsl(38, 92%, 50%)" },
    ],
  },
];

const Profile = () => {
  const { user, signOut } = useAuthStore();
  const { transactions, categories } = useDataStore();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Logged out successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to log out");
    }
  };

  const handleExport = () => {
    try {
      if (transactions.length === 0) {
        toast.info("No transactions to export");
        return;
      }

      const headers = ["Date", "Type", "Amount", "Note", "Category ID", "Wallet ID"];
      const csvRows = transactions.map(t => [
        t.date,
        t.type,
        t.amount,
        `"${(t.note || '').replace(/"/g, '""')}"`,
        t.category_id,
        t.wallet_id || ''
      ]);
      
      const csvContent = [headers.join(","), ...csvRows.map(e => e.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `budget_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Transactions exported successfully!");
    } catch (e) {
      toast.error("Failed to export data");
    }
  };

  const fullName = user?.user_metadata?.full_name || "User";
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || "US";

  // Calculate simple streak based on unique days
  const activeDays = new Set(transactions.map(t => t.date)).size;
  const isStarter = transactions.length < 5;

  return (
    <div className="min-h-screen bg-background">
      <header className="px-4 pt-[env(safe-area-inset-top)]">
        <div className="pt-5 pb-4">
          <h1 className="text-xl font-bold text-foreground tracking-tight">Profile</h1>
        </div>
      </header>

      <main className="px-4 pb-28 space-y-5">
        {/* User card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-card rounded-2xl shadow-card p-5 flex items-center gap-4"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, hsl(239, 84%, 67%) 0%, hsl(262, 83%, 58%) 100%)",
            }}
          >
            <span className="text-xl font-bold text-white tracking-widest">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-foreground">{fullName}</p>
            <p className="text-xs text-muted-foreground truncate mb-1.5">{user?.email || "user@email.com"}</p>
            <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-bold tracking-wide uppercase ${isStarter ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary"}`}>
              {isStarter ? "Starter" : "Pro Tracker"}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="grid grid-cols-3 gap-3"
        >
          {[
            { label: "Transactions", value: transactions.length },
            { label: "Categories", value: categories.length },
            { label: "Active Days", value: `${activeDays}d` },
          ].map((stat) => (
            <div key={stat.label} className="bg-card rounded-2xl shadow-card p-4 text-center">
              <p className="text-xl font-bold tabular-nums text-foreground">{stat.value}</p>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
        >
          <GoalsList />
        </motion.div>

        {/* Settings sections */}
        {settingsSections.map((section, si) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + si * 0.05 }}
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              {section.title}
            </p>
            <div className="bg-card rounded-2xl shadow-card overflow-hidden divide-y divide-border/30">
              {section.items.map((item) => (
                <button
                  key={item.label}
                  onClick={() => item.label === "Export Data" ? handleExport() : null}
                  className="flex items-center justify-between w-full px-4 py-3.5 active:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${item.color}15` }}
                    >
                      <item.icon className="w-4.5 h-4.5" style={{ color: item.color }} strokeWidth={1.8} />
                    </div>
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {"value" in item && item.value && (
                      <span className="text-xs text-muted-foreground">{item.value}</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        ))}

        {/* Logout */}
        <motion.button
          onClick={handleSignOut}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="flex items-center gap-3 w-full bg-card rounded-2xl shadow-card px-4 py-3.5 active:bg-muted/50 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-destructive-soft flex items-center justify-center">
            <LogOut className="w-4.5 h-4.5 text-destructive" strokeWidth={1.8} />
          </div>
          <span className="text-sm font-semibold text-destructive">Log Out</span>
        </motion.button>
      </main>
    </div>
  );
};

export default Profile;
