import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/useAuthStore";

const Splash = () => {
  const navigate = useNavigate();
  const { session, loading } = useAuthStore();
  const [phase, setPhase] = useState<"logo" | "tagline" | "loading">("logo");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("tagline"), 700);
    const t2 = setTimeout(() => setPhase("loading"), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      // Always show onboarding on every app open
      navigate("/onboarding", { replace: true });
    }, 2800);
    return () => clearTimeout(timer);
  }, [loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#0F0F14]">
      {/* Subtle radial background */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(79,70,229,0.15) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center">
        {/* Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-7"
        >
          <div className="w-20 h-20 rounded-[22px] overflow-hidden shadow-xl">
            <img src="/icons/icon-192.png" alt="SmartSpend" className="w-full h-full object-cover" />
          </div>
        </motion.div>

        {/* Brand name */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.45 }}
          className="text-[26px] font-black text-white tracking-tight"
        >
          SmartSpend
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: phase !== "logo" ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className="text-[13px] font-medium text-white/40 mt-1.5 tracking-wide"
        >
          Personal Finance, Simplified
        </motion.p>

        {/* Loading bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === "loading" ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className="mt-12 w-32 h-[3px] rounded-full bg-white/10 overflow-hidden"
        >
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity }}
            className="w-full h-full rounded-full"
            style={{ background: "linear-gradient(90deg, transparent, #6366f1, transparent)" }}
          />
        </motion.div>
      </div>

      {/* Version */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-8 text-[11px] text-white/20 font-medium"
      >
        Version 1.0.0
      </motion.p>
    </div>
  );
};

export default Splash;
