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

Typeface: IBM Plex Sans for everything. JetBrains Mono only for counts and pair codes. Letter spacing 0. Tabular numerals on. Radius 0. Spacing scale 4 8 12 16 24 32 48.

Light

| token | oklch | hex |
|---|---|---|
| background | 0.955 0.012 85 | #f3efe7 |
| foreground | 0.245 0.012 70 | #26221d |
| card, popover | 0.98 0.006 85 | #faf8f3 |
| muted, accent | 0.93 0.014 85 | #ebe6dc |
| muted-foreground | 0.52 0.014 70 | #6f6861 |
| secondary | 0.91 0.014 85 | #e6e1d6 |
| border, input | 0.86 0.016 85 | #d9d3c8 |
| primary, ring | 0.47 0.075 140 | #4a6b3f |
| primary-foreground | = background | |
| destructive | 0.48 0.15 30 | #a8382c |
| state-empty | 0.53 0.10 150 | #3f7d4e |
| state-shared | 0.60 0.13 65 | #b5711a |
| state-full | = destructive | |
| state-unknown | 0.66 0.012 70 | #9d958b |
| state-line (reserved) | 0.56 0.09 240 | #4f7fa8 |

Dark

| token | oklch | hex |
|---|---|---|
| background | 0.22 0.010 70 | #1f1c18 |
| foreground | 0.92 0.014 85 | #ece6da |
| card, popover | 0.25 0.012 70 | #27231e |
| muted, accent | 0.29 0.012 70 | #2f2a24 |
| muted-foreground | 0.68 0.014 70 | #a39b90 |
| secondary | 0.31 0.012 70 | #332e28 |
| border, input | 0.33 0.012 70 | #3a3530 |
| primary, ring | 0.67 0.09 140 | #7fa66f |
| primary-foreground | = background | |
| destructive | 0.63 0.16 30 | #e2655a |
| state-empty | 0.72 0.14 150 | #6cc07e |
| state-shared | 0.75 0.14 70 | #e0a24a |
| state-full | = destructive | |
| state-unknown | 0.55 0.012 70 | #7d756b |
| state-line (reserved) | 0.68 0.09 240 | #6f9bc4 |

Camera unit (Tkinter, hex): bg #1f1c18, text #ece6da, muted #a39b90, button #27231e, pressed #332e28, accent #7fa66f, empty #6cc07e, shared #e0a24a, full #e2655a.

Type scale: display 44/600 tracking -0.02em, heading 24/600 tracking -0.01em, body 15/400 line-height 1.5, caption 13 muted-foreground, label 12/500 uppercase tracking 0.08em. Counts: mono 700, 34px on phone tiles, 44px on room page tiles, 76px on projector tiles.

Shadows: shadcn defaults only (xs = 0 1px 2px 5% black). No glow, no gradients, no tints behind content.

---

## Components

shadcn/ui parts stay shadcn shaped, restyled by the tokens above: Button (36px, lg 40px), Input (36px), Select, Switch (pill), Badge (outline, secondary), Tabs (muted pill), Separator, Skeleton, Dialog, AlertDialog, Sonner toast (foreground bg, background text, "Undo" as underlined text button).

Three custom components:

**ZoneTile** (`components/public-map/zone-tile.tsx`)
- Card background. No border, no tint.
- Top: zone name, 12px muted. Middle: count in mono, state colored. Bottom: state word, 14px 600 ink.
- A 6px solid bar along the bottom edge in the state color. This bar and the numeral are what change state.
- Count text: seating `{count}/{capacity}`, open `{count}`.
- State words: Empty, Shared, Full, Some people, Busy. Unknown tile when the camera unit is offline: count in state-unknown, word "Unknown, 4 min", bar state-unknown. A camera unit that paused sharing counts as offline here; only the admin says "sharing paused". Never falsely reassuring.
- When state changes, flash the bar for 300 ms. No other motion anywhere.

**RoomRow** (map directory)
- Grid: name, summary caption, free count (mono 20px state colored, "free" caption), a chevron, and a 4px segmented strip with one segment per zone in its state color.
- The chevron opens the area's spots as ZoneTiles beneath the row, closed by default. The name links to the area page.
- Hairline between rows. Building headers sit on the accent background.

**StepRail** (admin setup)
- Number in the margin (mono 12), step title, status caption. Current step gets a 2px primary left rule and bold title. Statuses: Done, In progress, Waiting, Needs attention, Ready.

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
1. Headline: "Find a free spot", 44px. Caption: "Camera units count people in each area and update this map live. Counts only, no video." While realtime is reconnecting the caption turns state-shared: "Reconnecting. Counts from 1 min ago". The old `{free} free seats` total is retired here; per-building and per-area counts stay in the directory.
2. Search input, placeholder "Room or building". Tabs: All, Free now.
3. Directory grouped by building. Buildings and areas can both be pinned, each with a pin toggle beside the name (filled in state-empty when on). Pinning an area pins its building; unpinning a building unpins its areas. A pinned building sorts first, then a building with a pinned area; pinned areas sort first within a building. Then buildings by free seats and areas by free seats. Building heading 20px 600 on the accent background with "{n} free in {m} areas". RoomRows beneath.

