import { Trade, TradeStatus, TradeSyncResult } from './types';
import { PnLCalculator } from './pnl-calculator';

// Entry tolerance in dollars - trade enters when price is within this range of entry
const ENTRY_TOLERANCE = 3;

export class StatusManager {
    /**
     * Checks pending trades for entry.
     * 
     * LOGIC: Tolerance-based entry
     * A trade enters when the current price is within ±$3 of the entry price.
     * Example: Entry at $2319 → enters if price is between $2316 and $2322
     */
    static checkPendingStatus(trade: Trade, currentPrice: number): TradeSyncResult {
        const result: TradeSyncResult = {
            trade,
            shouldUpdate: false,
            updates: {},
            tpUpdates: []
        };

        if (trade.status !== 'pending_entry') {
            return result;
        }

        // Simple tolerance check: is price within ±$3 of entry?
        const difference = Math.abs(currentPrice - trade.entry_price);
        const isEntered = difference <= ENTRY_TOLERANCE;

        console.log(`[StatusManager] Trade ${trade.id.slice(0, 8)}: Entry=$${trade.entry_price}, Current=$${currentPrice}, Diff=$${difference.toFixed(2)}, Enters=${isEntered}`);

        if (isEntered) {
            result.shouldUpdate = true;
            result.updates = {
                status: 'entered',
            };
        }

        return result;
    }
}
