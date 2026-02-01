import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { StrategyStats } from "./types";

interface StrategyCardsProps {
    strategies: StrategyStats[];
}

export function StrategyCards({ strategies }: StrategyCardsProps) {
    if (strategies.length === 0) {
        return (
            <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/30 rounded-xl border border-dashed">
                No strategies active yet. Create a trade to see stats.
            </div>
        );
    }

    return (
        <>
            {strategies.map((strategy) => (
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
            ))}
        </>
    );
}
