import { create } from 'zustand';
import {
  supabase,
  supabaseConfigError,
  probeBackend,
  clearStoredSession,
  isNetworkError,
  type BackendStatus,
} from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';

/** Auth bootstrap must never outlive this, or the app shows a spinner forever. */
const INIT_TIMEOUT_MS = 12_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DOMException(`${label} timed out after ${ms}ms`, 'TimeoutError')), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Non-null when auth bootstrap failed for a reason the user should see. */
  authError: string | null;
  authErrorDetail: string | null;
  backendStatus: BackendStatus | 'unknown';
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  initializeAuth: () => Promise<void>;
  retryInit: () => Promise<void>;
  signOut: () => Promise<void>;
}

let unsubscribe: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  authError: null,
  authErrorDetail: null,
  backendStatus: 'unknown',
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),

  initializeAuth: async () => {
    if (supabaseConfigError) {
      set({
        loading: false,
        backendStatus: 'misconfigured',
        authError: 'Supabase is not configured.',
        authErrorDetail: supabaseConfigError,
      });
      return;
    }

    // Subscribe before reading the session so nothing that fires during
    // bootstrap is missed, and re-init never stacks duplicate listeners.
    if (!unsubscribe) {
      const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
        set({
          session: newSession,
          user: newSession?.user ?? null,
          loading: false,
          ...(newSession ? { authError: null, authErrorDetail: null, backendStatus: 'ok' as const } : {}),
        });

        if (event === 'TOKEN_REFRESHED') set({ backendStatus: 'ok' });

        // Send welcome email on new signup
        if (event === 'SIGNED_IN' && newSession?.user) {
          const u = newSession.user;
          const isNew = u.created_at && (Date.now() - new Date(u.created_at).getTime()) < 60000;
          if (isNew) {
            const name = u.user_metadata?.full_name?.split(' ')[0] || '';
            supabase.functions
              .invoke('send-welcome-email', { body: { email: u.email, name } })
              .catch(console.warn); // fire and forget
          }
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    }

    try {
      const { data: { session }, error } = await withTimeout(
        supabase.auth.getSession(),
        INIT_TIMEOUT_MS,
        'getSession'
      );

      if (error) throw error;

      set({
        session,
        user: session?.user ?? null,
        loading: false,
        authError: null,
        authErrorDetail: null,
        backendStatus: 'ok',
      });
    } catch (error) {
      console.error('Error initializing auth:', error);

      // A stored token we can neither use nor refresh: drop it so the user gets
      // the login screen once the backend is back, rather than a stuck retry loop.
      if (!isNetworkError(error)) clearStoredSession();

      const probe = await probeBackend();
      set({
        session: null,
        user: null,
        loading: false,
        backendStatus: probe.status,
        authError: probe.status === 'ok' ? null : probe.message,
        authErrorDetail: probe.detail ?? (error instanceof Error ? error.message : String(error)),
      });
    }
  },

  retryInit: async () => {
    set({ loading: true, authError: null, authErrorDetail: null });
    await get().initializeAuth();
  },

  signOut: async () => {
    set({ loading: true });
    try {
      await withTimeout(supabase.auth.signOut(), INIT_TIMEOUT_MS, 'signOut');
    } catch (error) {
      console.error('Error signing out:', error);
      clearStoredSession(); // sign out locally even if the server is unreachable
    } finally {
      set({ user: null, session: null, loading: false });
    }
  },
}));
