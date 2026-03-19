import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  initializeAuth: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  
  initializeAuth: async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      set({ 
        session, 
        user: session?.user || null,
        loading: false 
      });

      // Set up auth state listener
      supabase.auth.onAuthStateChange(async (_event, newSession) => {
        set({ 
          session: newSession, 
          user: newSession?.user || null 
        });

        // Send welcome email on new signup
        if (_event === 'SIGNED_IN' && newSession?.user) {
          const u = newSession.user;
          const isNew = u.created_at && (Date.now() - new Date(u.created_at).getTime()) < 60000;
          if (isNew) {
            const name = u.user_metadata?.full_name?.split(' ')[0] || '';
            supabase.functions.invoke('send-welcome-email', {
              body: { email: u.email, name }
            }).catch(console.warn); // fire and forget
          }
        }
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ loading: false });
    }
  },

  signOut: async () => {
    set({ loading: true });
    try {
      await supabase.auth.signOut();
      set({ user: null, session: null });
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      set({ loading: false });
    }
  }
}));
