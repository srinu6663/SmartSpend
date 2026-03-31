/**
 * Finly — Financial Rules & Calculation Engine
 * 
 * All money calculations in the app MUST go through these utilities
 * to ensure accuracy, consistency, and prevent data corruption.
 */

// ─── PRECISION RULES ─────────────────────────────────────────────────────────
/** All monetary values are stored and calculated with 2 decimal places */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Safe addition that avoids floating-point drift (e.g. 0.1 + 0.2 !== 0.3) */
export const safeAdd = (a: number, b: number): number => round2(a + b);

/** Safe subtraction */
export const safeSubtract = (a: number, b: number): number => round2(a - b);

// ─── VALIDATION RULES ────────────────────────────────────────────────────────
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface TransactionInput {
  amount: number | string;
  type: 'income' | 'expense' | 'transfer';
  wallet_id?: string | null;
  to_wallet_id?: string | null;
  walletBalance?: number;
  category_id?: string | null;
}

const MAX_AMOUNT = 9_99_99_999; // ₹9,99,99,999 — maximum single transaction
const MIN_AMOUNT = 0.01;         // Minimum ₹0.01

export const validateTransaction = (input: TransactionInput): ValidationResult => {
  const amount = typeof input.amount === 'string' ? parseFloat(input.amount) : input.amount;

  // Rule 1: Amount must be a valid finite positive number
  if (!isFinite(amount) || isNaN(amount)) {
    return { valid: false, error: "Invalid amount. Please enter a valid number." };
  }

  // Rule 2: Minimum amount
  if (amount < MIN_AMOUNT) {
    return { valid: false, error: `Amount must be at least ₹${MIN_AMOUNT}` };
  }

  // Rule 3: Maximum amount (practical real-world cap)
  if (amount > MAX_AMOUNT) {
    return { valid: false, error: `Amount cannot exceed ₹${MAX_AMOUNT.toLocaleString('en-IN')}` };
  }

  // Rule 4: Wallet must be selected
  if (!input.wallet_id) {
    return { valid: false, error: "Please add or select a wallet first." };
  }

  // Rule 5: Transfer-specific rules
  if (input.type === 'transfer') {
    if (!input.to_wallet_id) {
      return { valid: false, error: "Please select a destination wallet for the transfer." };
    }
    if (input.wallet_id === input.to_wallet_id) {
      return { valid: false, error: "Source and destination wallets must be different." };
    }
  }

  // Rule 6: Insufficient balance check for expenses and transfers
  if ((input.type === 'expense' || input.type === 'transfer') && input.walletBalance !== undefined) {
    if (amount > input.walletBalance) {
      return {
        valid: false,
        error: `Insufficient balance. Wallet has ₹${round2(input.walletBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}, but you're trying to ${input.type} ₹${round2(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`
      };
    }
  }

  return { valid: true };
};

// ─── BALANCE CALCULATION RULES ────────────────────────────────────────────────
/** Compute what the new wallet balance will be for a given transaction */
export const computeNewBalance = (
  currentBalance: number,
  amount: number,
  type: 'income' | 'expense' | 'transfer',
  direction: 'from' | 'to' = 'from'
): number => {
  const a = round2(Math.abs(amount));
  const b = round2(currentBalance);
  if (type === 'income') return safeAdd(b, a);
  if (type === 'expense') return safeSubtract(b, a);
  if (type === 'transfer') {
    return direction === 'from' ? safeSubtract(b, a) : safeAdd(b, a);
  }
  return b;
};

// ─── REPORTING HELPERS ────────────────────────────────────────────────────────
export interface Transaction {
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  date: string;
  category_id?: string | null;
  categories?: { name?: string; color?: string; icon?: string | null } | null;
}

/** Filter transactions to a specific calendar month */
export const filterByMonth = <T extends { date: string }>(
  items: T[],
  year: number,
  month: number // 0-indexed
): T[] =>
  items.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

/** Sum amounts for a specific transaction type in a given month */
export const sumByTypeInMonth = (
  transactions: Transaction[],
  type: 'income' | 'expense',
  year: number,
  month: number
): number =>
  round2(
    filterByMonth(transactions, year, month)
      .filter(t => t.type === type)
      .reduce((sum, t) => sum + round2(Number(t.amount)), 0)
  );

/** Get per-category spending breakdown for a given month */
export const getCategoryBreakdown = (
  transactions: Transaction[],
  year: number,
  month: number
): { name: string; amount: number; color: string }[] => {
  const map: Record<string, { amount: number; color: string }> = {};

  filterByMonth(transactions, year, month)
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const name = t.categories?.name || 'Other';
      const color = t.categories?.color || 'hsl(220, 9%, 46%)';
      if (!map[name]) map[name] = { amount: 0, color };
      map[name].amount = safeAdd(map[name].amount, Number(t.amount));
    });

  return Object.entries(map)
    .map(([name, { amount, color }]) => ({ name, amount: round2(amount), color }))
    .sort((a, b) => b.amount - a.amount);
};

/** Rolling 6-month summary for charts */
export const getMonthlyRollup = (
  transactions: Transaction[]
): { month: string; income: number; expense: number; net: number; index: number }[] => {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const today = new Date();
  
  return Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i;
    const d = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const income = sumByTypeInMonth(transactions, 'income', d.getFullYear(), d.getMonth());
    const expense = sumByTypeInMonth(transactions, 'expense', d.getFullYear(), d.getMonth());
    return {
      month: monthNames[d.getMonth()],
      income,
      expense,
      net: safeSubtract(income, expense),
      index: i,
    };
  });
};

/** Calculate savings rate (0-100) */
export const savingsRate = (income: number, expense: number): number => {
  if (income <= 0) return 0;
  return Math.max(0, Math.min(100, round2(((income - expense) / income) * 100)));
};

// ─── FORMATTING HELPERS ───────────────────────────────────────────────────────
/** Format a number in Indian number system with ₹ prefix */
export const formatINR = (
  amount: number,
  opts: { decimals?: number; showPlus?: boolean } = {}
): string => {
  const { decimals = 0, showPlus = false } = opts;
  const n = round2(amount);
  const formatted = Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const prefix = n < 0 ? '-₹' : showPlus && n > 0 ? '+₹' : '₹';
  return prefix + formatted;
};

/** Format raw digit string (from keypad) as Indian number live */
export const formatIndianLive = (raw: string): string => {
  const parts = raw.split('.');
  const intStr = parts[0];
  if (intStr.length <= 3) return raw;
  const lastThree = intStr.slice(-3);
  const rest = intStr.slice(0, -3);
  const withCommas = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const formatted = withCommas + ',' + lastThree;
  return parts.length > 1 ? formatted + '.' + parts[1] : formatted;
};
