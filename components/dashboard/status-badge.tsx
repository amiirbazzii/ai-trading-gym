import { Badge } from "@/components/ui/badge";
import { TradeStatus } from "./types";

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
    },
    cancelled: {
        label: "Cancelled",
        className: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400"
    }
};

interface TradeStatusBadgeProps {
    status: TradeStatus;
}

export function TradeStatusBadge({ status }: TradeStatusBadgeProps) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.cancelled;
    return (
        <Badge variant="outline" className={config.className}>
            {config.label}
        </Badge>
    );
}
