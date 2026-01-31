/**
 * Trade Sync Logic
 * ================
 * This module handles automatic trade state evaluation and PnL calculation.
 * 
 * Trade States:
 * - pending_entry: Waiting for price to reach entry_price
 * - entered: Position is active, monitoring TPs and SL
 * - tp_all_hit: All TPs hit, trade closed with profit
 * - tp_partial_then_sl: Some TPs hit then SL hit
 * - sl_hit: SL hit without any TP, closed with loss
 * 
 * Capital Model:
 * - Each strategy starts with 1000 USD virtual balance
 * - Each trade uses fixed 10 USD position size
 * - PnL is calculated as percentage gain/loss on position
 */

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getEthPrice } from './price';

interface Trade {
    id: string;
    user_id: string;
    direction: 'long' | 'short';
    entry_price: number;
    sl: number;
    status: string;
    pnl: number;
    position_size: number;
    remaining_position: number;
    trade_tps: TakeProfit[];
}

interface TakeProfit {
    id: string;
    trade_id: string;
    tp_price: number;
    is_hit: boolean;
    hit_at: string | null;
    pnl_portion: number;
}

// ============================================
// PnL Calculation Helpers
// ============================================
import { calculateTpProfit, calculateSlLoss, isPriceTriggered } from './pnl-calculations';

// ============================================
// Main Sync Function
// ============================================

export async function syncTrades() {
    const currentPrice = await getEthPrice();
    const adminClient = createAdminClient();

    // Use admin client if available (bypasses RLS), otherwise try session client
    const supabase = adminClient || await createClient();

    if (!adminClient) {
        console.warn('[Trade Sync] Admin client not available (missing SUPABASE_SERVICE_ROLE_KEY). Using session client.');
        // Verify session
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error('[Trade Sync] No authenticated user found for session client. Sync may fail due to RLS.');
        } else {
            console.log(`[Trade Sync] Running as user: ${user.id}`);
        }
    } else {
        console.log('[Trade Sync] Running with Admin privileges (RLS bypassed).');
    }

    console.log(`[Trade Sync] Starting sync. ETH Price: $${currentPrice.toFixed(2)}`);

    // ========================================
    // Phase 1: Handle pending_entry -> entered
    // ========================================
    await handlePendingEntries(supabase, currentPrice);

    // ========================================
    // Phase 2: Handle entered trades (TPs and SL)
    // ========================================
    await handleEnteredTrades(supabase, currentPrice);

    console.log('[Trade Sync] Sync completed');
}

/**
 * Process trades waiting for entry price to be reached
 */
