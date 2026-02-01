"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ETHPriceChart from "@/components/charts/ETHPriceChart";
import { getEthPrice } from "@/lib/price";
import { PnLCalculator } from "@/lib/trade/pnl-calculator";

// Components
import { StrategyCards } from "@/components/dashboard/strategy-cards";
import { TradesTable } from "@/components/dashboard/trades-table";
import { STATUS_CONFIG } from "@/components/dashboard/status-badge";
import { runTradeMigration } from "@/lib/trade/migration";

// Types
import { Trade, StrategyStats, TradeStatus, TakeProfit } from "@/components/dashboard/types";

export default function DashboardPage() {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [strategies, setStrategies] = useState<StrategyStats[]>([]);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);

    const supabase = createClient();

    // ----------------------------------------------------
    // LIVE STATS CALCULATION
    // ----------------------------------------------------
    const strategyStats = useMemo(() => {
        const statsMap = new Map<string, StrategyStats>();

        // Initialize from strategies
        strategies.forEach(s => {
            statsMap.set(s.id, {
                id: s.id,
                name: s.name,
                balance: s.balance,
                pnl: 0,
                trades: 0,
                wins: 0
            });
        });

        // Loop through trades and aggregate
        trades.forEach(t => {
            const entry = Number(t.entry_price);
            let tradePnL = Number(t.pnl);

            // Add floating PnL for active trades
            if (t.status === 'entered' && currentPrice && t.remaining_position > 0) {
                const floating = PnLCalculator.calculatePnL(
                    t.direction,
                    entry,
                    currentPrice,
                    t.remaining_position
                );
                tradePnL += floating;
            }

            // Find which strategy this trade belongs to
            const stat = Array.from(statsMap.values()).find(s => s.name === t.ai_name);
            if (stat) {
                stat.trades += 1;
                stat.pnl += tradePnL;
                if (tradePnL > 0) stat.wins += 1;
            }
        });

        return Array.from(statsMap.values());
    }, [trades, currentPrice, strategies]);

    useEffect(() => {
        // Initial Fetch
        fetchDashboardData();
        fetchPrice();

        // Polling for Data (10s) and Price (5s)
        const dataInterval = setInterval(fetchDashboardData, 10000);
        const priceInterval = setInterval(fetchPrice, 5000);

        return () => {
            clearInterval(dataInterval);
            clearInterval(priceInterval);
        };
    }, []);

    const fetchPrice = async () => {
        try {
            const price = await getEthPrice();
            setCurrentPrice(price);
        } catch (err) {
            console.error("Failed to fetch price", err);
        }
    };

    const fetchDashboardData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                setLoading(false);
                return;
            }

            // 1. Fetch Trades with related Strategy info and TPs
            const { data: tradeData, error: tradeError } = await supabase
                .from("trades")
                .select(`
                  *,
                  trade_tps (
                    id,
                    tp_price,
                    is_hit,
                    hit_at,
                    pnl_portion
                  ),
                  trade_ai_attribution (
                    ai_strategies (
                      id,
                      name
                    )
                  )
                `)
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (tradeError) throw tradeError;

            const formattedTrades = (tradeData || []).map((t: any) => ({
                id: t.id,
                direction: t.direction,
                entry_price: t.entry_price,
                sl: t.sl,
                status: t.status as TradeStatus,
                created_at: t.created_at,
                pnl: t.pnl || 0,
                remaining_position: t.remaining_position || 0,
                ai_name: t.trade_ai_attribution?.[0]?.ai_strategies?.name || "None",
                tps: (t.trade_tps || []).sort((a: TakeProfit, b: TakeProfit) => a.tp_price - b.tp_price),
            }));

            setTrades(formattedTrades);

            // ----------------------------------------------------
            // AUTO-MIGRATION
            // ----------------------------------------------------
            const migrationRan = await runTradeMigration(supabase, tradeData);
            if (migrationRan) {
                // Refresh data after migration
                fetchDashboardData();
                return;
            }

            // 2. Fetch AI Strategies with balances
            const { data: strategyData, error: strategyError } = await supabase
                .from("ai_strategies")
                .select("id, name, balance");

            if (strategyError) throw strategyError;

            setStrategies((strategyData || []).map((s: any) => ({
                id: s.id,
                name: s.name,
                balance: s.balance,
                pnl: 0,
                trades: 0,
                wins: 0
            })));

        } catch (error: any) {
            console.error("Error fetching dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (trade: Trade, newStatus: TradeStatus) => {
        try {
            const updates: any = { status: newStatus };

            // If closing the trade manually, lock in the current PnL
            const isClosing = ["tp_all_hit", "sl_hit", "tp_partial_then_sl", "cancelled"].includes(newStatus);
            const wasActive = ["entered", "pending_entry"].includes(trade.status);

            if (isClosing && wasActive && currentPrice) {
                updates.exit_price = currentPrice;
                updates.remaining_position = 0;

                // Simple PnL calculation for manual close
                // We utilize the new PnLCalculator for consistency
                const floatingPnl = PnLCalculator.calculatePnL(
                    trade.direction,
                    trade.entry_price,
                    currentPrice,
                    trade.remaining_position
                );

                updates.pnl = (trade.pnl || 0) + floatingPnl;
            } else if (newStatus === 'entered' && trade.status === 'pending_entry') {
                updates.remaining_position = trade.remaining_position || 1000;
            }

            const { error } = await supabase
                .from("trades")
                .update(updates)
                .eq("id", trade.id);

            if (error) throw error;

            toast.success(`Trade marked as ${STATUS_CONFIG[newStatus].label}`);
            fetchDashboardData();
        } catch (error: any) {
            console.error("Error updating status:", error);
            toast.error("Failed to update status");
        }
    };

    const handleDeleteTrade = async (tradeId: string) => {
        try {
            const { error } = await supabase
                .from("trades")
                .delete()
                .eq("id", tradeId);

            if (error) throw error;

            toast.success("Trade deleted successfully");
            setTrades((prev) => prev.filter((t) => t.id !== tradeId));
            fetchDashboardData();
        } catch (error: any) {
            console.error("Error deleting trade:", error);
            toast.error("Failed to delete trade");
        }
    };

    return (
        <div className="container max-w-7xl mx-auto py-10 px-6 space-y-8">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground mt-1">
                        Track your AI strategies and paper trades simulation.
                    </p>
                </div>
                <Link href="/trades/create">
                    <Button size="lg" className="shadow-sm">
                        <Plus className="mr-2 h-4 w-4" /> New Paper Trade
                    </Button>
                </Link>
            </div>

            <div className="rounded-xl border bg-background shadow-sm overflow-hidden min-h-[500px]">
                <ETHPriceChart />
            </div>

            {/* Strategy Cards */}
            <div className="grid gap-6 md:grid-cols-3">
                <StrategyCards strategies={strategyStats} />
            </div>

            {/* Recent Trades Table */}
            <TradesTable
                trades={trades}
                loading={loading}
                currentPrice={currentPrice}
                onUpdateStatus={handleUpdateStatus}
                onDeleteTrade={handleDeleteTrade}
            />
        </div>
    );
}
