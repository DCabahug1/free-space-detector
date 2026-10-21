"""Pull the latest code for the monitor's Update button. No tkinter here so it
can be unit tested on a laptop."""

from __future__ import annotations

import logging
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger("camera-unit.updater")

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent
REQUIREMENTS = HERE / "requirements.txt"
GIT_TIMEOUT_S = 60
PIP_TIMEOUT_S = 600


@dataclass
class UpdateResult:
    ok: bool
    updated: bool
    message: str


def pull_changed_files(output: str) -> list[str]:
    """File paths from a git pull summary, empty when nothing came in."""
    files: list[str] = []
    for line in output.splitlines():
        if "|" not in line:
            continue
        name = line.split("|", 1)[0].strip()
        if name:
            files.append(name)
    return files


def run(cmd: list[str], cwd: Path, timeout: int) -> tuple[int, str]:
    proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    return proc.returncode, (proc.stdout + proc.stderr).strip()


def update(repo_root: Path = REPO_ROOT, progress=None) -> UpdateResult:
    """git pull, then pip install if requirements.txt changed. Never raises."""

    def say(text: str) -> None:
        log.info(text)
        if progress:
            progress(text)

    try:
        say("Checking for updates")
        code, out = run(["git", "pull", "--ff-only"], repo_root, GIT_TIMEOUT_S)
    except FileNotFoundError:
        return UpdateResult(False, False, "git is not installed")
    except subprocess.TimeoutExpired:
        return UpdateResult(False, False, "Update timed out, is the network up?")
    if code != 0:
        last = out.splitlines()[-1] if out else "git pull failed"
        return UpdateResult(False, False, f"Update failed: {last}")

    files = pull_changed_files(out)
    if not files and "Already up to date" in out:
        return UpdateResult(True, False, "Already up to date")

    if any(f.endswith("requirements.txt") for f in files):
        say("Installing packages, this can take a few minutes")
        try:
            code, out = run([sys.executable, "-m", "pip", "install", "-r", str(REQUIREMENTS)], HERE, PIP_TIMEOUT_S)
        except subprocess.TimeoutExpired:
            return UpdateResult(False, True, "Package install timed out, restart to retry")
        if code != 0:
            last = out.splitlines()[-1] if out else "pip failed"
            return UpdateResult(False, True, f"Package install failed: {last}")

    n = len(files)
    return UpdateResult(True, True, f"Updated {n} file{'s' if n != 1 else ''}, restarting")
