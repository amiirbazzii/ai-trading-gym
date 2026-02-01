import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getEthPrice } from '../price';
import { Trade, TradeStatus } from './types';
import { StatusManager } from './status-manager';
import { PnLCalculator } from './pnl-calculator';

export class TradeService {
    private supabase: any;

    constructor(supabaseClient?: any) {
        if (supabaseClient) {
            this.supabase = supabaseClient;
        } else {
            // Default to admin if available, else user
            const admin = createAdminClient();
            if (admin) {
                this.supabase = admin;
                console.log('[TradeService] Using Admin Client');
            } else {
                console.warn('[TradeService] Admin client missing, falling back to session client');
                // We'll init this async in methods if needed, but for now assume caller might provide or we try standard
                // Note: syncTrades usually runs in a cron/backend context so admin is expected.
            }
        }
    }

    private async getClient() {
        if (!this.supabase) {
            this.supabase = await createClient();
        }
        return this.supabase;
    }

    /**
     * Main Entry Point: Sync all trades
     */
    async syncTrades() {
        const client = await this.getClient();
        const price = await getEthPrice();
        console.log(`[TradeService] Syncing at $${price}`);

        // 1. Fetch Active Trades
        const { data: trades, error } = await client
            .from('trades')
            .select('*, trade_tps(*)')
            .in('status', ['pending_entry', 'entered']);

        if (error) {
            console.error('[TradeService] Fetch error:', error);
            return;
        }

        console.log(`[TradeService] Processing ${trades?.length || 0} trades`);

        // 2. Process Each
        for (const rawTrade of trades || []) {
            const trade = rawTrade as Trade;

            try {
                if (trade.status === 'pending_entry') {
                    await this.processPendingSafely(trade, price);
                } else if (trade.status === 'entered') {
                    await this.processEnteredSafely(trade, price);
                }
            } catch (e) {
                console.error(`[TradeService] Error processing trade ${trade.id}:`, e);
            }
        }
    }

    private async processPendingSafely(trade: Trade, price: number) {
        const result = StatusManager.checkPendingStatus(trade, price);

        if (result.shouldUpdate) {
            console.log(`[TradeService] Updating Pending Trade ${trade.id} -> ${result.updates.status}`);
            const client = await this.getClient();
            await client.from('trades').update(result.updates).eq('id', trade.id);
        }
    }

    private async processEnteredSafely(trade: Trade, price: number) {
        const result = PnLCalculator.evaluateTrade(trade, price);

        if (result.shouldUpdate) {
            const client = await this.getClient();

            // 1. Update TPs
            for (const tpUpdate of result.tpUpdates) {
                console.log(`[TradeService] TP Hit: Trade ${trade.id}, TP ${tpUpdate.id}`);
                await client.from('trade_tps').update(tpUpdate.updates).eq('id', tpUpdate.id);
            }

            // 2. Close Trade if needed
            if (result.completedAction) {
                await this.closeTrade(
                    trade,
                    result.completedAction.newStatus,
                    result.completedAction.finalPnl,
                    result.completedAction.exitPrice
                );
            }
            // 3. Just update PnL/Position if not closed
            else if (Object.keys(result.updates).length > 0) {
                console.log(`[TradeService] Updating Active Trade ${trade.id}: PnL ${result.updates.pnl}`);
                await client.from('trades').update(result.updates).eq('id', trade.id);
            }
        }
    }

    private async closeTrade(
        trade: Trade,
        status: TradeStatus,
        finalPnl: number,
        exitPrice: number
    ) {
        console.log(`[TradeService] Closing Trade ${trade.id}. Status: ${status}, PnL: ${finalPnl}`);
        const client = await this.getClient();

        // Update Trade Record
        const { error } = await client.from('trades').update({
            status,
            pnl: finalPnl,
            exit_price: exitPrice,
            remaining_position: 0,
            is_sl_hit: status !== 'tp_all_hit' // Rough heuristic, can be refined based on status
        }).eq('id', trade.id);

        if (error) {
            console.error('[TradeService] Error closing trade record:', error);
            return;
        }

        // Handle AI Strategy Balance Update
        await this.updateStrategyBalance(trade.id, finalPnl);
    }

    private async updateStrategyBalance(tradeId: string, pnl: number) {
        const client = await this.getClient();

        const { data: attribution } = await client
            .from('trade_ai_attribution')
            .select('id, ai_strategy_id')
            .eq('trade_id', tradeId)
            .single();

        if (attribution) {
            // Record AI Result
            await client.from('ai_results').insert({
                trade_ai_attribution_id: attribution.id,
                pnl: pnl
            });

            // Update Strategy Balance
            // Atomic increment is better, but simple fetch-update for now matching original logic
            const { data: strategy } = await client
                .from('ai_strategies')
                .select('balance')
                .eq('id', attribution.ai_strategy_id)
                .single();

            if (strategy) {
                const newBalance = strategy.balance + pnl;
                await client
                    .from('ai_strategies')
                    .update({ balance: newBalance })
                    .eq('id', attribution.ai_strategy_id);

                console.log(`[TradeService] Strategy ${attribution.ai_strategy_id} balance updated: ${newBalance}`);
            }
        }
    }
}
