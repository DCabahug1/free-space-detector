-- Every zone has a max capacity. Applied to project vituloqfqfrjdlblkuis
-- via Supabase MCP on 2026-10-23.
--
-- Open (and line) zones carried no capacity. All of them were mock data, so
-- they go: areas made only of such zones are removed with their mock camera
-- units, the rest lose just those zones. Then capacity becomes required.

-- Areas with zones, none of which has a capacity.
create temporary table uncapped_rooms on commit drop as
select r.id
from public.rooms r
where exists (select 1 from public.zones z where z.room_id = r.id)
  and not exists (select 1 from public.zones z where z.room_id = r.id and z.capacity is not null);

delete from public.camera_units
where mock and room_id in (select id from uncapped_rooms);

-- Zones and zone_counts cascade.
delete from public.rooms where id in (select id from uncapped_rooms);

delete from public.zones where capacity is null;

alter table public.zones alter column capacity set not null;
