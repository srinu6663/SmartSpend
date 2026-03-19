import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Target, CheckCircle2 } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import GoalAddSheet from "./GoalAddSheet";
import { toast } from "sonner";

export default function GoalsList() {
  const { goals, fetchGoals, updateGoalAmount } = useDataStore();
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleContribute = async (id: string, amount: number) => {
    const { error } = await updateGoalAmount(id, amount);
    if (error) toast.error("Failed to add funds");
    else toast.success("Funds added to goal!");
  };

  return (
    <>
      <div className="bg-card rounded-2xl shadow-card p-5 mb-6 overflow-hidden relative border border-border/40">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Savings Goals
          </h3>
          <button 
            onClick={() => setAddOpen(true)}
            className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center transition-colors active:bg-primary/20"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {goals.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">No active goals. Start saving today!</p>
        ) : (
          <div className="space-y-5">
            {goals.map((goal, i) => {
              const pct = Math.min(Math.round((goal.current_amount / goal.target_amount) * 100), 100);
              const isCompleted = pct >= 100;
              return (
              <motion.div key={goal.id} initial={{opacity:0, y:5}} animate={{opacity:1, y:0}} transition={{delay: i*0.1}}>
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{goal.name}</p>
                    <p className="text-[11px] font-medium text-muted-foreground mt-0.5">₹{goal.current_amount.toLocaleString()} / ₹{goal.target_amount.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-success mb-1 ml-auto" />
                    ) : (
                      <button onClick={() => handleContribute(goal.id, 1000)} className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1.5 rounded-lg active:scale-95 transition-transform">
                        + ₹1,000
                      </button>
                    )}
                  </div>
                </div>
                <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: isCompleted ? 'hsl(160, 84%, 39%)' : goal.color }}
                  />
                </div>
              </motion.div>
            )})}
          </div>
        )}
      </div>
      <GoalAddSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
