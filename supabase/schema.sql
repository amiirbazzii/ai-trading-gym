-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Table: trades
create table public.trades (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  direction text check (direction in ('long', 'short')) not null,
  entry_price numeric not null,
  sl numeric not null,
  created_at timestamptz default now() not null,
  status text check (status in ('open', 'closed', 'cancelled')) default 'open' not null
);

-- Table: trade_tps
create table public.trade_tps (
  id uuid default uuid_generate_v4() primary key,
  trade_id uuid references public.trades(id) on delete cascade not null,
  tp_price numeric not null,
  is_hit boolean default false not null
);

-- Table: ai_strategies
create table public.ai_strategies (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text
);

-- Table: trade_ai_attribution
create table public.trade_ai_attribution (
  id uuid default uuid_generate_v4() primary key,
  trade_id uuid references public.trades(id) on delete cascade not null,
  ai_strategy_id uuid references public.ai_strategies(id) on delete cascade not null,
  unique(trade_id, ai_strategy_id)
);

-- Table: ai_results
create table public.ai_results (
  id uuid default uuid_generate_v4() primary key,
  trade_ai_attribution_id uuid references public.trade_ai_attribution(id) on delete cascade not null,
  pnl numeric not null,
  created_at timestamptz default now() not null
);

-- RLS Policies
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

-- Policies for trade_tps
create policy "Users can view own trade tps" on public.trade_tps
  for select using (exists (select 1 from public.trades where trades.id = trade_tps.trade_id and trades.user_id = auth.uid()));

create policy "Users can insert own trade tps" on public.trade_tps
  for insert with check (exists (select 1 from public.trades where trades.id = trade_tps.trade_id and trades.user_id = auth.uid()));

-- Policies for ai_strategies
create policy "Strategies are viewable by everyone" on public.ai_strategies
  for select using (true);

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
