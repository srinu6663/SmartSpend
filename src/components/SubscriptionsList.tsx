import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Repeat, CalendarDays } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import SubscriptionAddSheet from "./SubscriptionAddSheet";

const SubscriptionsList = () => {
  const { subscriptions, fetchSubscriptions } = useDataStore();
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  return (
    <>
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">Active Subscriptions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{subscriptions.length} recurring expenses</p>
          </div>
          <button 
            onClick={() => setAddOpen(true)}
            className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        {subscriptions.length === 0 ? (
          <div className="bg-card rounded-2xl p-6 text-center shadow-card border border-border/40 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Repeat className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">No subscriptions yet</p>
            <p className="text-xs text-muted-foreground mt-1">Track your Netflix, Spotify, or Rent automatically.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {subscriptions.map((sub, i) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="bg-card rounded-2xl p-4 shadow-card flex items-center justify-between"
              >
                <div className="flex items-center gap-3.5">
                  <div 
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
                    style={{ backgroundColor: `${sub.color}15` }}
                  >
                    <span className="font-extrabold text-lg" style={{ color: sub.color }}>
                      {sub.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{sub.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <CalendarDays className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Next: {new Date(sub.next_billing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric'})}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                        {sub.billing_cycle}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums text-foreground">₹{sub.amount.toLocaleString()}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <SubscriptionAddSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
};

export default SubscriptionsList;
