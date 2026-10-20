# Camera unit

Python script for the Raspberry Pi 5 + Camera Module 3. It counts people
inside each zone of its room and POSTs the counts to `/api/ingest` every
30 seconds. No video leaves the camera unit, only counts.

## Files

- `main.py`: entry point. Real mode by default, `--fake` for no camera.
- `detector.py`: Picamera2 capture + YOLOv8n person detection, foot point per box.
- `zones.py`: fetch zones from Supabase, point-in-polygon, dwell memory.
- `poster.py`: POST to the ingest route.
- `config.py`: config from env vars, then `config.json`, then demo defaults.
- `test_zones.py`: offline unit tests (`python3 -m unittest test_zones.py`).

## Fake mode from a laptop (no camera)

Posts made up counts that drift so the public map tiles change. Needs only
Python 3.10+ and the standard library.

```bash
cd camera-unit
INGEST_URL=https://YOUR-DEPLOYMENT.vercel.app/api/ingest python3 main.py --fake
```

Flags: `--once` posts one batch and exits, `--dry-run` prints without posting,
`--interval 5` posts faster, `--seed 1` makes the sequence repeatable.

Against a local dev server: `pnpm dev` in the repo root (with
`SUPABASE_SERVICE_ROLE_KEY` in `.env.local`), then the default
`INGEST_URL` of `http://localhost:3000/api/ingest` already matches.

## Config

Copy `config.example.json` to `config.json` and edit, or set env vars:

| key | env var | default |
| --- | --- | --- |
| `supabase_url` | `SUPABASE_URL` | demo project |
| `supabase_anon_key` | `SUPABASE_ANON_KEY` | demo anon key |
| `ingest_url` | `INGEST_URL` | `http://localhost:3000/api/ingest` |
| `api_key` | `CAMERA_API_KEY` | demo camera unit key |
| `room_id` | `ROOM_ID` | Demo Classroom |
| `post_interval_s` | `POST_INTERVAL_S` | 30 |
| `zone_refresh_s` | `ZONE_REFRESH_S` | 180 |
| `dwell_s` | `DWELL_S` | 600 |
| `frame_width` / `frame_height` | `FRAME_WIDTH` / `FRAME_HEIGHT` | 1280 / 720 |
| `confidence` | `CONFIDENCE` | 0.4 |

Zone polygons are in frame pixels, so keep the frame size the same as the
frame the admin app uses to draw zones (1280x720).

## Raspberry Pi 5 setup

1. Raspberry Pi OS (64-bit, Bookworm). Plug in Camera Module 3 and check it:
   `rpicam-hello -t 2000`.
2. System packages:
   ```bash
   sudo apt update
   sudo apt install -y python3-picamera2 python3-venv git
   ```
3. Clone the repo and create a venv that can see the apt picamera2:
   ```bash
   git clone <repo url> && cd free-space-detector/camera-unit
   python3 -m venv --system-site-packages .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
4. `cp config.example.json config.json`, fill in `ingest_url` and `api_key`.
5. First run downloads `yolov8n.pt` (about 6 MB), so do it with internet:
   ```bash
   python3 main.py --dry-run -v
   ```
   You should see per-frame person counts. Then drop `--dry-run` to post.
6. Run on boot with a user systemd service:
   ```ini
   # ~/.config/systemd/user/camera-unit.service
   [Unit]
   Description=Camera unit
   After=network-online.target

   [Service]
   WorkingDirectory=%h/free-space-detector/camera-unit
   ExecStart=%h/free-space-detector/camera-unit/.venv/bin/python main.py
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
  An unpublished room returns no zones. Re-fetched every 3 minutes.
- Foot point = bottom center of each person box. Mount the camera unit high
  and tilted down so feet land inside the table polygons.
- Dwell memory: a seating zone keeps its last nonzero count for 10 minutes
  after the last person leaves (bags on tables). Line and open zones are live.
- YOLOv8n on the Pi 5 CPU runs at roughly 2 to 4 frames per second at 640 px,
  which is plenty for a 30 s posting interval.
- The ingest route ignores zone ids outside the camera unit's room, so a
  wrong `room_id` shows up as `accepted=0` in the log.
