import { SupabaseClient } from "@supabase/supabase-js";

export async function runTradeMigration(supabase: SupabaseClient, tradeData: any[]) {
    // ----------------------------------------------------
    // AUTO-MIGRATION: Update old $10 trades to $1,000 & Fix 0 PnL Closed Trades
    // ----------------------------------------------------
    const oldTrades = (tradeData || []).filter((t: any) =>
        Number(t.position_size) !== 1000 ||
        (Number(t.pnl) === 0 && ['tp_all_hit', 'sl_hit', 'tp_partial_then_sl'].includes(t.status))
    );

    if (oldTrades.length > 0) {
        console.log(`[Migration] Processing ${oldTrades.length} trades...`);
        for (const trade of oldTrades) {
            const totalTps = trade.trade_tps?.length || 0;
            const newPositionSize = 1000;
            const capitalPerTp = totalTps > 0 ? newPositionSize / totalTps : 0;

            let newRealizedPnl = 0;
            const hitTpsCount = trade.trade_tps?.filter((tp: any) => tp.is_hit || trade.status === 'tp_all_hit').length || 0;

            for (const tp of (trade.trade_tps || [])) {
                // If status is tp_all_hit, treat all TPs as hit
                const isHit = tp.is_hit || trade.status === 'tp_all_hit';

                if (isHit) {
                    const pnlFactor = trade.direction === 'long'
                        ? (Number(tp.tp_price) - Number(trade.entry_price)) / Number(trade.entry_price)
                        : (Number(trade.entry_price) - Number(tp.tp_price)) / Number(trade.entry_price);
                    const newPortion = pnlFactor * capitalPerTp;

                    await supabase.from('trade_tps').update({
                        pnl_portion: newPortion,
                        is_hit: true // Fix hit status if it was missing
                    }).eq('id', tp.id);

                    newRealizedPnl += newPortion;
                }
            }

            // Calculate SL loss if applicable
            let slLoss = 0;
            if (trade.status === 'sl_hit' || trade.status === 'tp_partial_then_sl') {
                const remainingCount = totalTps - hitTpsCount;
                const remainingCap = remainingCount * capitalPerTp;
                const slFactor = trade.direction === 'long'
                    ? (Number(trade.sl) - Number(trade.entry_price)) / Number(trade.entry_price)
                    : (Number(trade.entry_price) - Number(trade.sl)) / Number(trade.entry_price);
                slLoss = slFactor * remainingCap;
            }

            const finalTotalPnl = newRealizedPnl + slLoss;
            const newRemaining = trade.status === 'tp_all_hit' ? 0 : Math.max(0, newPositionSize - (hitTpsCount * capitalPerTp));

            console.log(`[Migration] Updating Trade ${trade.id}: PnL -> ${finalTotalPnl.toFixed(2)}`);

            await supabase.from('trades').update({
                position_size: newPositionSize,
                remaining_position: newRemaining,
                pnl: finalTotalPnl
            }).eq('id', trade.id);
        }
        return true; // Indicates migration ran
    }
    return false;
}
