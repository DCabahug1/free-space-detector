-- Initial schema: rooms, zones, camera_units, zone_counts, plus RLS.
-- Applied to project vituloqfqfrjdlblkuis via Supabase MCP on 2026-10-20.

create extension if not exists pgcrypto;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('seating', 'line')),
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  type text not null check (type in ('seating', 'line', 'open')),
  capacity int check (capacity is null or capacity > 0),
  polygon jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index zones_room_id_idx on public.zones(room_id);

create table public.camera_units (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Camera unit',
  pair_code text unique,
  api_key text not null unique default encode(gen_random_bytes(24), 'hex'),
  room_id uuid references public.rooms(id) on delete set null,
  last_seen timestamptz,
  created_at timestamptz not null default now()
);
create index camera_units_room_id_idx on public.camera_units(room_id);

create table public.zone_counts (
  zone_id uuid primary key references public.zones(id) on delete cascade,
  count int not null default 0 check (count >= 0),
  updated_at timestamptz not null default now()
);

-- Realtime: the public map subscribes to zone_counts changes.
alter publication supabase_realtime add table public.zone_counts;
alter table public.zone_counts replica identity full;

-- RLS
alter table public.rooms enable row level security;
alter table public.zones enable row level security;
alter table public.camera_units enable row level security;
alter table public.zone_counts enable row level security;

-- anon + authenticated: read published rooms and their zones, and all zone_counts.
create policy "public read published rooms"
  on public.rooms for select
  to anon, authenticated
  using (published = true);

create policy "public read zones of published rooms"
  on public.zones for select
  to anon, authenticated
  using (exists (select 1 from public.rooms r where r.id = zones.room_id and r.published = true));

create policy "public read zone_counts"
  on public.zone_counts for select
  to anon, authenticated
  using (true);

-- authenticated admins: full access to rooms and zones (admin app is the only
-- place that signs in, so any authenticated user is an admin).
create policy "admins read all rooms"
  on public.rooms for select to authenticated using (true);
create policy "admins write rooms"
  on public.rooms for insert to authenticated with check (true);
create policy "admins update rooms"
  on public.rooms for update to authenticated using (true) with check (true);
create policy "admins delete rooms"
  on public.rooms for delete to authenticated using (true);

create policy "admins read all zones"
  on public.zones for select to authenticated using (true);
create policy "admins write zones"
  on public.zones for insert to authenticated with check (true);
create policy "admins update zones"
  on public.zones for update to authenticated using (true) with check (true);
create policy "admins delete zones"
  on public.zones for delete to authenticated using (true);

-- camera_units: admins read and manage them (pairing).
create policy "admins read camera_units"
  on public.camera_units for select to authenticated using (true);
create policy "admins insert camera_units"
  on public.camera_units for insert to authenticated with check (true);
create policy "admins update camera_units"
  on public.camera_units for update to authenticated using (true) with check (true);
create policy "admins delete camera_units"
  on public.camera_units for delete to authenticated using (true);

-- zone_counts and camera_units.last_seen are written only by the ingest route
-- using the service role, which bypasses RLS. No insert/update policies for
-- anon or authenticated on zone_counts on purpose.
