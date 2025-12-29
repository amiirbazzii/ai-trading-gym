"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, Activity, TrendingUp, TrendingDown, Wallet, Target, ShieldX, CheckCircle2 } from "lucide-react";
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================
// Types
// ============================================

type TradeStatus =
    | "pending_entry"
    | "entered"
    | "tp_all_hit"
    | "tp_partial_then_sl"
    | "sl_hit"
    | "cancelled";

interface TakeProfit {
    id: string;
    tp_price: number;
    is_hit: boolean;
}

interface Trade {
    id: string;
    direction: "long" | "short";
    entry_price: number;
    sl: number;
    status: TradeStatus;
    created_at: string;
    pnl: number;
    ai_name?: string;
    tps: TakeProfit[];
}

interface StrategyStats {
    id: string;
    name: string;
    balance: number;
    pnl: number;
    trades: number;
    wins: number;
}

// ============================================
// Status Badge Configurations
// ============================================

const STATUS_CONFIG: Record<TradeStatus, { label: string; className: string }> = {
    pending_entry: {
        label: "Pending Entry",
        className: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400"
    },
    entered: {
        label: "Entered",
        className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400"
    },
    tp_all_hit: {
        label: "All TPs Hit",
        className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400"
    },
    tp_partial_then_sl: {
        label: "Partial TP + SL",
        className: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400"
    },
    sl_hit: {
        label: "SL Hit",
        className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400"
    },
    cancelled: {
        label: "Cancelled",
        className: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400"
    }
};

// ============================================
// Component
// ============================================

