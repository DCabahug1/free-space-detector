-- Admin-managed order for areas within a building and zones within an area.
-- Applied to project vituloqfqfrjdlblkuis via Supabase MCP on 2026-10-22.
--
-- The public map keeps this order; pins and free seats no longer reorder
-- areas or spots. The admin lists reorder by drag and drop.

alter table public.rooms add column sort_order integer not null default 0;
alter table public.zones add column sort_order integer not null default 0;

with r as (
  select id, row_number() over (partition by building_id order by name) - 1 as n from public.rooms
)
update public.rooms set sort_order = r.n from r where r.id = rooms.id;

with z as (
  select id, row_number() over (partition by room_id order by created_at) - 1 as n from public.zones
)
update public.zones set sort_order = z.n from z where z.id = zones.id;
