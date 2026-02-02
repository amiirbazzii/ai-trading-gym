import { cn } from "@/lib/utils";
import { PnLCalculator } from "@/lib/trade/pnl-calculator";
import { Trade } from "./types";

interface LivePnlDisplayProps {
    trade: Trade;
    currentPrice: number | null;
}

export function LivePnlDisplay({ trade, currentPrice }: LivePnlDisplayProps) {
    // If trade is closed, just show stored PnL
    const isClosed = ["tp_all_hit", "sl_hit", "tp_partial_then_sl"].includes(trade.status);

    // Base PnL (Realized)
    let totalPnl = trade.pnl;
    let isLive = false;

    // Add Floating PnL ONLY if trade is active (entered)
    if (trade.status === 'entered' && currentPrice && trade.remaining_position > 0) {
        // Calculate floating PnL on remaining position
        const floatingPnl = PnLCalculator.calculatePnL(
            trade.direction,
            trade.entry_price,
            currentPrice,
            trade.remaining_position
        );

        totalPnl += floatingPnl;
        isLive = true;
    }

    return (
        <span className={cn(
            trade.pnl > 0 || totalPnl > 0 ? "text-green-600" : totalPnl < 0 ? "text-red-600" : "text-muted-foreground",
            isLive && "font-bold"
        )}>
            {totalPnl > 0 ? "+" : ""}${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {isLive && <span className="text-[10px] text-muted-foreground ml-1">(Live)</span>}
        </span>
    );
}
