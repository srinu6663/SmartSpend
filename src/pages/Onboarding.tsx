import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Wallet, BarChart3, Target, Bell } from "lucide-react";

const slides = [
  {
    Icon: Wallet,
    iconBg: "#4F46E5",
    accentColor: "#818cf8",
    tag: "Multi-Wallet Support",
    title: "All Your Money,\nOne Place",
    description: "Connect your bank accounts, credit cards, and cash wallets. Get a complete picture of your finances in real time.",
    bullets: ["Multiple wallets & accounts", "Income & expense tracking", "AI receipt scanning"],
  },
  {
    Icon: BarChart3,
    iconBg: "#059669",
    accentColor: "#34d399",
    tag: "AI-Powered Analysis",
    title: "Know Where\nEvery Rupee Goes",
    description: "Smart insights powered by Google Gemini analyse your habits and suggest ways to spend smarter every month.",
    bullets: ["Gemini AI insights", "Category breakdowns", "Monthly trend reports"],
  },
  {
    Icon: Target,
    iconBg: "#D97706",
    accentColor: "#fbbf24",
    tag: "Budgets & Goals",
    title: "Build Your\nFinancial Future",
    description: "Set monthly budgets, track savings goals, and get instant alerts before you overspend — stay in control always.",
    bullets: ["Budget limit alerts", "Savings goal tracker", "CSV data export"],
  },
  {
    Icon: Bell,
    iconBg: "#7C3AED",
    accentColor: "#c084fc",
    tag: "Smart Notifications",
    title: "Never Miss\nWhat Matters",
    description: "Receive real-time push notifications for budget alerts, bill reminders, and goal milestones on your phone.",
    bullets: ["Push notifications", "Welcome & monthly emails", "End-to-end encryption"],
  },
];

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const startX = useRef<number | null>(null);
  const current = slides[step];
  const isLast = step === slides.length - 1;

  const goNext = () => {
    if (isLast) {
      localStorage.setItem("hasCompletedOnboarding", "true");
      navigate("/auth", { replace: true });
    } else {
      setStep(s => s + 1);
    }
  };

  const skip = () => {
    localStorage.setItem("hasCompletedOnboarding", "true");
    navigate("/auth", { replace: true });
  };

  // Touch swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (dx < -50 && !isLast) setStep(s => s + 1);
    if (dx > 50 && step > 0) setStep(s => s - 1);
    startX.current = null;
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-[#0F0F14] select-none overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-[max(env(safe-area-inset-top),28px)]">
        <div className="flex items-center gap-2.5">
          <img src="/icons/icon-192.png" alt="SmartSpend" className="w-7 h-7 rounded-[10px]" />
          <span className="text-[13px] font-black text-white/80">SmartSpend</span>
        </div>
        {!isLast && (
          <button onClick={skip} className="text-[13px] font-semibold text-white/40 py-1 px-3">
            Skip
          </button>
        )}
      </div>

      {/* Slide area */}
      <div className="flex-1 flex flex-col justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Icon card */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="mb-8"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: current.iconBg }}
              >
                <current.Icon className="w-8 h-8 text-white" strokeWidth={1.8} />
              </div>
            </motion.div>

            {/* Tag */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="inline-flex items-center mb-3"
            >
              <span
                className="text-[11px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-full"
                style={{ backgroundColor: `${current.accentColor}20`, color: current.accentColor }}
              >
                {current.tag}
              </span>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="text-[32px] font-black text-white leading-tight tracking-tight mb-4 whitespace-pre-line"
            >
              {current.title}
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="text-[15px] text-white/50 leading-relaxed mb-8 max-w-[320px]"
            >
              {current.description}
            </motion.p>

            {/* Bullet points */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="space-y-2.5"
            >
              {current.bullets.map((b, i) => (
                <motion.div
                  key={b}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.32 + i * 0.06 }}
                  className="flex items-center gap-3"
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${current.accentColor}25` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: current.accentColor }} />
                  </div>
                  <span className="text-[14px] font-medium text-white/70">{b}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="px-6 pb-[max(env(safe-area-inset-bottom),32px)]">
        {/* Step dots */}
        <div className="flex items-center gap-1.5 mb-6">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setStep(i)}>
              <motion.div
                animate={{ width: i === step ? 20 : 5, opacity: i === step ? 1 : 0.3 }}
                transition={{ duration: 0.2 }}
                className="h-[5px] rounded-full bg-white"
              />
            </button>
          ))}
        </div>

        {/* Buttons row */}
        <div className="flex gap-3">
          {step > 0 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setStep(s => s - 1)}
              className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center active:scale-95 transition-transform"
            >
              <ArrowRight className="w-5 h-5 text-white rotate-180" />
            </motion.button>
          )}

          <button
            onClick={goNext}
            className="flex-1 h-14 rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            style={{ backgroundColor: current.iconBg }}
          >
            {isLast ? "Get Started" : "Continue"}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
