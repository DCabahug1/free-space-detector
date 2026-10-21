-- A camera unit can pause sharing from its Settings screen. It keeps
-- polling /api/pair/status with its sharing flag, which lands here, so the
-- public map can say Paused instead of offline.
-- Applied to project vituloqfqfrjdlblkuis via Supabase MCP on 2026-10-23.

alter table public.camera_units add column paused boolean not null default false;
grant select (paused) on public.camera_units to anon;
