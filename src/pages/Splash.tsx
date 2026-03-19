import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/useAuthStore";

// Floating particle component
const Particle = ({ delay, x, y, size }: { delay: number; x: number; y: number; size: number }) => (
  <motion.div
    className="absolute rounded-full bg-white/20 pointer-events-none"
    style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }}
    animate={{
      y: [-20, 20, -20],
      x: [-8, 8, -8],
      opacity: [0.1, 0.5, 0.1],
      scale: [0.8, 1.2, 0.8],
    }}
    transition={{
      duration: 4 + delay,
      repeat: Infinity,
      delay,
      ease: "easeInOut",
    }}
  />
);

const PARTICLES = [
  { x: 10, y: 15, size: 6, delay: 0 },
  { x: 85, y: 10, size: 10, delay: 0.5 },
  { x: 20, y: 75, size: 8, delay: 1 },
  { x: 75, y: 80, size: 5, delay: 1.5 },
  { x: 50, y: 20, size: 7, delay: 0.8 },
  { x: 30, y: 50, size: 4, delay: 2 },
  { x: 90, y: 55, size: 9, delay: 0.3 },
  { x: 60, y: 90, size: 6, delay: 1.2 },
  { x: 5, y: 45, size: 5, delay: 1.8 },
  { x: 95, y: 30, size: 4, delay: 0.7 },
];

const Splash = () => {
  const navigate = useNavigate();
  const { session, loading } = useAuthStore();
  const [showTagline, setShowTagline] = useState(false);
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowTagline(true), 800);
    const t2 = setTimeout(() => setShowLoader(true), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      const hasOnboarded = localStorage.getItem("hasCompletedOnboarding");
      if (!hasOnboarded) {
        navigate("/onboarding", { replace: true });
      } else if (!session) {
        navigate("/auth", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }, 2600);
    return () => clearTimeout(timer);
  }, [loading, session, navigate]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #1e1b4b 0%, #312e81 30%, #4c1d95 70%, #2e1065 100%)" }}
    >
      {/* Radial glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-80 h-80 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, #818cf8 0%, transparent 70%)" }}
        />
      </div>

      {/* Floating particles */}
      {PARTICLES.map((p, i) => (
        <Particle key={i} {...p} />
      ))}

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Icon */}
        <motion.div
          initial={{ scale: 0, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 relative"
        >
          {/* Glow ring */}
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-[28px] blur-xl"
            style={{ backgroundColor: "#818cf8", margin: "-8px" }}
          />

          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="w-28 h-28 rounded-[28px] overflow-hidden shadow-2xl relative"
          >
            <img
              src="/icons/icon-192.png"
              alt="SmartSpend"
              className="w-full h-full object-cover"
            />
          </motion.div>
        </motion.div>

        {/* App name */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-4xl font-black tracking-tight text-white mb-2"
        >
          SmartSpend
        </motion.h1>

        {/* Tagline */}
        <AnimatePresence>
          {showTagline && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50"
            >
              Finance Simplified
            </motion.p>
          )}
        </AnimatePresence>

        {/* Loading bar */}
        <AnimatePresence>
          {showLoader && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-12 w-40 h-1 rounded-full overflow-hidden bg-white/15"
            >
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.6, ease: "easeInOut" }}
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #818cf8, #a78bfa, #c084fc)" }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom badge */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="absolute bottom-8 text-[11px] text-white/30 font-medium tracking-widest uppercase"
      >
        Built for India 🇮🇳
      </motion.p>
    </div>
  );
};

export default Splash;
