import { useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import BottomNav from "@/components/BottomNav";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Reports from "@/pages/Reports";
import Budgets from "@/pages/Budgets";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/NotFound";
import Auth from "@/pages/Auth";
import BackendErrorScreen from "@/components/BackendErrorScreen";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { startKeepAlive } from "@/lib/keepAlive";
import { useAuthStore } from "@/store/useAuthStore";
import { useDataStore } from "@/store/useDataStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading, authError } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Backend down: say so, instead of bouncing to /auth where every login attempt
  // would fail with an unexplained "Failed to fetch".
  if (!session && authError) {
    return <BackendErrorScreen />;
  }

  if (!session) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

import Splash from "@/pages/Splash";
import Onboarding from "@/pages/Onboarding";

const AppRoutes = () => {
  const { session } = useAuthStore();
  const location = useLocation();
  const hideNav = ["/auth", "/", "/onboarding"].includes(location.pathname);
  
  // Global data hydration
  const { fetchTransactions, fetchCategories, fetchWallets, fetchBudgets } = useDataStore();
  const initialized = useRef(false);

  const lastHydratedAt = useRef(0);
  /** Switching tabs fires `focus` AND `visibilitychange`; without this floor
   *  every switch triggered two full hydrations (8 requests instead of 4). */
  const HYDRATE_COOLDOWN_MS = 30_000;

  const hydrateData = (force = false) => {
    const now = Date.now();
    if (!force && now - lastHydratedAt.current < HYDRATE_COOLDOWN_MS) return;
    lastHydratedAt.current = now;

    fetchTransactions();
    fetchCategories();
    fetchWallets();
    const d = new Date();
    fetchBudgets(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
  };

  useEffect(() => {
    if (session && !initialized.current) {
      initialized.current = true;
      hydrateData(true);
    } else if (!session) {
      initialized.current = false;
      lastHydratedAt.current = 0;
    }

    // Auto-refresh data when user switches back to the app (Foreground/Focus)
    const handleFocus = () => {
      if (session) hydrateData();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") handleFocus();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [session, fetchTransactions, fetchCategories, fetchWallets, fetchBudgets]);

  return (
    <>
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/auth" element={session ? <Navigate to="/dashboard" replace /> : <Auth />} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/budgets" element={<ProtectedRoute><Budgets /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {session && !hideNav && <BottomNav />}
    </>
  );
};

const App = () => {
  const { initializeAuth } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Keep the free-tier project awake while the app is open. startKeepAlive is
  // idempotent and elects a single leader tab, so remounts, StrictMode double
  // effects and extra tabs cannot multiply the pinger.
  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
    return startKeepAlive({ url: SUPABASE_URL, apiKey: SUPABASE_ANON_KEY });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <div className="max-w-lg mx-auto relative min-h-screen bg-background text-foreground">
            <AppRoutes />
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
