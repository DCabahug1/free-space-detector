"""POSTs counts to the ingest route. Only counts leave the camera unit."""

from __future__ import annotations

import json
import urllib.error
import urllib.request


def post_counts(ingest_url: str, api_key: str, counts: dict[str, int], timeout: float = 10) -> dict:
    body = json.dumps(
        {
            "api_key": api_key,
            "counts": [{"zone_id": zone_id, "count": int(count)} for zone_id, count in counts.items()],
        }
    ).encode()
    req = urllib.request.Request(
        ingest_url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise RuntimeError(f"ingest returned {e.code}: {detail[:300]}") from None
