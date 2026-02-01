import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Trash2, TrendingUp, TrendingDown, ShieldX, Target } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Trade, TradeStatus, TakeProfit } from "./types";
import { STATUS_CONFIG, TradeStatusBadge } from "./status-badge";
import { LivePnlDisplay } from "./live-pnl";

interface TradesTableProps {
    trades: Trade[];
    loading: boolean;
    currentPrice: number | null;
    onUpdateStatus: (trade: Trade, status: TradeStatus) => void;
    onDeleteTrade: (tradeId: string) => void;
}

export function TradesTable({ trades, loading, currentPrice, onUpdateStatus, onDeleteTrade }: TradesTableProps) {
    // Format TPs display
    const formatTPs = (tps: TakeProfit[], direction: "long" | "short") => {
        if (tps.length === 0) return <span className="text-muted-foreground">-</span>;

        // Sort TPs by price
        const sortedTps = [...tps].sort((a, b) =>
            direction === 'long' ? a.tp_price - b.tp_price : b.tp_price - a.tp_price
        );

        return (
            <div className="flex flex-wrap items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                {sortedTps.map((tp) => (
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
                                <TableHead className="hidden lg:table-cell">Date</TableHead>
                                <TableHead className="hidden md:table-cell">Strategy</TableHead>
                                <TableHead>Direction</TableHead>
                                <TableHead>Entry</TableHead>
                                <TableHead className="hidden lg:table-cell">Stop Loss</TableHead>
                                <TableHead className="hidden xl:table-cell">Take Profits</TableHead>
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
                                                <TableCell className="hidden lg:table-cell text-muted-foreground text-sm whitespace-nowrap">
                                                    {formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell font-medium">{trade.ai_name}</TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "border-none px-2 py-0.5",
                                                            trade.direction === 'long'
                                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                        )}
                                                    >
                                                        {trade.direction === "long" ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                                                        <span className="sm:inline hidden">{trade.direction.toUpperCase()}</span>
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    ${trade.entry_price.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="hidden lg:table-cell">
                                                    <div className="flex items-center gap-1.5">
                                                        <ShieldX className="h-3.5 w-3.5 text-red-500" />
                                                        <span className="text-red-600 dark:text-red-400 font-medium">
                                                            ${trade.sl.toLocaleString()}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden xl:table-cell">
                                                    {formatTPs(trade.tps, trade.direction)}
                                                </TableCell>
                                                <TableCell>
                                                    <TradeStatusBadge status={trade.status} />
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
                                        <DropdownMenuContent align="end" className="w-48">
                                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                Change Status
                                            </div>
                                            <div className="grid grid-cols-1 gap-0.5">
                                                {(Object.keys(STATUS_CONFIG) as TradeStatus[]).map((status) => (
                                                    <DropdownMenuItem
                                                        key={status}
                                                        onClick={() => onUpdateStatus(trade, status)}
                                                        className={cn(
                                                            "flex items-center gap-2 cursor-pointer",
                                                            trade.status === status && "bg-accent"
                                                        )}
                                                    >
                                                        <div className={cn("w-2 h-2 rounded-full", STATUS_CONFIG[status].className.split(' ')[0])} />
                                                        {STATUS_CONFIG[status].label}
                                                    </DropdownMenuItem>
                                                ))}
                                            </div>

                                            <div className="my-1 border-t border-muted" />

                                            <DropdownMenuItem
                                                className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/20 cursor-pointer"
                                                onClick={() => onDeleteTrade(trade.id)}
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
    );
}
