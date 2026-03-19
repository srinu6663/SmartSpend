import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

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
  fetchTransactions: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchBudgets: (month: string) => Promise<void>;
  fetchWallets: () => Promise<void>;
  fetchSubscriptions: () => Promise<void>;
  fetchGoals: () => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'categories' | 'wallets'>) => Promise<{error: any}>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<{error: any}>;
  deleteTransaction: (id: string) => Promise<{error: any}>;
  upsertBudget: (budget: Omit<Budget, 'id' | 'categories'>) => Promise<{error: any}>;
  addWallet: (wallet: Omit<Wallet, 'id' | 'user_id'>) => Promise<{error: any}>;
  addSubscription: (sub: Omit<Subscription, 'id' | 'user_id'>) => Promise<{error: any}>;
  addGoal: (goal: Omit<Goal, 'id' | 'user_id' | 'current_amount'>) => Promise<{error: any}>;
  updateGoalAmount: (id: string, amount: number) => Promise<{error: any}>;
}

export const useDataStore = create<DataState>((set, get) => ({
  transactions: [],
  categories: [],
  budgets: [],
  wallets: [],
  subscriptions: [],
  goals: [],
  loading: false,

  fetchTransactions: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          categories(name, icon, color),
          wallets(name, color)
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
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;

      // Auto-seed default categories if none exist
      if (!data || data.length === 0) {
        const defaults = [
          // Expense
          { name: 'Food & Dining', icon: '🍽️', color: '#F97316', type: 'expense' },
          { name: 'Transport', icon: '🚗', color: '#3B82F6', type: 'expense' },
          { name: 'Shopping', icon: '🛍️', color: '#EC4899', type: 'expense' },
          { name: 'Entertainment', icon: '🎬', color: '#8B5CF6', type: 'expense' },
          { name: 'Health', icon: '💊', color: '#EF4444', type: 'expense' },
          { name: 'Education', icon: '📚', color: '#06B6D4', type: 'expense' },
          { name: 'Utilities', icon: '💡', color: '#F59E0B', type: 'expense' },
          { name: 'Rent', icon: '🏠', color: '#10B981', type: 'expense' },
          { name: 'Groceries', icon: '🛒', color: '#84CC16', type: 'expense' },
          { name: 'Personal Care', icon: '💅', color: '#F472B6', type: 'expense' },
          { name: 'Other', icon: '📦', color: '#6B7280', type: 'expense' },
          // Income
          { name: 'Salary', icon: '💼', color: '#10B981', type: 'income' },
          { name: 'Freelance', icon: '💻', color: '#6366F1', type: 'income' },
          { name: 'Business', icon: '🏢', color: '#F59E0B', type: 'income' },
          { name: 'Investment', icon: '📈', color: '#14B8A6', type: 'income' },
          { name: 'Other Income', icon: '💰', color: '#8B5CF6', type: 'income' },
        ];

        // Add user_id if table requires it (some setups scope categories per user)
        const seedRows = user
          ? defaults.map(d => ({ ...d, user_id: user.id }))
          : defaults;

        const { data: seeded, error: seedError } = await supabase
          .from('categories')
          .insert(seedRows)
          .select();

        if (seedError) {
          // If user_id column doesn't exist, retry without it
          const { data: seeded2 } = await supabase
            .from('categories')
            .insert(defaults)
            .select();
          set({ categories: seeded2 || [] });
        } else {
          set({ categories: seeded || [] });
        }
      } else {
        set({ categories: data });
      }
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

      let { data, error } = await supabase
        .from('wallets')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Auto-create default wallet if none exist
      if (!data || data.length === 0) {
        const { data: newWallet, error: insertError } = await supabase
          .from('wallets')
          .insert({
            user_id: user.id,
            name: 'Main Wallet',
            type: 'cash',
            balance: 0,
            color: 'hsl(190, 80%, 42%)'
          })
          .select()
          .single();
          
        if (!insertError && newWallet) {
          data = [newWallet];
        }
      }

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

      // Build insert payload — omit null/undefined optional fields to avoid DB constraint issues
      const payload: Record<string, any> = {
        user_id: user.id,
        amount: transaction.amount,
        type: transaction.type,
        date: transaction.date,
      };
      if (transaction.category_id) payload.category_id = transaction.category_id;
      if (transaction.wallet_id) payload.wallet_id = transaction.wallet_id;
      if (transaction.to_wallet_id) payload.to_wallet_id = transaction.to_wallet_id;
      if (transaction.note) payload.note = transaction.note;
      if (transaction.receipt_url) payload.receipt_url = transaction.receipt_url;

      const { error } = await supabase
        .from('transactions')
        .insert(payload);

      if (error) throw error;

      // 2. Adjust Wallet Balance
      if (transaction.type === 'transfer' && transaction.wallet_id && transaction.to_wallet_id) {
        // Handle transfer between two wallets
        const fromWallet = get().wallets.find(w => w.id === transaction.wallet_id);
        const toWallet = get().wallets.find(w => w.id === transaction.to_wallet_id);
        
        if (fromWallet && toWallet) {
          await Promise.all([
            supabase.from('wallets').update({ balance: fromWallet.balance - transaction.amount }).eq('id', fromWallet.id),
            supabase.from('wallets').update({ balance: toWallet.balance + transaction.amount }).eq('id', toWallet.id)
          ]);
        }
      } else if (transaction.wallet_id) {
        // Handle standard income/expense
        const wallet = get().wallets.find(w => w.id === transaction.wallet_id);
        if (wallet) {
          const newBalance = transaction.type === 'expense' 
            ? wallet.balance - transaction.amount 
            : wallet.balance + transaction.amount;
            
          await supabase
            .from('wallets')
            .update({ balance: newBalance })
            .eq('id', wallet.id);
        }
      }

      get().fetchTransactions(); 
      get().fetchWallets(); 
      return { error: null };
    } catch (error) {
      console.error('Error adding transaction:', error);
      return { error };
    }
  },

  updateTransaction: async (id, updates) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id);

      if (!error) {
        get().fetchTransactions();
      }
      return { error };
    } catch (error) {
      console.error('Error updating transaction:', error);
      return { error };
    }
  },

  deleteTransaction: async (id) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (!error) {
        get().fetchTransactions();
      }
      return { error };
    } catch (error) {
      console.error('Error deleting transaction:', error);
      return { error };
    }
  },

  upsertBudget: async (budget) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Check if a budget already exists for this category and month
      const { data: existing } = await supabase
        .from('budgets')
        .select('id')
        .eq('user_id', user.id)
        .eq('category_id', budget.category_id)
        .eq('month', budget.month)
        .single();

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
      const goal = get().goals.find(g => g.id === id);
      if (!goal) throw new Error("Goal not found");

      const { error } = await supabase
        .from('goals')
        .update({ current_amount: goal.current_amount + amountToAdd })
        .eq('id', id);

      if (!error) get().fetchGoals();
      return { error };
    } catch (error) {
      console.error('Error updating goal:', error);
      return { error };
    }
  }
}));
