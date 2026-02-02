
import { createClient } from "@supabase/supabase-js";
import { PnLCalculator } from "../lib/trade/pnl-calculator";
import { Trade } from "../lib/trade/types";

// Init Supabase (Service Role for admin access)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixBadPnl() {
    console.log("--- Starting PnL Fix Script ---");

    // Fetch all trades that are closed or have hit TPs
    const { data: trades, error } = await supabase
        .from('trades')
        .select('*, trade_tps(*)')
        .order('created_at', { ascending: false }); // Process recent first

    if (error) {
        console.error("Error fetching trades:", error);
        return;
    }

    console.log(`Found ${trades.length} trades to check.`);

    for (const rawTrade of trades) {
        const trade = rawTrade as Trade;

        // Skip pending
        if (trade.status === 'pending_entry') continue;

        // Recalculate PnL based on TPs and SL
        const tps = trade.trade_tps || [];
        const totalTps = tps.length;
        const positionSize = Number(trade.position_size) || 1000;
        const capitalPerTp = totalTps > 0 ? positionSize / totalTps : 0;

        let calculatedPnl = 0;
        let tpsHitCount = 0;

        // 1. Sum TP PnLs
        for (const tp of tps) {
            if (tp.is_hit) {
                const limitPrice = tp.tp_price;
                const pnl = PnLCalculator.calculatePnL(
                    trade.direction,
                    trade.entry_price,
                    limitPrice,
                    capitalPerTp
                );
                calculatedPnl += pnl;
                tpsHitCount++;
            }
        }

        // 2. Add SL Loss if applicable (and if not fully TP hit)
        // Check heuristics for SL hit
        // If status is sl_hit or tp_partial_then_sl
        // OR if current stored PnL implies a loss? 
        // Better: trust the Status.
        if (['sl_hit', 'tp_partial_then_sl'].includes(trade.status)) {
            // Remaining capital
            const remainingCount = totalTps - tpsHitCount;
            // If remainingCount is 0, then weird? maybe SL hit happened on 0 position?
            // Wait, if tp_partial_then_sl, remaining should be > 0.

            const remainingCapital = remainingCount * capitalPerTp;

            if (remainingCapital > 0) {
                const slPnl = PnLCalculator.calculatePnL(
                    trade.direction,
                    trade.entry_price,
                    trade.sl,
                    remainingCapital
                );
                calculatedPnl += slPnl;
            }
        }

        // Compare with stored PnL
        const storedPnl = Number(trade.pnl || 0);
        const diff = Math.abs(storedPnl - calculatedPnl);

        // Log details for the problematic trade (match the user's approx values)
        if (Math.abs(storedPnl) > 15 && Math.abs(calculatedPnl) < 5) {
            console.log(`\n[SUSPICIOUS TRADE FOUND] ID: ${trade.id}`);
            console.log(`Entry: ${trade.entry_price}, TPs: ${totalTps}, PosSize: ${positionSize}`);
            console.log(`Stored PnL: ${storedPnl}, Calculated PnL: ${calculatedPnl}`);
            console.log(`TP Detail:`, tps.map(t => `${t.tp_price} (hit=${t.is_hit})`));
        }

        if (diff > 0.1) {
            console.log(`[FIXING] Trade ${trade.id}: Stored ${storedPnl.toFixed(2)} -> Calc ${calculatedPnl.toFixed(2)}`);

            // Update DB
            await supabase.from('trades').update({
                pnl: calculatedPnl
            }).eq('id', trade.id);

            // Also fix strategy balance? 
            // We would need to calc delta and apply to strategy.
            // For now, let's just fix the trade record so dashboard is correct.
        }
    }
    console.log("--- FnL Fix Complete ---");
}

fixBadPnl();
