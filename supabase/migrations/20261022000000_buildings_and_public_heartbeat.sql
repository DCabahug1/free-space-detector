-- Buildings, room slugs and descriptions, and the public heartbeat.
-- Applied to project vituloqfqfrjdlblkuis via Supabase MCP on 2026-10-22.
--
-- rooms.kind stays in the table as a legacy column with a default so new
-- rooms do not need it. Existing rooms land in a "Campus" building and get a
-- slug from their name.

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

alter table public.rooms
  add column building_id uuid references public.buildings(id) on delete restrict,
  add column slug text,
  add column description text;
alter table public.rooms alter column kind set default 'seating';

insert into public.buildings (name, slug) values ('Campus', 'campus');
update public.rooms
  set building_id = (select id from public.buildings where slug = 'campus')
  where building_id is null;
update public.rooms
  set slug = trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')))
  where slug is null;
with d as (
  select id, row_number() over (partition by building_id, slug order by created_at) as rn
  from public.rooms
)
update public.rooms r set slug = r.slug || '-' || d.rn from d where d.id = r.id and d.rn > 1;

alter table public.rooms
  alter column building_id set not null,
  alter column slug set not null;
alter table public.rooms add constraint rooms_building_slug_unique unique (building_id, slug);
create index rooms_building_id_idx on public.rooms(building_id);

-- RLS: anyone reads buildings, admins manage them.
alter table public.buildings enable row level security;
create policy "public read buildings"
  on public.buildings for select to anon, authenticated using (true);
create policy "admins insert buildings"
  on public.buildings for insert to authenticated with check (true);
create policy "admins update buildings"
  on public.buildings for update to authenticated using (true) with check (true);
create policy "admins delete buildings"
  on public.buildings for delete to authenticated using (true);

-- Zones: the camera unit fetches zones with the anon key, and the setup
-- page previews live counts before a room is published, so zones of draft
-- rooms are readable too. Rooms themselves stay gated on published.
drop policy "public read zones of published rooms" on public.zones;
create policy "public read zones"
  on public.zones for select to anon, authenticated using (true);

-- Camera units: the public map needs last_seen for the offline state, and
-- nothing else. Column grants keep api_key and pair_code off the anon role.
revoke all on public.camera_units from anon;
grant select (id, name, room_id, last_seen) on public.camera_units to anon;
create policy "public read camera_units heartbeat"
  on public.camera_units for select to anon using (true);
