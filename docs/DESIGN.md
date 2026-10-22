# Spot design spec

Source of truth for the UI. The Claude Design canvas "Spot Redesign" holds the visuals. This file holds everything a developer needs without opening it.

Point of view: a quiet reading room. Paper, ink, one green, and a big number that answers the question. Copy states facts, never explains the product. On the projector the only thing that moves is a tile's bar and numeral.

---

## Vocabulary (adds to CLAUDE.md)

- **building**: a free-text group of rooms. "University Library", "Food Court", "Sierra Hall". Has a slug.
- **area** (called "room" in code and tables): belongs to one building. Free-text name: "Floor 2", "Outdoor eating", "Lounge". Optional one-line description ("East stairs, past the printers"). Has a slug, unique within its building.
- Area display name everywhere: `{building}, {area}` ("University Library, Floor 2"). On the area page the building sits above the area name as a small link.
- **zone** types: `seating` (capacity) and `open` (no capacity). `line` is not offered and not rendered as a type in new UI. The blue token stays reserved.

---

## Tokens (globals.css)

Base: tweakcn theme `cmvgcddyy000104jtc2lxai96` (installed with `pnpm dlx shadcn@latest add https://tweakcn.com/r/themes/cmvgcddyy000104jtc2lxai96`, then the custom tokens below are added by hand). Typeface: DM Sans for everything. JetBrains Mono only for counts and pair codes. Letter spacing -0.01em. Tabular numerals on. Radius 0.5rem (sm 4, md 6: buttons, inputs, tiles, rows; lg 8: cards, dialogs, groups, canvas). Spacing scale 4 8 12 16 24 32 48.

Light

| token | oklch | hex |
|---|---|---|
| background, card | 0.9818 0.0054 95.10 | #faf9f5 |
| foreground | 0.3438 0.0269 95.72 | #3d3929 |
| card-foreground | 0.1908 0.0020 106.59 | #141413 |
| popover | 1 0 0 | #ffffff |
| secondary, accent | 0.9245 0.0138 92.99 | #e9e6dc |
| secondary-foreground | 0.4334 0.0177 98.60 | #535146 |
| muted | 0.9341 0.0153 90.24 | #ede9de |
| muted-foreground | 0.6059 0.0075 97.42 | #83827d |
| border | 0.8847 0.0069 97.36 | #dad9d4 |
| input | 0.7621 0.0156 98.35 | #b4b2a7 |
| primary, ring, band | 0.3713 0.0851 242.78 | #074469 |
| band-2 (= chart-5) | 0.3002 0.0515 239.94 | #123145 |
| band-muted | 0.82 0.035 243 | #b1c7d9 |
| band-accent | 0.82 0.10 215 | #70d5ed |
| destructive | 0.1908 0.0020 106.59 | #141413 |
| building, building-foreground, building-muted, building-border | = accent, accent-foreground, secondary-foreground, border | |
| state-empty | 0.53 0.10 150 | #3f7d4e |
| state-shared | 0.60 0.13 65 | #b5711a |
| state-full | 0.48 0.15 30 | #a8382c |
| state-unknown | 0.66 0.012 70 | #9d958b |
| state-line (reserved) | 0.56 0.09 240 | #4f7fa8 |

Dark

| token | oklch | hex |
|---|---|---|
| background, card | 0.2679 0.0036 106.64 | #262624 |
| foreground | 0.8074 0.0142 93.01 | #c3c0b6 |
| card-foreground | 0.9818 0.0054 95.10 | #faf9f5 |
| popover | 0.3085 0.0035 106.60 | #30302e |
| muted | 0.2213 0.0038 106.71 | #1b1b19 |
| muted-foreground | 0.7713 0.0169 99.07 | #b7b5a9 |
| accent | 0.2130 0.0078 95.42 | #1a1915 |
| border | 0.3618 0.0101 106.89 | #3e3e38 |
| input | 0.4336 0.0113 100.22 | #52514a |
| primary, ring, band | 0.4558 0.1050 242.67 | #0b5c8c |
| band-2 (= chart-5) | 0.3011 0.0674 243.24 | #06314d |
| band-muted | 0.85 0.035 243 | #bbd1e3 |
| band-accent | 0.82 0.10 215 | #70d5ed |
| destructive | 0.6368 0.2078 25.33 | #ef4444 |
| building (building header) | 0.30 0.008 240 | #2d3134 |
| building-border | 0.37 0.008 240 | #3f4347 |
| building-foreground | 0.9663 0.0080 98.88 | #f5f4ee |
| building-muted | = muted-foreground | #b7b5a9 |
| state-empty | 0.72 0.14 150 | #6cc07e |
| state-shared | 0.75 0.14 70 | #e0a24a |
| state-full | 0.63 0.16 30 | #e2655a |
| state-unknown | 0.55 0.012 70 | #7d756b |
| state-line (reserved) | 0.68 0.09 240 | #6f9bc4 |

