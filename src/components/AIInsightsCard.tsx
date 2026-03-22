import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const AIInsightsCard = () => {
  const { transactions } = useDataStore();
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const generateInsights = useCallback(async () => {
    if (transactions.length < 3) return;
    setLoading(true);
    setError(false);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      // Build a compact transaction summary to send
      const recent = transactions.slice(0, 40);
      const summary = recent.map(t =>
        `${t.date}: ${t.type} ₹${t.amount} (${t.categories?.name || "Unknown"}) - ${t.note || ""}`
      ).join("\n");

      const totalExpense = recent.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const totalIncome = recent.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);

      const prompt = `You are a friendly personal finance AI for an Indian user. Analyze these transactions and give exactly 4 short, specific, actionable insights in bullet form. Each insight must be ONE sentence max, use ₹ for amounts, and be conversational. Don't use markdown formatting, no asterisks, no dashes at start.

Total income: ₹${Math.round(totalIncome)}
Total expenses: ₹${Math.round(totalExpense)}
Recent transactions:
${summary}

Return ONLY 4 insights, one per line, no numbering, no bullets.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const lines = text
        .split("\n")
        .map(l => l.replace(/^[\-\*\d\.\s]+/, "").trim())
        .filter(l => l.length > 10)
        .slice(0, 4);

      setInsights(lines);
      setActiveIndex(0);
    } catch (err) {
      console.error("Gemini insights error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [transactions]);

  const hasGenerated = useRef(false);
  useEffect(() => {
    if (transactions.length >= 3 && !hasGenerated.current) {
      hasGenerated.current = true;
      generateInsights();
    }
  }, [transactions, generateInsights]);

  // Auto-cycle through insights every 5s
  useEffect(() => {
    if (insights.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex(i => (i + 1) % insights.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [insights]);

  if (transactions.length < 3) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-4"
    >
      <div className="relative rounded-2xl overflow-hidden shadow-lg"
        style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 80%, #9333EA 100%)" }}
      >
        {/* Decorative orbs */}
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10 blur-xl" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/10 blur-xl" />

        <div className="relative z-10 p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-white/70">AI Insights</p>
                <p className="text-sm font-bold text-white leading-none">Powered by Gemini</p>
              </div>
            </div>
            <button
              onClick={generateInsights}
              disabled={loading}
              className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center active:scale-95 transition-transform"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-white ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-3 bg-white/20 rounded-full animate-pulse" style={{ width: `${60 + i * 10}%` }} />
              ))}
              <p className="text-xs text-white/60 mt-2">Analyzing your spending...</p>
            </div>
          ) : error ? (
            <p className="text-sm text-white/80">Could not load insights. Tap refresh to try again.</p>
          ) : insights.length > 0 ? (
            <>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="mb-4"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                      {insights[activeIndex]?.includes("more") || insights[activeIndex]?.includes("increase") || insights[activeIndex]?.includes("overspent")
                        ? <TrendingUp className="w-3 h-3 text-white" />
                        : <TrendingDown className="w-3 h-3 text-white" />
                      }
                    </div>
                    <p className="text-sm font-medium text-white leading-relaxed">{insights[activeIndex]}</p>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Pagination dots */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  {insights.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveIndex(i)}
                      className={`transition-all duration-200 rounded-full ${
                        i === activeIndex ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setActiveIndex(i => (i + 1) % insights.length)}
                  className="flex items-center gap-1 text-[10px] font-bold text-white/70"
                >
                  Next <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
};

export default AIInsightsCard;