async function handlePendingEntries(supabase: any, currentPrice: number) {
    const { data: pendingTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('status', 'pending_entry');

    if (error) {
        console.error('[Trade Sync] Error fetching pending trades:', error);
        return;
    }

    for (const trade of pendingTrades || []) {
        // 1. Check if SL was hit BEFORE entry (Invalidates setup)
        const slHitBeforeEntry = isPriceTriggered(
            trade.direction,
            currentPrice,
            trade.sl,
            true // is stop loss
        );

        if (slHitBeforeEntry) {
            const { error: cancelError } = await supabase
                .from('trades')
                .update({ status: 'cancelled' })
                .eq('id', trade.id);

            if (cancelError) {
                console.error(`[Trade Sync] Error cancelling trade ${trade.id}:`, cancelError);
            } else {
                console.log(`[Trade Sync] Trade ${trade.id} cancelled (SL hit before entry) at $${currentPrice.toFixed(2)}`);
            }
            continue; // Move to next trade
        }

        // 2. Check if Entry reached
        const triggered = isPriceTriggered(
            trade.direction,
            currentPrice,
            trade.entry_price,
            false // not stop loss
        );

        if (triggered) {
            const { error: updateError } = await supabase
                .from('trades')
                .update({ status: 'entered' })
                .eq('id', trade.id);

            if (updateError) {
                console.error(`[Trade Sync] Error updating trade ${trade.id}:`, updateError);
            } else {
                console.log(`[Trade Sync] Trade ${trade.id} entered at $${currentPrice.toFixed(2)}`);
            }
        }
    }
}

/**
 * Process active trades - check TPs and SL
 */
async function handleEnteredTrades(supabase: any, currentPrice: number) {
    const { data: enteredTrades, error } = await supabase
        .from('trades')
        .select('*, trade_tps(*)')
        .eq('status', 'entered');

    if (error) {
        console.error('[Trade Sync] Error fetching entered trades:', error);
        return;
    }

    for (const trade of enteredTrades || []) {
        await processTrade(supabase, trade as Trade, currentPrice);
    }
}

/**
 * Process a single entered trade
 */
async function processTrade(supabase: any, trade: Trade, currentPrice: number) {
    const tps = trade.trade_tps || [];
    const totalTps = tps.length;
    const unhitTps = tps.filter(tp => !tp.is_hit);
    const hitTps = tps.filter(tp => tp.is_hit);

    // Safety defaults if migration wasn't run
    const positionSize = trade.position_size ?? 1000;
    const remainingPosition = trade.remaining_position ?? 1000;

    // Capital allocated per TP = position_size / total_tps
    const capitalPerTp = totalTps > 0 ? positionSize / totalTps : 0;

    // ========================================
    // Check Stop Loss First
    // ========================================
    const slTriggered = isPriceTriggered(
        trade.direction,
        currentPrice,
        trade.sl,
        true // is stop loss
    );

    if (slTriggered) {
        await handleStopLoss(supabase, trade, currentPrice, hitTps.length > 0);
        return;
    }

    // ========================================
    // Check Take Profits
    // ========================================
    let tpsHitThisSync = 0;
    let totalNewPnl = 0;
    let newRemainingPosition = remainingPosition;

    for (const tp of unhitTps) {
        const tpPrice = Number(tp.tp_price); // Ensure number
        const tpTriggered = isPriceTriggered(
            trade.direction,
            currentPrice,
            tpPrice,
            false // not stop loss
        );

        if (tpTriggered) {
            console.log(`[Trade Sync] TP Hit Triggered: Trade ${trade.id}, TP Price: ${tp.tp_price}, Current: ${currentPrice}`);

            // Calculate PnL for this TP
            const tpProfit = calculateTpProfit(
                trade.direction,
                trade.entry_price,
                tp.tp_price,
                capitalPerTp
            );

            // Update TP record
            const { error: tpError } = await supabase
                .from('trade_tps')
                .update({
                    is_hit: true,
                    hit_at: new Date().toISOString(),
                    pnl_portion: tpProfit
                })
                .eq('id', tp.id);

            if (tpError) {
                console.error(`[Trade Sync] Error updating TP ${tp.id}:`, tpError);
                continue;
            }

            console.log(`[Trade Sync] Successfully marked TP ${tp.id} as hit in database`);

            tpsHitThisSync++;
            totalNewPnl += tpProfit;
            newRemainingPosition -= capitalPerTp;

            console.log(
                `[Trade Sync] Trade ${trade.id} hit TP at $${tp.tp_price.toFixed(2)}. ` +
                `Profit: $${tpProfit.toFixed(4)}`
            );
        }
    }

    // ========================================
    // Update Trade State
    // ========================================
    if (tpsHitThisSync > 0) {
        const newTotalPnl = (trade.pnl || 0) + totalNewPnl;
        const totalHitTps = hitTps.length + tpsHitThisSync;

        // Check if all TPs are now hit
        if (totalHitTps === totalTps) {
            // All TPs hit - close trade
            await closeTrade(
                supabase,
                trade,
                'tp_all_hit',
                newTotalPnl,
                currentPrice
            );
        } else {
            // Some TPs hit but not all - update trade
            await supabase
                .from('trades')
                .update({
                    pnl: newTotalPnl,
                    remaining_position: Math.max(0, newRemainingPosition)
                })
                .eq('id', trade.id);
        }
    }
}

/**
 * Handle stop-loss trigger
 */
async function handleStopLoss(
    supabase: any,
    trade: Trade,
    currentPrice: number,
    hadPartialTps: boolean
) {
    // Safety default if migration wasn't run
    const remainingPosition = trade.remaining_position ?? 1000;

    // Calculate SL loss on remaining position
    const slLoss = calculateSlLoss(
        trade.direction,
        trade.entry_price,
        trade.sl,
        remainingPosition
    );

    const finalPnl = (trade.pnl || 0) + slLoss;
    const finalStatus = hadPartialTps ? 'tp_partial_then_sl' : 'sl_hit';

    console.log(
        `[Trade Sync] Trade ${trade.id} hit SL at $${trade.sl.toFixed(2)}. ` +
        `Entry: $${trade.entry_price}, Direction: ${trade.direction}, ` +
        `Remaining: $${remainingPosition}. Loss: $${slLoss.toFixed(4)}. ` +
        `Final PnL: $${finalPnl.toFixed(4)}. Status: ${finalStatus}`
    );

    await closeTrade(supabase, trade, finalStatus, finalPnl, currentPrice);
}

/**
 * Close a trade and update strategy balance
 */
async function closeTrade(
    supabase: any,
    trade: Trade,
    status: 'tp_all_hit' | 'tp_partial_then_sl' | 'sl_hit',
    finalPnl: number,
    exitPrice: number
) {
    // Update trade status
    const { error: tradeError } = await supabase
        .from('trades')
        .update({
            status,
            pnl: finalPnl,
            exit_price: exitPrice,
            is_sl_hit: status !== 'tp_all_hit',
            remaining_position: 0
        })
        .eq('id', trade.id);

    if (tradeError) {
        console.error(`[Trade Sync] Error closing trade ${trade.id}:`, tradeError);
        return;
    }

    // Get AI strategy attribution
    const { data: attribution } = await supabase
        .from('trade_ai_attribution')
        .select('id, ai_strategy_id')
        .eq('trade_id', trade.id)
        .single();

    if (attribution) {
        // Record in AI results
        await supabase.from('ai_results').insert({
            trade_ai_attribution_id: attribution.id,
            pnl: finalPnl
        });

        // Update strategy balance
        const { data: strategy } = await supabase
            .from('ai_strategies')
            .select('balance')
            .eq('id', attribution.ai_strategy_id)
            .single();

        if (strategy) {
            const newBalance = strategy.balance + finalPnl;
            await supabase
                .from('ai_strategies')
                .update({ balance: newBalance })
                .eq('id', attribution.ai_strategy_id);

            console.log(
                `[Trade Sync] Updated strategy balance: ` +
                `${strategy.balance.toFixed(2)} -> ${newBalance.toFixed(2)}`
            );
        }
    }

    console.log(`[Trade Sync] Trade ${trade.id} closed. Status: ${status}, PnL: $${finalPnl.toFixed(4)}`);
}
