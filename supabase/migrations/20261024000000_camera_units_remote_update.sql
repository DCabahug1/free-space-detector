-- Remote update from the admin app. An admin sets update_requested_at; the
-- unit sees it on its next /api/pair/status poll, which clears it and runs
-- the updater. version is the short git hash the unit reports on each poll.
-- Applied to project vituloqfqfrjdlblkuis via Supabase MCP on 2026-10-21.

alter table public.camera_units
  add column version text,
  add column update_requested_at timestamptz;
