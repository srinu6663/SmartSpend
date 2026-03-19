import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Wallet } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

const Splash = () => {
  const navigate = useNavigate();
  const { session, loading } = useAuthStore();

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
    }, 2000); // 2 seconds splash screen

    return () => clearTimeout(timer);
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/4 -left-12 w-48 h-48 bg-primary/20 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-1/4 -right-12 w-56 h-56 bg-accent/20 rounded-full blur-3xl opacity-50" />
      
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          duration: 0.8, 
          ease: [0.32, 0.72, 0, 1] 
        }}
        className="relative z-10 flex flex-col items-center"
      >
        <motion.div 
          animate={{ 
            y: [0, -10, 0],
          }}
          transition={{ 
            duration: 3, 
            repeat: Infinity,
            ease: "easeInOut" 
          }}
          className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-accent shadow-xl flex items-center justify-center mb-6 relative"
        >
          <div className="absolute inset-0 rounded-3xl bg-white/10 blur-[2px]" />
          <Wallet className="w-12 h-12 text-white relative z-10" strokeWidth={1.5} />
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-3xl font-extrabold tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70"
        >
          SmartSpend
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-sm font-medium text-muted-foreground mt-2 tracking-wide uppercase"
        >
          Finance Simplified
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Splash;
