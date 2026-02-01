
import { PnLCalculator } from '../lib/trade/pnl-calculator';
import { StatusManager } from '../lib/trade/status-manager';
import { Trade, TradeStatus } from '../lib/trade/types';

// Mock Trade Generator
function createMockTrade(
    id: string,
    status: TradeStatus,
    direction: 'long' | 'short',
    entry: number,
    sl: number,
    tps: number[],
    positionSize: number = 1000
): Trade {
    return {
        id,
        user_id: 'user1',
        direction,
        entry_price: entry,
        sl,
        status,
        pnl: 0,
        position_size: positionSize,
        remaining_position: positionSize,
        trade_tps: tps.map((p, i) => ({
            id: `tp-${i}`,
            trade_id: id,
            tp_price: p,
            is_hit: false,
            hit_at: null,
            pnl_portion: 0
        }))
    };
}

async function runTests() {
    console.log('--- STARTING TRADING LOGIC VERIFICATION ---\n');

    // Case 1: Pending -> Entered
    // Setup: Long ETH at 3000, SL 2900. Current Price: 3000.
    const trade1 = createMockTrade('t1', 'pending_entry', 'long', 3000, 2900, [3100, 3200]);
    const res1 = StatusManager.checkPendingStatus(trade1, 3000); // Hit entry
    console.log(`[Case 1] Pending -> Entered: ${res1.updates.status === 'entered' ? 'PASS' : 'FAIL'} (Got ${res1.updates.status})`);

    // Case 2: Pending -> Cancelled (SL Hit before Entry)
    // Setup: Long ETH at 3000, SL 2900. Current Price: 2800.
    const trade2 = createMockTrade('t2', 'pending_entry', 'long', 3000, 2900, [3100]);
    const res2 = StatusManager.checkPendingStatus(trade2, 2800);
    console.log(`[Case 2] Pending -> Cancelled: ${res2.updates.status === 'cancelled' ? 'PASS' : 'FAIL'} (Got ${res2.updates.status})`);

    // Case 3: Entered -> TP1 Hit
    // Setup: Long ETH at 3000, SL 2900, TP1 3100, TP2 3200. Price: 3100.
    const trade3 = createMockTrade('t3', 'entered', 'long', 3000, 2900, [3100, 3200]);
    const res3 = PnLCalculator.evaluateTrade(trade3, 3100);
    const tp1Profit = res3.tpUpdates[0]?.updates.pnl_portion;
    // Expected Profit: (3100-3000)/3000 * 500 = 0.0333 * 500 = 16.66
    const expectedTp1 = ((3100 - 3000) / 3000) * 500;
    const pass3 = Math.abs((tp1Profit || 0) - expectedTp1) < 0.1 && res3.updates.remaining_position === 500;
    console.log(`[Case 3] TP1 Hit: ${pass3 ? 'PASS' : 'FAIL'} (Profit $${tp1Profit?.toFixed(2)}, Expected $${expectedTp1.toFixed(2)})`);

    // Case 4: Entered -> SL Hit immediately
    // Setup: Long ETH at 3000, SL 2900. Price: 2890.
    const trade4 = createMockTrade('t4', 'entered', 'long', 3000, 2900, [3100]);
    const res4 = PnLCalculator.evaluateTrade(trade4, 2890);
    // Expected Loss: (2900 - 3000)/3000 * 1000 = -33.33
    // Note: We use trade.sl (2900) as exit price, not current price (2890), to simulate stop order fill.
    const expectedSlLoss = ((2900 - 3000) / 3000) * 1000;
    const finalPnl4 = res4.completedAction?.finalPnl;
    const pass4 = res4.completedAction?.newStatus === 'sl_hit' && Math.abs((finalPnl4 || 0) - expectedSlLoss) < 0.1;
    console.log(`[Case 4] SL Direct Hit: ${pass4 ? 'PASS' : 'FAIL'} (PnL $${finalPnl4?.toFixed(2)}, Expected $${expectedSlLoss.toFixed(2)})`);

    // Case 5: Partial TP then SL
    // Setup: Already hit TP1. Remaining 500. PnL 16.66. Now Price hits SL 2900.
    const trade5 = createMockTrade('t5', 'entered', 'long', 3000, 2900, [3100, 3200]);
    trade5.trade_tps[0].is_hit = true;
    trade5.pnl = 16.666;
    trade5.remaining_position = 500;

    const res5 = PnLCalculator.evaluateTrade(trade5, 2850);
    // Loss on remaining: (2900 - 3000)/3000 * 500 = -16.666
    // Total PnL should be ~0 
    const expectedLoss5 = ((2900 - 3000) / 3000) * 500;
    const finalPnl5 = res5.completedAction?.finalPnl;
    const pass5 = res5.completedAction?.newStatus === 'tp_partial_then_sl' && Math.abs((finalPnl5 || 0) - (16.666 + expectedLoss5)) < 0.1;
    console.log(`[Case 5] Partial TP + SL: ${pass5 ? 'PASS' : 'FAIL'} (Final PnL $${finalPnl5?.toFixed(2)})`);

    console.log('\n--- VERIFICATION COMPLETE ---');
}

runTests().catch(console.error);
