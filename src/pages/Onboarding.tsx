import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Wallet, PieChart, ShieldCheck, ArrowRight } from "lucide-react";

const onboardingSteps = [
  {
    icon: Wallet,
    title: "Track Every Rupee",
    description: "Effortlessly log your income and expenses in real-time. Know exactly where your money goes.",
    color: "from-blue-500 to-indigo-600",
  },
  {
    icon: PieChart,
    title: "Smart Insights",
    description: "Visualize your spending habits with clean charts and receive actionable insights to save more.",
    color: "from-emerald-400 to-teal-600",
  },
  {
    icon: ShieldCheck,
    title: "Secure & Synced",
    description: "Your data is securely stored in the cloud and synced across all your devices instantly.",
    color: "from-purple-500 to-pink-600",
  }
];

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (step < onboardingSteps.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem("hasCompletedOnboarding", "true");
      navigate("/auth", { replace: true });
    }
  };

  const handleSkip = () => {
    localStorage.setItem("hasCompletedOnboarding", "true");
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pt-[env(safe-area-inset-top)] relative">
      <div className="flex justify-end p-4">
        {step < onboardingSteps.length - 1 && (
          <button 
            onClick={handleSkip}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
          >
            Skip
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 pb-24">
        <div className="relative h-[280px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className="absolute inset-0 flex flex-col items-center justify-center text-center"
            >
              <div className={`w-32 h-32 rounded-[2rem] bg-gradient-to-br ${onboardingSteps[step].color} shadow-2xl shadow-primary/20 flex items-center justify-center mb-8 transform rotate-3`}>
                <div className="w-full h-full absolute inset-0 rounded-[2rem] bg-white/20 blur-sm transform -rotate-6 transition-transform" />
                {(() => {
                  const Icon = onboardingSteps[step].icon;
                  return <Icon className="w-16 h-16 text-white relative z-10" strokeWidth={1.5} />;
                })()}
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground mb-3">
                {onboardingSteps[step].title}
              </h1>
              <p className="text-[15px] leading-relaxed text-muted-foreground max-w-[280px] mx-auto">
                {onboardingSteps[step].description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-background via-background to-transparent pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex flex-col items-center gap-6">
          <div className="flex gap-2.5">
            {onboardingSteps.map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                }`} 
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-[15px] shadow-card flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            {step === onboardingSteps.length - 1 ? (
              <span>Get Started</span>
            ) : (
              <span>Continue</span>
            )}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
