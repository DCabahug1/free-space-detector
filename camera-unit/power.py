"""Reboot and power off from the monitor's Settings screen. No tkinter here.

On Raspberry Pi OS the desktop user can run `systemctl reboot` and
`systemctl poweroff` without a password through polkit. If that is refused
(for example over SSH), `sudo -n` is tried, which works when the unit's
user has passwordless sudo, the Raspberry Pi OS default.
"""

from __future__ import annotations

import logging
import subprocess

log = logging.getLogger("camera-unit.power")

TIMEOUT_S = 15


def _run(commands: list[list[str]]) -> str | None:
    """Tries each command in turn. Returns None once one succeeds, else the
    last error text."""
    last = "not supported on this system"
    for cmd in commands:
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT_S)
        except FileNotFoundError:
            last = f"{cmd[0]} is not installed"
            continue
        except subprocess.TimeoutExpired:
            last = f"{' '.join(cmd)} timed out"
            continue
        if proc.returncode == 0:
            return None
        last = (proc.stderr or proc.stdout).strip().splitlines()[-1:] or [f"{' '.join(cmd)} failed"]
        last = last[0]
    log.error("power command failed: %s", last)
    return last


def reboot() -> str | None:
    return _run([["systemctl", "reboot"], ["sudo", "-n", "reboot"]])


def poweroff() -> str | None:
    return _run([["systemctl", "poweroff"], ["sudo", "-n", "poweroff"]])


SERVICE = "camera-unit.service"


def under_systemd() -> bool:
    """True when systemd started this process (it sets INVOCATION_ID)."""
    import os

    return bool(os.environ.get("INVOCATION_ID"))


def stop_service() -> str | None:
    """Stops the user service, which ends this process. Restart=always does
    not bring it back after an explicit stop; the desktop shortcut or a
    reboot does."""
    return _run([["systemctl", "--user", "stop", SERVICE]])
