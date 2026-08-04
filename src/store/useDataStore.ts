import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { validateTransaction, round2 } from '@/lib/finance';
import { monthKey } from '@/lib/date';

export interface Wallet {
  id: string;
  user_id: string;
  name: string;
  type: 'cash' | 'bank' | 'credit' | 'e_wallet';
  balance: number;
  color: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  billing_cycle: 'monthly' | 'yearly' | 'weekly';
  next_billing_date: string;
  category_id?: string;
  wallet_id?: string;
  color: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string;
  color: string;
  icon: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: 'income' | 'expense' | 'transfer';
}

export interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category_id: string;
  wallet_id?: string | null;
  to_wallet_id?: string | null;
  note: string | null;
  date: string;
  receipt_url?: string | null;
  categories?: Partial<Category>;
  wallets?: Partial<Wallet>;
}

export interface Budget {
  id: string;
  category_id: string;
  limit_amount: number;
  month: string;
  categories?: Partial<Category>;
}

interface DataState {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  wallets: Wallet[];
  subscriptions: Subscription[];
  goals: Goal[];
  loading: boolean;

  // Actions
  /** Re-reads everything a transaction change can affect, in parallel. */
  refreshAll: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchBudgets: (month: string) => Promise<void>;
  fetchWallets: () => Promise<void>;
  fetchSubscriptions: () => Promise<void>;
  fetchGoals: () => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'categories' | 'wallets'>) => Promise<{ error: Error | null }>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<{ error: Error | null }>;
  deleteTransaction: (id: string) => Promise<{ error: Error | null }>;
  upsertBudget: (budget: Omit<Budget, 'id' | 'categories'>) => Promise<{ error: Error | null }>;
  addWallet: (wallet: Omit<Wallet, 'id' | 'user_id'>) => Promise<{ error: Error | null }>;
  addSubscription: (sub: Omit<Subscription, 'id' | 'user_id'>) => Promise<{ error: Error | null }>;
  addGoal: (goal: Omit<Goal, 'id' | 'user_id' | 'current_amount'>) => Promise<{ error: Error | null }>;
  updateGoalAmount: (id: string, amount: number) => Promise<{ error: Error | null }>;
}

