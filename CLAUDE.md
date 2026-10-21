# free-space-detector

Working name only. The real product name comes later. Do not bake "free-space-detector" into UI copy.

Hackathon project, due **Oct 23 2026, 11:59 PM**. Sole developer. Teammates present it live in a classroom.
**Priority: a demo that works on the first try beats completeness.** When in doubt, pick the simpler, more reliable option.

---

## What it is

Passive camera units count people inside hand-drawn zones and publish live occupancy to a public map.
Students check it before walking somewhere (empty library tables, food line waits, lounge vibe). Staff set it up once.

---

## Terms (use exactly these, no synonyms)

- **camera unit**: Raspberry Pi 5 + Camera Module 3 in its case, with a small attached monitor. The physical thing mounted in a room.
- **zone**: a hand-drawn polygon over one spot (table, couch, food line, lounge corner). Has a type and optional capacity.
- **room**: a named area one camera unit covers, made of zones.
- **admin app**: where staff pair camera units and draw zones. Auth-gated.
- **public map**: what students open. Anonymous, no login.

Zone types:
- `seating`: has capacity, shows empty / shared / full
- `line`: count + wait estimate
- `open`: empty / some / busy

---

## Stack

- Next.js App Router, TypeScript, Tailwind, deployed on Vercel. One repo.
  - Routes: `/` public map, `/admin` admin app, `/api/ingest` POST route.
- Frontend UI: **shadcn/ui**. Theme: https://tweakcn.com/themes/cmvgcddyy000104jtc2lxai96
  - Install with `npx shadcn@latest add https://tweakcn.com/r/themes/cmvgcddyy000104jtc2lxai96.json` (run locally, the cloud sandbox cannot reach tweakcn.com).
- Supabase: Postgres, Realtime (public map subscribes to `zone_counts`), Auth for admins only, RLS.
  - Project ref `vituloqfqfrjdlblkuis`, region us-east-2, URL `https://vituloqfqfrjdlblkuis.supabase.co`.
  - Supabase MCP is connected. Use it for migrations. Mirror every migration into `supabase/migrations/` in the repo.
- Camera unit: Python in `camera-unit/`, Picamera2 + Ultralytics YOLOv8n, person class only.

Not in scope: no separate backend server, no Edge Functions, no PostGIS. Rooms are names, not coordinates.

---

## Schema

- `camera_units`: id, name, pair_code, api_key, room_id nullable, last_seen
- `rooms`: id, name, kind (seating | line), published bool
- `zones`: id, room_id, name, type (seating | line | open), capacity int nullable, polygon jsonb (array of [x, y] in frame pixels)
- `zone_counts`: zone_id PK, count int, updated_at. Upsert one row per zone.

RLS:
- anon reads published rooms, their zones, and zone_counts.
- Authenticated admins write rooms and zones.
- Only the ingest route (service role) writes `zone_counts` and `camera_units.last_seen`.

---

## Camera unit behavior

- Boot: load zones for its room from Supabase, re-fetch every few minutes.
- Loop: capture frame, YOLOv8n person detection, bottom-center of each box is the foot point, point-in-polygon per zone, count.
- POST `{ api_key, counts: [{ zone_id, count }] }` to `/api/ingest` as soon as counts change (held for 2 frames), plus a 15 s heartbeat.
- No grace period: a person leaves a zone, the spot is free on the next post. `dwell_s` exists as an opt-in knob for seating zones but defaults to 0.
- No video leaves the camera unit, only counts.
- Small monitor on the camera unit: shows a QR code + 6-digit pair code during pairing, then a live per-zone count readout once paired.
- Pairing: admin scans QR or types the code in the admin app, camera unit polls until claimed, stores the issued api_key locally. If short on time, hardcode the api_key for the demo.

---

## Build order

1. Schema + RLS migration, ingest route.
2. Camera unit script posting fake counts, then real counts.
3. Public map with Realtime tiles.
4. Admin app zone drawing: frozen frame from the camera unit, click to draw a polygon, set type + capacity, publish.
5. Pairing flow + monitor display last.

---

## Demo script the presenters will run

1. Admin app on the projector, live frame from the camera unit mounted high in a classroom corner.
2. Draw 4 to 6 zones over the real classroom tables live. Publish.
3. Public map. Judges sit at a table, tile flips to shared, then full. They stand, it flips to empty.
4. One line zone across the doorway. Five people line up, a wait estimate appears.

---

## Style and workflow

- No em dashes anywhere: code, comments, UI text, docs. Use a comma, a colon, or a new sentence.
- Small, frequent commits. Work on branches named with standard prefixes (`feat/`, `fix/`, `refactor/`, `chore/`, `docs/`), never `claude/`. Merge to `main` often.
- Commit as the repo owner only (Duane Cabahug, justforai017@gmail.com). No co-author trailers, no model identifiers in commits.
- Env vars (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only, never exposed to the client).
