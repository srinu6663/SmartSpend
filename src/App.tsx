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
import { useAuthStore } from "@/store/useAuthStore";
import { useDataStore } from "@/store/useDataStore";

const queryClient = new QueryClient();

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
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

  const hydrateData = () => {
    fetchTransactions();
    fetchCategories();
    fetchWallets();
    const d = new Date();
    fetchBudgets(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
  };

  useEffect(() => {
    if (session && !initialized.current) {
      initialized.current = true;
      hydrateData();
    } else if (!session) {
      initialized.current = false;
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
