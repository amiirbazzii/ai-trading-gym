import { strict as assert } from 'node:assert';
import { calculateTpProfit, calculateSlLoss, isPriceTriggered } from '../lib/pnl-calculations';

console.log('Running PnL Logic Tests...');

let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (error) {
        console.error(`❌ ${name}`);
        console.error(error);
        failed++;
    }
}

// ==========================================
// Long Position Tests
// ==========================================
runTest('Long: TP Hit Profit Calculation', () => {
    // Entry: 100, TP: 110, Cap: 10 -> Profit should be 1
    const pnl = calculateTpProfit('long', 100, 110, 10);
    assert.ok(Math.abs(pnl - 1.0) < 0.0001, `Expected 1.0, got ${pnl}`);
});

runTest('Long: SL Hit Loss Calculation', () => {
    // Entry: 100, SL: 90, Cap: 10 -> Loss should be -1
    const pnl = calculateSlLoss('long', 100, 90, 10);
    assert.ok(Math.abs(pnl + 1.0) < 0.0001, `Expected -1.0, got ${pnl}`);
});

runTest('Long: Entry Triggered (Price >= Target)', () => {
    assert.equal(isPriceTriggered('long', 100, 100, false), true);
    assert.equal(isPriceTriggered('long', 101, 100, false), true);
    assert.equal(isPriceTriggered('long', 99, 100, false), false);
});

runTest('Long: SL Triggered (Price <= Target)', () => {
    assert.equal(isPriceTriggered('long', 100, 100, true), true);
    assert.equal(isPriceTriggered('long', 99, 100, true), true);
    assert.equal(isPriceTriggered('long', 101, 100, true), false);
});

// ==========================================
// Short Position Tests
// ==========================================
runTest('Short: TP Hit Profit Calculation', () => {
    // Entry: 100, TP: 90, Cap: 10 -> Profit should be 1
    const pnl = calculateTpProfit('short', 100, 90, 10);
    assert.ok(Math.abs(pnl - 1.0) < 0.0001, `Expected 1.0, got ${pnl}`);
});

runTest('Short: SL Hit Loss Calculation', () => {
    // Entry: 100, SL: 110, Cap: 10 -> Loss should be -1
    const pnl = calculateSlLoss('short', 100, 110, 10);
    assert.ok(Math.abs(pnl + 1.0) < 0.0001, `Expected -1.0, got ${pnl}`);
});

runTest('Short: Entry Triggered (Price <= Target)', () => {
    assert.equal(isPriceTriggered('short', 100, 100, false), true);
    assert.equal(isPriceTriggered('short', 99, 100, false), true);
    assert.equal(isPriceTriggered('short', 101, 100, false), false);
});

runTest('Short: SL Triggered (Price >= Target)', () => {
    assert.equal(isPriceTriggered('short', 100, 100, true), true);
    assert.equal(isPriceTriggered('short', 101, 100, true), true);
    assert.equal(isPriceTriggered('short', 99, 100, true), false);
});

// ==========================================
// Edge Cases
// ==========================================
runTest('Edge: Zero Capital', () => {
    const pnl = calculateTpProfit('long', 100, 110, 0);
    assert.equal(pnl, 0);
});

runTest('Edge: Large Numbers', () => {
    // Entry: 1,000,000, TP: 1,100,000, Profit 10%
    const pnl = calculateTpProfit('long', 1000000, 1100000, 10);
    assert.ok(Math.abs(pnl - 1.0) < 0.0001);
});

console.log(`\nResults: ${passed} passed, ${failed} failed.`);

if (failed > 0) {
    process.exit(1);
}
