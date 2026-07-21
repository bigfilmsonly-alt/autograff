-- ============================================================================
-- AUTOGRAFF economy — STAGE 1: data model + free hearts
--
-- Vite/React app; this Supabase Postgres holds the hearts/credits/transactions
-- system. It runs ALONGSIDE the existing Upstash KV "likes" (parallel, per the
-- product decision). Every balance/heart mutation is server-side: the client may
-- only request, the database decides. give_heart() is the single write path and
-- runs as one atomic transaction.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- app_config: ONE JSONB row. Tune the economy by UPDATE-ing it — no code deploy.
-- ----------------------------------------------------------------------------
create table if not exists public.app_config (
  id         int primary key default 1,
  config     jsonb not null,
  updated_at timestamptz not null default now(),
  constraint app_config_singleton check (id = 1)
);

insert into public.app_config (id, config) values (1, '{
  "dailyHeartsByTier":     { "general": 10, "silver": 20, "gold": 40, "founding": 100 },
  "creditCostByHeartType": { "standard": 5, "infinity": 50 },
  "creditPacks": [
    { "id": "pack_50",  "credits": 50,  "priceCents": 499 },
    { "id": "pack_200", "credits": 200, "priceCents": 1499 },
    { "id": "pack_500", "credits": 500, "priceCents": 2999 }
  ],
  "tiers": {
    "general":  { "priceCents": 0,    "creditDiscountPct": 0,  "vault": false, "infinityHeart": false },
    "silver":   { "priceCents": 500,  "creditDiscountPct": 5,  "vault": false, "infinityHeart": false },
    "gold":     { "priceCents": 1500, "creditDiscountPct": 15, "vault": true,  "infinityHeart": true },
    "founding": { "priceCents": 5000, "creditDiscountPct": 25, "vault": true,  "infinityHeart": true }
  },
  "infinityHeartTiers": ["gold", "founding"],
  "rateLimit": { "heartsPerMinute": 30 }
}'::jsonb)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- profiles — keyed to auth.users. credit_balance is a CACHED read; the source of
-- truth is sum(credit_ledger.delta). tier/balance/hearts are server-controlled.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  display_name           text,
  tier                   text not null default 'general'
                           check (tier in ('founding','gold','silver','general')),
  tier_since             timestamptz,
  credit_balance         integer not null default 0,
  hearts_remaining_today integer not null default 0,
  hearts_last_grant      date,
  standard_hearts_given  integer not null default 0,
  infinity_hearts_given  integer not null default 0,
  created_at             timestamptz not null default now(),
  constraint credit_balance_nonneg   check (credit_balance >= 0),
  constraint hearts_remaining_nonneg check (hearts_remaining_today >= 0)
);

-- ----------------------------------------------------------------------------
-- photos — total_hearts counts ALL hearts; total_infinity_hearts is the infinity
-- subset ("most honored"). Counts are maintained only by give_heart().
-- ----------------------------------------------------------------------------
create table if not exists public.photos (
  id                    uuid primary key default gen_random_uuid(),
  creator_id            uuid not null references public.profiles(id) on delete cascade,
  image_url             text not null,
  title                 text,
  total_hearts          integer not null default 0,
  total_infinity_hearts integer not null default 0,
  created_at            timestamptz not null default now(),
  constraint total_hearts_nonneg   check (total_hearts >= 0),
  constraint total_infinity_nonneg check (total_infinity_hearts >= 0)
);
create index if not exists photos_creator_idx  on public.photos(creator_id);
create index if not exists photos_hearts_idx   on public.photos(total_hearts desc);
create index if not exists photos_infinity_idx on public.photos(total_infinity_hearts desc);

-- ----------------------------------------------------------------------------
-- hearts — heart_type keeps 'infinity' (Stage 5). One FREE heart per user per
-- photo (credits_spent = 0); additional hearts must be paid.
-- ----------------------------------------------------------------------------
create table if not exists public.hearts (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references public.profiles(id) on delete cascade,
  photo_id      uuid not null references public.photos(id) on delete cascade,
  heart_type    text not null check (heart_type in ('standard','infinity')),
  credits_spent integer not null default 0 check (credits_spent >= 0),
  created_at    timestamptz not null default now()
);
create index if not exists hearts_photo_idx   on public.hearts(photo_id);
create index if not exists hearts_sender_idx  on public.hearts(sender_id);
create index if not exists hearts_created_idx on public.hearts(created_at desc);
create unique index if not exists hearts_one_free_per_photo
  on public.hearts(sender_id, photo_id) where credits_spent = 0;

-- ----------------------------------------------------------------------------
-- credit_ledger — APPEND-ONLY. Source of truth for balance. A trigger blocks all
-- UPDATE/DELETE. Only credit movements land here; free (0-credit) hearts do not.
-- ----------------------------------------------------------------------------
create table if not exists public.credit_ledger (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  delta         integer not null,
  reason        text not null check (reason in ('daily_grant','purchase','heart_spent','refund')),
  balance_after integer not null check (balance_after >= 0),
  reference_id  uuid,
  created_at    timestamptz not null default now()
);
create index if not exists credit_ledger_user_idx on public.credit_ledger(user_id, created_at);

