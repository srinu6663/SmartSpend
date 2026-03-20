import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Delete } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/store/useDataStore";
import { supabase } from "@/lib/supabase";
import ReceiptScanner from "@/components/ReceiptScanner";
import { formatIndianLive, validateTransaction } from "@/lib/finance";

interface Props {
  open: boolean;
  onClose: () => void;
}

const QuickAddSheet = ({ open, onClose }: Props) => {
  const [amount, setAmount] = useState("0"); // raw numeric string, no commas
  const [txType, setTxType] = useState<'expense'|'income'|'transfer'>('expense');
  const [note, setNote] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const { addTransaction, categories, wallets } = useDataStore();
  
  const typeCategories = categories.filter(c => c.type === (txType === 'transfer' ? 'expense' : txType));
  
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [toWalletId, setToWalletId] = useState<string | null>(null);

  useEffect(() => {
    if (typeCategories.length > 0 && (!selectedCategoryId || !typeCategories.find(c => c.id === selectedCategoryId))) {
      setSelectedCategoryId(typeCategories[0].id);
    }
  }, [txType, categories, selectedCategoryId]);

  useEffect(() => {
    if (wallets.length > 0 && !selectedWalletId) {
      setSelectedWalletId(wallets[0].id);
    }
    if (wallets.length > 1 && !toWalletId && selectedWalletId) {
      const other = wallets.find(w => w.id !== selectedWalletId);
      if (other) setToWalletId(other.id);
    }
  }, [wallets, selectedWalletId, toWalletId]);

  const [saving, setSaving] = useState(false);

  const handleKey = (key: string) => {
    if (key === "del") {
      setAmount((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));
    } else if (key === ".") {
      if (!amount.includes(".")) setAmount((prev) => prev + ".");
    } else {
      if (amount === "0") {
        setAmount(key);
      } else {
        const parts = amount.split(".");
        // If typing decimal part and it's already 2 digits
        if (parts.length === 2 && parts[1].length >= 2) return;
        // If typing integer part and it's already 8 digits (allow up to 99,999,999 for rupees)
        if (parts.length === 1 && parts[0].length >= 8) return;
        
        setAmount((prev) => prev + key);
      }
    }
  };

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    
    // Run full client-side validation before even attempting the save
    const preflight = validateTransaction({
      amount: parsedAmount,
      type: txType,
      wallet_id: selectedWalletId,
      to_wallet_id: toWalletId,
      walletBalance: wallets.find(w => w.id === selectedWalletId)?.balance,
    });
    if (!preflight.valid) {
      toast.error(preflight.error!);
      return;
    }
    if (txType !== 'transfer' && typeCategories.length > 0 && !selectedCategoryId) {
      toast.error("Please select a category");
      return;
    }

    setSaving(true);

    // Upload receipt if exists
    let receiptUrl = null;
    if (receiptFile) {
      const fileExt = receiptFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, receiptFile);

      if (uploadError) {
        console.error('Receipt upload error:', uploadError);
        // Non-blocking: proceed without receipt
      } else if (uploadData) {
        const { data: publicUrlData } = supabase.storage.from('receipts').getPublicUrl(uploadData.path);
        receiptUrl = publicUrlData.publicUrl;
      }
    }

    const date = new Date().toISOString().split('T')[0];

    const { error } = await addTransaction({
      amount: parsedAmount,
      type: txType,
      // Only include category_id if we actually have one selected
      category_id: selectedCategoryId || (categories[0]?.id ?? null),
      wallet_id: selectedWalletId,
      to_wallet_id: txType === 'transfer' ? toWalletId : null,
      note: note || null,
      date,
      receipt_url: receiptUrl,
    });

    setSaving(false);

    if (error) {
      console.error('Transaction save error:', error);
      toast.error(`Could not save: ${(error as any)?.message || "Unknown error"}`);
    } else {
      const label = txType === 'expense' ? 'Expense' : txType === 'income' ? 'Income' : 'Transfer';
      toast.success(`${label} of ₹${parsedAmount.toLocaleString('en-IN')} saved ✓`);
      setAmount("0");
      setNote("");
      setReceiptFile(null);
      onClose();
    }
  };


  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-foreground/30"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl max-w-lg mx-auto will-change-transform pb-[env(safe-area-inset-bottom)]"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <h3 className="text-base font-bold text-foreground">Add Transaction</h3>
              <button onClick={onClose} className="p-1.5 rounded-xl bg-muted text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Type toggle */}
            <div className="mx-5 mb-4 bg-muted rounded-xl p-1 flex">
              <button
                onClick={() => setTxType('expense')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  txType === 'expense'
                    ? "bg-card text-destructive shadow-card"
                    : "text-muted-foreground"
                }`}
              >
                Expense
              </button>
              <button
                onClick={() => setTxType('income')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  txType === 'income'
                    ? "bg-card text-success shadow-card"
                    : "text-muted-foreground"
                }`}
              >
                Income
              </button>
              <button
                onClick={() => setTxType('transfer')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  txType === 'transfer'
                    ? "bg-card text-primary shadow-card"
                    : "text-muted-foreground"
                }`}
              >
                Transfer
              </button>
            </div>

            {/* Amount — displayed with Indian comma formatting */}
            <div className="text-center py-5">
              <span className={`text-5xl font-extrabold tabular-nums tracking-tighter ${
                txType === 'expense' ? "text-foreground" : txType === 'income' ? "text-success" : "text-primary"
              }`}>
                ₹{formatIndianLive(amount)}
              </span>
            </div>

            {/* Category chips (Hidden on Transfer) */}
            {txType !== 'transfer' && (
              <div className="flex gap-2 px-5 pb-3 overflow-x-auto no-scrollbar">
                {typeCategories.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-2 py-2">No categories defined.</p>
                ) : typeCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                      selectedCategoryId === cat.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Wallet chips */}
            <div className="flex gap-2 px-5 pb-3 overflow-x-auto no-scrollbar items-center">
              {txType === 'transfer' && <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">From</span>}
              {wallets.length === 0 ? (
                <p className="text-[11px] text-muted-foreground px-2 py-1">Loading wallets...</p>
              ) : wallets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelectedWalletId(w.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 border border-border/50 ${
                    selectedWalletId === w.id
                      ? "bg-foreground text-background shadow-sm"
                      : "bg-transparent text-muted-foreground"
                  }`}
                >
                  {w.name}
                </button>
              ))}
            </div>

            {txType === 'transfer' && (
              <div className="flex gap-2 px-5 pb-3 overflow-x-auto no-scrollbar items-center">
                <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">To</span>
                {wallets.length < 2 ? (
                  <p className="text-[11px] text-muted-foreground px-2 py-1">Add another wallet to transfer.</p>
                ) : wallets.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setToWalletId(w.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 border border-border/50 ${
                      toWalletId === w.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-transparent text-muted-foreground"
                    }`}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            )}

            {/* Note and Photo input */}
            <div className="px-5 pb-3 flex gap-2">
              <input
                type="text"
                placeholder="Add a note... (try #tags)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="flex-1 bg-muted rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
              />
              <ReceiptScanner
                onResult={(result) => {
                  if (result.amount) setAmount(String(result.amount));
                  if (result.merchant) setNote(prev => prev || result.merchant!);
                }}
              />
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-px mx-5 rounded-2xl overflow-hidden mb-4">
              {keys.map((key) => (
                <button
                  key={key}
                  onClick={() => handleKey(key)}
                  className="bg-muted/50 py-3.5 text-lg font-semibold text-foreground active:bg-muted transition-colors flex items-center justify-center"
                >
                  {key === "del" ? <Delete className="w-5 h-5 text-muted-foreground" /> : key}
                </button>
              ))}
            </div>

            {/* Save */}
            <div className="px-5 pb-5">
              <button
                onClick={handleSave}
                disabled={amount === "0" || saving || !selectedWalletId}
                className="w-full py-4 rounded-2xl font-bold text-sm text-primary-foreground disabled:opacity-30 transition-all duration-200 active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, hsl(239, 84%, 67%) 0%, hsl(262, 83%, 58%) 100%)",
                }}
              >
                {saving ? "Saving..." : !selectedWalletId ? "Add a wallet first →" : "Save Transaction"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default QuickAddSheet;
