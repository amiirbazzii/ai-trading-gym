/**
 * PnL Calculation Utilities
 * =========================
 * Pure functions for calculating profit and loss, checking price triggers, etc.
 */

/**
 * Calculate profit for a take-profit hit
 * Formula: ((tp_price - entry_price) / entry_price) × capital_per_tp
 * For short: ((entry_price - tp_price) / entry_price) × capital_per_tp
 */
export function calculateTpProfit(
    direction: 'long' | 'short',
    entryPrice: number,
    tpPrice: number,
    capitalPerTp: number
): number {
    if (direction === 'long') {
        return ((tpPrice - entryPrice) / entryPrice) * capitalPerTp;
    } else {
        return ((entryPrice - tpPrice) / entryPrice) * capitalPerTp;
    }
}

/**
 * Calculate loss for a stop-loss hit
 * Formula: ((sl_price - entry_price) / entry_price) × remaining_capital
 * For short: ((entry_price - sl_price) / entry_price) × remaining_capital
 */
export function calculateSlLoss(
    direction: 'long' | 'short',
    entryPrice: number,
    slPrice: number,
    remainingCapital: number
): number {
    if (direction === 'long') {
        // For long, SL is below entry, so this will be negative
        return ((slPrice - entryPrice) / entryPrice) * remainingCapital;
    } else {
        // For short, SL is above entry, so this will be negative
        return ((entryPrice - slPrice) / entryPrice) * remainingCapital;
    }
}

/**
 * Check if price has reached a target
 */
export function isPriceTriggered(
    direction: 'long' | 'short',
    currentPrice: number,
    targetPrice: number,
    isStopLoss: boolean
): boolean {
    if (direction === 'long') {
        // Long: Entry/TP triggered when price >= target, SL triggered when price <= target
        return isStopLoss ? currentPrice <= targetPrice : currentPrice >= targetPrice;
    } else {
        // Short: Entry/TP triggered when price <= target, SL triggered when price >= target
        return isStopLoss ? currentPrice >= targetPrice : currentPrice <= targetPrice;
    }
}
