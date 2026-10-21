"""Camera unit entry point.

Real mode (default): Picamera2 frames (or a laptop webcam with --webcam),
YOLOv8n person detection, foot point
per box, point-in-polygon per zone, POST counts the moment they change (plus
a heartbeat every 15 s), and a JPEG still every second for the admin zone
editor.

Fake mode (--fake): no camera, no model. Posts made up counts that drift
over time so the public map visibly changes. Use it to demo the web app
from a laptop.

Pairing: with no api_key configured (or with --pair) the unit registers
itself, shows a QR code plus 6-digit pair code on the monitor, and polls
until an admin assigns it to a room in the admin app.

    python main.py --fake
    python main.py --fake --once
    python main.py --dry-run -v          # real camera, print counts, never POST
    python main.py --webcam -v           # laptop webcam instead of the Pi camera
    python main.py --monitor             # on the Pi, with the attached screen
    python main.py --pair --monitor      # ignore the configured key, pair fresh
"""

from __future__ import annotations

import argparse
import logging
import os
import random
import sys
import threading
import time
from pathlib import Path

from api import ApiError, pair_status, post_counts, post_frame, register
from config import Config, load_config
from status import CameraUnavailable, Status, ZoneRow
from state import State
from zones import Confirmer, Zone, ZoneCounter, fetch_zones

# Seconds between attempts to open a missing camera.
CAMERA_RETRY_S = 3.0

log = logging.getLogger("camera-unit")


# ---------------------------------------------------------------------------
# Zones
# ---------------------------------------------------------------------------


class ZoneCache:
    """Holds the zone list and re-fetches it every zone_refresh_s."""

    def __init__(self, cfg: Config) -> None:
        self.cfg = cfg
        self.room_id = cfg.room_id
        self.zones: list[Zone] = []
        self.fetched_at = 0.0

    def set_room(self, room_id: str) -> None:
        if room_id and room_id != self.room_id:
            log.info("room changed to %s", room_id)
            self.room_id = room_id
            self.zones = []
            self.fetched_at = 0.0

    def get(self, force: bool = False) -> list[Zone]:
        now = time.time()
        if not self.room_id:
            return []
        if force or now - self.fetched_at >= self.cfg.zone_refresh_s:
            try:
                zones = fetch_zones(self.cfg.supabase_url, self.cfg.supabase_anon_key, self.room_id)
                self.zones = zones
                self.fetched_at = now
                log.info("loaded %d zones: %s", len(zones), ", ".join(z.name for z in zones) or "(none)")
            except Exception as e:  # noqa: BLE001
                if self.zones:
                    log.warning("zone refresh failed, keeping %d cached zones: %s", len(self.zones), e)
                    self.fetched_at = now
                else:
                    log.error("could not load zones: %s", e)
        return self.zones


def describe(zones: list[Zone], counts: dict[str, int]) -> str:
    parts = []
    for z in zones:
        c = counts.get(z.id, 0)
        cap = f"/{z.capacity}" if z.capacity else ""
        parts.append(f"{z.name}={c}{cap}")
    return "  ".join(parts) or "(no zones)"


# ---------------------------------------------------------------------------
# Fake counts
# ---------------------------------------------------------------------------


class FakeCounts:
    """Random walk per zone so tiles flip between states over a few posts."""

    def __init__(self, seed: int | None = None) -> None:
        self.rng = random.Random(seed)
        self.state: dict[str, int] = {}

    def next(self, zones: list[Zone]) -> dict[str, int]:
        out: dict[str, int] = {}
        for z in zones:
            if z.type == "seating":
                ceiling = z.capacity or 4
            elif z.type == "line":
                ceiling = 8
            else:
                ceiling = 6
            current = self.state.get(z.id, self.rng.randint(0, ceiling))
            step = self.rng.choice([-2, -1, -1, 0, 0, 1, 1, 2])
            current = max(0, min(ceiling, current + step))
            self.state[z.id] = current
            out[z.id] = current
        return out


