"use client";

import { useEffect, useState, useMemo } from "react";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { getEthPrice } from "@/lib/price";
import { calculateTpProfit } from "@/lib/pnl-calculations";

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
    hit_at?: string;
    pnl_portion: number;
}

interface Trade {
    id: string;
    direction: "long" | "short";
    entry_price: number;
    sl: number;
    status: TradeStatus;
    created_at: string;
    pnl: number;
    remaining_position: number;
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
                const floating = calculateTpProfit(
                    t.direction,
                    entry,
                    currentPrice,
                    t.remaining_position
                );
                tradePnL += floating;
            }

            // Find which strategy this trade belongs to
            // Note: in formattedTrades we store ai_name, we might need to store strategy_id too
            // Let's assume for now we match by ai_name or just process all
            // To be accurate, we should have stored strategyId in formattedTrades

            // Optimization: match strategy by name (names are currently unique)
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
                remaining_position: t.remaining_position || 0, // Ensure we have this
                ai_name: t.trade_ai_attribution?.[0]?.ai_strategies?.name || "None",
                tps: (t.trade_tps || []).sort((a: TakeProfit, b: TakeProfit) => a.tp_price - b.tp_price),
            }));

            setTrades(formattedTrades);

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
                // Refresh data after migration
                fetchDashboardData();
            }

            // 2. Fetch AI Strategies with balances
            const { data: strategyData, error: strategyError } = await supabase
                .from("ai_strategies")
                .select("id, name, balance");

            if (strategyError) throw strategyError;

            // We'll calculate stats dynamically in useMemo to include live prices
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

    const handleDeleteTrade = async (tradeId: string) => {
        try {
            const { error } = await supabase
                .from("trades")
                .delete()
                .eq("id", tradeId);

            if (error) throw error;

            toast.success("Trade deleted successfully");
            setTrades((prev) => prev.filter((t) => t.id !== tradeId));

            // Refresh strategy stats after deletion
            fetchDashboardData();
        } catch (error: any) {
            console.error("Error deleting trade:", error);
            toast.error("Failed to delete trade");
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

    // Format TPs display (Simple list, no status colors/tooltip as per request)
    const formatTPs = (tps: TakeProfit[], direction: "long" | "short") => {
        if (tps.length === 0) return <span className="text-muted-foreground">-</span>;

        // Sort TPs by price
        const sortedTps = [...tps].sort((a, b) =>
            direction === 'long' ? a.tp_price - b.tp_price : b.tp_price - a.tp_price
        );

        return (
            <div className="flex flex-wrap items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                {sortedTps.map((tp, idx) => (
                    <Badge
                        key={tp.id}
                        variant="secondary"
                        className="font-mono text-xs font-medium bg-muted/50 text-muted-foreground border-transparent"
                    >
                        ${tp.tp_price.toLocaleString()}
                    </Badge>
                ))}
            </div>
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
                    strategyStats.map((strategy) => (
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
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-8">Loading trades...</TableCell>
                                    </TableRow>
                                ) : trades.length > 0 ? (
                                    trades.map((trade) => (
                                        <DropdownMenu key={trade.id}>
                                            <DropdownMenuTrigger asChild>
                                                <TableRow className="cursor-pointer hover:bg-muted/50 transition-colors">
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
                                                    )}>
                                                        <LivePnlDisplay
                                                            trade={trade}
                                                            currentPrice={currentPrice}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/20 cursor-pointer"
                                                    onClick={() => handleDeleteTrade(trade.id)}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                                                    Delete Trade
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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

// Helper Component for Live PnL
function LivePnlDisplay({ trade, currentPrice }: { trade: any, currentPrice: number | null }) {
    // If trade is closed, just show stored PnL
    const isClosed = ["tp_all_hit", "sl_hit", "cancelled"].includes(trade.status);

    // Base PnL (Realized)
    let totalPnl = trade.pnl;
    let isLive = false;

    // Add Floating PnL if active
    if (!isClosed && currentPrice && trade.remaining_position > 0) {
        // Calculate floating PnL on remaining position
        // Using calculateTpProfit as it shares the same formula: (diff / entry) * capital
        // For Long: (Current - Entry) / Entry * Remaining
        // For Short: (Entry - Current) / Entry * Remaining
        const floatingPnl = calculateTpProfit(
            trade.direction,
            trade.entry_price,
            currentPrice,
            trade.remaining_position
        );

        totalPnl += floatingPnl;
        isLive = true;
    }

    return (
        <span className={cn(
            trade.pnl > 0 || totalPnl > 0 ? "text-green-600" : totalPnl < 0 ? "text-red-600" : "text-muted-foreground",
            isLive && "font-bold"
        )}>
            {totalPnl > 0 ? "+" : ""}${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {isLive && <span className="text-[10px] text-muted-foreground ml-1">(Live)</span>}
        </span>
    );
}
