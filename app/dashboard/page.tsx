"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, Activity, TrendingUp, TrendingDown } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ETHPriceChart from "@/components/charts/ETHPriceChart";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";

interface Trade {
    id: string;
    direction: "long" | "short";
    entry_price: number;
    sl: number;
    status: string;
    created_at: string;
    pnl?: string;
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
                pnl: "0.00%",
                ai_name: t.trade_ai_attribution?.[0]?.ai_strategies?.name || "None",
            }));

            setTrades(formattedTrades);

            // 2. Mock Stats Calculation
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

            <div className="grid gap-6 md:grid-cols-3">
                {strategies.length > 0 ? (
                    strategies.map((strategy) => (
                        <Card key={strategy.name} className="bg-card hover:bg-accent/5 transition-colors">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {strategy.name}
                                </CardTitle>
                                <Activity className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{strategy.trades}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Total Executed Trades
                                </p>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/30 rounded-xl border border-dashed">
                        No strategies active yet. Create a trade to see stats.
                    </div>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Trades</CardTitle>
                    <CardDescription>A list of your recent simulation trades.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Strategy</TableHead>
                                <TableHead>Direction</TableHead>
                                <TableHead>Entry Price</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">PnL (Est)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">Loading trades...</TableCell>
                                </TableRow>
                            ) : trades.length > 0 ? (
                                trades.map((trade) => (
                                    <TableRow key={trade.id}>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}
                                        </TableCell>
                                        <TableCell className="font-medium">{trade.ai_name}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "border-none",
                                                    trade.direction === 'long'
                                                        ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                                                )}
                                            >
                                                {trade.direction === "long" ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                                                {trade.direction.toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>${trade.entry_price.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize">
                                                {trade.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-muted-foreground">
                                            {trade.pnl}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No recent trades found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
