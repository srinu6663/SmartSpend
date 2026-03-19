import { motion } from "framer-motion";
import { useDataStore } from "@/store/useDataStore";

const WeeklyChart = () => {
  const { transactions } = useDataStore();
  
  // Create last 7 days data structure
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0(Sun) to 6(Sat)
  // Convert standard getDay (0=Sun) to our format (0=Mon, 6=Sun)
  const adjustedTodayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const weeklySpending = Array.from({ length: 7 }, (_, i) => {
    // Current iterations: from 6 days ago (i=0) up to today (i=6)
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const dtString = d.toISOString().split('T')[0];
    
    // Adjusted day index for mapping to the 'days' array
    let dayIndex = (adjustedTodayIdx - (6 - i)) % 7;
    if (dayIndex < 0) dayIndex += 7;
    
    // Sum expenses for this specific date
    const amount = transactions
      .filter(t => t.type === 'expense' && t.date === dtString)
      .reduce((sum, t) => sum + Number(t.amount), 0);
      
    return {
      day: days[dayIndex],
      amount,
      isToday: i === 6
    };
  });

  const maxAmount = Math.max(...weeklySpending.map((d) => d.amount), 1); // Avoid div by 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="px-4"
    >
      <div className="bg-card rounded-2xl shadow-card p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-foreground">Last 7 Days</h2>
          <span className="text-xs font-medium text-primary tabular-nums">
            ₹{weeklySpending.reduce((s, d) => s + d.amount, 0).toLocaleString()}
          </span>
        </div>

        <div className="flex items-end justify-between gap-2 h-[100px]">
          {weeklySpending.map((day, i) => {
            const height = (day.amount / maxAmount) * 100;

            return (
              <div key={`${day.day}-${i}`} className="flex flex-col items-center gap-2 flex-1">
                <motion.div
                  className="w-full max-w-[28px] rounded-lg relative overflow-hidden"
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(height, 8)}%` }} // minimum 8% strictly for styling base
                  transition={{ duration: 0.5, delay: i * 0.06, ease: [0.32, 0.72, 0, 1] }}
                >
                  <div
                    className={`absolute inset-0 rounded-lg ${
                      day.isToday
                        ? "bg-primary"
                        : "bg-primary/15"
                    }`}
                  />
                </motion.div>
                <span className={`text-[10px] font-medium ${day.isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {day.day}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default WeeklyChart;
