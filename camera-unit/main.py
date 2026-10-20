"""Camera unit entry point.

Real mode (default): Picamera2 frames, YOLOv8n person detection, foot point
per box, point-in-polygon per zone, POST counts every 30 s.

Fake mode (--fake): no camera, no model. Posts made up counts that drift
over time so the public map visibly changes. Use it to demo the web app
from a laptop.

    python main.py --fake
    python main.py --fake --once
    python main.py --dry-run         # real camera, print counts, never POST
"""

from __future__ import annotations

import argparse
import logging
import random
import sys
import time

from config import Config, load_config
from poster import post_counts
from zones import Zone, ZoneCounter, fetch_zones

log = logging.getLogger("camera-unit")


# ---------------------------------------------------------------------------
# Shared loop
# ---------------------------------------------------------------------------


class ZoneCache:
    """Holds the zone list and re-fetches it every zone_refresh_s."""

    def __init__(self, cfg: Config) -> None:
        self.cfg = cfg
        self.zones: list[Zone] = []
        self.fetched_at = 0.0

    def get(self, force: bool = False) -> list[Zone]:
        now = time.time()
        if force or now - self.fetched_at >= self.cfg.zone_refresh_s:
            try:
                zones = fetch_zones(self.cfg.supabase_url, self.cfg.supabase_anon_key, self.cfg.room_id)
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


def publish(cfg: Config, zones: list[Zone], counts: dict[str, int], dry_run: bool) -> None:
    log.info("counts: %s", describe(zones, counts))
    if dry_run or not counts:
        return
    try:
        result = post_counts(cfg.ingest_url, cfg.api_key, counts)
        log.info("posted: accepted=%s ignored=%s", result.get("accepted"), result.get("ignored", 0))
    except Exception as e:  # noqa: BLE001
        log.error("post failed: %s", e)


# ---------------------------------------------------------------------------
# Fake mode
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
                ceiling = (z.capacity or 4) + 1
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


def run_fake(cfg: Config, args: argparse.Namespace) -> int:
    cache = ZoneCache(cfg)
    fake = FakeCounts(seed=args.seed)
    interval = args.interval or cfg.post_interval_s
    log.info("fake mode: posting to %s every %.0fs", cfg.ingest_url, interval)
    while True:
        zones = cache.get()
        if not zones:
            log.error("no zones for room %s, is the room published?", cfg.room_id)
            if args.once:
                return 1
        counts = fake.next(zones)
        publish(cfg, zones, counts, args.dry_run)
        if args.once:
            return 0
        time.sleep(interval)


# ---------------------------------------------------------------------------
# Real mode
# ---------------------------------------------------------------------------


def run_camera(cfg: Config, args: argparse.Namespace) -> int:
    try:
        from detector import Detector  # noqa: WPS433 (lazy, needs picamera2 + ultralytics)
    except ImportError as e:
        log.error("camera mode needs picamera2 and ultralytics: %s", e)
        log.error("use --fake to run without a camera")
        return 1

    cache = ZoneCache(cfg)
    counter = ZoneCounter(dwell_s=cfg.dwell_s)
    detector = Detector(cfg.frame_width, cfg.frame_height, cfg.confidence, model=args.model)
    interval = args.interval or cfg.post_interval_s

    log.info("camera mode: %dx%d, model %s, posting every %.0fs", cfg.frame_width, cfg.frame_height, args.model, interval)
    detector.start()
    try:
        next_post = time.time()
        latest: dict[str, int] = {}
        while True:
            zones = cache.get()
            feet = detector.foot_points()
            latest = counter.count(zones, feet)
            if args.verbose:
                log.info("frame: %d people, %s", len(feet), describe(zones, latest))

            now = time.time()
            if now >= next_post:
                publish(cfg, zones, latest, args.dry_run)
                next_post = now + interval
                if args.once:
                    return 0
    finally:
        detector.stop()


# ---------------------------------------------------------------------------


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Camera unit: counts people per zone and posts to /api/ingest.")
    p.add_argument("--fake", action="store_true", help="post made up counts, no camera or model needed")
    p.add_argument("--once", action="store_true", help="post one batch and exit")
    p.add_argument("--dry-run", action="store_true", help="print counts but never POST")
    p.add_argument("--interval", type=float, default=None, help="seconds between posts (default from config, 30)")
    p.add_argument("--seed", type=int, default=None, help="random seed for --fake")
    p.add_argument("--model", default="yolov8n.pt", help="Ultralytics model file (default yolov8n.pt)")
    p.add_argument("--verbose", "-v", action="store_true", help="log every frame")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    cfg = load_config()
    log.info("room %s, ingest %s", cfg.room_id, cfg.ingest_url)
    try:
        if args.fake:
            return run_fake(cfg, args)
        return run_camera(cfg, args)
    except KeyboardInterrupt:
        log.info("stopped")
        return 0


if __name__ == "__main__":
    sys.exit(main())