Camera unit (Tkinter, hex): bg #262624, text #c3c0b6, muted #b7b5a9, button #30302e, pressed #3e3e38, accent #70d5ed, band #0b5c8c, band-2 #06314d, band text #ffffff, band muted #bbd1e3, empty #6cc07e, shared #e0a24a, full #e2655a.

Type scale: display 44/600 tracking -0.02em, heading 24/600 tracking -0.01em, body 15/400 line-height 1.5, caption 13 muted-foreground, label 12/500 uppercase tracking 0.08em. Counts: mono 700, 34px on phone tiles, 44px on room page tiles, 76px on projector tiles, 22px in the setup preview.

Shadows: the theme's xs on buttons and inputs, lg on the login card, xl on dialogs. Surfaces whose fill sits close to the page (building groups, ZoneTile, the pair card, the preview box) get a 1px border on all four sides. No glow, no gradients.

The band: every page opens with a 56px header on `band` (= primary) with white text. Icon buttons on it fill with `band-2`. The public map and area page continue the band into a hero (headline, live line in `band-muted`, back link, building label, Pin and Share as `band-2` buttons). The admin overview carries its Areas / Camera units tabs on the band, underlined 3px in `band-accent`. The login page is the band edge to edge with one card in the middle. The camera unit shows the same band as the title row of the pairing, live and settings screens.

---

## Components

shadcn/ui parts stay shadcn shaped, restyled by the tokens above: Button (36px, lg 40px), Input (36px), Select, Switch (pill), Badge (outline, secondary), Tabs (muted pill), Separator, Skeleton, Dialog, AlertDialog, Sonner toast (foreground bg, background text, "Undo" as underlined text button).

Three custom components:

**ZoneTile** (`components/public-map/zone-tile.tsx`)
- Card background with a 1px border. No tint.
- Top: zone name, 12px muted. Middle: count in mono, state colored. Bottom: state word, 14px 600 ink.
- A 6px solid bar along the bottom edge in the state color. This bar and the numeral are what change state.
- Count text: seating `{count}/{capacity}`, open `{count}`.
- State words: Empty, Shared, Full, Some people, Busy. Unknown tile when the camera unit is offline: count in state-unknown, word "Unknown, 4 min", bar state-unknown. A camera unit that paused sharing counts as offline here; only the admin says "sharing paused". Never falsely reassuring.
- When state changes, flash the bar for 300 ms. No other motion anywhere.
- On the public pages a pin toggle sits in the top right corner (filled when on). Pinned zones sort first in their grid. Pinning a zone pins its area and building; unpinning an area or building unpins its zones. The setup page preview has no pin.

**RoomRow** (map directory)
- Grid: name, summary caption ("2 of 4 tables open. Updated 8 s ago", or "Camera unit offline, 4 min" in state-full), free count (mono 20px state colored, "free" caption), a chevron, and a 4px segmented strip with one segment per zone in its state color.
- The chevron, or the name, opens the area's spots as ZoneTiles beneath the row, closed by default.
- Hairline between rows. Building headers sit on the accent background.

**StepRail** (admin setup)
- A 22px mark in the margin, step title, status caption. The mark carries the state: filled state-empty with a check for Done, filled state-shared with "!" for Needs attention, a 2px primary ring with the number for the current step, a muted ring with the number otherwise. Status caption colored the same way (Done state-empty, Needs attention state-shared, In progress and Ready primary, Waiting muted). Current step gets a 2px primary left rule and bold title.
- Each step's content opens with a header: "Step 2 of 4" in 12px uppercase muted, the title at 20px 600, a one-line caption.

Status lines are text only: "Online, 3 s ago", "Offline, 4 min" in state-full. No dots, no squares, no icons next to them.

---

## Copy rules

