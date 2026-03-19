import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Target } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/store/useDataStore";

interface Props { open: boolean; onClose: () => void; }

const PRESET_COLORS = ["hsl(160, 84%, 39%)", "hsl(239, 84%, 67%)", "hsl(340, 82%, 52%)", "hsl(38, 92%, 50%)", "hsl(280, 80%, 50%)"];

export default function GoalAddSheet({ open, onClose }: Props) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const { addGoal } = useDataStore();

  const handleSave = async () => {
    if (!name.trim() || !amount) return;
    setSaving(true);
    
    const { error } = await addGoal({
      name: name.trim(),
      target_amount: parseFloat(amount),
      deadline: deadline || undefined,
      color,
      icon: 'target'
    });
    
    setSaving(false);
    if (error) toast.error("Failed to track goal");
    else {
      toast.success(`${name} goal tracking started!`);
      setName(""); setAmount(""); setDeadline(""); onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-foreground/30"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl max-w-lg mx-auto will-change-transform pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            <div className="flex items-center justify-between px-5 pb-5">
              <h3 className="text-base font-bold text-foreground">Create Savings Goal</h3>
              <button onClick={onClose} className="p-1.5 rounded-xl bg-muted text-muted-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Goal Name</label>
                <div className="relative">
                  <Target className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="e.g. Dream Laptop, Japan Trip"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-muted rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground font-semibold outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Target Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-sm font-bold text-muted-foreground">₹</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-muted rounded-xl pl-8 pr-4 py-3 text-sm text-foreground font-semibold outline-none focus:ring-2 focus:ring-primary/20 tabular-nums"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Target Deadline (Optional)</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground font-semibold outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      color === c ? "ring-2 ring-offset-2 ring-offset-card ring-foreground scale-110" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="px-5 pt-6 pb-5">
              <button
                onClick={handleSave}
                disabled={!name.trim() || !amount || saving}
                className="w-full py-4 rounded-2xl font-bold text-sm text-primary-foreground disabled:opacity-30 transition-all duration-200 active:scale-[0.98]"
                style={{ backgroundColor: color }}
              >
                {saving ? "Creating..." : "Set Goal"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
