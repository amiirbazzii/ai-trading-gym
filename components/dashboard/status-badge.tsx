import { Badge } from "@/components/ui/badge";
import { TradeStatus, Trade, TakeProfit } from "./types";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export const STATUS_CONFIG: Record<TradeStatus, { label: string; className: string }> = {
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
    }
};

interface TradeStatusBadgeProps {
    trade: Trade;
}

export function TradeStatusBadge({ trade }: TradeStatusBadgeProps) {
    // Fallback for unknown status (like old 'cancelled' trades)
    const status = trade.status as TradeStatus;
    const config = STATUS_CONFIG[status] || { label: status, className: "bg-gray-100 text-gray-800" };

    const formatTime = (dateStr?: string | null) => {
        if (!dateStr) return "-";
        try {
            return format(new Date(dateStr), "HH:mm:ss");
        } catch (e) {
            return dateStr;
        }
    };

    const isSlHit = status === 'sl_hit' || status === 'tp_partial_then_sl';
    // Use updated_at as proxy for SL hit time if not explicitly tracked elsewhere, 
    // or if we add a dedicated field later.
    const slHitTime = isSlHit ? formatTime(trade.updated_at || trade.created_at) : null;

    return (
        <TooltipProvider>
            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                    <Badge variant="outline" className={`cursor-pointer ${config.className}`}>
                        {config.label}
                    </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="w-64 p-3 font-medium">
                    <div className="space-y-3">
                        <div className="border-b pb-2">
                            <h4 className="font-semibold text-sm">Setup Analysis</h4>
                            <p className="text-xs text-muted-foreground">Trade Events & Timing</p>
                        </div>

                        <div className="space-y-2 text-xs">
                            {/* Take Profits */}
                            <div className="space-y-1">
                                <span className="text-muted-foreground font-semibold">Take Profits:</span>
                                {trade.tps && trade.tps.length > 0 ? (
                                    trade.tps.map((tp, i) => (
                                        <div key={tp.id} className="flex justify-between items-center">
                                            <span className="flex items-center gap-1">
                                                {tp.is_hit ? (
                                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                                ) : (
                                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                                )}
                                                TP {i + 1} ({tp.tp_price})
                                            </span>
                                            <span className={tp.is_hit ? "text-green-500" : "text-muted-foreground"}>
                                                {tp.is_hit ? formatTime(tp.hit_at) : "Pending"}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-muted-foreground pl-4">No TPs set</div>
                                )}
                            </div>

                            {/* Stop Loss */}
                            <div className="pt-1 space-y-1 border-t border-dashed">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground font-semibold flex items-center gap-1">
                                        Stop Loss ({trade.sl})
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pl-1">
                                    <span className="flex items-center gap-1">
                                        {isSlHit ? (
                                            <XCircle className="h-3 w-3 text-red-500" />
                                        ) : (
                                            <ShieldCheckIcon status={status} />
                                        )}
                                        Status
                                    </span>
                                    <span className={isSlHit ? "text-red-500" : "text-green-500"}>
                                        {isSlHit ? `Hit at ${slHitTime}` : "Safe"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

function ShieldCheckIcon({ status }: { status: TradeStatus }) {
    if (status === 'tp_all_hit') return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    return <Clock className="h-3 w-3 text-muted-foreground" />;
}
