-- BarCrawl IQ — analytics schema (the app's ONE anonymous write path).
--
-- Reviewable + re-runnable: every statement is idempotent (IF NOT EXISTS /
-- DROP POLICY IF EXISTS), so applying this file twice is a no-op the second time.
--
-- HOW TO APPLY (pick one):
--   • Supabase dashboard → SQL Editor → paste this file → Run.   (no extra secret)
--   • psql "<your Postgres connection string>" -f pipeline/sql/analytics.sql
--   • Supabase Management API: POST /v1/projects/{ref}/database/query  (needs a PAT)
--
-- SCOPE: one table, anonymous counts only. NO ip, NO geolocation, NO device
-- fingerprint, NO user id. `session_id` is a random per-visit token (set in the
-- browser via crypto.randomUUID) used solely to link a scan to the route it led
-- to. This file does NOT touch the bars/routes tables or their RLS — they stay
-- read-only exactly as schema.sql left them.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.analytics_events (
    id            bigint generated always as identity primary key,
    event_type    text not null,        -- 'scan' | 'route_generated' | 'maps_opened'
    session_id    text,                 -- random anonymous per-visit token (NOT a user id)
    source_bar_id text,                 -- the ?src= bar for scans (nullable)
    start_bar_id  text,                 -- for route_generated (nullable)
    preference    text,                 -- for route_generated (nullable)
    vibe          text,                 -- for route_generated (nullable)
    created_at    timestamptz default now()
);

-- Funnel reads (done later via dashboard / service role) group by type + time.
create index if not exists analytics_events_type_time_idx
    on public.analytics_events (event_type, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security — INSERT-ONLY for anon (and authenticated).
--
-- With RLS enabled and ONLY an INSERT policy present, anon/authenticated may add
-- rows but cannot SELECT/UPDATE/DELETE (denied by default — no policy for them).
-- The browser therefore can write events but can never read them back; you read
-- the analytics yourself with the service-role key (which bypasses RLS) or via
-- the dashboard. NOTE: client inserts must NOT request the row back
-- (return=minimal) — there is intentionally no SELECT policy.
-- ---------------------------------------------------------------------------

alter table public.analytics_events enable row level security;

drop policy if exists analytics_events_insert_anon on public.analytics_events;
create policy analytics_events_insert_anon
    on public.analytics_events
    for insert
    to anon, authenticated
    with check (true);
