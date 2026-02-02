
import { StatusManager } from '../lib/trade/status-manager';
import { Trade } from '../lib/trade/types';

function test() {
    console.log("=== Testing Tolerance-Based Entry Logic (±$3) ===\n");

    // Base trade template
    const baseTrade: Omit<Trade, 'id' | 'direction' | 'entry_price' | 'sl'> = {
        user_id: 'u1',
        status: 'pending_entry',
        pnl: 0,
        position_size: 1000,
        remaining_position: 1000,
        trade_tps: []
    };

    // Test trade with entry at $2319
    const trade: Trade = {
        ...baseTrade,
        id: '1',
        direction: 'long',
        entry_price: 2319,
        sl: 2300,
    };

    console.log("Entry price: $2319 (tolerance: ±$3, so $2316 to $2322)\n");

    // Test cases
    const testCases = [
        { price: 2319, expected: true, desc: "Exactly at entry" },
        { price: 2316, expected: true, desc: "At lower bound (-$3)" },
        { price: 2322, expected: true, desc: "At upper bound (+$3)" },
        { price: 2318, expected: true, desc: "Within tolerance (-$1)" },
        { price: 2320, expected: true, desc: "Within tolerance (+$1)" },
        { price: 2315, expected: false, desc: "Below tolerance (-$4)" },
        { price: 2323, expected: false, desc: "Above tolerance (+$4)" },
        { price: 2500, expected: false, desc: "Far above entry" },
        { price: 2000, expected: false, desc: "Far below entry" },
    ];

    let passed = 0;
    let failed = 0;

    for (const tc of testCases) {
        const result = StatusManager.checkPendingStatus(trade, tc.price);
        const entered = result.shouldUpdate && result.updates?.status === 'entered';
        const success = entered === tc.expected;

        if (success) {
            passed++;
            console.log(`✅ $${tc.price} - ${tc.desc}: ${entered ? 'ENTERED' : 'PENDING'}`);
        } else {
            failed++;
            console.log(`❌ $${tc.price} - ${tc.desc}: ${entered ? 'ENTERED' : 'PENDING'} (expected ${tc.expected ? 'ENTERED' : 'PENDING'})`);
        }
    }

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
}

test();
