-- Building coordinates for the campus map on the public map page.
-- Applied to project vituloqfqfrjdlblkuis via Supabase MCP on 2026-10-22.
--
-- Rooms stay names. A building carries one point, set by staff in the admin
-- building dialog. Both columns are null until then. No RLS change: anon
-- already reads every building column, admins already update buildings.

alter table public.buildings
  add column lat double precision,
  add column lng double precision,
  add constraint buildings_lat_lng_both check ((lat is null) = (lng is null)),
  add constraint buildings_lat_range check (lat between -90 and 90),
  add constraint buildings_lng_range check (lng between -180 and 180);
