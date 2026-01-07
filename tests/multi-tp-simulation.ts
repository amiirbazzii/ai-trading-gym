import { calculateTpProfit, calculateSlLoss } from '../lib/pnl-calculations';

// Setup common parameters
const ENTRY_PRICE = 100;
const POSITION_SIZE = 30; // $30 total to make math easy ($10 per TP)
const NUM_TPS = 3;
const CAPITAL_PER_TP = POSITION_SIZE / NUM_TPS; // $10

const TP1_PRICE = 105; // +5%
const TP2_PRICE = 110; // +10%
const TP3_PRICE = 115; // +15%
const SL_PRICE = 95;   // -5%

console.log('--- Parameter Setup ---');
console.log(`Entry: $${ENTRY_PRICE}`);
console.log(`Position Size: $${POSITION_SIZE}`);
console.log(`TP Levels: $${TP1_PRICE}, $${TP2_PRICE}, $${TP3_PRICE}`);
console.log(`SL Level: $${SL_PRICE}`);
console.log(`Capital per TP: $${CAPITAL_PER_TP}`);
console.log('-----------------------\n');

// Scenario 1: Wins All 3 TPs
function runScenario1() {
    console.log('Scenario 1: Win All 3 TPs');
    let pnl = 0;
    let remaining = POSITION_SIZE;

    // TP1 Hit
    const gain1 = calculateTpProfit('long', ENTRY_PRICE, TP1_PRICE, CAPITAL_PER_TP);
    pnl += gain1;
    remaining -= CAPITAL_PER_TP;
    console.log(`TP1 Hit: Gain $${gain1.toFixed(2)}, Remaining Pos: $${remaining}`);

    // TP2 Hit
    const gain2 = calculateTpProfit('long', ENTRY_PRICE, TP2_PRICE, CAPITAL_PER_TP);
    pnl += gain2;
    remaining -= CAPITAL_PER_TP;
    console.log(`TP2 Hit: Gain $${gain2.toFixed(2)}, Remaining Pos: $${remaining}`);

    // TP3 Hit
    const gain3 = calculateTpProfit('long', ENTRY_PRICE, TP3_PRICE, CAPITAL_PER_TP);
    pnl += gain3;
    remaining -= CAPITAL_PER_TP;
    console.log(`TP3 Hit: Gain $${gain3.toFixed(2)}, Remaining Pos: $${remaining}`);

    console.log(`TOTAL PnL: $${pnl.toFixed(2)}\n`);
}

// Scenario 2: Wins 2 TPs then SL
function runScenario2() {
    console.log('Scenario 2: Win 2 TPs then SL');
    let pnl = 0;
    let remaining = POSITION_SIZE;

    // TP1 Hit
    const gain1 = calculateTpProfit('long', ENTRY_PRICE, TP1_PRICE, CAPITAL_PER_TP);
    pnl += gain1;
    remaining -= CAPITAL_PER_TP;
    console.log(`TP1 Hit: Gain $${gain1.toFixed(2)}, Remaining Pos: $${remaining}`);

    // TP2 Hit
    const gain2 = calculateTpProfit('long', ENTRY_PRICE, TP2_PRICE, CAPITAL_PER_TP);
    pnl += gain2;
    remaining -= CAPITAL_PER_TP;
    console.log(`TP2 Hit: Gain $${gain2.toFixed(2)}, Remaining Pos: $${remaining}`);

    // SL Hit (Remaining part of position)
    // Note: SL loss is calculated on remaining capital
    const loss = calculateSlLoss('long', ENTRY_PRICE, SL_PRICE, remaining);
    pnl += loss;
    console.log(`SL Hit: Loss $${loss.toFixed(2)} (on $${remaining} remaining)`);

    console.log(`TOTAL PnL: $${pnl.toFixed(2)}\n`);
}

// Scenario 3: Wins 1 TP then SL
function runScenario3() {
    console.log('Scenario 3: Win 1 TP then SL');
    let pnl = 0;
    let remaining = POSITION_SIZE;

    // TP1 Hit
    const gain1 = calculateTpProfit('long', ENTRY_PRICE, TP1_PRICE, CAPITAL_PER_TP);
    pnl += gain1;
    remaining -= CAPITAL_PER_TP;
    console.log(`TP1 Hit: Gain $${gain1.toFixed(2)}, Remaining Pos: $${remaining}`);

    // SL Hit (Remaining part of position, which covers TP2 and TP3 portions)
    const loss = calculateSlLoss('long', ENTRY_PRICE, SL_PRICE, remaining);
    pnl += loss;
    console.log(`SL Hit: Loss $${loss.toFixed(2)} (on $${remaining} remaining)`);

    console.log(`TOTAL PnL: $${pnl.toFixed(2)}\n`);
}

runScenario1();
runScenario2();
runScenario3();
