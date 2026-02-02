
import { StatusManager } from '../lib/trade/status-manager';
import { Trade } from '../lib/trade/types';

const mockTrade: Trade = {
    id: 'test-pending',
    user_id: 'u1',
    direction: 'long',
    entry_price: 2400,
    sl: 2000,
    status: 'pending_entry',
    pnl: 0,
    position_size: 1000,
    remaining_position: 1000,
    trade_tps: []
};

function runTest() {
    console.log("--- Testing Pending Entry Logic ---");
    const currentPrice = 2250;

    console.log(`Trade: Long @ ${mockTrade.entry_price}`);
    console.log(`Current Price: ${currentPrice}`);

    const result = StatusManager.checkPendingStatus(mockTrade, currentPrice);

    if (result.shouldUpdate && result.updates.status === 'entered') {
        console.log("RESULT: Trade ENTERED (Incorrect for Stop Entry logic)");
    } else {
        console.log("RESULT: Trade still Pending (Correct for Stop Entry logic)");
    }
}

runTest();
