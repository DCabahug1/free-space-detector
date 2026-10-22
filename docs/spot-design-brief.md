# Spot: design context

Paste everything below this line into Claude Design.

---

## What Spot is

Spot shows students which spots on campus are free right now. Passive camera units count people inside hand-drawn zones (a table, a couch, a lounge corner, a doorway) and publish live counts to a public map. Only counts leave the camera, never video. Students check Spot before walking somewhere. Staff set it up once.

It is a hackathon project demoed live in a classroom on a projector. Judges will sit at a table and watch a tile flip from empty to shared to full, then stand up and watch it flip back. The design must read from across a room and must not depend on hover.

## Who uses it

- **Students** open the public map on a phone, anonymous, no login. They want an answer in two seconds: is the library corner free, is the lounge busy.
- **Staff admins** use the admin app on a laptop a few times total: pair a camera unit, draw zones over a live camera frame, set type and capacity, publish the room.
- **Whoever walks past the camera unit** sees its small attached touchscreen (about 800x480) showing a pair code during setup, then a live per-zone readout.

## Vocabulary (use exactly these words in UI copy)

- **camera unit**: the physical Raspberry Pi with camera and small touchscreen, mounted high in a room corner.
- **zone**: a hand-drawn polygon over one spot. Has a type and optional capacity.
- **room**: a named area one camera unit covers, made of zones. Rooms are names, not coordinates. There is no floor plan. Buildings carry one map point for the campus map.
- **admin app**: where staff pair camera units and draw zones. Login required.
- **public map**: what students open. A campus map with one pin per building in its occupancy color, then a list of room cards with zone tiles.
- **pair code**: a 6-digit code shown on the camera unit's screen during setup, typed or scanned in the admin app.

Zone types and their states:

- **seating** (tables, couches): has a capacity. States: `empty`, `shared` (some seats taken), `full` (count at or above capacity).
- **open** (lounge corner, doorway): no capacity. States: `empty`, `some people` (1 to 3), `busy` (4 or more).
- **line**: deprecated. Not offered for new zones. Old ones still show a count and a wait estimate ("3 waiting, about 2 min").

State color meaning is fixed across every surface: green = vacant, orange = occupied, red = full or busy, blue = legacy line.

## Surfaces and screens

### 1. Public map (phone first, also projector)

- Top nav: Spot wordmark on the left, links to Map and Admin.
- Heading "Find a free spot", subtitle "Live occupancy from camera units around campus. Counts only, never video."
- A small live indicator: green dot plus "Live updates connected" or "Connecting to live updates".
- One **room card** per published room, two columns on desktop, one on phone. Each card has the room name, a one-line summary ("3 of 6 tables free"), a kind badge (seating or line), and a freshness line ("Updated 12 s ago", or a stale warning with an offline icon, "Stale, last update 4 min ago").
- Inside each card a grid of **zone tiles**, two per row on phone, three on wider screens. A tile shows the zone name, a small type icon (armchair for seating, people for open, footprints for line), a pulsing state dot, a bold state label ("Empty", "Shared", "Full", "Some people", "Busy"), and a detail line ("2 of 4 seats taken", "5 people", "1 person in line (estimate)"). Tiles are tinted by state. Stale tiles are dimmed and desaturated.
- Empty states: "No rooms published yet" with "Once staff publish a room in the admin app, it shows up here." A room with no zones shows "No zones drawn yet."
- Loading: skeleton cards.
- Tiles change in real time within about a second. Design the tile so a state change is obvious from across a classroom.

### 2. Admin login

- Centered card. Title, email field, password field, sign in button. Error text under the form on failure. No sign up, accounts are created by hand.

### 3. Admin: Rooms list (`/admin`)

- Admin nav with tabs Rooms and Camera units, and a Sign out button on the right.
- Heading "Rooms" with a short subtitle and a "New room" button that opens a dialog (name field, kind select: seating or line).
- One card per room: name, zone count and camera unit name underneath, kind badge, and a **publish switch** (published rooms appear on the public map). Clicking the card opens the room editor.
- Empty state: "No rooms yet".

### 4. Admin: Room editor (`/admin/rooms/[id]`)

This is the screen the presenters run on the projector during the demo, so it carries the most weight.

- **Room header**: room name with an inline rename (pencil icon opens a small form), kind badge, camera unit name or "Unassigned", a large publish switch, and a delete button that opens a confirm dialog ("Delete this room?").
- **Zone canvas**: a 1280x720 live frame from the camera unit, refreshed about once a second, with every saved zone drawn over it as a translucent polygon in its state color, labeled at its centroid like "Table 1 (1/4)" or "Lounge (2)". Person boxes drawn by the camera unit appear in the frame itself. Clicking a zone selects it (thicker outline).
- **Drawing mode**: a toolbar above the canvas. Idle: "Draw zone", "Upload photo" (use a still photo instead of the live frame), and a hint line. While drawing: "Finish" (enabled at 3 or more points), "Undo point", "Cancel". The draft polygon is drawn in the primary color with dashed edges and vertex dots; clicking near the first vertex closes it. An error toast reads "Click at least 3 points to outline a zone."
- **Zone side panel**: a "Zones" card listing every zone with a color swatch, name, type label, and capacity. Selecting one opens an **Edit zone** form: name (placeholder "Table 3"), type select with descriptions ("Seating: empty / shared / full", "Open area: empty / some / busy", line only if the zone already is one), capacity (placeholder "4", seating only), Save and Delete. Saving toasts "Zone saved."
- Also a "Name this zone" dialog right after finishing a drawing, same fields.
- States: no camera frame yet (placeholder with "Waiting for the camera unit"), camera unit unassigned, zero zones.