export default function DashboardPage() {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [strategies, setStrategies] = useState<StrategyStats[]>([]);

    const supabase = createClient();

    useEffect(() => {
        fetchDashboardData();

        // Automatic sync every 30 seconds
        const syncInterval = setInterval(async () => {
            try {
                const res = await fetch('/api/trades/sync');
                if (res.ok) {
                    fetchDashboardData();
                }
            } catch (error) {
                console.error("Failed to sync trades:", error);
            }
        }, 30000);

        return () => clearInterval(syncInterval);
    }, []);

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
                    is_hit
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
                ai_name: t.trade_ai_attribution?.[0]?.ai_strategies?.name || "None",
                tps: (t.trade_tps || []).sort((a: TakeProfit, b: TakeProfit) => a.tp_price - b.tp_price),
            }));

            setTrades(formattedTrades);

            // 2. Fetch AI Strategies with balances
            const { data: strategyData, error: strategyError } = await supabase
                .from("ai_strategies")
                .select("id, name, balance");

            if (strategyError) throw strategyError;

            // Calculate stats per strategy
            const strategyStatsMap = new Map<string, StrategyStats>();

            // Initialize from strategy data
            (strategyData || []).forEach((s: any) => {
                strategyStatsMap.set(s.id, {
                    id: s.id,
                    name: s.name,
                    balance: s.balance,
                    pnl: 0,
                    trades: 0,
                    wins: 0
                });
            });

            // Aggregate trade stats
            formattedTrades.forEach((t) => {
                // Find strategy ID from trade data
                const tradeRaw = (tradeData || []).find((td: any) => td.id === t.id);
                const strategyId = tradeRaw?.trade_ai_attribution?.[0]?.ai_strategies?.id;

                if (strategyId && strategyStatsMap.has(strategyId)) {
                    const stat = strategyStatsMap.get(strategyId)!;
                    stat.trades += 1;
                    stat.pnl += t.pnl;
                    if (t.pnl > 0) stat.wins += 1;
                }
            });

            setStrategies(Array.from(strategyStatsMap.values()));

        } catch (error: any) {
            console.error("Error fetching dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: TradeStatus) => {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.cancelled;
        return (
            <Badge variant="outline" className={config.className}>
                {config.label}
            </Badge>
        );
    };

    // Format TPs display with hit indicators
    const formatTPs = (tps: TakeProfit[], direction: "long" | "short") => {
        if (tps.length === 0) return <span className="text-muted-foreground">-</span>;

        // Sort TPs by price (ascending for long, descending for short)
        const sortedTps = [...tps].sort((a, b) =>
            direction === 'long' ? a.tp_price - b.tp_price : b.tp_price - a.tp_price
        );

        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                            <Target className="h-3.5 w-3.5 text-muted-foreground" />
                            <div className="flex gap-1.5">
                                {sortedTps.map((tp, idx) => (
                                    <span
                                        key={tp.id}
                                        className={cn(
                                            "text-xs px-1.5 py-0.5 rounded font-medium",
                                            tp.is_hit
                                                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                                                : "bg-muted text-muted-foreground"
                                        )}
                                    >
                                        {tp.is_hit && <CheckCircle2 className="inline h-3 w-3 mr-0.5" />}
                                        ${tp.tp_price.toLocaleString()}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <div className="text-xs space-y-1">
                            <p className="font-semibold">Take Profits ({tps.filter(t => t.is_hit).length}/{tps.length} hit)</p>
                            {sortedTps.map((tp, idx) => (
                                <div key={tp.id} className="flex items-center gap-2">
                                    <span>TP{idx + 1}: ${tp.tp_price.toLocaleString()}</span>
                                    {tp.is_hit ? (
                                        <Badge variant="outline" className="text-[10px] py-0 h-4 bg-green-100 text-green-700 border-green-200">Hit</Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-[10px] py-0 h-4">Pending</Badge>
                                    )}
                                </div>
                            ))}
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
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

            {/* Strategy Cards with Balance */}
            <div className="grid gap-6 md:grid-cols-3">
                {strategies.length > 0 ? (
                    strategies.map((strategy) => (
                        <Card key={strategy.id} className="bg-card hover:bg-accent/5 transition-colors">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {strategy.name}
                                </CardTitle>
                                <Activity className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {/* Balance Display */}
                                <div className="flex items-center gap-2">
                                    <Wallet className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-2xl font-bold">
                                        ${strategy.balance.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">
                                        {strategy.trades} trades
                                    </span>
                                    <span className={cn(
                                        "font-medium",
                                        strategy.pnl > 0 ? "text-green-600" :
                                            strategy.pnl < 0 ? "text-red-600" :
                                                "text-muted-foreground"
                                    )}>
                                        {strategy.pnl > 0 ? "+" : ""}
                                        ${strategy.pnl.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })} PnL
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/30 rounded-xl border border-dashed">
                        No strategies active yet. Create a trade to see stats.
                    </div>
                )}
            </div>

            {/* Recent Trades Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Trades</CardTitle>
                    <CardDescription>A list of your recent simulation trades with complete setup details.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Strategy</TableHead>
                                    <TableHead>Direction</TableHead>
                                    <TableHead>Entry</TableHead>
                                    <TableHead>Stop Loss</TableHead>
                                    <TableHead>Take Profits</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">PnL</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8">Loading trades...</TableCell>
                                    </TableRow>
                                ) : trades.length > 0 ? (
                                    trades.map((trade) => (
                                        <TableRow key={trade.id}>
                                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
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
                                            <TableCell className="font-medium">
                                                ${trade.entry_price.toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <ShieldX className="h-3.5 w-3.5 text-red-500" />
                                                    <span className="text-red-600 dark:text-red-400 font-medium">
                                                        ${trade.sl.toLocaleString()}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {formatTPs(trade.tps, trade.direction)}
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(trade.status)}
                                            </TableCell>
                                            <TableCell className={cn(
                                                "text-right font-medium whitespace-nowrap",
                                                trade.pnl > 0 ? "text-green-600" : trade.pnl < 0 ? "text-red-600" : "text-muted-foreground"
                                            )}>
                                                {trade.pnl > 0 ? "+" : ""}${trade.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                            No recent trades found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
