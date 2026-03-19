import { useState, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

const slides = [
  {
    id: 0,
    emoji: "💸",
    emojiAlt: ["💳", "🏦"],
    title: "Track Every Rupee",
    subtitle: "Your Money, Accounted For",
    description: "Log income and expenses in seconds. Know exactly where every rupee goes — all in one beautifully simple app.",
    gradient: ["#4F46E5", "#7C3AED"],
    particleColor: "#818cf8",
    bg: "linear-gradient(160deg, #1e1b4b 0%, #312e81 60%, #4c1d95 100%)",
    features: ["Multiple Wallets", "Smart Categories", "Receipt Scanning"],
  },
  {
    id: 1,
    emoji: "🤖",
    emojiAlt: ["📊", "💡"],
    title: "AI-Powered Insights",
    subtitle: "Your Personal Finance Advisor",
    description: "Gemini AI analyzes your spending patterns and gives you personalized tips to save more and spend smarter.",
    gradient: ["#059669", "#0D9488"],
    particleColor: "#34d399",
    bg: "linear-gradient(160deg, #022c22 0%, #064e3b 60%, #065f46 100%)",
    features: ["Gemini AI Analysis", "Spending Trends", "Smart Budgets"],
  },
  {
    id: 2,
    emoji: "🎯",
    emojiAlt: ["📈", "🏆"],
    title: "Goals & Budgets",
    subtitle: "Plan. Save. Achieve.",
    description: "Set savings goals, control spending with budgets, and celebrate every milestone on your way to financial freedom.",
    gradient: ["#D97706", "#EA580C"],
    particleColor: "#fbbf24",
    bg: "linear-gradient(160deg, #451a03 0%, #78350f 60%, #92400e 100%)",
    features: ["Savings Goals", "Budget Alerts", "Monthly Reports"],
  },
  {
    id: 3,
    emoji: "🔔",
    emojiAlt: ["📧", "🔐"],
    title: "Stay In the Loop",
    subtitle: "Always Notified, Always Secure",
    description: "Get push notifications for budget alerts, bill reminders, and goal milestones. Your data is protected with end-to-end encryption.",
    gradient: ["#DB2777", "#9333EA"],
    particleColor: "#f472b6",
    bg: "linear-gradient(160deg, #4a044e 0%, #701a75 60%, #7e22ce 100%)",
    features: ["Push Notifications", "Welcome Emails", "Cloud Sync"],
  },
];

// Mini floating orb
const Orb = ({ x, y, size, delay, color }: { x: number; y: number; size: number; delay: number; color: string }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none opacity-20"
    style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, backgroundColor: color }}
    animate={{ y: [-12, 12, -12], x: [-6, 6, -6], scale: [0.9, 1.1, 0.9] }}
    transition={{ duration: 3 + delay, repeat: Infinity, delay, ease: "easeInOut" }}
  />
);

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const constraintsRef = useRef(null);
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-100, 0, 100], [0.3, 1, 0.3]);

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

  const goPrev = () => {
    if (step > 0) setStep(s => s - 1);
  };

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x < -60 && !isLast) setStep(s => s + 1);
    if (info.offset.x > 60 && step > 0) setStep(s => s - 1);
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        className="min-h-screen flex flex-col relative overflow-hidden"
        style={{ background: current.bg }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Background orbs */}
        <Orb x={10} y={15} size={80} delay={0} color={current.particleColor} />
        <Orb x={80} y={12} size={120} delay={1} color={current.particleColor} />
        <Orb x={5} y={70} size={60} delay={0.5} color={current.particleColor} />
        <Orb x={85} y={75} size={90} delay={1.5} color={current.particleColor} />
        <Orb x={50} y={50} size={200} delay={0.8} color={current.particleColor} />

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-[env(safe-area-inset-top)] pt-12 z-10">
          {/* Logo + name */}
          <div className="flex items-center gap-2.5">
            <img src="/icons/icon-192.png" alt="SmartSpend" className="w-8 h-8 rounded-xl" />
            <span className="text-sm font-black text-white/90 tracking-tight">SmartSpend</span>
          </div>
          
          {!isLast && (
            <button
              onClick={() => {
                localStorage.setItem("hasCompletedOnboarding", "true");
                navigate("/auth", { replace: true });
              }}
              className="text-xs font-bold text-white/50 bg-white/10 px-4 py-1.5 rounded-full"
            >
              Skip
            </button>
          )}
        </div>

        {/* Main illustration area */}
        <motion.div
          ref={constraintsRef}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
          style={{ x, opacity }}
          className="flex-1 flex flex-col items-center justify-center px-6 pb-6 cursor-grab active:cursor-grabbing z-10"
        >
          {/* Central emoji card */}
          <motion.div
            initial={{ scale: 0.5, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative mb-8 select-none"
          >
            {/* Floating secondary emojis */}
            {current.emojiAlt.map((e, i) => (
              <motion.span
                key={i}
                className="absolute text-3xl"
                style={{ 
                  [i === 0 ? "left" : "right"]: "-48px",
                  top: i === 0 ? "0px" : "30px"
                }}
                animate={{ y: [-6, 6, -6], rotate: [-8, 8, -8] }}
                transition={{ duration: 2.5 + i, repeat: Infinity, delay: i * 0.4 }}
              >
                {e}
              </motion.span>
            ))}

            {/* Main card */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-36 h-36 rounded-[2.5rem] flex items-center justify-center shadow-2xl relative"
              style={{ background: `linear-gradient(135deg, ${current.gradient[0]}, ${current.gradient[1]})` }}
            >
              {/* Glow */}
              <div
                className="absolute inset-0 rounded-[2.5rem] blur-2xl opacity-40 scale-110"
                style={{ backgroundColor: current.gradient[0] }}
              />
              {/* Shine */}
              <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/25 blur-sm" />
              <span className="text-6xl relative z-10 select-none">{current.emoji}</span>
            </motion.div>
          </motion.div>

          {/* Text content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-center mb-8"
          >
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/50 mb-2 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3 h-3" />{current.subtitle}
            </p>
            <h1 className="text-3xl font-black text-white tracking-tight mb-3 leading-tight">
              {current.title}
            </h1>
            <p className="text-[15px] text-white/65 leading-relaxed max-w-[300px] mx-auto">
              {current.description}
            </p>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="flex flex-wrap gap-2 justify-center"
          >
            {current.features.map((f, i) => (
              <motion.span
                key={f}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="px-3 py-1.5 rounded-full text-xs font-bold text-white/80 border border-white/20 bg-white/10 backdrop-blur-sm"
              >
                {f}
              </motion.span>
            ))}
          </motion.div>
        </motion.div>

        {/* Bottom controls */}
        <div className="px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] z-10">
          {/* Swipe hint */}
          {step === 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.6, 0] }}
              transition={{ delay: 2, duration: 2, repeat: 2 }}
              className="text-center text-xs text-white/40 mb-4 font-medium"
            >
              Swipe to explore →
            </motion.p>
          )}

          {/* Step dots */}
          <div className="flex justify-center gap-2 mb-6">
            {slides.map((_, i) => (
              <button key={i} onClick={() => setStep(i)}>
                <motion.div
                  animate={{
                    width: i === step ? 24 : 6,
                    opacity: i === step ? 1 : 0.35,
                  }}
                  transition={{ duration: 0.25 }}
                  className="h-1.5 rounded-full bg-white"
                />
              </button>
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-3">
            {step > 0 && (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={goPrev}
                className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center active:scale-95 transition-transform"
              >
                <ArrowRight className="w-5 h-5 text-white rotate-180" />
              </motion.button>
            )}

            <motion.button
              onClick={goNext}
              whileTap={{ scale: 0.97 }}
              className="flex-1 h-14 rounded-2xl font-black text-[15px] flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${current.gradient[0]}, ${current.gradient[1]})` }}
            >
              {/* Shine sweep */}
              <motion.div
                className="absolute inset-0 bg-white/20"
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                style={{ transform: "skewX(-20deg)" }}
              />
              <span className="text-white relative z-10">
                {isLast ? "Get Started 🚀" : "Continue"}
              </span>
              {!isLast && <ArrowRight className="w-5 h-5 text-white relative z-10" />}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Onboarding;
