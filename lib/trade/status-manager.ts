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

        // 1. Entry Check (we wait until entry is triggered)


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