create or replace function public.forbid_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'credit_ledger is append-only: % is not allowed', tg_op;
end;
$$;
drop trigger if exists credit_ledger_append_only on public.credit_ledger;
create trigger credit_ledger_append_only before update or delete on public.credit_ledger
  for each row execute function public.forbid_mutation();

-- ----------------------------------------------------------------------------
-- transactions — Stripe (used from Stage 3, present now). stripe_event_id is the
-- webhook idempotency key so a replayed event cannot double-grant.
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  stripe_payment_intent_id text unique,
  stripe_event_id          text unique,
  amount_cents             integer not null check (amount_cents >= 0),
  product                  text,
  status                   text not null default 'pending'
                            check (status in ('pending','succeeded','failed','refunded')),
  created_at               timestamptz not null default now()
);
create index if not exists transactions_user_idx on public.transactions(user_id, created_at);

-- ----------------------------------------------------------------------------
-- archive / vault — STUBS: structure + RLS only, no functionality yet.
-- ----------------------------------------------------------------------------
create table if not exists public.archive (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  photo_id   uuid not null references public.photos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, photo_id)
);
create table if not exists public.vault (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  photo_id   uuid not null references public.photos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, photo_id)
);

-- ============================================================================
-- ROW LEVEL SECURITY — on every table. Clients only READ (and only what they
-- should). All economy writes go through give_heart()/service role, which run as
-- definer/service and bypass RLS. There is deliberately NO client write path to
-- balances, tiers, hearts, or ledger.
-- ============================================================================
alter table public.app_config    enable row level security;
alter table public.profiles      enable row level security;
alter table public.photos        enable row level security;
alter table public.hearts        enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.transactions  enable row level security;
alter table public.archive       enable row level security;
alter table public.vault         enable row level security;

-- Config: any signed-in user may read (to show costs). No client writes.
create policy app_config_read on public.app_config
  for select to authenticated using (true);

-- Profiles: public read (leaderboards). No client insert/update/delete — the
-- handle_new_user trigger creates rows; the server owns balance/tier/hearts.
create policy profiles_read_all on public.profiles
  for select to anon, authenticated using (true);

-- Photos: public read; a creator may insert their OWN photo, and only with zeroed
-- counts (counts are server-maintained). No client update/delete.
create policy photos_read_all on public.photos
  for select to anon, authenticated using (true);
create policy photos_insert_own on public.photos
  for insert to authenticated
  with check (creator_id = auth.uid() and total_hearts = 0 and total_infinity_hearts = 0);

-- Hearts: public read (transparency + leaderboards). Inserts happen only inside
-- give_heart() (definer), so there is no client insert policy.
create policy hearts_read_all on public.hearts
  for select to anon, authenticated using (true);

-- Ledger: you can read only your own rows. No client writes (append-only, server).
create policy ledger_read_own on public.credit_ledger
  for select to authenticated using (user_id = auth.uid());

-- Transactions: you can read only your own. No client writes.
create policy transactions_read_own on public.transactions
  for select to authenticated using (user_id = auth.uid());

-- Archive/Vault (stubs): you can read and manage only your own entries.
create policy archive_own on public.archive
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy vault_own on public.vault
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Auto-create a profile (safe defaults) for every new auth user. This is why the
-- client never needs — and never gets — INSERT on profiles.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- give_heart() — the ONLY way a heart is created. SECURITY DEFINER: bypasses RLS,
-- so every rule lives here. The whole body is one transaction; any RAISE rolls
-- back the heart, the ledger row, and the count updates together.
-- ============================================================================
create or replace function public.give_heart(p_photo_id uuid, p_heart_type text default 'standard')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sender      uuid := auth.uid();
  v_cfg         jsonb;
  v_photo       public.photos%rowtype;
  v_profile     public.profiles%rowtype;
  v_today       date := (now() at time zone 'utc')::date;
  v_allowance   int;
  v_cost        int;
  v_is_free     boolean := false;
  v_rate_limit  int;
  v_recent      int;
  v_heart_id    uuid;
  v_new_balance int;