# ---------------------------------------------------------------------------
# The unit
# ---------------------------------------------------------------------------


class Unit:
    def __init__(self, cfg: Config, args: argparse.Namespace, status: Status) -> None:
        self.cfg = cfg
        self.args = args
        self.status = status
        self.state = State.load()
        self.cache = ZoneCache(cfg)
        self.counter = ZoneCounter(dwell_s=cfg.dwell_s)
        self.confirmer = Confirmer(confirm_s=cfg.confirm_s, confirm_frames=cfg.confirm_frames)
        self.post_interval = args.interval or cfg.post_interval_s
        self.api_key = ""
        self.last_status_check = 0.0

    # ----- pairing -----

    def resolve_api_key(self) -> None:
        """Configured key wins unless --pair. Otherwise use state.json or register."""
        if self.args.reset_pairing:
            self.state.clear()
            log.info("cleared saved pairing")
        if not self.args.pair and self.cfg.api_key:
            self.api_key = self.cfg.api_key
            log.info("using configured api_key")
            return
        if self.state.api_key:
            self.api_key = self.state.api_key
            log.info("using saved api_key for unit %s (pair code %s)", self.state.unit_id, self.state.pair_code)
            return
        self.register()

    def register(self) -> None:
        while not self.status.stop.is_set():
            try:
                data = register(self.cfg.server_url)
                self.state.api_key = data["api_key"]
                self.state.unit_id = data["unit_id"]
                self.state.pair_code = data["pair_code"]
                self.state.save()
                self.api_key = self.state.api_key
                log.info("registered as unit %s with pair code %s", self.state.unit_id, self.state.pair_code)
                return
            except Exception as e:  # noqa: BLE001
                log.error("registration failed, retrying in 5s: %s", e)
                self.status.message = f"Cannot reach the server. Retrying. {e}"
                self.status.stop.wait(5)

    def wait_until_paired(self) -> bool:
        """Blocks until the server reports a room. Returns False if stopped."""
        pair_url = f"{self.cfg.server_url}/admin?code={self.state.pair_code}"
        announced = False
        while not self.status.stop.is_set():
            try:
                data = pair_status(self.cfg.server_url, self.api_key)
            except ApiError as e:
                if e.status == 401:
                    # The row was deleted in the admin app. Start over.
                    log.warning("server does not know this api_key, registering again")
                    self.state.clear()
                    self.register()
                    pair_url = f"{self.cfg.server_url}/admin?code={self.state.pair_code}"
                    continue
                log.error("pair status failed: %s", e)
                data = None
            except Exception as e:  # noqa: BLE001
                log.error("pair status failed: %s", e)
                data = None

            if data is None:
                if self.cfg.room_id and not self.args.pair:
                    log.warning("server unreachable, falling back to configured room %s", self.cfg.room_id)
                    return True
                self.status.message = "Waiting for the admin app. No connection."
            elif data.get("paired"):
                self.cache.set_room(data["room_id"])
                self.status.unit_name = data.get("name", "")
                self.status.room_name = data.get("room_name") or ""
                self.status.building_name = data.get("building_name") or ""
                self.status.message = ""
                self.last_status_check = time.time()
                log.info("paired to room %s (%s)", data.get("room_name"), data["room_id"])
                return True
            else:
                if not announced:
                    log.info("not paired yet. pair code %s, or open %s", self.state.pair_code, pair_url)
                    announced = True
                self.status.mode = "pairing"
                self.status.pair_code = self.state.pair_code
                self.status.pair_url = pair_url
                self.status.unit_name = data.get("name", "")
                self.status.message = "Waiting for the admin app. Wi-Fi ok."

            if self.args.once:
                return False
            self.status.stop.wait(self.cfg.pair_poll_s)
        return False

    def recheck_room(self, force: bool = False) -> None:
        """Every zone_refresh_s, ask the server which room we belong to (admins can reassign)."""
        if not force and time.time() - self.last_status_check < self.cfg.zone_refresh_s:
            return
        self.last_status_check = time.time()
        try:
            data = pair_status(self.cfg.server_url, self.api_key, sharing=self.status.sharing.is_set())
        except Exception as e:  # noqa: BLE001
            log.warning("room re-check failed: %s", e)
            return
        if data.get("paired"):
            self.cache.set_room(data["room_id"])
            self.status.room_name = data.get("room_name") or ""
            self.status.building_name = data.get("building_name") or ""
        else:
            log.warning("unit was unassigned from its room, waiting for pairing")
            self.wait_until_paired()

    def current_zones(self) -> list[Zone]:
        """Zones for this loop iteration. A tap on the monitor's Refresh zones
        button skips the zone_refresh_s wait for both the room and its zones."""
        force = self.status.refresh_zones.is_set()
        self.status.refresh_zones.clear()
        # Pause or Resume sharing: tell the server right away.
        if self.status.resync.is_set():
            self.status.resync.clear()
            self.recheck_room(True)
        self.recheck_room(force)
        zones = self.cache.get(force)
        if force:
            self.status.message = f"Refreshed zones, {len(zones)} loaded."
        return zones

    # ----- publishing -----

    def publish(self, zones: list[Zone], counts: dict[str, int]) -> None:
        log.info("counts: %s", describe(zones, counts))
        self.status.mode = "live"
        self.status.rows = [ZoneRow(z.name, z.type, z.capacity, counts.get(z.id, 0)) for z in zones]
        if self.args.dry_run or not counts or not self.status.sharing.is_set():
            return
        try:
            result = post_counts(self.cfg.server_url, self.api_key, counts)
            log.info("posted: accepted=%s ignored=%s", result.get("accepted"), result.get("ignored", 0))
            self.status.posted_at = time.time()
            self.status.message = ""
        except Exception as e:  # noqa: BLE001
            log.error("post failed: %s", e)
            self.status.message = f"Post failed. {e}"

    def update_preview(self, image, people: list, zones: list[Zone], counts: dict[str, int]) -> None:
        """Renders the monitor's camera popup frame, only while the popup is open."""
        if not self.status.preview_open.is_set():
            return
        try:
            from overlay import render_preview  # lazy, needs Pillow

            self.status.preview = render_preview(image, people, zones, counts)
        except Exception as e:  # noqa: BLE001
            log.warning("preview render failed: %s", e)

    _upload_thread: threading.Thread | None = None

    def upload_frame(self, jpeg: bytes) -> None:
        """Uploads in the background so a slow network never stalls counting.
        If the previous upload is still in flight this frame is skipped."""
        if self.args.dry_run or not self.status.sharing.is_set():
            return
        if self._upload_thread is not None and self._upload_thread.is_alive():
            return

        def work() -> None:
            try:
                post_frame(self.cfg.server_url, self.api_key, jpeg)
                log.debug("frame uploaded (%d bytes)", len(jpeg))
            except Exception as e:  # noqa: BLE001
                log.warning("frame upload failed: %s", e)

        self._upload_thread = threading.Thread(target=work, daemon=True)
        self._upload_thread.start()

    # ----- loops -----

    def run(self) -> int:
        try:
            self.status.message = "Starting. Connecting to Wi-Fi"
            self.resolve_api_key()
            if not self.wait_until_paired():
                log.error("not paired")
                return 2
            if self.args.fake:
                return self.run_fake()
            return self.run_camera()
        finally:
            self.status.stop.set()

    def run_fake(self) -> int:
        fake = FakeCounts(seed=self.args.seed)
        frame_file: bytes | None = None
        if self.args.frame_file:
            frame_file = Path(self.args.frame_file).read_bytes()
            log.info("will upload %s as the live frame every %.1fs", self.args.frame_file, self.cfg.frame_interval_s)
        log.info("fake mode: posting to %s every %.0fs", self.cfg.server_url, self.post_interval)
        next_frame = 0.0
        while not self.status.stop.is_set():
            zones = self.current_zones()
            if not zones:
                log.error("no zones for room %s, is the room published?", self.cache.room_id)
                if self.args.once:
                    return 1
            counts = fake.next(zones)
            self.publish(zones, counts)
            if frame_file and self.status.preview_open.is_set():
                import io

                from PIL import Image

                self.update_preview(Image.open(io.BytesIO(frame_file)).convert("RGB"), [], zones, counts)
            if frame_file and time.time() >= next_frame:
                self.upload_frame(frame_file)
                next_frame = time.time() + self.cfg.frame_interval_s
            if self.args.once:
                return 0
            self.status.stop.wait(self.post_interval)
        return 0

    def open_camera(self, detector) -> bool:
        """Opens the camera, retrying every CAMERA_RETRY_S while it is missing
        so an unplugged camera shows a message instead of crashing the unit.
        False only when the unit is stopping."""
        logged = False
        while not self.status.stop.is_set():
            try:
                detector.start()
                self.status.message = ""
                return True
            except CameraUnavailable as e:
                if not logged:
                    log.error("%s. Retrying every %.0fs", e, CAMERA_RETRY_S)
                    logged = True
                kind = "webcam" if self.args.webcam else "camera"
                self.status.mode = "starting"
                self.status.message = f"No {kind} found. Plug it in, retrying."
                self.status.stop.wait(CAMERA_RETRY_S)
        return False

    def run_camera(self) -> int:
        try:
            from detector import Detector  # lazy, needs ultralytics plus picamera2 or opencv
            detector = Detector(
                self.cfg.frame_width,
                self.cfg.frame_height,
                self.cfg.confidence,
                model=self.args.model,
                webcam=self.args.webcam,
                webcam_index=self.args.webcam_index,
            )
        except ImportError as e:
            if self.args.webcam:
                log.error("webcam mode needs Pillow, ultralytics, and opencv-python: %s", e)
            else:
                log.error("camera mode needs picamera2, Pillow, and ultralytics: %s", e)
                log.error("use --webcam on a laptop, or --fake to run without a camera")
            return 1

        log.info(
            "%s mode: %dx%d, model %s, posting on change plus every %.0fs, frame every %.1fs",
            "webcam" if self.args.webcam else "camera",
            self.cfg.frame_width, self.cfg.frame_height, self.args.model, self.post_interval, self.cfg.frame_interval_s,
        )
        if not self.open_camera(detector):
            return 0
        try:
            next_post = time.time()
            next_frame = time.time()
            next_log = 0.0
            frames_since_log = 0
            # Post on change: a zone's count has to stay the same for
            # confirm_s seconds (and confirm_frames frames) before it counts,
            # so a person walking past or one missed detection never flips a
            # tile. Otherwise a heartbeat post every post_interval_s keeps
            # last_seen and updated_at fresh.
            while not self.status.stop.is_set():
                zones = self.current_zones()
                try:
                    frame = detector.capture()
                except CameraUnavailable as e:
                    log.error("camera lost: %s", e)
                    if not self.open_camera(detector):
                        return 0
                    continue
                people = detector.detect(frame)
                feet = [p.foot for p in people]
                self.status.people = len(people)
                self.status.frame_at = time.time()
                latest = self.counter.count(zones, feet)
                now = time.time()
                stable, changed = self.confirmer.update(latest, now)
                self.status.rows = [ZoneRow(z.name, z.type, z.capacity, stable.get(z.id, 0)) for z in zones]
                self.status.mode = "live"
                if self.status.preview_open.is_set():
                    from overlay import bgr_to_image

                    self.update_preview(bgr_to_image(frame), people, zones, stable)
                frames_since_log += 1
                if self.args.verbose and now >= next_log:
                    log.info("frame: %d people, live %s, held %s  (%d fps)", len(feet), describe(zones, latest),
                             describe(zones, stable), frames_since_log)
                    next_log = now + 1.0
                    frames_since_log = 0

                if self.args.show:
                    from detector import draw_people_cv
                    import cv2

                    preview = frame.copy()
                    draw_people_cv(preview, people)
                    cv2.imshow("camera unit (q to quit)", preview)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        return 0
                if now >= next_frame:
                    self.upload_frame(detector.jpeg(frame, people if self.args.overlay else None))
                    next_frame = now + self.cfg.frame_interval_s
                if changed or now >= next_post:
                    self.publish(zones, stable)
                    next_post = now + self.post_interval
                    if self.args.once:
                        return 0
        finally:
            detector.stop()
            if self.args.show:
                import cv2

                cv2.destroyAllWindows()
        return 0


