"""HTTP calls to the web app. Only counts and single JPEG stills leave the
camera unit, never video."""

from __future__ import annotations

import json
import urllib.error
import urllib.request


class ApiError(RuntimeError):
    def __init__(self, status: int, detail: str) -> None:
        super().__init__(f"server returned {status}: {detail[:300]}")
        self.status = status


def _request(url: str, data: bytes | None, headers: dict[str, str], method: str, timeout: float) -> dict:
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise ApiError(e.code, e.read().decode(errors="replace")) from None


def _post_json(url: str, body: dict, timeout: float = 10) -> dict:
    return _request(url, json.dumps(body).encode(), {"Content-Type": "application/json"}, "POST", timeout)


def post_counts(server_url: str, api_key: str, counts: dict[str, int]) -> dict:
    body = {
        "api_key": api_key,
        "counts": [{"zone_id": zone_id, "count": int(count)} for zone_id, count in counts.items()],
    }
    return _post_json(f"{server_url}/api/ingest", body)


def post_frame(server_url: str, api_key: str, jpeg: bytes) -> dict:
    return _request(
        f"{server_url}/api/frame",
        jpeg,
        {"Content-Type": "image/jpeg", "x-api-key": api_key},
        "POST",
        timeout=15,
    )


def register(server_url: str) -> dict:
    """Creates a camera unit row. Returns unit_id, pair_code, api_key."""
    return _post_json(f"{server_url}/api/pair/register", {})


def pair_status(server_url: str, api_key: str, sharing: bool = True, version: str = "") -> dict:
    """Returns paired (bool) plus room_id, room_name and building_name once an
    admin assigned an area, and update_requested when an admin asked for a
    code update. sharing=False tells the server the unit paused. version is
    the running code's short git hash, shown in the admin app."""
    body = {"api_key": api_key, "sharing": sharing}
    if version:
        body["version"] = version
    return _post_json(f"{server_url}/api/pair/status", body)
