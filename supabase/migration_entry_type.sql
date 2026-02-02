
-- Migration: Add entry_order_type column
-- This allows us to distinguish between Stop (Breakout) and Limit (Pullback) entries

ALTER TABLE public.trades 
ADD COLUMN IF NOT EXISTS entry_order_type text DEFAULT 'stop' CHECK (entry_order_type IN ('stop', 'limit'));

COMMENT ON COLUMN public.trades.entry_order_type IS 'stop = wait for breakout (traditional), limit = wait for pullback (better price)';