begin
  if v_sender is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_heart_type not in ('standard','infinity') then
    raise exception 'invalid heart_type: %', p_heart_type using errcode = '22023';
  end if;

  select config into v_cfg from public.app_config where id = 1;

  -- Lock the sender's profile so their spend/free-heart decisions serialize.
  select * into v_profile from public.profiles where id = v_sender for update;
  if not found then raise exception 'profile not found' using errcode = 'P0002'; end if;

  select * into v_photo from public.photos where id = p_photo_id;
  if not found then raise exception 'photo not found' using errcode = 'P0002'; end if;

  -- No self-dealing: you cannot heart your own photo.
  if v_photo.creator_id = v_sender then
    raise exception 'cannot heart your own photo' using errcode = 'P0001';
  end if;

  -- Rate limit per user.
  v_rate_limit := coalesce((v_cfg->'rateLimit'->>'heartsPerMinute')::int, 30);
  select count(*) into v_recent from public.hearts
    where sender_id = v_sender and created_at > now() - interval '1 minute';
  if v_recent >= v_rate_limit then
    raise exception 'rate limit exceeded' using errcode = 'P0001';
  end if;

  -- Daily free-heart grant (lazy): refresh allowance the first time you act today.
  if v_profile.hearts_last_grant is distinct from v_today then
    v_allowance := coalesce((v_cfg->'dailyHeartsByTier'->>v_profile.tier)::int, 0);
    update public.profiles
      set hearts_remaining_today = v_allowance, hearts_last_grant = v_today
      where id = v_sender;
    v_profile.hearts_remaining_today := v_allowance;
  end if;

  if p_heart_type = 'infinity' then
    -- Infinity: gated to configured tiers, always paid.
    if not (v_cfg->'infinityHeartTiers' ? v_profile.tier) then
      raise exception 'infinity heart not available for your tier' using errcode = 'P0001';
    end if;
    v_cost := coalesce((v_cfg->'creditCostByHeartType'->>'infinity')::int, 50);
  else
    -- Standard: free only for your FIRST heart on this photo while you have a free
    -- heart left today; otherwise it costs credits.
    if v_profile.hearts_remaining_today > 0
       and not exists (select 1 from public.hearts where sender_id = v_sender and photo_id = p_photo_id) then
      v_is_free := true;
      v_cost := 0;
    else
      v_cost := coalesce((v_cfg->'creditCostByHeartType'->>'standard')::int, 5);
    end if;
  end if;

  if v_is_free then
    update public.profiles set hearts_remaining_today = hearts_remaining_today - 1 where id = v_sender;
    v_new_balance := v_profile.credit_balance;
  else
    if v_profile.credit_balance < v_cost then
      raise exception 'insufficient credits' using errcode = 'P0001';
    end if;
    v_new_balance := v_profile.credit_balance - v_cost;
    update public.profiles set credit_balance = v_new_balance where id = v_sender;
  end if;

  insert into public.hearts (sender_id, photo_id, heart_type, credits_spent)
    values (v_sender, p_photo_id, p_heart_type, v_cost)
    returning id into v_heart_id;

  -- Ledger row only when credits actually moved.
  if not v_is_free then
    insert into public.credit_ledger (user_id, delta, reason, balance_after, reference_id)
      values (v_sender, -v_cost, 'heart_spent', v_new_balance, v_heart_id);
  end if;

  update public.photos
    set total_hearts = total_hearts + 1,
        total_infinity_hearts = total_infinity_hearts + (case when p_heart_type = 'infinity' then 1 else 0 end)
    where id = p_photo_id;

  update public.profiles
    set standard_hearts_given = standard_hearts_given + (case when p_heart_type = 'standard' then 1 else 0 end),
        infinity_hearts_given = infinity_hearts_given + (case when p_heart_type = 'infinity' then 1 else 0 end)
    where id = v_sender;

  return jsonb_build_object(
    'heart_id', v_heart_id,
    'heart_type', p_heart_type,
    'free', v_is_free,
    'credits_spent', v_cost,
    'credit_balance', v_new_balance,
    'hearts_remaining_today', (select hearts_remaining_today from public.profiles where id = v_sender)
  );
end;
$$;

revoke all on function public.give_heart(uuid, text) from public, anon;
grant execute on function public.give_heart(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- reset_daily_hearts() — the daily cron. Belt-and-suspenders with the lazy grant
-- above (also refills inactive users). Service-role only.
-- ----------------------------------------------------------------------------
create or replace function public.reset_daily_hearts()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cfg jsonb; v_count int;
begin
  select config into v_cfg from public.app_config where id = 1;
  update public.profiles p
    set hearts_remaining_today = coalesce((v_cfg->'dailyHeartsByTier'->>p.tier)::int, 0),
        hearts_last_grant = (now() at time zone 'utc')::date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.reset_daily_hearts() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Reconciliation check (used in the Stage 1 demo): every profile's cached
-- credit_balance must equal the sum of its ledger deltas.
--   select * from public.ledger_reconciliation where drift <> 0;  -- must be empty
-- ----------------------------------------------------------------------------
create or replace view public.ledger_reconciliation as
  select p.id as user_id,
         p.credit_balance as cached_balance,
         coalesce(sum(l.delta), 0) as ledger_balance,
         p.credit_balance - coalesce(sum(l.delta), 0) as drift
  from public.profiles p
  left join public.credit_ledger l on l.user_id = p.id
  group by p.id, p.credit_balance;
