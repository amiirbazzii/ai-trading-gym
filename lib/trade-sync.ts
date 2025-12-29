import { createClient } from '@/utils/supabase/server';

const BINANCE_API = 'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT';

export async function getEthPrice(): Promise<number> {
    try {
        const response = await fetch(BINANCE_API);
        const data = await response.json();
        return parseFloat(data.price);
    } catch (error) {
        console.error('Error fetching ETH price:', error);
        throw error;
    }
}

export async function syncTrades() {
    const currentPrice = await getEthPrice();
    const supabase = await createClient();

    // 1. Handle Pending Trades -> Open
    const { data: pendingTrades, error: pendingError } = await supabase
        .from('trades')
        .select('*')
        .eq('status', 'pending');

    if (pendingError) console.error('Error fetching pending trades:', pendingError);

    for (const trade of pendingTrades || []) {
        // For Long: price >= entry
        // For Short: price <= entry
        const triggered = trade.direction === 'long'
            ? currentPrice >= trade.entry_price
            : currentPrice <= trade.entry_price;

        if (triggered) {
            await supabase
                .from('trades')
                .update({ status: 'open' })
                .eq('id', trade.id);
            console.log(`Trade ${trade.id} opened at ${currentPrice}`);
        }
    }

    // 2. Handle Open Trades -> Check SL and TPs
    const { data: openTrades, error: openError } = await supabase
        .from('trades')
        .select('*, trade_tps(*)')
        .eq('status', 'open');

    if (openError) console.error('Error fetching open trades:', openError);

    for (const trade of openTrades || []) {
        let closed = false;
        let finalPnl = trade.pnl;
        let exitPrice = null;

        // Check SL
        const slHit = trade.direction === 'long'
            ? currentPrice <= trade.sl
            : currentPrice >= trade.sl;

        if (slHit) {
            // Calculate loss
            const loss = Math.abs(currentPrice - trade.entry_price);
            finalPnl -= loss; // This is a simplistic PnL calculation

            await supabase
                .from('trades')
                .update({
                    status: 'closed',
                    is_sl_hit: true,
                    pnl: finalPnl,
                    exit_price: currentPrice
                })
                .eq('id', trade.id);

            // Record in AI results
            const { data: attribution } = await supabase
                .from('trade_ai_attribution')
                .select('id')
                .eq('trade_id', trade.id)
                .single();

            if (attribution) {
                await supabase.from('ai_results').insert({
                    trade_ai_attribution_id: attribution.id,
                    pnl: finalPnl
                });
            }

            console.log(`Trade ${trade.id} hit SL at ${currentPrice}. Final PnL: ${finalPnl}`);
            continue; // Move to next trade
        }

        // Check TPs
        const tps = trade.trade_tps || [];
        const unhitTps = tps.filter((tp: any) => !tp.is_hit);

        for (const tp of unhitTps) {
            const tpTriggered = trade.direction === 'long'
                ? currentPrice >= tp.tp_price
                : currentPrice <= tp.tp_price;

            if (tpTriggered) {
                // Mark TP as hit
                await supabase
                    .from('trade_tps')
                    .update({ is_hit: true })
                    .eq('id', tp.id);

                // Record profit for this TP
                const profit = Math.abs(tp.tp_price - trade.entry_price);
                finalPnl += profit;

                console.log(`Trade ${trade.id} hit TP ${tp.tp_price}. Current PnL: ${finalPnl}`);
            }
        }

        // Check if all TPs hit
        const { count: unhitCount } = await supabase
            .from('trade_tps')
            .select('id', { count: 'exact', head: true })
            .eq('trade_id', trade.id)
            .eq('is_hit', false);

        if (unhitCount === 0 && tps.length > 0) {
            await supabase
                .from('trades')
                .update({
                    status: 'closed',
                    pnl: finalPnl,
                    exit_price: currentPrice
                })
                .eq('id', trade.id);

            // Record in AI results
            const { data: attribution } = await supabase
                .from('trade_ai_attribution')
                .select('id')
                .eq('trade_id', trade.id)
                .single();

            if (attribution) {
                await supabase.from('ai_results').insert({
                    trade_ai_attribution_id: attribution.id,
                    pnl: finalPnl
                });
            }

            console.log(`Trade ${trade.id} completed all TPs. Final PnL: ${finalPnl}`);
        } else if (finalPnl !== trade.pnl) {
            // Update incidental PnL from TPs
            await supabase
                .from('trades')
                .update({ pnl: finalPnl })
                .eq('id', trade.id);
        }
    }
}
