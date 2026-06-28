-- BarCrawl IQ — Supabase schema for the web app's read path.
--
-- Reviewable + re-runnable: every statement is idempotent (IF NOT EXISTS /
-- DROP POLICY IF EXISTS), so applying this file twice is a no-op the second time.
--
-- HOW TO APPLY (pick one):
--   • Supabase dashboard → SQL Editor → paste this file → Run.   (no extra secret)
--   • psql "<your Postgres connection string>" -f pipeline/sql/schema.sql
--   • Supabase Management API: POST /v1/projects/{ref}/database/query  (needs a PAT)
--
-- The data load (pipeline/load_supabase.py) runs with the SERVICE-ROLE key over
-- PostgREST, which can write rows but cannot run DDL — so the schema must exist
-- first. RLS below intentionally does NOT block the service-role key (it bypasses RLS).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.bars (
    bar_id            text primary key,
    bar_name          text,
    address           text,
    lat               double precision,
    lng               double precision,
    rating            numeric,
    review_count      integer,
    bayesian_score    numeric,
    avg_cost          numeric,
    vibe_consolidated text,                       -- pipe-separated tags, e.g. "classy|chill"
    created_at        timestamptz default now()
);

create table if not exists public.routes (
    id                    bigint generated always as identity primary key,
    start_bar_id          text references public.bars(bar_id),
    preference            text,                   -- shortest_walk | highest_quality | lowest_cost
    vibe                  text,                   -- party | classy | dive | chill
    rank                  int,                    -- 1..3
    stops                 jsonb,                  -- ordered [start_id, s1, s2, s3]
    legs                  jsonb,                  -- [{from,to,duration_s,distance_m} x3]
    total_walk_min        numeric,
    total_distance_m      numeric,
    max_leg_s             int,
    selected_avg_bayesian numeric,
    selected_avg_cost     numeric,
    selected_avg_rating   numeric,
    blended_score         numeric,
    explanation           text,
    unique (start_bar_id, preference, vibe, rank)
);

-- Hot lookup the app uses: fetch ranked routes for a (start bar, preference, vibe).
create index if not exists routes_lookup_idx
    on public.routes (start_bar_id, preference, vibe, rank);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- The browser reads with the ANON key, so anon (and authenticated) may SELECT but
-- must not write. With RLS enabled and ONLY a SELECT policy present, INSERT/UPDATE/
-- DELETE are denied by default for those roles. The service-role key bypasses RLS,
-- so the load script still writes fine.
-- ---------------------------------------------------------------------------

alter table public.bars   enable row level security;
alter table public.routes enable row level security;

drop policy if exists bars_select_anon   on public.bars;
create policy bars_select_anon
    on public.bars
    for select
    to anon, authenticated
    using (true);

drop policy if exists routes_select_anon on public.routes;
create policy routes_select_anon
    on public.routes
    for select
    to anon, authenticated
    using (true);
