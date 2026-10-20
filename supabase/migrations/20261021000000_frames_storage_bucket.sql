-- Public bucket for the latest frame from each camera unit.
-- Applied to project vituloqfqfrjdlblkuis via Supabase MCP on 2026-10-21.
-- Path: <camera_unit_id>.jpg, overwritten every few seconds by /api/frame
-- using the service role. Anyone can read, so the admin zone editor can
-- show it with a plain <img>. No video, one still at a time.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('frames', 'frames', true, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create policy "public read frames"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'frames');
