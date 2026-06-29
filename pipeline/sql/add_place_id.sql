-- BarCrawl IQ — add the Google `place_id` column to the bars table.
--
-- WHY: the Maps hand-off should open each stop as its real Google business
-- listing (rich place card) instead of a name/address text search. That needs
-- Google's stable place_id per bar, which the bars table does not yet have.
--
-- Idempotent + safe: `add column if not exists` is a no-op if the column already
-- exists, and it does NOT touch existing rows or any other column — the 900
-- routes and 25 bars already in Supabase are left exactly as they are. The
-- column is NULLABLE: rows simply start NULL and the backfill fills them in
-- (a bar that never resolves cleanly stays NULL, and the app falls back to
-- name+address for it — see lib/maps.ts).
--
-- HOW TO APPLY (DDL can't go through our PostgREST service-role creds):
--   • Supabase dashboard → SQL Editor → paste this file → Run.   (no extra secret)
--   • psql "<your Postgres connection string>" -f pipeline/sql/add_place_id.sql
--
-- AFTER applying, run the backfill to populate it:
--   pipeline/.venv/bin/python pipeline/backfill_place_ids.py

alter table public.bars
    add column if not exists place_id text;

comment on column public.bars.place_id is
    'Google Places place_id for the real business listing (nullable; NULL = no clean match, app falls back to name+address).';
