import { Trade, TradeStatus, TradeSyncResult } from './types';
import { PnLCalculator } from './pnl-calculator';

export class StatusManager {
    /**
     * Checks pending trades for entry or invalidation
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

        // 1. Check if SL hit before entry (Invalidation)
        const isInvalidated = PnLCalculator.isTriggered(
            trade.direction,
            currentPrice,
            trade.sl,
            true // is stop loss
        );

        if (isInvalidated) {
            result.shouldUpdate = true;
            result.updates = {
                status: 'cancelled',
                // We don't set exit status or PnL for cancelled trades usually, 
                // or maybe we set it to 0. canceled is final.
            };
            // Optional: Log invalidation
            return result;
        }

        // 2. Check if Entry reached
        const isEntered = PnLCalculator.isTriggered(
            trade.direction,
            currentPrice,
            trade.entry_price,
            false // not stop loss
        );

        if (isEntered) {
            result.shouldUpdate = true;
            result.updates = {
                status: 'entered',
                // We don't set pnl here, it starts at 0 (or slight loss due to spread/fees if we modeled that)
            };
        }

        return result;
    }
}
