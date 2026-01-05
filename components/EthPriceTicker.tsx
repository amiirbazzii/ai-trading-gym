"use client";

import { useEffect, useState } from "react";
import { getEthPrice } from "@/lib/price";
import { TrendingUp, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function EthPriceTicker() {
    const [price, setPrice] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const fetchPrice = async () => {
        try {
            const currentPrice = await getEthPrice();
            setPrice(currentPrice);
            setLastUpdated(new Date());
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch ETH price:", error);
        }
    };

    useEffect(() => {
        fetchPrice();
        const interval = setInterval(fetchPrice, 30000); // Update every 30 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700 group">
            <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </div>
            <div className="flex flex-col">
                <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold leading-none text-muted-foreground uppercase tracking-widest">
                        ETH
                    </span>
                    <TrendingUp className="h-2.5 w-2.5 text-primary opacity-70" />
                </div>
                <span className="text-sm font-bold tabular-nums tracking-tight">
                    {loading ? (
                        <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                    ) : (
                        `$${price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    )}
                </span>
            </div>
        </div>
    );
}
