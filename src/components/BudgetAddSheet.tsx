import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Target } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/store/useDataStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

const BudgetAddSheet = ({ open, onClose }: Props) => {
  const { categories, upsertBudget } = useDataStore();
  
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);

  // Auto-select first category if available
  useEffect(() => {
    if (open && categories.length > 0 && !categoryId) {
      const expenseCats = categories.filter(c => c.type === 'expense');
      if (expenseCats.length > 0) setCategoryId(expenseCats[0].id);
    }
  }, [open, categories, categoryId]);

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      toast.error("Enter a valid target amount");
      return;
    }
    if (!categoryId) {
      toast.error("Please select a category");
      return;
    }

    setSaving(true);
    const d = new Date();
    const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;

    const { error } = await upsertBudget({
      category_id: categoryId,
      limit_amount: numAmount,
      month: currentMonth
    });

    setSaving(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Budget set successfully!");
      setAmount("");
      onClose();
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
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-3xl shadow-2xl max-w-lg mx-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-base font-bold text-foreground">Set Budget Limit</h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-5 mb-6">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                    Monthly Limit (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="5000"
                      className="w-full h-12 bg-muted/50 border border-border/50 rounded-2xl pl-8 pr-4 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                    Category
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.filter(c => c.type === 'expense').map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setCategoryId(cat.id)}
                        className={`p-3 rounded-2xl border flex items-center gap-2 transition-all duration-200 ${
                          categoryId === cat.id
                            ? 'bg-card border-primary ring-1 ring-primary/20'
                            : 'bg-muted/30 border-border/50 hover:bg-muted'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${cat.color}15` }}
                        >
                          <Target className="w-3 h-3" style={{ color: cat.color! }} />
                        </div>
                        <span className={`text-xs font-semibold truncate ${categoryId === cat.id ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {cat.name}
                        </span>
                      </button>
                    ))}
                  </div>
                  {categories.filter(c => c.type === 'expense').length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      No expense categories found. You'll need one to set a budget!
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !amount || parseFloat(amount) <= 0 || !categoryId}
                className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-xl shadow-primary/25 disabled:opacity-50 disabled:shadow-none active:scale-[0.98] transition-all"
              >
                {saving ? "Saving..." : "Set Budget Limit"}
              </button>
            </div>
            <div className="h-[env(safe-area-inset-bottom)]" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BudgetAddSheet;