States: loading (skeletons), no rooms published ("No rooms yet" / "Rooms appear here once staff publish them."), no search results (`No rooms or buildings match "{q}".` + Clear search), stale (reconnecting caption, offline rooms show "Camera unit offline, 4 min" and "?" with "unknown").

Laptop: container max 1120, directory in 2 to 3 columns.

### `/areas/[building]/[area]` area page

Header: wordmark, "All rooms" back link, theme toggle, account icon.
Building name as a small uppercase link above the room name (32px). Optional description under it. Buttons: Pin (toggle, outline, pin icon filled in state-empty when on, reads Pinned), Share.
Summary: `{free} free seats` 44px, caption "2 of 4 tables open. Updated 8 s ago".
ZoneTile grid, larger (min 165px, count 44px).

States: loading, no zones ("No zones yet" / "Staff draw zones in the admin app. Counts appear here after that."), camera unit offline (headline "Camera unit offline" in state-full, caption "Last update 4:12 PM, 4 min ago. Counts below are from then.", all tiles Unknown).

### `/admin/login`

Centered, max 360. Wordmark, "Staff sign in", Email, Password, Sign in (full width, 40px). Error under the form: "Wrong email or password." Signing in: button disabled, reads "Signing in". Footer caption: "Accounts are created by hand. No sign up."

### `/admin` overview

Top bar: wordmark, "Admin" label, Rooms link. Right: Public map, Sign out.
Heading "Rooms", caption `{n} rooms in {m} buildings, {p} published. {k} camera unit offline.`, "Set up a room" primary button.
Room list grouped under building labels. Columns: Room (name + description), Camera unit ("Pi corner, 3 s ago", offline in state-full, "Not paired" in state-shared), Zones ("5 zones"), Status badge (Published / Draft). Rows link to setup. Hairlines only.
"Camera units" section: device cards in an auto-fill grid. Each: 16:9 live thumbnail with a "Live" tag (or muted "No frame, offline"), name, assigned room, status line. Last card is "Pair a camera unit": caption "Type the 6-digit code from its screen.", mono input placeholder "000 000", Pair button.

States: first run ("No rooms yet." plus the one-line setup summary, and the pair card alone), loading.

### `/admin/areas/[id]` setup (the projector screen)

Header as overview. Page header: building in muted weight then room name, rename pencil, caption with description and camera unit status. Right: Published / Draft switch, Delete (ghost).

Left: StepRail. 1 Building and room, 2 Pair the camera unit, 3 Draw zones, 4 Preview and publish.

Step 2 (pair): "Pair the camera unit", mono input "Code on its screen", Pair button. Below, a 16:9 muted placeholder: "Waiting for the camera unit" / "The frame appears here a few seconds after pairing."

Step 3 (draw): toolbar above the canvas. Idle: "Draw a zone" (primary, lg), "Upload photo" (outline), right side "Live frame, 1 s ago". Drawing: "Finish zone" (primary), "Undo point", "Cancel", right side "{n} points. Click near the first point to close."
Canvas: 16:9, the real frame. Saved zones as polygons, fill state color at 22% opacity, 3px stroke. Selected zone: 6px stroke plus 16px square white vertex handles. Label at centroid: dark pill, mono 22px white, "Table 2 2/4". Draft polygon: dashed primary stroke, 7px vertex dots, a dashed ring around the first vertex as the snap target. Caption under the canvas: "1280 x 720 from {unit}. Boxes are people. Dots are feet, which is what counts."
Side panel (beside the canvas, wraps under on tablet): "Zones" list with 10px swatch, name, mono count. Selected row has card background. Under it the editor for the selected zone: Name, Type as two tabs (Seating / Open area), Seats (mono input, seating only) with helper "Full at 4. Shared from 1.", Save, Delete zone. After finishing a drawing the same panel shows "Name the new zone": Name prefilled with a suggestion ("Table 5", next number of the same kind), Type prefilled from the last zone, Seats prefilled from the last seating zone with helper "Same as the other tables. Change if this one differs.", Save zone, Discard. The naming step never covers the canvas.
Toasts: "Zone saved." "Zone deleted." with Undo.

Step 4 (preview): left, a 320px wide live render of the public room page. Right: "Ready to publish" checklist rows (Building and room, Camera unit online, Zones "5, all named", Link slug), Publish primary lg, caption "Appears on the public map at once. Unpublish any time with the switch above."

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
- Favorites: pinned room ids in localStorage. No login.
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
