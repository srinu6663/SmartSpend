import { useState } from "react";
import { motion } from "framer-motion";
import { useDataStore } from "@/store/useDataStore";
import type { Wallet } from "@/store/useDataStore";
import { Plus, CreditCard, Wallet as WalletIcon, Banknote, Smartphone } from "lucide-react";
import WalletAddSheet from "./WalletAddSheet";

// Beautiful gradient palettes per wallet type
const TYPE_CONFIG: Record<string, { gradient: string; icon: typeof WalletIcon }> = {
  bank:     { gradient: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)", icon: WalletIcon },
  cash:     { gradient: "linear-gradient(135deg, #059669 0%, #10B981 100%)", icon: Banknote },
  credit:   { gradient: "linear-gradient(135deg, #DB2777 0%, #F43F5E 100%)", icon: CreditCard },
  e_wallet: { gradient: "linear-gradient(135deg, #D97706 0%, #F59E0B 100%)", icon: Smartphone },
};

const WalletCard = ({ w, i }: { w: Wallet; i: number }) => {
  const config = TYPE_CONFIG[w.type] || TYPE_CONFIG.bank;
  const Icon = config.icon;
  const typeLabel = w.type === "e_wallet" ? "E-Wallet" : w.type.charAt(0).toUpperCase() + w.type.slice(1);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, x: 12 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{ duration: 0.35, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className="w-[168px] shrink-0 snap-start"
    >
      <div
        className="relative w-full h-[100px] rounded-2xl p-4 overflow-hidden shadow-lg flex flex-col justify-between"
        style={{ background: config.gradient }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-5 -right-5 w-24 h-24 rounded-full bg-white/10" />
        <div className="absolute -bottom-6 -left-3 w-20 h-20 rounded-full bg-black/10" />

        {/* Top row: icon + type */}
        <div className="flex items-center justify-between z-10">
          <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Icon className="w-4 h-4 text-white" strokeWidth={1.8} />
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-white/70 bg-black/15 px-2 py-0.5 rounded-full">
            {typeLabel}
          </span>
        </div>

        {/* Bottom: name + amount */}
        <div className="z-10">
          <p className="text-[10px] font-semibold text-white/75 truncate mb-0.5">{w.name}</p>
          <p className="text-[17px] font-black tabular-nums text-white tracking-tight leading-none">
            ₹{w.balance.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

const WalletList = () => {
  const { wallets } = useDataStore();
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  return (
    <>
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground tracking-tight">My Wallets</h2>
          <button
            onClick={() => setAddSheetOpen(true)}
            className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full active:scale-95 transition-all"
          >
            <Plus className="w-3 h-3" strokeWidth={3} /> Add
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-3 -mx-4 px-4 snap-x snap-mandatory">
          {wallets.length === 0 ? (
            <div className="w-[168px] h-[100px] rounded-2xl bg-muted/60 border border-border/40 flex flex-col items-center justify-center shrink-0 snap-start">
              <WalletIcon className="w-5 h-5 text-muted-foreground/40 mb-1" />
              <span className="text-xs font-semibold text-muted-foreground/50">No wallets yet</span>
            </div>
          ) : (
            wallets.map((w, i) => <WalletCard key={w.id} w={w} i={i} />)
          )}
        </div>
      </div>

      <WalletAddSheet open={addSheetOpen} onClose={() => setAddSheetOpen(false)} />
    </>
  );
};

export default WalletList;