export const useDataStore = create<DataState>((set, get) => ({
  transactions: [],
  categories: [],
  budgets: [],
  wallets: [],
  subscriptions: [],
  goals: [],
  loading: false,

  refreshAll: async () => {
    await Promise.all([
      get().fetchTransactions(),
      get().fetchWallets(),
      get().fetchBudgets(monthKey()),
    ]);
  },

  fetchTransactions: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          categories (name, icon, color),
          wallets!wallet_id (name, color),
          to_wallet:wallets!to_wallet_id (name, color)
        `)
        .order('date', { ascending: false });

      if (error) throw error;
      set({ transactions: data || [] });
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      set({ loading: false });
    }
  },

  fetchCategories: async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      set({ categories: data || [] });
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  },
  fetchBudgets: async (month) => {
    try {
      const { data, error } = await supabase
        .from('budgets')
        .select(`
          *,
          categories(name, icon, color)
        `)
        .eq('month', month);

      if (error) throw error;
      set({ budgets: data || [] });
    } catch (error) {
      console.error('Error fetching budgets:', error);
    }
  },

  fetchWallets: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // No auto-creation — only show real wallets the user has added
      set({ wallets: data || [] });
    } catch (error) {
      console.error('Error fetching wallets:', error);
    }
  },

  fetchSubscriptions: async () => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .order('next_billing_date', { ascending: true });

      if (error) throw error;
      set({ subscriptions: data || [] });
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    }
  },

  fetchGoals: async () => {
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ goals: data || [] });
    } catch (error) {
      console.error('Error fetching goals:', error);
    }
  },

  addTransaction: async (transaction) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // ── Validate BEFORE writing anything ──
      // This used to run *after* the insert, so a failed check (e.g. insufficient
      // balance) left an orphaned transaction row in the database while the
      // caller was told the save had failed.
      const amount = round2(parseFloat(String(transaction.amount)));
      const validation = validateTransaction({
        amount,
        type: transaction.type,
        wallet_id: transaction.wallet_id,
        to_wallet_id: transaction.to_wallet_id,
        walletBalance: get().wallets.find(w => w.id === transaction.wallet_id)?.balance,
      });
      if (!validation.valid) throw new Error(validation.error);

      // Build insert payload — omit null/undefined optional fields to avoid DB constraint issues
      const payload: Record<string, string | number | null> = {
        user_id: user.id,
        amount,
        type: transaction.type,
        date: transaction.date,
      };
      if (transaction.category_id) payload.category_id = transaction.category_id;
      if (transaction.wallet_id) payload.wallet_id = transaction.wallet_id;
      if (transaction.to_wallet_id) payload.to_wallet_id = transaction.to_wallet_id;
      if (transaction.note) payload.note = transaction.note;
      if (transaction.receipt_url) payload.receipt_url = transaction.receipt_url;

      // Wallet balances are maintained by a database trigger
      // (0002_wallet_balance_integrity.sql), in the same transaction as this
      // insert. The client deliberately no longer computes them: doing it here
      // was neither atomic nor safe against concurrent writes.
      const { error } = await supabase.from('transactions').insert(payload);
      if (error) throw error;

      await get().refreshAll();
      return { error: null };
    } catch (error) {
      console.error('Error adding transaction:', error);
      return { error };
    }
  },

  updateTransaction: async (id, updates) => {
    try {
      // The balance trigger reverses the old row and applies the new one, so
      // edits to amount/type/wallet stay consistent — previously an edit drifted
      // the wallet balance by the difference, permanently.
      const { error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await get().refreshAll();
      return { error: null };
    } catch (error) {
      console.error('Error updating transaction:', error);
      return { error };
    }
  },

  deleteTransaction: async (id) => {
    try {
      // The trigger reverses this row's balance effect. Before, deleting a
      // transaction left the wallet permanently debited.
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await get().refreshAll();
      return { error: null };
    } catch (error) {
      console.error('Error deleting transaction:', error);
      return { error };
    }
  },

  upsertBudget: async (budget) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Check if a budget already exists for this category and month.
      // maybeSingle(), not single(): single() treats "no rows" as an error
      // (PGRST116) and returns a 406, which was being silently swallowed.
      const { data: existing, error: lookupError } = await supabase
        .from('budgets')
        .select('id')
        .eq('user_id', user.id)
        .eq('category_id', budget.category_id)
        .eq('month', budget.month)
        .maybeSingle();

      if (lookupError) throw lookupError;

      let error;
      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('budgets')
          .update({ limit_amount: budget.limit_amount })
          .eq('id', existing.id);
        error = updateError;
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('budgets')
          .insert({ ...budget, user_id: user.id });
        error = insertError;
      }

      if (!error) {
        get().fetchBudgets(budget.month);
      }
      return { error };
    } catch (error) {
      console.error('Error upserting budget:', error);
      return { error };
    }
  },

  addWallet: async (wallet) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from('wallets')
        .insert({ ...wallet, user_id: user.id });

      if (!error) {
        get().fetchWallets();
      }
      return { error };
    } catch (error) {
      console.error('Error adding wallet:', error);
      return { error };
    }
  },

  addSubscription: async (sub) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from('subscriptions')
        .insert({ ...sub, user_id: user.id });

      if (!error) {
        get().fetchSubscriptions();
      }
      return { error };
    } catch (error) {
      console.error('Error adding subscription:', error);
      return { error };
    }
  },

  addGoal: async (goal) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from('goals')
        .insert({ ...goal, user_id: user.id, current_amount: 0 });

      if (!error) get().fetchGoals();
      return { error };
    } catch (error) {
      console.error('Error adding goal:', error);
      return { error };
    }
  },

  updateGoalAmount: async (id, amountToAdd) => {
    try {
      // Atomic server-side increment. Reading current_amount from the store and
      // writing back the sum lost contributions whenever two happened close
      // together, or the store was stale.
      const { error } = await supabase.rpc('increment_goal_amount', {
        p_goal_id: id,
        p_delta: round2(amountToAdd),
      });

      if (error) throw error;
      await get().fetchGoals();
      return { error: null };
    } catch (error) {
      console.error('Error updating goal:', error);
      return { error };
    }
  }
}));
