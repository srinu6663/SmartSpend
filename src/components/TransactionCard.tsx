import { ShoppingCart, Briefcase, Tv, Car, Coffee, Zap, Package, Dumbbell, MoreHorizontal, ArrowRightLeft, Image as ImageIcon } from "lucide-react";
import type { Transaction } from "@/store/useDataStore";

const iconMap: Record<string, React.ElementType> = {
  ShoppingCart, Briefcase, Tv, Car, Coffee, Zap, Package, Dumbbell,
};

interface Props {
  transaction: Transaction;
}

const TransactionCard = ({ transaction }: Props) => {
  const isTransfer = transaction.type === "transfer";
  const iconName = isTransfer ? "ArrowRightLeft" : (transaction.categories?.icon || "MoreHorizontal");
  const Icon = isTransfer ? ArrowRightLeft : (iconMap[iconName] || MoreHorizontal);
  const isPositive = transaction.type === "income";
  const color = isTransfer ? "hsl(239, 84%, 67%)" : (transaction.categories?.color || "hsl(220, 9%, 46%)");
  const categoryName = isTransfer ? "Transfer" : (transaction.categories?.name || "Unknown");

  return (
    <div className="flex items-center justify-between py-3.5 px-4 active:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3.5">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{transaction.categories?.name || "Unknown"}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide truncate" style={{ color: transaction.wallets?.color }}>
              {transaction.wallets?.name || 'Wallet'}
            </span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span className="text-[11px] text-muted-foreground truncate">{transaction.note || "No note"}</span>
            {transaction.receipt_url && (
              <>
                <span className="w-1 h-1 rounded-full bg-border" />
                <ImageIcon className="w-3 h-3 text-muted-foreground" />
              </>
            )}
          </div>
        </div>
      </div>
      <span className={`text-sm font-bold tabular-nums shrink-0 ${isTransfer ? "text-primary" : isPositive ? "text-success" : "text-foreground"}`}>
        {isTransfer ? "" : isPositive ? "+" : "-"}₹{Math.abs(transaction.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
};

export default TransactionCard;
