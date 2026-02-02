export type TradeDirection = 'long' | 'short';

// Matches the exact strings expected by the UI and DB
export type TradeStatus =
    | 'pending_entry'
    | 'entered'
    | 'tp_all_hit'
    | 'tp_partial_then_sl'
    | 'sl_hit'
    | 'sl_hit';

export interface TakeProfit {
    id: string;
    trade_id: string;
    tp_price: number;
    is_hit: boolean;
    hit_at: string | null;
    pnl_portion: number;
}

export interface AIStrategy {
    id: string;
    name: string;
    description?: string;
    balance: number;
    user_id: string;
}

export interface Trade {
    id: string;
    user_id: string;
    direction: TradeDirection;
    entry_price: number;
    sl: number;
    status: TradeStatus;
    pnl: number;
    position_size: number;
    remaining_position: number;
    trade_tps: TakeProfit[];
    is_sl_hit?: boolean;
    updated_at?: string;
    entry_order_type?: 'limit' | 'stop';
    initial_price?: number;
}

export interface TradeSyncResult {
    trade: Trade;
    shouldUpdate: boolean;
    updates: Partial<Trade>;
    tpUpdates: { id: string; updates: Partial<TakeProfit> }[];
    completedAction?: {
        newStatus: TradeStatus;
        finalPnl: number;
        exitPrice: number;
    };
}
