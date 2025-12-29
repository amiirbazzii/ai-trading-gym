-- Migration: Trade States and Capital Model
-- This migration adds support for new trade states, PnL tracking, and virtual balances

-- ========================================
-- STEP 1: Add new columns to trades table
-- ========================================

-- Position size for each trade (fixed at 10 USD)
ALTER TABLE public.trades 
ADD COLUMN IF NOT EXISTS position_size numeric DEFAULT 10 NOT NULL;

-- Remaining open position (decreases as TPs are hit)
ALTER TABLE public.trades 
ADD COLUMN IF NOT EXISTS remaining_position numeric DEFAULT 10 NOT NULL;

-- ========================================
-- STEP 2: Add new columns to trade_tps table
-- ========================================

-- Timestamp when this TP was hit
ALTER TABLE public.trade_tps 
ADD COLUMN IF NOT EXISTS hit_at timestamptz DEFAULT NULL;

-- PnL portion realized when this TP hit
ALTER TABLE public.trade_tps 
ADD COLUMN IF NOT EXISTS pnl_portion numeric DEFAULT 0 NOT NULL;

-- ========================================
-- STEP 3: Add balance column to ai_strategies
-- ========================================

-- Virtual balance for each strategy (starts at 1000 USD)
ALTER TABLE public.ai_strategies 
ADD COLUMN IF NOT EXISTS balance numeric DEFAULT 1000 NOT NULL;

-- ========================================
-- STEP 4: Migrate existing trade statuses
-- ========================================

-- First, temporarily allow the new status values by dropping the old constraint
ALTER TABLE public.trades 
DROP CONSTRAINT IF EXISTS trades_status_check;

-- Migrate existing statuses to new values
UPDATE public.trades SET status = 'pending_entry' WHERE status = 'pending';
UPDATE public.trades SET status = 'entered' WHERE status = 'open';
UPDATE public.trades SET status = 'sl_hit' WHERE status = 'closed' AND is_sl_hit = true;
UPDATE public.trades SET status = 'tp_all_hit' WHERE status = 'closed' AND is_sl_hit = false;
-- Note: 'cancelled' trades remain as-is (will be handled separately)

-- Add new constraint with all valid statuses
ALTER TABLE public.trades 
ADD CONSTRAINT trades_status_check 
CHECK (status IN ('pending_entry', 'entered', 'tp_all_hit', 'tp_partial_then_sl', 'sl_hit', 'cancelled'));

-- ========================================
-- STEP 5: Initialize remaining_position for existing trades
-- ========================================

-- For trades that are not yet closed, set remaining_position = position_size
UPDATE public.trades 
SET remaining_position = position_size 
WHERE status IN ('pending_entry', 'entered');

-- For closed trades, remaining_position should be 0 if all TPs hit
UPDATE public.trades 
SET remaining_position = 0 
WHERE status = 'tp_all_hit';

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON COLUMN public.trades.position_size IS 'Fixed position size in USD (default 10)';
COMMENT ON COLUMN public.trades.remaining_position IS 'Remaining open position in USD (decreases as TPs hit)';
COMMENT ON COLUMN public.trade_tps.hit_at IS 'Timestamp when this take-profit level was hit';
COMMENT ON COLUMN public.trade_tps.pnl_portion IS 'Profit/loss portion realized from this TP hit';
COMMENT ON COLUMN public.ai_strategies.balance IS 'Virtual trading balance in USD (starts at 1000)';

-- Status values explanation:
-- pending_entry: Trade created, waiting for price to reach entry_price
-- entered: Price reached entry, position is now active
-- tp_all_hit: All take-profits were hit, trade closed with full profit
-- tp_partial_then_sl: Some TPs hit then SL hit, trade closed with mixed outcome
-- sl_hit: Stop-loss hit without any TP being triggered, trade closed with loss
-- cancelled: Trade was cancelled by user (preserved from old system)
