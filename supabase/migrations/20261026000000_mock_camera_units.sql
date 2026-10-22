-- Mock camera units for the demo campus. Applied to project
-- vituloqfqfrjdlblkuis via Supabase MCP on 2026-10-22.
--
-- A mock unit never posts. A pg_cron job every 30 s refreshes its heartbeat
-- and nudges a few of its zone counts by one person, within capacity, so
-- the public map reads live across campus with a single real camera unit.

alter table public.camera_units add column mock boolean not null default false;

create or replace function public.tick_mock_camera_units()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.camera_units set last_seen = now() where mock;

  update public.zone_counts zc
  set count = greatest(0, least(coalesce(z.capacity, 6), zc.count + (case when random() < 0.5 then -1 else 1 end))),
      updated_at = now()
  from public.zones z
  join public.rooms r on r.id = z.room_id
  join public.camera_units cu on cu.room_id = r.id and cu.mock
  where zc.zone_id = z.id and random() < 0.15;
end
$$;

revoke all on function public.tick_mock_camera_units() from public, anon, authenticated;

create extension if not exists pg_cron;
grant usage on schema cron to postgres;
select cron.schedule('mock-camera-units', '30 seconds', $$select public.tick_mock_camera_units()$$);
