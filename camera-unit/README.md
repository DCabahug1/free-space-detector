# Camera unit

Python script for the Raspberry Pi 5 + Camera Module 3 with a small attached
monitor. It counts people inside each zone of its room, POSTs the counts to
`/api/ingest` whenever they change (plus a 15 s heartbeat), and sends one JPEG still every second so
the admin zone editor can show a live frame. No video leaves the camera unit.

## Files

- `main.py`: entry point. Real mode by default, `--webcam` for a laptop camera, `--fake` for no camera.
- `detector.py`: Picamera2 or OpenCV webcam capture + YOLOv8n person detection, foot point per box, JPEG encoding.
- `zones.py`: fetch zones from Supabase, point-in-polygon, optional dwell memory.
- `api.py`: calls to `/api/ingest`, `/api/frame`, `/api/pair/register`, `/api/pair/status`.
- `monitor.py`: fullscreen tkinter UI for the attached monitor.
- `status.py`: shared state between the loop and the monitor, tile rules.
- `overlay.py`: draws person boxes and state-colored zones on a frame, for
  the monitor's camera popup.
- `updater.py`: Check for updates on the monitor's Settings screen. `git pull`, then pip install if
  `requirements.txt` changed.
- `state.py`: `state.json`, the api_key issued at pairing (gitignored).
- `config.py`: config from env vars, then `config.json`, then demo defaults.
- `test_zones.py`, `test_updater.py`: offline unit tests
  (`python3 -m unittest test_zones.py test_updater.py`).

## Fake mode from a laptop (no camera)

Posts made up counts that drift so the public map tiles change. Needs only
Python 3.10+ and the standard library. The default config uses the demo
camera unit's api_key, so this works with zero setup against a dev server.

```bash
cd camera-unit
python3 main.py --fake --interval 5
```

The default server is the live deployment, https://free-space-detector.vercel.app.
To hit a local `pnpm dev` instead, set `SERVER_URL`:

```bash
SERVER_URL=http://localhost:3000 python3 main.py --fake     # macOS / Linux
set SERVER_URL=http://localhost:3000 && python main.py --fake   # Windows cmd
```

Flags:

- `--once` posts one batch and exits, `--dry-run` prints without posting.
- `--interval 5` posts every 5 s (fake mode has no changes to react to), `--seed 1` makes the sequence repeatable.
- `--frame-file classroom.jpg` also uploads that photo as the live frame, so
  the zone editor shows something to draw on without a Pi.
- `--pair` ignores the configured api_key and goes through the pairing flow.
- `--monitor` opens the monitor UI (needs tkinter, see below).

## Webcam mode from a laptop (real detection, no Pi)

Runs the real pipeline (YOLOv8n, foot points, point-in-polygon, live frame
upload) against a laptop or USB webcam instead of the
Pi camera. Use it to rehearse the demo: draw zones over the webcam frame in
the admin app, then step in and out of them and watch the tiles flip.

```bash
cd camera-unit
pip install ultralytics opencv-python Pillow
python main.py --webcam --dry-run -v    # first run downloads yolov8n.pt
python main.py --webcam                 # post for real
```

- `--webcam-index 1` picks a second camera if 0 is the wrong one.
- `--show` opens a local preview window with the person boxes and the red
  foot point. Press q to quit.
- Frames are resized to `frame_width` x `frame_height` (1280x720), so zone
  polygons drawn in the admin app line up no matter what the webcam outputs.
- Expect a few frames per second on a laptop CPU, more with a GPU.
- Windows: `python` instead of `python3`. Env vars are `set NAME=value` in
  cmd or `$env:NAME="value"` in PowerShell.

## Pairing

A camera unit with no api_key (empty `api_key` in `config.json`, or
`--pair`) registers itself on first boot, saves the issued key in
`state.json`, and shows a QR code plus a 6-digit pair code on the monitor.
An admin scans the QR with the Scan button in the admin app's pair form (the QR holds only the 6 digits) or
types the code on the admin overview (or on the room setup page, step 2) and picks a room. The unit polls every 3
seconds until a room is assigned, then starts counting.

- `--reset-pairing` forgets `state.json` and registers a new camera unit.
- If an admin deletes the unit, the next status poll gets a 401 and the unit
  registers again with a fresh code.
