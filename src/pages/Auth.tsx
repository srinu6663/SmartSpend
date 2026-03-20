import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Mail, Lock, User, Wallet, ArrowRight, Eye, EyeOff, KeyRound, Phone } from "lucide-react";

type AuthView = 'sign_in' | 'sign_up' | 'forgot_password' | 'verify_otp' | 'update_password';

export default function Auth() {
  const [view, setView] = useState<AuthView>('sign_in');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState(false);

  // Listen for password recovery links (if user clicks link instead of typing OTP)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('update_password');
        toast.info("Please enter your new password.");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (view === 'sign_in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            setAuthError(true);
          }
          throw error;
        }
        setAuthError(false);
        toast.success("Successfully logged in!");
      } 
      else if (view === 'sign_up') {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, phone: mobileNumber } },
        });
        if (error) throw error;
        
        if (data?.user?.identities?.length === 0) {
          toast.error("This email is already registered. Please log in.");
          setView('sign_in');
          return;
        }
        toast.success("Registration successful! Check email or log in directly if confirmation is disabled.");
        setView('sign_in');
      }
      else if (view === 'forgot_password') {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        toast.success("Password reset instructions sent! Please check your email.");
        setView('verify_otp');
      }
      else if (view === 'verify_otp') {
        const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'recovery' });
        if (error) throw error;
        toast.success("OTP Verified! Please enter your new password.");
        setView('update_password');
      }
      else if (view === 'update_password') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Password updated successfully! You can now log in.");
        setView('sign_in');
        setPassword("");
      }
    } catch (error: any) {
      if (error.message.includes('rate limit')) {
        toast.error("Rate limit hit! Wait 1 hour OR disable 'Confirm Email' in Supabase.");
      } else if (error.message.includes('Email not confirmed')) {
        toast.error("Account not confirmed! Check your email for the confirmation link.");
      } else {
        toast.error(error.message || "Authentication failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch(view) {
      case 'sign_in': return "Welcome back! Please login.";
      case 'sign_up': return "Create an account to get started.";
      case 'forgot_password': return "Reset your password.";
      case 'verify_otp': return "Enter the 6-digit code sent to your email.";
      case 'update_password': return "Set your new password.";
    }
  };

  const getButtonText = () => {
    switch(view) {
      case 'sign_in': return "Sign In";
      case 'sign_up': return "Create Account";
      case 'forgot_password': return "Send Reset Email";
      case 'verify_otp': return "Verify OTP";
      case 'update_password': return "Update Password";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-primary/10 p-4 rounded-full">
              <Wallet className="w-10 h-10 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold">SmartSpend</h1>
          <p className="text-muted-foreground">{getTitle()}</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          
          {/* Full Name & Phone - Only for Sign Up */}
          {view === 'sign_up' && (
            <div className="space-y-4">
              <div className="relative">
                <User className={`absolute left-3 top-3 h-5 w-5 ${authError ? 'text-destructive' : 'text-muted-foreground'}`} />
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setAuthError(false);
                  }}
                  className="flex h-11 w-full rounded-md border border-input bg-transparent px-10 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <input
                  type="tel"
                  placeholder="Mobile Number"
                  required
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  className="flex h-11 w-full rounded-md border border-input bg-transparent px-10 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
          )}

          {/* Email - For Sign In, Sign Up, Forgot Password */}
          {(view === 'sign_in' || view === 'sign_up' || view === 'forgot_password' || view === 'verify_otp') && (
            <div className="space-y-2">
              <div className="relative">
                <Mail className={`absolute left-3 top-3 h-5 w-5 ${authError ? 'text-destructive' : 'text-muted-foreground'}`} />
                <input
                  type="email"
                  placeholder="Email Address"
                  required
                  value={email}
                  disabled={view === 'verify_otp'}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setAuthError(false);
                  }}
                  className={`flex h-11 w-full rounded-md border bg-transparent px-10 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 transition-colors ${authError ? 'border-destructive ring-destructive focus-visible:ring-destructive' : 'border-input'}`}
                />
              </div>
            </div>
          )}

          {/* OTP Input - Only for Verify OTP */}
          {view === 'verify_otp' && (
            <div className="space-y-2">
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="6-Digit OTP Code"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="flex h-11 w-full rounded-md border border-input bg-transparent px-10 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring tracking-widest font-mono text-center"
                  maxLength={6}
                />
              </div>
            </div>
          )}

          {/* Password - For Sign In, Sign Up, Update Password */}
          {(view === 'sign_in' || view === 'sign_up' || view === 'update_password') && (
            <div className="space-y-2">
              <div className="relative">
                <Lock className={`absolute left-3 top-3 h-5 w-5 ${authError ? 'text-destructive' : 'text-muted-foreground'}`} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={view === 'update_password' ? "New Password" : "Password"}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setAuthError(false);
                  }}
                  className={`flex h-11 w-full rounded-md border bg-transparent px-10 pr-12 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring transition-colors ${authError ? 'border-destructive ring-destructive focus-visible:ring-destructive' : 'border-input'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Forgot Password Link */}
          {view === 'sign_in' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setView('forgot_password')}
                className="text-xs text-primary hover:underline font-medium"
              >
                Forgot Password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-4 py-2 disabled:opacity-50"
          >
            {loading ? "Please wait..." : (
              <>
                {getButtonText()}
                <ArrowRight className="ml-2 w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center text-sm space-y-2 flex flex-col items-center">
          {view === 'sign_in' && (
            <button onClick={() => setView('sign_up')} className="text-muted-foreground hover:text-foreground">
              Don't have an account? <span className="text-primary font-medium">Sign up</span>
            </button>
          )}
          {view === 'sign_up' && (
            <button onClick={() => setView('sign_in')} className="text-muted-foreground hover:text-foreground">
              Already have an account? <span className="text-primary font-medium">Log in</span>
            </button>
          )}
          {(view === 'forgot_password' || view === 'verify_otp' || view === 'update_password') && (
            <button onClick={() => setView('sign_in')} className="text-muted-foreground hover:text-foreground">
              Back to login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
