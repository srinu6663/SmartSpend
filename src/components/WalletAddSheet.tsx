import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet as WalletIcon, Check } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/store/useDataStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

const WALLET_TYPES = [
  { id: "bank", label: "Bank Account", color: "hsl(239, 84%, 67%)" },
  { id: "cash", label: "Cash", color: "hsl(160, 84%, 39%)" },
  { id: "credit", label: "Credit Card", color: "hsl(340, 82%, 52%)" },
  { id: "e_wallet", label: "E-Wallet", color: "hsl(38, 92%, 50%)" }
];

const WalletAddSheet = ({ open, onClose }: Props) => {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [type, setType] = useState(WALLET_TYPES[0]);
  const [saving, setSaving] = useState(false);
  const { addWallet } = useDataStore();

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    
    const { error } = await addWallet({
      name: name.trim(),
      type: type.id as any,
      balance: parseFloat(balance || "0"),
      color: type.color
    });
    
    setSaving(false);
    
    if (error) {
      toast.error("Failed to add wallet");
    } else {
      toast.success(`${name} added successfully!`);
      setName("");
      setBalance("");
      setType(WALLET_TYPES[0]);
      onClose();
    }
  };

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
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            <div className="flex items-center justify-between px-5 pb-5">
              <h3 className="text-base font-bold text-foreground">Add New Wallet</h3>
              <button onClick={onClose} className="p-1.5 rounded-xl bg-muted text-muted-foreground transition-colors active:bg-muted/80">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 space-y-4">
              {/* Type Selection */}
              <div className="grid grid-cols-2 gap-2">
                {WALLET_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setType(t)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                      type.id === t.id 
                        ? "border-transparent text-white shadow-md relative overflow-hidden" 
                        : "border-border/50 text-muted-foreground bg-transparent"
                    }`}
                    style={type.id === t.id ? { backgroundColor: t.color } : {}}
                  >
                    <span>{t.label}</span>
                    {type.id === t.id && <Check className="w-4 h-4 opacity-70" />}
                  </button>
                ))}
              </div>

              {/* Name Input */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Wallet Name</label>
                <div className="relative">
                  <WalletIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="e.g. HDFC Bank, Chase Card"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-muted rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              {/* Initial Balance Input */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Initial Balance (Optional)</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-sm font-bold text-muted-foreground">₹</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    className="w-full bg-muted rounded-xl pl-8 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 pt-6 pb-5">
              <button
                onClick={handleSave}
                disabled={!name.trim() || saving}
                className="w-full py-4 rounded-2xl font-bold text-sm text-primary-foreground disabled:opacity-30 transition-all duration-200 active:scale-[0.98]"
                style={{ backgroundColor: type.color }}
              >
                {saving ? "Saving..." : "Create Wallet"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default WalletAddSheet;
