# free-space-detector

Repo working name. The product is called **Spot**: use that in UI copy and titles, never "free-space-detector".

Hackathon project, due **Oct 23 2026, 11:59 PM**. Sole developer. Teammates present it live in a classroom.
**Priority: a demo that works on the first try beats completeness.** When in doubt, pick the simpler, more reliable option.

---

## What it is

Passive camera units count people inside hand-drawn zones and publish live occupancy to a public map.
Students check it before walking somewhere (empty library tables, lounge vibe). Staff set it up once.

**Design spec: `docs/DESIGN.md`.** Read it before touching any UI. It holds the tokens, the three custom components, every screen's layout and copy, and the data changes the design assumes. The Claude Design canvas "Spot Redesign" is the visual reference.

---

## Terms (use exactly these, no synonyms)

- **camera unit**: Raspberry Pi 5 + Camera Module 3 in its case, with a small attached monitor. The physical thing mounted in a room.
- **zone**: a hand-drawn polygon over one spot (table, couch, lounge corner). Has a type and optional capacity.
- **building**: a free-text group of rooms ("University Library", "Food Court", "Sierra Hall"). Has a slug.
- **area**: a named space one camera unit covers, made of zones. Belongs to one building. Free-text name ("Floor 2", "Outdoor eating"), optional one-line description, slug unique within the building. Displayed as `{building}, {area}`. UI copy and URLs say area; the `rooms` table and the code identifiers (`Room`, `room_id`, `roomPath`) keep the old name.
- **admin app**: where staff pair camera units and draw zones. Auth-gated.
- **public map**: what students open. Anonymous, no login.

Zone types:
- `seating`: has capacity, shows Empty / Shared / Full
- `open`: Empty / Some people / Busy
- `line`: deprecated. Not offered, not rendered as a type in new UI. Existing rows may stay in the table. The blue token stays reserved.
- A zone whose camera unit is offline (no heartbeat for 60 s) renders as Unknown with the `state-unknown` token and its last count.
- A camera unit that paused sharing (Settings on the Pi, `camera_units.paused`) reads as offline on the public pages. Only the admin says "sharing paused" (in `state-shared`).

---

## Stack

- Next.js App Router, TypeScript, Tailwind, deployed on Vercel. One repo.
  - Routes: `/` public map, `/areas/[building]/[area]` public area page, `/admin` overview (Areas and Camera units tabs), `/admin/areas/[id]` setup page, `/admin/login`, `/api/ingest` POST route.
- Frontend UI: **shadcn/ui** restyled only through the tokens in `src/app/globals.css`: the tweakcn theme `cmvgcddyy000104jtc2lxai96` (paper palette, cobalt primary, DM Sans, radius 0.5rem, tracking -0.01em) plus Spot's `state-*`, `band-*` and `building-*` tokens. Every page opens with the primary header band. shadcn parts keep their shapes. Custom components: ZoneTile, RoomRow, StepRail, the band header (see `docs/DESIGN.md`).
- Fonts: DM Sans for everything, JetBrains Mono only for counts and pair codes, both via `next/font/google` in `layout.tsx`.
- Supabase: Postgres, Realtime (public map subscribes to `zone_counts`), Auth for admins only, RLS.
  - Project ref `vituloqfqfrjdlblkuis`, region us-east-2, URL `https://vituloqfqfrjdlblkuis.supabase.co`.
  - Supabase MCP is connected. Use it for migrations. Mirror every migration into `supabase/migrations/` in the repo.
- Camera unit: Python in `camera-unit/`, Picamera2 + Ultralytics YOLOv8n, person class only.

Not in scope: no separate backend server, no Edge Functions, no PostGIS. Rooms are names, not coordinates.

---

## Schema

- `buildings`: id, name, slug
- `camera_units`: id, name, pair_code, api_key, room_id nullable, last_seen
- `rooms` (an area in the UI): id, building_id, name, slug (unique per building), description nullable, published bool. `kind` is legacy, ignore it in new UI.
- `zones`: id, room_id, name, type (seating | line | open), capacity int nullable, polygon jsonb (array of [x, y] in frame pixels)
- `zone_counts`: zone_id PK, count int, updated_at. Upsert one row per zone.

RLS:
- anon reads buildings, published rooms, their zones, zone_counts, and camera_units.last_seen (for the offline state).
- Authenticated admins write rooms and zones.
- Only the ingest route (service role) writes `zone_counts` and `camera_units.last_seen`.

---

## Camera unit behavior

- Boot: load zones for its room from Supabase, re-fetch every few minutes.
- Loop: capture frame, YOLOv8n person detection, bottom-center of each box is the foot point, point-in-polygon per zone, count.
- POST `{ api_key, counts: [{ zone_id, count }] }` to `/api/ingest` when counts change, plus a 15 s heartbeat.
- A changed count must hold for 5 s (`confirm_s`) before the monitor shows it and it is posted, so a person walking past never flips a tile. After the hold there is no further grace period: a person leaves a zone, the spot is free. `dwell_s` exists as an opt-in knob for seating zones but defaults to 0.
- No video leaves the camera unit, only counts.
- Small monitor on the camera unit (touchscreen): shows a QR code + 6-digit pair code during pairing, then a live per-zone count readout once paired. A "View camera" button opens a popup with the feed, person boxes, and zones colored by state (green vacant, orange occupied, red full) labeled "Table 1 (1/4)". The admin zone canvas draws the same labels and colors.
- Pairing: admin scans QR or types the code in the admin app, camera unit polls until claimed, stores the issued api_key locally. If short on time, hardcode the api_key for the demo.

---

## Build order

1. Schema + RLS migration, ingest route. (done)
2. Camera unit script posting fake counts, then real counts. (done)
3. Public map with Realtime tiles. (done, needs the redesign)
4. Admin app zone drawing. (done, needs the redesign)
5. Pairing flow + monitor display. (done, needs the redesign)

Redesign order (follow `docs/DESIGN.md`):
1. Tokens and fonts are already in `globals.css` and `layout.tsx`. Check every screen still renders.
2. ZoneTile with the bottom bar and the 300 ms flash on state change.
3. `buildings` migration, rooms get building_id, slug, description. Public map with headline, search, Free now, pinned rooms, building directory. Room page.
4. Admin overview: rooms grouped by building, camera units as device cards, pairing inline.
5. Setup page: step rail, editor beside the canvas, naming in the panel, preview step with the real public room page, optimistic publish.
6. Camera unit screens.

---

## Demo script the presenters will run

1. Admin setup page on the projector, live frame from the camera unit mounted high in a classroom corner.
2. Draw 4 to 6 zones over the real classroom tables live. Preview step shows the public room page. Publish.
3. Public room page. Judges sit at a table, the tile's count and bar flip to Shared, then Full. They stand, it flips to Empty.
4. One open zone across the doorway. Five people stand in it, the tile flips to busy.

---

## Style and workflow

- No em dashes anywhere: code, comments, UI text, docs. Use a comma, a colon, or a new sentence.
- UI copy states facts and times only ("Updated 8 s ago", "Camera unit offline, 4 min"). No taglines, no explanations.
- Status is text and color, never a dot, square or icon beside it.
- Small, frequent commits. Work on branches named with standard prefixes (`feat/`, `fix/`, `refactor/`, `chore/`, `docs/`), never `claude/`. Merge to `main` often.
- Commit as the repo owner only (Duane Cabahug, duanecabahug6@gmail.com). No co-author trailers, no model identifiers in commits.
- Env vars (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only, never exposed to the client).
