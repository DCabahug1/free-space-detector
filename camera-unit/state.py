"""Pairing state persisted next to the script (state.json, gitignored).

Holds the api_key issued by /api/pair/register plus the pair code, so a
reboot does not register a second camera unit.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

STATE_PATH = Path(__file__).with_name("state.json")


@dataclass
class State:
    api_key: str = ""
    unit_id: str = ""
    pair_code: str = ""

    @classmethod
    def load(cls) -> "State":
        if not STATE_PATH.exists():
            return cls()
        try:
            data = json.loads(STATE_PATH.read_text())
            return cls(**{k: str(v) for k, v in data.items() if k in cls.__dataclass_fields__})
        except (ValueError, TypeError):
            return cls()

    def save(self) -> None:
        STATE_PATH.write_text(json.dumps(asdict(self), indent=2))

    def clear(self) -> None:
        self.api_key = ""
        self.unit_id = ""
        self.pair_code = ""
        if STATE_PATH.exists():
            STATE_PATH.unlink()
