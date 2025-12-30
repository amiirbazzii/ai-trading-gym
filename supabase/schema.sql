-- ============================================
-- AI Trading Gym - Database Schema
-- ============================================
-- This schema supports paper trading simulation with:
-- - Trade state machine (pending_entry -> entered -> closed states)
-- - Multiple take-profit levels per trade
-- - AI strategy attribution and performance tracking
-- - Virtual balance management per strategy
-- ============================================

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- ============================================
-- Table: ai_strategies
-- ============================================
-- AI strategies that can be attributed to trades
-- Each strategy has a virtual balance for PnL tracking
create table public.ai_strategies (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  balance numeric default 1000 not null  -- Virtual balance in USD
);

COMMENT ON TABLE public.ai_strategies IS 'AI trading strategies with virtual balances';
COMMENT ON COLUMN public.ai_strategies.balance IS 'Virtual trading balance in USD (starts at 1000)';

-- ============================================
-- Table: trades
-- ============================================
-- Paper trades with state machine for lifecycle management
-- 
-- Trade States:
-- - pending_entry: Waiting for price to reach entry_price
-- - entered: Position is active
-- - tp_all_hit: All TPs hit, fully closed with profit
-- - tp_partial_then_sl: Some TPs hit then SL hit
-- - sl_hit: SL hit without any TP, closed with loss
-- - cancelled: Trade cancelled by user
create table public.trades (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  direction text check (direction in ('long', 'short')) not null,
  entry_price numeric not null,
  sl numeric not null,
  created_at timestamptz default now() not null,
  status text check (status in ('pending_entry', 'entered', 'tp_all_hit', 'tp_partial_then_sl', 'sl_hit', 'cancelled')) default 'pending_entry' not null,
  pnl numeric default 0 not null,
  is_sl_hit boolean default false not null,
  exit_price numeric,
  position_size numeric default 10 not null,     -- Fixed position size in USD
  remaining_position numeric default 10 not null  -- Decreases as TPs hit
);

COMMENT ON TABLE public.trades IS 'Paper trades with lifecycle state machine';
COMMENT ON COLUMN public.trades.position_size IS 'Fixed position size in USD (default 10)';
COMMENT ON COLUMN public.trades.remaining_position IS 'Remaining open position in USD (decreases as TPs hit)';

-- ============================================
-- Table: trade_tps
-- ============================================
-- Take-profit levels for trades
-- Each TP closes (100/N)% of position where N = total TPs
create table public.trade_tps (
  id uuid default uuid_generate_v4() primary key,
  trade_id uuid references public.trades(id) on delete cascade not null,
  tp_price numeric not null,
  is_hit boolean default false not null,
  hit_at timestamptz default null,      -- When this TP was triggered
  pnl_portion numeric default 0 not null -- PnL realized from this TP
);

COMMENT ON TABLE public.trade_tps IS 'Take-profit levels for trades';
COMMENT ON COLUMN public.trade_tps.hit_at IS 'Timestamp when this TP was hit';
COMMENT ON COLUMN public.trade_tps.pnl_portion IS 'Profit realized when this TP hit';

-- ============================================
-- Table: trade_ai_attribution
-- ============================================
-- Links trades to AI strategies for performance tracking
create table public.trade_ai_attribution (
  id uuid default uuid_generate_v4() primary key,
  trade_id uuid references public.trades(id) on delete cascade not null,
  ai_strategy_id uuid references public.ai_strategies(id) on delete cascade not null,
  unique(trade_id, ai_strategy_id)
);

-- ============================================
-- Table: ai_results
-- ============================================
-- Records PnL results for AI strategy performance
create table public.ai_results (
  id uuid default uuid_generate_v4() primary key,
  trade_ai_attribution_id uuid references public.trade_ai_attribution(id) on delete cascade not null,
  pnl numeric not null,
  created_at timestamptz default now() not null
);

-- ============================================
-- Row Level Security
-- ============================================
alter table public.trades enable row level security;
alter table public.trade_tps enable row level security;
alter table public.ai_strategies enable row level security;
alter table public.trade_ai_attribution enable row level security;
alter table public.ai_results enable row level security;

-- Policies for trades
create policy "Users can view own trades" on public.trades
  for select using (auth.uid() = user_id);

create policy "Users can insert own trades" on public.trades
  for insert with check (auth.uid() = user_id);

create policy "Users can update own trades" on public.trades
  for update using (auth.uid() = user_id);

create policy "Users can delete own trades" on public.trades
  for delete using (auth.uid() = user_id);

-- Policies for trade_tps
create policy "Users can view own trade tps" on public.trade_tps
  for select using (exists (select 1 from public.trades where trades.id = trade_tps.trade_id and trades.user_id = auth.uid()));

create policy "Users can insert own trade tps" on public.trade_tps
  for insert with check (exists (select 1 from public.trades where trades.id = trade_tps.trade_id and trades.user_id = auth.uid()));

create policy "Users can update own trade tps" on public.trade_tps
  for update using (exists (select 1 from public.trades where trades.id = trade_tps.trade_id and trades.user_id = auth.uid()));

-- Policies for ai_strategies
create policy "Strategies are viewable by everyone" on public.ai_strategies
  for select using (true);

-- Allow authenticated users to insert strategies
create policy "Authenticated users can create strategies" on public.ai_strategies
  for insert with check (auth.uid() is not null);

-- Allow updates to strategy balance (for PnL tracking)
create policy "Allow strategy balance updates" on public.ai_strategies
  for update using (true);

-- Policies for attribution
create policy "Users can view own attributions" on public.trade_ai_attribution
  for select using (exists (select 1 from public.trades where trades.id = trade_ai_attribution.trade_id and trades.user_id = auth.uid()));

create policy "Users can insert own attributions" on public.trade_ai_attribution
  for insert with check (exists (select 1 from public.trades where trades.id = trade_ai_attribution.trade_id and trades.user_id = auth.uid()));

-- Policies for results
create policy "Users can view own results" on public.ai_results
  for select using (
    exists (
      select 1 from public.trade_ai_attribution ta
      join public.trades t on ta.trade_id = t.id
      where ta.id = ai_results.trade_ai_attribution_id and t.user_id = auth.uid()
    )
  );

create policy "Allow result inserts for own trades" on public.ai_results
  for insert with check (
    exists (
      select 1 from public.trade_ai_attribution ta
      join public.trades t on ta.trade_id = t.id
      where ta.id = ai_results.trade_ai_attribution_id and t.user_id = auth.uid()
    )
  );