- If the server is unreachable at boot and `room_id` is configured, the unit
  falls back to that room so counting continues.

Short on time for the demo? Leave the demo api_key in place and skip
pairing entirely. The unit is already assigned to the Demo Classroom.

## Config

Copy `config.example.json` to `config.json` and edit, or set env vars. An
empty env var counts as set, so `CAMERA_API_KEY=""` forces pairing.

| key | env var | default |
| --- | --- | --- |
| `supabase_url` | `SUPABASE_URL` | demo project |
| `supabase_anon_key` | `SUPABASE_ANON_KEY` | demo anon key |
| `server_url` | `SERVER_URL` | `https://free-space-detector.vercel.app` |
| `api_key` | `CAMERA_API_KEY` | demo camera unit key |
| `room_id` | `ROOM_ID` | Demo Classroom (fallback only) |
| `post_interval_s` | `POST_INTERVAL_S` | 15 |
| `confirm_s` | `CONFIRM_S` | 5 |
| `confirm_frames` | `CONFIRM_FRAMES` | 2 |
| `frame_interval_s` | `FRAME_INTERVAL_S` | 1 |
| `zone_refresh_s` | `ZONE_REFRESH_S` | 20 |
| `pair_poll_s` | `PAIR_POLL_S` | 3 |
| `dwell_s` | `DWELL_S` | 0 |
| `frame_width` / `frame_height` | `FRAME_WIDTH` / `FRAME_HEIGHT` | 1280 / 720 |
| `confidence` | `CONFIDENCE` | 0.4 |

`confidence` is the YOLO threshold. Each box in the overlay shows its score,
so if clothing on a chair gets detected, raise it until those drop out
(`set CONFIDENCE=0.6`). Real people usually score 0.7 or higher.

Zone polygons are in frame pixels, so keep the frame size at 1280x720, the
size the admin app draws on.

## Raspberry Pi 5 setup

1. Raspberry Pi OS (64-bit, Bookworm, with desktop so the monitor UI can
   run). Plug in Camera Module 3 and check it: `rpicam-hello -t 2000`.
   Using a USB webcam instead? Skip that check (`rpicam-hello` only sees CSI
   cameras) and add `--webcam` to every `main.py` command below.
2. System packages:
   ```bash
   sudo apt update
   sudo apt install -y python3-picamera2 python3-tk python3-venv git
   ```
3. Clone the repo and create a venv that can see the apt packages:
   ```bash
   git clone <repo url> && cd free-space-detector/camera-unit
   python3 -m venv --system-site-packages .venv
   source .venv/bin/activate
   pip install "numpy<2" -r requirements.txt
   ```
   The numpy pin matters: the apt picamera2 build breaks under numpy 2, and
   pip would otherwise upgrade it while installing ultralytics. Torch for
   aarch64 is about 200 MB, so the install takes a few minutes.
4. `cp config.example.json config.json`. The defaults already point at the
   live deployment. Leave `api_key` empty to pair through the admin app, or
   paste the demo key to skip it.
5. First run downloads `yolov8n.pt` (about 6 MB), so do it with internet:
   ```bash
   python3 main.py --dry-run -v
   ```
   You should see per-frame person counts. Then run for real with the monitor:
   ```bash
   python3 main.py --monitor
   ```
   Escape or q closes the monitor and stops the unit.
6. Run on boot with a user systemd service (needs the desktop session for
   the monitor, so it starts after graphical login):
   ```ini
   # ~/.config/systemd/user/camera-unit.service
   [Unit]
   Description=Camera unit
   After=graphical-session.target network-online.target

   [Service]
   WorkingDirectory=%h/free-space-detector/camera-unit
   Environment=DISPLAY=:0
   ExecStart=%h/free-space-detector/camera-unit/.venv/bin/python main.py --monitor
   # USB webcam instead of Camera Module 3: add --webcam to ExecStart.
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=default.target
   ```
   ```bash
   systemctl --user enable --now camera-unit
   loginctl enable-linger $USER
   journalctl --user -u camera-unit -f
   ```
7. Desktop shortcut to start it again after Quit: copy
   `camera-unit.desktop` to `~/Desktop` and mark it executable. It runs
   `systemctl --user start camera-unit.service`.
   ```bash
   cp camera-unit.desktop ~/Desktop/ && chmod +x ~/Desktop/camera-unit.desktop
   ```