### 5. Admin: Camera units (`/admin/camera-units`)

- Heading "Camera units" with a subtitle.
- **Pair form** card: pair code input (6 digits, placeholder "123456"), room select (placeholder "Pick a room"), and a Pair button. Success toasts "Camera unit paired."
- **Table** of camera units: name (inline rename), room (select to reassign, or "Unassigned"), last seen (relative time, with an online or offline indicator), and an actions column with rename and remove. Removing opens a confirm dialog.

### 6. Camera unit touchscreen (about 800x480, dark, viewed from a distance, touch only)

Not a web page. It is a fullscreen Tkinter app with large type and no hover, so design it as plain layout and color guidance. It also runs on a 1280x800 monitor; the layout scales down.

- **Starting**: "Starting" centered, a status line below ("Connecting").
- **Pairing**: title "Pair this camera unit", a QR code (opens the admin app with the code filled in), the 6-digit pair code in very large monospace, the line "Scan the code or type it in the admin app under Camera units.", a footer status, and an Update button. On the short touchscreen the QR sits left and the code sits right; on tall screens they stack.
- **Live**: room name as the header, then one row per zone: zone name, a large monospace count ("2 / 4" for seating with capacity, "5" otherwise), and a state label in the state color ("Empty", "Shared", "Full", "Some people", "Busy"). Rows shrink to fit when there are many zones. Bottom buttons: "View camera", "Refresh zones", "Update". Footer status line. Empty: "No zones yet. Draw some in the admin app."
- **Camera preview popup**: fullscreen black, the live frame with person boxes, foot points, and state-colored zone polygons labeled like the admin canvas. Buttons: Close, Refresh zones. Tapping the picture also closes it.
- **Update**: the button reads "Updating" while a pull runs, the footer shows progress ("Checking for updates", "Installing packages, this can take a few minutes", "Updated 3 files, restarting", "Already up to date", or a git error), then the unit restarts.

## Visual system in place today

The web app uses shadcn/ui on Tailwind v4 with this tweakcn theme. Keep these tokens as the starting point; propose changes as token changes, not one-off colors.

Light:

- background `oklch(0.9711 0.0034 145.5494)` (pale green-tinted white), foreground `oklch(0.2235 0.0049 145.4099)`
- card and popover `oklch(1 0 0)` white
- primary `oklch(0.4731 0.0450 149.2237)` muted forest green, primary foreground = background
- secondary and sidebar accent `oklch(0.9247 0.0103 145.4919)`, muted and accent `oklch(0.9621 0.0034 145.5491)`, muted foreground `oklch(0.4889 0.0120 145.3884)`
- destructive `oklch(0.4437 0.1613 26.8994)` deep red
- border and input `oklch(0.8688 0.0069 145.5154)`, ring = primary
- state tokens: empty `oklch(0.58 0.14 150)`, shared `oklch(0.68 0.15 70)`, full `oklch(0.4437 0.1613 26.8994)`, line `oklch(0.58 0.12 240)`

Dark:

- background `oklch(0.2002 0 0)`, card `oklch(0.2350 0 0)`, foreground `oklch(0.8717 0.0093 258.3382)`
- primary `oklch(0.5017 0.0487 151.7958)`, accent `oklch(0.3778 0.0197 153.7965)`, muted `oklch(0.2686 0 0)`, muted foreground `oklch(0.6401 0 0)`
- destructive `oklch(0.3958 0.1331 25.7230)`, border `oklch(0.2850 0 0)`
- state tokens: empty `oklch(0.70 0.15 150)`, shared `oklch(0.76 0.15 70)`, full `oklch(0.60 0.18 26)`, line `oklch(0.68 0.12 240)`

Type and shape:

- Sans everywhere: Inter. Headings are Inter semibold, not serif. Monospace (JetBrains Mono) only for pair codes, counts on the camera unit, and zone capacity badges.
- Letter spacing 0.05rem on body text.
- Radius 0: square corners throughout.
- Spacing unit 0.22rem.
- Shadows are soft and low in light mode (4px y, 10px blur, 5% black) and heavy in dark mode (12px y, 24px blur, 40% black).

The camera unit screen uses hex versions of the dark tokens: background `#161616`, text `#d1d5db`, muted `#8c8c8c`, button `#1e1e1e`, pressed button `#3a453d`, pair code accent `#4cb86a`. State colors: empty `#4cb86a`, shared `#ed9e2f`, full `#d74843`, line `#48a1db`.

## Constraints

- shadcn/ui components only on the web: Button, Badge, Card, Dialog, AlertDialog, Input, Label, Select, Separator, Skeleton, Switch, Table, Tabs, Sonner toasts. New components are fine if they are shadcn ones.
- Phone width first for the public map. Admin screens are laptop first but must not break on a tablet.
- The zone canvas must stay 16:9 and show the real camera frame; design around it, not instead of it.
- No em dashes anywhere in copy. Use a comma, a colon, or a new sentence.
- Do not rely on hover, color alone, or animation to convey state. Every state has a label.
- Demo reliability beats polish. Avoid anything that needs a loading step on the projector.

## What to deliver

Redesigned screens for all six surfaces above, light and dark for the web, dark only for the camera unit. For each, the normal state plus the empty, loading or waiting, and stale or error states listed. Call out any token values you change so they can be applied in globals.css.
