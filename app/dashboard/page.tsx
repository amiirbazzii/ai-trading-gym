"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface Trade {
    id: string;
    direction: string;
    entry_price: number;
    sl: number;
    status: string;
    created_at: string;
    pnl?: string; // Derived or fetched
    ai_name?: string;
}

interface StrategyStats {
    name: string;
    pnl: number;
    trades: number;
    wins: number;
}

export default function DashboardPage() {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [strategies, setStrategies] = useState<StrategyStats[]>([]);

    // Create the client once
    const supabase = createClient();

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                setLoading(false);
                return;
            }

            // 1. Fetch Trades with related Strategy info
            const { data: tradeData, error: tradeError } = await supabase
                .from("trades")
                .select(`
          *,
          trade_ai_attribution (
            ai_strategies (
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
                status: t.status,
                created_at: t.created_at,
                pnl: "0.00%", // Placeholder until we have PnL logic
                ai_name: t.trade_ai_attribution?.[0]?.ai_strategies?.name || "None",
            }));

            setTrades(formattedTrades);

            // 2. Fetch/Calculate Strategy Stats (Mocked calculation for now based entirely on fetched trades if needed, or fetched from ai_results)
            // For Phase 1, we haven't populated ai_results yet, so we'll just show the unique strategies found in trades or default list.
            // Let's just group the trades by strategy for a simple stat count.

            const statsMap = new Map<string, StrategyStats>();

            formattedTrades.forEach((t) => {
                const name = t.ai_name || "Unknown";
                if (!statsMap.has(name)) {
                    statsMap.set(name, { name, pnl: 0, trades: 0, wins: 0 });
                }
                const stat = statsMap.get(name)!;
                stat.trades += 1;
            });

            setStrategies(Array.from(statsMap.values()));

        } catch (error: any) {
            console.error("Error fetching dashboard:", error);
            toast.error("Failed to load dashboard data");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-10 space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <Link href="/trades/create">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> New Paper Trade
                    </Button>
                </Link>
            </div>

            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {strategies.length > 0 ? (
                    strategies.map((strategy) => (
                        <Card key={strategy.name}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {strategy.name}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{strategy.pnl.toFixed(2)}%</div>
                                <p className="text-xs text-muted-foreground">
                                    {strategy.trades} trades • {(strategy.wins / strategy.trades * 100) || 0}% win rate
                                </p>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full text-center text-muted-foreground py-10">
                        No strategies active yet. Create a trade to see stats.
                    </div>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Trades (Simulation Only)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {loading ? (
                            <div className="text-center py-4">Loading trades...</div>
                        ) : trades.length > 0 ? (
                            trades.map((trade) => (
                                <div
                                    key={trade.id}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 last:border-0 last:pb-0 gap-2 sm:gap-0"
                                >
                                    <div>
                                        <div className="font-medium">
                                            {trade.direction.toUpperCase()} ETH @ {trade.entry_price}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            SL: {trade.sl} • Status: {trade.status} • Strategy: {trade.ai_name}
                                        </div>
                                    </div>
                                    <div className="font-bold text-gray-500 self-end sm:self-auto">
                                        OPEN
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-4 text-muted-foreground">
                                No trades found. Create your first paper trade!
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {!loading && trades.length === 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                    Debug: If you created a trade but don't see it here, ensure you are logged in and checks RLS policies.
                </div>
            )}
        </div>
    );
}