## Behavior notes

- Counts post when they change, after a hold. A zone's new count has to stay
  the same for `confirm_s` seconds (5 by default) and `confirm_frames`
  frames so someone walking past, or one missed detection, never flips a
  tile. The monitor shows the held counts too, so the Pi screen and the map
  agree. While a change is held, the row's state word becomes a countdown,
  "-> 2/4 in 3 s", and the camera popup label gets the same suffix.
- Capture and detection run on separate threads. The camera loop grabs
  frames at the camera's rate and draws the monitor's popup from each one
  with the last known boxes, up to 15 fps, while YOLO runs on the newest
  frame it can keep up with. Counts, the hold, posts and the 1 s frame
  upload keep their cadence. On top of that a heartbeat post every `post_interval_s` (15 s)
  keeps `last_seen` and `updated_at` fresh. The public map subscribes to
  Realtime, so a tile flips about a second after the hold ends. `--confirm 0`
  turns the hold off for testing.
- The monitor UI scales to the screen. On screens shorter than 600 px (the
  Pi touchscreen) the pairing view puts the QR and pair code side by side.
- The live screen has a "View camera" button. It opens a fullscreen popup
  with the camera feed, the person boxes and foot points, and every zone
  drawn over it, colored by state (green vacant, orange occupied, red full)
  and labeled like "Table 1 (1/4)". Tap the picture or Close to go back. The
  overlay is only rendered while the popup is open, so it costs nothing the
  rest of the time. With `--fake --frame-file photo.jpg` the popup shows
  that photo with the fake counts, handy for testing the monitor on a laptop.

- The Settings button (on the live and pairing screens) opens Check for
  updates, Refresh zones, Pause sharing, Reboot, Power off and Quit. Quit
  asks first, then stops the user service (`systemctl --user stop`), so
  `Restart=always` does not bring it back; outside systemd it just exits.
  The desktop shortcut or a reboot starts it again. Pause sharing
  stops posting counts and frames until Resume sharing; the area reads
  offline on the map after a minute. Reboot and Power off ask first,
  then run `systemctl reboot` or `systemctl poweroff` (`sudo -n` as the
  fallback). Check for updates runs `git pull
  --ff-only` on the repo, installs packages if `requirements.txt` changed,
  and restarts the unit with the same arguments, so new code can be picked up
  from the touchscreen without SSH. Counting keeps running during the pull.
  "Already up to date" means nothing happened. If the pull fails (no network,
  or local edits on the Pi that conflict), the footer shows the git error and
  the unit keeps running the old code. Under systemd the restart is just a
  process replacement, so the service stays up.
- Remote update: "Update" in the admin app's camera unit menu sets
  `camera_units.update_requested_at`. The unit's next `/api/pair/status`
  poll (every `zone_refresh_s`, 20 s) hands the request over and clears it,
  and the unit runs the same updater as Check for updates. Each poll also
  reports the running short git hash, which the admin app shows beside the
  status line.
- Zones are fetched with the anon key, which RLS allows for published rooms.
  An unpublished room returns no zones. Re-fetched every 20 seconds, so zones drawn in the admin app go live fast, and the
  server is asked which room the unit belongs to on the same schedule, so an
  admin can reassign a unit without restarting it.
- Foot point = bottom center of each person box. That single point decides
  which zone a person is in; box overlap is never checked. Mount the camera
  unit high and tilted down so feet land inside the table polygons.
- The uploaded frame has each person box (yellow) and foot point (red) drawn
  on it, so the admin zone editor shows exactly where zones need to be.
  `--no-overlay` uploads the raw frame instead.
- Counts are live: when a person leaves a zone, the spot is free on the next
  post. There is no grace period. `dwell_s` can turn one on for seating
  zones (for example `DWELL_S=120` keeps a table marked taken for 2 minutes
  after the last person leaves), but the default is 0.
- The live frame is one JPEG (quality 70, about 100 to 150 KB) every 1 s,
  overwritten in place in the `frames` storage bucket. Only the latest is kept.
- YOLOv8n on the Pi 5 CPU runs at roughly 2 to 4 frames per second at 640 px,
  which is plenty: the 5 s confirm hold is the only delay a viewer notices.
- The ingest route ignores zone ids outside the camera unit's room, so a
  wrong room shows up as `accepted=0` in the log.
