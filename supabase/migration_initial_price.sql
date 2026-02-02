
-- Migration: Add initial_price column to trades
-- This records the price at the time the trade setup was created
-- to determine which way the price needs to move to trigger entry.

ALTER TABLE public.trades 
ADD COLUMN IF NOT EXISTS initial_price numeric;

COMMENT ON COLUMN public.trades.initial_price IS 'The market price at the moment the trade setup was created.';