- Facts and times only. "Updated 8 s ago". "Camera unit offline, 4 min". "4 seats, 2 taken". "Wrong email or password."
- No taglines, no feature explanations, no "find a free spot".
- Empty states are one line plus one action.
- No em dashes.

---

## Screens

### `/` public map (phone first, fluid to laptop and projector)

Header: "Spot" text wordmark left. Right: theme toggle (moon in light, sun in dark), account control. Signed out: person outline icon, opens a popup with one item, "Staff sign in". Signed in: moss circle with the user's first initial, opens: "Signed in as {name}", "Admin", "Sign out". No admin link in plain view.

Body, in order:
1. Headline: "Find a free spot", 44px. Caption: "Live seat availability across campus." While realtime is reconnecting the caption turns state-shared: "Reconnecting. Counts from 1 min ago". The old `{free} free seats` total is retired here; per-building and per-area counts stay in the directory.
2. Campus map (Google Maps, raster, with its standard controls except Street View; Google's points of interest and transit icons are styled off so only Spot's markers show; one finger scrolls the page, pinch zooms). 240px tall on phones (Google hides its controls under 200px), 320px from `md`. One pin per building with a location: a 30px circle in the building's state color (empty green, shared amber, full red, unknown grey) outlined 2px in primary, with the free total inside in mono 12px, "?" when every camera unit is offline, and the building name under the pin in 12px 600 foreground with a halo in the page color. The building state: with seating, half or more of the seats free is empty, any seat free is shared, none is full; open zones only, all empty is empty, any busy is full, otherwise shared. The same color drives the free total in the building header. A pin tap opens that building in the All buildings list, scrolls to it, and pulses its header background once (900 ms, up to a 45% primary mix and back). A small "Hide map" / "Show map" text button sits right-aligned above the map; the choice persists per browser. The map fits every located building once and again only when that set changes, never on a count change. The page asks for the browser location on load; once a fix arrives the map centers on the person at zoom 16. A locate control (crosshair icon, bottom right, styled like Google's own) centers on the person again, and toasts "Location is off for this site." when location is denied. The person is a 20px primary dot with a white border inside a 44px translucent primary halo, shown whenever a fix is known. A search or the Free now filter hides the pins it leaves out; the map stays. The block is not rendered without a Maps key, after a load failure, or when no building has a location.
3. Search input, placeholder "Area or building", full width on phones. One row with the All / Free now tabs on the left and a Nearest toggle button on the right (outline when off, primary fill when on, reads "Finding you" while the browser locates). With location denied, tapping Nearest toasts "Location is off for this site." and stays off. The choice persists per browser.
4. Directory grouped by building. Buildings and areas can both be pinned, each with a pin toggle beside the name (filled in state-empty when on). Pinning an area pins its building; unpinning a building unpins its areas. Two lists under 13px uppercase muted headings: "Pinned" (buildings with a pin or a pinned area, open by default, a chevron folds it, hidden when nothing is pinned, and then the headings disappear and one plain list remains) and "All buildings" (every building, pinned ones again). Both sort the same way: offline last, then free seats; with Nearest on, by distance, buildings without a location last. Pinned areas sort first within a building. Building heading 20px 600 on the accent background with a "{m} areas" caption under the name ("{m} areas, 240 m" once the person's position is known), the free total on the right (mono 20px state colored, "free" caption, "?" and "unknown" when every camera unit in the building is offline) and a chevron. Closed by default; the chevron opens the RoomRows beneath. A search keeps matching buildings open.

States: loading (the band caption stays as plain text; count slots show skeleton pills until the client clock starts, so no count flips to unknown), no rooms published ("No rooms yet" / "Rooms appear here once staff publish them."), no search results (`No rooms or buildings match "{q}".` + Clear search), stale (reconnecting caption, offline rooms show "Camera unit offline, 4 min" and "?" with "unknown").

Laptop: container max 1120, directory in 2 to 3 columns.

### `/areas/[building]/[area]` area page (retired)

Retired. The public map carries the area's tiles in its rows, so the route only redirects an old link to `/?q={building}`.

### `/admin/login`

Centered, max 360. Wordmark, "Staff sign in", Email, Password, Sign in (full width, 40px). Error under the form: "Wrong email or password." Signing in: button disabled, reads "Signing in". Footer caption: "Accounts are created by hand. No sign up."

### `/admin` overview

Top bar: wordmark, "Admin" label, Rooms link. Right: Public map, Sign out.
Tabs: Buildings, Camera units. Heading "Buildings", caption `{n} areas in {m} buildings, {p} published. {k} camera unit offline.` ("{m} buildings, no areas yet." before the first area), "Add a building" primary button.
Setup goes building, then area, then zones. "Add a building" opens the building dialog in create mode (title "New building", button "Create building"); a building can stay empty. Every building is a collapsible header, empty ones included, with the caption "{n} areas, {p} published" or "No areas", an "Add area" ghost button (dialog "New area in {building}": Area, Description, "Create area", then the area's setup page opens) and the pencil. An empty building shows one line, "No areas yet. Add one with the button above." The pencil opens the building dialog: Name, then (with a Maps key) an Address field that lists place suggestions as the admin types (Places API, picking one pans the map) with a Find button that geocodes the typed text, a 240px map (standard controls, no Street View) with a fixed crosshair at the center and a primary dot where the pin is. "Place pin here" (secondary) plants the pin under the crosshair; dragging the map never moves it. An address match and "Use my location" (outline) pan the map and plant the pin. A 13px caption reads "34.2400, -118.5293" or "No pin yet". "Remove location" clears the pin. Save stores the pin. Footer left: "Delete building" (ghost, destructive text). Confirm "Delete {name}?" with "It has no areas. This cannot be undone." or "Its {n} areas and their zones go with it. Camera units paired there stay registered. This cannot be undone." Search matches area and building names; a building with no matching area stays while its own name matches and the filter is All. Columns: Room (name + description), Camera unit ("Pi corner, 3 s ago", offline in state-full, "Not paired" in state-shared), Zones ("5 zones"), Status badge (Published / Draft). Rows link to setup. Hairlines only.
"Camera units" section: device cards in an auto-fill grid. Each: 16:9 live thumbnail with a "Live" tag (or muted "No frame, offline"), name, assigned room, status line. Last card is "Pair a camera unit": caption "Type the 6-digit code from its screen.", mono input placeholder "000 000", Pair button.

States: first run ("No buildings yet." with the caption "Add a building, then an area in it. Pair a camera unit, draw zones, publish.", and the pair card alone), loading.

### `/admin/areas/[id]` setup (the projector screen)

Header as overview, "Back to buildings" link. Page header: building in muted weight then area name, pencil opening "Building and area" (Building as a select of existing buildings, which moves the area; Area; Description), caption with description and camera unit status. Right: Published / Draft switch, Delete (ghost).

Left: StepRail. 1 Building and room, 2 Pair the camera unit, 3 Draw zones, 4 Preview and publish.

Step 2 (pair): with a unit paired here, a card first: "Camera unit" caption, the unit name at 20px 600, its status line in state color ("Online, 3 s ago" state-empty, "Offline, 4 min" state-full, "Sharing paused" state-shared), then "Next: draw zones" (primary) and "Change camera unit" (ghost, chevron) which reveals the pair form and the picker. With no unit: "Pair a camera unit", mono input "Code on its screen", Pair button. Under it, "Or pick an existing one": every registered camera unit with its name, "Paired here" (state-empty, medium) / "Paired to {building}, {area}" / "Not paired", status line, and a Use button (reads "Move here" when paired elsewhere). A code or a pick that would take a unit from another area opens a confirmation first: "Move {unit} here?" with Cancel / Move camera unit. Below, a 16:9 muted placeholder: "Waiting for the camera unit" / "The frame appears here a few seconds after pairing."

Step 3 (draw): toolbar above the canvas. Idle: "Draw a zone" (primary, lg), "Upload photo" (outline), right side "Live frame, 1 s ago". Drawing: "Finish zone" (primary), "Undo point", "Cancel", right side "{n} points. Click near the first point to close."
Canvas: 16:9, the real frame. Saved zones as polygons, fill state color at 22% opacity, 3px stroke. Selected zone: 6px stroke plus 16px square white vertex handles. Label at centroid: dark pill, mono 22px white, "Table 2 2/4". Draft polygon: dashed primary stroke, 7px vertex dots, a dashed ring around the first vertex as the snap target. Caption under the canvas: "1280 x 720 from {unit}" with an info icon button beside it. The button opens a popover listing each indicator (box: a detected person, dot: the foot point at the bottom center of the box, zone fill colors, dashed outline for a zone being drawn) and a short note on why feet count rather than the whole box: the camera looks down from a corner, so heads lean across zone edges while feet stay where the person is.
Side panel (beside the canvas, wraps under on tablet): "Zones" list with 10px swatch, name, mono count. Selected row has card background. Under it the editor for the selected zone: Name, Type as two tabs (Seating / Open area), Seats (mono input, seating only) with helper "Full at 4. Shared from 1.", Save, Delete zone. After finishing a drawing the same panel shows "Name the new zone": Name prefilled with a suggestion ("Table 5", next number of the same kind), Type prefilled from the last zone, Seats prefilled from the last seating zone with helper "Same as the other tables. Change if this one differs.", Save zone, Discard. The naming step never covers the canvas.
Toasts: "Zone saved." "Zone deleted." with Undo.

Step 4 (preview): left, a 320px wide live render of the area as the public map shows it. Right: "Ready to publish" checklist rows (Building and area, Camera unit online, Zones "5, all named"), Publish primary lg, caption "Appears on the public map at once. Unpublish any time with the switch above." Once published, "Open the public map" opens `/?q={building}`.

Delete room: AlertDialog "Delete {building}, {room}?" / "Its {n} zones go with it. The camera unit stays paired. This cannot be undone." Cancel, Delete room (destructive).

Optimistic everywhere on this page: publish switch, zone save, zone delete flip locally first, then reconcile.

### Camera unit screens (Tkinter, 800x480, scales to 1280x800)

- Starting: "Spot" 40px centered, "Starting. Connecting to Wi-Fi" 20px muted.
- Pairing: title "Pair this camera unit" 28px. Left: QR 220px on a paper square. Right: code mono 72px accent, tracking 0.1em, "482 913". Line: "Scan, or type the code in the admin app under Camera units." Footer: status left ("Waiting for the admin app. Wi-Fi ok."), Settings button right. On tall screens QR and code stack.
- Live: header "{building}, {room}" 26px (building muted weight), unit name right. One row per zone: name 22px, count mono 38px state colored, state word 22px state colored. Rows 52px, shrink to fit. Bottom: status left ("Posted 2 s ago. Wi-Fi ok."), buttons View camera, Refresh zones, Settings (52px, min width 140).
- Live, no zones: "No zones yet" / "Draw them in the admin app. This screen updates on its own."
- Camera preview popup: fullscreen black, frame with person boxes (4px green), foot dots, zone polygons and labels as in the admin canvas. Top right: Refresh zones, Close. Bottom strip: "Tap the picture to close" and "{n} people, 1 s ago".
- Settings: fullscreen, title "Settings", Close top right. Facts: camera unit name, area, server, version. Buttons: Check for updates, Refresh zones, Pause sharing (reads Resume sharing while paused), Reboot, Power off. Paused: nothing is posted, the footer reads "Sharing paused. Counts stay on this screen." in state-shared. Reboot and Power off open a confirm box ("Reboot the camera unit?" / "It is back in about a minute." and "Power off the camera unit?" / "Unplug it after the screen goes dark.") with Cancel and the action in state-full.
- Updating: rows dimmed to 50%, buttons disabled, Check for updates reads "Updating", footer in state-shared: "Checking for updates" / "Installing packages, this can take a few minutes" / "Updated 3 files, restarting" / "Already up to date" / git error text.

---

## Data changes

- `buildings`: id, name, slug.
- `rooms`: add building_id (not null), slug (unique per building), description (nullable). Drop the seating | line kind concept from new UI.
- Public routes: `/` and `/areas/[building]/[area]`.
- Favorites: pinned zone, room and building ids in localStorage. No login.
- Offline: no heartbeat for 60 s. Drives the Unknown tile state and the "offline" status lines.
- Capacity suggestion: last seating zone's capacity in the room. Name suggestion: next number of the same prefix.
- Realtime: subscribe to zone_counts and camera_units.last_seen.

## Build order against this spec

1. Tokens and fonts (globals.css, layout.tsx). Remove the tracking.
2. ZoneTile with the bar and the 300 ms flash.
3. Public map with buildings, pinned, directory. Then the room page.
4. Admin overview with grouped rooms and device cards.
5. Setup page: step rail, side-by-side editor, naming in the panel, preview step.
6. Camera unit screens.
