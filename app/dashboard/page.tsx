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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Types
import { Trade, StrategyStats, TradeStatus, TakeProfit } from "@/components/dashboard/types";

export default function DashboardPage() {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [strategies, setStrategies] = useState<StrategyStats[]>([]);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [editingStrategy, setEditingStrategy] = useState<StrategyStats | null>(null);
    const [editName, setEditName] = useState("");

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
                wins: 0,
                user_id: s.user_id
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
            const res = await fetch('/api/price');
            const data = await res.json();
            if (data.price) {
                setCurrentPrice(data.price);
            }
        } catch (err) {
            console.error("Failed to fetch price", err);
        }
    };

    const fetchDashboardData = async () => {
        try {
            // Trigger background sync
            fetch("/api/trades/sync").catch(err => console.error("Sync failed", err));

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
            // We use a safe fetch here in case the user_id column hasn't been added yet
            const { data: strategyData, error: strategyError } = await supabase
                .from("ai_strategies")
                .select("id, name, balance, user_id");

            let finalStrategyData: any[] = strategyData || [];

            if (strategyError) {
                console.warn("[Dashboard] Could not fetch user_id from strategies, falling back...", strategyError.message);
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from("ai_strategies")
                    .select("id, name, balance");

                if (fallbackError) throw fallbackError;
                finalStrategyData = fallbackData || [];
            }

            setStrategies((finalStrategyData || []).map((s: any) => ({
                id: s.id,
                name: s.name,
                balance: s.balance,
                pnl: 0,
                trades: 0,
                wins: 0,
                user_id: s.user_id || "public"
            })));

        } catch (error: any) {
            console.error("Error fetching dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteStrategy = async (strategyId: string) => {
        if (!confirm("Are you sure? This will not delete trades, but they will be unassigned.")) return;
        try {
            const { error } = await supabase.from("ai_strategies").delete().eq("id", strategyId);
            if (error) throw error;
            toast.success("Strategy deleted");
            fetchDashboardData();
        } catch (error: any) {
            toast.error("Failed to delete strategy");
        }
    };

    const handleEditStrategy = (strategy: StrategyStats) => {
        setEditingStrategy(strategy);
        setEditName(strategy.name);
    };

    const saveStrategyEdit = async () => {
        if (!editingStrategy || !editName) return;
        try {
            const { error } = await supabase
                .from("ai_strategies")
                .update({ name: editName })
                .eq("id", editingStrategy.id);
            if (error) throw error;
            toast.success("Strategy updated");
            setEditingStrategy(null);
            fetchDashboardData();
        } catch (error: any) {
            toast.error("Failed to update strategy");
        }
    };

    const handleUpdateStatus = async (trade: Trade, newStatus: TradeStatus) => {
        try {
            const updates: any = { status: newStatus };

            // If closing the trade manually, lock in the current PnL
            const isClosing = ["tp_all_hit", "sl_hit", "tp_partial_then_sl"].includes(newStatus);
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
        <div className="container max-w-7xl mx-auto py-6 md:py-10 px-4 md:px-6 space-y-6 md:space-y-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="space-y-1">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-sm md:text-base text-muted-foreground">
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
                <StrategyCards
                    strategies={strategyStats}
                    onDelete={handleDeleteStrategy}
                    onEdit={handleEditStrategy}
                />
            </div>

            {/* Edit Strategy Dialog */}
            <Dialog open={!!editingStrategy} onOpenChange={(open) => !open && setEditingStrategy(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Strategy</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Strategy Name</Label>
                            <Input
                                id="name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="Enter strategy name"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingStrategy(null)}>Cancel</Button>
                        <Button onClick={saveStrategyEdit}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
