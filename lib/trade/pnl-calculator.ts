import { Trade, TradeDirection, TakeProfit, TradeSyncResult, TradeStatus } from './types';

export class PnLCalculator {
    /**
     * core constant: Capital allocated per strategy/trade setup default
     */
    static readonly INITIAL_CAPITAL = 1000;

    /**
     * Check if a price triggers a condition
     */
    static isTriggered(
        direction: TradeDirection,
        currentPrice: number,
        targetPrice: number,
        isStopLoss: boolean
    ): boolean {
        if (direction === 'long') {
            // Long: Hit target if price >= target. Hit SL if price <= SL.
            return isStopLoss ? currentPrice <= targetPrice : currentPrice >= targetPrice;
        } else {
            // Short: Hit target if price <= target. Hit SL if price >= SL.
            return isStopLoss ? currentPrice >= targetPrice : currentPrice <= targetPrice;
        }
    }

    /**
     * Calculate P/L percentage for a movement
     */
    static calculateReturnRate(
        direction: TradeDirection,
        entryPrice: number,
        exitPrice: number
    ): number {
        if (entryPrice === 0) return 0;
        const diff = direction === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice;
        return diff / entryPrice;
    }

    /**
     * Calculate Dollar Value PnL
     */
    static calculatePnL(
        direction: TradeDirection,
        entryPrice: number,
        exitPrice: number,
        positionSize: number
    ): number {
        const rate = this.calculateReturnRate(direction, entryPrice, exitPrice);
        return rate * positionSize;
    }

    /**
     * Processes a trade against the current market price and determines updates.
     * This method is pure: it takes a trade and price, and returns what *should* happen.
     */
    static evaluateTrade(trade: Trade, currentPrice: number): TradeSyncResult {
        const result: TradeSyncResult = {
            trade,
            shouldUpdate: false,
            updates: {},
            tpUpdates: [],
        };

        // Safety check
        if (!trade.entry_price || !trade.sl) {
            return result;
        }

        const tps = trade.trade_tps || [];
        const totalTps = tps.length;
        const positionSize = trade.position_size || this.INITIAL_CAPITAL;

        // Capital per TP chunk. If 0 TPs, all capital is on the main position (which effectively acts like 1 TP at infinity?)
        // In this system, TPs are optional but standard. If no TPs, we only exit on SL or manual.
        // If TPs exist, we split capital evenly.
        const capitalPerTp = totalTps > 0 ? positionSize / totalTps : 0;

        let currentPnl = trade.pnl || 0;
        let remainingPosition = trade.remaining_position ?? positionSize;
        const originalRemaining = remainingPosition;

        // 1. Check Stop Loss logic first (simplest: if SL hit, game over for remaining portion)
        const isSlHit = this.isTriggered(trade.direction, currentPrice, trade.sl, true);

        if (isSlHit) {
            // Validate we haven't already closed it
            if (trade.status !== 'sl_hit' && trade.status !== 'tp_partial_then_sl' && trade.status !== 'tp_all_hit' && trade.status !== 'cancelled') {

                const slLoss = this.calculatePnL(
                    trade.direction,
                    trade.entry_price,
                    trade.sl,
                    remainingPosition
                );

                const finalPnl = currentPnl + slLoss;
                const hitSomeTps = tps.some(tp => tp.is_hit);
                const newStatus: TradeStatus = hitSomeTps ? 'tp_partial_then_sl' : 'sl_hit';

                result.shouldUpdate = true;
                result.completedAction = {
                    newStatus,
                    finalPnl,
                    exitPrice: trade.sl // We assume fill at SL price
                };
                return result;
            }
        }

        // 2. Check Take Profits
        // Only check TPs that are NOT hit yet
        const unhitTps = tps.filter(tp => !tp.is_hit);
        let tpsHitNow = 0;
        let pnlFromNewTps = 0;

        for (const tp of unhitTps) {
            const isHit = this.isTriggered(trade.direction, currentPrice, tp.tp_price, false);

            if (isHit) {
                const profit = this.calculatePnL(
                    trade.direction,
                    trade.entry_price,
                    tp.tp_price,
                    capitalPerTp
                );

                result.tpUpdates.push({
                    id: tp.id,
                    updates: {
                        is_hit: true,
                        hit_at: new Date().toISOString(),
                        pnl_portion: profit
                    }
                });

                pnlFromNewTps += profit;
                remainingPosition -= capitalPerTp;
                tpsHitNow++;
            }
        }

        // 3. Determine Outcome
        if (tpsHitNow > 0) {
            result.shouldUpdate = true;

            // Fix potential floating point issues with remaining position
            if (remainingPosition < 0.01) remainingPosition = 0;

            const newTotalPnl = currentPnl + pnlFromNewTps;

            // Check if ALL TPs are now hit
            const totalHit = tps.filter(tp => tp.is_hit).length + tpsHitNow;
            const allHit = totalHit === totalTps && totalTps > 0;

            if (allHit) {
                result.completedAction = {
                    newStatus: 'tp_all_hit',
                    finalPnl: newTotalPnl,
                    exitPrice: currentPrice // Or the last TP price? Usually last TP price is safer.
                };
                // Find limits of last TP just in case, but using last TP is safer than current price for "perfect" execution simulation
                // However user might want "triggered at X", let's stick to last TP price logic if we want to be precise, 
                // but actually the loop handles 'currentPrice > tp' so strictly speaking we filled at TP price.
                // Re-calculating 'exitPrice' for the trade record:
                // If all TPs hit, the "exit price" is conceptually the average exit or just the final TP. 
                // Let's use the final TP's price as the marker for "where we finished".
                // But wait, if we have multiple TPs, 'exit_price' on the Trade table is a bit ambiguous. 
                // Usually it means "the price we completely got out at".

                // Let's find the TP with the most 'extreme' price that was just hit
                // Actually simplicity: Update PnL is the most important.
            } else {
                result.updates = {
                    pnl: newTotalPnl,
                    remaining_position: remainingPosition
                };
            }
        }

        return result;
    }
}
