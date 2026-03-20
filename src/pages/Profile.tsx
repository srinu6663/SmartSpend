import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Bell, Moon, Sun, ChevronRight, LogOut, HelpCircle,
  Star, Download, Shield, Smartphone, X, Info, Check,
  MessageCircle, Globe
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useDataStore } from "@/store/useDataStore";
import { toast } from "sonner";
import GoalsList from "@/components/GoalsList";
import { usePushNotifications } from "@/hooks/usePushNotifications";

// ── Helpers ────────────────────────────────────────────────
const APP_VERSION = "1.2.0";

// ── About Sheet ─────────────────────────────────────────
const AboutSheet = ({ onClose }: { onClose: () => void }) => (
  <motion.div
    initial={{ y: "100%" }}
    animate={{ y: 0 }}
    exit={{ y: "100%" }}
    transition={{ type: "spring", stiffness: 300, damping: 30 }}
    className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-3xl shadow-2xl max-w-lg mx-auto"
  >
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-bold text-foreground">About SmartSpend</h2>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border/30">
        <img src="/icons/icon-192.png" alt="SmartSpend" className="w-14 h-14 rounded-2xl shadow-md" />
        <div>
          <p className="text-base font-bold text-foreground">SmartSpend</p>
          <p className="text-sm text-muted-foreground">Personal Finance Tracker</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Version {APP_VERSION}</p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {[
          { icon: Globe, label: "Website", value: "smartspend.vercel.app" },
          { icon: Shield, label: "Privacy Policy", value: "View" },
          { icon: MessageCircle, label: "Contact us", value: "support@smartspend.app" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.8} />
              <span className="text-sm text-foreground font-medium">{label}</span>
            </div>
            <span className="text-xs text-muted-foreground">{value}</span>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-center text-muted-foreground/50">
        © 2025 SmartSpend. Made with ❤️ for India 🇮🇳
      </p>
    </div>
    <div className="h-[env(safe-area-inset-bottom)]" />
  </motion.div>
);

// ── Help Sheet ────────────────────────────────────────────
const HelpSheet = ({ onClose }: { onClose: () => void }) => {
  const faqs = [
    { q: "How do I add a transaction?", a: "Tap the blue + button at the bottom of the Dashboard screen." },
    { q: "How do I create a wallet?", a: "On the Dashboard, tap the '+ Add Wallet' button in the Wallets section." },
    { q: "Why is my receipt not scanning?", a: "Make sure the image is clear and well-lit. Try cropping to just the receipt." },
    { q: "How do I set a budget?", a: "Go to Finances → Budgets → tap '+ New Budget' and choose a category." },
    { q: "Can I export my data?", a: "Yes. Go to Profile → Export Data and your CSV file will download instantly." },
  ];

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-3xl shadow-2xl max-w-lg mx-auto max-h-[80vh] overflow-y-auto"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-foreground">Help & FAQ</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-4">
          {faqs.map(({ q, a }) => (
            <div key={q} className="bg-muted/40 rounded-2xl p-4">
              <p className="text-sm font-semibold text-foreground mb-1.5">{q}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 p-4 rounded-2xl bg-primary/5 border border-primary/10">
          <p className="text-sm font-semibold text-foreground mb-1">Still need help?</p>
          <p className="text-xs text-muted-foreground">Email us at <span className="text-primary font-medium">support@smartspend.app</span></p>
        </div>
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </motion.div>
  );
};

// ── Notification Sheet ────────────────────────────────────
const NotificationSheet = ({ onClose, onEnable }: { onClose: () => void; onEnable: () => Promise<void> }) => {
  const [enabling, setEnabling] = useState(false);
  const [done, setDone] = useState(false);
  const current = Notification.permission;

  const handle = async () => {
    setEnabling(true);
    await onEnable();
    setDone(true);
    setEnabling(false);
    setTimeout(onClose, 1200);
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-3xl shadow-2xl max-w-lg mx-auto"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-foreground">Push Notifications</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="mb-5 space-y-3">
          {["Budget over-limit alerts", "Subscription renewal reminders", "Savings goal milestones", "Weekly spending summary"].map(n => (
            <div key={n} className="flex items-center gap-3 py-1">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-primary" />
              </div>
              <span className="text-sm text-foreground font-medium">{n}</span>
            </div>
          ))}
        </div>

        {current === "denied" ? (
          <div className="bg-destructive/10 rounded-2xl p-4 mb-4">
            <p className="text-sm font-semibold text-destructive mb-1">Notifications Blocked</p>
            <p className="text-xs text-muted-foreground">You've blocked notifications. Go to your browser/phone Settings → SmartSpend → allow Notifications.</p>
          </div>
        ) : current === "granted" ? (
          <div className="bg-success/10 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <Check className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-600">Notifications already enabled!</p>
          </div>
        ) : (
          <button
            onClick={handle}
            disabled={enabling || done}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-70"
          >
            {done ? <><Check className="w-4 h-4" /> Enabled!</> : enabling ? "Enabling..." : <><Bell className="w-4 h-4" /> Enable Notifications</>}
          </button>
        )}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </motion.div>
  );
};

// ── Main Profile ─────────────────────────────────────────
const Profile = () => {
  const { user, signOut } = useAuthStore();
  const { transactions, categories } = useDataStore();
  const { requestPermission } = usePushNotifications();
  const [sheet, setSheet] = useState<null | "about" | "help" | "notification">(null);
  const [darkMode, setDarkMode] = useState(document.documentElement.classList.contains("dark"));

  const toggleDark = () => {
    const html = document.documentElement;
    if (darkMode) {
      html.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setDarkMode(false);
    } else {
      html.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setDarkMode(true);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Logged out successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to log out");
    }
  };

  const handleExport = () => {
    if (transactions.length === 0) { toast.info("No transactions to export"); return; }
    const headers = ["Date", "Type", "Amount (₹)", "Note", "Category", "Wallet"];
    const rows = transactions.map(t => [
      t.date, t.type, t.amount,
      `"${(t.note || "").replace(/"/g, '""')}"`,
      t.categories?.name || t.category_id,
      t.wallet_id || "",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `smartspend_export_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${transactions.length} transactions`);
  };

  const handleRate = () => {
    window.open("https://github.com/srinu6663/SmartSpend", "_blank");
    toast.success("Thank you for your support! ⭐");
  };

  const fullName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const initials = fullName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();
  const activeDays = new Set(transactions.map(t => t.date)).size;

  const settingsSections = [
    {
      title: "Preferences",
      items: [
        {
          icon: darkMode ? Sun : Moon,
          label: "Appearance",
          value: darkMode ? "Dark" : "Light",
          color: "#7C3AED",
          onClick: toggleDark,
          toggle: true,
          toggleOn: darkMode,
        },
        {
          icon: Bell,
          label: "Notifications",
          value: Notification.permission === "granted" ? "Enabled" : "Off",
          color: "#D97706",
          onClick: () => setSheet("notification"),
        },
        {
          icon: Download,
          label: "Export Data",
          value: `${transactions.length} transactions`,
          color: "#059669",
          onClick: handleExport,
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          icon: HelpCircle,
          label: "Help & FAQ",
          color: "#4F46E5",
          onClick: () => setSheet("help"),
        },
        {
          icon: Star,
          label: "Rate SmartSpend",
          color: "#F59E0B",
          onClick: handleRate,
        },
        {
          icon: Info,
          label: "About App",
          value: `v${APP_VERSION}`,
          color: "#6B7280",
          onClick: () => setSheet("about"),
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Bottom sheet overlay */}
      <AnimatePresence>
        {sheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setSheet(null)}
            />
            {sheet === "about" && <AboutSheet onClose={() => setSheet(null)} />}
            {sheet === "help" && <HelpSheet onClose={() => setSheet(null)} />}
            {sheet === "notification" && (
              <NotificationSheet
                onClose={() => setSheet(null)}
                onEnable={requestPermission}
              />
            )}
          </>
        )}
      </AnimatePresence>

      <header className="px-4 pt-[env(safe-area-inset-top)]">
        <div className="pt-5 pb-4">
          <h1 className="text-xl font-bold text-foreground tracking-tight">Profile</h1>
        </div>
      </header>

      <main className="px-4 pb-28 space-y-5">
        {/* User card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl shadow-card p-5">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-white font-black text-lg"
              style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-foreground leading-snug">{fullName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase bg-primary/10 text-primary">
                {transactions.length < 5 ? "Getting Started" : "Pro Tracker"}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-3 gap-3">
          {[
            { label: "Transactions", value: transactions.length },
            { label: "Categories", value: categories.length },
            { label: "Active Days", value: `${activeDays}d` },
          ].map(stat => (
            <div key={stat.label} className="bg-card rounded-2xl shadow-card p-4 text-center">
              <p className="text-xl font-bold tabular-nums text-foreground">{stat.value}</p>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Goals */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <GoalsList />
        </motion.div>

        {/* Settings */}
        {settingsSections.map((section, si) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + si * 0.05 }}
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              {section.title}
            </p>
            <div className="bg-card rounded-2xl shadow-card overflow-hidden divide-y divide-border/30">
              {section.items.map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="flex items-center justify-between w-full px-4 py-3.5 active:bg-muted/40 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${item.color}15` }}
                    >
                      <item.icon className="w-[18px] h-[18px]" style={{ color: item.color }} strokeWidth={1.8} />
                    </div>
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {"value" in item && item.value && (
                      <span className="text-xs text-muted-foreground">{item.value}</span>
                    )}
                    {"toggle" in item && item.toggle ? (
                      <div className={`w-10 h-5.5 rounded-full transition-colors relative ${item.toggleOn ? "bg-primary" : "bg-muted-foreground/30"}`}
                        style={{ height: "22px", minWidth: "40px" }}>
                        <div className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform ${item.toggleOn ? "translate-x-[20px]" : "translate-x-[2px]"}`} />
                      </div>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                    )}
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
          transition={{ delay: 0.28 }}
          className="flex items-center gap-3 w-full bg-card rounded-2xl shadow-card px-4 py-3.5 active:bg-muted/40 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
            <LogOut className="w-[18px] h-[18px] text-red-500" strokeWidth={1.8} />
          </div>
          <span className="text-sm font-semibold text-red-500">Log Out</span>
        </motion.button>

        {/* Version footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-center text-[11px] text-muted-foreground/40 font-medium"
        >
          SmartSpend v{APP_VERSION} · Made for India 🇮🇳
        </motion.p>
      </main>
    </div>
  );
};

export default Profile;