# ---------------------------------------------------------------------------


def current_version() -> str:
    """Short git hash of the checkout, or "" when git is unavailable."""
    import subprocess

    try:
        out = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=Path(__file__).resolve().parent,
                             capture_output=True, text=True, timeout=5)
    except (OSError, subprocess.TimeoutExpired):
        return ""
    return out.stdout.strip() if out.returncode == 0 else ""


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Camera unit: counts people per zone and posts to the web app.")
    p.add_argument("--fake", action="store_true", help="post made up counts, no camera or model needed")
    p.add_argument("--once", action="store_true", help="post one batch and exit")
    p.add_argument("--dry-run", action="store_true", help="print counts but never POST")
    p.add_argument("--interval", type=float, default=None,
                   help="seconds between heartbeat posts (default from config, 15). Camera mode also posts on every change")
    p.add_argument("--confirm", type=float, default=None,
                   help="seconds a count change must hold before it is shown and posted (default from config, 5)")
    p.add_argument("--seed", type=int, default=None, help="random seed for --fake")
    p.add_argument("--frame-file", default=None, help="with --fake: upload this JPEG as the live frame")
    p.add_argument("--model", default="yolov8n.pt", help="Ultralytics model file (default yolov8n.pt)")
    p.add_argument("--webcam", action="store_true", help="use an OpenCV webcam instead of Picamera2 (laptop testing)")
    p.add_argument("--webcam-index", type=int, default=0, help="which webcam to open with --webcam (default 0)")
    p.add_argument("--show", action="store_true", help="open a preview window with person boxes and foot points (needs opencv)")
    p.add_argument("--no-overlay", dest="overlay", action="store_false",
                   help="upload the raw frame instead of drawing person boxes and foot points on it")
    p.add_argument("--monitor", action="store_true", help="show the attached monitor UI (pair code, then live counts)")
    p.add_argument("--pair", action="store_true", help="ignore the configured api_key and pair through the admin app")
    p.add_argument("--reset-pairing", action="store_true", help="forget the saved pairing and register again")
    p.add_argument("--verbose", "-v", action="store_true", help="log every frame")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    cfg = load_config()
    if args.confirm is not None:
        cfg.confirm_s = max(0.0, args.confirm)
    log.info("server %s, confirm hold %.1fs", cfg.server_url, cfg.confirm_s)
    status = Status()
    status.server_url = cfg.server_url
    status.version = current_version()
    unit = Unit(cfg, args, status)

    if not args.monitor:
        try:
            return unit.run()
        except KeyboardInterrupt:
            log.info("stopped")
            return 0

    try:
        from monitor import Monitor
    except ImportError as e:
        log.error("monitor needs tkinter (sudo apt install python3-tk): %s", e)
        return 1

    result: list[int] = []

    def worker() -> None:
        try:
            result.append(unit.run())
        except Exception:  # noqa: BLE001
            log.exception("worker crashed")
            result.append(1)

    monitor = Monitor(status)
    thread = threading.Thread(target=worker, daemon=True)
    monitor.run(thread)
    if status.restart.is_set():
        # The Update button pulled new code. Let the worker release the camera,
        # then replace this process with a fresh one on the same arguments.
        # Under systemd this looks like a normal restart.
        thread.join(timeout=15)
        log.info("restarting after update")
        os.execv(sys.executable, [sys.executable] + sys.argv)
    return result[0] if result else 0


if __name__ == "__main__":
    sys.exit(main())
