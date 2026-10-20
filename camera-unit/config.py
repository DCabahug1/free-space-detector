"""Configuration for the camera unit.

Values come from environment variables first, then camera-unit/config.json,
then the built in defaults. The defaults point at the demo project so the
script runs with no setup at all. An empty env var counts as set, so
CAMERA_API_KEY="" forces the pairing flow.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

CONFIG_PATH = Path(__file__).with_name("config.json")

DEFAULTS = {
    "supabase_url": "https://vituloqfqfrjdlblkuis.supabase.co",
    "supabase_anon_key": "sb_publishable_T-OApgS9A2f6lPjYH9jldw_Az0zv_NB",
    # Base URL of the web app. Endpoints are derived: /api/ingest, /api/frame, /api/pair/*.
    "server_url": "http://localhost:3000",
    # Demo camera unit key, so fake mode works with zero setup. Set it to ""
    # (or run with --pair) and the unit registers itself and shows a pair code.
    "api_key": "2441c417480637b57a34c72aa05a98063f5e6649e25f64ca",
    # Fallback room when the server cannot tell us one. Demo Classroom.
    "room_id": "f542505a-4a37-4612-a144-0f63c6f79cde",
    "post_interval_s": 30,
    "frame_interval_s": 4,
    "zone_refresh_s": 180,
    "pair_poll_s": 3,
    "dwell_s": 600,
    "frame_width": 1280,
    "frame_height": 720,
    "confidence": 0.4,
}

ENV_NAMES = {
    "supabase_url": "SUPABASE_URL",
    "supabase_anon_key": "SUPABASE_ANON_KEY",
    "server_url": "SERVER_URL",
    "api_key": "CAMERA_API_KEY",
    "room_id": "ROOM_ID",
    "post_interval_s": "POST_INTERVAL_S",
    "frame_interval_s": "FRAME_INTERVAL_S",
    "zone_refresh_s": "ZONE_REFRESH_S",
    "pair_poll_s": "PAIR_POLL_S",
    "dwell_s": "DWELL_S",
    "frame_width": "FRAME_WIDTH",
    "frame_height": "FRAME_HEIGHT",
    "confidence": "CONFIDENCE",
}


@dataclass
class Config:
    supabase_url: str
    supabase_anon_key: str
    server_url: str
    api_key: str
    room_id: str
    post_interval_s: float
    frame_interval_s: float
    zone_refresh_s: float
    pair_poll_s: float
    dwell_s: float
    frame_width: int
    frame_height: int
    confidence: float


def load_config() -> Config:
    values = dict(DEFAULTS)

    if CONFIG_PATH.exists():
        with CONFIG_PATH.open() as f:
            file_values = json.load(f)
        values.update({k: v for k, v in file_values.items() if k in DEFAULTS})

    for key, env_name in ENV_NAMES.items():
        raw = os.environ.get(env_name)
        if raw is not None:
            values[key] = raw

    return Config(
        supabase_url=str(values["supabase_url"]).rstrip("/"),
        supabase_anon_key=str(values["supabase_anon_key"]),
        server_url=str(values["server_url"]).rstrip("/"),
        api_key=str(values["api_key"]).strip(),
        room_id=str(values["room_id"]).strip(),
        post_interval_s=float(values["post_interval_s"]),
        frame_interval_s=float(values["frame_interval_s"]),
        zone_refresh_s=float(values["zone_refresh_s"]),
        pair_poll_s=float(values["pair_poll_s"]),
        dwell_s=float(values["dwell_s"]),
        frame_width=int(values["frame_width"]),
        frame_height=int(values["frame_height"]),
        confidence=float(values["confidence"]),
    )
