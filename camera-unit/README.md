# Camera unit

Python script for the Raspberry Pi 5 + Camera Module 3 with a small attached
monitor. It counts people inside each zone of its room, POSTs the counts to
`/api/ingest` every 30 seconds, and sends one JPEG still every few seconds so
the admin zone editor can show a live frame. No video leaves the camera unit.

## Files

- `main.py`: entry point. Real mode by default, `--webcam` for a laptop camera, `--fake` for no camera.
- `detector.py`: Picamera2 or OpenCV webcam capture + YOLOv8n person detection, foot point per box, JPEG encoding.
- `zones.py`: fetch zones from Supabase, point-in-polygon, dwell memory.
- `api.py`: calls to `/api/ingest`, `/api/frame`, `/api/pair/register`, `/api/pair/status`.
- `monitor.py`: fullscreen tkinter UI for the attached monitor.
- `status.py`: shared state between the loop and the monitor, tile rules.
- `state.py`: `state.json`, the api_key issued at pairing (gitignored).
- `config.py`: config from env vars, then `config.json`, then demo defaults.
- `test_zones.py`: offline unit tests (`python3 -m unittest test_zones.py`).

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
- `--interval 5` posts faster, `--seed 1` makes the sequence repeatable.
- `--frame-file classroom.jpg` also uploads that photo as the live frame, so
  the zone editor shows something to draw on without a Pi.
- `--pair` ignores the configured api_key and goes through the pairing flow.
- `--monitor` opens the monitor UI (needs tkinter, see below).

## Webcam mode from a laptop (real detection, no Pi)

Runs the real pipeline (YOLOv8n, foot points, point-in-polygon, dwell
memory, live frame upload) against a laptop or USB webcam instead of the
Pi camera. Use it to rehearse the demo: draw zones over the webcam frame in
the admin app, then step in and out of them and watch the tiles flip.

```bash
cd camera-unit
pip install ultralytics opencv-python Pillow
python main.py --webcam --dry-run -v    # first run downloads yolov8n.pt
python main.py --webcam --interval 5    # post for real, faster than 30 s
```

- `--webcam-index 1` picks a second camera if 0 is the wrong one.
- Frames are resized to `frame_width` x `frame_height` (1280x720), so zone
  polygons drawn in the admin app line up no matter what the webcam outputs.
- Expect a few frames per second on a laptop CPU, more with a GPU.
- Windows: `python` instead of `python3`. Env vars are `set NAME=value` in
  cmd or `$env:NAME="value"` in PowerShell.

## Pairing

A camera unit with no api_key (empty `api_key` in `config.json`, or
`--pair`) registers itself on first boot, saves the issued key in
`state.json`, and shows a QR code plus a 6-digit pair code on the monitor.
An admin scans the QR (it opens the admin app with the code filled in) or
types the code under Camera units and picks a room. The unit polls every 3
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
| `post_interval_s` | `POST_INTERVAL_S` | 30 |
| `frame_interval_s` | `FRAME_INTERVAL_S` | 4 |
| `zone_refresh_s` | `ZONE_REFRESH_S` | 20 |
| `pair_poll_s` | `PAIR_POLL_S` | 3 |
| `dwell_s` | `DWELL_S` | 600 |
| `frame_width` / `frame_height` | `FRAME_WIDTH` / `FRAME_HEIGHT` | 1280 / 720 |
| `confidence` | `CONFIDENCE` | 0.4 |

Zone polygons are in frame pixels, so keep the frame size at 1280x720, the
size the admin app draws on.

## Raspberry Pi 5 setup

1. Raspberry Pi OS (64-bit, Bookworm, with desktop so the monitor UI can
   run). Plug in Camera Module 3 and check it: `rpicam-hello -t 2000`.
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
   pip install -r requirements.txt
   ```
4. `cp config.example.json config.json`, set `server_url`. Leave `api_key`
   empty to pair through the admin app, or paste the demo key to skip it.
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

## Behavior notes

- Zones are fetched with the anon key, which RLS allows for published rooms.
  An unpublished room returns no zones. Re-fetched every 20 seconds, so zones drawn in the admin app go live fast, and the
  server is asked which room the unit belongs to on the same schedule, so an
  admin can reassign a unit without restarting it.
- Foot point = bottom center of each person box. Mount the camera unit high
  and tilted down so feet land inside the table polygons.
- Dwell memory: a seating zone keeps its last nonzero count for 10 minutes
  after the last person leaves (bags on tables). Line and open zones are live.
- The live frame is one JPEG (quality 70, about 100 to 150 KB) every 4 s,
  overwritten in place in the `frames` storage bucket. Only the latest is kept.
- YOLOv8n on the Pi 5 CPU runs at roughly 2 to 4 frames per second at 640 px,
  which is plenty for a 30 s posting interval.
- The ingest route ignores zone ids outside the camera unit's room, so a
  wrong room shows up as `accepted=0` in the log.
