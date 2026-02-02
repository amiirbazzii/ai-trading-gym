export type TradeStatus =
    | "pending_entry"
    | "entered"
    | "tp_all_hit"
    | "tp_partial_then_sl"
    | "sl_hit"
    | "sl_hit";

export interface TakeProfit {
    id: string;
    tp_price: number;
    is_hit: boolean;
    hit_at?: string;
    pnl_portion: number;
}

export interface Trade {
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
    updated_at?: string;
    entry_order_type?: 'limit' | 'stop'; // 'limit' = wait for pullback, 'stop' = wait for breakout
}

export interface StrategyStats {
    id: string;
    name: string;
    balance: number;
    pnl: number;
    trades: number;
    wins: number;
    user_id: string;
}
